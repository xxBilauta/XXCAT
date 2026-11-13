import {alphabetGroups,words,sources} from './korean-content.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const letters=alphabetGroups.flatMap(group=>group.items);
const letterIds=new Set(letters.map(letter=>letter.id));
const builtinWordIds=new Set(words.map(word=>word.id));
const knownIds=new Set([...letterIds,...builtinWordIds]);
const emptyLearning=()=>({known:[],favorites:[],customWords:[],days:{}});
const taipeiToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const isoDate=date=>`${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const dateObject=date=>new Date(`${date}T12:00:00`);
const validDate=date=>typeof date==='string'&&/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(dateObject(date).getTime())&&isoDate(dateObject(date))===date;
const customId=id=>typeof id==='string'&&/^custom-[a-zA-Z0-9_-]{1,100}$/.test(id);
const allWords=data=>[...words,...(data.learning?.customWords||[])];
const learningData=data=>data.learning||emptyLearning();
let context;
let selectedTab='alphabet';
let selectedGroup=alphabetGroups[0]?.id;
let selectedLetter=letters[0]?.id;
let wordCategory='all';
let wordFilter='all';
let cardIndex=0;
let flipped=false;
let editingWordId=null;
let quiz=null;

function plainObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&!Object.keys(value).some(key=>['__proto__','prototype','constructor'].includes(key));}
function boundedText(value,max,required=false){return typeof value==='string'&&value.length<=max&&(!required||!!value.trim());}

export function validateLearning(value){
  if(value===undefined)return emptyLearning();
  if(!plainObject(value))throw new Error('韓語學習備份格式不正確');
  const custom=value.customWords??[];
  if(!Array.isArray(custom)||custom.length>500)throw new Error('自訂單字最多可收藏 500 個');
  const customIds=new Set();
  const normalizedWords=custom.map(word=>{
    if(!plainObject(word)||!customId(word.id)||customIds.has(word.id)||knownIds.has(word.id)||!boundedText(word.ko,80,true)||!boundedText(word.zh,200,true)||!boundedText(word.roman??'',120)||!boundedText(word.category??'自訂單字',30,true)||!boundedText(word.example??'',300)||!boundedText(word.translation??'',400))throw new Error('自訂韓語單字格式不正確');
    customIds.add(word.id);
    return {id:word.id,ko:word.ko.trim(),zh:word.zh.trim(),roman:(word.roman??'').trim(),category:(word.category??'自訂單字').trim(),example:(word.example??'').trim(),translation:(word.translation??'').trim()};
  });
  const vocabularyIds=new Set([...builtinWordIds,...customIds]);
  function validatedIds(list,label,permitted,max=2000){
    if(!Array.isArray(list)||list.length>max||list.some(id=>typeof id!=='string'||id.length>120||!permitted(id)))throw new Error(`${label}格式不正確`);
    return [...new Set(list)];
  }
  const known=validatedIds(value.known??[],'已記住單字',id=>vocabularyIds.has(id));
  const favorites=validatedIds(value.favorites??[],'收藏單字',id=>vocabularyIds.has(id));
  const rawDays=value.days??{};
  if(!plainObject(rawDays)||Object.keys(rawDays).length>20000)throw new Error('學習日期格式不正確');
  const days={};
  for(const [date,day] of Object.entries(rawDays)){
    if(!validDate(date)||!plainObject(day))throw new Error('學習紀錄日期或內容不正確');
    const reviewed=validatedIds(day.reviewed??[],'複習單字',id=>knownIds.has(id)||customId(id));
    const answered=day.answered??0,correct=day.correct??0;
    if(!Number.isSafeInteger(answered)||!Number.isSafeInteger(correct)||answered<0||answered>1000000||correct<0||correct>answered)throw new Error('測驗答題紀錄不正確');
    days[date]={reviewed,answered,correct};
  }
  return {known,favorites,customWords:normalizedWords,days};
}

export function learningSummary(date,data,today=taipeiToday()){
  const learning=learningData(data);
  const entries=Object.entries(learning.days).filter(([,day])=>day.reviewed.length||day.answered);
  const monthEntries=entries.filter(([day])=>day.slice(0,7)===date.slice(0,7));
  const activeDays=new Set(entries.map(([day])=>day));
  let cursor=dateObject(today),streak=0;
  if(!activeDays.has(today))cursor.setDate(cursor.getDate()-1);
  while(activeDays.has(isoDate(cursor))){streak++;cursor.setDate(cursor.getDate()-1);}
  const reviewedTotal=monthEntries.reduce((sum,[,day])=>sum+day.reviewed.length,0);
  const answered=monthEntries.reduce((sum,[,day])=>sum+day.answered,0),correct=monthEntries.reduce((sum,[,day])=>sum+day.correct,0);
  return {monthDays:monthEntries.length,monthdays:monthEntries.length,reviewedTotal,reviewedtotal:reviewedTotal,answered,correct,knownCount:learning.known.length,streak,accuracy:answered?Math.round(correct/answered*100):null,totalDays:entries.length};
}

function shuffled(items,rng){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export function buildLearningQuiz(pool=words,rng=Math.random,limit=5){
  const unique=[...new Map(pool.filter(word=>word?.id&&word?.ko&&word?.zh).map(word=>[word.zh.trim(),word])).values()];
  if(unique.length<2)return [];
  return shuffled(unique,rng).slice(0,Math.min(limit,unique.length)).map(word=>({id:word.id,ko:word.ko,zh:word.zh,roman:word.roman||'',example:word.example||'',translation:word.translation||'',options:shuffled([word.zh,...shuffled(unique.filter(other=>other.zh!==word.zh),rng).slice(0,3).map(other=>other.zh)],rng)}));
}

function getFilteredWords(data){const learning=learningData(data);return allWords(data).filter(word=>(wordCategory==='all'||word.category===wordCategory)&&(wordFilter==='all'||(wordFilter==='review'&&!learning.known.includes(word.id))||(wordFilter==='favorites'&&learning.favorites.includes(word.id))));}
function sourceMarkup(){
  if(!Array.isArray(sources))return '';
  return sources.map(source=>{const href=source.url||source.href;const title=source.title||source.name||source.label||'韓語學習來源';if(typeof href!=='string'||!/^https:\/\//.test(href))return '';return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(title)} ↗</a>`;}).join('');
}

