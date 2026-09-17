// 裂空炮手(skybreaker)验证:天空盒弹药型二技能、埃癸斯「反暗影特殊压制兵装」物理伤害乘区(含模组 te)
// 参数:精二满级/满信赖/潜0/专一档(levels[7])/敌 def600 res50
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.15) => Math.abs(a - b) <= tol;
const load = (id) => JSON.parse(fs.readFileSync(new URL('../../src/frontend/data/SNIPER/skybreaker/' + id + '.json', import.meta.url), 'utf8'));
const idx = JSON.parse(fs.readFileSync(new URL('../../src/frontend/data/index.json', import.meta.url), 'utf8'));

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (op, si, module) => {
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module: module || null });
};

for (const id of ['char_4213_skybx', 'char_4218_aigis']) ok(idx.some(o => o.id === id), 'index 含 ' + id);

// 天空盒:天赋「开门！管理局」只沉默不计;S1 源石火药驾临(充能2次)走强力击周期;S2 电磁脉冲恩宠 10 枚弹药
const sky = load('char_4213_skybx');
let r = run(sky, -1); ok(near(r.normalDps, 182.9), '天空盒常态 DPS=182.9 实=' + r.normalDps);
r = run(sky, 0); ok(near(r.skillTotalDamage, 1958.4) && near(r.cycleDps, 388.3), '天空盒 S1 单发 1958.4 / 循环 388.3 实=' + r.skillTotalDamage + '/' + r.cycleDps);
r = run(sky, 1); ok(near(r.skillTotalDamage, 13680) && near(r.skillDps, 651.4), '天空盒 S2 10 枚弹药×1368 = 13680 实=' + r.skillTotalDamage);

// 埃癸斯:天赋「反暗影特殊压制兵装」造成的物理伤害 ×1.10(E2 潜0)
const aig = load('char_4218_aigis');
r = run(aig, -1); ok(near(r.normalDps, 179.1), '埃癸斯常态 DPS=179.1(含 ×1.10) 实=' + r.normalDps);
r = run(aig, 0); ok(near(r.skillTotalDamage, 14576.8), '埃癸斯 S1 狂宴模式(9 击)14576.8 实=' + r.skillTotalDamage);
r = run(aig, 1); ok(near(r.skillTotalDamage, 6985.4) && near(r.cycleDps, 442.3), '埃癸斯 S2 全弹发射 6×140%+280% = 6985.4 实=' + r.skillTotalDamage + '/' + r.cycleDps);
// X 模组 L3:attr atk+60(面板 1002)、te 伤害乘区提到 1.15
r = run(aig, 0, { moduleId: 'uniequip_002_aigis', moduleLevel: 3 });
ok(near(r.skillTotalDamage, 16605.5), '埃癸斯 X 模组 L3 S1 = 16605.5(面板 1002 ×1.15) 实=' + r.skillTotalDamage);

console.log('裂空炮手: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
