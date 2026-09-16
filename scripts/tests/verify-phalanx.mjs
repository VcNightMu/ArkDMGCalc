// 阵法术师(phalanx)引擎验证
// 特性:通常时不攻击 → 常态 DPS 恒为 0(技能槽同样为 0);防御/法抗大幅提升属防御向,不入面板。
// 模型:技能期 = 技能期普攻(面板攻击力×技能期攻击加成,间隔按面板/技能攻速) + 特殊项:
//   每击最终倍率(「每次攻击造成相当于攻击力 X% 的法术伤害」)、攻击力线性递增、DoT(积雪)、技能结束/出现时一次性爆发。
// 覆盖:常态 0 不变式、圣聆初雪(S1 充能一击/S2 每击+积雪DoT/S3 每击倍率)、薄绿(S1 每击/S2 每击+结束爆发)、
//   蜜蜡(S1 每击/S2 出现爆发且每击正常)、林(S1 间隔+1.0/S2 攻速/S3 攻击力)、卡涅利安(S1/S2 间隔/S3 线性递增+蓄力增伤)、模块档
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
const X = (id, lv = 3) => ({ moduleId: 'uniequip_002_' + id, moduleLevel: lv });

const sbell = load('char_1046_sbell2'), lin = load('char_4080_lin'), billro = load('char_426_billro'), mint = load('char_388_mint'), beewax = load('char_344_beewax');

// ===== 常态不变式:五人均为 0 =====
const n0 = { sbell: calculateOperator(sbell, mk(sbell, -1, null)), lin: calculateOperator(lin, mk(lin, -1, null)), billro: calculateOperator(billro, mk(billro, -1, null)), mint: calculateOperator(mint, mk(mint, -1, null)), beewax: calculateOperator(beewax, mk(beewax, -1, null)) };
check('圣聆初雪 无技能 常态DPS=0(通常时不攻击)', near(n0.sbell.normalDps, 0, 1e-9), n0.sbell.normalDps);
check('林 无技能 常态DPS=0', near(n0.lin.normalDps, 0, 1e-9), n0.lin.normalDps);
check('卡涅利安 无技能 常态DPS=0', near(n0.billro.normalDps, 0, 1e-9), n0.billro.normalDps);
check('薄绿 无技能 常态DPS=0', near(n0.mint.normalDps, 0, 1e-9), n0.mint.normalDps);
check('蜜蜡 无技能 常态DPS=0', near(n0.beewax.normalDps, 0, 1e-9), n0.beewax.normalDps);
const sbellX3 = calculateOperator(sbell, mk(sbell, -1, X('sbell2')));
check('圣聆初雪(装模组)无技能 常态DPS=0', near(sbellX3.normalDps, 0, 1e-9), sbellX3.normalDps);

// ===== 圣聆初雪 char_1046_sbell2 E2L90 满信赖 atk 916 =====
check('圣聆初雪 面板 atk=916', near(n0.sbell.panelAtk, 916, 0.01), n0.sbell.panelAtk);
const s1 = calculateOperator(sbell, mk(sbell, 0, null));
const s2 = calculateOperator(sbell, mk(sbell, 1, null));
const s3 = calculateOperator(sbell, mk(sbell, 2, null));
check('圣聆初雪S1 常态=0', near(s1.normalDps, 0, 1e-9), s1.normalDps);
check('圣聆初雪S1 充能1次打1次(单次 520% 面板法伤)', near(s1.skillTotalDamage, A(916 * 5, 50), 0.5), s1.skillTotalDamage);
check('圣聆初雪S2 常态=0', near(s2.normalDps, 0, 1e-9), s2.normalDps);
check('圣聆初雪S2 每击 360% + 每秒 20% 积雪DoT(永续按 DPS)', near(s2.skillDps, A(916 * 3.6, 50) / 2 + A(916 * 0.2, 50), 0.5), s2.skillDps);
check('圣聆初雪S3 每击 230%(攻击力+80%、攻速+30、法穿10)', near(s3.skillTotalDamage, A(916 * 1.8 * 2.3, 50) * Math.floor(35 / (2 * 100 / 130)), 1), s3.skillTotalDamage);
const sbellX3s2 = calculateOperator(sbell, mk(sbell, 1, X('sbell2')));
check('圣聆初雪 X 模组L3 S2 每击 360%+积雪DoT(面板 991)', near(sbellX3s2.skillDps, A(991 * 3.6, 50) / 2 + A(991 * 0.2, 50), 0.5), sbellX3s2.skillDps);

