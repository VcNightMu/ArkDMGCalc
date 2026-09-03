// 咒愈师（incantationmedic）验证：焰影苇草/濯尘芙蓉/刺玫/缇缇
// 模板：普攻=法术伤害（对敌方法抗结算）+ 治疗 scale×实际伤害（trait scale 0.5；效果模组 L1 起 0.6）
// 敌人默认 res=50 → 法伤 = atk × (100-50)/100 = atk×0.5；间隔 1.6s
import { calcPanelStats, calculateOperator } from '../../src/frontend/js/damage-calc.js';
import fs from 'fs';

const BASE = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data/MEDIC/incantationmedic/';
const load = n => JSON.parse(fs.readFileSync(BASE + n, 'utf8'));
const mk = (op, si, sl = 7, module = null) => ({ elite: 2, level: op.phases[2].maxLevel, trustPercent: 100, potentialRank: 0, module, skillIndex: si, skillLevel: sl });
let pass = 0, fail = 0;
const near = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;
const check = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL: ' + name); } };

// ===== 数据层：4人特性 scale=0.5、damageType=arts、效果模组 L1 traitEnhance scale=0.6 =====
const ids = ['char_1024_hbisc2', 'char_494_vendla', 'char_1020_reed2', 'char_4056_titi'];
const names = { 'char_1024_hbisc2': '濯尘芙蓉', 'char_494_vendla': '刺玫', 'char_1020_reed2': '焰影苇草', 'char_4056_titi': '缇缇' };
for (const id of ids) {
  const op = load(id + '.json');
  check(`${names[id]} damageType=arts`, op.damageType === 'arts');
  check(`${names[id]} trait.scale=0.5`, op.trait && op.trait.blackboard && near(op.trait.blackboard.scale, 0.5, 1e-9));
  check(`${names[id]} trait描述含50%`, (op.trait.description || '').includes('50%'));
  const adv = (op.modules || []).find(m => m.type === 'ADVANCED' && m.levels && m.levels[0] && m.levels[0].traitEnhance);
  if (adv) {
    check(`${names[id]} 模组${adv.name} L1 traitEnhance scale=0.6`, near(adv.levels[0].traitEnhance[0].blackboard.scale, 0.6, 1e-9));
  } else {
    console.log(`FAIL: ${names[id]} 无 ADVANCED 模组 traitEnhance`);
    fail++;
  }
}

// ===== 焰影苇草：面板 =====
const reed = load('char_1020_reed2.json');
const rPs = calcPanelStats(reed, mk(reed, 0, 7, null));
const rAtk = rPs.panelAtk;   // E2L90 白值 550 + 信赖
check('焰影苇草 E2 面板 ATK', near(rAtk, 550 + reed.trustBonus.atk));
const hit = a => a * 0.5;    // res=50 → 法伤减半
const interval0 = 1.6;

// 无技能普攻：伤害 DPS + 治疗 HPS（scale 0.5）
const r0 = calculateOperator(reed, mk(reed, -1, 7, null));
check('焰影苇草 普攻伤害=面板×0.5', near(r0.normalDps * interval0, hit(rAtk)));
check('焰影苇草 普攻DPS=法伤/1.6', near(r0.normalDps, hit(rAtk) / interval0));
check('焰影苇草 普攻HPS=法伤×0.5/1.6', near(r0.normalHps, hit(rAtk) * 0.5 / interval0));
check('焰影苇草 普攻 damageType=arts', r0.damageType === 'arts' && r0.normalDamageType === 'arts');

