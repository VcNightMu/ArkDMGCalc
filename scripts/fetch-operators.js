// 从 Kengxxiao/ArknightsGameData 拉取所有需要的数据，存本地 JSON
// 运行: node scripts/fetch-operators.js
const fs = require('fs');
const path = require('path');

const OPERATORS = [
  'char_172_svrash', 'char_010_chen', 'char_293_thorns', 'char_103_angel',
  'char_180_amgoat', 'char_350_surtr', 'char_222_bpipe', 'char_202_demkni',
  'char_147_shining', 'char_291_aglina', 'char_144_red'
];

const EXCEL = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel';
const OUT = path.join(__dirname, '..', 'src', 'frontend', 'data');

async function fetchJSON(url) {
  const resp = await fetch(url, { headers: { 'User-Agent': 'ArkDMGCalc/1.0' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

function convertOperator(id, charData, skillTable) {
  const phases = [];
  for (const [key, phaseData] of Object.entries(charData.phases || {})) {
    const eliteLevel = parseInt(key);
    const akf = phaseData.attributesKeyFrames || [];
    if (akf.length === 0) continue;
    const first = akf[0].data;
    const last = akf[akf.length - 1].data;
    phases.push({
      eliteLevel,
      maxLevel: phaseData.maxLevel,
      atk: [first.atk, last.atk],
      def: [first.def, last.def],
      maxHp: [first.maxHp, last.maxHp],
      magicResistance: first.magicResistance || 0,
      baseAttackTime: first.baseAttackTime || 1.0,
      attackSpeed: first.attackSpeed || 100,
    });
  }
  phases.sort((a, b) => a.eliteLevel - b.eliteLevel);

  const favorKf = charData.favorKeyFrames || [];
  let trustBonus = { atk: 0, def: 0, maxHp: 0 };
  if (favorKf.length > 0) {
    const max = favorKf[favorKf.length - 1].data;
    trustBonus = { atk: max.atk || 0, def: max.def || 0, maxHp: max.maxHp || 0 };
  }

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
      const isToggle = desc.includes('\u5207\u6362') && (lv.duration === 0 || lv.duration === -1);
      const isPermanent = !isToggle && ((lv.duration === -1) || (lv.duration === 0 && lv.skillType === 'AUTO' && (spData.spCost || 0) >= 20));
      // Blackboard first, then core fields (core fields must come after to avoid being overwritten)
      levels.push({ ...bb, level: levelNum, spCost: spData.spCost || 0, initialSp: spData.initSp || 0, spType: spData.spType || 'INCREASE_WITH_TIME', duration: lv.duration, isToggle, isPermanent });
    }
    levels.sort((a, b) => a.level - b.level);
    const firstLevel = Object.values(st.levels || {})[0];
    skills.push({ skillId: sid, name: firstLevel?.name || sid, levels });
  }

  // Determine damage type from subprofession
  const artsSubs = ['artsfghter','corecaster','splashcaster','blastcaster','funnel','mystic','chain','primcaster','soulcaster','phalanx'];
  const damageType = artsSubs.includes(charData.subProfessionId) ? 'arts' : 'physical';

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
    })),
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  console.log('拉取 character_table.json ...');
  const charTable = await fetchJSON(`${EXCEL}/character_table.json`);

  console.log('拉取 skill_table.json ...');
  const skillTable = await fetchJSON(`${EXCEL}/skill_table.json`);

  console.log('拉取 uniequip_table.json ...');
  const uniequip = await fetchJSON(`${EXCEL}/uniequip_table.json`);
  // 子职业字典
  fs.writeFileSync(path.join(OUT, 'sub-professions.json'), JSON.stringify(uniequip.subProfDict, null, 2));
  console.log('  → sub-professions.json');

  // 干员数据
  const index = [];
  for (const id of OPERATORS) {
    const ch = charTable[id];
    if (!ch) { console.log(`  [SKIP] ${id}`); continue; }
    const converted = convertOperator(id, ch, skillTable);
    fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(converted, null, 2));
    index.push({ id: converted.id, name: converted.name, rarity: converted.rarity, profession: converted.profession });
    console.log(`  [OK] ${converted.name}: ${converted.phases.length} phases, ${converted.skills.length} skills`);
  }

  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`\n完成: ${index.length} 个干员 + sub-professions.json → ${OUT}`);
}

main().catch(console.error);