// ===== 薄绿 char_388_mint E2L90 满信赖 atk 807 =====
check('薄绿 面板 atk=807', near(n0.mint.panelAtk, 807, 0.01), n0.mint.panelAtk);
const m1 = calculateOperator(mint, mk(mint, 0, null));
const m2 = calculateOperator(mint, mk(mint, 1, null));
check('薄绿S1 每击 145%', near(m1.skillTotalDamage, A(807 * 1.45, 50) * Math.floor(18 / 2), 0.5), m1.skillTotalDamage);
check('薄绿S2 每击 120% + 技能结束 260% 范围爆发(非每击260%)', near(m2.skillTotalDamage, A(807 * 1.2, 50) * 10 + A(807 * 2.6, 50), 0.5), m2.skillTotalDamage);
check('薄绿S2 常态=0', near(m2.normalDps, 0, 1e-9), m2.normalDps);
const mintX = calculateOperator(mint, mk(mint, 1, X('mint', 1)));
check('薄绿 X 模组L1 S2 每击120%+结束260%(面板 847)', near(mintX.skillTotalDamage, A(847 * 1.2, 50) * 10 + A(847 * 2.6, 50), 0.5), mintX.skillTotalDamage);

// ===== 蜜蜡 char_344_beewax E2L90 满信赖 atk 805 =====
check('蜜蜡 面板 atk=805', near(n0.beewax.panelAtk, 805, 0.01), n0.beewax.panelAtk);
const w1 = calculateOperator(beewax, mk(beewax, 0, null));
const w2 = calculateOperator(beewax, mk(beewax, 1, null));
check('蜜蜡S1 每击 145%', near(w1.skillTotalDamage, A(805 * 1.45, 50) * Math.floor(18 / 2), 0.5), w1.skillTotalDamage);
check('蜜蜡S2 技能期普攻正常倍率 + 方尖塔出现 250% 一次性', near(w2.skillTotalDamage, A(805, 50) * 10 + A(805 * 2.5, 50), 0.5), w2.skillTotalDamage);
check('蜜蜡S2 不再把 250% 当作每击倍率', w2.skillTotalDamage < A(805 * 2.5, 50) * 10, w2.skillTotalDamage);
check('蜜蜡S2 常态=0', near(w2.normalDps, 0, 1e-9), w2.normalDps);
const beewaxX = calculateOperator(beewax, mk(beewax, 1, X('beewax')));
check('蜜蜡 X 模组L3 S2 普攻+250%爆发(面板 875)', near(beewaxX.skillTotalDamage, A(875, 50) * 10 + A(875 * 2.5, 50), 0.5), beewaxX.skillTotalDamage);

// ===== 林 char_4080_lin E2L90 满信赖 atk 919 =====
check('林 面板 atk=919', near(n0.lin.panelAtk, 919, 0.01), n0.lin.panelAtk);
const l1 = calculateOperator(lin, mk(lin, 0, null));
const l2 = calculateOperator(lin, mk(lin, 1, null));
check('林S1 切换型:攻击力+45%、间隔+1.0(2.0→3.0)', near(l1.realInterval, 3.0, 0.01) && near(l1.skillDps, A(919 * 1.45, 50) / 3, 0.5), l1.skillDps);
check('林S2 攻速+100%(间隔 1.0)', near(l2.realInterval, 1.0, 0.01) && near(l2.skillTotalDamage, A(919, 50) * Math.floor(25 / 1.0), 0.5), l2.skillTotalDamage);
check('林S1/S2 常态=0', near(l1.normalDps, 0, 1e-9) && near(l2.normalDps, 0, 1e-9));

// ===== 卡涅利安 char_426_billro E2L90 满信赖 atk 926 =====
check('卡涅利安 面板 atk=926', near(n0.billro.panelAtk, 926, 0.01), n0.billro.panelAtk);
const b1 = calculateOperator(billro, mk(billro, 0, null));
const b2 = calculateOperator(billro, mk(billro, 1, null));
const b3 = calculateOperator(billro, mk(billro, 2, null));
check('卡涅利安S1 攻击力+45%', near(b1.skillTotalDamage, A(926 * 1.45, 50) * Math.floor(18 / 2), 0.5), b1.skillTotalDamage);
check('卡涅利安S2 攻击力+15%、间隔-0.8(2.0→1.2)', near(b2.realInterval, 1.2, 0.01) && near(b2.skillTotalDamage, A(926 * 1.15, 50) * Math.floor(24 / 1.2), 0.5), b2.skillTotalDamage);
check('卡涅利安S3 攻击力 20s 内线性递增(非按终值) + 蓄力增伤线性', near(b3.skillTotalDamage, 13962.757142857145, 1), b3.skillTotalDamage);
check('卡涅利安S3 常态=0', near(b3.normalDps, 0, 1e-9), b3.normalDps);
const billroX3 = calculateOperator(billro, mk(billro, 2, X('billro')));
check('卡涅利安 X 模组L3 S3 同步线性(面板 1011)', near(billroX3.skillTotalDamage, 15244.435714285715, 1), billroX3.skillTotalDamage);

console.log('阵法术师(phalanx) 验证: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
