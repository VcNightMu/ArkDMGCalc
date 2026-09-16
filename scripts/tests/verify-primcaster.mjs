// 本源术师(primcaster)引擎断言 —— 干员:真言/烛煌/妮芙/Miss.Christine/温米/折光
// 口径(用户 2026-09-16,与伊芙利特 Δ/D 模组同源):
//  - 特性「攻击造成法术伤害,可以造成元素伤害」(可对空);元素:真言/Christine=神经,烛煌/温米=灼燃,妮芙/折光=凋亡
//  - 损伤累积基数 = 该次攻击"实际造成的伤害"×比例(吃法抗后的法伤,不是攻击力)
//  - 爆条窗口统一:损伤事件流推进 EP→爆条→窗口内降抗(火 -20)/条件性元素伤害按时间加权摊算
//    神经 6000/cd10、灼燃 7000+10s 法抗-20、凋亡 800×15=12000/cd15
//  - 弹药型(烛煌 S3,自体不自供损伤→元素归零)、满蓄力型(温米 S2 取 enhanced_duration 30s)、充能点燃(妮芙 S2)沿用既有机制
//  - 不施加损伤的槽位(Christine S2/温米 S2/折光 S2/烛煌 S3/妮芙 S3)无爆条;依赖外部损伤源的天赋默认不计
//  - 自供爆条的天赋计入:温米 S1「难免会溢锅」、妮芙 S1/S2 第一天赋「失魂」(爆发窗口内每秒 攻击力×40% 元素 DoT,用户口径 2026-09-16)
//  - 常态(无技能)不含元素(普攻不移交损伤)→ 常态行不变
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import { OPERATOR_ELEMENT, simulateElementTimeline, elementBurstDur } from '../../src/frontend/js/element-calc.js';
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
const MOD = (o, tag, lv) => {
  const m = (o.modules || []).find(x => x.type === 'ADVANCED' && x.typeName2 === tag);
  return m ? { moduleId: m.id, moduleLevel: lv } : null;
};
const dt = (r, k) => (r.dmgTypes && r.dmgTypes[k] ? r.dmgTypes[k].skillTotalDamage : 0);

// ============ 元素归属注册 ============
check('OPERATOR_ELEMENT 登记真言=神经', OPERATOR_ELEMENT['char_4204_mantra'] === 'sanity', OPERATOR_ELEMENT['char_4204_mantra']);
check('OPERATOR_ELEMENT 登记烛煌=灼燃', OPERATOR_ELEMENT['char_1040_blaze2'] === 'fire');
check('OPERATOR_ELEMENT 登记妮芙=凋亡', OPERATOR_ELEMENT['char_4146_nymph'] === 'dark');
check('OPERATOR_ELEMENT 登记 Christine=神经', OPERATOR_ELEMENT['char_4198_christ'] === 'sanity');
check('OPERATOR_ELEMENT 登记温米=灼燃', OPERATOR_ELEMENT['char_4081_warmy'] === 'fire');
check('OPERATOR_ELEMENT 登记折光=凋亡', OPERATOR_ELEMENT['char_499_kaitou'] === 'dark');

