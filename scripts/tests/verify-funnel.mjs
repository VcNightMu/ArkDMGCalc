// 驭械术师(funnel)引擎验证
// 特性:本体普攻 100% + 浮游单元(scale 叠层:初始 init,每次命中同一目标 +delta,上限 max)
//   单目标模型:既有单元默认满层(max);技能期新增单元(levelData['attack@cnt'])从 0 起叠,按其技能期攻击次数取平均。
// 覆盖:常态/技能期当量、技能期新增单元、技能被动新增(荒芜S1 +1)、停止攻击(澄闪S3)、模块特性覆盖(X/Y)、
//   天赋(耶拉低眉/洛洛满层/时隙/卡达攻速/澄闪法穿)、荒芜头狼(单元+1 且上限×scale)、洛洛S2(上限×1.8 且常态减半)、
//   澄闪自爆(每击 10%×自爆倍率)、荒芜S3 单元光环(每单元每 attack@times 秒 attack@magic_atk_scale×攻击力)、至简S2(点燃类两连击)。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const idx = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
function load(id) {
  const e = idx.find(x => x.id === id);
  return JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8'));
}
const A = (atk, res) => Math.max(atk * (100 - res) / 100, atk * 0.05);
const near = (a, b, tol = 0.05) => typeof a === 'number' && Math.abs(a - b) <= tol;
let pass = 0, fail = 0;
const check = (n, ok, extra = '') => { if (ok) pass++; else { fail++; console.log('FAIL: ' + n + (extra !== '' ? ' => ' + extra : '')); } };
const mk = (o, si, module) => ({ elite: o.phases.length - 1, level: o.phases[o.phases.length - 1].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module });
// 新增单元平均 scale:第 k 次攻击(0 起) scale = min(init + k·delta, cap)
const avgNew = (n, init, delta, cap) => { let s = 0; for (let k = 0; k < n; k++) s += Math.min(init + k * delta, cap); return s / n; };
const Y3 = { moduleId: 'uniequip_003_gdglow', moduleLevel: 3 };
const X3 = { moduleId: 'uniequip_002_gdglow', moduleLevel: 3 };

// ===== 澄闪 char_377_gdglow E2L90 满信赖 atk 391;特性 0.2/+0.15/1.1;精准导流无视15法抗;信标的愤怒自爆 ×3.0(E2 pot0) =====
const gd = load('char_377_gdglow');
const gEffRes = 50 - 15;
const g0 = calculateOperator(gd, mk(gd, -1, null));
check('澄闪 面板 atk=391', near(g0.panelAtk, 391, 0.01), g0.panelAtk);
check('澄闪 无技能 常态=本体+单元满层(2.1×面板法伤/1.3)', near(g0.normalDps, A(391, gEffRes) * 2.1 / 1.3), g0.normalDps);
const g1 = calculateOperator(gd, mk(gd, 0, null));
check('澄闪S1 常态不因技能期新增单元而变(2.1×当量)', near(g1.normalDps, A(391, gEffRes) * 2.1 / 1.3), g1.normalDps);
// S1: 攻击力+34%、攻速+42、attack@cnt=1、自爆每击 +10%×3.0
const g1Atk = 391 * 1.34, g1N = Math.floor(25 / (1.3 * 100 / 142));
const g1Mul = 2.1 + 1 * avgNew(g1N, 0.2, 0.15, 1.1) + 0.1 * 3.0;
check('澄闪S1 技能期=本体+既有满层+新增单元(均叠层)+自爆期望', near(g1.skillTotalDamage, A(g1Atk, gEffRes) * g1Mul * g1N, 1), g1.skillTotalDamage);
// S3: 停止攻击、attack@cnt=2、攻击力+60%
const g3 = calculateOperator(gd, mk(gd, 2, null));
const g3N = Math.floor(30 / 1.3);
const g3Mul = 0 + 1.1 + 2 * avgNew(g3N, 0.2, 0.15, 1.1) + 0.1 * 3.0;   // 本体停止 → 无 1.0 项
check('澄闪S3 本体停止攻击,技能期=既有单元满层+2新增+自爆期望', near(g3.skillTotalDamage, A(391 * 1.6, gEffRes) * g3Mul * g3N, 1), g3.skillTotalDamage);
const g2 = calculateOperator(gd, mk(gd, 1, null));
check('澄闪S2(永续) 常态行照常展示=2.1×当量', near(g2.normalDps, A(391, gEffRes) * 2.1 / 1.3), g2.normalDps);
check('澄闪S2(永续) 新增单元长线叠满(2.1+1.1+0.3=3.5×当量/1.3)', near(g2.skillDps, A(391 * 1.5, gEffRes) * 3.5 / 1.3, 0.5), g2.skillDps);
// 模组:Y3 特性上限 1.2(常态 2.2×当量,法穿 20);X3 自爆倍率 3.6 → 每击 +0.36
const gY = calculateOperator(gd, mk(gd, -1, Y3));
check('澄闪+Y模组L3 特性上限1.2 → 常态 2.2×当量(法穿20)', near(gY.normalDps, A(436, 50 - 20) * 2.2 / (1.3 * 100 / 107), 1), gY.normalDps);
const gX = calculateOperator(gd, mk(gd, 0, X3));
const gXN = Math.floor(25 / (1.3 * 100 / 142));
check('澄闪+X模组L3 自爆倍率3.6 → S1 技能期每击 +0.36', near(gX.skillTotalDamage, A(574.86, gEffRes) * (2.1 + avgNew(gXN, 0.35, 0.15, 1.1) + 0.36) * gXN, 1), gX.skillTotalDamage);

