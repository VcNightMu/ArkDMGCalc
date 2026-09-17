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
  'char_377_gdglow', 'char_4236_tmslot', 'char_4054_malist', 'char_4040_rockr', 'char_1038_whitw2', 'char_4013_kjera', 'char_328_cammou', 'char_450_necras', 'char_4164_tecno', // 驭械术师
  'char_479_sleach', 'char_497_ctable', // 执旗手/情报官
  'char_249_mlyss', 'char_4228_closur', // 战术家
  'char_4080_lin', 'char_426_billro', 'char_4046_ebnhlz', 'char_469_indigo', 'char_4004_pudd', 'char_134_ifrit', 'char_4204_mantra', 'char_4081_warmy', 'char_4164_tecno', // 术师其余子职业
  'char_1040_blaze2', 'char_4146_nymph', 'char_4198_christ', 'char_499_kaitou', // 本源术师(补:烛煌/妮芙/Christine/折光;真言/温米已在上行)
  'char_4026_vulpis', 'char_420_flamtl', // 尖兵/冲锋手(其他)
  'char_1020_reed2', // 咒愈师(焰苇S3灼痕:技能期才必触发法脆,常态不得计入)
  'char_4226_veen', 'char_4110_delphn', 'char_297_hamoni', 'char_338_iris', // 秘术师(维伊/戴菲恩/和弦/爱丽丝;黑键/深靛已在上方)
  'char_472_pasngr', 'char_135_halo', 'char_306_leizi', // 链术师(异客/星源/惊蛰;布丁已在上方)
  'char_4229_aphris', 'char_134_ifrit', 'char_446_aroma', 'char_489_serum', 'char_4051_akkord', // 轰击术师(谬因/伊芙利特/阿罗玛/蚀清/协律)
  'char_103_angel', 'char_332_archet', 'char_456_ash', 'char_129_bluep', 'char_204_platnm', 'char_365_aprl', 'char_367_swllow', 'char_498_inside', 'char_1021_kroos2', 'char_126_shotst', 'char_133_mm', 'char_190_clour', 'char_235_jesica', 'char_124_kroos', 'char_211_adnach', 'char_503_rang', 'char_4000_jnight', // 速射手
  'char_340_shwaz', 'char_4055_bgsnow', 'char_1048_orchd2', 'char_145_prove', 'char_4006_melnte', 'char_366_acdrop', // 重射手
  'char_113_cqbw', 'char_300_phenxi', 'char_219_meteo', 'char_379_sesa', 'char_4078_bdhkgt', 'char_118_yuki', 'char_282_catap', // 炮手
  'char_430_fartth', 'char_4193_lemuen', 'char_158_milu', 'char_218_cuttle', 'char_4014_lunacu', 'char_302_glaze', // 神射手
  'char_1013_chen2', 'char_279_excu', 'char_346_aosta', 'char_4203_kichi', 'char_440_pinecn', // 散射手
  'char_197_poca', 'char_2012_typhon', 'char_363_toddi', 'char_4043_erato', 'char_4221_ju', 'char_4062_totter', // 攻城手
  'char_391_rosmon', 'char_1035_wisdel', 'char_1027_greyy2', 'char_4077_palico',  // 投掷手
  'char_4117_ray', 'char_4104_coldst', 'char_4211_snhunt',  // 猎手
  'char_4138_narant', 'char_4177_brigid', 'char_4100_caper',  // 回环射手
  'char_4213_skybx', 'char_4218_aigis',  // 裂空炮手
  'char_283_midn', 'char_193_frostl', 'char_271_spikes', 'char_4067_lolxh', 'char_140_whitew', 'char_294_ayer', 'char_194_leto', 'char_172_svrash', 'char_293_thorns', 'char_4082_qiubai', 'char_4182_oblvns',  // 近卫·领主
  'char_017_huang', 'char_1026_gvial2', 'char_127_estell', 'char_143_ghost', 'char_230_savage', 'char_281_popka', 'char_356_broca', 'char_4126_fuze', 'char_4166_varkis',  // 近卫·强攻手
  'char_137_brownb', 'char_155_tiger', 'char_157_dagda', 'char_2024_chyue', 'char_264_f12yin', 'char_347_jaksel', 'char_4037_demetr', 'char_415_flint',  // 近卫·斗士
  'char_130_doberm', 'char_265_sophia', 'char_308_swire', 'char_4106_bryota', 'char_4125_rdoc', 'char_485_pallas',  // 近卫·教官
  'char_010_chen', 'char_252_bibeak', 'char_301_cutter', 'char_4009_irene', 'char_4116_blkkgt', 'char_4220_kormr', 'char_459_tachak',  // 近卫·剑豪
  'char_1030_noirc2', 'char_188_helage', 'char_337_utage', 'char_4121_zuole', 'char_475_akafyu',  // 近卫·武者(宴 S2 落地限时被动不得折进常态)
  'char_1032_excu2', 'char_4010_etlchi', 'char_4066_highmo', 'char_421_crow', 'char_491_humus',  // 近卫·收割者(圣约送葬人弹药槽:常态行仍为自身普攻)
  'char_1043_leizi2', 'char_4064_mlynar', 'char_445_wscoot', 'char_486_takila',  // 近卫·解放者(特性「通常不攻击」→ 常态行恒 0)
  'char_1014_nearl2', 'char_106_franka', 'char_131_flameb', 'char_154_morgan', 'char_159_peacok', 'char_208_melan', 'char_263_skadi', 'char_286_cast3', 'char_289_gyuki', 'char_4011_lessng', 'char_4142_laios',  // 近卫·无畏者(限时被动不得折进常态)
  'char_4063_quartz', 'char_4083_chimes', 'char_4088_hodrer', 'char_4145_ulpia',  // 近卫·重剑手(赫德雷 S2 切换型被动见 NORMAL_EXCEPT)
  'char_1051_headb2', 'char_4058_pepe', 'char_4131_odda', 'char_4185_amoris',  // 近卫·撼地者
  'char_4187_graceb',  // 近卫·本源近卫
  'char_394_hadiya', 'char_1049_catap2',  // 近卫·佣兵
];

// 设计例外:该槽常态与无技能态本就不同(已按用户口径建模),不计入本不变量
const NORMAL_EXCEPT = {
  'char_4040_rockr': { 1: 1 },    // 洛洛 S2「自负此轭」:携带时技能后过载 20s/40s 无输出,常态按 0.5 计
  'char_1038_whitw2': { 0: 1 },   // 荒芜拉普兰德 S1「慵怠者悲鸣」被动:浮游单元+1 装备即常驻(含常态)
  'char_489_serum': { 0: 1 },     // 蚀清 S1「专注力超载」:技能结束眩晕 10s(技能 30s)→ 常态按 2/3 计
  'char_4088_hodrer': { 1: 1 },   // 赫德雷 S2「余烬重荷」切换型:被动攻击力 +32% 装备即生效(含该槽常态列,用户口径 2026-09-17)
};
let pass = 0, fail = 0, excl = 0;
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
      if ((NORMAL_EXCEPT[id] || {})[si]) { excl++; return; }
      const r = calculateOperator(o, mk(si, mod));
      if (r.normalDps === null || r.normalDps === undefined) return; // 停攻归常态为 null 的技能另行断言
      check(`${o.name}(${id})${tag} S${si + 1} 常态=无技能态(${n0.toFixed(2)})`, Math.abs(r.normalDps - n0) <= 0.02, `got ${r.normalDps}`);
    });
  }
}

console.log(`${pass} 通过, ${excl} 设计例外跳过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
