// 链术师(chain)引擎断言:
//  - 特性「攻击在 N 个敌人间跳跃,每次跳跃伤害降低」:单目标模型只计首个目标(跳跃/多目标不计)
//  - 异客:孤卒(周围4格无敌人,远程位默认成立)+8%/10%;机理分析(敌方血量条件)不计;
//    S1 电能之触(AUTO 下次攻击强化,cycleDps 口径)、S2 聚焦指令(间隔 -40% 百分比)、S3 辉煌裂片(4s 雷暴 8 跳 + 充能)
//  - 星源:科研热忱(站场叠攻速,默认满层)、Y 模组改 10s/6~7 层后仍按满层;S1 双端导流(AUTO)
//  - 惊蛰:通流无阻(攻击未被阻挡的敌人)默认不计;S1/S2 纯加攻
//  - 布丁:电磁波 +8%/10%(Y 模组同名 te 覆盖 13%/16%);S1 攻速、S2 加攻
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const idx = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
const byId = {};
for (const e of idx) byId[e.id] = e;

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) pass++; else { fail++; console.log('FAIL: ' + name + (extra ? ' => ' + extra : '')); } };
const near = (a, b, tol = 0.02) => a !== null && a !== undefined && Math.abs(a - b) <= tol;
const A = (atk, res = 50) => atk * (1 - res / 100);

const load = (id) => {
  const e = byId[id];
  return JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8'));
};
const mk = (o, si, module = null) => {
  const elite = o.phases.length - 1;
  return { elite, level: o.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module };
};
const MOD = (o, moduleId, lv) => ({ moduleId, moduleLevel: lv });

// ============ 异客 ============
{
  const o = load('char_472_pasngr');
  const r0 = calculateOperator(o, mk(o, -1));
  // 面板 = 689+85信赖 = 774;「孤卒」「机理分析」均为条件型,用户口径默认不生效 → 无天赋加攻
  check('异客 常态 = A(774)/2.3(孤卒/机理分析均不计)', near(r0.normalDps, A(774) / 2.3), `got ${r0.normalDps}`);
  check('异客 面板不含天赋加攻', near(r0.panelAtk, 774, 0.05), `got ${r0.panelAtk}`);
  const r1 = calculateOperator(o, mk(o, 0));
  check('异客 S1(AUTO) 强化击 = A(面板×220%)', near(r1.skillTotalDamage, A(774 * 2.2)), `got ${r1.skillTotalDamage}`);
  check('异客 S1 cycleDps = (2 次普攻 + 强化击)/6s', near(r1.cycleDps, (2 * A(774) + A(774 * 2.2)) / 6, 0.05), `got ${r1.cycleDps}`);
  const r2 = calculateOperator(o, mk(o, 1));
  check('异客 S2 间隔 = 2.3×(1-0.4) = 1.38(官方"缩短-40%"百分比口径)', near(r2.realInterval, 1.38, 0.001), `got ${r2.realInterval}`);
  check('异客 S2 每击 = A(面板×1.25) 且 32s 内 23 击', near(r2.skillTotalDamage, 23 * A(774 * 1.25)), `got ${r2.skillTotalDamage}`);
  check('异客 S2 常态行 = 无技能态', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);
  const r3 = calculateOperator(o, mk(o, 2));
  check('异客 S3 雷暴 4s/0.5s = 8 跳,每跳 A(面板×135%)', near(r3.skillTotalDamage, 8 * A(774 * 1.35)), `got ${r3.skillTotalDamage}`);
  check('异客 S3 技能期 DPS = 雷暴总伤/4s(本体攻击独立并行)', near(r3.skillDps, 8 * A(774 * 1.35) / 4, 0.05), `got ${r3.skillDps}`);
  check('异客 S3 常态行 = 无技能态(雷暴期间照常普攻)', near(r3.normalDps, r0.normalDps), `got ${r3.normalDps}`);
  // X 模组:te 只写技力回复,且孤卒按用户口径不计 → 面板只加模组属性
  const r0x = calculateOperator(o, mk(o, -1, MOD(o, 'uniequip_002_pasngr', 2)));
  check('异客 X模组 L2 面板 = 774+80(孤卒不计)', near(r0x.panelAtk, 689 + 85 + 80, 0.05), `got ${r0x.panelAtk}`);
}

