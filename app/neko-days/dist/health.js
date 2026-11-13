const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const mealTypes = [
  {id:'breakfast',label:'早餐',icon:'🍞',color:'cream'},
  {id:'lunch',label:'午餐',icon:'🍱',color:'green'},
  {id:'dinner',label:'晚餐',icon:'🍲',color:'peach'},
  {id:'snack',label:'點心',icon:'🍓',color:'pink'}
];
const number = value => Number(value).toLocaleString('zh-TW',{maximumFractionDigits:1});
const useIcon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const dayRecord = (date,data) => data.health?.[date] || {water:0,goal:2000,meals:[]};
const dropIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12Z"/><path d="M8 15c0 2 1 3 3 3"/></svg>';
function validDate(date){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
  const d=new Date(`${date}T12:00:00`);
  return !Number.isNaN(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`===date;
}
function glassSVG(percent){
  const fillTop=87-Math.min(percent,100)*.58;
  return `<svg class="health-glass" viewBox="0 0 112 112" aria-hidden="true"><defs><clipPath id="health-glass-clip"><path d="M29 24h55l-6 64c-1 8-42 8-43 0Z"/></clipPath></defs><ellipse cx="57" cy="101" rx="35" ry="4" fill="#a9c5bd" opacity=".18" stroke="none"/><path d="M29 24h55l-6 64c-1 8-42 8-43 0Z" fill="#fffdf5" stroke="#91b1a9" stroke-width="2"/><path d="M26 ${fillTop}q15-4 30 0t30 0v70H26Z" fill="#b9d7cd" stroke="none" opacity="${percent>0?1:0}" clip-path="url(#health-glass-clip)"/><path d="M29 24q28 7 55 0M40 33l3 14" stroke="#91b1a9" stroke-width="2" fill="none"/><path d="m46 56 1-7 6 4m13 3-1-7-6 4" fill="#efbd81" stroke="#81998c" stroke-width="1.5"/><ellipse cx="56" cy="61" rx="13" ry="10" fill="#efbd81" stroke="#81998c" stroke-width="1.5"/><path d="M51 60h.1m9 0h.1m-7 4q3 3 6 0" stroke="#81998c" stroke-width="1.5" fill="none"/><path d="M20 14v7m-3-3h6m68 23v7m-3-3h6" stroke="#d4bd87" stroke-width="1.5"/></svg>`;
}

export function renderHealth(date,data){
  const record=dayRecord(date,data);
  const total=record.meals.reduce((sum,meal)=>sum+meal.calories,0);
  const percent=record.goal>0?Math.round(record.water/record.goal*100):0;
  const dateLabel=`${Number(date.slice(5,7))} 月 ${Number(date.slice(8,10))} 日`;
  return `<section class="health-page">
    <div class="health-date-row"><div><span class="tiny-label">TAKE GOOD CARE OF YOU</span><h3>把自己，也照顧得好好的</h3></div><label class="health-date-picker"><span>記錄日期</span><input type="date" id="health-selected-date" value="${esc(date)}" aria-label="健康紀錄日期"/></label></div>
    <div class="health-water-card"><div class="health-section-heading"><h3>${dropIcon}喝水小任務</h3><span>${dateLabel}</span></div>
      <div class="health-water-summary">${glassSVG(percent)}<div class="health-water-copy"><span class="health-water-label">已喝水量</span><div class="health-big-number">${number(record.water)}<small>ml</small></div><button class="health-goal-button" data-health-water="goal" aria-label="調整每日喝水目標">個人目標 ${number(record.goal)} ml ${useIcon('pencil')}</button></div><span class="health-water-percent">${percent>=100?'✓':`${percent}%`}<small>${percent>=100?'目標達成':'慢慢累積'}</small></span></div>
      <div class="health-water-progress" role="progressbar" aria-label="每日喝水目標進度" aria-valuemin="0" aria-valuemax="${record.goal}" aria-valuenow="${Math.min(record.water,record.goal)}" aria-valuetext="已喝 ${record.water} ml，個人目標 ${record.goal} ml"><span style="width:${Math.min(100,percent)}%"></span></div>
      <div class="health-water-actions"><button data-health-add-water="250">${dropIcon}+250 ml</button><button data-health-add-water="350">${dropIcon}+350 ml</button><button data-health-add-water="500">${dropIcon}+500 ml</button><button data-health-water="add" class="health-custom-water">自訂</button></div>
      <div class="health-water-bottom"><span>${percent>=100?'今天的小目標完成了，給自己一個貓掌！':'每一小口，都是照顧自己的心意。'}</span><button data-health-water="adjust">修正總量</button></div>
    </div>
    <div class="health-food-header"><div><h3>好好吃飯日記</h3><p>記下吃了什麼，收藏每一餐的滿足。</p></div><div class="health-calorie-total"><strong>${number(total)}</strong><span>kcal · 已記錄</span></div></div>
    <div class="health-meal-summary">${mealTypes.map(type=>{const meals=record.meals.filter(meal=>meal.type===type.id);return `<button class="health-meal-stat health-meal-${type.color}" data-health-new-meal="${type.id}" aria-label="新增${type.label}"><span class="health-food-icon">${type.icon}</span><span>${type.label}</span><strong>${number(meals.reduce((sum,meal)=>sum+meal.calories,0))}<small>kcal</small></strong></button>`;}).join('')}</div>
    <div class="health-meal-list">${record.meals.length?mealTypes.map(type=>record.meals.filter(meal=>meal.type===type.id).map(meal=>`<div class="health-meal-row"><span class="health-meal-row-icon health-meal-${type.color}">${type.icon}</span><button class="health-meal-edit" data-health-edit-meal="${esc(meal.id)}" aria-label="編輯${esc(meal.name)}"><strong>${esc(meal.name)}</strong><small>${type.label} <span>· 點選可編輯</span></small></button><span class="health-meal-calories">${number(meal.calories)}<small>kcal</small></span><button class="health-meal-delete" data-health-delete-meal="${esc(meal.id)}" aria-label="刪除${esc(meal.name)}">${useIcon('close')}</button></div>`).join('')).join(''):'<div class="health-meal-empty"><span>🍽️</span><p>今天吃了什麼好吃的？<br><small>新增第一餐，開始你的飲食小日記。</small></p></div>'}</div>
    <button id="health-add-meal" class="health-add-meal" data-health-new-meal="lunch">${useIcon('plus')}記下一餐</button>
    <p class="health-footnote">卡路里由你手動填寫，可以參考食物包裝或餐點標示。</p>
  </section>`;
}

export function installHealth(context){
  let editingMealId=null;
  let editingMealDate=null;
  let waterMode='add';
  let waterDate=null;
  const dialog=document.createElement('dialog');
  dialog.id='health-meal-dialog';dialog.className='app-dialog';
  dialog.setAttribute('aria-labelledby','health-meal-dialog-title');
  dialog.innerHTML=`<form id="health-meal-form"><div class="dialog-heading"><div><span class="tiny-label">A LITTLE FOOD DIARY</span><h2 id="health-meal-dialog-title">記下一餐的美好</h2></div><button type="button" class="icon-button" data-health-close="health-meal-dialog" aria-label="關閉餐食表單">${useIcon('close')}</button></div><div class="form-fields"><label for="health-meal-name">餐食名稱</label><input class="health-form-input" id="health-meal-name" required maxlength="100" placeholder="例如：鮪魚蛋吐司＋豆漿"/><div class="form-row"><label for="health-meal-date">日期<input type="date" id="health-meal-date" required/></label><label for="health-meal-type">餐別<select id="health-meal-type">${mealTypes.map(type=>`<option value="${type.id}">${type.label}</option>`).join('')}</select></label></div><label for="health-meal-calories">卡路里（kcal）<input id="health-meal-calories" type="number" inputmode="decimal" min="0" max="100000" step="0.1" required placeholder="填寫包裝或餐點標示的熱量"/></label></div><div class="dialog-actions"><button type="button" class="text-button" data-health-close="health-meal-dialog">取消</button><button type="submit" class="primary-button">收藏這一餐 ${useIcon('check')}</button></div></form>`;
  document.body.append(dialog);
  const waterDialog=document.createElement('dialog');
  waterDialog.id='health-water-dialog';waterDialog.className='app-dialog health-water-dialog';
  waterDialog.setAttribute('aria-labelledby','health-water-dialog-title');
  waterDialog.innerHTML=`<form id="health-water-form"><div class="dialog-heading"><h2 id="health-water-dialog-title">自訂喝水量</h2><button type="button" class="icon-button" data-health-close="health-water-dialog" aria-label="關閉喝水表單">${useIcon('close')}</button></div><div class="form-fields"><label for="health-water-amount"><span id="health-water-input-label">這次喝了多少？（ml）</span><input type="number" id="health-water-amount" inputmode="numeric" required min="1" max="100000" step="1"/></label></div><p id="health-water-help" class="health-dialog-help"></p><div class="dialog-actions"><button type="button" class="text-button" data-health-close="health-water-dialog">取消</button><button type="submit" class="primary-button">儲存 ${useIcon('check')}</button></div></form>`;
  document.body.append(waterDialog);
  const field=id=>document.getElementById(id);
  function mutableRecord(date){
    const data=context.getData();data.health??={};
    return data.health[date]??=( {water:0,goal:2000,meals:[]} );
  }
  function complete(message){const saved=context.save();context.rerender();if(saved)context.toast(message);}
  function openMealDialog(id=null,type='lunch'){
    editingMealDate=context.getSelected();editingMealId=id;
    const meal=dayRecord(editingMealDate,context.getData()).meals.find(entry=>entry.id===id);
    if(id&&!meal)return;
    field('health-meal-dialog-title').textContent=meal?'編輯這一餐':'記下一餐的美好';
    field('health-meal-name').setCustomValidity('');field('health-meal-name').value=meal?.name||'';
    field('health-meal-date').value=editingMealDate;field('health-meal-type').value=meal?.type||type;
    field('health-meal-calories').value=meal?String(meal.calories):'';
    dialog.showModal();field('health-meal-name').focus();
  }
  function openWaterDialog(mode){
    waterDate=context.getSelected();waterMode=mode;
    const record=dayRecord(waterDate,context.getData());
    const labels={add:['自訂喝水量','這次喝了多少？（ml）','輸入這次喝水的份量，會加到當天總量。'],adjust:['修正當天喝水量','目前實際總量（ml）','填入這一天正確的累積總量，也可以設為 0。'],goal:['我的喝水小目標','當天個人目標（ml）','依自己的需要調整；目標只套用到選取的這一天。']};
    field('health-water-dialog-title').textContent=labels[mode][0];field('health-water-input-label').textContent=labels[mode][1];field('health-water-help').textContent=labels[mode][2];
    field('health-water-amount').min=mode==='adjust'?'0':'1';field('health-water-amount').value=mode==='add'?'250':String(mode==='goal'?record.goal:record.water);
    waterDialog.showModal();field('health-water-amount').focus();
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.healthClose){document.getElementById(button.dataset.healthClose)?.close();return;}
    if(button.dataset.healthAddWater){const amount=Number(button.dataset.healthAddWater),date=context.getSelected();const record=mutableRecord(date);if(record.water+amount>100000){context.toast('當日總量超出可記錄範圍，請先檢查數值');return;}record.water+=amount;complete(`已記下 ${number(amount)} ml，小口喝也很棒！`);return;}
    if(button.dataset.healthWater){openWaterDialog(button.dataset.healthWater);return;}
    if(button.dataset.healthNewMeal){openMealDialog(null,button.dataset.healthNewMeal);return;}
    if(button.dataset.healthEditMeal){openMealDialog(button.dataset.healthEditMeal);return;}
    if(button.dataset.healthDeleteMeal){
      const date=context.getSelected(),id=button.dataset.healthDeleteMeal;
      const meal=dayRecord(date,context.getData()).meals.find(entry=>entry.id===id);if(!meal)return;
      context.confirm('刪除這一餐的紀錄？',`「${meal.name}」將從 ${date} 的飲食紀錄移除，卡路里總計也會更新。`,()=>{const record=mutableRecord(date);record.meals=record.meals.filter(entry=>entry.id!==id);complete('已刪除這一餐的紀錄');});
    }
  });
  document.addEventListener('change',event=>{if(event.target.id!=='health-selected-date')return;const date=event.target.value;if(validDate(date))context.setSelected(date);else context.toast('請選擇有效的日期');});
  field('health-meal-name').addEventListener('input',()=>field('health-meal-name').setCustomValidity(''));
  field('health-meal-form').addEventListener('submit',event=>{
    event.preventDefault();
    const name=field('health-meal-name').value.trim(),date=field('health-meal-date').value,type=field('health-meal-type').value,calories=Number(field('health-meal-calories').value);
    if(!name){field('health-meal-name').setCustomValidity('寫下餐食名稱吧');field('health-meal-name').reportValidity();return;}
    if(!validDate(date)||!mealTypes.some(item=>item.id===type)||!Number.isFinite(calories)||calories<0||calories>100000){context.toast('請檢查餐食日期與卡路里數值');return;}
    const roundedCalories=Math.round(calories*10)/10;
    if(editingMealId){const original=mutableRecord(editingMealDate);original.meals=original.meals.filter(item=>item.id!==editingMealId);}
    const record=mutableRecord(date);record.meals.push({id:editingMealId||crypto.randomUUID(),name,calories:roundedCalories,type});
    const saved=context.save();dialog.close();context.setSelected(date);context.rerender();if(saved)context.toast('這一餐已好好收藏 ♡');
  });
  field('health-water-form').addEventListener('submit',event=>{
    event.preventDefault();
    const amount=Number(field('health-water-amount').value),min=waterMode==='adjust'?0:1;
    if(!Number.isInteger(amount)||amount<min||amount>100000){context.toast('請輸入有效的整數水量');return;}
    const record=mutableRecord(waterDate);
    if(waterMode==='goal')record.goal=amount;
    else if(waterMode==='adjust')record.water=amount;
    else {if(record.water+amount>100000){context.toast('當日總量超出可記錄範圍，請先檢查數值');return;}record.water+=amount;}
    waterDialog.close();complete(waterMode==='goal'?'個人喝水目標已更新':waterMode==='adjust'?'當天喝水總量已修正':'喝水紀錄已收藏 ♡');
  });
  for(const target of [dialog,waterDialog])target.addEventListener('click',event=>{if(event.target!==target)return;const rect=target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)target.close();});
  return {openMeal:()=>openMealDialog()};
}
