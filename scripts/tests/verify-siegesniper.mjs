// 攻城手(siegesniper)验证:E2 满 / 信赖 100 / 潜 0 / 专一档(L7)/ 敌 def600 res50。
// 口径(用户 2026-09-17 说明文本):早露深入骨髓不生效;熔泉火热直觉不生效;埃拉托琴音入梦不生效;
// 铅踝目光如炬不生效、S2 默认多目标(只算本目标);提丰锐如兽牙无视防御按最高计算、重如沼泥不计、S3 只算本目标;
// 矩墨守不计、S2 额外物理伤害不计。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { calcPhysicalDamage } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const P = (atk, def = 600) => calcPhysicalDamage(atk, def);
let pass = 0, fail = 0;
const check = (n, ok, ex = '') => { if (ok) pass++; else { fail++; console.log('FAIL: ' + n + (ex ? ' => ' + ex : '')); } };
const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
const fl = (a, b) => Math.floor(a / b + 1e-9);
const idx = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
const byId = {}; for (const e of idx) byId[e.id] = e;
const IP = {};
const load = (id) => {
  if (IP[id]) return IP[id];
  const e = byId[id];
  const o = JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8'));
  const el = o.phases.length - 1;
  IP[id] = { o, slot: { elite: el, level: o.phases[el].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: -1, skillLevel: 7, module: null } };
  return IP[id];
};
const run = (id, si) => calculateOperator(load(id).o, { ...load(id).slot, skillIndex: si });
const L7 = (id, si) => { const lv = load(id).o.skills[si].levels; return lv[7] ?? lv[lv.length - 1]; };
const panel = (id) => run(id, -1).panelAtk;
const ids = ['char_197_poca', 'char_2012_typhon', 'char_363_toddi', 'char_4043_erato', 'char_4221_ju', 'char_4062_totter'];
for (const id of ids) check('索引含攻城手 ' + id, byId[id] && byId[id].subProfessionId === 'siegesniper');
check('攻城手共 6 人', idx.filter((o) => o.subProfessionId === 'siegesniper').length === 6);

// 早露:深入骨髓不生效;S3 每秒 1 次 × 7 秒
{
  const a = panel('char_197_poca');
  check('早露 常态=面板普攻(深入骨髓不生效)', near(run('char_197_poca', -1).normalDps, P(a) / 2.4));
  const s3 = run('char_197_poca', 2);
  check('早露 S3 总伤=1.15×atk×7(每秒一次)', near(s3.skillTotalDamage, P(a * (1 + L7('char_197_poca', 2).atk)) * 7), `got ${s3.skillTotalDamage}`);
}
// 提丰:锐如兽牙无视防御 50%(按最高);S3 8 发 × 5 命中
{
  const a = panel('char_2012_typhon');
  check('提丰 常态=普攻(防御视为 300=600×50%)', near(run('char_2012_typhon', -1).normalDps, P(a, 300) / 2.4), `got ${run('char_2012_typhon', -1).normalDps}`);
  check('提丰 S1 总伤=1.37×atk(防300)×19', near(run('char_2012_typhon', 0).skillTotalDamage, P(a * (1 + L7('char_2012_typhon', 0).atk), 300) * fl(35, 2.4 / 1.35)), `got ${run('char_2012_typhon', 0).skillTotalDamage}`);
  check('提丰 S2 永续秒伤=1.4×atk(防300)/间隔', near(run('char_2012_typhon', 1).skillDps, P(a * (1 + L7('char_2012_typhon', 1).atk), 300) / 2.4, 0.6), `got ${run('char_2012_typhon', 1).skillDps}`);
  const s3 = run('char_2012_typhon', 2);
  check('提丰 S3 间隔=2.4+3.1=5.5', near(s3.realInterval, 5.5, 0.002), `got ${s3.realInterval}`);
  check('提丰 S3 总伤=8×5×1.65×atk(防300)', near(s3.skillTotalDamage, P(a * L7('char_2012_typhon', 2)['attack@s3_atk_scale'], 300) * 40), `got ${s3.skillTotalDamage}`);
}
// 熔泉:火热直觉不生效;S1 标记目标防御 -25%、每击 160%;S2 10 发弹药(直击+爆炸)
{
  const a = panel('char_363_toddi');
  check('熔泉 常态=面板普攻(火热直觉不生效)', near(run('char_363_toddi', -1).normalDps, P(a) / 2.4));
  const s1 = run('char_363_toddi', 0), s2 = run('char_363_toddi', 1);
  check('熔泉 S1 总伤=1.6×atk(目标防450)×8', near(s1.skillTotalDamage, P(a * L7('char_363_toddi', 0)['attack@atk_scale'], 450) * fl(20, 2.4)), `got ${s1.skillTotalDamage}`);
  check('熔泉 S2 间隔=2.4+0.3=2.7', near(s2.realInterval, 2.7, 0.002), `got ${s2.realInterval}`);
  check('熔泉 S2 总伤=10×(2.2×atk+0.7×atk)', near(s2.skillTotalDamage, (P(a * L7('char_363_toddi', 1)['attack@atk_scale']) + P(a * L7('char_363_toddi', 1)['attack@splash_atk_scale'])) * 10), `got ${s2.skillTotalDamage}`);
}
// 埃拉托:琴音入梦防御无视不生效
{
  const a = panel('char_4043_erato');
  check('埃拉托 常态=面板普攻(琴音入梦不生效)', near(run('char_4043_erato', -1).normalDps, P(a) / 2.4));
  check('埃拉托 S1 单次=2.2×atk', near(run('char_4043_erato', 0).skillTotalDamage, P(a * L7('char_4043_erato', 0).atk_scale)));
}
// 矩:墨守不计;S1 atk_scale_s1;S2 额外物理伤害不计
{
  const a = panel('char_4221_ju');
  check('矩 常态=面板普攻(墨守不计)', near(run('char_4221_ju', -1).normalDps, P(a) / 2.4));
  check('矩 S1 单次=2.3×atk', near(run('char_4221_ju', 0).skillTotalDamage, P(a * L7('char_4221_ju', 0).atk_scale_s1)), `got ${run('char_4221_ju', 0).skillTotalDamage}`);
  check('矩 S2 总伤=1.8×atk×12(额外物理不计)', near(run('char_4221_ju', 1).skillTotalDamage, P(a * (1 + L7('char_4221_ju', 1).atk)) * fl(30, 2.4)), `got ${run('char_4221_ju', 1).skillTotalDamage}`);
}
// 铅踝:目光如炬不生效;S1 单次 2×atk;S2 只算本目标(不触发"仅攻击到一个敌人"加成)
{
  const a = panel('char_4062_totter');
  check('铅踝 常态=面板普攻(目光如炬不生效)', near(run('char_4062_totter', -1).normalDps, P(a) / 2.4));
  check('铅踝 S1 单次=2×atk', near(run('char_4062_totter', 0).skillTotalDamage, P(a * L7('char_4062_totter', 0).atk_scale)));
  check('铅踝 S2 总伤=普攻×15(多目标只算本目标)', near(run('char_4062_totter', 1).skillTotalDamage, P(a) * fl(27, 2.4 / 1.4)), `got ${run('char_4062_totter', 1).skillTotalDamage}`);
}
console.log(`${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
