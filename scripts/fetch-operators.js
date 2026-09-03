const fs = require('fs');
const path = require('path');

const EXCEL = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel';
const BASE = path.join(__dirname, '..', 'src', 'frontend', 'data');

// 升变/特殊形态干员：数据在 char_patch_table（不在 character_table 主表）。
// 显示名需与原型区分（半角括号与 prts 头像文件名一致，如「头像_阿米娅(医疗).png」）。
const PATCH_CHARS = {
  'char_1037_amiya3': '阿米娅(医疗)',   // 阿米娅升变·医疗形态（咒愈师）
};

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
    ringhealer: ['char_128_plosis', 'char_179_cgbird', 'char_181_flower', 'char_275_breeze', 'char_4163_rosesa'], // 群愈师/瑰盐
    healer: ['char_385_finlpp', 'char_348_ceylon', 'char_436_whispr', 'char_4173_nowell', 'char_4042_lumen'],                     // 疗养师
    wandermedic: ['char_4041_chnut', 'char_473_mberry', 'char_449_glider', 'char_4114_harold', 'char_1016_agoat2'],                // 行医
    incantationmedic: ['char_1024_hbisc2', 'char_494_vendla', 'char_1020_reed2', 'char_4056_titi', 'char_1037_amiya3'], // 咒愈师（阿米娅医疗形态走 patch 表）
    chainhealer: ['char_4179_monstr', 'char_4071_peper', 'char_4139_papyrs', 'char_4224_turdus'], // 链愈师（Mon3tr干员本体/明椒/莎草/乌啾）
    watchman: ['char_4222_taraxa', 'char_1052_kalts2'],  // 守望者
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
  TOKEN: { // 特殊（干员附带单位/召唤物）
    notchar1: ['token_10000_silent_healrb', 'token_10002_kalts_mon3tr', 'token_10003_cgbird_bird'], // 干员附带单位（赫默·医疗探机 / 凯尔希·Mon3tr）
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

function convertTalents(charData) {
  const phaseNum = { PHASE_0: 0, PHASE_1: 1, PHASE_2: 2 };
  const talents = [];
  for (const t of charData.talents || []) {
    const candidates = (t.candidates || []).map(c => {
      const bb = {};
      for (const b of c.blackboard || []) bb[b.key] = b.value;
      return {
        phase: phaseNum[c.unlockCondition?.phase] ?? 0,
        level: c.unlockCondition?.level ?? 1,
        potentialRank: c.requiredPotentialRank ?? 0,
        name: c.name,
        description: c.description,
        blackboard: bb,
        isHideTalent: c.isHideTalent ?? false
      };
    });
    if (candidates.length > 0) talents.push({ candidates });
  }
  return talents;
}

/**
 * 特性（trait）转换：咒愈师等职业的治疗/伤害由特性决定（如攻击时治疗相当于伤害量 scale%）。
 * 取无解锁条件的默认 candidate（PHASE_0），blackboard 存数值变量（如 scale=0.5），
 * 描述文本去掉富文本标签、将 {key:格式} 占位符替换为实际数值（如 {scale:0%} → 50%）。
 */
function convertTrait(charData) {
  const cands = charData.trait?.candidates || [];
  const cand = cands.find(c => (c.unlockCondition?.phase || 'PHASE_0') === 'PHASE_0' && !c.requiredPotentialRank) || cands[0];
  if (!cand) return null;
  const bb = {};
  for (const b of cand.blackboard || []) bb[b.key] = b.value;
  let desc = (cand.overrideDescripton || cand.traitName || '').replace(/<[^>]+>/g, '');
  desc = desc.replace(/\{([a-zA-Z_]+):([^}]*)\}/g, (m, key, fmt) => {
    const v = bb[key];
    if (v === undefined) return m;
    if (fmt.includes('%')) return `${Math.round(v * 100)}%`;
    if (fmt.startsWith('0.')) return String(v);
    return String(v);
  });
  return { description: desc, blackboard: bb };
}

/**
 * 干员模组挂载：从 uniequip_table（元数据）+ battle_equip_table（等级面板）组装。
 * charEquip[charId] 给出该干员全部模组（含 INITIAL 基础证章，order=0），按 charEquipOrder 排序。
 * 每个模组 levels 为 battle_equip phases（键 0/1/2 → 模组等级 1/2/3），
 * attributeBlackboard 为该等级生效后的最终面板加成（非逐级累加）。
 * 召唤物/三星干员无 charEquip 条目 → 不挂载。
 */
