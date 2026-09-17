// 工匠(craftsman,辅助)验证:精二满级/满信赖/潜0/专一(技能等级 7),敌 hp50000 atk800 def600 res50
// 用户口径(2026-09-18):装置一般默认不放置(即干员不享受装置增幅) → 天赋/技能里给装置的增益一律不计;
// 工匠的召唤物(10 个装置)各自独立成条,不攻击不治疗 → 输出全 0。
// 引擎侧:白铁 S1 attack@atk_scale 作每击倍率改写(ATK_SCALE_REWRITE);
// 娜斯提 S2 / 凯瑟琳 S2 / 罗比菈塔 S2 停止攻击(STOP_ATTACK_SKILLS);掠风 S2 攻击间隔增大 0.5s(BAT_ADD_OVERRIDES);
// 凯瑟琳 S1 是被动技能,用非标准键名 s1_atk/s1_def(装置默认不放置 → 只计自身,PASSIVE_ATTR_KEYS)。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const IDX = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
function loadOp(id) { const e = IDX.find((x) => x.id === id); return JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8')); }
function mk(op, si, module) { const elite = op.phases.length - 1; return { elite, level: op.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module }; }
function mod(op, id, level) { return { moduleId: id, moduleLevel: level }; }
let pass = 0, fail = 0;
const near = (a, e, tol, label) => { if (typeof a !== 'number' || Math.abs(a - e) > tol) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); } else pass++; };
const eq = (a, e, label) => { if (a !== e) { fail++; console.log('  FAIL ' + label + ': ' + a + ' != ' + e); } else pass++; };

