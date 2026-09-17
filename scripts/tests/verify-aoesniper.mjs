// 炮手(aoesniper)验证:E2 满 / 信赖 100 / 潜 0 / 专一档(L7)/ 敌 def600 res50。
// 口径(用户 2026-09-17 说明文本):陨星概率增幅不计、S2 防御 -250 仅对本技能伤害生效;慑砂物理增幅不计;
// W 两天赋增幅不计;菲亚梅塔精力充沛不计、S2 灼痕爆炸只计一次、S3 攻击力提升不计;截云天赋增幅不计。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { calcPhysicalDamage, calcArtsDamage } from '../../src/frontend/js/calculator.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const P = (atk, def = 600) => calcPhysicalDamage(atk, def);
const A = (atk) => calcArtsDamage(atk, 50);
let pass = 0, fail = 0;
const check = (n, ok, ex = '') => { if (ok) pass++; else { fail++; console.log('FAIL: ' + n + (ex ? ' => ' + ex : '')); } };
const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
const fl = (a, b) => Math.floor(a / b + 1e-9);
const idx = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
const byId = {}; for (const e of idx) byId[e.id] = e;
const IP = {};
const load = (id) => {
  if (IP[id]) return IP[id];
  const e = byId[id];
  const o = JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8'));
  const el = o.phases.length - 1;
  IP[id] = { o, slot: { elite: el, level: o.phases[el].maxLevel, trustPercent: 100, potentialRank: 0, skillIndex: -1, skillLevel: 7, module: null } };
  return IP[id];
};
const run = (id, si, module = null) => calculateOperator(load(id).o, { ...load(id).slot, skillIndex: si, module });
const L7 = (id, si) => { const lv = load(id).o.skills[si].levels; return lv[7] ?? lv[lv.length - 1]; };
const panel = (id) => run(id, -1).panelAtk;
const ids = ['char_113_cqbw', 'char_300_phenxi', 'char_219_meteo', 'char_379_sesa', 'char_4078_bdhkgt', 'char_118_yuki', 'char_282_catap'];
for (const id of ids) check('索引含炮手 ' + id, byId[id] && byId[id].subProfessionId === 'aoesniper');
check('炮手共 7 人', idx.filter((o) => o.subProfessionId === 'aoesniper').length === 7);

