// 解放者(librator/近卫)验证:精二满/满信赖/潜0/专一档/敌 def600 res50
// 口径(用户 2026-09-17 事先给定 + 问答确认):
//   - 所有解放者:技能期默认攻击力叠满(特性「技能未开启时攻击力逐渐提升至最高+200%」→ 技能期按 +200%,面板 ×3)
//   - 常态(无技能):特性「通常不攻击且阻挡数为 0」→ 常态 DPS 记 0(问答确认;司霆惊蛰的明断落雷也不进常态)
//   - 龙舌兰:天赋「伺机而动」反伤默认不触发;技能「剑走偏锋」默认蓄力(同时 3 名、持续 30s)
//   - 司霆惊蛰:天赋「明断」等效为每秒造成原伤害 10% 的伤害(S2 正霆摄威期间按秒实时结算、该秒取当时已叠层数);
//     「正霆摄威」的攻击力增加默认每次攻击一层(第 k 击含 k 层)
//     + 问答确认:「追责」开技能落雷算(每次开技能 1 击 100% 法术);S1 三方向斩击单目标只算 1 击;
//       S3 天地通明的电流每 0.6s 独立结算一次(与本体普攻/攻击次数无关)→ 次数 = floor(dur / 0.6)
//   - 骋风:天赋「藏锋伺敌」追加攻击默认生效(特性叠满时每次攻击追加一次 40%/52% 攻击力攻击;不享受技能攻击力倍率)
//   - 玛恩纳:天赋「游侠」默认仅基础档(攻击力提升至 110%/X 模组 120%);「无动于衷」反伤不触发;
//     技能「未照耀的荣光」默认不击倒任何敌人(特性倍率不衰减) + 问答确认「特性提升至2倍」按 +400%(面板 ×5)
//   - 「攻击力提升至 X%」型天赋(游侠/明断)按独立乘区:atk = 面板 × (1 + 特性加算池) × 天赋倍率(用户口径 2026-09-17)
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const D = '../../src/frontend/data/WARRIOR/librator/';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (id, si, module = null) => {
  const op = JSON.parse(fs.readFileSync(new URL(D + id + '.json', import.meta.url), 'utf8'));
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module });
};

// ---- 司霆惊蛰(特性叠满 + 明断落雷等效 + 追责 + 三技能) ----
let r = run('char_1043_leizi2', -1);
ok(near(r.panelAtk, 390) && r.normalDps === 0, '司霆惊蛰 常态 390/0 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_1043_leizi2', 0);
ok(near(r.skillTotalDamage, 3969.435) && near(r.cycleDps, 305.341) && r.skillDps === 0 && r.normalDps === 0 && near(r.panelAtk, 3943.485)
  && near(r.dmgTypes.arts.skillTotalDamage, 625.95) && near(r.dmgTypes.physical.skillTotalDamage, 3343.485),
  '司霆惊蛰 S1 浩气长存(1 击 315% + 追责 100% 法术;触发型给总伤+循环 DPS)3969.435/305.341 实=' + r.skillTotalDamage + '/' + r.cycleDps);
r = run('char_1043_leizi2', 1);
ok(near(r.skillTotalDamage, 59210.9325) && near(r.skillDps, 1644.748) && near(r.panelAtk, 1627.47) && near(r.dmgTypes.arts.skillTotalDamage, 3974.7825),
  '司霆惊蛰 S2 正霆摄威(每击 130%、每次攻击 +10% 叠 25 层 + 明断落雷按秒实时结算含叠层 + 追责)59210.9325/1644.748 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_1043_leizi2', 2);
ok(near(r.realInterval, 2.9) && near(r.skillTotalDamage, 38390.55) && near(r.skillDps, 1599.606) && near(r.dmgTypes.arts.skillTotalDamage, 17151.03),
  '司霆惊蛰 S3 天地通明(间隔 +1.7→2.9s,每击 260% + 电流 40 次×60% 法术)38390.55/1599.606 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_1043_leizi2', -1, { moduleId: 'uniequip_002_leizi2', moduleLevel: 3 });
ok(near(r.panelAtk, 432) && r.normalDps === 0, '司霆惊蛰 X3 常态(仅模组白值)432/0 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_1043_leizi2', 1, { moduleId: 'uniequip_002_leizi2', moduleLevel: 3 });
ok(near(r.skillTotalDamage, 72321.804) && near(r.dmgTypes.arts.skillTotalDamage, 4649.724),
  '司霆惊蛰 X3 S2(明断技能期 113%/落雷 100%,按秒实时结算)72321.804 实=' + r.skillTotalDamage);