// ============ 真言 char_4204_mantra（神经,面板 755） ============
{
  const o = load('char_4204_mantra');
  const r0 = calculateOperator(o, mk(o, -1));
  check('真言 常态 = A(755)/1.6,无元素', near(r0.normalDps, A(755) / 1.6) && !r0.dmgTypes, `got ${r0.normalDps}`);

  // S1 共鸣溃缩(AUTO 强化下一击,spCost3,强化击 275%×atk,附 25% 损伤,爆发期额外 180%×atk 元素)
  const r1 = calculateOperator(o, mk(o, 0));
  // 周期 = (spCost+1)×间隔 = 4×1.6 = 6.4s;每周期 EP = A(755×2.75)×0.25 = 259.53 → 4 周期攒满 → 窗口 25.6s
  const s1ArtsC = 3 * A(755) + A(755 * 2.75);          // 每周期 3 普攻 + 1 强化击
  check('真言 S1 强击期总伤 = 4×(3×A(755)+A(755×275%)) + 爆条 6000', near(r1.skillTotalDamage, 4 * s1ArtsC + 6000), `got ${r1.skillTotalDamage}`);
  check('真言 S1 元素档 = 爆条 6000(1 次)', near(dt(r1, 'element'), 6000), `got ${dt(r1, 'element')}`);
  check('真言 S1 周期 DPS = 总伤/25.6s', near(r1.cycleDps, (4 * s1ArtsC + 6000) / 25.6), `got ${r1.cycleDps}`);
  check('真言 S1 常态行保持 null(AUTO 槽)', r1.normalDps === null, `got ${r1.normalDps}`);

  // S2 意识联协(手动 25s,间隔 -0.7→0.9s,每击 210%×atk + 15% 损伤 + 爆发期 22%×atk 元素)
  const r2 = calculateOperator(o, mk(o, 1));
  const s2Hits = Math.floor(25 / 0.9);
  check('真言 S2 法伤 = 27 击 × A(755×210%)', near(dt(r2, 'arts'), s2Hits * A(755 * 2.1)), `got ${dt(r2, 'arts')}`);
  check('真言 S2 元素 = 6000(1 次爆条) + 窗口内 11 击×22%×atk', near(dt(r2, 'element'), 6000 + 11 * 755 * 0.22), `got ${dt(r2, 'element')}`);
  check('真言 S2 常态行 = 无技能态', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);

  // S3 无言为真(手动 40s,攻击力+230%):本体不施加损伤 → 无爆条/无元素
  const r3 = calculateOperator(o, mk(o, 2));
  check('真言 S3 法伤 = 25 击 × A(755×330%)', near(r3.skillTotalDamage, Math.floor(40 / 1.6) * A(755 * 3.3)), `got ${r3.skillTotalDamage}`);
  check('真言 S3 无元素损伤(本体不施加损伤)', dt(r3, 'element') === 0, `got ${dt(r3, 'element')}`);
}

// ============ 灼燃烛煌 char_1040_blaze2（火,面板 752） ============
{
  const o = load('char_1040_blaze2');
  const r0 = calculateOperator(o, mk(o, -1));
  check('烛煌 常态 = A(752)/1.6', near(r0.normalDps, A(752) / 1.6), `got ${r0.normalDps}`);

  // S1 炙手之援(火圈 20s,每秒 60%×atk 法伤 + 30% 灼燃损伤)
  const r1 = calculateOperator(o, mk(o, 0));
  check('烛煌 S1 元素档 = 爆条 7000(1 次)', near(dt(r1, 'element'), 7000), `got ${dt(r1, 'element')}`);
  check('烛煌 S1 火圈+普攻法伤 > 单火圈口径', dt(r1, 'arts') > 20 * A(752 * 0.6), `got ${dt(r1, 'arts')}`);
  check('烛煌 S1 常态行保持 null(AUTO 槽)', r1.normalDps === null, `got ${r1.normalDps}`);

  // S2 沸血燎原(手动 35s,攻击力+130%,间隔 +0.9→2.5s;灼烧地段每秒 35%×atk 法伤 + 30% 灼燃损伤)
  const r2 = calculateOperator(o, mk(o, 1));
  check('烛煌 S2 间隔 = 1.6+0.9 = 2.5s', near(r2.realInterval, 2.5, 0.001), `got ${r2.realInterval}`);
  check('烛煌 S2 元素 = 2 次爆条 14000', near(dt(r2, 'element'), 14000), `got ${dt(r2, 'element')}`);
  check('烛煌 S2 法伤 = 14 普攻 + 35 地段跳伤(窗口加权)', dt(r2, 'arts') > 14 * A(752 * 2.3) + 35 * A(752 * 2.3 * 0.35), `got ${dt(r2, 'arts')}`);
  check('烛煌 S2 常态行 = 无技能态', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);

  // S3 众恶的焚场(弹药 23 发,间隔 -1.3→0.3s;每发 攻击力×1.95;爆发期每发额外 70%×atk 元素)
  const r3 = calculateOperator(o, mk(o, 2));
  check('烛煌 S3 间隔 = 1.6-1.3 = 0.3s', near(r3.realInterval, 0.3, 0.001), `got ${r3.realInterval}`);
  check('烛煌 S3 法伤 = 23 发 × A(752×195%)', near(dt(r3, 'arts'), 23 * A(752 * 1.95)), `got ${dt(r3, 'arts')}`);
  check('烛煌 S3 元素归零(自体不施加灼燃损伤,不得造成元素伤害)', dt(r3, 'element') === 0, `got ${dt(r3, 'element')}`);
}

