// 速射手(fastshot)验证:E2 满级 / 信赖 100 / 潜 0 / 专一档(L7 = levels[7],全项目既有约定)/ 敌 def600 res50。
// 口径来源(用户 2026-09-17):连射走"每发独立结算"(hitCount);强力击类走既有 cycle 通道;
// 梅 S2 间隔 +0.5 按 1.5s 加算;灰喉 S2 固定 3 连射、寒芒克洛丝 S1/S2 固定 2 连射写死;
// 蓝毒天赋固定 DOT(75/秒法伤,3.1s,不叠层);白金蓄力按间隔折算;灰烬 S2 弹药 31 发不计晕眩增伤、S3 两发(沿途+爆炸);
// 隐现弹药 = trigger_time + 天赋 self_ammo(3);能天使 S3 间隔按游戏描述 -0.22 折算(数据只有一半);
// 寒芒克洛丝 S2 窗口连射(2 连射 → 命中 32 次后 4 连射)。
import { calculateOperator, calcTalentAtkBonus, calcTalentAttackSpeed } from '../../src/frontend/js/damage-calc.js';
import { calcPhysicalDamage, calcArtsDamage } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const P = (atk) => calcPhysicalDamage(atk, 600);
const A = (atk) => calcArtsDamage(atk, 50);
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) pass++; else { fail++; console.log('FAIL: ' + name + (extra ? ' => ' + extra : '')); } };
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;

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
const run = (id, si, module = null) => {
  const { o, slot } = load(id);
  return calculateOperator(o, { ...slot, skillIndex: si, module });
};
const L7 = (id, si) => { const lv = load(id).o.skills[si].levels; return lv[7] ?? lv[lv.length - 1]; };  // 低星无专精档 → 取最后一档(技7)
const panel = (id) => run(id, -1).panelAtk;
const dt = (r, k) => r.dmgTypes[k];
const fsIds = ['char_103_angel', 'char_332_archet', 'char_456_ash', 'char_129_bluep', 'char_204_platnm', 'char_365_aprl',
  'char_367_swllow', 'char_498_inside', 'char_1021_kroos2', 'char_126_shotst', 'char_133_mm', 'char_190_clour',
  'char_235_jesica', 'char_124_kroos', 'char_211_adnach', 'char_503_rang', 'char_4000_jnight'];
for (const id of fsIds) check('索引含速射手 ' + id, !!byId[id]);

// ===== 常驻天赋(用户口径:入表) =====
{
  const { o, slot } = load('char_133_mm');
  check('梅 天赋攻击+7%(E2潜0)', near(calcTalentAtkBonus(o, slot), 0.07));
  check('梅 天赋攻速+7', near(calcTalentAttackSpeed(o, slot), 7));
  check('梅 面板攻击=543×1.07', near(panel('char_133_mm'), 543 * 1.07, 0.02), `got ${panel('char_133_mm')}`);
  check('梅 常态间隔=1/1.07', near(run('char_133_mm', -1).realInterval, 1 / 1.07, 0.002));
}
check('灰喉 天赋攻速+6 → 间隔 1/1.06', near(run('char_367_swllow', -1).realInterval, 1 / 1.06, 0.002));
check('杰西卡 天赋攻速+12 → 间隔 1/1.12', near(run('char_235_jesica', -1).realInterval, 1 / 1.12, 0.002));
check('安德切尔 天赋攻速+8 → 间隔 1/1.08', near(run('char_211_adnach', -1).realInterval, 1 / 1.08, 0.002));

// ===== 梅 S2 间隔加算 1.5s(再吃攻速+7) =====
check('梅 S2 间隔=(1.0+0.5)/1.07', near(run('char_133_mm', 1).realInterval, 1.5 / 1.07, 0.002), `got ${run('char_133_mm', 1).realInterval}`);

