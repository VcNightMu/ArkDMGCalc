// 本源铁卫(primprotector)验证：余(灼燃)/珊比(侵蚀)/响石(神经)元素损伤时间轴 + 菲莱/裂响防御向
// 敌人默认 def600 res50；元素:灼燃爆7000/侵蚀5000/神经6000；EP 普通1000
import { calculateOperator, calcPanelStats } from '../../src/frontend/js/damage-calc.js';
import { simulateSkillTimeline, steadyElementDps, breakTotalDmg, EP_CAPACITY } from '../../src/frontend/js/element-calc.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/TANK/primprotector/';
const load = n => JSON.parse(fs.readFileSync(BASE + n + '.json', 'utf8'));
const mk = (op, si, sl = 6) => ({ elite: 2, level: op.phases[2].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: sl });
let pass = 0, fail = 0;
const near = (a, b, eps = 0.6) => Math.abs(a - b) <= eps;
const check = (name, ok) => { if (ok) pass++; else { fail++; console.log('FAIL: ' + name); } };
const hitPhys = (atk, d = 600) => Math.max(atk - d, atk * 0.05);
const hitArts = (atk, r = 50) => Math.max(atk * (100 - r) / 100, atk * 0.05);
const mkEnemy = (grade = 'normal') => { const { state } = globalThis; return null; };

// 元素爆表数据层
check('灼燃爆条 7000', breakTotalDmg('fire') === 7000);
check('侵蚀爆条 5000', breakTotalDmg('water') === 5000);
check('神经爆条 6000', breakTotalDmg('sanity') === 6000);
check('EP 普通=1000 领袖=2000', EP_CAPACITY.normal === 1000 && EP_CAPACITY.leader === 2000);

// ===== 余：常态 =====
const yu = load('char_2026_yu');
const yuPan = calcPanelStats(yu, mk(yu, 0, 6));
check('余 E2 atk=715', near(yuPan.panelAtk, 715, 1));
// 常态：普攻物伤 dps + 每秒 0.4×atk 法伤（res50→×0.5）+ 灼燃 0.12×715=85.8/s 稳态（1000/85.8≈12秒爆+10s CD → 周期≈22s → 7000/22≈318）
const yu0 = calculateOperator(yu, mk(yu, -1, 6));
const yuAtk = yuPan.panelAtk;
check('余常态 normalTypes 三档存在', yu0.normalTypes && yu0.normalTypes.physical && yu0.normalTypes.element);
check('余常态物理dps=115/1.6', near(yu0.normalTypes.physical.dps, hitPhys(yuAtk) / 1.6));
check('余常态法伤dps=0.4atk×0.5', near(yu0.normalTypes.arts.dps, hitArts(yuAtk * 0.4)));
// 灼燃稳态：ceil(1000/(0.12×715))=ceil(11.65)=12 事件，breakAt=11s，周期 21s → 7000/21
{
  const st = steadyElementDps('normal', 'fire', yuAtk * 0.12, 1);
  check('余灼燃稳态 breakAt=11s', near(st.breakAt, 11));
  check('余灼燃稳态 周期=21s', near(st.cycleSec, 21));
  check('余常态元素dps=7000/21≈333', near(yu0.normalTypes.element.dps, 7000 / 21, 1));
}

// ===== 余 S1（30s 普攻照常+天赋法伤+灼燃） =====
{
  const r = calculateOperator(yu, mk(yu, 0, 6)); // Lv7：无 atk 增益
  const atk = yuPan.panelAtk;
  // 普攻 30/1.6=18击 × 115；法伤 30跳 × 0.4atk×0.5(res50)；灼燃 30跳×85.8 → t=12 爆一次(冷却10s→22s 后 8 跳 686<1000 不爆)
  const physTotal = hitPhys(atk) * 18;
  // 灼燃爆条 t=12：窗口 [12,22) 内法伤跳吃 res30（t=13..22? 法伤跳 t=1..30，窗口内 t=12..21 共10跳？t=12 与爆条同刻……简化用模拟器对拍）
  const sim = simulateSkillTimeline({
    grade: 'normal', duration: 30, enemy: { def: 600, res: 50 },
    attacks: [{ type: 'physical', atk, interval: 1.6 }],
    dots: [
      { type: 'arts', atk, dmgMul: 0.4, interval: 1 },
      { type: null, atk, epMul: 0.12, el: 'fire', interval: 1 },
    ],
  });
  check('余S1 总伤=模拟器对拍', near(r.skillTotalDamage, sim.physical + sim.arts + sim.element, 1));
  check('余S1 爆条1次', sim.breaks === 1 && near(sim.element, 7000, 1));
  check('余S1 普攻物理=18击', near(sim.physical, hitPhys(atk) * 18, 1));
}

// ===== 余 S2（专三 atk+290%，dur20 普攻变法伤 + 瞬发1×atk群法伤） =====
{
  const r = calculateOperator(yu, mk(yu, 1, 9)); // 专三 levels[9]
  const atk = yuPan.panelAtk;
  const skillAtk = atk * (1 + 2.9);
  const burst = hitArts(skillAtk); // atk_scale=1 瞬发（t=0 无窗口）
  const sim = simulateSkillTimeline({
    grade: 'normal', duration: 20, enemy: { def: 600, res: 50 },
    attacks: [{ type: 'arts', atk: skillAtk, interval: 1.6 }],
    dots: [
      { type: 'arts', atk: skillAtk, dmgMul: 0.4, interval: 1 },
      { type: null, atk: skillAtk, epMul: 0.12, el: 'fire', interval: 1 },
    ],
  });
  check('余S2 总伤=模拟器+瞬发', near(r.skillTotalDamage, sim.physical + sim.arts + sim.element + burst, 1));
  check('余S2 元素=2次爆条×7000', sim.breaks === 2 && near(sim.element, 14000, 1));
  check('余S2 damageType=arts', r.damageType === 'arts');
  check('余S2 技能期dps=总伤/20', near(r.skillDps, r.skillTotalDamage / 20));
  console.log('余S2 详情:', JSON.stringify({ total: Math.round(r.skillTotalDamage), element: Math.round(r.dmgTypes.element.skillTotalDamage), arts: Math.round(r.dmgTypes.arts.skillTotalDamage), breaks: sim.breaks, dps: Math.round(r.skillDps) }));
}