// S1 迅捷打击·γ L7：atk+37%、攻速+35，持续35s
const r1 = calculateOperator(reed, mk(reed, 0, 7, null));
const r1Atk = rAtk * 1.37;
const r1Int = 1.6 * 100 / 135;               // 攻速+35 → 间隔 1.185s
const r1Hit = hit(r1Atk);
check('焰影苇草S1 技能期ATK', near(r1.panelAtk, r1Atk, 1));
check('焰影苇草S1 间隔=1.185s', near(r1.realInterval, r1Int, 1e-3));
check('焰影苇草S1 技能期DPS=总伤/35s（限时技能全程平均）', near(r1.skillDps, r1Hit * Math.floor(35 / r1Int) / 35));
check('焰影苇草S1 技能期HPS=法伤×0.5/间隔', near(r1.skillHps, r1Hit * 0.5 / r1Int));
check('焰影苇草S1 总伤=法伤×29次', near(r1.skillTotalDamage, r1Hit * Math.floor(35 / r1Int)));
check('焰影苇草S1 总治疗=总伤×0.5', near(r1.totalHeal, r1Hit * 0.5 * Math.floor(35 / r1Int)));
check('焰影苇草S1 常态DPS=法伤/1.6', near(r1.normalDps, hit(rAtk) / interval0));
check('焰影苇草S1 常态HPS=法伤×0.5/1.6', near(r1.normalHps, hit(rAtk) * 0.5 / interval0));

// 模组「赠予红龙的花冠」L1：trait scale 0.5→0.6（普攻与技能期治疗同步放大）
const mod1 = { moduleId: 'uniequip_002_reed2', moduleLevel: 1 };
const rmPs = calcPanelStats(reed, mk(reed, 0, 7, mod1));
const rmAtk = rmPs.panelAtk;
const rm0 = calculateOperator(reed, mk(reed, -1, 7, mod1));
check('焰影苇草+花冠L1 普攻HPS=法伤×0.6/1.6', near(rm0.normalHps, hit(rmAtk) * 0.6 / interval0));
check('焰影苇草+花冠L1 普攻DPS不受scale影响', near(rm0.normalDps, hit(rmAtk) / interval0));
const rm1 = calculateOperator(reed, mk(reed, 0, 7, mod1));
const rm1Int = rmPs.attackSpeed ? rmPs.baseAttackTime : 0; // 占位
check('焰影苇草+花冠L1 S1技能期HPS=法伤×0.6/间隔', near(rm1.skillHps, hit(rmAtk * 1.37) * 0.6 / (1.6 * 100 / 135)));

// ===== 濯尘芙蓉：S1 攻击力强化·γ L7 atk+75%，持续30s（含法脆增伤 1.12，见天赋段）=====
const hb = load('char_1024_hbisc2.json');
const hbFrag = 1.12;   // 天赋「朝开夕落」精2 pot0：法脆必触发 damage_scale
const hbAtk = calcPanelStats(hb, mk(hb, 0, 7)).panelAtk;
const hb1 = calculateOperator(hb, mk(hb, 0, 7, null));
check('芙蓉S1 技能期ATK=面板×1.75', near(hb1.panelAtk, hbAtk * 1.75, 1));
check('芙蓉S1 技能期DPS=总伤/30s（含法脆）', near(hb1.skillDps, hit(hbAtk * 1.75) * hbFrag * Math.floor(30 / 1.6) / 30));
check('芙蓉S1 技能期HPS（含法脆）', near(hb1.skillHps, hit(hbAtk * 1.75) * hbFrag * 0.5 / 1.6));
check('芙蓉S1 总治疗=总伤×0.5（含法脆）', near(hb1.totalHeal, hit(hbAtk * 1.75) * hbFrag * 0.5 * Math.floor(30 / 1.6)));

// ===== 刺玫：S1 战术咏唱·γ L7 攻速+70，持续30s（攻击力不变） =====
const vendla = load('char_494_vendla.json');
const vAtk = calcPanelStats(vendla, mk(vendla, 0, 7)).panelAtk;
const v1 = calculateOperator(vendla, mk(vendla, 0, 7, null));
const vInt = 1.6 * 100 / 170;
check('刺玫S1 间隔=0.941s', near(v1.realInterval, vInt, 1e-3));
check('刺玫S1 技能期ATK不变', near(v1.panelAtk, vAtk, 1));
check('刺玫S1 技能期HPS=法伤×0.5/0.941', near(v1.skillHps, hit(vAtk) * 0.5 / vInt));
check('刺玫S1 总治疗', near(v1.totalHeal, hit(vAtk) * 0.5 * Math.floor(30 / vInt)));

