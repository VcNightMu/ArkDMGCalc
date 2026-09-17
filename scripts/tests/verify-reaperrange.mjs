// 散射手(reaperrange)验证:E2 满 / 信赖 100 / 潜 0 / 专一档(L7)/ 敌 def600 res50。
// 口径(用户 2026-09-17 说明文本):奥斯塔「尖钉」流血不生效;松果「便携电源」不生效、S2 无攻击力追加;
// 假日威龙陈「节约风气」不消耗弹药不生效、「假日余韵」取基础效果(三级模组技能期视为水地形);吉星「好运连击！」不生效。
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
const ids = ['char_1013_chen2', 'char_279_excu', 'char_346_aosta', 'char_4203_kichi', 'char_440_pinecn'];
for (const id of ids) check('索引含散射手 ' + id, byId[id] && byId[id].subProfessionId === 'reaperrange');
check('散射手共 5 人', idx.filter((o) => o.subProfessionId === 'reaperrange').length === 5);

// 假日威龙陈:「假日余韵」基础档攻速+8;三技能弹药结算;节约风气不消耗弹药不计
{
  const a = panel('char_1013_chen2');
  check('陈 常态间隔=2.3/1.08(假日余韵基础档)', near(run('char_1013_chen2', -1).realInterval, 2.3 / 1.08, 0.002), `got ${run('char_1013_chen2', -1).realInterval}`);
  const s1 = run('char_1013_chen2', 0), s2 = run('char_1013_chen2', 1), s3 = run('char_1013_chen2', 2);
  check('陈 S1 总伤=4发×1.8×1.5×atk(应用特性加成)', near(s1.skillTotalDamage, P(a * (1 + L7('char_1013_chen2', 0).atk) * 1.5) * 4), `got ${s1.skillTotalDamage}`);
  check('陈 S2 总伤=蓄力20发×1.7×atk', near(s2.skillTotalDamage, P(a * (1 + L7('char_1013_chen2', 1).atk)) * 20), `got ${s2.skillTotalDamage}`);
  check('陈 S3 总伤=32次命中×1.8×1.5×atk(应用特性加成)', near(s3.skillTotalDamage, P(a * (1 + L7('char_1013_chen2', 2).atk) * 1.5) * 32), `got ${s3.skillTotalDamage}`);
  // X 模组 L3:技能期强制水地形 → 攻速 +20、攻击力 +28%
  const m3 = { moduleId: 'uniequip_003_chen2', moduleLevel: 3 };
  check('陈 X模L3 技能期间隔=2.3/1.20(视为水地形)', near(run('char_1013_chen2', 0, m3).realInterval, 2.3 / 1.2, 0.002), `got ${run('char_1013_chen2', 0, m3).realInterval}`);
  const a3 = run('char_1013_chen2', -1, m3).panelAtk;
  check('陈 X模L3 S1 总伤=4发×1.8×1.28×1.5×atk', near(run('char_1013_chen2', 0, m3).skillTotalDamage, P(a3 * (1 + L7('char_1013_chen2', 0).atk) * 1.28 * 1.5) * 4), `got ${run('char_1013_chen2', 0, m3).skillTotalDamage}`);
}
// 送葬人:「终结改装」固定穿防 160;S2 普攻变二连击
{
  const a = panel('char_279_excu');
  check('送葬人 常态 DPS=普攻减防 160', near(run('char_279_excu', -1).normalDps, P(a, 440) / 2.3), `got ${run('char_279_excu', -1).normalDps}`);
  check('送葬人 S1 总伤=1.55×1.5×atk(减防160,应用特性加成)×13', near(run('char_279_excu', 0).skillTotalDamage, P(a * (1 + L7('char_279_excu', 0).atk) * 1.5, 440) * fl(32, 2.3)), `got ${run('char_279_excu', 0).skillTotalDamage}`);
  const s2 = run('char_279_excu', 1);
  check('送葬人 S2 间隔=2.3-0.7=1.6', near(s2.realInterval, 1.6, 0.002));
  check('送葬人 S2 总伤=二连击×普攻×11', near(s2.skillTotalDamage, P(a, 440) * 2 * fl(18, 1.6)), `got ${s2.skillTotalDamage}`);
}
// 奥斯塔:尖钉不生效;S2 间隔 2.3+0.5=2.8、攻击力 +55%
{
  const a = panel('char_346_aosta');
  check('奥斯塔 常态=面板普攻(尖钉不生效)', near(run('char_346_aosta', -1).normalDps, P(a) / 2.3));
  const s2 = run('char_346_aosta', 1);
  check('奥斯塔 S2 间隔=2.8', near(s2.realInterval, 2.8, 0.002), `got ${s2.realInterval}`);
  check('奥斯塔 S2 总伤=1.55×atk×8', near(s2.skillTotalDamage, P(a * (1 + L7('char_346_aosta', 1).atk)) * fl(23, 2.8)), `got ${s2.skillTotalDamage}`);
}
// 吉星:好运连击不生效;S1 满层(4×22%)、S2 +65%
{
  const a = panel('char_4203_kichi');
  check('吉星 常态=面板普攻(好运连击不生效)', near(run('char_4203_kichi', -1).normalDps, P(a) / 2.3));
  const s1 = run('char_4203_kichi', 0), s2 = run('char_4203_kichi', 1);
  check('吉星 S1 间隔=2.8', near(s1.realInterval, 2.8, 0.002));
  check('吉星 S1 总伤=满层(1+22%×4)×atk×13', near(s1.skillTotalDamage, P(a * (1 + L7('char_4203_kichi', 0).atk * L7('char_4203_kichi', 0).max_stack_cnt)) * fl(38, 2.8)), `got ${s1.skillTotalDamage}`);
  check('吉星 S2 间隔=3.0', near(s2.realInterval, 3.0, 0.002));
  check('吉星 S2 总伤=1.65×atk×10', near(s2.skillTotalDamage, P(a * (1 + L7('char_4203_kichi', 1).atk)) * fl(31, 3.0)), `got ${s2.skillTotalDamage}`);
}
// 松果:便携电源不生效;S1 技能级穿防 220;S2 默认无攻击力追加
{
  const a = panel('char_440_pinecn');
  check('松果 常态=面板普攻(便携电源不生效)', near(run('char_440_pinecn', -1).normalDps, P(a) / 2.3));
  check('松果 S1 单次=1.85×atk(技能级穿防220)', near(run('char_440_pinecn', 0).skillTotalDamage, P(a * L7('char_440_pinecn', 0).atk_scale, 380)), `got ${run('char_440_pinecn', 0).skillTotalDamage}`);
  check('松果 S2 总伤=1.45×atk×8(无追加)', near(run('char_440_pinecn', 1).skillTotalDamage, P(a * (1 + L7('char_440_pinecn', 1)['pinecn_s_2[a].atk'])) * fl(20, 2.3)), `got ${run('char_440_pinecn', 1).skillTotalDamage}`);
}
console.log(`${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
