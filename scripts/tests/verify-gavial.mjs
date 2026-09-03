// 验证嘉维尔触发型 buff 治疗：附带型普攻仍在；自动触发有 sp 吞延迟计入周期，手动触发无延迟
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const gavial = JSON.parse(fs.readFileSync('F:/ArkCodes/ArkDMGCalc/src/frontend/data/MEDIC/physician/char_187_ccheal.json', 'utf8'));

let ok = true;
const check = (label, actual, expect) => {
  const pass = Math.abs(actual - expect) < 1e-6;
  if (!pass) ok = false;
  console.log(`${label}: ${actual} (期望 ${expect}) ${pass ? 'OK' : 'FAIL'}`);
};

// 精1满级 Lv60，信赖100%，潜能0。白值 = 364 + 30 = 394
const RAW = 394;
const BASE_INTERVAL = 2.85;
const slot = { elite: 1, level: 60, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 0 };
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

console.log('=== 数据字段 ===');
console.log('技能1 skillType:', gavial.skills[0].levels[0].skillType, '(AUTO 自动触发)');
console.log('技能2 skillType:', gavial.skills[1].levels[0].skillType, '(MANUAL 手动触发)');

console.log('\n=== 技能1 活力再生（AUTO 附带型，heal_scale 0.2, duration 4, spCost 10）===');
const r1 = calculateOperator(gavial, { ...slot, skillIndex: 0, skillLevel: 0 });
check('总治疗量 totalHeal', r1.totalHeal, RAW * 0.2 * 4);
check('常态HPS', r1.normalHps, RAW / BASE_INTERVAL);
console.log('技能期HPS 为 null(不显示):', r1.skillHps === null ? 'OK' : 'FAIL');
if (r1.skillHps !== null) ok = false;
// 自动触发：sp 蓄满后等下一次普攻，延迟期间 sp 被吞
const delay1 = Math.ceil(10 / BASE_INTERVAL) * BASE_INTERVAL - 10;
const cycleTime1 = 10 + delay1 + 4;
// 全程普攻不中断 + 增益期间叠加 buff 治疗
const expCycle1 = (RAW / BASE_INTERVAL) + (RAW * 0.2 * 4) / cycleTime1;
check('周期HPS(自动触发含延迟+全程普攻)', r1.cycleHps, expCycle1);
check('周期HPS > 常态HPS(增益生效)', r1.cycleHps > r1.normalHps, true);

console.log('\n=== 技能2 活力再生·广域（MANUAL，heal_scale 0.15, duration 7, spCost 60）===');
const r2 = calculateOperator(gavial, { ...slot, skillIndex: 1, skillLevel: 0 });
check('总治疗量 totalHeal', r2.totalHeal, RAW * 0.15 * 7);
check('常态HPS', r2.normalHps, RAW / BASE_INTERVAL);
console.log('技能期HPS 为 null(不显示):', r2.skillHps === null ? 'OK' : 'FAIL');
if (r2.skillHps !== null) ok = false;
// 手动触发：玩家卡普攻瞬间，无延迟
const cycleTime2 = 60 + 7;
const expCycle2 = (RAW / BASE_INTERVAL) + (RAW * 0.15 * 7) / cycleTime2;
check('周期HPS(手动触发无延迟+全程普攻)', r2.cycleHps, expCycle2);
check('周期HPS > 常态HPS(增益生效)', r2.cycleHps > r2.normalHps, true);

console.log('\n' + (ok ? '✅ 全部通过' : '❌ 存在失败'));