// ---- 玛恩纳(特性叠满/游侠基础档;S2 二连击;S3 特性 ×2 + 光环真伤) ----
r = run('char_4064_mlynar', -1);
ok(near(r.panelAtk, 385) && r.normalDps === 0, '玛恩纳 常态 385/0 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_4064_mlynar', 0);
ok(near(r.panelAtk, 2286.9) && near(r.skillTotalDamage, 42172.5) && near(r.skillDps, 1405.75),
  '玛恩纳 S1 未声张的怒火(25 击 ×180%,面板 385×3×1.1)42172.5/1405.75 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4064_mlynar', 1);
ok(near(r.realInterval, 1.5) && near(r.skillTotalDamage, 40556.1) && near(r.skillDps, 2027.805),
  '玛恩纳 S2 未宽解的悲哀(间隔 +0.3→1.5s,二连击 170%)40556.1/2027.805 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4064_mlynar', 2);
ok(near(r.panelAtk, 3388) && near(r.skillTotalDamage, 66460.35) && near(r.skillDps, 2461.494) && near(r.dmgTypes.true.skillTotalDamage, 5124.35),
  '玛恩纳 S3 未照耀的荣光(特性 +400% → 面板 ×5×1.1,每击 160% ×22 + 光环 11% 真伤)66460.35/2461.494 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4064_mlynar', -1, { moduleId: 'uniequip_002_mlynar', moduleLevel: 3 });
ok(near(r.panelAtk, 420) && r.normalDps === 0, '玛恩纳 X3 常态(游侠基础档不额外进常态)420/0 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_4064_mlynar', 2, { moduleId: 'uniequip_002_mlynar', moduleLevel: 3 });
ok(near(r.panelAtk, 4032) && near(r.skillTotalDamage, 89020.8), '玛恩纳 X3 S3(游侠 120% 档)89020.8 实=' + r.skillTotalDamage);

// ---- 骋风(藏锋伺敌默认生效;S1 攻速;S2 2 目标 180%) ----
r = run('char_445_wscoot', -1);
ok(near(r.panelAtk, 320) && r.normalDps === 0, '骋风 常态 320/0 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_445_wscoot', 0);
ok(near(r.realInterval, 1.2 / 1.42) && near(r.skillTotalDamage, 6446.4) && near(r.skillDps, 429.76) && near(r.panelAtk, 960),
  '骋风 S1 以攻为守(攻速 +42,每击 = 攻击力 + 追加 40%)6446.4/429.76 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_445_wscoot', 1);
ok(near(r.panelAtk, 1728) && near(r.skillTotalDamage, 22944) && near(r.skillDps, 917.76),
  '骋风 S2 招无虚发(每击 180% + 追加 40% 不乘技能倍率)22944/917.76 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_445_wscoot', 0, { moduleId: 'uniequip_002_wscoot', moduleLevel: 3 });
ok(near(r.skillTotalDamage, 7695.492), '骋风 X3 S1(藏锋伺敌 40%→52%)7695.492 实=' + r.skillTotalDamage);

// ---- 龙舌兰(伺机而动不触发;S2 默认蓄力档) ----
r = run('char_486_takila', -1);
ok(near(r.panelAtk, 352) && r.normalDps === 0, '龙舌兰 常态 352/0 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_486_takila', 0);
ok(near(r.realInterval, 1.2 / 1.42) && near(r.panelAtk, 1636.8) && near(r.skillTotalDamage, 23846.4) && near(r.skillDps, 1192.32),
  '龙舌兰 S1 当机立断(攻速 +42,每击 155%)23846.4/1192.32 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_486_takila', 1);
ok(near(r.panelAtk, 2217.6) && near(r.skillTotalDamage, 40440) && near(r.skillDps, 1348),
  '龙舌兰 S2 剑走偏锋(蓄力档:3 目标、30s 窗口、每击 210%)40440/1348 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_486_takila', 1, { moduleId: 'uniequip_002_takila', moduleLevel: 3 });
ok(near(r.skillTotalDamage, 44377.5), '龙舌兰 X3 S2(仅模组白值)44377.5 实=' + r.skillTotalDamage);

console.log('解放者: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
