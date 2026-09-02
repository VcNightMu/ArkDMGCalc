const fs = require('fs');
const path = require('path');

const EXCEL = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel';
const BASE = path.join(__dirname, '..', 'src', 'frontend', 'data');

const OPERATORS = [
  'char_172_svrash', 'char_010_chen', 'char_293_thorns', 'char_103_angel',
  'char_180_amgoat', 'char_350_surtr', 'char_222_bpipe', 'char_202_demkni',
  'char_147_shining', 'char_291_aglina', 'char_144_red',
  // MEDIC - physician (all)
  'char_128_plosis', // 白面鸮 (ringhealer)
  'char_179_cgbird', // 夜莺 (ringhealer)
  'char_1020_reed2', // 焰影苇草 (incantationmedic)
  'char_147_shining', // 闪灵
  'char_003_kalts', // 凯尔希
  'char_108_silent', // 赫默
  'char_171_bldsk', // 华法琳
  'char_345_folnic', // 亚叶
  'char_4196_reckpr', // 录武官
  'char_402_tuye', // 图耶
  'char_117_myrrh', // 末药
  'char_187_ccheal', // 嘉维尔
  'char_298_susuro', // 苏苏洛
  'char_120_hibisc', // 芙蓉
  'char_212_ansel', // 安赛尔
  'char_285_medic2', // Lancet-2
];

async function fetchJSON(url) {
  const resp = await fetch(url, { headers: { 'User-Agent': 'ArkDMGCalc/1.0' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

function convertOperator(id, charData, skillTable) {
  const phases = [];
  for (const [, p] of Object.entries(charData.phases || {})) {
    const akf = p.attributesKeyFrames || [];
    if (akf.length === 0) continue;
    phases.push({
      eliteLevel: p.phases?.[0]?.eliteLevel ?? (phases.length),
      maxLevel: p.maxLevel,
      atk: [akf[0].data.atk, akf[akf.length - 1].data.atk],
      def: [akf[0].data.def, akf[akf.length - 1].data.def],
      maxHp: [akf[0].data.maxHp, akf[akf.length - 1].data.maxHp],
      baseAttackTime: akf[0].data.baseAttackTime || 1.0,
      attackSpeed: akf[0].data.attackSpeed || 100,
    });
  }
  phases.sort((a, b) => a.eliteLevel - b.eliteLevel);

  const favorKf = charData.favorKeyFrames || [];
  let trustBonus = { atk: 0, def: 0, maxHp: 0 };
  if (favorKf.length > 0) {
    const max = favorKf[favorKf.length - 1].data;
    trustBonus = { atk: max.atk || 0, def: max.def || 0, maxHp: max.maxHp || 0 };
  }

  const artsSubs = ['artsfghter','corecaster','splashcaster','blastcaster','funnel','mystic','chain','primcaster','soulcaster','phalanx'];
  const damageType = artsSubs.includes(charData.subProfessionId) ? 'arts' : 'physical';

  const skills = [];
  for (const skillRef of charData.skills || []) {
    const sid = skillRef.skillId;
    const st = skillTable[sid];
    if (!st) continue;
    const levels = [];
    for (const [lk, lv] of Object.entries(st.levels || {})) {
      const levelNum = parseInt(lk.replace('LEVEL_', ''));
      const bb = {};
      for (const b of lv.blackboard || []) bb[b.key] = b.value;
      const spData = lv.spData || {};
      const desc = lv.description || '';
      const isToggle = desc.includes('可以在下列状态和初始状态间切换');
      const isPermanent = !isToggle && desc.includes('持续时间无限');
      levels.push({ ...bb, level: levelNum, spCost: spData.spCost || 0, initialSp: spData.initSp || 0, spType: spData.spType || 'INCREASE_WITH_TIME', duration: lv.duration, isToggle, isPermanent });
    }
    levels.sort((a, b) => a.level - b.level);
    const firstLevel = Object.values(st.levels || {})[0];
    skills.push({ skillId: sid, name: firstLevel?.name || sid, levels });
  }

  return {
    id, name: charData.name, rarity: charData.rarity,
    profession: charData.profession, subProfessionId: charData.subProfessionId,
    damageType,
    phases, trustBonus, skills,
    potentialRanks: (charData.potentialRanks || []).map(p => ({
      description: p.description,
      type: p.type,
      modifiers: p.buff?.attributes?.attributeModifiers?.map(m => ({
        attr: m.attributeType, formula: m.formulaItem, value: m.value
      })) || []
    }))
  };
}

async function main() {
  console.log('拉取 character_table.json ...');
  const charTable = await fetchJSON(`${EXCEL}/character_table.json`);
  console.log('拉取 skill_table.json ...');
  const skillTable = await fetchJSON(`${EXCEL}/skill_table.json`);
  console.log('拉取 uniequip_table.json ...');
  const uniequipTable = await fetchJSON(`${EXCEL}/uniequip_table.json`);

  // Save sub-professions dictionary
  const subProfDict = uniequipTable.subProfDict || {};
  fs.writeFileSync(path.join(BASE, 'sub-professions.json'), JSON.stringify(subProfDict, null, 2), 'utf8');
  console.log('  → sub-professions.json');

  const index = [];

  for (const id of OPERATORS) {
    const charData = charTable[id];
    if (!charData) { console.log(`  [SKIP] ${id} not found`); continue; }
    const converted = convertOperator(id, charData, skillTable);
    // Directory: profession/subProfessionId/
    const dir = path.join(BASE, converted.profession, converted.subProfessionId);
    fs.mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, `${id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(converted, null, 2), 'utf8');
    index.push({ id: converted.id, name: converted.name, rarity: converted.rarity, profession: converted.profession, subProfessionId: converted.subProfessionId });
    console.log(`  [OK] ${converted.name}: ${converted.phases.length} phases, ${converted.skills.length} skills → ${converted.profession}/${converted.subProfessionId}/`);
  }

  // Save index
  fs.writeFileSync(path.join(BASE, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
  console.log(`\n完成: ${index.length} 个干员 + sub-professions.json → ${BASE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
