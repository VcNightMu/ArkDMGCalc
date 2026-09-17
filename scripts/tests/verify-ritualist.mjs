// 巫役(ritualist,辅助)验证:精二满级/满信赖/潜0/专一(技能等级 7),敌 hp50000 atk800 def600 res50 grade=normal
// 特性「攻击造成法术伤害，可以造成元素损伤」→ 直伤法术 + 攻击力×倍率损伤(敌方 EP 爆条模拟)。
// 用户口径(2026-09-18):巫役通用「损伤条性质特殊,实际伤害可能与理论不符」;波卜天赋「焦点诱导」损伤 DOT 不计算;
//   酒神召唤物在「特殊-干员附带单位」中查询(本能的召唤/迷狂牢笼);伯塔尼天赋「背弃沉默」攻速按满层计算。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const IDX = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
function loadOp(id) { const e = IDX.find((x) => x.id === id); if (!e) return null; return JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8')); }
function mk(op, si, module) { const elite = op.phases.length - 1; return { elite, level: op.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module }; }
function mod(o, id, level) { return { moduleId: id, moduleLevel: level }; }
let pass = 0, fail = 0;
const near = (a, e, tol, label) => { if (typeof a !== 'number' || Math.abs(a - e) > tol) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); } else pass++; };
const eq = (a, e, label) => { if (a !== e) { fail++; console.log('  FAIL ' + label + ': ' + JSON.stringify(a) + ' != ' + JSON.stringify(e)); } else pass++; };
const ownerCtx = (op) => { const oph = op.phases[op.phases.length - 1]; return { ownerOp: op, ownerSlot: { elite: op.phases.length - 1, level: oph.maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: 0, skillLevel: 7 } }; };