function attachModules(converted, charId, uniTable, battleTable) {
  const eq = uniTable.equipDict || {};
  const list = (uniTable.charEquip || {})[charId] || [];
  if (list.length === 0) return;
  const modules = list.map(eid => {
    const meta = eq[eid];
    if (!meta) return null;
    const phases = battleTable[eid]?.phases || {};
    const levels = Object.keys(phases).sort((a, b) => a - b).map(k => {
      const p = phases[k];
      const bb = {};
      for (const b of p.attributeBlackboard || []) bb[b.key] = b.value;
      // 模组对天赋/特性的强化（等级≥2 出现）：parts 中 target=TALENT/TALENT_DATA_ONLY 的候选，
      // 数值覆盖类（如闪灵X L2 法典攻速 10→15）与附加效果类（装备技能2 攻击+15%）都在这。
      const talentEnhance = [];
      for (const part of p.parts || []) {
        if (part.target !== 'TALENT' && part.target !== 'TALENT_DATA_ONLY') continue;
        const bundle = part.addOrOverrideTalentDataBundle || part.overrideTraitDataBundle;
        for (const c of (bundle && bundle.candidates) || []) {
          if (!c) continue;
          const tbb = {};
          for (const b of c.blackboard || []) tbb[b.key] = b.value;
          talentEnhance.push({
            name: c.name || null,
            requiredPotentialRank: c.requiredPotentialRank ?? 0,
            blackboard: tbb,
          });
        }
      }
      const out = { level: parseInt(k) + 1, attributeBlackboard: bb };
      if (talentEnhance.length > 0) out.talentEnhance = talentEnhance;
      // 特性强化（咒愈师模组把治疗比例 scale 0.5→0.6 等）：target=TRAIT_DATA_ONLY 的 overrideTraitDataBundle
      const traitEnhance = [];
      for (const part of p.parts || []) {
        if (part.target !== 'TRAIT' && part.target !== 'TRAIT_DATA_ONLY') continue;
        for (const c of (part.overrideTraitDataBundle && part.overrideTraitDataBundle.candidates) || []) {
          if (!c) continue;
          const tbb = {};
          for (const b of c.blackboard || []) tbb[b.key] = b.value;
          traitEnhance.push({ blackboard: tbb });
        }
      }
      if (traitEnhance.length > 0) out.traitEnhance = traitEnhance;
      return out;
    });
    return {
      id: eid,
      name: meta.uniEquipName,
      type: meta.type,                    // INITIAL 基础证章 / ADVANCED 效果模组
      typeName2: meta.typeName2 || null,  // 模组代号 X / Y / α 等，证章为 null
      isSpecialEquip: !!meta.isSpecialEquip,
      unlockLevel: meta.unlockLevel || 0, // 开启条件：精二后等级门槛（四星40/五星50/六星60）
      order: meta.charEquipOrder ?? 0,
      levels,
    };
  }).filter(Boolean);
  modules.sort((a, b) => a.order - b.order);
  converted.modules = modules;
}


/**
 * 召唤物技能注入：召唤物自身无技能（skills 为 null 占位）时，将持有者干员的技能注入，
 * 供攻击型召唤物使用（如凯尔希·Mon3tr：其 1/2/3 技能效果 = 凯尔希 1/2/3 技能）。
 * 持有者技能 blackboard 中带 attack@ 前缀的 key 是作用于召唤物的加成（attack@atk → atk，
 * 去前缀后作为召唤物自身的加成）；不带前缀的 key（自身防御/攻速/物格挡等）不注入。
 * 额外识别：描述含「逐渐降低/减少」→ atkDecay（攻击力增幅线性衰减）；
 * 含「伤害类型变为真实」→ trueDamage（真实伤害）。
 */
function convertSkillsForToken(ownerCharData, skillTable) {
  const skills = [];
  for (const skillRef of ownerCharData.skills || []) {
    const sid = skillRef.skillId;
    const st = skillTable[sid];
    if (!st) continue;
    const levels = [];
    for (const [lk, lv] of Object.entries(st.levels || {})) {
      const levelNum = parseInt(lk.replace('LEVEL_', ''));
      const bb = {};
      for (const b of lv.blackboard || []) {
        if (String(b.key).startsWith('attack@')) bb[b.key.slice('attack@'.length)] = b.value;
      }
      if (Object.keys(bb).length === 0) continue; // 该技能对召唤物无效果，不注入
      const desc = (lv.description || '').replace(/<[^>]+>/g, ''); // 剥离富文本标签后判断文案
      const isToggle = desc.includes('可以在下列状态和初始状态间切换');
      const isPermanent = !isToggle && desc.includes('持续时间无限');
      if (desc.includes('逐渐降低') || desc.includes('逐渐减少')) bb.atkDecay = true;
      if (desc.includes('伤害类型变为真实')) bb.trueDamage = true;
      levels.push({ ...bb, level: levelNum, spCost: 0, initialSp: 0, spType: 'INCREASE_WITH_TIME', skillDuration: lv.duration ?? 0, skillType: lv.skillType, isToggle, isPermanent });
    }
    if (levels.length === 0) continue;
    levels.sort((a, b) => a.level - b.level);
    const firstLevel = Object.values(st.levels || {})[0];
    skills.push({ skillId: sid, name: firstLevel?.name || sid, levels });
  }
  return skills;
}

