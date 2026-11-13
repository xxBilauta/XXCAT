const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => Number(value).toLocaleString('zh-TW',{maximumFractionDigits:1});
const money = cents => (cents/100).toLocaleString('zh-TW',{minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2});
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const mealNames={breakfast:'早餐',lunch:'午餐',dinner:'晚餐',snack:'點心'};
const expenseNames=['餐飲','交通','購物','生活','娛樂','其他'];
const todayTaipei=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const monthShift=(month,delta)=>{const d=new Date(`${month}-01T12:00:00`);d.setMonth(d.getMonth()+delta);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};
let reportContext;

export function buildReportStats(date,data,today=todayTaipei()){
  const month=date.slice(0,7);
  const [year,monthNumber]=month.split('-').map(Number);
  const daysInMonth=new Date(year,monthNumber,0).getDate();
  const previousMonth=monthShift(month,-1);
  const entries=(data.ledger||[]).filter(e=>e.date.slice(0,7)===month);
  const previousEntries=(data.ledger||[]).filter(e=>e.date.slice(0,7)===previousMonth);
  const sumType=(list,type)=>list.filter(e=>e.type===type).reduce((n,e)=>n+Math.round(e.amount*100),0);
  const daily=Array.from({length:daysInMonth},(_,index)=>{
    const day=`${month}-${String(index+1).padStart(2,'0')}`;
    const health=data.health?.[day];
    const meals=health?.meals||[];
    const ledger=entries.filter(e=>e.date===day);
    const income=sumType(ledger,'income'),expense=sumType(ledger,'expense');
    const learning=data.learning?.days?.[day];
    const reviewed=[...new Set(Array.isArray(learning?.reviewed)?learning.reviewed:[])];
    const answered=learning?.answered||0,correct=learning?.correct||0;
    return {date:day,day:index+1,water:health?.water>0?health.water:null,goal:health?.water>0?health.goal:null,calories:meals.length?meals.reduce((n,m)=>n+Math.round(m.calories*10),0)/10:null,meals,mealCount:meals.length,income,expense,net:income-expense,ledgerCount:ledger.length,journal:!!data.journals?.[day]?.trim(),mood:!!data.moods?.[day],reviewed,reviewCount:reviewed.length,answered,correct,quizAccuracy:answered?correct/answered*100:null,studied:reviewed.length>0||answered>0};
  });
  const waterDays=daily.filter(d=>d.water!==null);
  const foodDays=daily.filter(d=>d.mealCount>0);
  const goalDays=waterDays.filter(d=>d.water>=d.goal).length;
  const income=sumType(entries,'income'),expense=sumType(entries,'expense');
  const totalCaloriesTenths=foodDays.reduce((n,d)=>n+Math.round(d.calories*10),0);
  const daysElapsed=month<today.slice(0,7)?daysInMonth:month===today.slice(0,7)?Math.min(daysInMonth,Math.max(0,Number(today.slice(8,10)))):0;
  const learningDays=daily.filter(d=>d.studied).length;
  const learningUniqueItems=new Set(daily.flatMap(d=>d.reviewed)).size;
  const learningReviewCount=daily.reduce((total,d)=>total+d.reviewCount,0);
  const quizAnswered=daily.reduce((total,d)=>total+d.answered,0),quizCorrect=daily.reduce((total,d)=>total+d.correct,0);
  const learningStats={learningDays,learningUniqueItems,learningReviewCount,quizAnswered,quizCorrect,quizAccuracy:quizAnswered?quizCorrect/quizAnswered*100:null};
  return {...learningStats,month,year,monthNumber,daysInMonth,daysElapsed,today,previousMonth,daily,entries,previousEntries,income,expense,net:income-expense,previousIncome:sumType(previousEntries,'income'),previousExpense:sumType(previousEntries,'expense'),waterDays:waterDays.length,waterTotal:waterDays.reduce((n,d)=>n+d.water,0),waterAverage:waterDays.length?waterDays.reduce((n,d)=>n+d.water,0)/waterDays.length:null,goalDays,goalRate:waterDays.length?goalDays/waterDays.length*100:null,foodDays:foodDays.length,mealCount:foodDays.reduce((n,d)=>n+d.mealCount,0),calorieTotal:totalCaloriesTenths/10,calorieAverage:foodDays.length?totalCaloriesTenths/10/foodDays.length:null,financeDays:daily.filter(d=>d.ledgerCount>0).length,journalDays:daily.filter(d=>d.journal).length,moodDays:daily.filter(d=>d.mood).length,recordedDays:daily.filter(d=>d.water!==null||d.mealCount||d.ledgerCount||d.journal||d.mood||d.studied).length,mealCategories:Object.entries(mealNames).map(([id,label])=>{const meals=foodDays.flatMap(d=>d.meals).filter(m=>m.type===id);return {id,label,count:meals.length,calories:meals.reduce((n,m)=>n+Math.round(m.calories*10),0)/10};}),expenseCategories:expenseNames.map((label,index)=>({label,index,cents:entries.filter(e=>e.type==='expense'&&e.category===label).reduce((n,e)=>n+Math.round(e.amount*100),0)})).filter(e=>e.cents>0).sort((a,b)=>b.cents-a.cents)};
}

