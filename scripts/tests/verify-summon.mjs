// 验证赫默召唤物「医疗探机」独立治疗计算
import { calculateOperator, calcPanelStats } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const summon = JSON.parse(fs.readFileSync('F:/ArkCodes/ArkDMGCalc/src/frontend/data/TOKEN/notchar1/token_10000_silent_healrb.json', 'utf8'));
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

let ok = true;
const check = (label, actual, expect) => {
  const pass = Math.abs(actual - expect) < 1e-6;
  if (!pass) ok = false;
  console.log(`${label}: ${actual} (期望 ${expect}) ${pass ? 'OK' : 'FAIL'}`);
};

// 精二 80 级：atk=125，间隔0.5s，持续10s
const slot = (elite, level) => ({ operatorId: 'token_10000_silent_healrb', elite, level, trustPercent: 0, potentialRank: 0, skillIndex: 0, skillLevel: 0 });

const e2 = calculateOperator(summon, slot(2, 80));
console.log('=== 医疗探机 精二 80 级 ===');
check('type=heal', e2.type === 'heal' ? 1 : 0, 1);
check('normalHps', e2.normalHps, 125 / 0.5);
check('totalHeal', e2.totalHeal, 125 * 20);
check('skillHps=null', e2.skillHps, null);
check('damageType=null', e2.damageType, null);

const e0 = calculateOperator(summon, slot(0, 50));
console.log('=== 医疗探机 精零 50 级 ===');
check('normalHps', e0.normalHps, 55 / 0.5);
check('totalHeal', e0.totalHeal, 55 * 20);

const ps = calcPanelStats(summon, slot(2, 80));
console.log('=== 面板属性 ===');
check('panelAtk', ps.panelAtk, 125);
check('baseAttackTime', ps.baseAttackTime, 0.5);
const ownerOk = summon.ownerOperatorId === 'char_108_silent';
if (!ownerOk) ok = false;
console.log('ownerOperatorId: ' + summon.ownerOperatorId + ' (期望 char_108_silent) ' + (ownerOk ? 'OK' : 'FAIL'));

console.log('\n' + (ok ? '✅ 全部通过' : '❌ 存在失败'));
process.exit(ok ? 0 : 1);