export function renderLearning(date,data){
  const learning=learningData(data),today=taipeiToday();
  const day=learning.days[today]||{reviewed:[],answered:0,correct:0};
  const summary=learningSummary(date,data,today);
  const progress=Math.min(100,day.reviewed.length/5*100);
  const tabs=[['alphabet','字母入門'],['words','單字卡'],['quiz','小測驗'],['history','學習紀錄']];
  return `<section class="learning-page"><div class="learning-heading"><div><span class="tiny-label">LITTLE PAWS, LITTLE PROGRESS</span><h3>每天一點點，和小貓學韓語。</h3></div><button id="learning-add-word" data-learning-add class="secondary-button">${svg('plus')}收藏新單字</button></div>
    <div class="learning-welcome"><div><span class="learning-hello" lang="ko">안녕, 오늘도 반가워요!</span><p>你好，今天也很高興見到你！</p><span class="learning-today">今日練習 · ${today}（臺北時間）</span><div class="learning-goal-line"><span>今日小目標 <b>${day.reviewed.length}</b> / 5 個字母或單字</span><strong>${day.reviewed.length>=5?'完成了，給你一個貓掌！':'慢慢學，也是一種進步'}</strong></div><div class="learning-goal" role="progressbar" aria-label="今日複習小目標" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${Math.min(5,day.reviewed.length)}" aria-valuetext="已練習 ${day.reviewed.length} 個不同字母或單字，目標 5 個"><span style="width:${progress}%"></span></div></div><img src="./assets/cat-face.svg" alt="陪你學韓語的小貓"/></div>
    <div class="learning-tabs" role="tablist" aria-label="韓語學習功能">${tabs.map(([id,label])=>`<button role="tab" id="learning-tab-${id}" aria-selected="${selectedTab===id}" aria-controls="learning-tab-panel" data-learning-tab="${id}" class="${selectedTab===id?'active':''}">${label}</button>`).join('')}</div>
    <div id="learning-tab-panel" role="tabpanel" aria-labelledby="learning-tab-${selectedTab}">${selectedTab==='alphabet'?renderAlphabet(learning,today):selectedTab==='words'?renderWordCard(data):selectedTab==='quiz'?renderQuiz():renderHistory(date,data,summary)}</div>
    <div class="learning-notes"><p>練習會記在實際的今天；同一字母或單字每天只計一次。羅馬字是輔助提示，韓語發音會隨音節與連音改變。</p><p>「聽發音」使用裝置提供的韓語語音；若裝置沒有韓語語音，會顯示提示。</p><div>${sourceMarkup()}</div></div></section>`;
}