// ---- 白铁 ----
{
  const o = loadOp('char_4072_ironmn');
  const r0 = calculateOperator(o, mk(o, -1));
  near(r0.panelAtk, 633, 0.01, '白铁 面板攻击力 633');
  near(r0.normalDps, 22, 0.01, '白铁 常态物理 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillDps, 359.6, 0.01, '白铁 S1 DPS(每击 180% 攻击力改写;装置 fake_scale 不计)');
  near(s1.skillTotalDamage, 6472.8, 0.5, '白铁 S1 总伤(18s 12 击)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillDps, 211.9, 0.01, '白铁 S2 DPS(攻击力+45%,攻击所有阻挡敌人按单目标)');
  near(s2.skillTotalDamage, 6357, 0.5, '白铁 S2 总伤(30s 20 击)');
  const s3 = calculateOperator(o, mk(o, 2));
  near(s3.skillDps, 296.66, 0.01, '白铁 S3 DPS(攻击力+45%,攻速+45)');
  near(s3.skillTotalDamage, 8899.8, 0.5, '白铁 S3 总伤');
  const x3s1 = calculateOperator(o, mk(o, 0, mod(o, 'uniequip_002_ironmn', 3)));
  near(x3s1.panelAtk, 1220.4, 0.05, '白铁 X3 S1 技能期攻击力(模组 atk+45,攻击力+60% 后 ×1.8)');
  near(x3s1.skillDps, 413.6, 0.01, '白铁 X3 S1 DPS');
  near(calculateOperator(o, mk(o, -1, mod(o, 'uniequip_002_ironmn', 3))).normalDps, 54.6, 0.01, '白铁 X3 常态 DPS(含模组攻速+5)');
}
// ---- 娜斯提 ----
{
  const o = loadOp('char_4212_nasti');
  near(calculateOperator(o, mk(o, -1)).panelAtk, 614, 0.01, '娜斯提 面板攻击力 614');
  near(calculateOperator(o, mk(o, 0)).skillDps, 288.47, 0.01, '娜斯提 S1 DPS(攻击力+70%)');
  near(calculateOperator(o, mk(o, 0)).skillTotalDamage, 11538.8, 0.5, '娜斯提 S1 总伤(40s 26 击)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillDps, 0, 0.001, '娜斯提 S2 停止攻击 → 技能期伤害 0(屏障/技力不计)');
  near(calculateOperator(o, mk(o, 2)).skillDps, 582.4, 0.01, '娜斯提 S3 DPS(攻击力+140%)');
}
// ---- 凯瑟琳 ----
{
  const o = loadOp('char_4162_cathy');
  near(calculateOperator(o, mk(o, -1)).panelAtk, 590, 0.01, '凯瑟琳 面板攻击力 590');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.panelAtk, 660.8, 0.01, '凯瑟琳 S1(被动 s1_atk +12%)技能期攻击力');
  near(s1.normalDps, 40.5333, 0.01, '凯瑟琳 S1 常态 DPS(被动攻击力 +12% 计入)');
  near(calculateOperator(o, mk(o, 1)).skillDps, 0, 0.001, '凯瑟琳 S2 停止攻击 → 技能期伤害 0');
}
// ---- 阿兰娜 ----
{
  const o = loadOp('char_4178_alanna');
  near(calculateOperator(o, mk(o, -1)).normalDps, 20.3333, 0.01, '阿兰娜 常态物理 DPS');
  near(calculateOperator(o, mk(o, 0)).normalDps, 20.3333, 0.01, '阿兰娜 S1(被动)攻速+19 只作用于持有装置的干员 → 不计');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.skillDps, 248.4533, 0.01, '阿兰娜 S2 DPS(自身攻击力+42%,攻速+42)');
  near(s2.skillTotalDamage, 3726.8, 0.5, '阿兰娜 S2 总伤(15s)');
}
// ---- 掠风 ----
{
  const o = loadOp('char_433_windft');
  near(calculateOperator(o, mk(o, -1)).normalDps, 20.1667, 0.01, '掠风 常态物理 DPS');
  const s1 = calculateOperator(o, mk(o, 0));
  near(s1.skillTotalDamage, 670.5, 0.5, '掠风 S1 单次伤害(下次攻击 210% 攻击力)');
  near(s1.cycleDps, 113.0714, 0.01, '掠风 S1 循环 DPS(可充能 3 次)');
  const s2 = calculateOperator(o, mk(o, 1));
  near(s2.realInterval, 2, 0.001, '掠风 S2 攻击间隔增大 0.5s → 2.0s');
  near(s2.skillDps, 397.6, 0.01, '掠风 S2 DPS(攻击力+140%)');
  near(s2.skillTotalDamage, 5964, 0.5, '掠风 S2 总伤(15s 7 击)');
}
// ---- 罗比菈塔 ----
{
  const o = loadOp('char_484_robrta');
  near(calculateOperator(o, mk(o, -1)).normalDps, 19, 0.01, '罗比菈塔 常态物理 DPS');
  near(calculateOperator(o, mk(o, 0)).skillDps, 130.1143, 0.01, '罗比菈塔 S1 DPS(攻击力+40%)');
  near(calculateOperator(o, mk(o, 1)).skillDps, 0, 0.001, '罗比菈塔 S2 停止攻击 → 技能期伤害 0');
}
// ---- 装置类召唤物(10 个):输出全 0 ----
{
  const DEVICES = [
    'token_10027_ironmn_pile1', 'token_10027_ironmn_pile2', 'token_10027_ironmn_pile3',
    'token_10059_nasti_nstdef', 'token_10060_nasti_nstchr', 'token_10061_nasti_nstbld',
    'token_10041_cathy_catsld', 'token_10045_alanna_crane', 'token_10023_windft_wrench', 'token_10018_robrta_mach',
  ];
  for (const id of DEVICES) {
    const t = loadOp(id);
    const r = calculateOperator(t, mk(t, -1));
    near(r.normalDps, 0, 0.001, '装置 ' + t.name + ' 无输出(常态 DPS 0)');
    eq(r.normalHps, null, '装置 ' + t.name + ' 无治疗');
    eq((t.skills || []).length, 0, '装置 ' + t.name + ' 无自身技能');
    eq(t.ownerOperatorId !== null, true, '装置 ' + t.name + ' 归属持有者');
  }
}
// ---- 说明文本 ----
{
  const notes = JSON.parse(fs.readFileSync(DATA + '/notes.json', 'utf8'));
  eq(typeof notes['__subprof_craftsman'], 'string', '工匠子职业说明文本已登记');
}
console.log('工匠: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
