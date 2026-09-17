// 武者(musha/近卫)验证:精二满/满信赖/潜0/专一档/敌 def600 res50
// 口径(用户 2026-09-17):
//   - 坚忍类天赋(按已损失生命给攻速/防御/技回)默认满血 → 全部不触发(所有武者)
//   - 宴「冷血」攻击力增幅不触发(仅 X 模组新增);火龙S黑角「练气」攻击力增幅不触发
//   - 左乐「守正自明」技力回复不触发;左乐「破虏」默认仅攻击一次
//   - 火龙S黑角 S1 受击反击默认触发一次,技能期 DPS 按标注窗口 6s 摊
//   - 特性自回血(每次攻击回复 30/50/70 生命)非输出,不建模型
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.2) => Math.abs(a - b) <= tol;
const D = '../../src/frontend/data/WARRIOR/musha/';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (id, si, module = null) => {
  const op = JSON.parse(fs.readFileSync(new URL(D + id + '.json', import.meta.url), 'utf8'));
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module });
};

// ---- 火龙S黑角(练气不触发) ----
let r = run('char_1030_noirc2', -1);
ok(near(r.panelAtk, 766) && near(r.normalDps, 138.33), '火龙S黑角 常态 766/138.33 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_1030_noirc2', 0);
ok(near(r.skillTotalDamage, 1583.2) && near(r.skillDps, 263.87) && near(r.panelAtk, 995.8), '火龙S黑角 S1 居合(受击反击 4 段×130%,按 6s 摊)1583.2/263.87 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_1030_noirc2', 1);
ok(near(r.skillTotalDamage, 4379.2) && near(r.skillDps, 3128.0) && near(r.panelAtk, 1225.6), '火龙S黑角 S2 气刃兜割(7 段×160%,窗口 1.4s)4379.2/3128 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_1030_noirc2', -1, { moduleId: 'uniequip_002_noirc2', moduleLevel: 3 });
ok(near(r.panelAtk, 802) && near(r.realInterval, 1.2), '火龙S黑角 X3 练气不触发(仅模组白值 +36)802/1.2 实=' + r.panelAtk + '/' + r.realInterval);

// ---- 赫拉格(月盈星亏/运筹帷幄不建模) ----
r = run('char_188_helage', -1);
ok(near(r.normalDps, 193.33), '赫拉格 常态 193.33 实=' + r.normalDps);
r = run('char_188_helage', 0);
ok(near(r.skillTotalDamage, 1379.2) && near(r.cycleDps, 432.33) && near(r.skillDps, 0), '赫拉格 S1 新月(连续攻击两次)1379.2/循环 432.33 实=' + r.skillTotalDamage + '/' + r.cycleDps);
r = run('char_188_helage', 1);
ok(near(r.skillTotalDamage, 14624) && near(r.skillDps, 1218.67) && near(r.panelAtk, 1331.2), '赫拉格 S2 弦月(二连击×12s)14624 实=' + r.skillTotalDamage);
r = run('char_188_helage', 2);
ok(near(r.skillTotalDamage, 9873.6), '赫拉格 S3 满月(单目标口径)9873.6 实=' + r.skillTotalDamage);
r = run('char_188_helage', -1, { moduleId: 'uniequip_002_helage', moduleLevel: 3 });
ok(near(r.panelAtk, 922) && near(r.realInterval, 1.2), '赫拉格 X3 月盈星亏(+130 攻速)不触发 922/1.2 实=' + r.panelAtk + '/' + r.realInterval);

// ---- 宴(冷血不触发;S1 停攻;S2 落地限时被动转法术) ----
r = run('char_337_utage', -1);
ok(near(r.normalDps, 102.5), '宴 常态 102.5 实=' + r.normalDps);
r = run('char_337_utage', 0);
ok(near(r.skillTotalDamage, 0) && near(r.skillDps, 0) && near(r.normalDps, 102.5), '宴 S1 分神停止攻击(技能期 0,常态保留)实=' + r.skillTotalDamage + '/' + r.normalDps);
r = run('char_337_utage', 1);
ok(near(r.panelAtk, 1373.7) && near(r.skillTotalDamage, 8242.2) && near(r.skillDps, 549.48) && r.damageType === 'arts' && near(r.normalDps, 102.5),
  '宴 S2 落地斩(限时被动 15s,法术 atk+90%)8242.2/549.48/arts 实=' + r.skillTotalDamage + '/' + r.skillDps + '/' + r.damageType);
r = run('char_337_utage', -1, { moduleId: 'uniequip_002_utage', moduleLevel: 3 });
ok(near(r.panelAtk, 783), '宴 X3 冷血不触发(仅模组白值 +60)783 实=' + r.panelAtk);

// ---- 左乐(守正自明不触发;破虏仅一次;S3 末击加倍) ----
r = run('char_4121_zuole', -1);
ok(near(r.normalDps, 183.33), '左乐 常态 183.33 实=' + r.normalDps);
r = run('char_4121_zuole', 0);
ok(near(r.skillTotalDamage, 794) && near(r.cycleDps, 334.8), '左乐 S1 破虏(默认仅攻击一次)794/334.8 实=' + r.skillTotalDamage + '/' + r.cycleDps);
r = run('char_4121_zuole', 1);
ok(near(r.panelAtk, 2050) && near(r.skillTotalDamage, 14500), '左乐 S2 行险(单目标口径)14500 实=' + r.skillTotalDamage);
r = run('char_4121_zuole', 2);
ok(near(r.panelAtk, 1845) && near(r.skillTotalDamage, 10560) && near(r.cycleDps, 570.37), '左乐 S3 佑序有炎(6 段 225%+末击加倍)10560/570.37 实=' + r.skillTotalDamage + '/' + r.cycleDps);
r = run('char_4121_zuole', -1, { moduleId: 'uniequip_002_zuole', moduleLevel: 3 });
ok(near(r.panelAtk, 910) && near(r.realInterval, 1.2), '左乐 X3 秉烛照影(+70 攻速)不触发 910/1.2 实=' + r.panelAtk + '/' + r.realInterval);

// ---- 赤冬(信影流·羽飞不触发;S1 二连击) ----
r = run('char_475_akafyu', -1);
ok(near(r.normalDps, 131.67), '赤冬 常态 131.67 实=' + r.normalDps);
r = run('char_475_akafyu', 0);
ok(near(r.panelAtk, 1212.8) && near(r.skillTotalDamage, 12256) && near(r.skillDps, 1021.33), '赤冬 S1 雷刀之势(二连击×60%)12256 实=' + r.skillTotalDamage);
r = run('char_475_akafyu', 1);
ok(near(r.panelAtk, 1364.4) && near(r.skillTotalDamage, 12230.4), '赤冬 S2 十文字胜 12230.4 实=' + r.skillTotalDamage);
r = run('char_475_akafyu', -1, { moduleId: 'uniequip_002_akafyu', moduleLevel: 3 });
ok(near(r.panelAtk, 828) && near(r.realInterval, 1.2), '赤冬 X3 信影流·羽飞(+100 攻速)不触发 828/1.2 实=' + r.panelAtk + '/' + r.realInterval);

console.log('武者: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
