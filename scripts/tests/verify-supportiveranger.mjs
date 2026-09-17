// 游击手(supportiveranger,辅助)验证:精二满级/满信赖/潜0/专一(技能等级 7),敌 hp50000 atk800 def600 res50
// 特性「可以使用触发型效果协助作战」:普攻为物理伤害(特性未声明法术;佩德洛的标记需我方其他法术伤害触发)。
// 用户口径(2026-09-18):
//   佩德洛「掩护战术」的攻击力增幅不计算(条件类:范围内≥2 名其他干员);
//   佩德洛「标记射击」直接将触发型效果进行伤害计算(每发 = 物理 atk_scale + 法术 debuff_atk_scale);
//   佩德洛「交替撤离」的触发型效果不计算(治疗/不易被选中不计);
//   岳羽由加莉「明镜止水」的触发型效果默认自己立刻生效(术法充盈 = 法术伤害提升,自身普攻为物理 → 自身输出不变)。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const IDX = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
function loadOp(id) { const e = IDX.find((x) => x.id === id); return JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8')); }
function mk(op, si, module) { const elite = op.phases.length - 1; return { elite, level: op.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module }; }
function mod(o, id, level) { return { moduleId: id, moduleLevel: level }; }
let pass = 0, fail = 0;
const near = (a, e, tol, label) => { if (typeof a !== 'number' || Math.abs(a - e) > tol) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); } else pass++; };
const eq = (a, e, label) => { if (a !== e) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); } else pass++; };

// ---- 岳羽由加莉 ----
{
  const o = loadOp('char_4219_yukari');
  near(calculateOperator(o, mk(o, -1)).panelAtk, 805, 0.01, '岳羽由加莉 面板攻击力 805(775+信赖30)');
  near(calculateOperator(o, mk(o, -1)).normalDps, 97.619, 0.01, '岳羽由加莉 常态物理 DPS((805-600)/2.1)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 2254, 0.5, '岳羽由加莉 S1 龙卷箭 总伤(3×70%+350%=560% 法术,4508→×0.5)');
  near(s1.skillDps, 0, 0.001, '岳羽由加莉 S1 为一次性技能(skillDps 0)');
  near(s1.cycleDps, 187.875, 0.01, '岳羽由加莉 S1 循环 DPS(自动回复 spCost24)');
  near(s1.dmgTypes.arts.skillTotalDamage, 2254, 0.5, '岳羽由加莉 S1 伤害类型为法术');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 0, 0.001, '岳羽由加莉 S2 明镜止水 触发型效果(术法充盈)不计伤害');
  near(s2.normalDps, 97.619, 0.01, '岳羽由加莉 S2 技能期普攻照常归常态(物理)');
  near(s2.panelAtk, 805, 0.01, '岳羽由加莉 S2 技能期 ATK 显示自身面板');
  const x3 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_yukari', 3)));
  near(x3.panelAtk, 853, 0.05, '岳羽由加莉 X3 面板(模组 atk +48;特性追加「范围内有干员处于技能期间时攻击力+8%」为条件类不计)');
  near(x3.skillTotalDamage, 2388.4, 0.5, '岳羽由加莉 X3 S1 总伤');
  near(x3.cycleDps, 215.475, 0.01, '岳羽由加莉 X3 S1 循环 DPS');
}
// ---- 佩德洛 ----
{
  const o = loadOp('char_4234_pedro');
  near(calculateOperator(o, mk(o, -1)).panelAtk, 810, 0.01, '佩德洛 面板攻击力 810(765+信赖45;天赋掩护战术+10% 不计)');
  near(calculateOperator(o, mk(o, -1)).normalDps, 100, 0.01, '佩德洛 常态物理 DPS((810-600)/2.1)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 1182, 0.5, '佩德洛 S1 标记射击 总伤(物理 412.5 + 触发型法术 769.5)');
  near(s1.dmgTypes.physical.skillTotalDamage, 412.5, 0.05, '佩德洛 S1 物理部分(810×1.25-600)');
  near(s1.dmgTypes.arts.skillTotalDamage, 769.5, 0.05, '佩德洛 S1 触发型法术部分(810×1.9×0.5)');
  near(s1.cycleDps, 177.1429, 0.01, '佩德洛 S1 循环 DPS(攻击回复 spCost5)');
  near(s1.skillDps, 0, 0.001, '佩德洛 S1 为触发型技能(skillDps 0)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 0, 0.001, '佩德洛 S2 交替撤离 触发型效果(治疗/不易被选中)不计');
  near(s2.normalDps, 100, 0.01, '佩德洛 S2 技能期普攻照常归常态');
  near(s2.panelAtk, 810, 0.01, '佩德洛 S2 技能期 ATK 显示自身面板(atk_scale 1.9 是治疗比率)');
  eq((o.modules || []).length, 0, '佩德洛暂无模组');
}
// ---- 说明文本 ----
{
  const notes = JSON.parse(fs.readFileSync(DATA + '/notes.json', 'utf8'));
  eq(typeof notes['char_4234_pedro'], 'string', '佩德洛说明文本已登记');
  eq(typeof notes['char_4219_yukari'], 'string', '岳羽由加莉说明文本已登记');
}
console.log('游击手: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