// ============ 星源 ============
{
  const o = load('char_135_halo');
  const r0 = calculateOperator(o, mk(o, -1));
  // 面板 = 630+75信赖 = 705;科研热忱 E2 每 15s +4 攻速 × 5 层 = +20 → 间隔 2.3/(1.2) = 1.9167
  check('星源 常驻攻速含科研热忱满层(+20)', near(r0.realInterval, 2.3 * 100 / 120, 0.001), `got ${r0.realInterval}`);
  check('星源 常态 = A(705)/1.9167', near(r0.normalDps, A(705) / (2.3 * 100 / 120)), `got ${r0.normalDps}`);
  const r1 = calculateOperator(o, mk(o, 0));
  check('星源 S1(AUTO) 强化击 = A(面板×115%)', near(r1.skillTotalDamage, A(705 * 1.15)), `got ${r1.skillTotalDamage}`);
  check('星源 S1 cycleDps = (4 次普攻 + 强化击)/8s', near(r1.cycleDps, (4 * A(705) + A(705 * 1.15)) / 8, 0.05), `got ${r1.cycleDps}`);
  const r2 = calculateOperator(o, mk(o, 1));
  check('星源 S2 每击 = A(面板×1.3) 且 25s 内 13 击', near(r2.skillTotalDamage, 13 * A(705 * 1.3)), `got ${r2.skillTotalDamage}`);
  check('星源 S2 常态行 = 无技能态', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);
  // Y 模组:科研热忱 15s/5层 → 10s/6层(L2)/7层(L3),仍按满层 ×4
  const r2y = calculateOperator(o, mk(o, -1, MOD(o, 'uniequip_002_halo', 2)));
  check('星源 Y模组 L2 科研热忱 6 层 ×4 = +24', near(r2y.realInterval, 2.3 * 100 / 124, 0.001), `got ${r2y.realInterval}`);
  const r3y = calculateOperator(o, mk(o, -1, MOD(o, 'uniequip_002_halo', 3)));
  check('星源 Y模组 L3 科研热忱 7 层 ×4 = +28', near(r3y.realInterval, 2.3 * 100 / 128, 0.001), `got ${r3y.realInterval}`);
}

// ============ 惊蛰 ============
{
  const o = load('char_306_leizi');
  const r0 = calculateOperator(o, mk(o, -1));
  // 通流无阻(攻击未被阻挡的敌人时+10%/20%)为敌方状态条件 → 默认不计
  check('惊蛰 常态 = A(635+75)/2.3(通流无阻不计)', near(r0.normalDps, A(710) / 2.3), `got ${r0.normalDps}`);
  check('惊蛰 面板不含通流无阻(×1.2)', near(r0.panelAtk, 710, 0.05), `got ${r0.panelAtk}`);
  const r1 = calculateOperator(o, mk(o, 0));
  check('惊蛰 S1 每击 = A(面板×1.75) 且 30s 内 13 击', near(r1.skillTotalDamage, 13 * A(710 * 1.75)), `got ${r1.skillTotalDamage}`);
  const r2 = calculateOperator(o, mk(o, 1));
  check('惊蛰 S2 每击 = A(面板×2.15) 且 33s 内 14 击', near(r2.skillTotalDamage, 14 * A(710 * 2.15)), `got ${r2.skillTotalDamage}`);
  check('惊蛰 S2 常态行 = 无技能态', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);
}

// ============ 布丁 ============
{
  const o = load('char_4004_pudd');
  const r0 = calculateOperator(o, mk(o, -1));
  // 面板 = (542+70信赖) × 1.1(电磁波 +10%)
  check('布丁 常态 = A(612×1.1)/2.3(电磁波 +10%)', near(r0.normalDps, A(612 * 1.1) / 2.3), `got ${r0.normalDps}`);
  const r1 = calculateOperator(o, mk(o, 0));
  check('布丁 S1 间隔 = 2.3/(1+0.55) = 1.4839', near(r1.realInterval, 2.3 * 100 / 155, 0.001), `got ${r1.realInterval}`);
  check('布丁 S1 每击 A(面板×1.1)', near(r1.skillTotalDamage, Math.floor(25 / (2.3 * 100 / 155)) * A(612 * 1.1)), `got ${r1.skillTotalDamage}`);
  const r2 = calculateOperator(o, mk(o, 1));
  check('布丁 S2 每击 = A(612×(1+0.1+0.9)) 且 20s 内 8 击', near(r2.skillTotalDamage, 8 * A(1224)), `got ${r2.skillTotalDamage}`);
  check('布丁 S2 常态行 = 无技能态', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);
  // Y 模组:电磁波同名 te 覆盖为 +13%/+16%
  // Y 模组 attr 附带攻击速度 +5 → 间隔 2.3×100/105
  const r2y = calculateOperator(o, mk(o, -1, MOD(o, 'uniequip_002_pudd', 2)));
  check('布丁 Y模组 L2 电磁波 → +13%', near(r2y.normalDps, A(612 * 1.13) / (2.3 * 100 / 105)), `got ${r2y.normalDps}`);
  const r3y = calculateOperator(o, mk(o, -1, MOD(o, 'uniequip_002_pudd', 3)));
  check('布丁 Y模组 L3 电磁波 → +16%', near(r3y.normalDps, A(612 * 1.16) / (2.3 * 100 / 105)), `got ${r3y.normalDps}`);
}

console.log(`${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
