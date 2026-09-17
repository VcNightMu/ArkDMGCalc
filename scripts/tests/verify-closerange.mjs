// 重射手(closerange)验证:E2 满级 / 信赖 100 / 潜 0 / 专一档(L7 = levels[7])/ 敌 def600 res50。
// 口径来源(用户 2026-09-17 说明文本):黑天赋仅在 S3 计入;普罗旺斯狼眼默认满血;酸糖滑射技巧默认不在正前方两格(取下限基础档);
// 鸿雪打字机不生效、抑扬格概率增幅不计、锐笔速写默认不在正前方 3 格;玫拉参数校准常驻、临界爆发取衰减最低档;
// 焰狐龙梓兰两天赋增幅不计、刚射有充能立刻释放(不触发刚连射,按基础档)、龙之箭仅一次伤害。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { calcPhysicalDamage, calcArtsDamage } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const P = (atk, def = 600) => calcPhysicalDamage(atk, def);
const A = (atk) => calcArtsDamage(atk, 50);
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) pass++; else { fail++; console.log('FAIL: ' + name + (extra ? ' => ' + extra : '')); } };
const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
const floor = (a, b) => Math.floor(a / b + 1e-9);

const idx = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
const byId = {};
for (const e of idx) byId[e.id] = e;
const IP = {};
const load = (id) => {
  if (IP[id]) return IP[id];
  const e = byId[id];
  if (!e) throw new Error('缺干员索引 ' + id);
  const o = JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8'));
  const elite = o.phases.length - 1;
  IP[id] = { o, slot: { elite, level: o.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: -1, skillLevel: 7, module: null } };
  return IP[id];
};
const run = (id, si, module = null) => calculateOperator(load(id).o, { ...load(id).slot, skillIndex: si, module });
const L7 = (id, si) => { const lv = load(id).o.skills[si].levels; return lv[7] ?? lv[lv.length - 1]; };
const panel = (id) => run(id, -1).panelAtk;
const ids = ['char_340_shwaz', 'char_4055_bgsnow', 'char_1048_orchd2', 'char_145_prove', 'char_4006_melnte', 'char_366_acdrop'];
for (const id of ids) check('索引含重射手 ' + id, byId[id] && byId[id].subProfessionId === 'closerange');
check('重射手共 6 人', idx.filter((o) => o.subProfessionId === 'closerange').length === 6);

// ===== 黑:天赋仅在 S3 计入(攻击力 ×1.6、防御 -20%);S1/S2 天赋概率增幅不计 =====
{
  const a = panel('char_340_shwaz');
  check('黑 常态=面板 atk 普攻', near(run('char_340_shwaz', -1).normalDps, P(a) / 1.6));
  const s1 = run('char_340_shwaz', 0), s2 = run('char_340_shwaz', 1), s3 = run('char_340_shwaz', 2);
  check('黑 S1 单次=2.0×atk(天赋概率不计)', near(s1.skillTotalDamage, P(a * L7('char_340_shwaz', 0).atk_scale)), `got ${s1.skillTotalDamage}`);
  check('黑 S1 周期 DPS>0(攻击回复 sp4)', s1.cycleDps > 0);
  check('黑 S2 总伤=2.1×atk×击数(天赋不计)', near(s2.skillTotalDamage, P(a * (1 + L7('char_340_shwaz', 1).atk)) * floor(L7('char_340_shwaz', 1).skillDuration, 1.6)), `got ${s2.skillTotalDamage}`);
  check('黑 S3 间隔=1.6+0.4=2.0s(加算)', near(s3.realInterval, 2.0, 0.002), `got ${s3.realInterval}`);
  check('黑 S3 总伤=2.5×1.6×atk(防-20%)×击数', near(s3.skillTotalDamage, P(a * (1 + L7('char_340_shwaz', 2).atk) * 1.6, 480) * floor(L7('char_340_shwaz', 2).skillDuration, 2.0)), `got ${s3.skillTotalDamage}`);
}

// ===== 普罗旺斯:狼眼被动(默认满血 → 无增幅);狩猎箭头概率增幅不计 =====
{
  const a = panel('char_145_prove');
  const s1 = run('char_145_prove', 0), s2 = run('char_145_prove', 1);
  check('普罗旺斯 S1 狼眼默认满血 → 技能期无额外伤害', s1.skillTotalDamage === 0 && s1.skillDps === 0, `sTot=${s1.skillTotalDamage} sDps=${s1.skillDps}`);
  check('普罗旺斯 S2 总伤=2.8×atk×击数(狩猎箭头不计)', near(s2.skillTotalDamage, P(a * (1 + L7('char_145_prove', 1).atk)) * floor(L7('char_145_prove', 1).skillDuration, 1.6)), `got ${s2.skillTotalDamage}`);
}

