// 链愈师（chainhealer）验证：明椒/莎草/乌啾/Mon3tr(干员本体)
// 通用口径：默认仅治疗 1 人（第一跳 100%），不考虑跳跃治疗量降低（trait 0.75 衰减不入引擎）；
// 普攻治疗 = 攻击力 × 1.0（与医师同模板），攻击间隔 2.85s
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/MEDIC/chainhealer/';
const load = n => JSON.parse(fs.readFileSync(BASE + n, 'utf8'));
const mk = (op, si, sl = 7, module = null) => ({ elite: 2, level: op.phases[2].maxLevel, trustPercent: 100, potentialRank: 0, module, skillIndex: si, skillLevel: sl });
let pass = 0, fail = 0;
const near = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;
const check = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL: ' + name); } };

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

// ===== 数据层 =====
const peper = load('char_4071_peper.json');   // 明椒 5★
const papyrs = load('char_4139_papyrs.json'); // 莎草 5★
const turdus = load('char_4224_turdus.json'); // 乌啾 5★
const monstr = load('char_4179_monstr.json'); // Mon3tr 6★
for (const [op, n] of [[peper, '明椒'], [papyrs, '莎草'], [turdus, '乌啾'], [monstr, 'Mon3tr']]) {
  check(`${n} 子职业=chainhealer`, op.subProfessionId === 'chainhealer');
  check(`${n} trait跳跃衰减0.75已记录`, Math.abs((op.trait.blackboard['attack@chain.atk_scale'] ?? 0) - 0.75) < 1e-9);
  check(`${n} 攻击间隔2.85s`, Math.abs(op.phases[2].baseAttackTime - 2.85) < 1e-9);
}
check('明椒 2技能', peper.skills.length === 2);
check('莎草 2技能', papyrs.skills.length === 2);
check('乌啾 2技能', turdus.skills.length === 2);
check('Mon3tr 3技能', monstr.skills.length === 3);

// ===== 通用：普攻治疗 = 攻击力×1.0/2.85（无跳跃衰减，默认单目标第一跳）=====
const healHps = op => {
  const atk = calcPanelStats(op, mk(op, 0, 7)).panelAtk;
  return atk / 2.85;
};
for (const [op, n] of [[peper, '明椒'], [papyrs, '莎草'], [turdus, '乌啾']]) {
  const r = calculateOperator(op, mk(op, -1, 7, null));
  check(`${n} 常态HPS=面板/2.85（跳跃衰减不计）`, near(r.normalHps, healHps(op)));
  check(`${n} 常态无普攻伤害`, r.normalDps === null || r.normalDps === undefined);
}

// ===== 明椒 S1「掩护作战·γ型」：攻速+65% 持续30s（无 atk），治疗频率提升 =====
const p1 = calculateOperator(peper, mk(peper, 0, 7, null));
const pAtk = calcPanelStats(peper, mk(peper, 0, 7)).panelAtk;
const pInt = 2.85 * 100 / (100 + 65);
check('明椒S1 间隔含攻速65', near(p1.realInterval, pInt, 1e-3));
check('明椒S1 技能期HPS=面板/间隔', near(p1.skillHps, pAtk / pInt));
check('明椒S1 总治疗=面板×次数', near(p1.totalHeal, pAtk * Math.floor(30 / pInt)));
check('明椒S1 无技能伤害', p1.skillTotalDamage === 0);

// ===== 乌啾 S1「火钳秘咒」：攻速+60% 持续25s（跳跃+1 的 extra_value 单目标模型忽略）=====
const u1 = calculateOperator(turdus, mk(turdus, 0, 7, null));
const uAtk = calcPanelStats(turdus, mk(turdus, 0, 7)).panelAtk;
const uInt = 2.85 * 100 / (100 + 60);
check('乌啾S1 间隔含攻速60', near(u1.realInterval, uInt, 1e-3));
check('乌啾S1 技能期HPS', near(u1.skillHps, uAtk / uInt));
check('乌啾S1 总治疗（extra_value跳跃忽略）', near(u1.totalHeal, uAtk * Math.floor(25 / uInt)));

// ===== Mon3tr：数据齐备（天赋/技能机制特殊，另行讨论）=====
check('Mon3tr 天赋2战术协同 attack_speed 数据在', (monstr.talents[1].candidates[2].blackboard.attack_speed ?? 0) >= 20);

// ===== Mon3tr 天赋2「战术协同」常驻：治疗触发攻速+20（E2）持续10s无法叠加，每2.85s治疗刷新 → 等效常驻 =====
const mPs = calcPanelStats(monstr, mk(monstr, 0, 7));
const mAtk = mPs.panelAtk;
const mNormal = calculateOperator(monstr, mk(monstr, -1, 7, null));
const mIntNorm = 2.85 * 100 / 120;   // 常驻攻速+20
check('Mon3tr 常态间隔含天赋攻速20', near(mNormal.realInterval, mIntNorm, 1e-3));
check('Mon3tr 常态HPS=面板/间隔(攻速后)', near(mNormal.normalHps, mAtk / mIntNorm));

