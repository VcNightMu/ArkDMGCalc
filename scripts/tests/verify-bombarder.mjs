// 投掷手(bombarder)验证:特性余震(含 5% 保底伤害)、迷迭香/维什戴尔/承曦格雷伊技能口径
// 参数:精二满级/满信赖/潜0/专一档(levels[7])/敌 def600 res50
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.15) => Math.abs(a - b) <= tol;
const load = (id) => JSON.parse(fs.readFileSync(new URL('../../src/frontend/data/SNIPER/bombarder/' + id + '.json', import.meta.url), 'utf8'));
const idx = JSON.parse(fs.readFileSync(new URL('../../src/frontend/data/index.json', import.meta.url), 'utf8'));

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (op, si, module) => {
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module: module || null });
};

for (const id of ['char_391_rosmon', 'char_1035_wisdel', 'char_1027_greyy2', 'char_4077_palico']) {
  ok(idx.some(o => o.id === id), 'index 含 ' + id);
}

// 迷迭香:常态含 2 次余震(0.5×atk,5% 保底)
const rosm = load('char_391_rosmon');
let r = run(rosm, -1);
ok(near(r.normalDps, 88.3), '迷迭香常态 DPS=88.3(含余震保底) 实=' + r.normalDps);
r = run(rosm, 0); ok(near(r.skillTotalDamage, 185.4), '迷迭香 S1 总伤 185.4 实=' + r.skillTotalDamage);
r = run(rosm, 1); ok(near(r.realInterval, 1.05) && near(r.skillTotalDamage, 16659.9), '迷迭香 S2 间隔 1.05 / 总伤 16659.9 实=' + r.realInterval + '/' + r.skillTotalDamage);
r = run(rosm, 2); ok(near(r.realInterval, 1.6) && near(r.skillTotalDamage, 15708.0), '迷迭香 S3 间隔 1.6 / 总伤 15708.0(目标默认被阻挡) 实=' + r.realInterval + '/' + r.skillTotalDamage);

// 维什戴尔:好礼额外伤害仅 3 技能计;饱和复仇过载 4 连发全中
const wis = load('char_1035_wisdel');
r = run(wis, -1); ok(near(r.normalDps, 102.8), '维什戴尔常态 DPS=102.8 实=' + r.normalDps);
r = run(wis, 1); ok(near(r.realInterval, 1.4) && near(r.skillTotalDamage, 9922.6), '维什戴尔 S2(过载4连发) 间隔 1.4 / 总伤 9922.6 实=' + r.realInterval + '/' + r.skillTotalDamage);
r = run(wis, 2); ok(near(r.realInterval, 5.0) && near(r.skillTotalDamage, 40145.4), '维什戴尔 S3(含好礼) 间隔 5.0 / 总伤 40145.4 实=' + r.realInterval + '/' + r.skillTotalDamage);

// 承曦格雷伊:窃光链缚伤害增幅不计;晨曦信标雷电球 120% 法伤
const gr = load('char_1027_greyy2');
r = run(gr, -1); ok(near(r.normalDps, 58.3), '承曦格雷伊常态 DPS=58.3 实=' + r.normalDps);
r = run(gr, 0); ok(near(r.skillTotalDamage, 8573.1), '承曦格雷伊 S1 总伤 8573.1 实=' + r.skillTotalDamage);
r = run(gr, 1); ok(near(r.skillTotalDamage, 2889.6), '承曦格雷伊 S2 雷电球总伤 2889.6 实=' + r.skillTotalDamage);

// 泰拉大陆调查团:1★ 无技能,常态含余震
const pal = load('char_4077_palico');
r = run(pal, -1); ok(near(r.normalDps, 14.6), '泰拉大陆调查团常态 DPS=14.6 实=' + r.normalDps);

console.log('投掷手: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