function comparison(stats,type){
  if(!stats.previousEntries.length)return '上月尚無紀錄';
  const value=type==='income'?stats.income:stats.expense;
  const previous=type==='income'?stats.previousIncome:stats.previousExpense;
  const diff=value-previous;
  if(!diff)return '與上月已記錄總額相同';
  return `較上月${diff>0?'增加':'減少'} NT$ ${money(Math.abs(diff))}${previous?`（${fmt(Math.abs(diff)/previous*100)}%）`:''}`;
}
function healthMetric(value,unit){return value===null?'<strong class="report-no-value">—</strong>':`<strong>${fmt(value)}<small>${unit}</small></strong>`;}
function learningSummary(s,print=false){
  return `<section class="${print?'report-print-learning':'report-learning'}" aria-label="每月學習小結"><div class="report-section-title"><h4>每天一點點，累積學習的小進步</h4><span>LEARNING DIARY</span></div><div class="report-learning-grid"><article class="report-learning-card"><span>有學習紀錄日</span><strong>${s.learningDays}<small>天</small></strong><p>複習項目或完成測驗的日子</p></article><article class="report-learning-card"><span>複習過的不同學習項目</span><strong>${s.learningUniqueItems}<small>個</small></strong><p>每日去重合計 ${s.learningReviewCount} 項次</p></article><article class="report-learning-card"><span>測驗答對率</span>${s.quizAccuracy===null?'<strong class="report-learning-empty">尚無測驗</strong>':`<strong>${fmt(s.quizAccuracy)}<small>%</small></strong>`}<p>答對 ${s.quizCorrect} / 作答 ${s.quizAnswered} 題</p></article></div><p class="report-learning-method">同一學習項目每天只計一次複習；跨日再次複習會累加項次，「不同學習項目」則整月去重。答對率依整月答對與作答題數計算。</p></section>`;
}
function dailyTable(s,print=false){return `<table class="report-daily-table"><caption>${s.month} 每日健康、收支與學習明細</caption><thead><tr><th scope="col">日期</th><th scope="col">喝水<br><small>ml</small></th><th scope="col">餐食<br><small>kcal</small></th><th scope="col">收入<br><small>NT$</small></th><th scope="col">支出<br><small>NT$</small></th><th scope="col">淨額<br><small>NT$</small></th><th scope="col">複習<br><small>項目數</small></th><th scope="col">測驗<br><small>答對／作答</small></th></tr></thead><tbody>${s.daily.map(d=>`<tr${d.date===s.today?' class="report-table-today"':''}><th scope="row">${print?d.date:`${s.monthNumber}/${d.day}`}</th><td>${d.water===null?'—':fmt(d.water)}</td><td>${d.calories===null?'—':fmt(d.calories)}</td><td>${d.ledgerCount?money(d.income):'—'}</td><td>${d.ledgerCount?money(d.expense):'—'}</td><td>${d.ledgerCount?money(d.net):'—'}</td><td>${d.reviewCount||'—'}</td><td>${d.answered?`${d.correct}/${d.answered}`:'—'}</td></tr>`).join('')}</tbody></table>`;}

