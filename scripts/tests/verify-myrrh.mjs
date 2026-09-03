// 验证触发型一次性额外治疗：末药「二重治疗」/ 录武官「触类旁通」
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/MEDIC/physician';
const myrrh = JSON.parse(fs.readFileSync(`${BASE}/char_117_myrrh.json`, 'utf8'));
const reckpr = JSON.parse(fs.readFileSync(`${BASE}/char_4196_reckpr.json`, 'utf8'));

let ok = true;
const check = (label, actual, expect) => {
  const pass = Math.abs(actual - expect) < 1e-6;
  if (!pass) ok = false;
  console.log(`${label}: ${actual} (期望 ${expect}) ${pass ? 'OK' : 'FAIL'}`);
};

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };
const BI = 2.85;

// 末药精二70级专三：白值 = 465 + 60 = 525
const MRaw = 525;
const mSlot = { elite: 2, level: 70, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 9 };
const m = calculateOperator(myrrh, mSlot);
console.log('=== 末药 二重治疗（AUTO 一次性额外，heal_scale 1.25, spCost 8）===');
check('常态HPS', m.normalHps, MRaw / BI);
check('总治疗量(额外治疗)', m.totalHeal, MRaw * 1.25);
const mDelay = Math.ceil(8 / BI) * BI - 8;
const mCycleTime = 8 + mDelay;
const mExp = (MRaw / BI) + (MRaw * 1.25) / mCycleTime;
check('周期HPS', m.cycleHps, mExp);
check('周期HPS > 常态HPS', m.cycleHps > m.normalHps, true);
console.log('技能期HPS 为 null:', m.skillHps === null ? 'OK' : 'FAIL');
if (m.skillHps !== null) ok = false;

// 录武官（五星）精二满级：用数据文件动态取 maxLevel 与白值
const rPhase = reckpr.phases[2];
const rMaxLevel = rPhase.maxLevel;
const RRaw = rPhase.atk[1] + reckpr.trustBonus.atk;
const rSlot = { elite: 2, level: rMaxLevel, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 9 };
const r = calculateOperator(reckpr, rSlot);
console.log('\n=== 录武官 触类旁通（AUTO 一次性额外，heal_scale 1.55, spCost 7）===');
check('常态HPS', r.normalHps, RRaw / BI);
check('总治疗量(额外治疗)', r.totalHeal, RRaw * 1.55);
const rDelay = Math.ceil(7 / BI) * BI - 7;
const rCycleTime = 7 + rDelay;
const rExp = (RRaw / BI) + (RRaw * 1.55) / rCycleTime;
check('周期HPS', r.cycleHps, rExp);

console.log('\n' + (ok ? '✅ 全部通过' : '❌ 存在失败'));