// ============ 妮芙 char_4146_nymph（凋亡,面板 745） ============
{
  const o = load('char_4146_nymph');
  const r0 = calculateOperator(o, mk(o, -1));
  check('妮芙 常态 = A(745)/1.6', near(r0.normalDps, A(745) / 1.6), `got ${r0.normalDps}`);

  // S1 笞心击(手动 20s,攻击力+90%,附 15% 凋亡损伤;爆发期额外 40%×atk 元素)
  const r1 = calculateOperator(o, mk(o, 0));
  check('妮芙 S1 法伤 = 12 击 × A(745×190%)', near(dt(r1, 'arts'), Math.floor(20 / 1.6) * A(745 * 1.9)), `got ${dt(r1, 'arts')}`);
  // 每击 EP = A(745×1.9)×0.15 = 106.16 → 第 10 击爆条(t=16);窗口内 2 击(t=17.6/19.2)×40%×atk 额外元素;
  // 第一天赋「失魂」自供爆条 → 爆条窗口(15s)内每秒 攻击力×40% 元素 DoT = 15×1415.5×0.4(用户口径 2026-09-16)
  check('妮芙 S1 元素 = 爆条 12000 + 2×40%×atk + 失魂 DoT 15×40%×atk', near(dt(r1, 'element'), 12000 + 2 * 745 * 1.9 * 0.4 + 15 * 745 * 1.9 * 0.4), `got ${dt(r1, 'element')}`);
  check('妮芙 S1 常态行 = 无技能态', near(r1.normalDps, r0.normalDps), `got ${r1.normalDps}`);

  // S2 怵然震爆(充能,spCost13,单发 360%×atk + 22% 凋亡损伤):点燃 cycle
  const r2 = calculateOperator(o, mk(o, 1));
  const s2Ep = A(745 * 3.6) * 0.22;                    // 295.02 → 4 发攒满 → 窗口 52s
  // 第一天赋「失魂」DoT 基数 = 面板攻击力(S2 无攻击力加成)→ 窗口内每秒 40%×745,共 15 跳
  check('妮芙 S2 元素 = 爆条 12000 + 失魂 DoT 15×40%×atk', near(dt(r2, 'element'), 12000 + 15 * 745 * 0.4), `got ${dt(r2, 'element')}`);
  check('妮芙 S2 法伤 = 4 发 × A(745×360%)', near(dt(r2, 'arts'), 4 * A(745 * 3.6)), `got ${dt(r2, 'arts')}`);
  check('妮芙 S2 周期 DPS = 总伤/52s', near(r2.cycleDps, (4 * A(745 * 3.6) + 12000 + 15 * 745 * 0.4) / 52), `got ${r2.cycleDps}`);
  check('妮芙 S2 单发 EP = A(745×360%)×22% ≈ 295', Math.abs(s2Ep - 295) < 1, `${s2Ep}`);

  // S3 心防溃决(手动 31s,攻击力+190%,攻速+45):不施加损伤 → 无元素
  const r3 = calculateOperator(o, mk(o, 2));
  check('妮芙 S3 法伤 = 28 击 × A(745×290%)', near(r3.skillTotalDamage, Math.floor(31 / (1.6 * 100 / 145)) * A(745 * 2.9)), `got ${r3.skillTotalDamage}`);
  check('妮芙 S3 无元素(不施加损伤)', dt(r3, 'element') === 0, `got ${dt(r3, 'element')}`);
}