// W:天赋增幅不计,三技能均为 单次 atk_scale(多目标只算主目标)
{
  const a = panel('char_113_cqbw');
  check('W 常态=面板普攻(设伏/落井下石不计)', near(run('char_113_cqbw', -1).normalDps, P(a) / 2.8));
  check('W S1 单次=3.2×atk', near(run('char_113_cqbw', 0).skillTotalDamage, P(a * L7('char_113_cqbw', 0).atk_scale)));
  check('W S2 单次=2.6×atk', near(run('char_113_cqbw', 1).skillTotalDamage, P(a * L7('char_113_cqbw', 1).atk_scale)));
  check('W S3 单次=2.9×atk(仅主目标)', near(run('char_113_cqbw', 2).skillTotalDamage, P(a * L7('char_113_cqbw', 2).atk_scale)));
}
// 菲亚梅塔:宣告终局仅技能外 +27;S2 主爆炸+灼痕一次;S3 攻击力提升不计(永续=常态)
{
  const a = panel('char_300_phenxi');
  const s1 = run('char_300_phenxi', 0), s2 = run('char_300_phenxi', 1), s3 = run('char_300_phenxi', 2);
  check('菲亚梅塔 常态间隔=2.8/1.27(宣告终局技能外 +27)', near(run('char_300_phenxi', -1).realInterval, 2.8 / 1.27, 0.002));
  check('菲亚梅塔 常态 DPS=普攻×(1+27%)', near(run('char_300_phenxi', -1).normalDps, P(a) / (2.8 / 1.27)));
  check('菲亚梅塔 S1 总伤=1.75×atk×击数(精力充沛不计)', near(s1.skillTotalDamage, P(a * (1 + L7('char_300_phenxi', 0).atk)) * fl(L7('char_300_phenxi', 0).skillDuration, 2.8)));
  check('菲亚梅塔 S2 单次=3.4×atk+灼痕1.7×atk(只计一次)', near(s2.skillTotalDamage, P(a * L7('char_300_phenxi', 1).atk_scale) + P(a * L7('char_300_phenxi', 1).atk_scale_2)), `got ${s2.skillTotalDamage}`);
  check('菲亚梅塔 S3 永续且攻击力提升不计(技能期=常态普攻)', s3.skillTotalDamage === 0 && near(s3.skillDps, P(a) / 2.8, 0.6), `sTot=${s3.skillTotalDamage} sDps=${s3.skillDps}`);
  // X 模组「"律外"特种弹药配给组」(uniequip_002_phenxi):「宣告终局」新增技能期内攻速 +5/+10
  const md = (lv) => ({ moduleId: 'uniequip_002_phenxi', moduleLevel: lv });
  check('菲亚梅塔 X 模 L2 技能期攻速 +5', near(run('char_300_phenxi', 0, md(2)).realInterval, 2.8 / 1.05, 0.002), `got ${run('char_300_phenxi', 0, md(2)).realInterval}`);
  check('菲亚梅塔 X 模 L3 技能期攻速 +10', near(run('char_300_phenxi', 0, md(3)).realInterval, 2.8 / 1.10, 0.002), `got ${run('char_300_phenxi', 0, md(3)).realInterval}`);
  check('菲亚梅塔 X 模 L3 非技能期攻速 30(仅常态)', near(run('char_300_phenxi', -1, md(3)).realInterval, 2.8 / 1.30, 0.002), `got ${run('char_300_phenxi', -1, md(3)).realInterval}`);
}
// 陨星:S1 单次 1.85;S2 防御 -250 仅本技能
{
  const a = panel('char_219_meteo');
  check('陨星 常态 DPS(爆破附着改装不计)', near(run('char_219_meteo', -1).normalDps, P(a) / 2.8));
  check('陨星 S1 单次=1.85×atk', near(run('char_219_meteo', 0).skillTotalDamage, P(a * L7('char_219_meteo', 0).atk_scale)));
  check('陨星 S2 单次=2.6×atk(防御 -250 仅本技能)', near(run('char_219_meteo', 1).skillTotalDamage, P(a * L7('char_219_meteo', 1).atk_scale, 350)), `got ${run('char_219_meteo', 1).skillTotalDamage}`);
}
// 慑砂:S2 每击 attack@atk_scale 2.2
{
  const a = panel('char_379_sesa');
  check('慑砂 常态 DPS(弱点拆解不计)', near(run('char_379_sesa', -1).normalDps, P(a) / 2.8));
  check('慑砂 S2 总伤=2.2×atk×击数', near(run('char_379_sesa', 1).skillTotalDamage, P(a * L7('char_379_sesa', 1)['attack@atk_scale']) * fl(L7('char_379_sesa', 1).skillDuration, 2.8)), `got ${run('char_379_sesa', 1).skillTotalDamage}`);
}
// 截云:S2 停止攻击,飞轮每秒一次 atk_scale 物理伤害
{
  const a = panel('char_4078_bdhkgt');
  check('截云 常态 DPS(初出荒野不计)', near(run('char_4078_bdhkgt', -1).normalDps, P(a) / 2.8));
  const s2 = run('char_4078_bdhkgt', 1);
  check('截云 S2 每秒 atk_scale 物理×ticks', near(s2.skillTotalDamage, P(a * L7('char_4078_bdhkgt', 1).atk_scale) * fl(L7('char_4078_bdhkgt', 1).skillDuration, 1)), `got ${s2.skillTotalDamage}`);
  check('截云 S2 秒伤=单跳伤害', near(s2.skillDps, P(a * L7('char_4078_bdhkgt', 1).atk_scale)));
}
// 白雪:天赋 攻击力+20% 且间隔 +0.2(常态与技能期);S2 每秒法术 attack@atk_scale
{
  const a = panel('char_118_yuki');
  check('白雪 常态间隔=2.8+0.2=3.0', near(run('char_118_yuki', -1).realInterval, 3.0, 0.002));
  check('白雪 常态 DPS=(971×1.2-600)/3.0', near(run('char_118_yuki', -1).normalDps, P(a) / 3.0));
  check('白雪 S1 总伤=面板普攻×击数(仅射程)', near(run('char_118_yuki', 0).skillTotalDamage, P(a) * fl(25, 3.0)));
  const s2 = run('char_118_yuki', 1);
  check('白雪 S2 每秒法术 0.7×atk×25s', near(s2.skillTotalDamage, A(a * L7('char_118_yuki', 1)['attack@atk_scale']) * 25), `got ${s2.skillTotalDamage}`);
  check('白雪 S2 分档为法术', !!s2.dmgTypes.arts && !s2.dmgTypes.physical);
}
// 空爆:仅射程,无伤害变化
{
  const a = panel('char_282_catap');
  check('空爆 S1 总伤=普攻×击数(仅爆炸范围)', near(run('char_282_catap', 0).skillTotalDamage, P(a) * fl(30, 2.8)));
}
console.log(`${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