function renderAlphabet(learning,today){
  const group=alphabetGroups.find(item=>item.id===selectedGroup)||alphabetGroups[0];
  const letter=group.items.find(item=>item.id===selectedLetter)||group.items[0];
  selectedLetter=letter.id;
  const reviewed=(learning.days[today]?.reviewed||[]).includes(letter.id);
  return `<div class="learning-section-heading"><div><h4>從 한글 開始認識韓語</h4><p>先選一組字母，再點一下想認識的小字。</p></div><span>${letters.length} 個字母</span></div><div class="learning-alphabet-groups" role="group" aria-label="字母分類">${alphabetGroups.map(item=>`<button data-learning-group="${esc(item.id)}" aria-pressed="${item.id===group.id}" class="${item.id===group.id?'active':''}">${esc(item.label)}<small>${item.items.length}</small></button>`).join('')}</div><div class="learning-alphabet-layout"><div class="learning-letter-grid" aria-label="${esc(group.label)}">${group.items.map(item=>`<button class="learning-letter ${letter.id===item.id?'selected':''}" data-learning-letter="${esc(item.id)}" aria-pressed="${letter.id===item.id}" aria-label="學習 ${esc(item.char)} ${esc(item.name)}"><strong lang="ko">${esc(item.char)}</strong><small>${esc(item.roman)}</small>${(learning.days[today]?.reviewed||[]).includes(item.id)?'<span class="learning-letter-check" aria-label="今天已練習">✓</span>':''}</button>`).join('')}</div><article class="learning-letter-detail"><div class="learning-detail-eyebrow">今日的字母小筆記</div><strong class="learning-big-letter" lang="ko">${esc(letter.char)}</strong><h5 lang="ko">${esc(letter.name)}</h5><p class="learning-roman">${esc(letter.roman)}</p><div class="learning-letter-example"><span>試著念念看</span><p lang="ko">${esc(letter.example)}</p></div><p class="learning-letter-tip">${esc(letter.tip)}</p><button class="learning-audio" data-learning-speak="letter" data-learning-id="${esc(letter.id)}">♫ 聽韓語字母名稱</button><button class="primary-button learning-reviewed" data-learning-review-letter="${esc(letter.id)}">${reviewed?svg('check'):svg('paw')}${reviewed?'今天練習過了':'練習過了'}</button></article></div>`;
}

