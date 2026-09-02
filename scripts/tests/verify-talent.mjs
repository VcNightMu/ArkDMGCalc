// 验证常驻加攻天赋：驱动表查表 + 直接乘算累加（技能期 = 白值 × (1 + 天赋atk + 技能atk)）
import { calcTalentAtkBonus, TALENT_ATK_DRIVERS, calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const hibisc = JSON.parse(fs.readFileSync('F:/ArkCodes/ArkDMGCalc/src/frontend/data/MEDIC/physician/char_120_hibisc.json', 'utf8'));
const silverash = JSON.parse(fs.readFileSync('F:/ArkCodes/ArkDMGCalc/src/frontend/data/WARRIOR/lord/char_172_svrash.json', 'utf8'));

let ok = true;
const check = (label, actual, expect) => {
  const pass = Math.abs(actual - expect) < 1e-6;
  if (!pass) ok = false;
  console.log(`${label}: ${actual} (期望 ${expect}) ${pass ? 'OK' : 'FAIL'}`);
};

console.log('=== 驱动表 ===');
console.log('芙蓉在驱动表中:', TALENT_ATK_DRIVERS['char_120_hibisc'] !== undefined, '(期望 true)');
console.log('银灰不在驱动表中:', TALENT_ATK_DRIVERS['char_172_svrash'] === undefined, '(期望 true)');
if (TALENT_ATK_DRIVERS['char_120_hibisc'] === undefined) ok = false;
if (TALENT_ATK_DRIVERS['char_172_svrash'] !== undefined) ok = false;

console.log('\n=== 天赋加数（直接乘算加数）===');
check('芙蓉 精0 Lv40', calcTalentAtkBonus(hibisc, { elite: 0, level: 40 }), 0);
check('芙蓉 精1 Lv1', calcTalentAtkBonus(hibisc, { elite: 1, level: 1 }), 0.04);
check('芙蓉 精1 Lv54', calcTalentAtkBonus(hibisc, { elite: 1, level: 54 }), 0.04);
check('芙蓉 精1 Lv55', calcTalentAtkBonus(hibisc, { elite: 1, level: 55 }), 0.08);
check('银灰 精2 Lv1（不在表）', calcTalentAtkBonus(silverash, { elite: 2, level: 1 }), 0);

console.log('\n=== 面板攻击力（信赖100%）===');
// 白值 = 345(满级) + 45(信赖) = 390
check('芙蓉 精1 Lv55 panelAtk', calcPanelStats(hibisc, { elite: 1, level: 55, trustPercent: 100, potentialRank: 0 }).panelAtk, Math.round(390 * 1.08));
check('芙蓉 精0 Lv40 panelAtk(无天赋)', calcPanelStats(hibisc, { elite: 0, level: 40, trustPercent: 100, potentialRank: 0 }).panelAtk, Math.round((248 + 45) * 1));

console.log('\n=== HPS（技能 治疗强化·α型 Lv7 atk+50%）===');
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };
const r55 = calculateOperator(hibisc, { elite: 1, level: 55, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 6 });
// 常态 = 白值 × (1+0.08) / 2.85
check('精1 Lv55 常态HPS', r55.normalHps, 390 * 1.08 / 2.85);
// 技能期 = 白值 × (1 + 0.08 + 0.50) / 2.85（直接乘算累加，非连乘 1.08×1.5）
check('精1 Lv55 技能期HPS(累加)', r55.skillHps, 390 * (1 + 0.08 + 0.5) / 2.85);

const r0 = calculateOperator(hibisc, { elite: 0, level: 40, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 6 });
check('精0 Lv40 常态HPS(无天赋)', r0.normalHps, (248 + 45) / 2.85);

console.log('\n' + (ok ? '✅ 全部通过' : '❌ 存在失败'));
