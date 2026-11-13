import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReportStats,buildReportCsv,renderReport,installReport} from '../dist/report.js';

const emptyData=()=>({health:{},ledger:[],journals:{},moods:{}});
const withDays=days=>({...emptyData(),learning:{known:[],favorites:[],customWords:[],days}});

test('old backups and empty future months have no learning records or quiz percentage',()=>{
  const report=buildReportStats('2027-02-01',emptyData(),'2026-11-13');
  assert.equal(report.daysInMonth,28);
  assert.equal(report.daysElapsed,0);
  assert.equal(report.learningDays,0);
  assert.equal(report.learningUniqueItems,0);
  assert.equal(report.learningReviewCount,0);
  assert.equal(report.quizAnswered,0);
  assert.equal(report.quizCorrect,0);
  assert.equal(report.quizAccuracy,null);
  assert.equal(report.recordedDays,0);
});

test('leap-month boundaries, alphabet items, repeat reviews, and weighted accuracy',()=>{
  const data=withDays({
    '2028-01-31':{reviewed:['outside-january'],answered:99,correct:99},
    '2028-02-01':{reviewed:['alphabet-a','word-cat','word-cat'],answered:1,correct:1},
    '2028-02-02':{reviewed:[],answered:0,correct:0},
    '2028-02-29':{reviewed:['alphabet-a','word-dog'],answered:9,correct:1},
    '2028-03-01':{reviewed:['outside-march'],answered:99,correct:99}
  });
  const report=buildReportStats('2028-02-29',data,'2028-03-01');
  assert.equal(report.daysInMonth,29);
  assert.equal(report.daysElapsed,29);
  assert.equal(report.learningDays,2);
  assert.equal(report.learningUniqueItems,3);
  assert.equal(report.learningReviewCount,4);
  assert.equal(report.quizAnswered,10);
  assert.equal(report.quizCorrect,2);
  assert.equal(report.quizAccuracy,20);
  assert.equal(report.daily.at(-1).date,'2028-02-29');
  assert.equal(report.daily[0].reviewCount,2);
  assert.equal(report.daily[1].studied,false);
  assert.equal(report.recordedDays,2);
});

test('year transitions and quiz-only days count only in their selected month',()=>{
  const data=withDays({
    '2026-12-31':{reviewed:['alphabet-z'],answered:0,correct:0},
    '2027-01-01':{reviewed:[],answered:3,correct:2}
  });
  const december=buildReportStats('2026-12-01',data,'2027-01-01');
  const january=buildReportStats('2027-01-01',data,'2027-01-01');
  assert.equal(december.learningDays,1);
  assert.equal(december.learningUniqueItems,1);
  assert.equal(december.quizAccuracy,null);
  assert.equal(january.previousMonth,'2026-12');
  assert.equal(january.learningDays,1);
  assert.equal(january.learningUniqueItems,0);
  assert.equal(january.quizAnswered,3);
  assert.equal(january.quizAccuracy,2/3*100);
});

test('health tenths and finance integer cents are preserved when learning is included',()=>{
  const data=withDays({'2026-11-13':{reviewed:['alphabet-a'],answered:0,correct:0}});
  data.health['2026-11-13']={water:250,goal:2000,meals:[{type:'breakfast',calories:120.1},{type:'snack',calories:80.2}]};
  data.ledger=[{date:'2026-11-13',type:'income',amount:1.1},{date:'2026-11-13',type:'income',amount:2.2},{date:'2026-11-13',type:'expense',amount:0.1,category:'餐飲'}];
  const report=buildReportStats('2026-11-01',data,'2026-11-13');
  assert.equal(report.income,330);
  assert.equal(report.expense,10);
  assert.equal(report.net,320);
  assert.equal(report.calorieTotal,200.3);
  assert.equal(report.waterTotal,250);
  assert.equal(report.recordedDays,1);
});

test('CSV includes matching monthly statistics, daily counts, and no-quiz label',()=>{
  const data=withDays({'2026-11-13':{reviewed:['alphabet-a','word-cat'],answered:4,correct:3}});
  const csv=buildReportCsv('2026-11-01',data);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"有學習紀錄日",1,"天"'));
  assert.ok(csv.includes('"複習過的不同學習項目",2,"個"'));
  assert.ok(csv.includes('"學習項目複習項次(每日去重)",2,"項次"'));
  assert.ok(csv.includes('"測驗答對率",75,"%"'));
  const day=csv.split('\r\n').find(line=>line.startsWith('"2026-11-13",'));
  assert.ok(day.endsWith(',2,4,3,75'));
  assert.ok(buildReportCsv('2027-01-01',emptyData()).includes('"測驗答對率","尚無測驗","%"'));
});

test('on-screen report distinguishes learning items and an unattempted quiz',()=>{
  const markup=renderReport('2026-11-01',withDays({'2026-11-13':{reviewed:['alphabet-a'],answered:0,correct:0}}));
  assert.ok(markup.includes('複習過的不同學習項目'));
  assert.ok(markup.includes('每日去重合計 1 項次'));
  assert.ok(markup.includes('尚無測驗'));
  assert.ok(markup.includes('答對 0 / 作答 0 題'));
});

test('print report uses the same monthly learning summary and daily details',()=>{
  const originalDocument=globalThis.document,originalWindow=globalThis.window;
  const listeners=new Map();let printedArticle,printed=false;
  globalThis.document={getElementById:()=>null,createElement:()=>({id:'',innerHTML:'',remove(){}}),body:{append:article=>{printedArticle=article;},classList:{add(){},remove(){}}},addEventListener:(name,handler)=>listeners.set(name,handler)};
  globalThis.window={addEventListener(){},print(){printed=true;}};
  try{
    installReport({getSelected:()=>'2026-11-01',getData:()=>withDays({'2026-11-13':{reviewed:['alphabet-a','word-cat'],answered:4,correct:3}})});
    listeners.get('click')({target:{closest:()=>({hasAttribute:name=>name==='data-report-print'})}});
    assert.equal(printed,true);
    assert.ok(printedArticle.innerHTML.includes('report-print-learning'));
    assert.ok(printedArticle.innerHTML.includes('每日去重合計 2 項次'));
    assert.ok(printedArticle.innerHTML.includes('答對 3 / 作答 4 題'));
    assert.ok(printedArticle.innerHTML.includes('<strong>75<small>%</small></strong>'));
    assert.ok(printedArticle.innerHTML.includes('<td>3/4</td>'));
  }finally{globalThis.document=originalDocument;globalThis.window=originalWindow;}
});
