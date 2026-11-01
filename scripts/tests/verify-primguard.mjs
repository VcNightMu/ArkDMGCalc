// 本源近卫(primguard)验证:精二满/满信赖/潜0/专一档/敌 def600 res50
// 口径(用户 2026-09-17):「与本源术师类似的处理」
//   - 聆音「趁势怜悯」仅计算基础加成(+10%,击倒神经损伤爆发敌人后的升级档不计);
//   - 元素=神经损伤(爆条 6000/次、cd 10s、EP 1000);损伤基数 = 该次实际造成的物理伤害×10%;
//   - S2「破膛弥撒」三段按元素伤害结算(问答确认:视为目标处于爆发期间);可充能 2 次按单次。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import { OPERATOR_ELEMENT } from '../../src/frontend/js/element-calc.js';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const op = JSON.parse(fs.readFileSync(new URL('../../src/frontend/data/WARRIOR/primguard/char_4187_graceb.json', import.meta.url), 'utf8'));
const e = op.phases.length - 1;
const run = (si) => calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7 });

let r = run(-1);
ok(near(r.panelAtk, 990) && near(r.normalDps, 325), '聆音 常态 (820+80)×1.10=990 / 325 实=' + r.panelAtk + '/' + r.normalDps);
r = run(0);
ok(near(r.panelAtk, 990) && near(r.skillTotalDamage, 48825) && near(r.skillDps, 1627.5),
  '聆音 S1 开颅挽歌(二连击 135%,50 击 + 神经爆条)48825/1627.5 实=' + r.skillTotalDamage + '/' + r.skillDps);
ok(r.dmgTypes && r.dmgTypes.physical && near(r.dmgTypes.physical.skillTotalDamage, 36825) && r.dmgTypes.element && near(r.dmgTypes.element.skillTotalDamage, 12000),
  '聆音 S1 分档 物理 36825 + 元素 12000 实=' + JSON.stringify(r.dmgTypes));
ok(near(r.normalDps, 325), '聆音 S1 槽内常态=普攻 325 实=' + r.normalDps);
r = run(1);
ok(near(r.panelAtk, 2277) && near(r.skillTotalDamage, 6831) && near(r.skillDps, 0) && near(r.cycleDps, 723),
  '聆音 S2 破膛弥撒(三段 230% 元素)6831/循环 723 实=' + r.skillTotalDamage + '/' + r.cycleDps);
ok(r.dmgTypes && r.dmgTypes.element && near(r.dmgTypes.element.skillTotalDamage, 6831), '聆音 S2 元素档 6831 实=' + JSON.stringify(r.dmgTypes));
console.log('本源近卫: ' + pass + ' 通过 / ' + fail + ' 失败');

// ===== 克莱门莎 char_4231_clemnt（2026-10 版本新增，侵蚀/water）=====
// 口径(2026-10，见 notes.json)：
//  - 天赋1「生死定夺」概率加攻 → 按通则不建模；天赋2「习得性防御」承伤向不计；
//  - S1 冲蚀：攻回 sp2，下次攻击提高至 290%，侵蚀损伤 = 该物理伤害×35%；
//  - S2 风暴潮：攻速+100（间隔 1.2→0.6），每次攻击攻击力×300%；放逐舱/漩涡（区域）不计；
//  - S3 与海为敌：弹药型，每次攻击攻击力×235% 物理 + 该物理×20% 侵蚀；
//    侵蚀爆发(5000/8s 冷却)时耗 1 发弹药打 3 次攻击力×300% 物理 + 3 次攻击力×250% 元素；
//    窗口 = 弹药数×间隔 + 炮弹滞空 5s（离散模拟）。
const cm = JSON.parse(fs.readFileSync(new URL('../../src/frontend/data/WARRIOR/primguard/char_4231_clemnt.json', import.meta.url), 'utf8'));
const ce = cm.phases.length - 1;
const runC = (si) => calculateOperator(cm, { elite: ce, level: cm.phases[ce].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 9 });

// 面板：E2 90 攻击 920 + 信赖 110 = 1030（无加攻天赋）
let rc = runC(-1);
ok(near(rc.panelAtk, 1030) && near(rc.realInterval, 1.2), '克莱门莎 面板 920+110=1030 / 间隔 1.2 实=' + rc.panelAtk + '/' + rc.realInterval);
ok(near(rc.normalDps, 358.33), '克莱门莎 常态普攻 (1030-600)/1.2=358.33 实=' + rc.normalDps);

// S1 冲蚀：物理 2.9×1030-600=2387，侵蚀 2387×0.35=835.45 ≥1000 容量 → 每次触发即爆条 5000
rc = runC(0);
ok(near(rc.skillTotalDamage, 13062.3) && near(rc.cycleDps, 5349.99),
  '克莱门莎 S1 冲蚀 8062.3 物理 + 5000 侵蚀 = 13062.3 / 循环 5350 实=' + rc.skillTotalDamage + '/' + rc.cycleDps);
ok(rc.dmgTypes && near(rc.dmgTypes.physical.skillTotalDamage, 8062.3) && near(rc.dmgTypes.element.skillTotalDamage, 5000),
  '克莱门莎 S1 分档 物理 8062.3 + 侵蚀 5000 实=' + JSON.stringify(rc.dmgTypes));
ok(near(rc.panelAtk, 2987), '克莱门莎 S1 技能期 ATK = 1030×2.9 = 2987 实=' + rc.panelAtk);

