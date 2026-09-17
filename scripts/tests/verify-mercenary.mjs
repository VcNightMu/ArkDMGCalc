// 佣兵(mercenary)验证:精二满/满信赖/潜0/专一档/敌 def600 res50
// 口径(用户 2026-09-17):
//   - 可开启装备应变的技能均视为开启装备应变(哈蒂娅 S1 攻击力+80%;S2 延长 15 秒 → 35 秒);
//   - 哈蒂娅「荒野的后裔」攻击力增幅默认叠满(+4%×5 层 = +20%);
//   - 雷狼龙S空爆「斧模式变形」不考虑增加持续时间、所有技能不考虑充能(充能相关攻击力按 0 层);
//   - 雷狼龙S1 连击段数问答确认:变形斩 5 + 五连击 5 + 十连击 10 = 20 击;X 模组特性(每点费用+2%,10 层)= +20%。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL: ' + m); } };
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const load = (id) => JSON.parse(fs.readFileSync(new URL('../../src/frontend/data/WARRIOR/mercenary/' + id + '.json', import.meta.url), 'utf8'));
const run = (op, si, module = null) => {
  const e = op.phases.length - 1;
  return calculateOperator(op, { elite: e, level: op.phases[e].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module });
};

// ---- 哈蒂娅 ----
const had = load('char_394_hadiya');
let r = run(had, -1);
ok(near(r.panelAtk, 702) && near(r.normalDps, 81.6), '哈蒂娅 常态 (530+55)×1.20=702 / 81.6 实=' + r.panelAtk + '/' + r.normalDps);
r = run(had, 0);
ok(near(r.panelAtk, 1170) && near(r.skillTotalDamage, 13680) && near(r.skillDps, 456),
  '哈蒂娅 S1 沙地战术改良(装备应变攻+80%,24 击)13680/456 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run(had, 1);
ok(near(r.panelAtk, 1521) && near(r.skillTotalDamage, 25788) && near(r.skillDps, 736.8),
  '哈蒂娅 S2 剑角之锋(装备应变延长 15s → 35s,28 击)25788/736.8 实=' + r.skillTotalDamage + '/' + r.skillDps);

// ---- 雷狼龙S空爆 ----
const cat = load('char_1049_catap2');
r = run(cat, -1);
ok(near(r.panelAtk, 574) && near(r.normalDps, 22.96), '雷狼龙 常态 574/22.96 实=' + r.panelAtk + '/' + r.normalDps);
r = run(cat, 0);
ok(near(r.realInterval, 2.5) && near(r.skillTotalDamage, 2238.6) && near(r.skillDps, 559.65),
  '雷狼龙 S1 高压回填斩(间隔 2.5s、20 击、每击附 29% 法伤)2238.6/559.65 实=' + r.skillTotalDamage + '/' + r.skillDps);
ok(r.dmgTypes && r.dmgTypes.arts && near(r.dmgTypes.arts.skillTotalDamage, 1664.6), '雷狼龙 S1 法术档 1664.6 实=' + JSON.stringify(r.dmgTypes));
r = run(cat, 1);
ok(near(r.panelAtk, 1090.6) && near(r.skillTotalDamage, 2671.8) && near(r.skillDps, 667.95),
  '雷狼龙 S2 超高输出属性解放斩(装备应变 300% 一击、充能不计)2671.8/667.95 实=' + r.skillTotalDamage + '/' + r.skillDps);
r = run(cat, 0, { moduleId: 'uniequip_002_catap2', moduleLevel: 3 });
ok(near(r.panelAtk, 688.8) && near(r.skillTotalDamage, 3773.52),
  '雷狼龙 X3 S1(模组特性 +20%)3773.52 实=' + r.skillTotalDamage);
r = run(cat, 1, { moduleId: 'uniequip_002_catap2', moduleLevel: 3 });
ok(near(r.panelAtk, 1205.4) && near(r.skillTotalDamage, 3016.2),
  '雷狼龙 X3 S2(模组特性 +20%)3016.2 实=' + r.skillTotalDamage);
r = run(cat, -1, { moduleId: 'uniequip_002_catap2', moduleLevel: 3 });
ok(near(r.panelAtk, 574) && near(r.normalDps, 22.96), '雷狼龙 X3 常态 574/22.96 实=' + r.panelAtk + '/' + r.normalDps);

console.log('佣兵: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
