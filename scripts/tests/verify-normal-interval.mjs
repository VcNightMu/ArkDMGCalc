// 常态回归:普攻(常态)必须等于「无技能状态」——间隔取基础(面板)间隔(不含技能期攻速),
// 法脆/天赋等技能期才生效的增益也不得漏进常态(如焰苇S3灼痕必触发)。
// 覆盖:改攻速/改间隔的技能 + 技能期才生效法脆的情况;同时校验效果模组各档。
// 例外(常态本就随技能变化,单独在各自 verify 中断言):森蚺S1/深巡S1S2/夜魔S2/GALLUS²S1。
import { calculateOperator } from '../../src/frontend/js/damage-calc.js';
import { state } from '../../src/frontend/js/state.js';
import fs from 'fs';
import path from 'path';

state.enemy = { hp: 50000, atk: 800, def: 600, res: 50, grade: 'normal' };
const DATA = 'F:/ArkCodes/ArkDMGCalc/src/frontend/data';
const idx = JSON.parse(fs.readFileSync(DATA + '/index.json', 'utf8'));
const byId = {};
for (const e of idx) byId[e.id] = e;

const IDS = [
  'char_222_bpipe', 'char_261_sddrag', 'char_290_vigna', 'char_192_falco', // 冲锋手
  'char_411_tomimi', 'char_466_qanik', 'char_002_amiya', 'char_141_nights', 'char_180_amgoat', // 中坚术师
  'char_2015_dusk', 'char_166_skfire', 'char_253_greyy', 'char_109_fmout', 'char_121_lava', 'char_341_sntlla', 'char_213_mostma', 'char_1011_lava2', // 扩散术师
  'char_377_gdglow', 'char_4236_tmslot', 'char_4054_malist', 'char_4040_rockr', // 驭械术师
  'char_479_sleach', 'char_497_ctable', // 执旗手/情报官
  'char_249_mlyss', 'char_4228_closur', // 战术家
  'char_4080_lin', 'char_426_billro', 'char_4046_ebnhlz', 'char_469_indigo', 'char_4004_pudd', 'char_134_ifrit', 'char_4204_mantra', 'char_4081_warmy', 'char_4164_tecno', // 术师其余子职业
  'char_4026_vulpis', 'char_420_flamtl', // 尖兵/冲锋手(其他)
  'char_1020_reed2', // 咒愈师(焰苇S3灼痕:技能期才必触发法脆,常态不得计入)
];

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) pass++; else { fail++; console.log('FAIL: ' + name + (extra ? ' => ' + extra : '')); } };

for (const id of IDS) {
  const e = byId[id];
  if (!e) { fail++; console.log('FAIL: 缺干员 ' + id); continue; }
  const o = JSON.parse(fs.readFileSync(path.join(DATA, e.profession, e.subProfessionId, id + '.json'), 'utf8'));
  const elite = o.phases.length - 1;
  const level = o.phases[elite].maxLevel;
  const mk = (si, module) => ({ elite, level, trustPercent: 100, potentialRank: 0, skillIndex: si, skillLevel: 7, module });

  const mods = [null];
  for (const m of (o.modules || [])) if (m.type === 'ADVANCED') for (const lv of (m.levels || [])) mods.push({ moduleId: m.id, moduleLevel: lv.level });

  for (const mod of mods) {
    const tag = mod ? (mod.moduleId + '/L' + mod.moduleLevel) : '';
    const n0 = calculateOperator(o, mk(-1, mod)).normalDps;
    if (n0 === null || n0 === undefined) continue;
    (o.skills || []).forEach((s, si) => {
      const r = calculateOperator(o, mk(si, mod));
      if (r.normalDps === null || r.normalDps === undefined) return; // 停攻归常态为 null 的技能另行断言
      check(`${o.name}(${id})${tag} S${si + 1} 常态=无技能态(${n0.toFixed(2)})`, Math.abs(r.normalDps - n0) <= 0.02, `got ${r.normalDps}`);
    });
  }
}

console.log(`${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