// ===== 能天使:连射每发独立结算 + S3 间隔按游戏描述 -0.22 折算 =====
{
  const atk0 = panel('char_103_angel');
  const r1 = run('char_103_angel', 0), r2 = run('char_103_angel', 1), r3 = run('char_103_angel', 2);
  check('能天使 S1 单次触发=3连射 每发 1.29×atk', near(r1.skillTotalDamage, 3 * P(atk0 * L7('char_103_angel', 0).atk_scale)), `got ${r1.skillTotalDamage}`);
  check('能天使 S1 周期 DPS 存在(攻击回复 sp4)', r1.cycleDps > 0);
  check('能天使 S2 总伤=4连射×16击', near(r2.skillTotalDamage, 4 * P(atk0 * L7('char_103_angel', 1)['attack@atk_scale']) * Math.floor(15 / 0.893), 0.5), `got ${r2.skillTotalDamage}`);
  check('能天使 S3 间隔=(1-0.16)/1.12(专一;专三为 -0.22)', near(r3.realInterval, (1 - 0.16) / 1.12, 0.002), `got ${r3.realInterval}`);
  check('能天使 S3 总伤=5连射×20击', near(r3.skillTotalDamage, 5 * P(atk0 * L7('char_103_angel', 2)['attack@atk_scale']) * Math.floor(15 / 0.75), 0.5), `got ${r3.skillTotalDamage}`);
}

// ===== 空弦(多目标只算主目标) =====
{
  const a = panel('char_332_archet');
  check('空弦 S1 单次=2.1×atk(单目标)', near(run('char_332_archet', 0).skillTotalDamage, P(a * L7('char_332_archet', 0).atk_scale)), `got ${run('char_332_archet', 0).skillTotalDamage}`);
  check('空弦 S2 单次=5连射×1.25×atk', near(run('char_332_archet', 1).skillTotalDamage, 5 * P(a * L7('char_332_archet', 1).atk_scale)), `got ${run('char_332_archet', 1).skillTotalDamage}`);
  const s3 = run('char_332_archet', 2);
  check('空弦 S3 总伤=3连射×atk(1+atk 加成)×击数', near(s3.skillTotalDamage, 3 * P(a * (1 + L7('char_332_archet', 2).atk)) * Math.floor(20 / 1.0), 15), `got ${s3.skillTotalDamage}`);
}

// ===== 灰烬:S1 常驻 2 连射 / S2 弹药 31 发 / S3 两发(沿途+爆炸) =====
{
  const a = panel('char_456_ash');
  const s1 = run('char_456_ash', 0), s2 = run('char_456_ash', 1), s3 = run('char_456_ash', 2);
  check('灰烬 S1 常驻 DPS=2连射×(1+0.12)×atk/间隔', near(s1.skillDps, 2 * P(a * (1 + L7('char_456_ash', 0).atk)) / 1.0), `got ${s1.skillDps}`);
  check('灰烬 S2 总伤=31发×2.2×atk', near(s2.skillTotalDamage, 31 * P(a * L7('char_456_ash', 1)['ash_s_2[atk_scale].atk_scale'])), `got ${s2.skillTotalDamage}`);
  check('灰烬 S2 间隔=1.0-0.8=0.2s', near(s2.realInterval, 0.2, 0.002));
  check('灰烬 S2 DPS=总伤/(31×0.2)', near(s2.skillDps, s2.skillTotalDamage / 6.2, 0.5));
  const l3 = L7('char_456_ash', 2);
  check('灰烬 S3 总伤=2×((atk_scale+not_hitwall)×atk)', near(s3.skillTotalDamage, 2 * P(a * (l3.atk_scale + l3.not_hitwall_scale))), `got ${s3.skillTotalDamage}`);
}

// ===== 蓝毒:天赋固定 DOT + S1/S2 连射 =====
{
  const a = panel('char_129_bluep');
  const n = run('char_129_bluep', -1), s1 = run('char_129_bluep', 0), s2 = run('char_129_bluep', 1);
  check('蓝毒 天赋 DOT=75×0.5=37.5/秒', near(s1.dmgTypes.arts.skillDps, 37.5), `got ${s1.dmgTypes.arts.skillDps}`);
  check('蓝毒 常态普攻+DOT', near(n.normalDps, P(a) / 1.0 + 37.5), `got ${n.normalDps}`);
  check('蓝毒 S1 单次=1.7×atk', near(s1.skillTotalDamage - 0, P(a * L7('char_129_bluep', 0).atk_scale)), `got ${s1.skillTotalDamage}`);
  check('蓝毒 S2 总伤=2连射×27击+DOT×27s', near(s2.skillTotalDamage, 2 * P(a * (1 + L7('char_129_bluep', 1).atk)) * Math.floor(L7('char_129_bluep', 1).skillDuration / 1) + 37.5 * L7('char_129_bluep', 1).skillDuration, 0.5), `got ${s2.skillTotalDamage}`);
}