export function renderReport(date,data){
  const s=buildReportStats(date,data);
  const maxSpend=Math.max(1,...s.daily.map(d=>d.expense));
  return `<section class="report-page"><div class="report-toolbar"><div><span class="tiny-label">A MONTH OF LITTLE MOMENTS</span><h3>回頭看看，你走過的小日子。</h3></div><div class="report-month-picker"><button class="icon-button previous" data-report-month="-1" aria-label="回顧上一個月">${icon('chevron')}</button><input id="report-selected-month" type="month" value="${s.month}" min="1000-01" max="9999-12" aria-label="報告月份"/><button class="icon-button" data-report-month="1" aria-label="回顧下一個月">${icon('chevron')}</button></div></div>
    <div class="report-intro"><div><span>${s.year} 年 ${s.monthNumber} 月 · 生活小結</span><h4>收藏了 <strong>${s.recordedDays}</strong> 天的日常 <small>/ ${s.daysInMonth} 天</small></h4><p>${s.daysElapsed===0?'這個月份尚未開始，可查看已預先記錄的內容。':s.daysElapsed===s.daysInMonth?'這個月已結束，以下依目前已保存的紀錄整理。':`本月已過 ${s.daysElapsed} 天；報表包含此月份所有已保存的紀錄。`}</p></div><img src="./assets/cat-face.svg" alt="陪你回顧日常的小貓"/></div>
    <div class="report-section-title"><h4>好好照顧自己的紀錄</h4><span>HEALTH DIARY</span></div><div class="report-health-grid"><article class="report-health-card report-water"><span class="report-card-label">💧 有紀錄日平均喝水量</span>${healthMetric(s.waterAverage,'ml')}<p>有喝水紀錄 ${s.waterDays} / ${s.daysInMonth} 天</p><div class="report-small-line"><span>個人喝水目標達成</span><b>${s.goalRate===null?'—':`${fmt(s.goalRate)}%`}</b></div><div class="report-progress" aria-hidden="true"><span style="width:${s.goalRate||0}%"></span></div><small>${s.goalDays} / ${s.waterDays} 個喝水紀錄日達標</small></article><article class="report-health-card report-food"><span class="report-card-label">🍙 有紀錄日平均餐食熱量</span>${healthMetric(s.calorieAverage,'kcal')}<p>有餐食紀錄 ${s.foodDays} / ${s.daysInMonth} 天</p><div class="report-small-line"><span>已記錄餐食</span><b>${s.mealCount} 份</b></div><div class="report-meal-types">${s.mealCategories.map(m=>`<span>${m.label}<b>${m.count}</b></span>`).join('')}</div></article></div>
    <p class="report-method">平均僅計算有紀錄日。喝水量大於 0 才列入喝水紀錄日；有任何餐食才列入餐食紀錄日。未記錄的日子不視為攝取量 0，餐食熱量也不代表完整的一日攝取量。</p>
    <div class="report-section-title"><h4>這個月的收支小帳</h4><span>MONEY JOURNAL</span></div><div class="report-finance-grid"><article class="report-finance-card"><span>本月收入</span><strong><small>NT$</small> ${money(s.income)}</strong><p>${comparison(s,'income')}</p></article><article class="report-finance-card report-finance-expense"><span>本月支出</span><strong><small>NT$</small> ${money(s.expense)}</strong><p>${comparison(s,'expense')}</p></article><article class="report-finance-card report-finance-net"><span>本月結餘</span><strong><small>NT$</small> ${money(s.net)}</strong><p>${s.entries.length} 筆收支 · ${s.financeDays} 天有紀錄</p></article></div>
    <div class="report-chart-card"><div class="report-chart-heading"><h4>每日支出的小足跡</h4><span>最高 NT$ ${money(Math.max(0,...s.daily.map(d=>d.expense)))}</span></div><div class="report-chart" role="img" aria-label="${s.month} 每日已記錄支出長條圖，完整數字可查看下方每日明細。"><div class="report-bars">${s.daily.map(d=>`<div class="report-bar-column" title="${d.date}：${d.ledgerCount?`支出 NT$ ${money(d.expense)}`:'無收支紀錄'}"><span class="report-bar ${d.ledgerCount?'recorded':'unrecorded'}" style="height:${d.expense?Math.max(3,d.expense/maxSpend*100):2}%"></span></div>`).join('')}</div><div class="report-chart-axis"><span>1 日</span><span>${Math.ceil(s.daysInMonth/2)} 日</span><span>${s.daysInMonth} 日</span></div></div><p>${s.entries.length?'長條顯示已記錄支出，灰色底點代表無收支紀錄日。':'本月尚無收支紀錄。開始記帳後，就會看見每天的小足跡。'}</p></div>
    ${s.expenseCategories.length?`<div class="report-category-card"><h4>支出分類</h4>${s.expenseCategories.map(c=>`<div class="report-category-row"><span>${c.label}</span><div class="report-category-track"><span class="report-category-color-${c.index}" style="width:${c.cents/s.expense*100}%"></span></div><strong>NT$ ${money(c.cents)}</strong><small>${fmt(c.cents/s.expense*100)}%</small></div>`).join('')}</div>`:''}
    ${learningSummary(s)}
    <div class="report-memory-strip"><span>${icon('book')}寫下 <b>${s.journalDays}</b> 篇手帳</span><span>${icon('heart')}收藏 <b>${s.moodDays}</b> 天心情</span></div>
    <details class="report-details"><summary>每日明細與紀錄完整度 <span>${s.daysInMonth} 天 ›</span></summary><div class="report-table-scroll">${dailyTable(s)}</div><p>「—」表示該日沒有相關紀錄。收入、支出與淨額僅反映已記錄帳目。</p></details>
    <div class="report-export-row"><div><strong>把這個月，好好收藏</strong><p>匯出表格自行整理，或列印成你的月度手帳。</p></div><div><button id="report-export-csv" class="secondary-button" data-report-export>${icon('download')}匯出 CSV</button><button class="secondary-button" data-report-print>${icon('book')}列印報告</button></div></div></section>`;
}