function renderWordCard(data){
  const learning=learningData(data),pool=getFilteredWords(data);
  const categories=[...new Set(allWords(data).map(word=>word.category))];
  if(cardIndex>=pool.length)cardIndex=0;
  const word=pool[cardIndex];
  return `<div class="learning-word-controls"><label for="learning-category">單字主題<select id="learning-category"><option value="all">全部主題</option>${categories.map(category=>`<option value="${esc(category)}" ${category===wordCategory?'selected':''}>${esc(category)}</option>`).join('')}</select></label><div class="learning-word-filters" role="group" aria-label="單字篩選">${[['all','全部'],['review','待複習'],['favorites','已收藏']].map(([id,label])=>`<button data-learning-filter="${id}" aria-pressed="${wordFilter===id}" class="${wordFilter===id?'active':''}">${label}</button>`).join('')}</div></div>${word?`<div class="learning-card-meta"><span>${esc(word.category)} <small>${learning.known.includes(word.id)?'✓ 已記住':'還在認識中'}</small></span><button class="learning-favorite ${learning.favorites.includes(word.id)?'active':''}" data-learning-favorite="${esc(word.id)}" aria-pressed="${learning.favorites.includes(word.id)}" aria-label="${learning.favorites.includes(word.id)?'取消收藏':'收藏'}${esc(word.ko)}">${learning.favorites.includes(word.id)?'♥':'♡'}</button></div><button class="learning-flashcard ${flipped?'flipped':''}" data-learning-flip aria-label="${flipped?'翻回韓文正面':'翻卡查看中文與例句'}"><span class="learning-flashcard-tag">${flipped?'把意思也記在心裡':'先想一想，它是什麼意思？'}</span><strong lang="ko">${esc(word.ko)}</strong>${flipped?`<span class="learning-meaning">${esc(word.zh)}</span>${word.example?`<span class="learning-example" lang="ko">${esc(word.example)}</span><span class="learning-example-translation">${esc(word.translation)}</span>`:''}`:`<span class="learning-card-roman">${esc(word.roman||'你的自訂單字')}</span><span class="learning-card-cat" aria-hidden="true">ᓚᘏᗢ</span>`}<small>${flipped?'點一下，翻回正面':'輕點卡片，看看答案 ↻'}</small></button><div class="learning-card-navigation"><button data-learning-card-step="-1" class="learning-arrow" aria-label="上一張單字卡">${svg('chevron')}</button><span>${cardIndex+1} / ${pool.length}</span><button class="learning-audio" data-learning-speak="word" data-learning-id="${esc(word.id)}">♫ 聽發音</button><button data-learning-card-step="1" class="learning-arrow" aria-label="下一張單字卡">${svg('chevron')}</button></div><div class="learning-card-actions"><button data-learning-remember="review" data-learning-id="${esc(word.id)}" class="learning-again">再複習一次</button><button data-learning-remember="known" data-learning-id="${esc(word.id)}" class="primary-button">${svg('check')}記住了</button></div>${customId(word.id)?`<div class="learning-custom-actions"><button data-learning-edit="${esc(word.id)}">編輯自訂單字</button><button data-learning-delete="${esc(word.id)}">刪除這個單字</button></div>`:''}`:`<div class="learning-empty"><img src="./assets/sleepy-cat.svg" alt="休息中的小貓"/><h4>${wordFilter==='favorites'?'把喜歡的單字，收進口袋吧。':wordFilter==='review'?'這裡的單字都記住了，好棒！':'這個主題還沒有單字。'}</h4><p>${wordFilter==='favorites'?'在單字卡上點一下愛心，就能收藏。':'試著切換其他主題，或加入自己的單字。'}</p><button class="secondary-button" data-learning-filter="all">查看全部單字</button></div>`}`;
}

function renderQuiz(){
  if(!quiz)return `<div class="learning-quiz-start"><img src="./assets/cat-face.svg" alt="準備好小測驗的小貓"/><span class="tiny-label">A TINY CHALLENGE</span><h4>五個小問題，看看記住多少。</h4><p>看韓文，選出中文意思。<br>每次作答都會留下紀錄，答錯也能再學一次。</p><div><span>5 題</span><span>入門單字</span><span>沒有時間限制</span></div><button class="primary-button" data-learning-start-quiz>開始小測驗 ${svg('chevron')}</button></div>`;
  if(quiz.finished){const right=quiz.answers.filter(answer=>answer.correct).length;return `<div class="learning-quiz-result"><span class="learning-result-star">✦</span><span class="tiny-label">YOU DID A LITTLE MORE TODAY</span><h4>今天又多認識了一點韓語！</h4><strong>${right}<small>/ ${quiz.questions.length}</small></strong><p>每一次練習都算數，答錯的也可以慢慢記住。</p><div class="learning-quiz-recap">${quiz.questions.map((question,index)=>`<div><span class="${quiz.answers[index].correct?'right':'wrong'}">${quiz.answers[index].correct?'✓':'↺'}</span><strong lang="ko">${esc(question.ko)}</strong><span>${esc(question.zh)}</span></div>`).join('')}</div><button class="primary-button" data-learning-start-quiz>再練習五題</button></div>`;}
  const question=quiz.questions[quiz.index],answer=quiz.answers[quiz.index];
  return `<div class="learning-quiz-heading"><span>小測驗 ${quiz.index+1} / ${quiz.questions.length}</span><span>已答對 ${quiz.answers.filter(item=>item.correct).length} 題</span></div><div class="learning-quiz-progress"><span style="width:${quiz.index/quiz.questions.length*100}%"></span></div><div class="learning-question"><p>這個韓文，是什麼意思呢？</p><strong lang="ko">${esc(question.ko)}</strong><button class="learning-audio" data-learning-speak="quiz">♫ 聽發音</button></div><div class="learning-answer-options">${question.options.map((option,index)=>`<button data-learning-answer="${index}" ${answer?'disabled':''} class="${answer?(option===question.zh?'correct':index===answer.index?'incorrect':''):''}"><span>${String.fromCharCode(65+index)}</span>${esc(option)}${answer&&option===question.zh?'<b>✓</b>':''}</button>`).join('')}</div>${answer?`<div class="learning-answer-feedback ${answer.correct?'correct':'incorrect'}" role="status"><strong>${answer.correct?'答對了，給你一個小貓掌！':'沒關係，再認識它一次。'}</strong><p><span lang="ko">${esc(question.ko)}</span> = ${esc(question.zh)}</p>${question.example?`<small lang="ko">${esc(question.example)}</small><small>${esc(question.translation)}</small>`:''}</div><button class="primary-button learning-next-question" data-learning-next-question>${quiz.index===quiz.questions.length-1?'看看這次的成果':'下一題'} ${svg('chevron')}</button>`:'<p class="learning-quiz-hint">選一個答案就好，慢慢想。</p>'}`;
}