// ===== 荒芜拉普兰德 char_1038_whitw2 atk 402;「头狼」默认全部获得:单元+1 且上限×1.1(1.1→1.21);S1被动单元+1 =====
const wh = load('char_1038_whitw2');
const w0 = calculateOperator(wh, mk(wh, -1, null));
check('荒芜 无技能 常态=本体+2单元×1.21(3.42×当量)', near(w0.normalDps, A(402, 50) * (1 + 2 * 1.21) / 1.3), w0.normalDps);
const w1 = calculateOperator(wh, mk(wh, 0, null));
check('荒芜S1 被动单元+1 → 常态 4.63×当量(共3单元)', near(w1.normalDps, A(402, 50) * (1 + 3 * 1.21) / 1.3), w1.normalDps);
check('荒芜S1(切换) 技能期=本体+3单元满层', near(w1.skillDps, A(402 * 1.27, 50) * (1 + 3 * 1.21) / 1.3, 0.5), w1.skillDps);
const w2 = calculateOperator(wh, mk(wh, 1, null));
const w2N = Math.floor(20 / 1.3);
const w2Mul = 1 + 2 * 1.21 + 3 * avgNew(w2N, 0.2, 0.15, 1.21);
check('荒芜S2 技能期=本体+2既有满层+3新增(按叠层均,上限1.21)', near(w2.skillTotalDamage, A(402 * 1.95, 50) * w2Mul * w2N, 1), w2.skillTotalDamage);
// S3: attack@cnt 2 + 每个单元每 attack@times 秒造成 attack@magic_atk_scale×攻击力 法伤(光环)
const w3 = calculateOperator(wh, mk(wh, 2, null));
const w3N = Math.floor(40 / 1.3);
const w3Mul = 1 + 2 * 1.21 + 2 * avgNew(w3N, 0.2, 0.15, 1.21) + (2 + 2) * 1.0 * (1.3 / 1.3);
check('荒芜S3 技能期=本体+单元攻击+4单元光环(每单元100%法伤/1.3s)', near(w3.skillTotalDamage, A(402 * 1.65, 50) * w3Mul * w3N, 1), w3.skillTotalDamage);

// ===== 洛洛 char_4040_rockr 「立于磐石」满层+16%;S2 自负此轭:特性上限×1.8、常态因过载减半 =====
const rk = load('char_4040_rockr');
const rk0 = calculateOperator(rk, mk(rk, -1, null));
check('洛洛 立于磐石 满层+16% 入面板', near(rk0.panelAtk, (320 + (rk.trustBonus ? rk.trustBonus.atk : 0)) * 1.16, 0.5), rk0.panelAtk);
check('洛洛 无技能 常态=2.1×当量', near(rk0.normalDps, A(rk0.panelAtk, 50) * 2.1 / 1.3, 0.5), rk0.normalDps);
const rk2 = calculateOperator(rk, mk(rk, 1, null));
check('洛洛S2 常态因技能后过载(20s/40s)减半', near(rk2.normalDps, A(rk0.panelAtk, 50) * 2.1 / 1.3 * 0.5, 0.5), rk2.normalDps);
// 洛洛 S2 两段计量槽:前 20s 只有攻速(上限 1.1),后 20s 过载(上限 ×1.8、攻击力+50%)
const rkRaw = 320 + (rk.trustBonus ? rk.trustBonus.atk : 0);
const rkPanel = rk0.panelAtk, rkSkillAtk = rkRaw * (1 + 0.16 + 0.5), rkI = 1.3 * 100 / 165;
const rkN1 = Math.floor(20 / rkI), rkN2 = Math.floor(20 / rkI), rkDen = Math.floor(40 / rkI);
const rkx1 = 1 + 1 * 1.1, rkx2 = 1 + 1 * (1.1 * 1.8);
const rk2Mul = (rkx1 * rkN1 * (rkPanel / rkSkillAtk) + rkx2 * rkN2) / rkDen;
check('洛洛S2 分段:前20s仅攻速,后20s过载(上限1.98/攻击力+50%)', near(rk2.skillTotalDamage, A(rkSkillAtk, 50) * rk2Mul * rkDen, 1), rk2.skillTotalDamage);