// S2 风暴潮：间隔 1.2/2=0.6 → 16s 共 26 击；每击 3.0×1030-600=2490
// 漩涡(区域)计入：16s 内每秒一跳，每跳 2490 物理 + 200 侵蚀(固定值)；与普攻共享 EP → 爆条 2 次(5000×2)
rc = runC(1);
ok(near(rc.realInterval, 0.6) && near(rc.panelAtk, 3090), '克莱门莎 S2 间隔 0.6 / 技能期 ATK 3090 实=' + rc.realInterval + '/' + rc.panelAtk);
ok(near(rc.skillTotalDamage, 114580) && near(rc.skillDps, 7161.25),
  '克莱门莎 S2 风暴潮 (26 击 + 16 跳漩涡)×2490 = 104580 物理 + 10000 侵蚀 = 114580 实=' + rc.skillTotalDamage);
ok(rc.dmgTypes && near(rc.dmgTypes.physical.skillTotalDamage, 104580) && near(rc.dmgTypes.element.skillTotalDamage, 10000),
  '克莱门莎 S2 分档 物理 104580 + 侵蚀 10000 实=' + JSON.stringify(rc.dmgTypes));
ok(near(rc.normalDps, 358.33), '克莱门莎 S2 槽内常态=普攻 358.33 实=' + rc.normalDps);

// S3 与海为敌：弹药 10 发，每次爆发(耗 1 发)打 3×(3.0×1030-600)=3×2490 物理 + 3×(1030×2.5)=3×2575 元素
// ※projectile_life_time 5→3.5(上游 2026-11 同步) → 窗口 = 弹药期 + 3.5s 滞空，DPS 相应提高(总伤不变)
rc = runC(2);
ok(near(rc.panelAtk, 2420.5), '克莱门莎 S3 技能期 ATK = 1030×2.35 = 2420.5 实=' + rc.panelAtk);
ok(rc.normalDps === null, '克莱门莎 S3 弹药槽常态行保持 null 实=' + rc.normalDps);
ok(rc.dmgTypes && rc.dmgTypes.element && rc.dmgTypes.element.skillTotalDamage > 0,
  '克莱门莎 S3 含元素档（侵蚀爆条元素伤害）实=' + JSON.stringify(rc.dmgTypes && rc.dmgTypes.element));
ok(near(rc.skillTotalDamage, 226770, 1) && near(rc.skillDps, 14630.3, 1),
  '克莱门莎 S3 与海为敌 总伤 226770 / DPS 14630 实=' + rc.skillTotalDamage + '/' + rc.skillDps);

// 元素类型登记为 water（侵蚀）：珊比/克莱门莎同型，爆条 5000/8s
ok(OPERATOR_ELEMENT['char_4231_clemnt'] === 'water', '克莱门莎 元素登记为 water(侵蚀) 实=' + OPERATOR_ELEMENT['char_4231_clemnt']);

// ===== 塔露拉 char_4247_oxi（2026-11 版本新增，灼燃/fire，法术伤害）=====
// 口径(2026-11，见 notes.json)：
//  - 天赋1「绝不妥协」：攻击造成法术伤害(damageType=arts) + 附带 ep_damage_ratio 灼燃损伤(精2 13%)；
//  - 天赋2「我即火焰」灼燃爆发后「足迹」持续法伤：依赖爆条节奏的场地效果 → 默认不建模；
//  - S1 照霎白夜：自回触发型 sp8，atk_scale 倍法术强化(专三 6.0) + 恐惧(控制不计) + 天赋灼燃；
//  - S2 阂断骤雪：护盾/反击/回血/减伤承伤向 → 不计输出，普攻照常；
//  - S3 日冕重烈：热浪波，atk 加成 + heatwave_atk_scale 倍法术(单目标简化为每次热浪波) + 天赋灼燃。
const ox = JSON.parse(fs.readFileSync(new URL('../../src/frontend/data/WARRIOR/primguard/char_4247_oxi.json', import.meta.url), 'utf8'));
const oe = ox.phases.length - 1;
const runO = (si) => calculateOperator(ox, { elite: oe, level: ox.phases[oe].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 9 });

let ro = runO(-1);
ok(ro.damageType === 'arts', '塔露拉 damageType = arts（天赋「绝不妥协」攻击造成法术伤害）实=' + ro.damageType);
ok(near(ro.panelAtk, 965) && near(ro.realInterval, 1.2), '塔露拉 面板 875+90=965 / 间隔 1.2 实=' + ro.panelAtk + '/' + ro.realInterval);
ok(near(ro.normalDps, 738.62) && ro.normalTypes && ro.normalTypes.arts && ro.normalTypes.element,
  '塔露拉 常态 法术 + 灼燃稳态 738.62 实=' + ro.normalDps + '/' + JSON.stringify(ro.normalTypes));

ro = runO(0);
ok(near(ro.panelAtk, 5790) && near(ro.skillTotalDamage, 2895) && near(ro.cycleDps, 723.75),
  '塔露拉 S1 照霎白夜(6.0×965 法术)2895/循环 723.75 实=' + ro.skillTotalDamage + '/' + ro.cycleDps);

ro = runO(2);
ok(near(ro.skillTotalDamage, 75374) && near(ro.skillDps, 2093.72),
  '塔露拉 S3 日冕重烈(热浪波 + 灼燃)75374/2093.72 实=' + ro.skillTotalDamage + '/' + ro.skillDps);
ok(ro.dmgTypes && near(ro.dmgTypes.arts.skillTotalDamage, 61374) && near(ro.dmgTypes.element.skillTotalDamage, 14000),
  '塔露拉 S3 分档 法术 61374 + 灼燃 14000 实=' + JSON.stringify(ro.dmgTypes));
ok(OPERATOR_ELEMENT['char_4247_oxi'] === 'fire', '塔露拉 元素登记为 fire(灼燃) 实=' + OPERATOR_ELEMENT['char_4247_oxi']);

console.log('本源近卫(含克莱门莎): ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
