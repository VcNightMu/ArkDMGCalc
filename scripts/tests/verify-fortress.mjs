// 要塞（fortress）验证：号角/灰毫/火哨，远程炮击 interval 2.8s 物理
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { calcArtsDamage, calcPhysicalDamage } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

const B = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/TANK/fortress/';
const load = n => JSON.parse(fs.readFileSync(B + n + '.json', 'utf8'));
const mk = (op, si) => {
  const e = Math.min(2, op.phases.length - 1);
  return { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7 };
};
const near = (a, b, eps = 0.8) => Math.abs(a - b) <= eps;
const A = atk => calcArtsDamage(atk, 50);
const P = atk => calcPhysicalDamage(atk, 600);
let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL: ' + name); } };

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50 };

const horn = load('char_4039_horn');
const ashlok = load('char_431_ashlok');
const firwhl = load('char_493_firwhl');
const ps = op => calcPanelStats(op, mk(op, -1));
const sk = (op, si) => calculateOperator(op, mk(op, si));

check('要塞 3人', [horn, ashlok, firwhl].every(o => o.subProfessionId === 'fortress'));

// ===== 号角（天赋1 军事要塞 atk+20% 入表；天赋2 血战不计）=====
const hPs = ps(horn);
const hRaw = horn.phases[2].atk[1] + horn.trustBonus.atk;
const hP = hRaw * 1.2;                       // 精确技能期白值（未取整，引擎内部用）
check('号角 面板atk含军事要塞×1.2', near(hPs.panelAtk, hP, 1));
// S1 照明榴弹 AUTO sp5：下次攻击 2.4×atk 物理（充能/照明不计）
const hS1 = sk(horn, 0);
check('号角S1 单发=2.4atk物理(天赋共存不覆盖)', near(hS1.skillTotalDamage, P(hP * 2.4)));
check('号角S1 有自然回周期DPS', hS1.cycleDps !== null && hS1.cycleDps > 0);
// S2 暴风号令 10发弹药：前5发2×atk物理，后5发+0.5×atk法伤；DPS=总伤/28s
const hS2 = sk(horn, 1);
const hPhysPer = P(hP * 2);
const hArtsPer = A(hP * 0.5);
check('号角S2 物理总伤=2atk物理×10发', near(hS2.dmgTypes.physical.skillTotalDamage, hPhysPer * 10));
check('号角S2 法伤总伤=0.5atk法伤×5发(过载弹药)', near(hS2.dmgTypes.arts.skillTotalDamage, hArtsPer * 5));
check('号角S2 DPS=总伤/28s(10发×2.8)', near(hS2.skillDps, (hPhysPer * 10 + hArtsPer * 5) / 28));
// S3 终极防线 dur24：前12s atk+50% 后12s 过载 atk+100%，间隔1.0s
const hS3 = sk(horn, 2);
check('号角S3 间隔1.0s(2.8-1.8)', near(hS3.realInterval, 1.0, 0.01));
const hS3Total = P(hP * 1.5) * 12 + P(hP * 2.0) * 12;
check('号角S3 总伤=前12击1.5atk+后12击2.0atk', near(hS3.skillTotalDamage, hS3Total));
check('号角S3 DPS=总伤/24s', near(hS3.skillDps, hS3Total / 24));

// ===== 灰毫（天赋 炮术研习 atk+8% 取无条件档；16% 条件不计）=====
const aPs = ps(ashlok);
const aRaw = ashlok.phases[2].atk[1] + ashlok.trustBonus.atk;
check('灰毫 面板atk×1.08(取低档)', near(aPs.panelAtk, aRaw * 1.08, 1));
const aS1 = sk(ashlok, 0);
check('灰毫S1 总伤=1.83atk物理×10击(30s/2.8)', near(aS1.skillTotalDamage, P(aPs.panelAtk * (1 + 0.08 + 0.75) / 1.08) * Math.floor(30 / 2.8), 5));
const aS2 = sk(ashlok, 1);
check('灰毫S2 间隔2.3s(2.8-0.5)', near(aS2.realInterval, 2.3, 0.01));
check('灰毫S2 总伤=1.53atk物理×4击(10s/2.3)', near(aS2.skillTotalDamage, P(aPs.panelAtk * (1 + 0.08 + 0.45) / 1.08) * Math.floor(10 / 2.3), 5));

// ===== 火哨（天赋 进退自如 默认未阻挡 atk+12%）=====
const fPs = ps(firwhl);
const fRaw = firwhl.phases[2].atk[1] + firwhl.trustBonus.atk;
const fP = fRaw * 1.12;
check('火哨 面板atk×1.12(未阻挡档)', near(fPs.panelAtk, fP, 1));
// S1 野火 AUTO sp8：1.6×atk 物理单发 + 引燃 4s 每秒 0.4×atk 法伤（附带 buff 计入，同流明先例）
const fS1 = sk(firwhl, 0);
check('火哨S1 物理部分=1.6atk', near(fS1.dmgTypes.physical.skillTotalDamage, P(fP * 1.6)));
check('火哨S1 引燃法伤=0.4atk×4跳', near(fS1.dmgTypes.arts.skillTotalDamage, A(fP * 0.4) * 4));
check('火哨S1 有自然回周期DPS(sp8)', fS1.cycleDps !== null && fS1.cycleDps > 0);
// S2 焦土 dur17：普攻照常6击 + 燃烧区重叠常驻 每秒0.75atk法伤×17s
const fS2 = sk(firwhl, 1);
const fPhysTotal = P(fP) * Math.floor(17 / 2.8);
const fBurnTotal = A(fP * 0.75) * 17;
check('火哨S2 物理总伤=普攻6击', near(fS2.dmgTypes.physical.skillTotalDamage, fPhysTotal));
check('火哨S2 燃烧法伤=0.75atk×17跳', near(fS2.dmgTypes.arts.skillTotalDamage, fBurnTotal));
check('火哨S2 DPS=总伤/17s', near(fS2.skillDps, (fPhysTotal + fBurnTotal) / 17));

console.log(`\n要塞验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