function renderHistory(date,data,summary){
  const month=date.slice(0,7),learning=learningData(data);
  const entries=Object.entries(learning.days).filter(([day,record])=>day.slice(0,7)===month&&(record.reviewed.length||record.answered)).sort((a,b)=>b[0].localeCompare(a[0]));
  return `<div class="learning-history-heading"><div><h4>每一小步，都有留下足跡。</h4><p>練習記錄會一直陪著你。</p></div><label>回顧月份<input id="learning-history-month" type="month" value="${month}" min="1000-01" max="9999-12" aria-label="學習紀錄月份"/></label></div><div class="learning-stat-grid"><div><strong>${summary.streak}<small>天</small></strong><span>目前連續學習</span></div><div><strong>${summary.monthDays}<small>天</small></strong><span>本月有練習</span></div><div><strong>${summary.knownCount}<small>個</small></strong><span>目前已記住單字</span></div><div><strong>${summary.accuracy===null?'—':summary.accuracy+'%'} </strong><span>本月測驗答對率</span></div></div><p class="learning-history-method">連續天數以臺北今天（或昨天）為起點。已記住單字為累計數；答對率只計算已作答題目。</p>${entries.length?`<div class="learning-history-list">${entries.map(([day,record])=>`<article><span class="learning-history-day"><strong>${Number(day.slice(8))}</strong><small>${Number(day.slice(5,7))} 月</small></span><div><h5>${record.reviewed.length} 個字母／單字${record.reviewed.length>=5?' · 今日目標完成':''}</h5><p>${record.answered?`測驗 ${record.correct} / ${record.answered} 題答對`:'今天專心認識字母或單字'}</p></div><span class="learning-history-paw">${svg('paw')}</span></article>`).join('')}</div>`:`<div class="learning-empty"><img src="./assets/sleepy-cat.svg" alt=""/><h4>這個月，還沒有練習足跡。</h4><p>從一個字母、一張單字卡開始就很好。</p><button class="secondary-button" data-learning-tab="alphabet">開始認識字母</button></div>`}`;
}

function mutableLearning(){return context.getData().learning??=emptyLearning();}
function todayRecord(){const learning=mutableLearning(),today=taipeiToday();return learning.days[today]??={reviewed:[],answered:0,correct:0};}
function markReviewed(id){const day=todayRecord();if(!day.reviewed.includes(id))day.reviewed.push(id);return day;}
function finishSave(message){const saved=context.save();context.rerender();if(saved&&message)context.toast(message);}
async function speakKorean(text){
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){context.toast('這個瀏覽器目前不支援語音朗讀');return;}
  const synth=window.speechSynthesis;
  let voice=synth.getVoices().find(item=>/^ko(?:[-_]|$)/i.test(item.lang));
  if(!voice){await new Promise(resolve=>{let timeout;const done=()=>{clearTimeout(timeout);synth.removeEventListener('voiceschanged',done);resolve();};synth.addEventListener('voiceschanged',done,{once:true});timeout=setTimeout(done,1200);});voice=synth.getVoices().find(item=>/^ko(?:[-_]|$)/i.test(item.lang));}
  if(!voice){context.toast('裝置尚未提供韓語語音，可在裝置語音設定加入韓語');return;}
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang=voice.lang;utterance.voice=voice;utterance.rate=.8;
  utterance.onerror=event=>{if(!['canceled','interrupted'].includes(event.error))context.toast('這次無法播放韓語語音，請稍後再試');};
  synth.cancel();synth.speak(utterance);
}