// ===== 缇缇：数据齐备即可（技能机制特殊，另行讨论）=====
const titi = load('char_4056_titi.json');
check('缇缇 3技能齐全', titi.skills.length === 3);
const tAtk = calcPanelStats(titi, mk(titi, 0, 7)).panelAtk;

// ===== 缇缇 S1「缓蚀」：加攻强化（概率沉睡不建模型）→ 通用 atk 分支 =====
const t1 = calculateOperator(titi, mk(titi, 0, 7, null));
const t1Lv = titi.skills[0].levels[7];
const t1Atk = tAtk * (1 + t1Lv.atk);
check('缇缇S1 技能期ATK=面板×(1+atk)', near(t1.panelAtk, t1Atk, 1));
check('缇缇S1 总伤=法伤普攻×10击(17s/1.6)', near(t1.skillTotalDamage, hit(t1Atk) * Math.floor(17 / 1.6)));
check('缇缇S1 总治疗=普攻治疗', near(t1.totalHeal, hit(t1Atk) * 0.5 * Math.floor(17 / 1.6)));

// ===== 缇缇 S2「封护」：停止攻击、天赋伤害不计 → 技能期无输出无治疗 =====
const t2 = calculateOperator(titi, mk(titi, 1, 7, null));
check('缇缇S2 技能期无输出', t2.skillTotalDamage === 0 && t2.skillDps === 0);
check('缇缇S2 技能期无治疗', t2.totalHeal === 0 && t2.skillHps === 0);

// ===== 缇缇 S3「旧日绽放」：每击全额法伤(15击) + 4次睡满醒伤(max_atk_scale档)；醒伤不治疗 =====
const t3 = calculateOperator(titi, mk(titi, 2, 7, null));
const t3Lv = titi.skills[2].levels[7];
const t3Atk = tAtk * (1 + t3Lv.atk);
const t3Attacks = Math.floor(25 / 1.6);   // 15 击
const t3Sleeps = Math.ceil(t3Attacks / 4); // 4 次打睡
const t3Hit = hit(t3Atk);
const t3Wake = hit(t3Atk * t3Lv.max_atk_scale);
check('缇缇S3 技能期ATK=面板×(1+atk)', near(t3.panelAtk, t3Atk, 1));
check('缇缇S3 总伤=15击全额普攻+4次醒伤', near(t3.skillTotalDamage, t3Hit * t3Attacks + t3Wake * t3Sleeps));
check('缇缇S3 总治疗=普攻治疗(醒伤不治疗)', near(t3.totalHeal, t3Hit * 0.5 * t3Attacks));
check('缇缇S3 技能期HPS=普攻瞬时', near(t3.skillHps, t3Hit * 0.5 / 1.6));

// ===== 濯尘芙蓉 天赋「朝开夕落」：法脆必触发，伤害 ×damage_scale（精2 pot0 = 1.12，已随 S1 断言验证）=====
const hb0 = calculateOperator(hb, mk(hb, -1, 7, null));
check('芙蓉 普攻DPS=法伤×1.12/1.6', near(hb0.normalDps, hit(hbAtk) * hbFrag / 1.6));
check('芙蓉 普攻HPS=法伤×1.12×0.5/1.6', near(hb0.normalHps, hit(hbAtk) * hbFrag * 0.5 / 1.6));