// ===== 白金:蓄力攻击(常态 1.0s 无加成,S2 攻速-20 → 1.25s) =====
{
  const a = panel('char_204_platnm');
  const s0 = run('char_204_platnm', 0), s1 = run('char_204_platnm', 1);
  const charge = 1 + (1.25 - 1) / (2.5 - 1) * (1.8 - 1);
  check('白金 S1 无蓄力(间隔 1.0s → ×1)', near(s0.skillTotalDamage, P(a * (1 + L7('char_204_platnm', 0).atk)) * Math.floor(L7('char_204_platnm', 0).skillDuration / 1), 0.5), `got ${s0.skillTotalDamage}`);
  check('白金 S2 间隔 1.25s', near(s1.realInterval, 1.25, 0.002));
  check('白金 S2 蓄力 DPS=(1.8×atk×1.1333-def)/1.25', near(s1.skillDps, P(a * (1 + L7('char_204_platnm', 1).atk) * charge) / 1.25), `got ${s1.skillDps}`);
}

// ===== 灰喉:固定 3 连射(S2)与 2 连射(S1) =====
{
  const a = panel('char_367_swllow');
  const s1 = run('char_367_swllow', 0), s2 = run('char_367_swllow', 1);
  check('灰喉 S1 单次=2连射×1.3×atk', near(s1.skillTotalDamage, 2 * P(a * L7('char_367_swllow', 0).atk_scale)), `got ${s1.skillTotalDamage}`);
  check('灰喉 S2 总伤=3连射×(1+atk)×atk×击数', near(s2.skillTotalDamage, 3 * P(a * (1 + L7('char_367_swllow', 1).atk)) * Math.floor(L7('char_367_swllow', 1).skillDuration / (1 / 1.06)), 1.5), `got ${s2.skillTotalDamage}`);
}

// ===== 隐现:弹药 = trigger_time + 天赋 self_ammo(3) =====
{
  const a = panel('char_498_inside');
  const s1 = run('char_498_inside', 0), s2 = run('char_498_inside', 1);
  const l1 = L7('char_498_inside', 0), l2 = L7('char_498_inside', 1);
  check('隐现 S1 总伤=(4+3)发×2.1×atk', near(s1.skillTotalDamage, (l1['attack@trigger_time'] + 3) * P(a * l1['attack@atk_scale'])), `got ${s1.skillTotalDamage}`);
  check('隐现 S2 间隔=1.0-0.3=0.7s', near(s2.realInterval, 0.7, 0.002));
  check('隐现 S2 总伤=(14+3)发×(1+atk)×atk', near(s2.skillTotalDamage, (l2['attack@trigger_time'] + 3) * P(a * (1 + l2.atk))), `got ${s2.skillTotalDamage}`);
}

// ===== 寒芒克洛丝:S1 固定 2 连射 / S2 窗口(2连射 → 32 命中后 4连射) =====
{
  const a = panel('char_1021_kroos2');
  const s1 = run('char_1021_kroos2', 0), s2 = run('char_1021_kroos2', 1);
  check('寒芒克洛丝 S1 总伤=2连射×(1+atk)×atk×击数', near(s1.skillTotalDamage, 2 * P(a * (1 + L7('char_1021_kroos2', 0).atk)) * Math.floor(L7('char_1021_kroos2', 0).skillDuration / 1.0)), `got ${s1.skillTotalDamage}`);
  const l2 = L7('char_1021_kroos2', 1);
  const interval = 1 - 0.3;
  const nAtt = Math.floor(l2.skillDuration / interval + 1e-9);
  const n2 = Math.min(nAtt, Math.ceil(l2['attack@max_stack_count'] / 2));
  const hits = n2 * 2 + (nAtt - n2) * 4;
  check('寒芒克洛丝 S2 窗口总伤(2连射段+4连射段)', near(s2.skillTotalDamage, P(a) * hits, 1.5), `got ${s2.skillTotalDamage} want ${P(a) * hits}`);
}

