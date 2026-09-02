const fs = require('fs');
const path = require('path');

const EXCEL = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel';
const BASE = path.join(__dirname, '..', 'src', 'frontend', 'data');

// 干员列表按 主职业 → 子职业 → 干员id 三层组织。
// 尚未拉取数据的子职业保留空列表，便于后续按职业补充。
const OPERATORS = {
  PIONEER: { // 先锋
    pioneer: [],                    // 尖兵
    charger: ['char_222_bpipe'],    // 冲锋手
    tactician: [],                  // 战术家
    bearer: [],                     // 执旗手
    agent: [],                      // 情报官
    counsellor: [],                 // 策士
  },
  WARRIOR: { // 近卫
    centurion: [],                  // 强攻手
    fighter: [],                    // 斗士
    artsfghter: ['char_350_surtr'], // 术战者
    instructor: [],                 // 教官
    lord: ['char_172_svrash', 'char_293_thorns'], // 领主
    sword: ['char_010_chen'],       // 剑豪
    musha: [],                      // 武者
    fearless: [],                   // 无畏者
    reaper: [],                     // 收割者
    librator: [],                   // 解放者
    crusher: [],                    // 重剑手
    hammer: [],                     // 撼地者
    primguard: [],                  // 本源近卫
    mercenary: [],                  // 佣兵
  },
  TANK: { // 重装
    protector: [],                  // 铁卫
    guardian: ['char_202_demkni'],  // 守护者
    unyield: [],                    // 不屈者
    artsprotector: [],              // 驭法铁卫
    duelist: [],                    // 决战者
    fortress: [],                   // 要塞
    shotprotector: [],              // 哨戒铁卫
    primprotector: [],              // 本源铁卫
  },
  SNIPER: { // 狙击
    fastshot: ['char_103_angel'],   // 速射手
    closerange: [],                 // 重射手
    aoesniper: [],                  // 炮手
    longrange: [],                  // 神射手
    reaperrange: [],                // 散射手
    siegesniper: [],                // 攻城手
    bombarder: [],                  // 投掷手
    hunter: [],                     // 猎手
    loopshooter: [],                // 回环射手
    skybreaker: [],                 // 裂空炮手
  },
  CASTER: { // 术师
    corecaster: ['char_180_amgoat'], // 中坚术师
    splashcaster: [],               // 扩散术师
    funnel: [],                     // 驭械术师
    phalanx: [],                    // 阵法术师
    mystic: [],                     // 秘术师
    chain: [],                      // 链术师
    blastcaster: [],                // 轰击术师
    primcaster: [],                 // 本源术师
    soulcaster: [],                 // 塑灵术师
  },
  MEDIC: { // 医疗
    physician: [
      'char_147_shining', 'char_003_kalts', 'char_108_silent', 'char_171_bldsk',
      'char_345_folnic', 'char_4196_reckpr', 'char_402_tuye', 'char_117_myrrh',
      'char_187_ccheal', 'char_298_susuro', 'char_120_hibisc', 'char_212_ansel',
      'char_285_medic2',
    ], // 医师
    ringhealer: ['char_128_plosis', 'char_179_cgbird'], // 群愈师
    healer: [],                     // 疗养师
    wandermedic: [],                // 行医
    incantationmedic: ['char_1020_reed2'], // 咒愈师
    chainhealer: [],                // 链愈师
    watchman: [],                   // 守望者
  },
  SUPPORT: { // 辅助
    slower: ['char_291_aglina'],    // 凝滞师
    underminer: [],                 // 削弱者
    bard: [],                       // 吟游者
    blessing: [],                   // 护佑者
    summoner: [],                   // 召唤师
    craftsman: [],                  // 工匠
    ritualist: [],                  // 巫役
    supportiveranger: [],           // 游击手
  },
  SPECIAL: { // 特种
    executor: ['char_144_red'],     // 处决者
    pusher: [],                     // 推击手
    stalker: [],                    // 伏击客
    hookmaster: [],                 // 钩索师
    geek: [],                       // 怪杰
    merchant: [],                   // 行商
    traper: [],                     // 陷阱师
    dollkeeper: [],                 // 傀儡师
    alchemist: [],                  // 炼金师
    skywalker: [],                  // 巡空者
  },
};

// 展平嵌套结构，得到所有待拉取的干员 id
function flattenOperators() {
  const ids = [];
  for (const prof of Object.values(OPERATORS)) {
    for (const subList of Object.values(prof)) {
      ids.push(...subList);
    }
  }
  return ids;
}

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
      magicResistance: akf[0].data.magicResistance ?? 0,
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

  for (const id of flattenOperators()) {
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