function openWordDialog(id=null){
  const learning=mutableLearning(),word=learning.customWords.find(item=>item.id===id);
  if(id&&!word)return;
  if(!id&&learning.customWords.length>=500){context.toast('已收藏 500 個自訂單字，先整理一些再新增吧');return;}
  editingWordId=id;
  const fields={ko:word?.ko||'',zh:word?.zh||'',roman:word?.roman||'',example:word?.example||'',translation:word?.translation||''};
  document.getElementById('learning-word-dialog-title').textContent=word?'編輯這個韓語小單字':'收藏一個自己的韓語單字';
  for(const [field,value] of Object.entries(fields)){const input=document.getElementById(`learning-word-${field}`);input.value=value;input.setCustomValidity('');}
  const categories=[...new Set([...words.map(item=>item.category),'自訂單字',...(word?[word.category]:[])])];
  document.getElementById('learning-word-category').innerHTML=categories.map(category=>`<option value="${esc(category)}">${esc(category)}</option>`).join('');
  document.getElementById('learning-word-category').value=word?.category||'自訂單字';
  document.getElementById('learning-word-dialog').showModal();document.getElementById('learning-word-ko').focus();
}

export function installLearning(ctx){
  if(context)return;context=ctx;
  const dialog=document.createElement('dialog');dialog.id='learning-word-dialog';dialog.className='app-dialog learning-dialog';dialog.setAttribute('aria-labelledby','learning-word-dialog-title');
  dialog.innerHTML=`<form id="learning-word-form"><div class="dialog-heading"><div><span class="tiny-label">MY LITTLE KOREAN DICTIONARY</span><h2 id="learning-word-dialog-title">收藏一個自己的韓語單字</h2></div><button type="button" class="icon-button" data-learning-close aria-label="關閉單字表單">${svg('close')}</button></div><div class="form-fields"><label for="learning-word-ko">韓文<input id="learning-word-ko" lang="ko" maxlength="80" required placeholder="例如：고양이"/></label><label for="learning-word-zh">中文意思<input id="learning-word-zh" maxlength="200" required placeholder="例如：貓咪"/></label><label for="learning-word-roman">羅馬字（選填）<input id="learning-word-roman" maxlength="120" placeholder="例如：goyangi"/></label><label for="learning-word-category">單字主題<select id="learning-word-category"></select></label><label for="learning-word-example">韓文例句（選填）<textarea id="learning-word-example" lang="ko" rows="2" maxlength="300" placeholder="寫下一句容易記住的例句"></textarea></label><label for="learning-word-translation">例句中文（選填）<textarea id="learning-word-translation" rows="2" maxlength="400"></textarea></label></div><div class="dialog-actions"><button type="button" class="text-button" data-learning-close>取消</button><button class="primary-button" type="submit">好好收藏 ${svg('check')}</button></div></form>`;
  document.body.append(dialog);
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-learning-add')){openWordDialog();return;}
    if(button.hasAttribute('data-learning-close')){dialog.close();return;}
    if(button.hasAttribute('data-learning-tab')){selectedTab=button.dataset.learningTab;context.rerender();return;}
    if(button.hasAttribute('data-learning-group')){selectedGroup=button.dataset.learningGroup;selectedLetter=alphabetGroups.find(group=>group.id===selectedGroup)?.items[0]?.id;context.rerender();return;}
    if(button.hasAttribute('data-learning-letter')){selectedLetter=button.dataset.learningLetter;context.rerender();return;}
    if(button.hasAttribute('data-learning-review-letter')){markReviewed(button.dataset.learningReviewLetter);finishSave('今天又認識了一個韓文字母 ♡');return;}
    if(button.hasAttribute('data-learning-filter')){wordFilter=button.dataset.learningFilter;cardIndex=0;flipped=false;context.rerender();return;}
    if(button.hasAttribute('data-learning-flip')){flipped=!flipped;context.rerender();return;}
    if(button.hasAttribute('data-learning-card-step')){const pool=getFilteredWords(context.getData());if(pool.length){cardIndex=(cardIndex+Number(button.dataset.learningCardStep)+pool.length)%pool.length;flipped=false;context.rerender();}return;}
    if(button.hasAttribute('data-learning-favorite')){const learning=mutableLearning(),id=button.dataset.learningFavorite;if(learning.favorites.includes(id))learning.favorites=learning.favorites.filter(item=>item!==id);else learning.favorites.push(id);finishSave(learning.favorites.includes(id)?'單字放進收藏口袋了':'已取消收藏');return;}
    if(button.hasAttribute('data-learning-remember')){const learning=mutableLearning(),id=button.dataset.learningId;markReviewed(id);learning.known=learning.known.filter(item=>item!==id);if(button.dataset.learningRemember==='known')learning.known.push(id);finishSave(button.dataset.learningRemember==='known'?'記住了一個新單字，好棒 ♡':'放進待複習，下次再和它見面');return;}
    if(button.hasAttribute('data-learning-start-quiz')){const questions=buildLearningQuiz();if(!questions.length){context.toast('目前沒有足夠單字可以開始測驗');return;}quiz={questions,index:0,answers:[],finished:false};selectedTab='quiz';context.rerender();return;}
    if(button.hasAttribute('data-learning-answer')){if(!quiz||quiz.finished||quiz.answers[quiz.index])return;const question=quiz.questions[quiz.index],index=Number(button.dataset.learningAnswer);if(!Number.isInteger(index)||index<0||index>=question.options.length)return;const correct=question.options[index]===question.zh;quiz.answers[quiz.index]={index,correct};const day=markReviewed(question.id);day.answered++;if(correct)day.correct++;finishSave();return;}
    if(button.hasAttribute('data-learning-next-question')){if(!quiz||!quiz.answers[quiz.index])return;if(quiz.index===quiz.questions.length-1)quiz.finished=true;else quiz.index++;context.rerender();return;}
    if(button.hasAttribute('data-learning-speak')){const id=button.dataset.learningId;const text=button.dataset.learningSpeak==='letter'?letters.find(letter=>letter.id===id)?.name:button.dataset.learningSpeak==='quiz'?quiz?.questions[quiz.index]?.ko:allWords(context.getData()).find(word=>word.id===id)?.ko;if(text)void speakKorean(text);return;}
    if(button.hasAttribute('data-learning-edit')){openWordDialog(button.dataset.learningEdit);return;}
    if(button.hasAttribute('data-learning-delete')){const id=button.dataset.learningDelete;context.confirm('要刪除這個自訂單字嗎？','單字與收藏會移除，已經留下的每日練習紀錄會保留。',()=>{const learning=mutableLearning();learning.customWords=learning.customWords.filter(word=>word.id!==id);learning.known=learning.known.filter(item=>item!==id);learning.favorites=learning.favorites.filter(item=>item!==id);cardIndex=0;flipped=false;finishSave('已刪除這個自訂單字');});}
  });
  document.addEventListener('change',event=>{if(event.target.id==='learning-category'){wordCategory=event.target.value;cardIndex=0;flipped=false;context.rerender();}if(event.target.id==='learning-history-month'){const month=event.target.value;if(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month))context.setSelected(month+'-01');else context.rerender();}});
  document.getElementById('learning-word-form').addEventListener('submit',event=>{
    event.preventDefault();const read=id=>document.getElementById(`learning-word-${id}`);
    for(const key of ['ko','zh'])if(!read(key).value.trim()){read(key).setCustomValidity(key==='ko'?'寫下一個韓語單字吧':'也記下中文意思吧');read(key).reportValidity();return;}
    const learning=mutableLearning();const word={id:editingWordId||`custom-${crypto.randomUUID()}`,ko:read('ko').value.trim(),zh:read('zh').value.trim(),roman:read('roman').value.trim(),category:read('category').value,example:read('example').value.trim(),translation:read('translation').value.trim()};
    const index=learning.customWords.findIndex(item=>item.id===editingWordId);if(index>=0)learning.customWords[index]=word;else{if(learning.customWords.length>=500){context.toast('自訂單字已達 500 個');return;}learning.customWords.push(word);}dialog.close();selectedTab='words';wordCategory='all';wordFilter='all';cardIndex=allWords(context.getData()).findIndex(item=>item.id===word.id);flipped=false;finishSave('新單字，放進自己的小字典了');
  });
  dialog.addEventListener('input',event=>event.target.setCustomValidity?.(''));
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
}
