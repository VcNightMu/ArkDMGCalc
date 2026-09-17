// 猎手(hunter)验证:补弹间隔(常态 1攻1装弹 = 2×攻击间隔;X 模组 2攻1装弹 = 1.5×攻击间隔)+ 三人技能口径
// 参数:精二满级/满信赖/潜0/专一档(levels[7])/敌 def600 res50
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.15) => Math.abs(a - b) <= tol;
const load = (id) => JSON.parse(fs.readFileSync(new URL('../../src/frontend/data/SNIPER/hunter/' + id + '.json', import.meta.url), 'utf8'));
const idx = JSON.parse(fs.readFileSync(new URL('../../src/frontend/data/index.json', import.meta.url), 'utf8'));

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const run = (op, si, module) => {
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module: module || null });
};

for (const id of ['char_4117_ray', 'char_4104_coldst', 'char_4211_snhunt']) ok(idx.some(o => o.id === id), 'index 含 ' + id);

// 莱伊:常态间隔 1.6→3.2(1攻1装弹);X 模组 2攻1装弹 → 2.4;入神满层常驻(atk+24%)
const ray = load('char_4117_ray');
let r = run(ray, -1);
ok(near(r.realInterval, 3.2), '莱伊常态间隔 3.2(=2×1.6) 实=' + r.realInterval);
const rayX = (ray.modules || []).find(m => (m.levels || []).length);
r = run(ray, -1, { moduleId: rayX.id, level: rayX.levels.length, moduleLevel: rayX.levels.length });
ok(near(r.realInterval, 2.4), '莱伊 X 模组常态间隔 2.4(=1.5×1.6) 实=' + r.realInterval);
r = run(ray, 0); ok(near(r.skillTotalDamage, 4048.8), '莱伊 S1 总伤 4048.8 实=' + r.skillTotalDamage);
r = run(ray, 2); ok(near(r.realInterval, 2.0) && near(r.skillTotalDamage, 4736.0), '莱伊 S3 间隔 2.0(reload -1.2)/总伤 4736.0 实=' + r.realInterval + '/' + r.skillTotalDamage);
r = run(ray, 1); ok(r.skillDps > 0, '莱伊 S2 有输出 实=' + r.skillDps);

// 冰酿:不甘示弱(无模组默认生效);S2 装填间隔 +0.8 → 循环 4.0
const cold = load('char_4104_coldst');
r = run(cold, -1); ok(near(r.realInterval, 3.2), '冰酿常态间隔 3.2 实=' + r.realInterval);
r = run(cold, 1); ok(near(r.realInterval, 4.0) && near(r.skillTotalDamage, 16854.5), '冰酿 S2 间隔 4.0(reload +0.8)/总伤 16854.5 实=' + r.realInterval + '/' + r.skillTotalDamage);

// 雪猎:风雪连弩默认敌人在移动(取 atk_scale_1)
const sn = load('char_4211_snhunt');
r = run(sn, -1); ok(near(r.realInterval, 3.2), '雪猎常态间隔 3.2 实=' + r.realInterval);
r = run(sn, 0); ok(near(r.skillTotalDamage, 1607.1), '雪猎 S1 总伤 1607.1 实=' + r.skillTotalDamage);

console.log('猎手: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
