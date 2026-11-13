import {renderHealth,installHealth} from './health.js';
import {renderMoney,installMoney} from './money.js';
import {installPhotos,renderPhotoCard,refreshPhotos,exportPhotos,validatePhotos,replacePhotos} from './photos.js';
import {renderReport,installReport} from './report.js';
import {stickers,renderSticker,isValidSticker} from './stickers.js';
import {renderLearning,installLearning,validateLearning} from './learning.js';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key = 'neko-days-v1';
const categories = [
  {id:'life',label:'生活小事',color:'#a4b590',bg:'#ecf0e3',ink:'#839173'},
  {id:'work',label:'工作・學習',color:'#aab8c4',bg:'#edf0f3',ink:'#8c9ba7'},
  {id:'date',label:'約會・聚會',color:'#d9b2a4',bg:'#f7eae5',ink:'#b68e80'},
  {id:'me',label:'自己的時間',color:'#c4b7cb',bg:'#f0eaf2',ink:'#a496af'}
];
const moods = [{id:'happy',label:'超開心',face:'^ᴗ^'},{id:'good',label:'還不錯',face:'•ᴗ•'},{id:'calm',label:'平平的',face:'•ω•'},{id:'tired',label:'有點累',face:'–ω–'},{id:'sad',label:'想抱抱',face:';ω;'}];
const weekdays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const parseDate = iso => new Date(`${iso}T12:00:00`);
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const monthKey = date => date.slice(0,7);
const category = id => categories.find(c=>c.id===id) || categories[0];
const catStyle = id => {const c=category(id); return `--cat-color:${c.color};--cat-bg:${c.bg};--cat-ink:${c.ink}`;};
let selected = today;
let displayDate = parseDate(today);
let activeView = 'calendar';
let calendarMode = 'month';
let activeCategories = new Set(categories.map(c=>c.id));
let editingId = null;
let toastTimer;
let confirmAction;
let persistenceError = false;
let unreadableBackup = null;
const defaultData = () => {
  const prefix = monthKey(today);
  const dateAt = day => `${prefix}-${String(day).padStart(2,'0')}`;
  const demoEvent = (day,title,time,cat) => ({id:`demo-${day}-${cat}`,date:dateAt(day),title,time,category:cat,note:'這是一則範例日常，可以自由修改或刪除。',done:false,demo:true});
  const sample = [demoEvent(3,'去喜歡的咖啡店','14:00','me'),demoEvent(5,'整理靈感小筆記','10:00','work'),demoEvent(7,'週末散步日','16:00','life'),demoEvent(9,'新的一週，加油！','09:00','work'),demoEvent(11,'與朋友吃午餐','12:00','date'),demoEvent(16,'閱讀一本喜歡的書','20:00','me'),demoEvent(18,'小組討論','10:00','work'),demoEvent(21,'一起去野餐吧','11:00','date'),demoEvent(24,'幫植物澆澆水','08:00','life'),demoEvent(26,'電影與爆米花','19:00','me'),demoEvent(28,'和朋友的甜點約會','15:00','date')];
  sample.push({id:'demo-today-1',date:today,title:'買一束花，送給自己',time:'10:30',category:'life',note:'這是一則範例日常。',done:true,demo:true},{id:'demo-today-2',date:today,title:'和小橘的玩耍時間',time:'15:00',category:'life',note:'這是一則範例日常。',done:false,demo:true},{id:'demo-today-3',date:today,title:'留一點時間給自己',time:'20:00',category:'me',note:'這是一則範例日常。',done:false,demo:true});
  return {version:1,events:sample,journals:{},moods:{},stickers:{},health:{},ledger:[],learning:validateLearning(),theme:'sage',demo:true};
};
function validDate(d){return typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(parseDate(d).getTime()) && dateKey(parseDate(d))===d;}
function validateData(value){
  if(!value || value.version!==1 || !Array.isArray(value.events) || value.events.length>20000) throw new Error('無法辨識這份手帳備份');
  const ids = new Set();
  for(const e of value.events){if(!e || typeof e.id!=='string' || !e.id.trim() || ids.has(e.id) || !validDate(e.date) || typeof e.title!=='string' || !e.title.trim() || e.title.length>80 || !categories.some(c=>c.id===e.category) || typeof e.note!=='string' || e.note.length>2000 || typeof e.time!=='string' || (e.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)) || typeof e.done!=='boolean')throw new Error('備份中的行程格式不正確');ids.add(e.id);}
  for(const field of ['journals','moods','stickers']){if(!value[field] || typeof value[field]!=='object' || Array.isArray(value[field]))throw new Error('備份資料不完整');for(const [date,item] of Object.entries(value[field])){if(!validDate(date) || typeof item!=='string')throw new Error('備份中的日期或文字格式不正確');if(field==='journals' && item.length>10000)throw new Error('手帳文字過長');if(field==='moods' && !moods.some(m=>m.id===item))throw new Error('心情格式不正確');if(field==='stickers' && !isValidSticker(item))throw new Error('貼紙格式不正確');}}
  const health=value.health??{};
  if(typeof health!=='object'||Array.isArray(health))throw new Error('健康備份格式不正確');
  const mealIds=new Set();
  for(const [date,day] of Object.entries(health)){
    if(!validDate(date)||!day||!Number.isInteger(day.water)||day.water<0||day.water>100000||!Number.isInteger(day.goal)||day.goal<=0||day.goal>100000||!Array.isArray(day.meals)||day.meals.length>1000)throw new Error('喝水紀錄格式不正確');
    for(const m of day.meals){if(!m||typeof m.id!=='string'||!m.id.trim()||mealIds.has(m.id)||typeof m.name!=='string'||!m.name.trim()||m.name.length>100||!Number.isFinite(m.calories)||m.calories<0||m.calories>100000||m.calories!==Math.round(m.calories*10)/10||!['breakfast','lunch','dinner','snack'].includes(m.type))throw new Error('餐食紀錄格式不正確');mealIds.add(m.id);}
  }
  const ledger=value.ledger??[];if(!Array.isArray(ledger)||ledger.length>30000)throw new Error('收支備份格式不正確');
  const ledgerIds=new Set();
  for(const e of ledger){if(!e||typeof e.id!=='string'||!e.id.trim()||ledgerIds.has(e.id)||!validDate(e.date)||!['income','expense'].includes(e.type)||!Number.isFinite(e.amount)||e.amount<0.01||e.amount>999999999.99||e.amount!==Math.round(e.amount*100)/100||typeof e.title!=='string'||!e.title.trim()||e.title.length>80||!(e.type==='income'?['薪資','獎金','其他']:['餐飲','交通','購物','生活','娛樂','其他']).includes(e.category))throw new Error('收支紀錄格式不正確');ledgerIds.add(e.id);}
  return {version:1,events:value.events.map(e=>({...e})),journals:{...value.journals},moods:{...value.moods},stickers:{...value.stickers},health:structuredClone(health),ledger:ledger.map(e=>({...e})),learning:validateLearning(value.learning),theme:value.theme==='rose'?'rose':'sage',demo:!!value.demo};
}
let data;
try{const saved=localStorage.getItem(key);unreadableBackup=saved;data=saved?validateData(JSON.parse(saved)):defaultData();unreadableBackup=null;}catch{data={version:1,events:[],journals:{},moods:{},stickers:{},health:{},ledger:[],learning:validateLearning(),theme:'sage',demo:false};persistenceError=true;}
function save(){try{if(unreadableBackup!==null){localStorage.setItem(`${key}-recovery-${Date.now()}`,unreadableBackup);unreadableBackup=null;}localStorage.setItem(key,JSON.stringify(data));persistenceError=false;$('.storage-note').innerHTML='<span></span>小日常，已好好收藏';return true;}catch{persistenceError=true;$('.storage-note').textContent='尚未儲存，請匯出備份';toast('瀏覽器無法儲存，請到設定匯出備份');return false;}}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function requestConfirm(title,description,action){$('#confirm-title').textContent=title;$('#confirm-description').textContent=description;confirmAction=action;$('#confirm-dialog').showModal();}
const eventsFor = (date,filtered=false) => data.events.filter(e=>e.date===date && (!filtered || activeCategories.has(e.category))).sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
function render(){document.body.dataset.theme=data.theme;renderNav();renderMain();renderDay();renderFooter();}
function renderNav(){
  const labels={calendar:'我的行事曆',journal:'每日手帳',mood:'心情小記',stickers:'貼紙收藏',health:'健康日常',money:'收支流水帳',report:'每月回顧',learning:'韓文小教室'};
  const subtitles={calendar:'留一點時間給生活，也留一點給自己。',journal:'不必寫得很厲害，真實的你就很可愛。',mood:'每一種心情，都值得被溫柔接住。',stickers:'用一點點可愛，裝飾平凡的小日子。',health:'喝一口水，好好吃飯，溫柔照顧自己。',money:'把每一筆小花費，記成安心的日常。',report:'回頭看看，這個月也有好好生活。',learning:'每天認識一點韓文，和小橘一起慢慢進步。'};
  $$('.nav-item').forEach(b=>{b.classList.toggle('active',b.dataset.view===activeView);b.setAttribute('aria-current',b.dataset.view===activeView?'page':'false');});
  const moreIsActive=['report','mood','stickers','learning'].includes(activeView);
  $('#mobile-more').classList.toggle('active',moreIsActive);$('#mobile-more').setAttribute('aria-current',moreIsActive?'page':'false');
  $('#page-label').textContent=labels[activeView];$('#view-title').innerHTML=labels[activeView]+icon('paw');$('#view-subtitle').textContent=subtitles[activeView];
  $('#add-button').innerHTML=icon(activeView==='report'?'download':'plus')+(activeView==='health'?'新增餐食':activeView==='money'?'記一筆收支':activeView==='journal'?'拍照記日常':activeView==='report'?'下載報表':activeView==='learning'?'新增單字':'新增日常');
  $('.planner-layout').classList.toggle('report-layout',['report','learning'].includes(activeView));$('#day-panel').hidden=['report','learning'].includes(activeView);
  $('#category-filters').innerHTML=categories.map(c=>`<button class="category-filter" data-category="${c.id}" aria-pressed="${activeCategories.has(c.id)}" style="${catStyle(c.id)}"><span class="category-dot"></span>${c.label}<span class="filter-check">✓</span></button>`).join('');
}
function renderFooter(){$('#demo-label').innerHTML=data.demo?'範例手帳 <span>·</span> <button id="start-own">開始我的日常</button>':'每個小日子，都有貓陪你。';$('#demo-settings').hidden=!data.demo;}
function toolbar(){return `<div class="calendar-toolbar"><div class="month-switch"><div class="month-title"><strong>${displayDate.getFullYear()}</strong><span>${String(displayDate.getMonth()+1).padStart(2,'0')} 月</span><small>${months[displayDate.getMonth()]}</small></div><button class="icon-button previous" id="previous-month" aria-label="上一個月">${icon('chevron')}</button><button class="icon-button" id="next-month" aria-label="下一個月">${icon('chevron')}</button><button class="today-button" id="go-today">今天</button></div><div class="calendar-view-tabs"><button data-mode="month" class="${calendarMode==='month'?'active':''}">${icon('calendar')}月曆</button><button data-mode="list" class="${calendarMode==='list'?'active':''}">${icon('list')}列表</button></div></div>`;}
function renderMain(){
  const panel=$('#main-panel');panel.setAttribute('aria-label',{calendar:'行事曆',journal:'每日手帳',mood:'心情小記',stickers:'貼紙收藏',health:'健康日常',money:'收支流水帳',report:'每月回顧',learning:'韓文小教室'}[activeView]);
  if(activeView==='learning'){panel.innerHTML=renderLearning(selected,data);return;}
  if(activeView==='report'){panel.innerHTML=renderReport(selected,data);return;}
  if(activeView==='health'){panel.innerHTML=renderHealth(selected,data);return;}
  if(activeView==='money'){panel.innerHTML=renderMoney(selected,data);return;}
  if(activeView==='calendar'){panel.innerHTML=toolbar()+(calendarMode==='month'?calendarMarkup():agendaMarkup());return;}
  if(activeView==='journal'){
    const entries=Object.entries(data.journals).filter(([,text])=>text.trim()).sort((a,b)=>b[0].localeCompare(a[0]));
    panel.innerHTML=`<div class="collection-header"><h3>把小日子，寫成故事</h3><p>已收藏 ${entries.length} 篇手帳。點選紙箋回看那天的文字與照片。</p><label class="journal-date-label">回看日期 <input type="date" id="journal-selected-date" value="${selected}" aria-label="手帳日期"/></label></div>`+(entries.length?`<div class="journal-entries">${entries.map(([date,text])=>`<button class="journal-entry" data-select="${date}"><small>${escapeHTML(date)} · ${weekdays[parseDate(date).getDay()]}</small><p>${escapeHTML(text.slice(0,160))}${text.length>160?'…':''}</p><span>${data.stickers[date]?renderSticker(data.stickers[date]):'✧'}</span></button>`).join('')}</div>`:`<div class="empty-state"><img src="./assets/sleepy-cat.svg" alt=""/>第一篇手帳，從今天的小事開始。<br>在「今日手帳」寫下心情，或拍張照片吧。</div>`)+`<div class="journal-photo-area">${renderPhotoCard(selected)}</div>`;refreshPhotos(selected);return;
  }
  if(activeView==='mood'){
    const entries=Object.entries(data.moods).sort((a,b)=>b[0].localeCompare(a[0]));
    panel.innerHTML=`<div class="collection-header"><h3>心情，是日子的顏色</h3><p>已記錄 ${entries.length} 天。開心或不開心，貓咪都會陪著你。</p></div><div class="mood-summary">${moods.map(m=>`<div class="mood-stat"><strong>${entries.filter(([,v])=>v===m.id).length}</strong><span>${m.label}</span></div>`).join('')}</div>`+(entries.length?`<div class="mood-history">${entries.map(([date,id])=>`<button data-select="${date}"><span>${date} · ${weekdays[parseDate(date).getDay()]}</span><span>${moods.find(m=>m.id===id).face}　${moods.find(m=>m.id===id).label}</span></button>`).join('')}</div>`:'<div class="empty-state">今天的你，感覺怎麼樣呢？<br>點一下右側的小貓，記下第一個心情。</div>');return;
  }
  panel.innerHTML=`<div class="collection-header"><span class="tiny-label">ZOA STICKER COLLECTION</span><h3>今天，讓 ZOA 陪你</h3><p>點選貼紙，裝飾 ${parseDate(selected).getMonth()+1} 月 ${parseDate(selected).getDate()} 日。九款依你提供的圖片繪製的 ZOA 主題插畫。</p></div><div class="sticker-grid">${stickers.map((s,i)=>`<button class="sticker-item" data-sticker="${i}" aria-label="貼上${s.name}" aria-pressed="${data.stickers[selected]===s.id}">${renderSticker(s.id)}<small>${s.name}</small></button>`).join('')}</div>${data.stickers[selected]?'<button id="remove-sticker" class="secondary-button sticker-remove">移除這一天的貼紙</button>':''}`;
}
function calendarMarkup(){
  const first=new Date(displayDate.getFullYear(),displayDate.getMonth(),1,12);const start=new Date(first);start.setDate(1-first.getDay());
  const daysInMonth=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();const cells=Math.ceil((first.getDay()+daysInMonth)/7)*7;
  let html='<div class="week-header" aria-hidden="true">'+['日 SUN','一 MON','二 TUE','三 WED','四 THU','五 FRI','六 SAT'].map(d=>`<span>${d}</span>`).join('')+'</div><div class="calendar-grid" role="grid" aria-label="月份日期">';
  for(let i=0;i<cells;i++){const d=new Date(start);d.setDate(start.getDate()+i);const date=dateKey(d);const events=eventsFor(date,true);html+=`<div class="day-cell ${d.getMonth()!==first.getMonth()?'outside':''} ${date===today?'is-today':''} ${date===selected?'selected':''}" tabindex="${date===selected?'0':'-1'}" role="gridcell" aria-selected="${date===selected}" aria-label="${d.getMonth()+1}月${d.getDate()}日，${events.length}項行程${data.journals[date]?'，有手帳':''}${date===today?'，今天':''}" data-date="${date}"><span class="day-number">${d.getDate()}</span>${data.journals[date]?'<span class="journal-dot" title="有手帳"></span>':''}${date===today?'<span class="today-tag">今天</span>':''}${events.slice(0,2).map(e=>`<span class="calendar-event ${e.done?'done':''}" style="${catStyle(e.category)}" title="${escapeHTML(e.title)}">${escapeHTML(e.title)}</span>`).join('')}${events.length>2?`<span class="more-events">+${events.length-2} 個日常</span>`:''}${data.stickers[date]?`<span class="day-sticker">${renderSticker(data.stickers[date])}</span>`:''}</div>`;}
  html+='</div>';const count=data.events.filter(e=>monthKey(e.date)===dateKey(displayDate).slice(0,7)&&activeCategories.has(e.category)).length;
  return html+`<div class="calendar-footer"><span>${icon('paw')}這個月，有 ${count} 件值得期待的小事</span><span>點選日期，收藏你的日常 ♡</span></div>`;
}
function agendaMarkup(){const dates=[...new Set(data.events.filter(e=>monthKey(e.date)===monthKey(dateKey(displayDate))&&activeCategories.has(e.category)).map(e=>e.date))].sort();return dates.length?`<div class="agenda-list">${dates.map(date=>`<h3 class="agenda-date">${parseDate(date).getMonth()+1} 月 ${parseDate(date).getDate()} 日 · ${weekdays[parseDate(date).getDay()]}</h3>${eventsFor(date,true).map(e=>`<button class="agenda-item ${e.done?'done':''}" data-edit="${escapeHTML(e.id)}" style="${catStyle(e.category)}"><span class="category-dot"></span><small>${e.time||'全天'}</small><span>${escapeHTML(e.title)}</span><span>${category(e.category).label}</span></button>`).join('')}`).join('')}</div>`:'<div class="empty-state">這個月還是一張空白的畫紙。<br>新增一件想做的小事吧。</div>';}
function renderDayContent(){const d=parseDate(selected),events=eventsFor(selected);$('#day-panel').innerHTML=`<section class="daily-card"><div class="day-heading"><h3>${selected===today?'今天的小日常':'這天的小日常'}</h3><span>${String(d.getMonth()+1).padStart(2,'0')} 月 · ${weekdays[d.getDay()]}</span></div><div class="day-date"><strong>${String(d.getDate()).padStart(2,'0')}</strong><span class="date-divider">/</span><span>${months[d.getMonth()].slice(0,3)} ${d.getFullYear()}</span></div><hr class="daily-divider"/>${events.length?events.map(e=>`<div class="daily-event ${e.done?'done':''}"><button class="task-check ${e.done?'checked':''}" data-toggle="${escapeHTML(e.id)}" role="checkbox" aria-checked="${e.done}" aria-label="${escapeHTML(e.title)}：${e.done?'已完成':'未完成'}">${e.done?icon('check'):''}</button><button class="daily-event-info" data-edit="${escapeHTML(e.id)}"><strong>${escapeHTML(e.title)}</strong><small style="${catStyle(e.category)}">${e.time||'全天'}<span>·</span><span class="category-dot"></span>${category(e.category).label}</small></button><span class="edit-hint">↗</span></div>`).join(''):'<p class="empty-day">還沒有安排也沒關係，<br>留白也是一種美好。</p>'}<button class="add-small" id="add-day">${icon('plus')}新增一個小日常</button></section><section class="mood-card"><div class="card-title"><h3>今天，心情如何？</h3><span>A LITTLE CHECK-IN</span></div><div class="mood-options">${moods.map(m=>`<button class="mood-choice ${data.moods[selected]===m.id?'selected':''}" data-mood="${m.id}" aria-pressed="${data.moods[selected]===m.id}" aria-label="心情：${m.label}"><span class="mood-face">${m.face}</span><small>${m.label}</small></button>`).join('')}</div><p class="mood-caption">${data.moods[selected]?'這份心情，貓咪替你收好了 ♡':'不管哪種心情，都有貓咪陪著你 ♡'}</p></section><section class="journal-card"><div class="card-title"><h3>${icon('pencil')}今日手帳</h3><span>${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}</span></div><textarea id="journal-text" maxlength="10000" aria-label="${selected} 每日手帳" placeholder="今天的小小美好是…\n一杯剛剛好的咖啡，\n或是貓咪窩在身邊的午後。">${escapeHTML(data.journals[selected]||'')}</textarea><div class="journal-card-bottom"><span id="journal-status">${data.journals[selected]?'已收藏 ♡':'隨手記下，自動收藏'}</span><button class="sticker-inline" id="open-stickers" aria-label="選擇今日貼紙">${data.stickers[selected]?renderSticker(data.stickers[selected]):'🐾'}</button></div></section>`;}
function renderDay(){renderDayContent();$('#day-panel').insertAdjacentHTML('beforeend',renderPhotoCard(selected));refreshPhotos(selected);}
function setSelected(date,{focus=false}={}){selected=date;displayDate=parseDate(date);renderMain();renderDay();if(focus)$(`[data-date="${date}"]`)?.focus();}
function openEntry(id=null){editingId=id;const e=data.events.find(x=>x.id===id);$('#event-title').setCustomValidity('');$('#entry-heading').textContent=e?'編輯這個小日常':'新增一個小日常';$('#event-title').value=e?.title||'';$('#event-date').value=e?.date||selected;$('#event-time').value=e?.time||'';$('#event-category').innerHTML=categories.map(c=>`<option value="${c.id}">${c.label}</option>`).join('');$('#event-category').value=e?.category||'life';$('#event-note').value=e?.note||'';$('#delete-event').hidden=!e;$('#entry-dialog').showModal();$('#event-title').focus();}
function changeView(view){activeView=view;render();}
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.moreView){$('#more-dialog').close();changeView(b.dataset.moreView);return;}
  if(b.dataset.view){changeView(b.dataset.view);return;}
  if(b.dataset.category){const id=b.dataset.category;activeCategories.has(id)?activeCategories.delete(id):activeCategories.add(id);activeView='calendar';render();return;}
  if(b.dataset.mode){calendarMode=b.dataset.mode;renderMain();return;}
  if(b.dataset.edit){openEntry(b.dataset.edit);return;}
  if(b.dataset.toggle){const e=data.events.find(x=>x.id===b.dataset.toggle);e.done=!e.done;e.demo=false;save();renderMain();renderDay();return;}
  if(b.dataset.mood){if(data.moods[selected]===b.dataset.mood)delete data.moods[selected];else data.moods[selected]=b.dataset.mood;const saved=save();renderDay();if(activeView==='mood')renderMain();if(saved)toast(data.moods[selected]?'心情已收藏，抱抱你 ♡':'已取消這天的心情');return;}
  if(b.dataset.select){setSelected(b.dataset.select);if(activeView==='journal')$('#journal-text').focus();return;}
  if(b.dataset.sticker!==undefined){data.stickers[selected]=stickers[Number(b.dataset.sticker)].id;const saved=save();renderMain();renderDay();if(saved)toast('ZOA 貼紙，貼好了！');return;}
  if(b.dataset.theme){data.theme=b.dataset.theme;save();render();$$('[data-theme]', $('.theme-options')).forEach(el=>el.classList.toggle('selected',el.dataset.theme===data.theme));return;}
  if(b.classList.contains('close-dialog')){b.closest('dialog').close();return;}
  switch(b.id){
    case 'mobile-more':$('#more-dialog').showModal();break;
    case 'more-settings':$('#more-dialog').close();$('#settings-dialog').showModal();break;
    case 'add-button':if(activeView==='health')$('#health-add-meal')?.click();else if(activeView==='money')$('#money-add-entry')?.click();else if(activeView==='journal')$('[data-photo-action="camera"]')?.click();else if(activeView==='report')$('#report-export-csv')?.click();else if(activeView==='learning')$('#learning-add-word')?.click();else openEntry();break;
    case 'add-day':openEntry();break;
    case 'previous-month':case 'next-month':displayDate=new Date(displayDate.getFullYear(),displayDate.getMonth()+(b.id==='next-month'?1:-1),1,12);selected=dateKey(displayDate);renderMain();renderDay();break;
    case 'go-today':setSelected(today);break;
    case 'open-stickers':changeView('stickers');break;
    case 'remove-sticker':delete data.stickers[selected];save();renderMain();renderDay();break;
    case 'settings-button':case 'avatar-settings':case 'start-own':$('#settings-dialog').showModal();$$('.theme-options button').forEach(el=>el.classList.toggle('selected',el.dataset.theme===data.theme));break;
    case 'search-button':$('#search-input').value='';renderSearch('');$('#search-dialog').showModal();$('#search-input').focus();break;
    case 'export-button':exportData();break;
    case 'delete-event':requestConfirm('要刪除這個小日常嗎？','刪除後無法復原，其他日常會好好保留。',()=>{data.events=data.events.filter(e=>e.id!==editingId);save();$('#entry-dialog').close();render();toast('已刪除這個日常');});break;
    case 'clear-demo':requestConfirm('開始屬於你的手帳','將清除未修改的範例行程，你自己寫下的內容都會保留。',()=>{data.events=data.events.filter(e=>!e.demo);data.demo=false;save();render();$('#settings-dialog').close();toast('新的故事，就從今天開始 ♡');});break;
    case 'confirm-accept':$('#confirm-dialog').close();confirmAction?.();confirmAction=null;break;
    case 'confirm-cancel':$('#confirm-dialog').close();confirmAction=null;break;
  }
});
$('#main-panel').addEventListener('click',event=>{const cell=event.target.closest('[data-date]');if(cell)setSelected(cell.dataset.date);});
$('#main-panel').addEventListener('change',event=>{if(event.target.id==='journal-selected-date'&&validDate(event.target.value))setSelected(event.target.value);});
$('#main-panel').addEventListener('dblclick',event=>{const cell=event.target.closest('[data-date]');if(cell){setSelected(cell.dataset.date);openEntry();}});
$('#main-panel').addEventListener('keydown',event=>{const cell=event.target.closest('[data-date]');if(!cell)return;const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(event.key in offsets){event.preventDefault();const d=parseDate(cell.dataset.date);d.setDate(d.getDate()+offsets[event.key]);setSelected(dateKey(d),{focus:true});}else if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(cell.dataset.date);openEntry();}});
$('#entry-form').addEventListener('submit',event=>{event.preventDefault();const title=$('#event-title').value.trim();if(!title){$('#event-title').setCustomValidity('寫下一個小標題吧');$('#event-title').reportValidity();return;}const date=$('#event-date').value;if(!validDate(date)){toast('請選擇有效的日期');return;}const old=data.events.find(e=>e.id===editingId);const entry={id:editingId||crypto.randomUUID(),title,date,time:$('#event-time').value,category:$('#event-category').value,note:$('#event-note').value.trim(),done:old?.done||false,demo:false};if(old)data.events[data.events.indexOf(old)]=entry;else data.events.push(entry);selected=date;displayDate=parseDate(date);const saved=save();$('#entry-dialog').close();render();if(saved)toast('小日常已收藏 ♡');});
$('#event-title').addEventListener('input',()=>$('#event-title').setCustomValidity(''));
$('#day-panel').addEventListener('input',event=>{if(event.target.id!=='journal-text')return;const value=event.target.value;if(value.trim())data.journals[selected]=value;else delete data.journals[selected];const saved=save();$('#journal-status').textContent=saved?'已收藏 ♡':'尚未儲存，請匯出';renderMain();});
$('.brand').addEventListener('click',event=>{event.preventDefault();selected=today;displayDate=parseDate(today);changeView('calendar');});
function renderSearch(query){const q=query.trim().toLocaleLowerCase();if(!q){$('#search-results').innerHTML='<div class="empty-state">輸入關鍵字，找找收藏過的小日常。</div>';return;}const matches=data.events.filter(e=>`${e.title} ${e.note}`.toLocaleLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date));$('#search-results').innerHTML=matches.length?matches.map(e=>`<button class="search-result" data-result="${escapeHTML(e.id)}">${escapeHTML(e.title)}<small>${e.date}　${e.time||'全天'} · ${category(e.category).label}</small></button>`).join(''):'<div class="empty-state">沒有找到這個小片段，換個字試試？</div>';}
$('#search-input').addEventListener('input',e=>renderSearch(e.target.value));
$('#search-results').addEventListener('click',e=>{const b=e.target.closest('[data-result]');if(!b)return;const entry=data.events.find(x=>x.id===b.dataset.result);$('#search-dialog').close();selected=entry.date;displayDate=parseDate(selected);changeView('calendar');openEntry(entry.id);});
async function exportData(){
  const button=$('#export-button');button.disabled=true;
  try{const photos=await exportPhotos();const url=URL.createObjectURL(new Blob([JSON.stringify({...data,photos},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`喵日子手帳-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`手帳與 ${photos.length} 張照片已匯出`);}catch{toast('照片讀取失敗，備份尚未匯出，請再試一次');}finally{button.disabled=false;}
}
$('#import-input').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    if(file.size>100_000_000)throw new Error('檔案太大，請選擇 100 MB 以下的手帳備份');
    const parsed=JSON.parse(await file.text());const imported=validateData(parsed);const importedPhotos=await validatePhotos(parsed.photos??[]);
    requestConfirm('匯入這份手帳嗎？',`這份備份有 ${imported.events.length} 個日常、${Object.keys(imported.journals).length} 篇手帳、${Object.keys(imported.health).length} 天健康紀錄、${imported.ledger.length} 筆收支、${Object.keys(imported.learning.days).length} 天學習紀錄與 ${importedPhotos.length} 張照片，會取代目前資料。建議先匯出目前的手帳。`,async()=>{
      const oldData=data;let oldPhotos;let photosReplaced=false;
      try{oldPhotos=await exportPhotos();await replacePhotos(importedPhotos);photosReplaced=true;data=imported;if(!save())throw new Error('無法儲存手帳');render();toast('手帳與照片已匯入，歡迎回來 ♡');}
      catch{data=oldData;if(photosReplaced){try{await replacePhotos(oldPhotos);}catch{toast('匯入未完成，請保留備份後再試一次');return;}}render();toast('匯入未完成，原本的手帳已保留');}
    });
  }catch(error){toast(error instanceof SyntaxError?'這不是有效的 JSON 手帳備份':error.message);}finally{e.target.value='';}
});
$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}}));
document.addEventListener('keydown',event=>{if(event.key==='Escape')confirmAction=null;});
$('#today-label').textContent=`${parseDate(today).getFullYear()} 年 ${parseDate(today).getMonth()+1} 月 ${parseDate(today).getDate()} 日　${weekdays[parseDate(today).getDay()]}`;
const trackerContext={getData:()=>data,getSelected:()=>selected,save,toast,rerender:render,confirm:requestConfirm,setSelected};
installHealth(trackerContext);installMoney(trackerContext);
installReport(trackerContext);
installLearning(trackerContext);
installPhotos({getSelected:()=>selected,toast,confirm:requestConfirm,rerender:render});
render();
if(persistenceError){$('.storage-note').textContent='本機資料讀取異常，尚未覆寫';toast('無法讀取本機手帳，請先檢查備份');}
else save();