// ===== 濯尘芙蓉 S2「抚业之触」：普攻替换为每秒法伤（atk_scale=1.5），每秒一跳+治疗，持续8s =====
const hb2 = calculateOperator(hb, mk(hb, 1, 7, null));
const hb2Tick = hit(hbAtk * 1.5) * hbFrag;   // 每秒一跳伤害（含法脆）
check('芙蓉S2 技能期总伤=每秒伤害×8跳', near(hb2.skillTotalDamage, hb2Tick * 8));
check('芙蓉S2 技能期DPS=每秒伤害', near(hb2.skillDps, hb2Tick));
check('芙蓉S2 总治疗=每秒伤害×0.5×8跳', near(hb2.totalHeal, hb2Tick * 0.5 * 8));
check('芙蓉S2 技能期HPS=每秒治疗', near(hb2.skillHps, hb2Tick * 0.5));
check('芙蓉S2 间隔展示1s（每秒一跳）', near(hb2.realInterval, 1));
check('芙蓉S2 常态DPS保持', near(hb2.normalDps, hit(hbAtk) * hbFrag / 1.6));

// ===== 刺玫 S2「荆藤庇荫」：只算加攻期普攻伤害（atk+75%），嘲讽/反伤(atk_scale)不计；天赋带条件不计 =====
const v2 = calculateOperator(vendla, mk(vendla, 1, 7, null));
const v2Atk = vAtk * 1.75;
const v2Int = 1.6;
check('刺玫S2 技能期ATK=面板×1.75', near(v2.panelAtk, v2Atk, 1));
check('刺玫S2 总伤=加攻普攻法伤×次数（无反伤atk_scale）', near(v2.skillTotalDamage, hit(v2Atk) * Math.floor(15 / v2Int)));
check('刺玫S2 总治疗=总伤×0.5', near(v2.totalHeal, hit(v2Atk) * 0.5 * Math.floor(15 / v2Int)));
check('刺玫S2 天赋不入表（无heal_scale放大）', near(v2.skillHps, hit(v2Atk) * 0.5 / v2Int));

// ===== 阿米娅(医疗) char_1037_amiya3：数据层 =====
const amiya = load('char_1037_amiya3.json');
check('阿米娅(医疗) 命名与头像文件名对应', amiya.name === '阿米娅(医疗)');
check('阿米娅(医疗) damageType=arts', amiya.damageType === 'arts');
check('阿米娅(医疗) trait.scale=0.5', near(amiya.trait.blackboard.scale, 0.5, 1e-9));
check('阿米娅(医疗) X模组L1 traitEnhance=0.6', near(amiya.modules.find(m => m.typeName2 === 'X').levels[0].traitEnhance[0].blackboard.scale, 0.6, 1e-9));
const aPs = calcPanelStats(amiya, mk(amiya, 0, 7));
check('阿米娅(医疗) E2面板ATK=532+信赖45', near(aPs.panelAtk, 532 + 45));
const a0 = calculateOperator(amiya, mk(amiya, -1, 7, null));
check('阿米娅(医疗) 普攻DPS=法伤/1.6', near(a0.normalDps, hit(aPs.panelAtk) / 1.6));

// ===== 阿米娅(医疗) S1「哀恸共情」：攻速+每击额外治疗 heal_scale×攻击力（单目标1份）=====
const a1 = calculateOperator(amiya, mk(amiya, 0, 7, null));
const am1Lv = amiya.skills[0].levels[7];
const am1Int = 1.6 * 100 / (100 + am1Lv.attack_speed);
const am1Extra = aPs.panelAtk * am1Lv.heal_scale;
check('阿米娅S1 间隔含攻速', near(a1.realInterval, am1Int, 1e-3));
check('阿米娅S1 技能期HPS=特性治疗+额外群疗', near(a1.skillHps, (hit(aPs.panelAtk) * 0.5 + am1Extra) / am1Int));
check('阿米娅S1 总治疗含额外', near(a1.totalHeal, (hit(aPs.panelAtk) * 0.5 + am1Extra) * Math.floor(50 / am1Int)));
check('阿米娅S1 技能期DPS=普攻法伤', near(a1.skillDps, hit(aPs.panelAtk) * Math.floor(50 / am1Int) / 50));

