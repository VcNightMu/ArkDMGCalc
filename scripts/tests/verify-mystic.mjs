// 秘术师(mystic)引擎断言:
//  - 特性「找不到目标时储存攻击能量(最多3个)之后一齐发射」:持续打人模型恒有目标 → 不建模
//  - 普攻改写型一技能(黑键/和弦/爱丽丝/戴菲恩/深靛:间隔缩短 + 每次攻击 X% 攻击力法伤)
//  - 深靛 S1 间隔键 -0.8 按「缩短 80%」解释(×0.2 → 0.6s;卡涅利安 S2 同值仍为加算秒)
//  - 维伊:天赋「在挥刀之前」无转置能量取攻速档 +15;S2 逐击线性叠层;S3 弹药;天赋2「战争技艺」固定 DOT
//  - 和弦 S2 水域固定 DOT / 戴菲恩 S2 比例 DOT / 爱丽丝·黑键一次性爆发
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
  const p = path.join(DATA, e.profession, e.subProfessionId, id + '.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};
const mk = (o, si, module = null) => {
  const elite = o.phases.length - 1;
  return { elite, level: o.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module };
};
const X = (o, lv) => {
  const m = (o.modules || []).find(x => x.type === 'ADVANCED');
  return m ? { moduleId: m.id, moduleLevel: lv } : null;
};

// ============ 维伊:特性不建模 + 天赋攻速 + 天赋2 DOT + S2 线性叠层 + S3 弹药 ============
{
  const o = load('char_4226_veen');
  const r0 = calculateOperator(o, mk(o, -1));
  // 面板间隔 3.0/(1+0.15 天赋攻速) = 2.6087;常态普攻 = A(1510)/2.6087 + 天赋2 DOT(90×3=270 → A=135)
  check('维伊 常态含天赋2 DOT(90×3层)', near(r0.normalDps, A(1510) / 2.608695652173913 + A(270)), `got ${r0.normalDps}`);
  check('维伊 面板攻速含天赋「在挥刀之前」+15(间隔 2.6087)', near(r0.realInterval, 2.608695652173913, 0.001), `got ${r0.realInterval}`);
  const r1 = calculateOperator(o, mk(o, 0));
  check('维伊 S1 间隔 = 3.0/(1+0.15+0.8) = 1.5385', near(r1.realInterval, 1.5384615384615, 0.001), `got ${r1.realInterval}`);
  check('维伊 S1 总伤 = 11击×A(1510) + DOT×18', near(r1.skillTotalDamage, 11 * A(1510) + A(270) * 18), `got ${r1.skillTotalDamage}`);
  check('维伊 S1 常态行 = 无技能态', near(r1.normalDps, r0.normalDps), `got ${r1.normalDps}`);
  const r2 = calculateOperator(o, mk(o, 1));
  // S2:2.5s 基础上叠层(每击 atk+13%、攻速+7,至多9层,逐击重算间隔) → 17 击 + DOT×28
  check('维伊 S2 总伤 = 逐击叠层 23435.2 + DOT×28', near(r2.skillTotalDamage, 23435.2 + A(270) * 28, 0.5), `got ${r2.skillTotalDamage}`);
  check('维伊 S2 技能期 DPS = 总伤/28', near(r2.skillDps, (23435.2 + A(270) * 28) / 28, 0.05), `got ${r2.skillDps}`);
  check('维伊 S2 常态行 = 无技能态', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);
  const r3 = calculateOperator(o, mk(o, 2));
  check('维伊 S3 弹药 24 发:总伤 = 24×A(1510) + DOT×24×间隔', near(r3.skillTotalDamage, 24 * A(1510) + A(270) * 24 * (3 / 2.65), 0.5), `got ${r3.skillTotalDamage}`);
  check('维伊 S3 发射即耗弹 → 常态行 null', r3.normalDps === null, `got ${r3.normalDps}`);
  // 模组 Y L2/L3:天赋2 DOT 经同名 te 强化为 100×4 / 120×4
  const r0b = calculateOperator(o, mk(o, -1, X(o, 2)));
  check('维伊 模组Y L2 DOT 100×4层 → 常态 = 310.883+200', near(r0b.normalDps, A(1622) / 2.608695652173913 + A(400)), `got ${r0b.normalDps}`);
  const r0c = calculateOperator(o, mk(o, -1, X(o, 3)));
  check('维伊 模组Y L3 DOT 120×4层 → 常态 = 312.417+240', near(r0c.normalDps, A(1630) / 2.608695652173913 + A(480)), `got ${r0c.normalDps}`);
  // 模组 te 的「拥有储存能量时攻速+30」为条件型 → 不生效(间隔仍 2.6087)
  check('维伊 模组 te 条件型攻速+30 不计(间隔仍 2.6087)', near(r0c.realInterval, 2.608695652173913, 0.001), `got ${r0c.realInterval}`);
}

// ============ 黑键:天赋不建模(储存类/孤立条件) + S1 每击倍率 + S2 残影 1 个 + S3 攻速/加攻 ============
{
  const o = load('char_4046_ebnhlz');
  const r0 = calculateOperator(o, mk(o, -1));
  check('黑键 常态 = A(1550)/3.0(无天赋常态加成)', near(r0.normalDps, A(1550) / 3), `got ${r0.normalDps}`);
  const r1 = calculateOperator(o, mk(o, 0));
  check('黑键 S1 间隔 = 3.0×0.17 = 0.51', near(r1.realInterval, 0.51, 0.001), `got ${r1.realInterval}`);
  check('黑键 S1 每击 = A(1550×0.43) 且 5s 内 9 击', near(r1.skillTotalDamage, Math.floor(5 / 0.51) * A(1550 * 0.43)), `got ${r1.skillTotalDamage}`);
  check('黑键 S1 常态行 = 无技能态', near(r1.normalDps, r0.normalDps), `got ${r1.normalDps}`);
  const r2 = calculateOperator(o, mk(o, 1));
  check('黑键 S2 残影 1 个(能量+1,本模型无能量)= atk_scale×面板 单发', near(r2.skillTotalDamage, A(1550 * 2.15)), `got ${r2.skillTotalDamage}`);
  check('黑键 S2 瞬间触发 → 常态行 = 无技能态', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);
  const r3 = calculateOperator(o, mk(o, 2));
  check('黑键 S3 攻击力+55% → 每击 A(1550×1.55)', near(r3.skillTotalDamage, Math.floor(30 / (3 / 1.7)) * A(1550 * 1.55)), `got ${r3.skillTotalDamage}`);
  check('黑键 S3 天赋「倚音」孤立条件不计(仍 1.55 倍)', near(r3.skillTotalDamage, Math.floor(30 / (3 / 1.7)) * A(1550 * 1.55)), `got ${r3.skillTotalDamage}`);
}

// ============ 戴菲恩:S1 每击倍率 + S2 比例 DOT(6%×4层) ============
{
  const o = load('char_4110_delphn');
  const r0 = calculateOperator(o, mk(o, -1));
  check('戴菲恩 常态 = A(1370)/3.0', near(r0.normalDps, A(1370) / 3), `got ${r0.normalDps}`);
  const r1 = calculateOperator(o, mk(o, 0));
  check('戴菲恩 S1 间隔 0.6 + 每击 A(1370×0.43)', near(r1.skillTotalDamage, Math.floor(5 / 0.6) * A(1370 * 0.43)), `got ${r1.skillTotalDamage}`);
  const r2 = calculateOperator(o, mk(o, 1));
  check('戴菲恩 S2 常态攻击(A(2397.5)×10击) + DOT(24%×攻击力/秒×30s)', near(r2.skillTotalDamage, Math.floor(30 / 3) * A(2397.5) + A(2397.5 * 0.24) * 30), `got ${r2.skillTotalDamage}`);
  check('戴菲恩 S2 常态行 = 无技能态(DOT 只进技能期)', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);
  check('戴菲恩 S2 技能期 DPS 含 DOT', near(r2.skillDps, (Math.floor(30 / 3) * A(2397.5) + A(2397.5 * 0.24) * 30) / 30, 0.02), `got ${r2.skillDps}`);
}

// ============ 和弦:S1 每击倍率 + S2 水域固定 DOT(200/秒) ============
{
  const o = load('char_297_hamoni');
  const r0 = calculateOperator(o, mk(o, -1));
  check('和弦 常态 = A(1375)/3.0(天赋「不期而至」需目标被阻挡 → 不计)', near(r0.normalDps, A(1375) / 3), `got ${r0.normalDps}`);
  const r1 = calculateOperator(o, mk(o, 0));
  check('和弦 S1 间隔 0.6 + 每击 A(1375×0.43)', near(r1.skillTotalDamage, Math.floor(5 / 0.6) * A(1375 * 0.43)), `got ${r1.skillTotalDamage}`);
  const r2 = calculateOperator(o, mk(o, 1));
  check('和弦 S2 间隔 = 3.0×0.65 = 1.95', near(r2.realInterval, 1.95, 0.001), `got ${r2.realInterval}`);
  check('和弦 S2 常态攻击 + 水域 DOT(200/秒×30s)', near(r2.skillTotalDamage, Math.floor(30 / 1.95) * A(1375) + A(200) * 30), `got ${r2.skillTotalDamage}`);
  check('和弦 S2 常态行 = 无技能态', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);
}

// ============ 爱丽丝:S1 每击倍率 + S2 一次性爆发(250%) ============
{
  const o = load('char_338_iris');
  const r0 = calculateOperator(o, mk(o, -1));
  check('爱丽丝 常态 = A(1389)/3.0(天赋「封印的宝盒」是储存能量增伤 → 不计)', near(r0.normalDps, A(1389) / 3), `got ${r0.normalDps}`);
  const r1 = calculateOperator(o, mk(o, 0));
  check('爱丽丝 S1 间隔 0.6 + 每击 A(1389×0.43)', near(r1.skillTotalDamage, Math.floor(5 / 0.6) * A(1389 * 0.43)), `got ${r1.skillTotalDamage}`);
  const r2 = calculateOperator(o, mk(o, 1));
  check('爱丽丝 S2 一次性 250%×面板(沉睡 7s 不计)', near(r2.skillTotalDamage, A(1389 * 2.5)), `got ${r2.skillTotalDamage}`);
  check('爱丽丝 S2 dur 0 → 常态行按无技能态展示', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);
}

// ============ 深靛:S1 间隔键 -0.8 按 -80% 解释 + S2 间隔 ×0.65 ============
{
  const o = load('char_469_indigo');
  const r0 = calculateOperator(o, mk(o, -1));
  check('深靛 常态 = A(1216)/3.0(天赋「柔光缚目」概率束缚 → 不计)', near(r0.normalDps, A(1216) / 3), `got ${r0.normalDps}`);
  const r1 = calculateOperator(o, mk(o, 0));
  check('深靛 S1 间隔 -80% → 3.0×0.2 = 0.6', near(r1.realInterval, 0.6, 0.001), `got ${r1.realInterval}`);
  check('深靛 S1 每击 A(1216×0.43) 且 4s 内 6 击', near(r1.skillTotalDamage, Math.floor(4 / 0.6) * A(1216 * 0.43)), `got ${r1.skillTotalDamage}`);
  const r2 = calculateOperator(o, mk(o, 1));
  check('深靛 S2 间隔 = 3.0×0.65 = 1.95(天赋束缚 DOT 依赖概率 → 不计)', near(r2.realInterval, 1.95, 0.001), `got ${r2.realInterval}`);
  check('深靛 S2 总伤 = 10击×A(1216)', near(r2.skillTotalDamage, Math.floor(20 / 1.95) * A(1216)), `got ${r2.skillTotalDamage}`);
}

// ============ 对照:卡涅利安 S2 同键值 -0.8 仍按加算秒(1.2s),不受深靛白名单影响 ============
{
  const o = load('char_426_billro');
  const r = calculateOperator(o, mk(o, 1));
  check('卡涅利安 S2 间隔 = 2.0-0.8 = 1.2(加算秒,不随深靛改成百分比)', near(r.realInterval, 1.2, 0.001), `got ${r.realInterval}`);
}

console.log(`${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
