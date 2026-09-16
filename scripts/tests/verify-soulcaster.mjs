// 塑灵术师(soulcaster)引擎断言 —— 干员:死芒/特克诺
// 口径(用户 2026-09-16):
//  - 召唤物增幅效果只在召唤物侧体现,干员侧只看技能对本体加成(特克诺两技能均只加成召唤物 → 自身输出＝本体普攻)
//  - 特性:攻击造成法术伤害、击倒敌人生成召唤物(事件类不计),召唤物在「特殊-干员附带单位」中查询
//  - 死芒「回光黯淡」攻击力增幅不计;「噩愿」每次释放只算一次爆发(默认场上无召唤物);
//    「折朽」按描述:每 0.5s 对至多 2 名沉睡目标造成 atk_scale×攻击力 法伤,持续 12s;
//    「冠死以冕」总伤 = 单次爆发(atk_scale×攻击力) × 重复次数(技能数据 attack_cnt.max_stack_cnt)
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const idx = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
const byId = {};
for (const e of idx) byId[e.id] = e;

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) pass++; else { fail++; console.log('FAIL: ' + name + (extra ? ' => ' + extra : '')); } };
const near = (a, b, tol = 0.02) => a !== null && a !== undefined && Math.abs(a - b) <= tol;
const A = (atk, res = 50) => atk * (1 - res / 100);

const load = (id) => {
  const e = byId[id];
  return JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8'));
};
const mk = (o, si, module = null) => {
  const elite = o.phases.length - 1;
  return { elite, level: o.phases[elite].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module };
};
const MOD = (o, moduleId, lv) => ({ moduleId, moduleLevel: lv });

// ============ 死芒 char_450_necras ============
{
  const o = load('char_450_necras');
  const r0 = calculateOperator(o, mk(o, -1));
  check('死芒 常态 = A(678)/1.6', near(r0.normalDps, A(678) / 1.6), `got ${r0.normalDps}`);

  const r1 = calculateOperator(o, mk(o, 0));  // 噩愿
  check('死芒 S1噩愿 单次爆发 = A(678×400%)', near(r1.skillTotalDamage, A(678 * 4)), `got ${r1.skillTotalDamage}`);
  check('死芒 S1 常态行留空(手动版点燃类)', r1.normalDps === null || r1.normalDps === undefined, `got ${r1.normalDps}`);
  check('死芒 S1 技能期 DPS = 0(不存在技能期 DPS)', r1.skillDps === 0, `got ${r1.skillDps}`);

  const r2 = calculateOperator(o, mk(o, 1));  // 折朽
  const s2Dot = Math.floor(12 / 0.5) * 2 * A(678 * 1.4);
  check('死芒 S2折朽 总伤 = 24 跳×2目标×A(678×140%)(技能期本体不普攻)', near(r2.skillTotalDamage, s2Dot), `got ${r2.skillTotalDamage} want ${s2Dot}`);
  check('死芒 S2 常态行 = 无技能态', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);

  const r3 = calculateOperator(o, mk(o, 2));  // 冠死以冕
  check('死芒 S3冠死以冕 总伤 = A(678×700%)×3(重复次数)', near(r3.skillTotalDamage, 3 * A(678 * 7)), `got ${r3.skillTotalDamage}`);
  check('死芒 S3 常态行留空(手动版点燃类)', r3.normalDps === null || r3.normalDps === undefined, `got ${r3.normalDps}`);

  const r3m = calculateOperator(o, mk(o, 2, MOD(o, 'uniequip_002_necras', 3)));
  check('死芒 S3 模组L3 总伤 = A(733×700%)×3', near(r3m.skillTotalDamage, 3 * A(733 * 7)), `got ${r3m.skillTotalDamage}`);
}

// ============ 特克诺 char_4164_tecno ============
{
  const o = load('char_4164_tecno');
  const r0 = calculateOperator(o, mk(o, -1));
  check('特克诺 常态 = A(519)/1.6', near(r0.normalDps, A(519) / 1.6), `got ${r0.normalDps}`);

  const r1 = calculateOperator(o, mk(o, 0));  // 关节锁定(只加成召唤物 → 自身不吃 atk)
  check('特克诺 S1 每击不吃召唤物加成(atk 仍 519)', near(r1.skillTotalDamage, Math.floor(25 / 1.6) * A(519)), `got ${r1.skillTotalDamage}`);
  check('特克诺 S1 常态行 = 无技能态', near(r1.normalDps, r0.normalDps), `got ${r1.normalDps}`);

  const r2 = calculateOperator(o, mk(o, 1));  // 恣意挥洒(只加成召唤物攻速 → 自身不吃)
  check('特克诺 S2 不吃召唤物攻速(间隔仍 1.6,20s 12 击)', near(r2.skillTotalDamage, Math.floor(20 / 1.6) * A(519)), `got ${r2.skillTotalDamage}`);
  check('特克诺 S2 常态行 = 无技能态', near(r2.normalDps, r0.normalDps), `got ${r2.normalDps}`);

  const rm = calculateOperator(o, mk(o, 0, MOD(o, 'uniequip_002_tecno', 1)));
  check('特克诺 S1 模组L1(面板 544/间隔 1.5238)', near(rm.skillTotalDamage, Math.floor(25 / 1.5238) * A(544), 1), `got ${rm.skillTotalDamage}`);
}

console.log(`verify-soulcaster: ${pass} 通过, ${fail} 失败`);
if (fail > 0) process.exit(1);