// ===== 至简 char_4054_malist S2 神工意匠:点燃类 = 下次攻击 1.7×atk 法伤 × 两连击 =====
const ml = load('char_4054_malist');
const m2 = calculateOperator(ml, mk(ml, 1, null));
const m0 = calculateOperator(ml, mk(ml, -1, null));
check('至简S2 点燃类:1.7×atk×2连击×当量', near(m2.skillTotalDamage, A(m0.panelAtk * 1.7, 50) * 2 * 2.1, 1), m2.skillTotalDamage);
check('至简S2(持续0) 常态行照常展示=2.1×当量', near(m2.normalDps, A(m0.panelAtk, 50) * 2.1 / 1.3, 0.5), m2.normalDps);

// ===== 模组追加攻速(洛洛 X3「叠满后攻速+5」/ 荒芜 X3「叙拉古的荣幸 攻速+10」) =====
const rkX = calculateOperator(rk, mk(rk, -1, { moduleId: 'uniequip_002_rockr', moduleLevel: 3 }));
check('洛洛+X模组L3 叠满后攻速+5 → 面板间隔 1.3×100/105', near(rkX.realInterval, 1.3 * 100 / 105), rkX.realInterval);
const whX = calculateOperator(wh, mk(wh, -1, { moduleId: 'uniequip_002_whitw2', moduleLevel: 3 }));
check('荒芜+X模组L3 叙拉古荣幸攻速+10 → 面板间隔 1.3×100/110', near(whX.realInterval, 1.3 * 100 / 110), whX.realInterval);

// ===== 卡达 char_328_cammou 攻速天赋「协调一致」+12(精2) =====
const cm = load('char_328_cammou');
const c0 = calculateOperator(cm, mk(cm, -1, null));
check('卡达 常态 间隔=1.3×100/112', near(c0.realInterval, 1.3 * 100 / 112), c0.realInterval);
check('卡达 常态=2.1×当量(含攻速天赋)', near(c0.normalDps, A(375, 50) * 2.1 / (1.3 * 100 / 112)), c0.normalDps);

// ===== 耶拉 char_4013_kjera 「低眉」攻击力+10%(无条件档;地形版+16%不计) =====
const kj = load('char_4013_kjera');
const k0 = calculateOperator(kj, mk(kj, -1, null));
check('耶拉 低眉 攻击力+10% 入面板', near(k0.panelAtk, (294 + (kj.trustBonus ? kj.trustBonus.atk : 0)) * 1.1, 0.5), k0.panelAtk);
check('耶拉 常态=2.1×当量', near(k0.normalDps, A(k0.panelAtk, 50) * 2.1 / 1.3, 0.5), k0.normalDps);

// ===== 时隙 char_4236_tmslot 「新产品测评」攻击力+8%;S2「科技与传统仪式」过载:本体停止攻击 =====
const ts = load('char_4236_tmslot');
const t0 = calculateOperator(ts, mk(ts, -1, null));
const tRaw = 340 + (ts.trustBonus ? ts.trustBonus.atk : 0);   // rawAtk(基准340 + 满信赖45 = 385)
check('时隙 面板 atk=rawAtk×1.08(新产品测评)', near(t0.panelAtk, tRaw * 1.08, 0.5), t0.panelAtk);
check('时隙 无技能 常态=2.1×当量', near(t0.normalDps, A(t0.panelAtk, 50) * 2.1 / 1.3, 0.5), t0.normalDps);
const t2 = calculateOperator(ts, mk(ts, 1, null));
const t2N = Math.floor(40 / (1.3 * 100 / 155));
// 分段:前 20s 未过载(本体+既有单元+新增单元按前半段叠层),后 20s 过载(本体停攻,2 单元满层)
const t1I = 1.3, t2I = 1.3 * 100 / 155;
const tn1 = Math.floor(20 / t1I), tn2 = Math.floor(20 / t2I), tden = Math.floor(40 / t2I);
const tx1 = 1 + 1 * 1.1 + 1 * avgNew(tn1, 0.2, 0.15, 1.1);
const tx2 = 0 + 2 * 1.1;
const tMul = (tx1 * tn1 * (t0.panelAtk / (tRaw * 1.48)) + tx2 * tn2) / tden;
check('时隙S2 分段:前半段本体+2单元未过载,后半段过载(本体停攻,单元吃增幅)', near(t2.skillTotalDamage, A(tRaw * 1.48, 50) * tMul * tden, 1), t2.skillTotalDamage);
check('时隙S2 常态仍=2.1×当量(过载不改变常态单元数)', near(t2.normalDps, A(t0.panelAtk, 50) * 2.1 / 1.3, 0.5), t2.normalDps);

console.log(`驭械术师验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
