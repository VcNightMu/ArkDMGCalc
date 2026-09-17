// 神射手(longrange)验证:E2 满 / 信赖 100 / 潜 0 / 专一档(L7)/ 敌 def600 res50。
// 口径(用户 2026-09-17 说明文本):守林人「暗杀者」增幅不计、S2 炸弹只计一次;远牙「凝神」增幅不计、S3 伤害增幅不计;
// 蕾缪安「跨境追缉许可」增幅不计、「逃犯引渡手续」攻击力与弹药上限默认常驻、S2 不触发特殊狙击、S3 取基础伤害。
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
const run = (id, si, module = null) => calculateOperator(load(id).o, { ...load(id).slot, skillIndex: si, module });
const L7 = (id, si) => { const lv = load(id).o.skills[si].levels; return lv[7] ?? lv[lv.length - 1]; };
const panel = (id) => run(id, -1).panelAtk;
const ids = ['char_430_fartth', 'char_4193_lemuen', 'char_158_milu', 'char_218_cuttle', 'char_4014_lunacu', 'char_302_glaze'];
for (const id of ids) check('索引含神射手 ' + id, byId[id] && byId[id].subProfessionId === 'longrange');
check('神射手共 6 人', idx.filter((o) => o.subProfessionId === 'longrange').length === 6);