// ===== Mon3tr S1「超压链接」：攻回sp3自动触发，下次治疗1.8倍（絮雨模式：替代型扣普攻重叠）=====
const m1 = calculateOperator(monstr, mk(monstr, 0, 7, null));
check('Mon3trS1 触发单次=面板×1.8', near(m1.totalHeal, mAtk * 1.8));
check('Mon3trS1 周期HPS=(3普攻+0.8增量)/8.55s', near(m1.cycleHps, (mAtk * 3 + mAtk * 0.8) / (3 * 2.85)));

// ===== Mon3tr S2「超负荷」：天赋2攻速×talent_scale(2.5)=50 → 间隔1.9s，普攻治疗照常 =====
const m2 = calculateOperator(monstr, mk(monstr, 1, 7, null));
const m2Int = 2.85 * 100 / (100 + 20 * 2.5);
check('Mon3trS2 间隔=2.85/150(攻速50)', near(m2.realInterval, m2Int, 1e-3));
check('Mon3trS2 技能期HPS=面板/1.9', near(m2.skillHps, mAtk / m2Int));
check('Mon3trS2 总治疗=面板×次数(15击)', near(m2.totalHeal, mAtk * Math.floor(30 / m2Int)));

// ===== Mon3tr S3「熔毁」：真伤输出+每击自疗0.5；间隔(2.85-1.5)/1.2=1.125s，25s内22击 =====
const m3 = calculateOperator(monstr, mk(monstr, 2, 7, null));
const m3Int = (2.85 - 1.5) * 100 / 120;
const m3Atk = mAtk * (1 + 3);          // atk+300%
const m3Attacks = Math.floor(25 / m3Int);
check('Mon3trS3 间隔1.125s', near(m3.realInterval, m3Int, 1e-3));
check('Mon3trS3 damageType=true', m3.damageType === 'true');
check('Mon3trS3 总伤=真伤×22击', near(m3.skillTotalDamage, m3Atk * m3Attacks));
check('Mon3trS3 总治疗=每击自疗0.5×22', near(m3.totalHeal, m3Atk * 0.5 * m3Attacks));
check('Mon3trS3 技能期HPS=自疗/1.125', near(m3.skillHps, m3Atk * 0.5 / m3Int));

// ===== 明椒 S2「同伴意识」：atk+60%通用（跳跃+1与天赋触发条件放宽在单目标模型无意义）=====
const p2 = calculateOperator(peper, mk(peper, 1, 7, null));
check('明椒S2 技能期ATK=面板×1.6', near(p2.panelAtk, pAtk * 1.6, 1));
check('明椒S2 总治疗=加攻普攻×8击(25s/2.85)', near(p2.totalHeal, pAtk * 1.6 * Math.floor(25 / 2.85)));
check('明椒S2 技能期HPS', near(p2.skillHps, pAtk * 1.6 / 2.85));

// ===== 莎草 S1「巧思乍现」：AUTO充能触发，下次治疗1.8倍（末药模式一次性，sp8）=====
const pap1 = calculateOperator(papyrs, mk(papyrs, 0, 7, null));
const papAtk = calcPanelStats(papyrs, mk(papyrs, 0, 7)).panelAtk;
check('莎草S1 触发总量=面板×1.8', near(pap1.totalHeal, papAtk * 1.8));
const papDelay = Math.ceil(8 / 2.85) * 2.85 - 8;
const papCycle = 8 + papDelay;
check('莎草S1 周期HPS(末药模式)', near(pap1.cycleHps, papAtk / 2.85 + papAtk * 1.8 / papCycle));

// ===== 莎草 S2「临考发挥」：atk+40% + 间隔-1.1s(=1.75s)，虚拟目标=正常奶人 =====
const pap2 = calculateOperator(papyrs, mk(papyrs, 1, 7, null));
check('莎草S2 间隔1.75s', near(pap2.realInterval, 1.75, 1e-3));
check('莎草S2 技能期HPS=加攻普攻/1.75', near(pap2.skillHps, papAtk * 1.4 / 1.75));
check('莎草S2 总治疗=加攻普攻×8击(15s/1.75)', near(pap2.totalHeal, papAtk * 1.4 * Math.floor(15 / 1.75)));

// ===== 乌啾 S2「捉迷藏！」：立即治疗一次+每秒HOT 0.29×攻击力×12s =====
const u2 = calculateOperator(turdus, mk(turdus, 1, 7, null));
const u2Total = uAtk + uAtk * 0.29 * 12;   // 普攻立即 + HOT×12秒
check('乌啾S2 总治疗=立即普攻+HOT×12s', near(u2.totalHeal, u2Total));
check('乌啾S2 周期HPS=(常态×38+触发总量)/38', near(u2.cycleHps, (uAtk / 2.85 * 38 + u2Total) / 38));

console.log(`\n链愈师验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