const phatm = loadOp('char_1042_phatm2');
// ---- 酒神(神经损伤) ----
{
  const o = phatm;
  const s0 = calculateOperator(o, mk(o, -1));
  near(s0.panelAtk, 530, 0.01, '酒神 面板攻击力 530(490+信赖40)');
  near(s0.normalDps, 471.7474, 0.05, '酒神 常态 = 法术 165.625 + 神经损伤爆条均摊 306.1224');
  near(s0.normalTypes.arts.dps, 165.625, 0.01, '酒神 常态法术档');
  near(s0.normalTypes.element.dps, 306.1224, 0.05, '酒神 常态元素档(天赋 30% 神经损伤:1000/(6×1.6+10))');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 689, 0.05, '酒神 S1 暗夜回声 两次 130% 法术(专一 1.3)');
  near(s1.cycleDps, 831.875, 0.05, '酒神 S1 循环 DPS(arts 231.875 + 元素 600)');
  near(s1.dmgTypes.element.cycleDps, 600, 0.05, '酒神 S1 元素循环(束缚期间损伤×1.6 → 每周期 1138 损伤,爆条受 cd10 限制 = 6000/10)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillDps, 560.4452, 0.05, '酒神 S2 群体性谵妄(永久,攻速+30,召唤物另计)');
  eq(s2.isPermanent, true, '酒神 S2 为永久型(持续无限)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillTotalDamage, 21778.5, 0.5, '酒神 S3 空剧场 总伤(法术 9778.5 + 元素 12000)');
  near(s3.dmgTypes.arts.skillTotalDamage, 9778.5, 0.5, '酒神 S3 法术档(攻击力+105%,15 击)');
  const x3 = calculateOperator(o, mk(o, 2, mod(o, 'uniequip_002_phatm2', 3)));
  near(calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_phatm2', 3))).panelAtk, 572, 0.05, '酒神 X3 面板(模组 atk +42)');
  near(x3.skillTotalDamage, 22553.4, 0.5, '酒神 X3 S3 总伤');
}
// ---- 塑心(凋亡损伤) ----
{
  const o = loadOp('char_245_cello');
  const s0 = calculateOperator(o, mk(o, -1));
  near(s0.normalDps, 564.0625, 0.05, '塑心 常态 = 法术 164.0625 + 凋亡损伤 400(天赋每秒 10%×攻击力)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 682.5, 0.05, '塑心 S1 黄金的狂喜 法术 260%');
  near(s1.dmgTypes.element.skillDps, 800, 0.05, '塑心 S1 元素(附带 100% 凋亡损伤 → 爆条受 cd15 限制 = 12000/15)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 16725, 0.5, '塑心 S2 安魂的弥撒 总伤(法术 4725 + 元素 12000)');
  const s3 = calculateOperator(o, mk(o, 2));
  eq(s3.damageType, 'element', '塑心 S3 自由的探戈 停止攻击 → 仅元素伤害');
  near(s3.skillTotalDamage, 24000, 0.5, '塑心 S3 元素总伤(第二天赋提升至 2.3 倍:1.2→1.46)');
  const x3 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_cello', 3)));
  near(calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_cello', 3))).panelAtk, 565, 0.05, '塑心 X3 面板(模组 atk +40)');
  near(x3.dmgTypes.element.skillDps, 800, 0.05, '塑心 X3 S1 元素(模组 te 精神逆构 1.2→1.33)');
}
// ---- 凛视(凋亡损伤;天赋「揭示者」为【探索者的银凇止境】模式限定 → 不计) ----
{
  const o = loadOp('char_4102_threye');
  const s0 = calculateOperator(o, mk(o, -1));
  near(s0.panelAtk, 505.62, 0.05, '凛视 面板(477 × 天赋隐居者 +6%)');
  near(s0.normalDps, 167.4866, 0.05, '凛视 常态仅法术(天赋损伤为模式限定不计)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 278.091, 0.05, '凛视 S1 我见崩毁之前 法术 110%');
  near(s1.dmgTypes.element.cycleDps, 363.6364, 0.05, '凛视 S1 元素(附带 60% 凋亡损伤)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 16550.58, 0.5, '凛视 S2 我见枯朽之后 总伤(攻速+40,每击附 30% 凋亡损伤)');
  const x3 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_threye', 3)));
  near(calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_threye', 3))).panelAtk, 564.99, 0.05, '凛视 X3 面板(模组 atk +32;隐居者 te → +11%)');
}
// ---- 伯塔尼(侵蚀损伤;天赋攻速按满层) ----
{
  const o = loadOp('char_4223_botany');
  const s0 = calculateOperator(o, mk(o, -1));
  near(s0.realInterval, 1.3559, 0.001, '伯塔尼 常态间隔(天赋背弃沉默 +6×3 层 = +18)');
  near(s0.normalDps, 184.7438, 0.05, '伯塔尼 常态法术 DPS(天赋不再附损伤)');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 225.45, 0.05, '伯塔尼 S1 谐波破坏 法术 90%(条件类额外伤害不计)');
  near(s1.dmgTypes.element.cycleDps, 227.2727, 0.05, '伯塔尼 S1 元素(附带 90% 侵蚀损伤)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 21639.6, 0.5, '伯塔尼 S2 静域回声 总伤(法术 5511 + 物理 1128.6 + 元素 15000)');
  near(s2.dmgTypes.physical.skillTotalDamage, 1128.6, 0.5, '伯塔尼 S2 额外物理(每次攻击额外 130%×攻击力)');
  const x3 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_botany', 3)));
  near(x3.realInterval, 1.25, 0.001, '伯塔尼 X3 间隔(背弃沉默 te 7 × max_stack_cnt 4 = +28,按满层)');
}
// ---- 波卜(灼燃损伤;天赋 DOT 不计算) ----
{
  const o = loadOp('char_487_bobb');
  const s0 = calculateOperator(o, mk(o, -1));
  near(s0.normalDps, 151.875, 0.05, '波卜 常态仅法术(天赋焦点诱导损伤 DOT 不计算)');
  eq(s0.normalTypes.element, undefined, '波卜 常态无元素档');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 413.1, 0.05, '波卜 S1 非和平劝说 法术 170%');
  near(s1.dmgTypes.element.cycleDps, 318.1818, 0.05, '波卜 S1 元素(附带 110% 灼燃损伤)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillTotalDamage, 2940.3, 0.5, '波卜 S2 此路不通(停止攻击,每秒 110% 法术,无元素爆条)');
  const x3 = calculateOperator(o, mk(o, 1, mod(o, 'uniequip_002_bobb', 3)));
  near(x3.skillTotalDamage, 10266.67, 0.5, '波卜 X3 S2 总伤(灼燃爆条:7000 + 法术 3266.67)');
}
// ---- PhonoR-0(1★,无技能;落地点火:部署后 40s 附带 45 点凋亡损伤 + 法术/元素脆弱) ----
{
  const o = loadOp('char_4136_phonor');
  const r = calculateOperator(o, mk(o, -1));
  eq(r.deploySkill, true, 'PhonoR-0 走落地点火(部署后 40s 窗口)');
  near(r.normalDps, 73.4375, 0.05, 'PhonoR-0 常态法术 DPS(窗口外)');
  near(r.skillTotalDamage, 15385.625, 0.5, 'PhonoR-0 窗口总伤(法术 3025.625 + 元素 12360)');
  near(r.dmgTypes.element.skillTotalDamage, 12360, 0.5, 'PhonoR-0 元素(45 点/次 × 25 次 → 1 次爆条 12000,元素脆弱 +3%)');
}
// ---- 酒神召唤物(2 个,附属单位) ----
{
  const enc = loadOp('token_10054_phatm2_encdool');
  const cage = loadOp('token_10055_phatm2_mndclv');
  eq(enc.ownerOperatorId, 'char_1042_phatm2', '本能的召唤 归属酒神');
  eq(cage.ownerOperatorId, 'char_1042_phatm2', '迷狂牢笼 归属酒神');
  const r = calculateOperator(enc, mk(enc, 0), ownerCtx(phatm));
  near(r.skillTotalDamage, 10134, 0.5, '本能的召唤 窗口总伤(酒神面板 530:法术 689×12 + 元素 6000)');
  near(r.skillDps, 1689, 0.5, '本能的召唤 6s 窗口 DPS');
  const c = calculateOperator(cage, mk(cage, 0), ownerCtx(phatm));
  near(c.skillTotalDamage, 0, 0.001, '迷狂牢笼 无输出(阻挡物)');
  near(calculateOperator(cage, mk(cage, -1)).normalDps, 0, 0.001, '迷狂牢笼 常态 0');
  const idxEntry = IDX.find((x) => x.id === 'token_10054_phatm2_encdool');
  eq(idxEntry && idxEntry.ownerName, '酒神', 'index 中本能的召唤 ownerName=酒神');
}
// ---- 敌人类型:精英/领袖下模组特性「造成的元素损伤提升 18%」计入(损伤累积端) ----
{
  const o = loadOp('char_1042_phatm2');
  state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'elite' };
  const elite = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_phatm2', 3)));
  near(elite.normalDps, 544.6037, 0.05, '酒神 X3 常态(精英:损伤×1.18 → 爆条更快)');
  state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
  const normal = calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_phatm2', 3)));
  near(normal.normalDps, 512.0833, 0.05, '酒神 X3 常态(普通:不享受精英/领袖提升)');
  const bobb = loadOp('char_487_bobb');
  state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'elite' };
  const bobbElite = calculateOperator(bobb, mk(bobb, 1, mod(bobb, 'uniequip_002_bobb', 3)));
  near(bobbElite.skillDps, 943.7536, 0.5, '波卜 X3 S2(精英:损伤×1.18 → 灼燃爆条更密,法抗窗口收益提高)');
  state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
  near(calculateOperator(bobb, mk(bobb, 1, mod(bobb, 'uniequip_002_bobb', 3))).skillDps, 933.3336, 0.5, '波卜 X3 S2(普通)');
}

// ---- 说明文本 ----
{
  const notes = JSON.parse(fs.readFileSync(DATA + '/notes.json', 'utf8'));
  eq(typeof notes['__subprof_ritualist'], 'string', '巫役通用说明已登记');
  eq(typeof notes['char_487_bobb'], 'string', '波卜说明已登记');
  eq(typeof notes['char_1042_phatm2'], 'string', '酒神说明已登记');
  eq(typeof notes['char_4223_botany'], 'string', '伯塔尼说明已登记');
}
console.log('巫役: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
