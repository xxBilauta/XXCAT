import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { validateLearning } from '../dist/learning.js';
import { isValidSticker } from '../dist/stickers.js';

const source = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const validationCode = source.slice(0, source.indexOf('\nlet data;')).replace(/^import .+;\r?\n/gm, '');
const validateData = vm.runInNewContext(`${validationCode}\nvalidateData;`, { structuredClone, validateLearning, isValidSticker });
const legacy = () => ({
  version: 1, events: [{id:'event-test',date:'2026-11-13',title:'韓文課',time:'19:00',category:'work',note:'第一課',done:false}],
  journals: {'2026-11-13':'今天學了韓文'}, moods: {'2026-11-13':'happy'}, stickers: {},
  health: {'2026-11-13':{water:750,goal:2000,meals:[]}},
  ledger: [{id:'expense-test',date:'2026-11-13',type:'expense',amount:180.5,title:'午餐',category:'餐飲'}],
  theme:'rose',demo:false
});
const plain = value => JSON.parse(JSON.stringify(value));

test('old journal backups gain empty learning without losing existing entries', () => {
  const input = legacy(), output = plain(validateData(input));
  assert.deepEqual(output, {...input, learning:plain(validateLearning())});
  assert.equal(input.learning, undefined);
});

test('learning records and custom words survive the complete backup validation', () => {
  const input = legacy();
  input.learning = {
    known:['custom-test'],favorites:['custom-test'],
    customWords:[{id:'custom-test',ko:'학교',zh:'學校',roman:'hakgyo',category:'我的單字',example:'학교에 가요.',translation:'去學校。'}],
    days:{'2026-11-13':{reviewed:['custom-test'],answered:2,correct:1}}
  };
  const result = plain(validateData(JSON.parse(JSON.stringify(input))));
  assert.deepEqual(result.learning, plain(validateLearning(input.learning)));
  result.learning.days['2026-11-13'].reviewed.push('word-cat');
  assert.equal(input.learning.days['2026-11-13'].reviewed.length,1);
});

test('invalid learning backup is rejected before replacing current journal', () => {
  const input = legacy();
  input.learning = {known:[],favorites:[],customWords:[],days:{'2026-02-30':{reviewed:[],answered:1,correct:2}}};
  assert.throws(() => validateData(input));
});