// ===== 阿米娅(医疗) S2「慈悲愿景」：开启一击0命中→0叠层；后续普攻真伤（面板攻击力），持续32s =====
const a2 = calculateOperator(amiya, mk(amiya, 1, 7, null));
const am2Attacks = Math.floor(32 / 1.6);
check('阿米娅S2 真伤总伤=面板×20击', near(a2.skillTotalDamage, aPs.panelAtk * am2Attacks));
check('阿米娅S2 总治疗=真伤×0.5×20', near(a2.totalHeal, aPs.panelAtk * 0.5 * am2Attacks));
check('阿米娅S2 技能期DPS=总伤/32s', near(a2.skillDps, aPs.panelAtk * am2Attacks / 32));
check('阿米娅S2 damageType=true', a2.damageType === 'true');

// ===== 焰影苇草 S2「枯荣共息」：三颗火球每1.5s齐发（3发atk_scale法伤，火球治疗只作用于目标干员）；苇草自身普攻照常 =====
const r2 = calculateOperator(reed, mk(reed, 1, 7, null));
const reedLv2 = reed.skills[1].levels[7];
const r2Dur = 20;   // 专一档 buff 持续 20s
const r2Ticks = Math.floor(r2Dur / 1.5);
const r2PerOrb = hit(rAtk * reedLv2.atk_scale);
const r2Atk = hit(rAtk);
const r2Attacks = Math.floor(r2Dur / 1.6);
check('苇草S2 总伤=普攻×12击+火球×39发', near(r2.skillTotalDamage, r2Atk * r2Attacks + r2PerOrb * 3 * r2Ticks));
check('苇草S2 总治疗=普攻治疗+火球治疗', near(r2.totalHeal, r2Atk * 0.5 * r2Attacks + r2PerOrb * 0.5 * 3 * r2Ticks));
check('苇草S2 技能期HPS=普攻HPS+火球HPS', near(r2.skillHps, r2Atk * 0.5 / 1.6 + r2PerOrb * 0.5 * 3 / 1.5));
check('苇草S2 展示间隔=普攻1.6s', near(r2.realInterval, 1.6));

// ===== 焰影苇草 S3「生命火种」：灼痕100%触发→法脆×1.3(精2)；灼痕秒伤=技能期攻击力×s3_atk_scale（同样吃法脆）；死亡爆炸不计 =====
const r3 = calculateOperator(reed, mk(reed, 2, 7, null));
const reedLv3 = reed.skills[2].levels[7];
const r3Atk = rAtk * (1 + reedLv3['reed2_skil_3[switch_mode].atk']);
const r3Fragile = 1.3;   // 灼痕精2 pot0 damage_scale
const r3Hit = hit(r3Atk) * r3Fragile;
const r3Dot = hit(r3Atk * reedLv3['talent@s3_atk_scale']) * r3Fragile;   // 灼痕秒伤吃法脆
const r3Attacks = Math.floor(30 / 1.6);
const r3Total = r3Hit * r3Attacks + r3Dot * 30;
check('苇草S3 普攻总伤=法伤×法脆×18击', near(r3.skillTotalDamage - r3Dot * 30, r3Hit * r3Attacks));
check('苇草S3 总伤=普攻+灼痕秒伤(含法脆)×30s', near(r3.skillTotalDamage, r3Total));
check('苇草S3 总治疗=普攻治疗（DOT不治疗）', near(r3.totalHeal, r3Hit * 0.5 * r3Attacks));
check('苇草S3 技能期HPS', near(r3.skillHps, r3Hit * 0.5 / 1.6));
check('苇草S3 技能期ATK含前缀加攻键', near(r3.panelAtk, r3Atk, 1));

console.log(`\n咒愈师验证: ${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