// ===== 余 S3（专三 atk+110%/def+110%/maxHp+110%，dur45：普攻物理+每秒天赋法伤0.4atk+灼燃0.1atk） =====
// 口径：天赋2 闲云隐市为条件天赋(场上≥4干员)默认不触发；S3 赋予全场也改变不了单目标模型只有自身 → 无自回治疗
{
  const r = calculateOperator(yu, mk(yu, 2, 9));
  check('余S3 不抛错且能算', r.skillTotalDamage > 0);
  check('余S3 技能期总伤>0', r.skillTotalDamage > 0);
  check('余S3 天赋2条件不触发→无自回治疗', r.totalHeal === null || r.totalHeal === 0);
  check('余S3 元素灼燃爆条≥2次(45s窗口)', r.dmgTypes && r.dmgTypes.element && r.dmgTypes.element.skillTotalDamage >= 14000);
  check('余S3 三档齐全(物理+法伤+元素)', r.dmgTypes.physical && r.dmgTypes.arts && r.dmgTypes.element);
}

// ===== 珊比：常态（每击附 0.1×atk 侵蚀） =====
const thumpy = load('char_4235_thumpy');
const thPan = calcPanelStats(thumpy, mk(thumpy, 0, 6));
check('珊比 E2 atk=701', near(thPan.panelAtk, 701, 1));
{
  const t0 = calculateOperator(thumpy, mk(thumpy, -1, 6));
  check('珊比常态 normalTypes 含 element', t0.normalTypes && t0.normalTypes.element);
  // 侵蚀稳态：每击 70.1，间隔1.6 → ceil(1000/70.1)=15 击，breakAt=14×1.6=22.4s，CD5 → 周期27.4 → 5000/27.4≈182
  const st = steadyElementDps('normal', 'water', thPan.panelAtk * 0.1, 1.6, 5);
  check('珊比侵蚀稳态 breakAt=22.4s', near(st.breakAt, 22.4));
  check('珊比常态元素dps=5000/27.4', near(t0.normalTypes.element.dps, 5000 / 27.4, 0.5));
}

// ===== 珊比 S1（Lv7 atk+37%，30s，普攻18击附侵蚀） =====
{
  const r = calculateOperator(thumpy, mk(thumpy, 0, 6));
  const atk = thPan.panelAtk * 1.37;
  const sim = simulateSkillTimeline({
    grade: 'normal', duration: 30, enemy: { def: 600, res: 50 },
    attacks: [{ type: 'physical', atk, interval: 1.6 }],
    dots: [{ type: null, atk, epMul: 0.1, el: 'water', interval: 1.6 }],
  });
  check('珊比S1 总伤=模拟器对拍', near(r.skillTotalDamage, sim.physical + sim.element, 1));
  check('珊比S1 侵蚀爆条(18击×96>1000→第11击爆+CD5 至22.6s 后不爆=1次)', sim.breaks === 1 && near(sim.element, 5000, 1));
}

// ===== 响石：常态（每秒 0.09×atk 神经） =====
const cairn = load('char_4214_cairn');
const caPan = calcPanelStats(cairn, mk(cairn, 0, 6));
check('响石 E2 atk=606', near(caPan.panelAtk, 606, 1));
{
  const c0 = calculateOperator(cairn, mk(cairn, -1, 6));
  check('响石常态 normalTypes 含 element', c0.normalTypes && c0.normalTypes.element);
  const st = steadyElementDps('normal', 'sanity', caPan.panelAtk * 0.09, 1);
  check('响石常态元素dps=6000/周期', near(c0.normalTypes.element.dps, st.avgDps, 0.5));
}

// ===== 响石 S2（触发型：10s 每秒 atk_scale×atk 法伤 + 0.1atk 神经；Lv7 atk_scale=0.6） =====
{
  const r = calculateOperator(cairn, mk(cairn, 1, 6));
  const atk = caPan.panelAtk;
  const sim = simulateSkillTimeline({
    grade: 'normal', duration: 10, enemy: { def: 600, res: 50 },
    dots: [
      { type: 'arts', atk, dmgMul: 0.6, interval: 1 },
      { type: null, atk, epMul: 0.1, el: 'sanity', interval: 1 },
    ],
  });
  check('响石S2 法伤=10跳×0.6atk×0.5', near(sim.arts, hitArts(atk * 0.6) * 10, 1));
  check('响石S2 总伤=模拟器', near(r.skillTotalDamage, sim.arts + sim.element, 1));
  check('响石S2 神经不爆(606<1000)', sim.breaks === 0);
}

// ===== 菲莱/裂响防御向 =====
const philae = load('char_4148_philae');
const philaeS1 = calculateOperator(philae, mk(philae, 0, 6));
check('菲莱S1 纯防御普攻照常（skillDps≈0 归常态）', philaeS1.skillTotalDamage === 0 || philaeS1.normalDps > 0);
const tanya = load('char_4225_tanya');
const tanyaS2 = calculateOperator(tanya, mk(tanya, 1, 6));
check('裂响S2 防御叠层（普攻照常）', tanyaS2.normalDps > 0);

console.log(`\n本源铁卫验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
