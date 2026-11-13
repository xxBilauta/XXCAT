const PHOTO_DB = 'neko-days-photo-journal';
const PHOTO_STORE = 'photos';
const MAX_PER_DAY = 25;
const MAX_ENTRIES = 1000;
const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 3 * 1024 * 1024;
const MAX_BACKUP_LENGTH = 64 * 1024 * 1024;
const ALLOWED_MIMES = new Set(['image/jpeg','image/png','image/webp']);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const photoIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6 9.5 3h5L16 6h3a2 2 0 0 1 2 2v11H3V8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="12" r="4"/><path d="M17.5 8.5h.01"/></svg>';
const galleryIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-7 5 8"/></svg>';
const closeIcon = '<svg aria-hidden="true"><use href="#i-close"/></svg>';
let databasePromise;
let mutationQueue = Promise.resolve();
let uploadQueue = Promise.resolve();
let hydrationCounter = 0;
let activePhotoId = null;

function isDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`===value;
}
function failureMessage(error,fallback='照片暫時無法儲存，請稍後再試。'){
  if(error?.name==='QuotaExceededError')return '裝置儲存空間不足，請先匯出備份，再移除不需要的照片。';
  if(error?.name==='SecurityError'||error?.name==='InvalidStateError')return '瀏覽器目前無法使用照片儲存空間，請確認儲存權限。';
  return error?.userMessage || fallback;
}
function photoError(message){const error=new Error(message);error.userMessage=message;return error;}
function openDatabase(){
  if(databasePromise)return databasePromise;
  databasePromise=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(photoError('此瀏覽器不支援本機照片儲存，請使用支援 IndexedDB 的瀏覽器。'));return;}
    const request=indexedDB.open(PHOTO_DB,1);
    let settled=false;
    request.onupgradeneeded=()=>{
      const database=request.result;
      const store=database.objectStoreNames.contains(PHOTO_STORE)?request.transaction.objectStore(PHOTO_STORE):database.createObjectStore(PHOTO_STORE,{keyPath:'id'});
      if(!store.indexNames.contains('date'))store.createIndex('date','date',{unique:false});
    };
    request.onsuccess=()=>{
      if(settled){request.result.close();return;}
      settled=true;const database=request.result;
      database.onversionchange=()=>{database.close();databasePromise=undefined;};
      resolve(database);
    };
    request.onerror=()=>{settled=true;reject(request.error||photoError('無法開啟照片儲存空間。'));};
    request.onblocked=()=>{settled=true;reject(photoError('照片儲存空間正由另一個分頁使用，請關閉其他喵日子分頁後重試。'));};
  }).catch(error=>{databasePromise=undefined;throw error;});
  return databasePromise;
}
async function transact(mode,work){
  const database=await openDatabase();
  return new Promise((resolve,reject)=>{
    let transaction;
    try{transaction=database.transaction(PHOTO_STORE,mode);}catch(error){reject(error);return;}
    let result;
    transaction.oncomplete=()=>resolve(result);
    transaction.onabort=()=>reject(transaction.error||photoError('照片操作沒有完成，原有資料仍會保留。'));
    transaction.onerror=()=>{};
    try{work(transaction.objectStore(PHOTO_STORE),value=>{result=value;},transaction);}catch(error){transaction.abort();reject(error);}
  });
}
function serializedMutation(work){const result=mutationQueue.then(work,work);mutationQueue=result.catch(()=>{});return result;}
async function readPhotos(date){return transact('readonly',(store,done)=>{const request=date?store.index('date').getAll(date):store.getAll();request.onsuccess=()=>done(request.result);});}
async function readPhoto(id){return transact('readonly',(store,done)=>{const request=store.get(id);request.onsuccess=()=>done(request.result);});}
async function insertPhoto(photo){
  return serializedMutation(async()=>{
    let constraintError;
    try{return await transact('readwrite',(store,done,transaction)=>{
      const dayCount=store.index('date').count(photo.date);
      dayCount.onsuccess=()=>{
        if(dayCount.result>=MAX_PER_DAY){constraintError=photoError(`每天最多收藏 ${MAX_PER_DAY} 張照片，請先移除不需要的照片。`);transaction.abort();return;}
        const allCount=store.count();
        allCount.onsuccess=()=>{
          if(allCount.result>=MAX_ENTRIES){constraintError=photoError(`目前最多收藏 ${MAX_ENTRIES} 張照片，請先備份並整理收藏。`);transaction.abort();return;}
          let size=photo.dataUrl.length;
          const cursor=store.openCursor();
          cursor.onsuccess=()=>{
            if(cursor.result){size+=cursor.result.value.dataUrl.length;if(size>MAX_BACKUP_LENGTH){constraintError=photoError('照片收藏已達 64 MB，請先匯出備份並整理部分照片。');transaction.abort();return;}cursor.result.continue();return;}
            const put=store.add(photo);put.onsuccess=()=>done(photo);
          };
        };
      };
    });}catch(error){throw constraintError||error;}
  });
}
async function deletePhoto(id){return serializedMutation(()=>transact('readwrite',(store,done)=>{const request=store.delete(id);request.onsuccess=()=>done();}));}

function decodeImage(blob){
  if(typeof createImageBitmap==='function')return createImageBitmap(blob,{imageOrientation:'from-image'}).then(bitmap=>({image:bitmap,width:bitmap.width,height:bitmap.height,release:()=>bitmap.close()})).catch(()=>decodeImageElement(blob));
  return decodeImageElement(blob);
}
function decodeImageElement(blob){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(blob);const image=new Image();
    image.onload=()=>{URL.revokeObjectURL(url);resolve({image,width:image.naturalWidth,height:image.naturalHeight,release:()=>{image.src='';}});};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(photoError('無法讀取這張照片，請改用 JPG、PNG 或 WebP 圖片。'));};
    image.src=url;
  });
}
function canvasBlob(canvas,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(photoError('照片壓縮未完成，請換一張照片再試。')),'image/jpeg',quality));}
function blobDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(photoError('照片讀取失敗，請重新選取。'));reader.readAsDataURL(blob);});}
async function preparePhoto(file,date){
  if(!isDate(date))throw photoError('請先選擇有效的手帳日期。');
  if(!file||file.size===0)throw photoError('這個圖片檔案是空的，請重新選取。');
  if(file.size>MAX_ORIGINAL_BYTES)throw photoError('單張原始照片需小於 20 MB，請選擇較小的圖片。');
  if(file.type&&!['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif'].includes(file.type))throw photoError('請選擇相片圖片，例如 JPG、PNG 或 WebP。');
  const decoded=await decodeImage(file);
  try{
    if(!decoded.width||!decoded.height||decoded.width*decoded.height>100_000_000)throw photoError('這張照片的尺寸太大，請先縮小後再選取。');
    const ratio=Math.min(1,1600/Math.max(decoded.width,decoded.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(decoded.width*ratio));canvas.height=Math.max(1,Math.round(decoded.height*ratio));
    const context=canvas.getContext('2d',{alpha:false});if(!context)throw photoError('瀏覽器無法處理圖片，請重新開啟頁面再試。');
    context.fillStyle='#fffef9';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(decoded.image,0,0,canvas.width,canvas.height);
    let blob=await canvasBlob(canvas,.8);
    if(blob.size>2_200_000)blob=await canvasBlob(canvas,.65);
    if(blob.size>2_200_000)blob=await canvasBlob(canvas,.5);
    const dataUrl=await blobDataUrl(blob);
    if(dataUrl.length>MAX_DATA_URL_LENGTH)throw photoError('照片壓縮後仍然太大，請選擇較小的圖片。');
    return {id:crypto.randomUUID(),date,name:(file.name||'我的照片').slice(0,200),mime:'image/jpeg',dataUrl,createdAt:new Date().toISOString()};
  }finally{decoded.release();}
}

export function renderPhotoCard(date){
  return `<section class="photo-card" data-photo-date="${esc(date)}" aria-label="${esc(date)} 影像手帳"><div class="photo-card-heading"><h3>${photoIcon}影像手帳</h3><span data-photo-count>小片刻，大收藏</span></div><div class="photo-actions"><button type="button" data-photo-action="camera">${photoIcon}拍照</button><button type="button" data-photo-action="gallery">${galleryIcon}相簿選圖</button></div><div class="photo-grid" data-photo-grid aria-live="polite"><p class="photo-empty">正在讀取照片…</p></div><p class="photo-storage-hint">照片只留在此裝置，也會一起匯出備份。</p></section>`;
}
export async function refreshPhotos(date){
  const token=String(++hydrationCounter);
  const cards=[...document.querySelectorAll('.photo-card[data-photo-date]')].filter(card=>card.dataset.photoDate===date);
  for(const card of cards)card.dataset.photoHydration=token;
  try{
    const photos=(await readPhotos(date)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    for(const card of cards){
      if(!card.isConnected||card.dataset.photoDate!==date||card.dataset.photoHydration!==token)continue;
      const grid=card.querySelector('[data-photo-grid]');
      card.querySelector('[data-photo-count]').textContent=photos.length?`${photos.length} / ${MAX_PER_DAY} 張`:'小片刻，大收藏';
      grid.innerHTML=photos.length?photos.map(photo=>`<div class="photo-thumbnail"><button type="button" class="photo-open" data-photo-open="${esc(photo.id)}" aria-label="查看照片：${esc(photo.name)}"><img src="${esc(photo.dataUrl)}" alt="${esc(photo.name)}" loading="lazy" decoding="async"/></button><button type="button" class="photo-delete" data-photo-delete="${esc(photo.id)}" aria-label="刪除照片：${esc(photo.name)}">${closeIcon}</button></div>`).join(''):'<div class="photo-empty"><span>✧</span>拍下今天，或選一張喜歡的照片。<small>貓咪陪你收藏生活裡的小畫面。</small></div>';
    }
  }catch(error){
    for(const card of cards){if(!card.isConnected||card.dataset.photoHydration!==token)continue;card.querySelector('[data-photo-grid]').innerHTML=`<p class="photo-empty photo-error">${esc(failureMessage(error,'無法讀取裝置照片，請重新開啟頁面再試。'))}</p>`;}
  }
}

function validatePhotoRecord(photo,ids,dateCounts){
  if(!photo||typeof photo!=='object'||Array.isArray(photo))throw photoError('照片備份的資料格式不正確。');
  if(typeof photo.id!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(photo.id)||ids.has(photo.id))throw photoError('照片備份含有無效或重複的識別碼。');
  ids.add(photo.id);
  if(!isDate(photo.date))throw photoError('照片備份含有無效的日期。');
  const dateCount=(dateCounts.get(photo.date)||0)+1;dateCounts.set(photo.date,dateCount);
  if(dateCount>MAX_PER_DAY)throw photoError(`同一天的照片不可超過 ${MAX_PER_DAY} 張。`);
  if(typeof photo.name!=='string'||!photo.name.trim()||photo.name.length>200)throw photoError('照片備份含有無效的檔案名稱。');
  if(!ALLOWED_MIMES.has(photo.mime)||typeof photo.dataUrl!=='string'||photo.dataUrl.length>MAX_DATA_URL_LENGTH)throw photoError('照片備份含有不支援或過大的圖片。');
  if(typeof photo.createdAt!=='string'||photo.createdAt.length>40||Number.isNaN(Date.parse(photo.createdAt)))throw photoError('照片備份的建立時間不正確。');
  const prefix=`data:${photo.mime};base64,`;
  if(!photo.dataUrl.startsWith(prefix))throw photoError('照片備份的圖片格式與資料不符。');
  const encoded=photo.dataUrl.slice(prefix.length);
  if(!encoded||encoded.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw photoError('照片備份含有無效的圖片編碼。');
  const binary=atob(encoded);
  const bytes=Uint8Array.from(binary,character=>character.charCodeAt(0));
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10;
  const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!({ 'image/jpeg':jpeg,'image/png':png,'image/webp':webp }[photo.mime]))throw photoError('照片備份的圖片內容不符合檔案格式。');
  return {normalized:{id:photo.id,date:photo.date,name:photo.name,mime:photo.mime,dataUrl:photo.dataUrl,createdAt:new Date(photo.createdAt).toISOString()},blob:new Blob([bytes],{type:photo.mime})};
}
export async function validatePhotos(photos){
  if(!Array.isArray(photos)||photos.length>MAX_ENTRIES)throw photoError(`照片備份必須是清單，且不可超過 ${MAX_ENTRIES} 張。`);
  let total=0;
  for(const photo of photos){if(typeof photo?.dataUrl!=='string')throw photoError('照片備份缺少圖片資料。');total+=photo.dataUrl.length;if(total>MAX_BACKUP_LENGTH)throw photoError('照片備份內容超過 64 MB，請分批整理後再匯入。');}
  const ids=new Set(),dateCounts=new Map(),normalized=[];
  for(const photo of photos){
    const checked=validatePhotoRecord(photo,ids,dateCounts);
    const decoded=await decodeImage(checked.blob);
    try{if(!decoded.width||!decoded.height||decoded.width>4096||decoded.height>4096)throw photoError('照片備份中的圖片尺寸不正確，請使用喵日子匯出的備份。');}finally{decoded.release();}
    normalized.push(checked.normalized);
  }
  return normalized;
}
export async function exportPhotos(){
  await uploadQueue;
  await mutationQueue;
  return (await readPhotos()).map(photo=>({id:photo.id,date:photo.date,name:photo.name,mime:photo.mime,dataUrl:photo.dataUrl,createdAt:photo.createdAt})).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt));
}
export async function replacePhotos(photos){
  const normalized=await validatePhotos(photos);
  await uploadQueue;
  await serializedMutation(()=>transact('readwrite',(store,done)=>{store.clear();for(const photo of normalized)store.put(photo);done();}));
}

export function installPhotos(context){
  if(document.getElementById('photo-gallery-input'))return;
  const camera=document.createElement('input');camera.type='file';camera.accept='image/*';camera.setAttribute('capture','environment');camera.id='photo-camera-input';camera.hidden=true;
  const gallery=document.createElement('input');gallery.type='file';gallery.accept='image/*';gallery.multiple=true;gallery.id='photo-gallery-input';gallery.hidden=true;
  document.body.append(camera,gallery);
  const dialog=document.createElement('dialog');dialog.id='photo-lightbox';dialog.className='app-dialog photo-lightbox';dialog.setAttribute('aria-labelledby','photo-lightbox-title');
  dialog.innerHTML=`<div class="dialog-heading"><div><span class="tiny-label">A MOMENT IN A PICTURE</span><h2 id="photo-lightbox-title">影像手帳</h2></div><button type="button" class="icon-button" data-photo-close aria-label="關閉照片">${closeIcon}</button></div><img id="photo-full-image" alt=""/><div class="photo-lightbox-footer"><span id="photo-lightbox-date"></span><button type="button" id="photo-lightbox-delete" class="danger-button">刪除照片</button></div>`;
  document.body.append(dialog);
  function setUploading(date,loading){
    for(const card of document.querySelectorAll('.photo-card[data-photo-date]')){if(card.dataset.photoDate!==date)continue;card.classList.toggle('photo-uploading',loading);for(const button of card.querySelectorAll('[data-photo-action]'))button.disabled=loading;card.querySelector('[data-photo-count]').textContent=loading?'正在收藏照片…':'小片刻，大收藏';}
  }
  async function uploadFiles(files,date){
    if(!files.length)return;
    let saved=0,failed=0,lastError='';setUploading(date,true);
    try{
      const existing=await readPhotos(date);const remaining=Math.max(0,MAX_PER_DAY-existing.length);
      if(files.length>remaining){context.toast(`這一天還能收藏 ${remaining} 張照片，請重新選取。`);return;}
      for(const file of files){
        try{const photo=await preparePhoto(file,date);await insertPhoto(photo);saved++;}catch(error){failed++;lastError=failureMessage(error);}
      }
      if(saved){context.rerender();context.toast(failed?`已收藏 ${saved} 張照片；${failed} 張未完成。${lastError}`:`已收藏 ${saved} 張生活小片刻 ♡`);}
      else if(failed)context.toast(lastError);
    }catch(error){context.toast(failureMessage(error));}
    finally{setUploading(date,false);await refreshPhotos(date);}
  }
  for(const input of [camera,gallery])input.addEventListener('change',event=>{
    const files=[...event.target.files];const date=input.dataset.photoDate||context.getSelected();input.value='';
    uploadQueue=uploadQueue.then(()=>uploadFiles(files,date),()=>uploadFiles(files,date));
  });
  async function askDelete(id){
    try{
      const photo=await readPhoto(id);if(!photo)return;
      context.confirm('移除這張照片？','照片會從這個裝置的手帳中刪除。若想保留，請先匯出手帳備份。',()=>{
        void deletePhoto(id).then(()=>{if(activePhotoId===id){dialog.close();activePhotoId=null;}context.rerender();context.toast('已移除這張照片');}).catch(error=>context.toast(failureMessage(error,'照片未能刪除，原有照片仍保留。')));
      });
    }catch(error){context.toast(failureMessage(error,'無法讀取這張照片。'));}
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.photoAction){
      const input=button.dataset.photoAction==='camera'?camera:gallery;
      input.dataset.photoDate=button.closest('[data-photo-date]')?.dataset.photoDate||context.getSelected();input.click();return;
    }
    if(button.hasAttribute('data-photo-close')){dialog.close();return;}
    if(button.dataset.photoOpen){
      const id=button.dataset.photoOpen;activePhotoId=id;
      void readPhoto(id).then(photo=>{if(!photo||activePhotoId!==id)return;document.getElementById('photo-full-image').src=photo.dataUrl;document.getElementById('photo-full-image').alt=photo.name;document.getElementById('photo-lightbox-title').textContent=photo.name;document.getElementById('photo-lightbox-date').textContent=photo.date;dialog.showModal();}).catch(error=>context.toast(failureMessage(error,'無法開啟這張照片。')));return;
    }
    if(button.dataset.photoDelete){void askDelete(button.dataset.photoDelete);return;}
    if(button.id==='photo-lightbox-delete'&&activePhotoId)void askDelete(activePhotoId);
  });
  dialog.addEventListener('close',()=>{activePhotoId=null;document.getElementById('photo-full-image').removeAttribute('src');});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
  return {openCamera:()=>{camera.dataset.photoDate=context.getSelected();camera.click();},openGallery:()=>{gallery.dataset.photoDate=context.getSelected();gallery.click();}};
}