// 守林人:暗杀者不计;S2 炸弹只计一次
{
  const a = panel('char_158_milu');
  check('守林人 常态=面板普攻(暗杀者不计)', near(run('char_158_milu', -1).normalDps, P(a) / 2.7));
  check('守林人 S1 总伤=1.5×atk×击数', near(run('char_158_milu', 0).skillTotalDamage, P(a * (1 + L7('char_158_milu', 0).atk)) * fl(L7('char_158_milu', 0).skillDuration, 2.7)));
  check('守林人 S2 单次=2.6×atk(炸弹只计一次)', near(run('char_158_milu', 1).skillTotalDamage, P(a * L7('char_158_milu', 1).atk_scale)), `got ${run('char_158_milu', 1).skillTotalDamage}`);
}
// 远牙:凝神不计;S3 伤害增幅不计(仅 atk +110%)
{
  const a = panel('char_430_fartth');
  check('远牙 常态=面板普攻(凝神不计)', near(run('char_430_fartth', -1).normalDps, P(a) / 2.7));
  check('远牙 S1 总伤=1.37×atk×(35s/间隔)', near(run('char_430_fartth', 0).skillTotalDamage, P(a * (1 + L7('char_430_fartth', 0).atk)) * fl(35, 2.7 / (1 + L7('char_430_fartth', 0).attack_speed / 100))));
  check('远牙 S3 总伤=2.1×atk×6(damage_scale 1.3 不计)', near(run('char_430_fartth', 2).skillTotalDamage, P(a * (1 + L7('char_430_fartth', 2).atk)) * fl(18, 2.7)), `got ${run('char_430_fartth', 2).skillTotalDamage}`);
}
// 蕾缪安:逃犯引渡手续 +10% 攻击力与弹药+1 常驻;S2 不触发特殊狙击;S3 基础伤害
{
  const a = panel('char_4193_lemuen');
  check('蕾缪安 常态=面板普攻(逃犯引渡 +10% 已在面板内)', near(run('char_4193_lemuen', -1).normalDps, P(a) / 2.7), `got ${run('char_4193_lemuen', -1).normalDps}`);
  const s1 = run('char_4193_lemuen', 0), s2 = run('char_4193_lemuen', 1), s3 = run('char_4193_lemuen', 2);
  check('蕾缪安 S1 总伤=6发×1.9×atk(弹药上限+1 常驻)', near(s1.skillTotalDamage, P(a * L7('char_4193_lemuen', 0)['attack@atk_scale']) * 6), `got ${s1.skillTotalDamage}`);
  check('蕾缪安 S2 不触发特殊狙击 → 不消耗弹药,按永续技能(总伤 0)', s2.skillTotalDamage === 0, `got ${s2.skillTotalDamage}`);
  check('蕾缪安 S2 秒伤=1.6×atk/间隔(永续)', near(s2.skillDps, P(a * (1 + L7('char_4193_lemuen', 1).atk)) / (2.7 / 1.7), 0.6), `got ${s2.skillDps}`);
  check('蕾缪安 S2 间隔=2.7/(1+70%)', near(s2.realInterval, 2.7 / 1.7, 0.002), `got ${s2.realInterval}`);
  check('蕾缪安 S3 总伤=6发×2.8×atk(基础伤害)', near(s3.skillTotalDamage, P(a * L7('char_4193_lemuen', 2)['attack@proj_atk_scale_2']) * 6), `got ${s3.skillTotalDamage}`);
}
// 安哲拉:深海直觉常驻攻速 +12(含自身)
{
  const a = panel('char_218_cuttle');
  check('安哲拉 常态间隔=2.7/1.12(深海直觉常驻)', near(run('char_218_cuttle', -1).realInterval, 2.7 / 1.12, 0.002), `got ${run('char_218_cuttle', -1).realInterval}`);
  check('安哲拉 S1 总伤=1.75×atk×击数(攻速 +12 常驻)', near(run('char_218_cuttle', 0).skillTotalDamage, P(a * (1 + L7('char_218_cuttle', 0).atk)) * fl(30, 2.7 / 1.12)), `got ${run('char_218_cuttle', 0).skillTotalDamage}`);
}
// 子月:S2 攻速 +120;天赋间隔键(未在描述中说明)未建模
{
  const a = panel('char_4014_lunacu');
  check('子月 S1 总伤=1.75×atk×击数(间隔 2.55)', near(run('char_4014_lunacu', 0).skillTotalDamage, P(a * (1 + L7('char_4014_lunacu', 0).atk)) * fl(18, 2.55)), `got ${run('char_4014_lunacu', 0).skillTotalDamage}`);
  check('子月 常态间隔=2.7-0.15=2.55(荒野本能)', near(run('char_4014_lunacu', -1).realInterval, 2.55, 0.002), `got ${run('char_4014_lunacu', -1).realInterval}`);
  const s2 = run('char_4014_lunacu', 1);
  check('子月 S2 间隔=(2.7-0.15)/2.2', near(s2.realInterval, 2.55 / 2.2, 0.002), `got ${s2.realInterval}`);
  check('子月 S2 总伤=普攻×击数', near(s2.skillTotalDamage, P(a) * fl(25, 2.55 / 2.2)));
  const mx = (lv) => ({ moduleId: 'uniequip_002_lunacu', moduleLevel: lv });
  check('子月 X 模 L2 间隔=2.7-0.2=2.5', near(run('char_4014_lunacu', -1, mx(2)).realInterval, 2.5, 0.002), `got ${run('char_4014_lunacu', -1, mx(2)).realInterval}`);
  check('子月 X 模 L3 间隔=2.7-0.25=2.45', near(run('char_4014_lunacu', -1, mx(3)).realInterval, 2.45, 0.002), `got ${run('char_4014_lunacu', -1, mx(3)).realInterval}`);
}
// 安比尔:S2 间隔 2.7+0.9=3.6(加算),攻击力 +70%
{
  const a = panel('char_302_glaze');
  const s2 = run('char_302_glaze', 1);
  check('安比尔 S2 间隔=2.7+0.9=3.6', near(s2.realInterval, 3.6, 0.002), `got ${s2.realInterval}`);
  check('安比尔 S2 总伤=1.7×atk×击数', near(s2.skillTotalDamage, P(a * (1 + L7('char_302_glaze', 1).atk)) * fl(36, 3.6)), `got ${s2.skillTotalDamage}`);
}
console.log(`${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