// ============ Miss.Christine char_4198_christ（神经,面板 640） ============
{
  const o = load('char_4198_christ');
  const r0 = calculateOperator(o, mk(o, -1));
  check('Christine 常态 = A(640)/1.6', near(r0.normalDps, A(640) / 1.6), `got ${r0.normalDps}`);

  // S1 自由用餐礼仪(手动 25s,攻击力+30%,附 15% 神经损伤)
  const r1 = calculateOperator(o, mk(o, 0));
  check('Christine S1 法伤 = 15 击 × A(640×130%)', near(r1.skillTotalDamage, Math.floor(25 / 1.6) * A(640 * 1.3)), `got ${r1.skillTotalDamage}`);
  // 15 击 × A(640×1.3)×0.15 = 15×62.4 = 936 < 1000 → S1 窗口内不爆条
  check('Christine S1 无爆条(损伤累积 936 < 1000)', dt(r1, 'element') === 0, `got ${dt(r1, 'element')}`);

  // S2 狂饮之宴(手动 20s,停攻,灵体每秒 95%×atk 法伤):不施加损伤 → 无元素
  const r2 = calculateOperator(o, mk(o, 1));
  check('Christine S2 灵体 20 跳 × A(640×95%)', near(r2.skillTotalDamage, 20 * A(640 * 0.95)), `got ${r2.skillTotalDamage}`);
  check('Christine S2 无元素(无自供损伤)', dt(r2, 'element') === 0, `got ${dt(r2, 'element')}`);
}

// ============ 温米 char_4081_warmy（火,面板 646） ============
{
  const o = load('char_4081_warmy');
  const r0 = calculateOperator(o, mk(o, -1));
  check('温米 常态 = A(646)/1.6', near(r0.normalDps, A(646) / 1.6), `got ${r0.normalDps}`);

  // S1 炎炎火焰(手动 20s,攻速+80→0.8889s,附 15% 灼燃损伤)+天赋「难免会溢锅」(爆条 +300%×atk)
  const r1 = calculateOperator(o, mk(o, 0));
  check('温米 S1 攻速→间隔 0.8889s', near(r1.realInterval, 1.6 * 100 / 180, 0.001), `got ${r1.realInterval}`);
  check('温米 S1 法伤 = 22 击(末击窗口内)×A(646)', dt(r1, 'arts') > 21 * A(646) && dt(r1, 'arts') < 22 * A(646) * 1.5, `got ${dt(r1, 'arts')}`);
  check('温米 S1 元素 = 爆条 7000 + 天赋 300%×atk(自满足)', near(dt(r1, 'element'), 7000 + 646 * 3.0), `got ${dt(r1, 'element')}`);
  check('温米 S1 常态行 = 无技能态', near(r1.normalDps, r0.normalDps), `got ${r1.normalDps}`);

  // S2 滔滔热流(手动 15s,攻击力+180%,间隔 +0.9→2.5s):不施加损伤 → 无元素
  const r2 = calculateOperator(o, mk(o, 1));
  check('温米 S2 间隔 = 1.6+0.9 = 2.5s', near(r2.realInterval, 2.5, 0.001), `got ${r2.realInterval}`);
  check('温米 S2 满蓄力:法伤 = 12 击(30s/2.5) × A(646×280%)', near(r2.skillTotalDamage, Math.floor(30 / 2.5) * A(646 * 2.8)), `got ${r2.skillTotalDamage}`);
  check('温米 S2 蓄力档 DPS = 法伤/30s(攻击次数翻倍,DPS 不变)', near(r2.skillDps, Math.floor(30 / 2.5) * A(646 * 2.8) / 30), `got ${r2.skillDps}`);
  check('温米 S2 无元素(蓄力额外元素需外部灼燃源)', dt(r2, 'element') === 0, `got ${dt(r2, 'element')}`);
}

