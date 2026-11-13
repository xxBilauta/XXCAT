const moneyCategories = {
  expense: [{name:'餐飲',icon:'🍙'},{name:'交通',icon:'🚲'},{name:'購物',icon:'🛍️'},{name:'生活',icon:'🏡'},{name:'娛樂',icon:'🎨'},{name:'其他',icon:'🐾'}],
  income: [{name:'薪資',icon:'🌱'},{name:'獎金',icon:'✨'},{name:'其他',icon:'🐾'}]
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency = cents => new Intl.NumberFormat('zh-TW',{minimumFractionDigits:cents%100 ? 2 : 0,maximumFractionDigits:2}).format(cents/100);
const centsOf = entry => Math.round(entry.amount*100);
const sum = entries => entries.reduce((n,entry)=>n+centsOf(entry),0);
const svg = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const dateObject = iso => new Date(`${iso}T12:00:00`);
const isoDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const dateIsValid = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(dateObject(iso).getTime()) && isoDate(dateObject(iso))===iso;
const categoryIcon = entry => moneyCategories[entry.type]?.find(item=>item.name===entry.category)?.icon || '🐾';
let filter = 'all';
let ctx;
let editingId = null;

export function renderMoney(date,data){
  const month=date.slice(0,7);
  const entries=(data.ledger||[]).filter(entry=>entry.date.slice(0,7)===month);
  const income=sum(entries.filter(entry=>entry.type==='income'));
  const expense=sum(entries.filter(entry=>entry.type==='expense'));
  const filtered=entries.filter(entry=>filter==='all'||entry.type===filter).sort((a,b)=>b.date.localeCompare(a.date));
  const dates=[...new Set(filtered.map(entry=>entry.date))];
  const shares=moneyCategories.expense.map(cat=>({...cat,total:sum(entries.filter(entry=>entry.type==='expense'&&entry.category===cat.name))})).filter(cat=>cat.total>0).sort((a,b)=>b.total-a.total);
  return `<div class="money-section"><div class="money-toolbar"><div><span class="tiny-label">A LITTLE SAVING, A LITTLE JOY</span><h3>每一筆，都有生活的樣子。</h3></div><div class="money-month"><button data-money-month="-1" class="icon-button previous" aria-label="收支上一個月">${svg('chevron')}</button><strong>${month.replace('-',' 年 ')} 月</strong><button data-money-month="1" class="icon-button" aria-label="收支下一個月">${svg('chevron')}</button></div></div>
    <div class="money-summary"><div class="money-stat money-income"><span>本月收入 <span>↗</span></span><strong><small>NT$</small> ${currency(income)}</strong><p>每一份努力，都好好收藏</p></div><div class="money-stat money-expense"><span>本月支出 <span>↘</span></span><strong><small>NT$</small> ${currency(expense)}</strong><p>把錢花在喜歡的生活上</p></div><div class="money-stat money-balance"><span>本月結餘 <span>♧</span></span><strong><small>NT$</small> ${currency(income-expense)}</strong><p>收入 − 支出</p></div></div>
    ${shares.length?`<div class="money-spending"><div class="money-subhead"><h4>這個月，花在哪裡？</h4><span>支出分類</span></div><div class="money-sharebar" aria-hidden="true">${shares.map(cat=>`<span class="money-share money-cat-${moneyCategories.expense.findIndex(c=>c.name===cat.name)}" style="flex:${cat.total}"></span>`).join('')}</div><div class="money-sharelabels">${shares.map(cat=>`<span><i class="money-cat-${moneyCategories.expense.findIndex(c=>c.name===cat.name)}"></i>${cat.name}<strong>NT$ ${currency(cat.total)}</strong></span>`).join('')}</div></div>`:''}
    <div class="money-record-heading"><div><h4>日常流水帳 <small>${filtered.length} 筆紀錄</small></h4><div class="money-filters" role="group" aria-label="篩選收支">${[['all','全部'],['expense','支出'],['income','收入']].map(([value,label])=>`<button data-money-filter="${value}" aria-pressed="${filter===value}" class="${filter===value?'active':''}">${label}</button>`).join('')}</div></div><button id="money-add-entry" class="secondary-button" data-money-add="expense">${svg('plus')}記一筆</button></div>
    ${dates.length?`<div class="money-records">${dates.map(day=>{const records=filtered.filter(entry=>entry.date===day);const total=records.reduce((n,e)=>n+(e.type==='income'?1:-1)*centsOf(e),0);return `<div class="money-date-label"><span>${Number(day.slice(5,7))} 月 ${Number(day.slice(8))} 日 <small>${['週日','週一','週二','週三','週四','週五','週六'][dateObject(day).getDay()]}</small></span><small>篩選後淨額 ${total>0?'+':''}${currency(total)}</small></div>${records.map(entry=>`<button class="money-record" data-money-edit="${esc(entry.id)}" aria-label="編輯${entry.type==='income'?'收入':'支出'}：${esc(entry.title)}，${esc(entry.amount)}元"><span class="money-record-icon ${entry.type==='income'?'money-record-income':''}">${categoryIcon(entry)}</span><span class="money-record-text"><strong>${esc(entry.title)}</strong><small>${esc(entry.category)} · ${entry.type==='income'?'收入':'支出'}</small></span><span class="money-record-amount ${entry.type}">${entry.type==='income'?'+':'−'} ${currency(centsOf(entry))}<small>TWD</small></span><span class="money-edit-mark">›</span></button>`).join('')}`;}).join('')}</div>`:`<div class="money-empty"><img src="./assets/sleepy-cat.svg" alt="睡在一旁的貓咪"/><h4>${entries.length?'這個分類還沒有紀錄':'讓小貓陪你，記下第一筆。'}</h4><p>${entries.length?'試試其他分類，或新增一筆收支。':'早餐的一杯咖啡，或今天的小小收入，<br>都可以是好好生活的開始。'}</p><button class="primary-button" data-money-add="expense">${svg('plus')}新增收支</button></div>`}
    <p class="money-footnote">金額以新臺幣（TWD）記錄 · 結餘只計算本月已記錄的收入與支出</p></div>`;
}

function fillCategories(type,selected){
  const select=document.querySelector('#money-category');
  select.innerHTML=moneyCategories[type].map(cat=>`<option value="${cat.name}">${cat.icon} ${cat.name}</option>`).join('');
  if(moneyCategories[type].some(cat=>cat.name===selected))select.value=selected;
}

function openEntry(id=null,type='expense'){
  const old=(ctx.getData().ledger||[]).find(entry=>entry.id===id);
  editingId=old?.id||null;
  const entryType=old?.type||type;
  document.querySelector('#money-dialog-title').textContent=old?'修改這一筆日常':'記下一筆小日常';
  document.querySelector('#money-entry-type').value=entryType;
  document.querySelector('#money-entry-title').value=old?.title||'';
  document.querySelector('#money-entry-title').setCustomValidity('');
  document.querySelector('#money-entry-amount').value=old?.amount??'';
  document.querySelector('#money-entry-amount').setCustomValidity('');
  document.querySelector('#money-entry-date').value=old?.date||ctx.getSelected();
  fillCategories(entryType,old?.category);
  document.querySelector('#money-delete-entry').hidden=!old;
  document.querySelector('#money-dialog').showModal();
  document.querySelector('#money-entry-title').focus();
}

export function installMoney(context){
  if(ctx)return;
  ctx=context;
  const dialog=document.createElement('dialog');
  dialog.id='money-dialog';dialog.className='app-dialog money-dialog';
  dialog.setAttribute('aria-labelledby','money-dialog-title');
  dialog.innerHTML=`<form id="money-entry-form"><div class="dialog-heading"><div><span class="tiny-label">YOUR LITTLE MONEY JOURNAL</span><h2 id="money-dialog-title">記下一筆小日常</h2></div><button type="button" class="icon-button" data-money-close aria-label="關閉收支表單">${svg('close')}</button></div><div class="form-fields"><div class="form-row"><label for="money-entry-type">收支類型<select id="money-entry-type"><option value="expense">支出</option><option value="income">收入</option></select></label><label for="money-entry-date">記帳日期<input id="money-entry-date" type="date" required/></label></div><label for="money-entry-title">收支名稱<input id="money-entry-title" type="text" maxlength="80" placeholder="例如：貓咪咖啡廳的下午茶" required/></label><div class="form-row"><label for="money-entry-amount">金額（新臺幣）<input id="money-entry-amount" type="number" min="0.01" max="999999999.99" step="0.01" inputmode="decimal" placeholder="0" required/></label><label for="money-category">收支分類<select id="money-category"></select></label></div></div><div class="dialog-actions"><button id="money-delete-entry" type="button" class="danger-button" data-money-delete hidden>刪除紀錄</button><button type="button" class="text-button" data-money-close>取消</button><button type="submit" class="primary-button">收藏這一筆 ${svg('check')}</button></div></form>`;
  document.body.append(dialog);
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-money-add')){openEntry(null,button.dataset.moneyAdd);return;}
    if(button.hasAttribute('data-money-edit')){openEntry(button.dataset.moneyEdit);return;}
    if(button.hasAttribute('data-money-close')){dialog.close();return;}
    if(button.hasAttribute('data-money-filter')){filter=button.dataset.moneyFilter;ctx.rerender();return;}
    if(button.hasAttribute('data-money-month')){const date=dateObject(ctx.getSelected());date.setDate(1);date.setMonth(date.getMonth()+Number(button.dataset.moneyMonth));ctx.setSelected(isoDate(date));return;}
    if(button.hasAttribute('data-money-delete')){
      const id=editingId;
      ctx.confirm('要刪除這筆收支嗎？','刪除後無法復原，月結餘也會重新計算。',()=>{const data=ctx.getData();data.ledger=(data.ledger||[]).filter(entry=>entry.id!==id);const saved=ctx.save();dialog.close();ctx.rerender();if(saved)ctx.toast('這筆收支已刪除');});
    }
  });
  document.querySelector('#money-entry-type').addEventListener('change',event=>fillCategories(event.target.value));
  document.querySelector('#money-entry-title').addEventListener('input',event=>event.target.setCustomValidity(''));
  document.querySelector('#money-entry-amount').addEventListener('input',event=>event.target.setCustomValidity(''));
  document.querySelector('#money-entry-form').addEventListener('submit',event=>{
    event.preventDefault();
    const titleInput=document.querySelector('#money-entry-title');
    const title=titleInput.value.trim();
    if(!title){titleInput.setCustomValidity('幫這筆收支寫個名字吧');titleInput.reportValidity();return;}
    const amountInput=document.querySelector('#money-entry-amount');
    const rawAmount=amountInput.value;
    const amount=Number(rawAmount);
    if(!/^\d+(?:\.\d{1,2})?$/.test(rawAmount)||!Number.isFinite(amount)||amount<=0||amount>999999999.99){amountInput.setCustomValidity('請輸入大於 0、最多兩位小數的金額');amountInput.reportValidity();return;}
    const date=document.querySelector('#money-entry-date').value;
    if(!dateIsValid(date)){ctx.toast('請選擇有效的記帳日期');return;}
    const type=document.querySelector('#money-entry-type').value;
    const category=document.querySelector('#money-category').value;
    const data=ctx.getData();
    data.ledger??=[];
    const entry={id:editingId||crypto.randomUUID(),date,type,amount:Math.round(amount*100)/100,title,category};
    const index=data.ledger.findIndex(row=>row.id===editingId);
    if(index>=0)data.ledger[index]=entry;else data.ledger.push(entry);
    const saved=ctx.save();
    dialog.close();
    filter='all';
    ctx.setSelected(date);
    if(saved)ctx.toast('這一筆，好好記下了 ♡');
  });
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
}