function convertOperator(id, charData, skillTable, ownerOperatorId, ownerCharData) {
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

  const artsSubs = ['artsfghter','corecaster','splashcaster','blastcaster','funnel','mystic','chain','primcaster','soulcaster','phalanx','incantationmedic'];
  // 无攻击能力的召唤物（如夜莺幻影/鸟笼 atk=0）按法术色展示，DPS 按 0 攻计算
  const tokenArtsIds = ['token_10003_cgbird_bird'];
  const isNoAtkToken = String(id).startsWith('token_') && tokenArtsIds.includes(id);
  const damageType = (artsSubs.includes(charData.subProfessionId) || isNoAtkToken) ? 'arts' : 'physical';

  const skills = [];
  const nativeRefs = (charData.skills || []).filter(sr => sr.skillId && skillTable[sr.skillId]);
  if (nativeRefs.length === 0 && ownerCharData) {
    // 召唤物无自身技能（skills 为 null 占位）→ 注入持有者技能（attack@ 前缀剥离）
    skills.push(...convertSkillsForToken(ownerCharData, skillTable));
  }
  for (const skillRef of nativeRefs) {
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
      levels.push({ ...bb, level: levelNum, spCost: spData.spCost || 0, initialSp: spData.initSp || 0, spType: spData.spType || 'INCREASE_WITH_TIME', skillDuration: lv.duration, skillType: lv.skillType, isToggle, isPermanent });
    }
    levels.sort((a, b) => a.level - b.level);
    const firstLevel = Object.values(st.levels || {})[0];
    skills.push({ skillId: sid, name: firstLevel?.name || sid, levels });
  }

  return {
    id, name: PATCH_CHARS[id] || charData.name, rarity: charData.rarity,
    profession: charData.profession, subProfessionId: charData.subProfessionId,
    damageType,
    ownerOperatorId: ownerOperatorId || null,
    phases, trustBonus, skills, talents: convertTalents(charData), trait: convertTrait(charData),
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
  // 升变/特殊形态（阿米娅近卫/医疗）数据在 char_patch_table.patchChars，并入主表供按 id 取用
  const patchTable = await fetchJSON(`${EXCEL}/char_patch_table.json`);
  for (const [pid, pdata] of Object.entries(patchTable.patchChars || {})) {
    if (!charTable[pid]) charTable[pid] = pdata;
  }
  console.log('拉取 skill_table.json ...');
  const skillTable = await fetchJSON(`${EXCEL}/skill_table.json`);
  console.log('拉取 uniequip_table.json ...');
  const uniequipTable = await fetchJSON(`${EXCEL}/uniequip_table.json`);
  console.log('拉取 battle_equip_table.json ...');
  const battleEquipTable = await fetchJSON(`${EXCEL}/battle_equip_table.json`);

  // Save sub-professions dictionary
  const subProfDict = uniequipTable.subProfDict || {};
  fs.writeFileSync(path.join(BASE, 'sub-professions.json'), JSON.stringify(subProfDict, null, 2), 'utf8');
  console.log('  → sub-professions.json');

  const index = [];

  // 收集干员 → 召唤物关联（干员技能的 overrideTokenKey → 干员 id）
  const allIds = flattenOperators();
  const tokenOwners = {};
  for (const id of allIds) {
    const charData = charTable[id];
    if (!charData) continue;
    // 技能召唤（如赫默·医疗探机）
    for (const sk of (charData.skills || [])) {
      if (sk.overrideTokenKey) tokenOwners[sk.overrideTokenKey] = id;
    }
    // 天赋召唤（如凯尔希·Mon3tr：talent candidate 的 tokenKey）
    for (const t of (charData.talents || [])) {
      for (const c of (t.candidates || [])) {
        if (c.tokenKey) tokenOwners[c.tokenKey] = id;
      }
    }
  }

  for (const id of allIds) {
    const charData = charTable[id];
    if (!charData) { console.log(`  [SKIP] ${id} not found`); continue; }
    const ownerId = tokenOwners[id];
    const converted = convertOperator(id, charData, skillTable, ownerId, ownerId ? charTable[ownerId] : null);
    attachModules(converted, id, uniequipTable, battleEquipTable);
    // Directory: profession/subProfessionId/
    const dir = path.join(BASE, converted.profession, converted.subProfessionId);
    fs.mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, `${id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(converted, null, 2), 'utf8');
    const ownerName = ownerId ? (charTable[ownerId]?.name || '') : '';
    index.push({ id: converted.id, name: converted.name, rarity: converted.rarity, profession: converted.profession, subProfessionId: converted.subProfessionId, ownerOperatorId: ownerId || null, ownerName: ownerName || null });
    console.log(`  [OK] ${converted.name}: ${converted.phases.length} phases, ${converted.skills.length} skills → ${converted.profession}/${converted.subProfessionId}/`);
  }

  // Save index
  fs.writeFileSync(path.join(BASE, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
  console.log(`\n完成: ${index.length} 个干员 + sub-professions.json → ${BASE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