// ============ 折光 char_499_kaitou（凋亡,面板 643） ============
{
  const o = load('char_499_kaitou');
  const r0 = calculateOperator(o, mk(o, -1));
  check('折光 常态 = A(643)/1.6', near(r0.normalDps, A(643) / 1.6), `got ${r0.normalDps}`);

  // S1 镭射穿凿(手动 20s,攻击力+90%,附 15% 凋亡损伤;爆发期额外 40%×atk 元素)+天赋「预先告知」+18% 攻击
  const r1 = calculateOperator(o, mk(o, 0));
  const kBase = A(643 * 1.9);                          // 每击基础法伤
  check('折光 S1 法伤 = 11 击×A(643×190%) + 1 击窗口内×1.18', near(dt(r1, 'arts'), 11 * kBase + A(643 * 1.9 * 1.18), 0.5), `got ${dt(r1, 'arts')}`);
  // 每击 EP = A(643×1.9)×0.15 = 91.63 → 第 11 击(t=17.6)爆条;窗口内 1 击额外 40%×atk×1.18(天赋加攻)
  check('折光 S1 元素 = 凋亡 12000 + 窗口内 1 击×40%×atk×1.18', near(dt(r1, 'element'), 12000 + 643 * 1.9 * 1.18 * 0.4, 0.5), `got ${dt(r1, 'element')}`);
  check('折光 S1 常态行 = 无技能态', near(r1.normalDps, r0.normalDps), `got ${r1.normalDps}`);

  // S2 热处理变色(手动 35s,攻速+80):不施加损伤 → 无元素
  const r2 = calculateOperator(o, mk(o, 1));
  check('折光 S2 攻速→间隔 0.8889s', near(r2.realInterval, 1.6 * 100 / 180, 0.001), `got ${r2.realInterval}`);
  check('折光 S2 法伤 = 39 击 × A(643)', near(r2.skillTotalDamage, Math.floor(35 / (1.6 * 100 / 180)) * A(643)), `got ${r2.skillTotalDamage}`);
  check('折光 S2 无元素(需外部凋亡源)', dt(r2, 'element') === 0, `got ${dt(r2, 'element')}`);
}

// ============ 模组档(天赋强化) ============
{
  const w = load('char_4081_warmy');
  const rw = calculateOperator(w, mk(w, 0, MOD(w, 'X', 3)));
  const rw0 = calculateOperator(w, mk(w, -1, MOD(w, 'X', 3)));
  // PRI-X L3:攻击+65(面板 711)、天赋 ep_damage_scale → 3.5
  check('温米 X模L3 面板=646+65', near(rw0.panelAtk, 711), `got ${rw0.panelAtk}`);
  check('温米 S1 X模L3 元素 = 爆条 7000 + 3.5×711(天赋强化)', near(dt(rw, 'element'), 7000 + 711 * 3.5), `got ${dt(rw, 'element')}`);

  const k = load('char_499_kaitou');
  const rk = calculateOperator(k, mk(k, 0, MOD(k, 'X', 3)));
  const rk0 = calculateOperator(k, mk(k, -1, MOD(k, 'X', 3)));
  // PRI-X L3:攻击+65(面板 708)、天赋 atk → 0.23
  check('折光 X模L3 面板=643+65', near(rk0.panelAtk, 708), `got ${rk0.panelAtk}`);
  // 面板提升后第 10 击即爆条 → 窗口内 2 击(t=17.6/19.2)各额外 40%×atk×1.23
  check('折光 S1 X模L3 元素 = 12000 + 2×40%×atk×1.23(天赋强化)', near(dt(rk, 'element'), 12000 + 2 * 708 * 1.9 * 1.23 * 0.4, 1), `got ${dt(rk, 'element')}`);
}

