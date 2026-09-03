// 行医（wandermedic）技能与天赋验证：哈洛德/褐果/桑葚/蜜莓/纯烬艾雅法拉
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/MEDIC/wandermedic/';
const load = n => JSON.parse(fs.readFileSync(BASE + n, 'utf8'));
const mk = (op, si, sl = 9) => ({ elite: 2, level: op.phases[2].maxLevel, trustPercent: 100, potentialRank: 0, module: null, skillIndex: si, skillLevel: sl });
let pass = 0, fail = 0;
const near = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;
const check = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL: ' + name); } };

// ===== 哈洛德 E2：白值 385 + 信赖35 = 420 =====
const harold = load('char_4114_harold.json');
const hPs = calcPanelStats(harold, mk(harold, 0));
check('哈洛德 E2 面板 ATK=420', near(hPs.panelAtk, 420));
// S1 治疗强化·γ型：atk+90% 持续30s
const h1 = calculateOperator(harold, mk(harold, 0));
check('哈洛德S1 技能期ATK=798', near(h1.panelAtk, 420 * 1.9, 1));
check('哈洛德S1 HPS=798/2.85', near(h1.skillHps, 420 * 1.9 / 2.85));
check('哈洛德S1 总治疗=798×10次', near(h1.totalHeal, 420 * 1.9 * Math.floor(30 / 2.85)));
// S2 重病优先：攻速+100（trait_scale 元素条件不计），间隔 2.85×100/200=1.425
const h2 = calculateOperator(harold, mk(harold, 1));
check('哈洛德S2 间隔=1.425s', near(h2.realInterval, 1.425, 1e-3));
check('哈洛德S2 HPS=420/1.425', near(h2.skillHps, 420 / 1.425));

// ===== 褐果 E2：白值 389 + 信赖35 = 424（天赋 ep_heal_scale 元素向不进 HP）=====
const chnut = load('char_4041_chnut.json');
const cPs = calcPanelStats(chnut, mk(chnut, 0));
check('褐果 E2 面板 ATK=424', near(cPs.panelAtk, 424));
// S1 积微成著：瞬发一次普攻治疗（trait_scale 仅元素），无周期
const c1 = calculateOperator(chnut, mk(chnut, 0));
check('褐果S1 总治疗=一次普攻424', near(c1.totalHeal, 424));
check('褐果S1 无周期HPS', c1.cycleHps === null || c1.cycleHps === undefined);
// S2 厚土迸发：攻速+130，连续治疗加成（条件性默认不触发）不计
const c2 = calculateOperator(chnut, mk(chnut, 1));
const cInt = 2.85 * 100 / 230;
check('褐果S2 间隔=2.85×100/230=1.239s', near(c2.realInterval, cInt, 1e-3));
check('褐果S2 HPS=424/1.239（不乘连续加成）', near(c2.skillHps, 424 / cInt));
check('褐果S2 总治疗=424×28次', near(c2.totalHeal, 424 * Math.floor(35 / cInt)));

// ===== 桑葚 E2：白值 388+信赖35=423；天赋「助手」需双医疗条件→不计 =====
const mberry = load('char_473_mberry.json');
const bPs = calcPanelStats(mberry, mk(mberry, 0));
check('桑葚 E2 面板 ATK=423（条件天赋不生效）', near(bPs.panelAtk, 423));
// S1 治愈云朵：AUTO 触发型 heal_scale 1.8——触发发=1.8×面板（那下总量含普攻被替换）
const b1 = calculateOperator(mberry, mk(mberry, 0));
check('桑葚S1 触发发总治疗=423×1.8', near(b1.totalHeal, 423 * 1.8));
const bCycle = 3 + (Math.ceil(3 / 2.85) * 2.85 - 3); // 5.7
check('桑葚S1 周期HPS=(2普攻+1.8P)/5.7', near(b1.cycleHps, (423 / 2.85 * bCycle + 423 * 1.8) / bCycle));
// S2 安全区域：间隔×0.26（2.85×0.26=0.741），持续30s，元素减伤不计
const b2 = calculateOperator(mberry, mk(mberry, 1));
check('桑葚S2 间隔=0.741s', near(b2.realInterval, 2.85 * 0.26, 1e-3));
check('桑葚S2 HPS=423/0.741', near(b2.skillHps, 423 / (2.85 * 0.26)));
check('桑葚S2 总治疗=423×floor(30/0.741)', near(b2.totalHeal, 423 * Math.floor(30 / (2.85 * 0.26))));