function csvCell(value){
  if(typeof value==='number')return String(value);
  let text=String(value??'');
  if(/^[\s]*[=+@-]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
export function buildReportCsv(date,data){
  const s=buildReportStats(date,data);
  const rows=[['喵日子｜每月健康、收支與學習回顧'],['報告月份',s.month],['統計說明','平均僅計算有紀錄日；喝水大於0才算有喝水紀錄；有餐食才算有餐食紀錄；未記錄不等於攝取量0。'],[],['項目','數值','單位'],['月份天數',s.daysInMonth,'天'],['有喝水紀錄日',s.waterDays,'天'],['有紀錄日平均喝水量',s.waterAverage===null?'':Math.round(s.waterAverage*10)/10,'ml'],['喝水總紀錄量',s.waterTotal,'ml'],['個人喝水目標達成日',s.goalDays,'天'],['有喝水紀錄日目標達成率',s.goalRate===null?'':Math.round(s.goalRate*10)/10,'%'],['有餐食紀錄日',s.foodDays,'天'],['餐食份數',s.mealCount,'份'],['有紀錄日平均餐食熱量',s.calorieAverage===null?'':Math.round(s.calorieAverage*10)/10,'kcal'],['本月收入',s.income/100,'TWD'],['本月支出',s.expense/100,'TWD'],['本月結餘',s.net/100,'TWD'],['有收支紀錄日',s.financeDays,'天'],['手帳篇數',s.journalDays,'篇'],['心情紀錄日',s.moodDays,'天'],['有學習紀錄日',s.learningDays,'天'],['複習過的不同學習項目',s.learningUniqueItems,'個'],['學習項目複習項次(每日去重)',s.learningReviewCount,'項次'],['測驗作答題數',s.quizAnswered,'題'],['測驗答對題數',s.quizCorrect,'題'],['測驗答對率',s.quizAccuracy===null?'尚無測驗':Math.round(s.quizAccuracy*10)/10,'%'],['學習統計說明','有複習項目或作答才算學習日；同一學習項目每天只計一次複習，跨日再次複習會累加項次；不同項目數整月去重；答對率為整月答對題數除以作答題數。'],[],['每日總覽'],['日期','喝水(ml)','當天個人目標(ml)','餐食熱量(kcal)','餐食份數','收入(TWD)','支出(TWD)','淨額(TWD)','收支筆數','有手帳','有心情','複習項目數(當日去重)','測驗作答題數','測驗答對題數','測驗答對率(%)']];
  for(const d of s.daily)rows.push([d.date,d.water??'',d.goal??'',d.calories??'',d.mealCount,d.ledgerCount?d.income/100:'',d.ledgerCount?d.expense/100:'',d.ledgerCount?d.net/100:'',d.ledgerCount,d.journal?'是':'',d.mood?'是':'',d.reviewCount,d.answered,d.correct,d.quizAccuracy===null?'':Math.round(d.quizAccuracy*10)/10]);
  rows.push([],['收支明細'],['日期','類型','分類','名稱','金額(TWD)']);
  for(const e of [...s.entries].sort((a,b)=>a.date.localeCompare(b.date)))rows.push([e.date,e.type==='income'?'收入':'支出',e.category,e.title,e.amount]);
  rows.push([],['餐食明細'],['日期','餐別','餐食名稱','熱量(kcal)']);
  for(const d of s.daily)for(const meal of d.meals)rows.push([d.date,mealNames[meal.type],meal.name,meal.calories]);
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}

function printReport(date,data){
  const s=buildReportStats(date,data);
  document.getElementById('report-print-document')?.remove();
  const article=document.createElement('article');article.id='report-print-document';
  article.innerHTML=`<header class="report-print-header"><div><p>NEKO DAYS · MONTHLY JOURNAL</p><h1>喵日子｜${s.year} 年 ${s.monthNumber} 月回顧</h1><span>健康、收支與學習回顧 · ${s.daysInMonth} 天</span></div><img src="./assets/cat-face.svg" alt=""/></header><div class="report-print-grid"><section><h2>健康紀錄</h2><dl><div><dt>有喝水紀錄日</dt><dd>${s.waterDays} 天</dd></div><div><dt>有紀錄日平均喝水量</dt><dd>${s.waterAverage===null?'無紀錄':`${fmt(s.waterAverage)} ml`}</dd></div><div><dt>個人喝水目標達成</dt><dd>${s.goalDays}/${s.waterDays} 天${s.goalRate===null?'':`（${fmt(s.goalRate)}%）`}</dd></div><div><dt>有餐食紀錄日／餐食份數</dt><dd>${s.foodDays} 天／${s.mealCount} 份</dd></div><div><dt>有紀錄日平均餐食熱量</dt><dd>${s.calorieAverage===null?'無紀錄':`${fmt(s.calorieAverage)} kcal`}</dd></div></dl><p>${s.mealCategories.map(c=>`${c.label} ${c.count} 份`).join(' · ')}</p></section><section><h2>收支紀錄（TWD）</h2><dl><div><dt>收入</dt><dd>NT$ ${money(s.income)}</dd></div><div><dt>支出</dt><dd>NT$ ${money(s.expense)}</dd></div><div><dt>結餘</dt><dd>NT$ ${money(s.net)}</dd></div><div><dt>收支紀錄</dt><dd>${s.entries.length} 筆／${s.financeDays} 天</dd></div></dl><p>支出：${comparison(s,'expense')}</p><p>${s.expenseCategories.map(c=>`${c.label} NT$ ${money(c.cents)}`).join(' · ')||'本月無支出紀錄'}</p></section></div>${learningSummary(s,true)}<p class="report-print-method">平均僅計算有紀錄日。喝水大於 0 才算有喝水紀錄；有任何餐食才算有餐食紀錄。未記錄不視為攝取量 0，餐食熱量不代表完整一日攝取量。收支只反映已保存帳目，結餘為收入減支出。</p><h2 class="report-print-table-title">每日明細</h2>${dailyTable(s,true)}<footer>「—」表示無相關紀錄。手帳 ${s.journalDays} 篇 · 心情 ${s.moodDays} 天 · 匯出日期 ${todayTaipei()}</footer>`;
  document.body.append(article);
  document.body.classList.add('report-is-printing');
  const cleanup=()=>{article.remove();document.body.classList.remove('report-is-printing');};
  window.addEventListener('afterprint',cleanup,{once:true});
  try{window.print();}catch{cleanup();reportContext.toast('此瀏覽器無法列印，請使用 CSV 匯出');}
}

export function installReport(context){
  if(reportContext)return;reportContext=context;
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-report-month')){const month=monthShift(context.getSelected().slice(0,7),Number(button.dataset.reportMonth));if(!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)){context.toast('請選擇 1000 到 9999 年之間的月份');return;}context.setSelected(month+'-01');}
    if(button.hasAttribute('data-report-export')){const date=context.getSelected();const csv=buildReportCsv(date,context.getData());const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`喵日子月回顧-${date.slice(0,7)}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);context.toast('月回顧 CSV 已匯出');}
    if(button.hasAttribute('data-report-print'))printReport(context.getSelected(),context.getData());
  });
  document.addEventListener('change',event=>{if(event.target.id!=='report-selected-month')return;const month=event.target.value;if(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month))context.setSelected(month+'-01');else{context.toast('請選擇有效月份');context.rerender();}});
}
