// 撼地者(hammer/近卫)验证:精二满/满信赖/潜0/专一档/敌 def600 res50
// 口径(用户 2026-09-17 给定 + 问答确认):
//   - 奥达「落锤」的攻击力增幅默认常驻(+15%,X 模组 +20%);
//   - 祐天寺若麦「双利手」的脆弱效果默认不触发;
//   - 怒潮凛冬 S2「绝不罢休」默认为第二次加成(能力加成翻倍、持续时间无限);
//   - 佩佩 S2 攻速叠层默认满层 2 层(+40×2);佩佩「弥漫莲香」(+16%)与祐天寺若麦「毋畏爱意」(+8%)本人也吃;
//   - 特性「攻击使目标周围的其他敌人受到攻击力 50% 的群体物理伤害」只打其他敌人 → 单目标场景不计;
//     各模组特性追加「溅射范围内≥3 个敌人时攻击力提升至 115%」为条件类不计。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
const D = '../../src/frontend/data/WARRIOR/hammer/';
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (id, si, module = null) => {
  const op = JSON.parse(fs.readFileSync(new URL(D + id + '.json', import.meta.url), 'utf8'));
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module });
};

// ---- 怒潮凛冬(第二天赋「万众巨潮」技能期全场 +14%,本人属乌萨斯学生自治团翻倍 → 技能期 +28%;S2 第二次加成) ----
let r = run('char_1051_headb2', -1);
ok(near(r.panelAtk, 1312) && near(r.normalDps, 395.5556), '怒潮凛冬 常态 1312/395.556 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_1051_headb2', 0);
ok(near(r.panelAtk, 2230.4) && near(r.skillTotalDamage, 39129.6) && near(r.skillDps, 1304.32),
  '怒潮凛冬 S1 誓不低头(+42%/攻速+45,含 T2 加算)39129.6/1304.32 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_1051_headb2', 1);
ok(r.isPermanent === true && near(r.panelAtk, 3778.56) && near(r.skillDps, 1765.867) && r.skillTotalDamage === 0,
  '怒潮凛冬 S2 绝不罢休(第二次加成 +160%,持续无限)3778.56/1765.867 实=' + r.panelAtk + '/' + r.skillDps);
r = run('char_1051_headb2', 2);
ok(near(r.panelAtk, 2860.16) && near(r.skillTotalDamage, 47338.816) && near(r.skillDps, 5259.868),
  '怒潮凛冬 S3 无可抵挡(五连击 210%×(1+0.3k)/9s)47338.816/5259.868 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_1051_headb2', -1, { moduleId: 'uniequip_002_headb2', moduleLevel: 3 });
ok(near(r.panelAtk, 1395) && near(r.normalDps, 441.667), '怒潮凛冬 X3 常态 1395/441.667 实=' + r.panelAtk + '/' + r.normalDps);

// ---- 佩佩(弥漫莲香 +16% 自身吃;S2 攻速满层;S3 每击 +20% 叠 4 层) ----
r = run('char_4058_pepe', -1);
ok(near(r.panelAtk, 1577.6) && near(r.normalDps, 543.111), '佩佩 常态 (1290+70)×1.16=1577.6/543.111 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_4058_pepe', 0);
ok(near(r.panelAtk, 3944) && near(r.skillTotalDamage, 3344) && near(r.cycleDps, 1046.133),
  '佩佩 S1 盖戳!(触发型 250%)3344/1046.133 实=' + r.skillTotalDamage + '/' + r.cycleDps);
r = run('char_4058_pepe', 1);
ok(near(r.realInterval, 0.72) && near(r.panelAtk, 2597.6) && near(r.skillTotalDamage, 47942.4) && near(r.skillDps, 2663.467),
  '佩佩 S2 阻遏混乱锤(攻速 +70+40×2 → 0.72s)47942.4/2663.467 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4058_pepe', 2);
ok(near(r.realInterval, 2.0) && near(r.panelAtk, 4732.8) && near(r.skillTotalDamage, 148915.2) && near(r.skillDps, 3722.88),
  '佩佩 S3 时光震荡(间隔+0.2、每击 +20% 叠 4 层)148915.2/3722.88 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4058_pepe', -1, { moduleId: 'uniequip_002_pepe', moduleLevel: 3 });
ok(near(r.panelAtk, 1708.68) && near(r.normalDps, 615.933), '佩佩 X3 常态 (1290+70+113)×1.16=1708.68 实=' + r.panelAtk + '/' + r.normalDps);

// ---- 奥达(落锤默认常驻 +15%,X 模组 +20%) ----
r = run('char_4131_odda', -1);
ok(near(r.panelAtk, 1449) && near(r.normalDps, 471.667), '奥达 常态 (1190+70)×1.15=1449/471.667 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_4131_odda', 0);
ok(near(r.panelAtk, 2898) && near(r.skillTotalDamage, 2298) && near(r.cycleDps, 672.917),
  '奥达 S1 火花溅射(触发型 200%)2298/672.917 实=' + r.skillTotalDamage + '/' + r.cycleDps);
r = run('char_4131_odda', 1);
ok(near(r.panelAtk, 2457) && near(r.skillTotalDamage, 18570) && near(r.skillDps, 1031.667),
  '奥达 S2 锻锤之力(+80%)18570/1031.667 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4131_odda', -1, { moduleId: 'uniequip_002_odda', moduleLevel: 3 });
ok(near(r.panelAtk, 1614) && near(r.normalDps, 563.333), '奥达 X3 常态 (1190+70+85)×1.20=1614/563.333 实=' + r.panelAtk + '/' + r.normalDps);

// ---- 祐天寺若麦(毋畏爱意 +8% 自身吃;S1 三连击 151%/20%/20%;S2 八连击 118%×2 + 10%×6) ----
r = run('char_4185_amoris', -1);
ok(near(r.panelAtk, 1328.4) && near(r.normalDps, 404.667), '祐天寺若麦 常态 (1190+40)×1.08=1328.4/404.667 实=' + r.panelAtk + '/' + r.normalDps);
r = run('char_4185_amoris', 0);
ok(near(r.skillTotalDamage, 11459.616) && near(r.skillDps, 763.974),
  '祐天寺若麦 S1 如焰般热烈(三连击 151%/20%/20%,8 轮)11459.616/763.974 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4185_amoris', 1);
ok(near(r.skillTotalDamage, 25673.388) && near(r.skillDps, 1069.725),
  '祐天寺若麦 S2 如麦般生长(八连击 118%×2+10%×6,13 轮)25673.388/1069.725 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run('char_4185_amoris', -1, { moduleId: 'uniequip_002_amoris', moduleLevel: 3 });
ok(near(r.panelAtk, 1400.76) && near(r.normalDps, 444.867), '祐天寺若麦 X3 常态 (1190+40+67)×1.08=1400.76/444.867 实=' + r.panelAtk + '/' + r.normalDps);

console.log('撼地者: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