// ===== 其余单发/强化型:数值与间隔 =====
{
  const a = panel('char_365_aprl');
  check('四月 S1 单次=1.9×atk', near(run('char_365_aprl', 0).skillTotalDamage, P(a * L7('char_365_aprl', 0).atk_scale)), `got ${run('char_365_aprl', 0).skillTotalDamage}`);
  const m = panel('char_126_shotst');
  check('流星 S1 碎甲(破防不建模)单次=1.6×atk', near(run('char_126_shotst', 0).skillTotalDamage, P(m * L7('char_126_shotst', 0).atk_scale)));
  const c = panel('char_124_kroos');
  check('克洛丝 S1 单次=2连射×1.2×atk', near(run('char_124_kroos', 0).skillTotalDamage, 2 * P(c * L7('char_124_kroos', 0).atk_scale)), `got ${run('char_124_kroos', 0).skillTotalDamage}`);
  const j = panel('char_235_jesica');
  check('杰西卡 S1 单次=2.1×atk(强力击型)', near(run('char_235_jesica', 0).skillTotalDamage, P(j * L7('char_235_jesica', 0).atk_scale)), `got ${run('char_235_jesica', 0).skillTotalDamage}`);
  const ad = panel('char_211_adnach');
  check('安德切尔 S1 总伤=1.5×atk×击数(含 5% 保底)', near(run('char_211_adnach', 0).skillTotalDamage, P(ad * (1 + L7('char_211_adnach', 0).atk)) * Math.floor(L7('char_211_adnach', 0).skillDuration / (1 / 1.08))), `got ${run('char_211_adnach', 0).skillTotalDamage}`);
  check('红云 S1 总伤=1.6×atk×击数', near(run('char_190_clour', 0).skillTotalDamage, P(panel('char_190_clour') * (1 + L7('char_190_clour', 0).atk)) * Math.floor(L7('char_190_clour', 0).skillDuration / 1)), `got ${run('char_190_clour', 0).skillTotalDamage}`);
  check('巡林者 常态=面板 atk(对空不计)', near(run('char_503_rang', -1).normalDps, P(299) / 1.0, 0.02), `got ${run('char_503_rang', -1).normalDps}`);
  check('正义骑士号 常态(光环伤害不计)', near(run('char_4000_jnight', -1).normalDps, P(217) / 1.0, 0.02), `got ${run('char_4000_jnight', -1).normalDps}`);
}

// ===== 蓝毒 X 模组「标准比色卡」:te 常驻攻速 +8(用户口径 2026-09-17:模组新增的加成要算)+ 中毒伤害强化 =====
{
  const o = load('char_129_bluep').o;
  const ml = (lv) => o.modules.find((m) => m.id === 'uniequip_002_bluep').levels.find((l) => l.level === lv);
  const md = (lv) => ({ moduleId: 'uniequip_002_bluep', moduleLevel: lv });
  const m1 = run('char_129_bluep', -1, md(1));
  check('蓝毒 X 模组 L1 间隔=1/(模组+2 + te+8)', near(m1.realInterval, 1 / (100 + ml(1).attributeBlackboard.attack_speed + 8) * 100, 0.002), `got ${m1.realInterval}`);
  check('蓝毒 X 模组 L1 常态=普攻(含模组攻击力)+DOT 37.5', near(m1.normalDps, P(610 + ml(1).attributeBlackboard.atk) / m1.realInterval + 37.5, 0.05), `got ${m1.normalDps}`);
  check('蓝毒 X 模组 L2 中毒 85 → DOT 42.5/秒', near(run('char_129_bluep', 1, md(2)).dmgTypes.arts.skillDps, 42.5), `got ${run('char_129_bluep', 1, md(2)).dmgTypes.arts.skillDps}`);
  check('蓝毒 X 模组 L3 中毒 95 → DOT 47.5/秒', near(run('char_129_bluep', 1, md(3)).dmgTypes.arts.skillDps, 47.5), `got ${run('char_129_bluep', 1, md(3)).dmgTypes.arts.skillDps}`);
}

console.log(`${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