// ============ 直接调用统一时间轴模拟器 ============
{
  // 灼燃:每事件 EP = 实际法伤×比例;1000 攒满 → 爆条 7000,窗口内后续法伤按 res-20 计
  const sim = simulateElementTimeline({
    grade: 'normal', duration: 20, enemy: { res: 50 },
    streams: [{ atk: 500, dmgMul: 1, interval: 1, el: 'fire', epMul: 0.2, epBase: 'damage' }],
  });
  // 每跳法伤 = 500×0.5 = 250 → EP 50/跳 → 20 跳攒 1000 但第 20 跳才满 → 爆条 1 次(窗口仅覆盖末跳)
  check('模拟器 灼燃:实际法伤驱动 EP(50/跳)', near(sim.breakCount, 1), `breaks ${sim.breakCount}`);
  check('模拟器 灼燃 爆条伤害 7000', near(sim.breakDmg, 7000), `got ${sim.breakDmg}`);
  // 凋亡:800×15=12000
  const simD = simulateElementTimeline({
    grade: 'normal', duration: 12, enemy: { res: 0 },
    streams: [{ atk: 400, dmgMul: 1, interval: 1, el: 'dark', epMul: 0.5, epBase: 'damage' }],
  });
  // 每跳 EP = 400×0.5 = 200 → 5 跳攒满(t=5)爆条 → 12000;cd15 → 窗口覆盖至 t=20(超出 12s 模拟窗)
  check('模拟器 凋亡:5 跳爆条,元素 12000', near(simD.breakCount, 1) && near(simD.breakDmg, 12000), `breaks ${simD.breakCount} dmg ${simD.breakDmg}`);
  // 神经 6000:EP 达容量 → 1 次爆条(领袖容量 2000,每跳 EP 250 → 8 跳)
  const simS = simulateElementTimeline({
    grade: 'leader', duration: 15, enemy: { res: 0 },
    streams: [{ atk: 500, dmgMul: 1, interval: 1, el: 'sanity', epMul: 0.5, epBase: 'damage' }],
  });
  check('模拟器 神经(领袖 2000 容量):8 跳攒满,元素爆条 6000', near(simS.breakCount, 1) && near(simS.breakDmg, 6000), `breaks ${simS.breakCount} dmg ${simS.breakDmg}`);
  // 元素爆发窗口时长:神经=爆发冷却 10s(用户口径:神经窗口 10s,保持现状)、凋亡=持续段 15s、灼燃=减抗窗口 10s
  check('elementBurstDur 神经 = 10s(真言/Christine 窗口)', elementBurstDur('sanity') === 10, `got ${elementBurstDur('sanity')}`);
  check('elementBurstDur 凋亡 = 15s(失魂 DoT 窗口)', elementBurstDur('dark') === 15, `got ${elementBurstDur('dark')}`);
  check('elementBurstDur 灼燃 = 10s(减抗窗口)', elementBurstDur('fire') === 10, `got ${elementBurstDur('fire')}`);
  // 爆条窗口内天赋 DoT(breakDot):凋亡爆条→窗口 15s→间隔 1s(每 0.8/0.7s 由 Y 模组改写)→ 跳数×atk×scale
  const simDot = simulateElementTimeline({
    grade: 'normal', duration: 6, enemy: { res: 0 },
    streams: [{ atk: 400, dmgMul: 1, interval: 1, el: 'dark', epMul: 0.5, epBase: 'damage' }],
    breakDot: { el: 'dark', atk: 400, scale: 0.4, interval: 1 },
  });
  // 每跳 EP=200 → 5 跳(t=5)爆条 12000;窗口 15s → 15 跳 ×(400×0.4)=2400
  check('模拟器 breakDot:凋亡爆条 12000 + 失魂式 DoT 15×400×0.4', near(simDot.breakDmg, 12000) && near(simDot.dotDmg, 15 * 400 * 0.4) && near(simDot.element, 12000 + 15 * 400 * 0.4), `bd ${simDot.breakDmg} dot ${simDot.dotDmg} el ${simDot.element}`);
}

console.log(`verify-primcaster: ${pass} 通过, ${fail} 失败`);
if (fail > 0) process.exit(1);