// ===== 蜜莓 E2：白值375+35=410；天赋「集体意识」范围内远程干员最大生命+5%~12%，自身为远程医疗必在范围 → 计入 HP 面板 =====
const glider = load('char_449_glider.json');
const gPs = calcPanelStats(glider, mk(glider, 0));
check('蜜莓 E2 面板 ATK=410', near(gPs.panelAtk, 410));
check('蜜莓 E2 面板 HP=1769（基数1608×集体意识+10%）', near(gPs.panelHp, 1769, 1));
// S1 精神护理：纯元素 HOT 工具，HP 侧=普攻触发（无增益），不需特殊处理
const g1 = calculateOperator(glider, mk(glider, 0));
check('蜜莓S1 总治疗=普攻410（技能无HP增益）', near(g1.totalHeal, 410));
// S2 振翅：atk+50%（目标数 2~3 按单目标口径不乘）
const g2 = calculateOperator(glider, mk(glider, 1));
check('蜜莓S2 技能期ATK=615', near(g2.panelAtk, 410 * 1.5, 1));
check('蜜莓S2 HPS=615/2.85（单目标不乘max_target）', near(g2.skillHps, 410 * 1.5 / 2.85));
check('蜜莓S2 总治疗=615×8次', near(g2.totalHeal, 410 * 1.5 * Math.floor(25 / 2.85)));

// ===== 纯烬艾雅法拉 E2：白值424+信赖45=469 =====
const agoat2 = load('char_1016_agoat2.json');
const aPs = calcPanelStats(agoat2, mk(agoat2, 0));
check('纯烬 E2 面板 ATK=469', near(aPs.panelAtk, 469));
check('纯烬 E2 面板 HP=1737（基数1639×火山灰疗愈+6%）', near(aPs.panelHp, 1737, 1));
// S1 无声润物：永续 atk+40%（额外治疗1单位按单目标不乘）
const a1 = calculateOperator(agoat2, mk(agoat2, 0));
check('纯烬S1 永续开启', a1.isPermanent === true);
check('纯烬S1 技能期ATK=656.6', near(a1.panelAtk, 469 * 1.4, 1));
check('纯烬S1 HPS=656.6/2.85', near(a1.skillHps, 469 * 1.4 / 2.85));
check('纯烬S1 无总治疗（永续开关型）', a1.totalHeal === null || a1.totalHeal === undefined);
// S2 云障葙藤：瞬发全体普攻治疗一次（元素屏障忽略）
const a2 = calculateOperator(agoat2, mk(agoat2, 1));
check('纯烬S2 总治疗=一次普攻469', near(a2.totalHeal, 469));
// S3 火山回响：5连发全打单目标 → 每攻击 5×0.6×面板，50s
const a3 = calculateOperator(agoat2, mk(agoat2, 2));
const a3Int = 2.85;
check('纯烬S3 HPS=469×0.6×5/2.85=493.7', near(a3.skillHps, 469 * 0.6 * 5 / a3Int));
check('纯烬S3 总治疗=469×0.6×5×17次=23919', near(a3.totalHeal, 469 * 0.6 * 5 * Math.floor(50 / a3Int)));
check('纯烬S3 伤害类型=heal（无输出侧）', a3.type === 'heal');

console.log(pass + ' 通过, ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