// ===== 酸糖:滑射技巧下限 25%×攻击力(默认不在正前方两格,40% 档不计);S2 为 2 连射 =====
{
  const a = panel('char_366_acdrop');
  const s1 = run('char_366_acdrop', 0), s2 = run('char_366_acdrop', 1);
  const i1 = 1.6 / (1 + L7('char_366_acdrop', 0).attack_speed / 100);
  check('酸糖 S1 间隔=1.6/(1+56%)', near(s1.realInterval, i1, 0.002), `got ${s1.realInterval}`);
  check('酸糖 S1 总伤=max(普攻,25%atk)×击数', near(s1.skillTotalDamage, Math.max(P(a), 0.25 * a) * floor(L7('char_366_acdrop', 0).skillDuration, i1)), `got ${s1.skillTotalDamage}`);
  const atk2 = a * (1 + L7('char_366_acdrop', 1).atk);
  check('酸糖 S2 总伤=2连射×max(普攻,25%atk)×击数', near(s2.skillTotalDamage, Math.max(P(atk2), 0.25 * atk2) * 2 * floor(L7('char_366_acdrop', 1).skillDuration, 1.6)), `got ${s2.skillTotalDamage}`);
  check('酸糖 常态含下限(25%atk)', near(run('char_366_acdrop', -1).normalDps, Math.max(P(a), 0.25 * a) / 1.6), `got ${run('char_366_acdrop', -1).normalDps}`);
}

// ===== 鸿雪:抑扬格概率增幅不计(仅 atk+53%);点题 3 次攻击;锐笔速写取基础倍率(默认不在正前方3格) =====
{
  const a = panel('char_4055_bgsnow');
  const s1 = run('char_4055_bgsnow', 0), s2 = run('char_4055_bgsnow', 1), s3 = run('char_4055_bgsnow', 2);
  check('鸿雪 S1 抑扬格 DPS=(1+0.53)×atk/间隔(概率增幅不计)', near(s1.skillDps, P(a * (1 + L7('char_4055_bgsnow', 0).atk)) / 1.6), `got ${s1.skillDps}`);
  check('鸿雪 S2 点题总伤=3×2.1×atk', near(s2.skillTotalDamage, P(a * L7('char_4055_bgsnow', 1).atk_scale) * 3), `got ${s2.skillTotalDamage}`);
  check('鸿雪 S2 周期 DPS>0', s2.cycleDps > 0);
  check('鸿雪 S3 间隔=1.6-0.6=1.0s', near(s3.realInterval, 1.0, 0.002));
  check('鸿雪 S3 总伤=1.8×atk×击数(默认不在正前方3格)', near(s3.skillTotalDamage, P(a * L7('char_4055_bgsnow', 2).atk_scale) * floor(L7('char_4055_bgsnow', 2).skillDuration, 1.0)), `got ${s3.skillTotalDamage}`);
}

// ===== 玫拉:参数校准技能期伤害 ×1.15 默认常驻;临界爆发取衰减最低档 =====
{
  const a = panel('char_4006_melnte');
  const s1 = run('char_4006_melnte', 0), s2 = run('char_4006_melnte', 1);
  const dm = 1.15;   // E2 潜0「参数校准」damage_scale
  check('玫拉 S1 间隔=1.6+0.8=2.4s(加算)', near(s1.realInterval, 2.4, 0.002), `got ${s1.realInterval}`);
  check('玫拉 S1 总伤=2.7×atk×1.15×击数', near(s1.skillTotalDamage, P(a * (1 + L7('char_4006_melnte', 0).atk)) * dm * floor(L7('char_4006_melnte', 0).skillDuration, 2.4)), `got ${s1.skillTotalDamage}`);
  check('玫拉 S2 单次=1.8×atk×1.15(衰减最低档)', near(s2.skillTotalDamage, P(a * L7('char_4006_melnte', 1).scale) * dm), `got ${s2.skillTotalDamage}`);
  check('玫拉 S2 周期 DPS>0', s2.cycleDps > 0);
}

// ===== 焰狐龙梓兰:两天赋增幅不计;刚射取刚连射档(5 支×1.8);龙之箭仅一次(物理+法术) =====
{
  const a = panel('char_1048_orchd2');
  const s1 = run('char_1048_orchd2', 0), s2 = run('char_1048_orchd2', 1), s3 = run('char_1048_orchd2', 2);
  check('焰狐龙梓兰 常态=面板普攻(强击瓶/翔虫机动不计)', near(run('char_1048_orchd2', -1).normalDps, P(a) / 1.6));
  check('焰狐龙梓兰 S1 单次=4支×1.3×atk(有充能立刻释放,不触发刚连射)', near(s1.skillTotalDamage, P(a * L7('char_1048_orchd2', 0).atk_scale_1) * 4), `got ${s1.skillTotalDamage}`);
  const loop = P(a * L7('char_1048_orchd2', 1)['attack@atk_scale_loop']);
  const end = P(a * L7('char_1048_orchd2', 1)['attack@atk_scale_end']);
  check('焰狐龙梓兰 S2 总伤=12支×1.6×atk+降落2.8×atk', near(s2.skillTotalDamage, loop * 12 + end), `got ${s2.skillTotalDamage}`);
  check('焰狐龙梓兰 S3 总伤=3.2×atk物理+0.45×atk法术(仅一次)', near(s3.skillTotalDamage, P(a * L7('char_1048_orchd2', 2).atk_scale) + A(a * L7('char_1048_orchd2', 2).atk_scale_magic)), `got ${s3.skillTotalDamage}`);
  check('焰狐龙梓兰 S3 分档含物理与法术', !!s3.dmgTypes.physical && !!s3.dmgTypes.arts);
  check('焰狐龙梓兰 S3 周期 DPS>0', s3.cycleDps > 0);
}

console.log(`${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
