# 计算口径与技能处理

> 本文描述**当前实际实现**。
>
> 初版本文档规划的「六种技能类型（DurationBuff / TriggeredAttack / PassiveAura / Heal / MultiHit / Special）
> + `SKILL_TYPE_MAP` 技能 ID → 类型映射 + 每类型一个独立模块」**从未实现**，已整体废弃。
> 实际做法见下文：**按子职业分派 + 按机制查表**，没有技能 ID 到类型的映射表。

## 一、为什么没有技能类型分类

初版假设「技能可以按计算逻辑归类，一个类型一套公式」。实际开发下来这个假设不成立：

- 同一个技能类型下的干员差异极大（同为「持续增益」，真银斩是加攻+减防，闭膛连发是改间隔+三连击）；
- 大量技能是**跨类型**的（既加攻又连击又改间隔），归类本身就会失真；
- 真正的共性是**机制**（多少连击、间隔怎么变、伤害类型切不切、要不要按时间轴模拟），
  而不是「技能属于哪一类」。

所以实际架构是两层：

1. **分派层**：按 `subProfessionId` 把干员交给对应的分支或专用模块；
2. **口径表层**：分支内部再查「机制表」拿到该干员该技能的具体处理方式。

新增干员时，**优先往已有表里加一行**（声明式），只有在表表达不了时才写新分支。

## 二、基础公式（所有模块共用）

面板属性叠加（`calculator.js` 的 `calcAttribute`，PRTS 属性基本公式）：

```
A_f = F_t × [(A + D_p) × (1 + D_t) + F_p]

A   = 基础值（精英/等级插值 + 信赖 + 潜能加算 + 模组加算）
D_p = Σ 直接加算      D_t = Σ 直接乘算
F_p = Σ 最终加算      F_t = Π 最终乘算（任一项 < 0 时补正为该项 + 1）
若 1 + D_t < 0，补正为 0
```

三条伤害公式（`calculator.js`）：

```
物理：damage = max(ATK - DEF, ATK × 0.05)
法术：damage = max(ATK × (100 - RES) / 100, ATK × 0.05)
真实：damage = ATK            （无减免、无保底）
```

攻击间隔换算（`calcRealInterval`）：`真实间隔 = 基础间隔 × 100 / (100 + 攻速加成)`。

**单目标口径**：所有结算按单目标。多目标技能只按「对当前目标的伤害」计算，不乘目标数。

## 三、敌方有效防御 / 有效法抗（命中结算的前置）

结算前先算一次「有效」值，顺序固定：

```
有效防御 effDef = max(0, DEF × (1 - 无视防御比例) - 固定穿防 - 偷取防御稳态)
有效法抗 effRes = max(0, RES - 固定法抗穿透) × 命中减抗乘数 × 天赋级减抗乘数
```

- **固定穿防 / 穿透**：天赋级，常态与技能期同口径（如史尔特尔「熔火」法抗穿透 12~22）。
- **命中减抗**：`magic_resistance` 为 (0,1) 比例值时按 `×(1+mr)`，≤ -1 的整数键按固定值语义 `+mr`。
- **顺序约定：先结算状态再结算伤害**。本次攻击的减防/减抗对该次伤害即生效
  （`damage-ops-calc.js` 注释里明确写了这条通用口径，点燃、火焰剥离、落地被动都适用）。
- **常态行不吃技能级减抗**：`effResNormal` 专门保留「不含技能级减抗」的法抗，避免技能期效果污染常态列
  （与「常态用基础间隔」「技能期法脆不入常态」同一口径）。

## 四、单次命中结算（`damage-ops-calc.js` 的 `calcDamage`）

```
技能期单次命中 = 基础结算(atk) × hitMul × hitCount × talentDmgMul × skillDmgMul × funnelSkillMul
常态单次命中   = 基础结算(panelAtk) × talentDmgMul × funnelNormalMul
```

各乘子的语义区别很关键，写错就会双倍或少倍：

| 乘子 | 语义 | 例子 |
|---|---|---|
| `hitMul` | **整次乘算**：在减防/减抗**之后**乘，用于「这一击整体×N」 | 小数 `attack@times`（荒拉普兰德 S3 1.3）、`MULTI_HIT` 表（每击全额×连击数）、单次暴击表 |
| `hitCount` | **发数**：每发单独结算（逐发扣减防御/法抗） | 整数 `attack@times ≥ 2`（能天使 5 连射）、速射手连射 |
| `talentDmgMul` | 常驻伤害乘区（天赋），物理/法术/真伤一律乘 | 森蚺「勇冠三军」满血 ×1.15 |
| `skillDmgMul` | **仅技能期**的模组伤害提升 | 德克萨斯 Y 模组技能期 ×1.1 |
| `funnelSkillMul` / `funnelNormalMul` | 驭械术师：本体+浮游单元的当量倍数 | 无技能槽常态按满层单元计 |

**整数 vs 小数的判定**（`attack@times`）：整数且 ≥ 2 视为「攻击次数」→ 进 `hitCount`；
小数值视为「倍率」→ 进 `hitMul`。这是用户口径，注释里写明「多连击每击单独结算，逐击扣减防御/法抗」。

若同时命中多条规则，技能类分支通常**拦截**该技能自己算（`ATK_SCALE_REWRITE`、`PHALANX_PER_HIT_SCALE`、
`SKILL_PER_HIT_SCALE` 等表就是干这个的），避免通用乘算与专用分支双吃。

## 五、技能期的四个输出分支

`calcDamage` 按「技能是否永续/切换」「是否带时长」分流成四种结果形态：

```
① isToggle 或 isPermanent（切换/永续）
     skillDps = 单次命中 / 间隔      skillTotalDamage = 0      cycleDps = null

② 有时长 且 攻击力线性衰减/爬升（atkDecay 或 atkRampUp）
     按每次攻击时刻的即时攻击力逐次累加 → 精确总伤
     DPS = 总伤 / 技能时长

③ 有时长（常规）
     攻击次数 = floor(技能时长 / 真实间隔)
     总伤 = 单次命中 × 攻击次数      DPS = 总伤 / 技能时长

④ 无时长（触发型/瞬发型）
     总伤 = 单次命中 × 1             skillDps = 0
     cycleDps = calcCycleDps(spCost / spType / 间隔, 普攻伤害, 触发伤害)
```

## 六、结果对象与界面渲染

引擎返回的结果对象由 `ui.js` 消费。**要改口径或加机制，先看这里消费了哪些字段**，
否则算得再对也显示不出来。

```
{
  type: 'damage' | 'heal',
  damageType / normalDamageType,        // 技能期 / 常态的伤害类型
  skillDps, skillTotalDamage, cycleDps, // 技能期三件套
  normalDps,                            // 常态化列（null 表示不显示）
  skillHps, normalHps, totalHeal,       // 治疗通道
  isToggle, isPermanent, realInterval, panelAtk,
  deploySkill,                          // 落地点火：无技能选择也显示技能期
  dmgTypes:    { 类型: {skillDps, skillTotalDamage, cycleDps} },  // 技能期分档色值
  normalTypes: { 类型: {dps} }                                    // 常态化多档色值
}
```

**界面按类型分流渲染**（`ui.js`）：

| 分支 | 显示内容 |
|---|---|
| `type === 'heal'` | 常态 HPS / 技能期 HPS / 总治疗量 / 周期 HPS；若同时有输出则追加技能期 DPS 与总伤 |
| `isToggle` 或 `isPermanent` | 只显示 DPS（永续没有「总伤」概念） |
| `cycleDps !== null` | 总伤 + **循环 DPS** + 技能期间隔 + 技能期 ATK |
| 其余（瞬发） | 技能期总伤（DPS 为 0 时不显示 DPS 行）+ 常态 DPS |

- `dmgTypes` / `normalTypes` 存在时**逐类型渲染色值**，只显示 > 0 的档位，多档用 `+` 连接
  （物理红 / 法术黄 / 真伤白 / 元素灰）；不存在时回退单类型整数值。
- 是否有「技能期」由 `hasSkill` 判定：**永久被动**不显示技能期；**限时被动**（`PASSIVE` 且
  `skillDuration > 0` 或 `blackboard.duration > 0`）按正常技能显示；召唤物的 `skcom_` / `sktok_`
  占位技能不显示技能期，除非在形态技能白名单里。

## 七、技能数据的真实分类维度

数据侧**没有类型字段**，判定靠这几个维度（`skillType`、`spType`、`duration`、blackboard 键）：

| 维度 | 取值 | 处理 |
|---|---|---|
| `skillType` | `MANUAL` / `AUTO` / `PASSIVE` | `PASSIVE` 且无限时 → 装备即入面板、无技能期；`PASSIVE` 且有时长 → 限时被动，按技能期算 |
| `spType` | `INCREASE_WITH_TIME` / `INCREASE_WHEN_ATTACK` / 受击回复等 | 决定 `calcCycleDps` 的充能周期；受击回复型只给单次总伤、不展示周期 |
| `duration` / `skillDuration` | 秒数，`-1` = 持续无限 | `-1` 且 `duration > 0` 且带 `atk` → 视为持续型，技能期 = `duration`（自身必然获得的限时增益） |
| `isToggle` / `isPermanent` | 切换型 / 永续型 | 走分支①，只显示 DPS |
| blackboard 键 | 见 `data-model.md` | 键的**语义决定算法**，同名键在不同子职业下含义可能不同 |

**易错的键语义**（都踩过坑，注释里有记录）：

- `atk` 是**百分比加成**（`2.0` = +200%），进直接乘算累加，不是倍率。
- `atk_scale` 是**输出倍率**，在天赋/atk 重算**之后**才乘（否则会被天赋重算覆盖，
  号角 S1 曾因此算错）。医疗的部分情境下 `atk_scale` 是屏障吸收倍率而非治疗倍率，需排除。
- `base_attack_time`：**负值**按加算秒（`-2.1` = 间隔减 2.1s）；**(0,1) 正小数**按间隔倍率
  （`×0.12`）；但描述为「间隔增大」却给正小数的技能要进 `BAT_ADD_OVERRIDES` 按加算处理。
- `attack@atk` / `attack@atk_scale` / `attack@base_attack_time`（守望者普攻改写）：语义与顶层键**不同**，
  一个改攻击力、一个改间隔倍率。
- 前缀别名键（`xxx_s_3[self].atk`、`makiri_s_2[passive]` 等）：靠
  `SKILL_ATK_KEY_OVERRIDES` / `SKILL_HP_RECOVERY_KEY_OVERRIDES` 等别名表指定真实键名。

## 八、分派与专用模块的分工

`calculateOperator(op, slotData, ctx)` 的骨架：

```
1. 前置修正（子职业特性改写伤害类型、面板重算、天赋驱动、模组加成、有效防御/法抗…）
2. 无技能（!skill）→ 按子职业给常态化列（大量子职业在此特判）
3. 有技能 → 先算技能期攻击力 skillAtk 与技能期间隔 skillInterval
4. Dispatch：按 subProfessionId 逐个特判 → 命中专用分支；否则走通用 calcDamage
5. 后置附加：技能结束爆炸/回血、固定 DOT、元素爆条、分类专属修正
```

**子职业专用分支**（在主引擎内，`calcXxxSkill` 命名）：吟游者 `calcBardSkill`、
护佑者 `calcBlessingSkill`、投掷手 `calcBombarderSkill`、攻城手 `calcSiegeSkill`、
收割者 `calcReaperSkill`、远射手 `calcLongrangeSkill`、扩散术师 `calcAoeSkill`、
散射手 `calcCloserangeSkill`、领主 `calcLordSkill`、傀儡师 `calcDollkeeperSkill`、
伏击客 `calcStalkerSkill`、行商 `calcMerchantSkill`、陷阱师 `calcTraperSkill`、
巡空者 `calcSkywalkerSkill`、炼金师 `calcAlchemistSkill`。

**独立模块**（专用文件）：

| 模块 | 覆盖 |
|---|---|
| `medic-calc.js` | 全部医疗子职业的 HPS / 周期 HPS / 触发治疗 |
| `guardian-calc.js` | 守护者：普攻转治疗、急救族触发、睡眠链等 |
| `element-calc.js` | 元素损伤：EP 条、三类爆发（灼燃/侵蚀/神经）、技能期时间轴模拟 |
| `ritualist-calc.js` | 巫役：损伤时间轴与爆条 |
| `summoner-calc.js` | 召唤师召唤物的独立计算与持有者技能联动 |
| `primprotector-calc.js` / `primcaster-calc.js` / `primguard-calc.js` | 三个「本源」子职业 |

**跨干员联动**：伤害源是持有者的召唤物（樱桃三号自爆 = 渡桥攻击力×3.7、狼群 S3 = 伺夜面板）
通过 `ctx.ownerOp` / `ctx.ownerSlot` 注入持有者满练面板，`ui.js` 侧用持有者引用表自动加载。

## 九、口径表清单（新增干员时优先查这里）

`damage-calc.js` 里的声明式表，按机制归类。**改引擎前先确认目标干员属于哪张表**：

| 类别 | 表 |
|---|---|
| 常驻面板天赋 | `TALENT_ATK_DRIVERS`、`TALENT_HEAL_DRIVERS`、`TALENT_SPD_DRIVERS`、`TALENT_HP_DEF_DRIVERS`、`TALENT_FLAT_ATTR_DRIVERS`、`SELF_AURA_DRIVERS`、`TALENT_FLAT_DEF_PCT_REGEN` |
| 敌方减益天赋 | `TALENT_RES_PEN_DRIVERS`、`TALENT_DEF_PEN_FIXED`、`TALENT_DEF_IGNORE_PCT`、`TALENT_MR_DEBUFF_MUL`、`TALENT_HIT_MR_DEBUFF`、`calcTalentDefStealSteady`（偷取防御稳态） |
| 伤害/治疗乘区 | `TALENT_DMG_MUL_DRIVERS`、`INCANTATION_FRAGILE_DRIVERS`、`SKILL_TALENT_ATK_MUL`、`MODULE_SKILL_DMG_MUL`、`MODULE_SKILL_HEAL_MUL`、`TALENT_HEAL_DRIVERS` |
| 攻速与间隔 | `TALENT_BAT_ADD`、`TALENT_SPD_SKILL_ONLY`、`BAT_ADD_OVERRIDES`、`BAT_PCT_OVERRIDES`、`BAT_SCALE_OVERRIDES`、`INTERVAL_GROW_OVERRIDES`、`SKILL_ATTACK_SPEED_OVERRIDES` |
| 连击与倍率 | `MULTI_HIT`、`SINGLE_CRIT_MUL`、`ATK_SCALE_REWRITE`、`PHALANX_PER_HIT_SCALE`、`SKILL_PER_HIT_SCALE`、`PHALANX_ATK_RAMP`、`FASTSHOT_MULTI_HARD`、`TALENT_DEF_HIT_ARTS`（剥壳类每击附加法伤，函数 `calcDefHitArtsCfg` 等） |
| 伤害类型改写 | `SKILL_ARTS_OVERRIDES`、`SKILL_PHYSICAL_OVERRIDES`、`SKILL_TRUE_DAMAGE`、`WEAKNESS_DAMAGE`、`SUBPROF_ARTS` |
| 倍率/加成键别名与排除 | `SKILL_ATK_KEY_OVERRIDES`、`SKILL_ATK_SCALE_EXCLUDE`、`SKILL_ATK_EXCLUDE`、`SKILL_HP_RECOVERY_KEY_OVERRIDES`、`SKILL_REGEN_IGNORE`、`PASSIVE_ATTR_KEYS` |
| 技能归类 | `NORMAL_ATK_SKILLS`（纯防御/无输出增益 → 归常态）、`STOP_ATTACK_SKILLS`（开启期停止攻击 → 技能期伤害记 0）、`SKIP_SKILLS`、`PERMANENT_OVERRIDES`、`PERMANENT_EXCLUDE`、`BEARER_HEAL_SKILLS`、`SKILL_HEAL_CHAIN` |
| 自回/治疗通道 | `TALENT_HPS_REGEN`、`TALENT_SKILL_RECOVER`、`TALENT_SKILL_END_HEAL`、`LEECH_SKILLS`、`TAKEN_SELF_HEAL`、`TALENT_FLAT_DOT` |
| 周期性/延迟输出 | `DELAYED_OUTPUT`、`PERIODIC_DOT`、`TRIGGER_ARTS_ADD`、`BLASTCASTER_HIT_DOT`、`MYSTIC_SKILL_DOT`、`NORMAL_ROW_MUL` |
| 特殊机制 | `WEAKNESS_DAMAGE`、`DOLLKEEPER_SUB_IDS`、`ALTER_EQUIP_DURATION`、`SUMMON_FORM_MODES`（召唤物形态，在 `calculateOperator` 内）、`TOKEN_INHERIT_OWNER_SKILLS`、`DEF_HIT_ARTS`（剥壳类） |

## 十、不建模即说明（硬约定）

以下**一律不计入计算**，必须在 `data/notes.json` 里逐条写明：

- 概率触发、需特定敌人状态（被阻挡 / 冻结 / 浮空 / 能量层数）、需击杀叠层、需受击叠层；
- 反伤、屏障、护盾、阻挡、控制、技力回复；
- 给友方的增益与光环（除非**自身必然吃到**，如「团队光环覆盖自身」有明确先例时才建模）；
- 治疗、元素减伤等非输出效果，除非直接影响该干员自身输出。

**叠层类的三分法**：攻击次数型 / 时间型 / 必定触发型 → 按**叠满**计入；
击杀型 / 受击型 → 不计。条件类默认取**无条件档**（如「未阻挡」「非地面」按默认状态）。

新增子职业的验收四件套（引擎分支或口径表 + `verify-<子职业>.mjs` + `notes.json` 说明 + 基线快照更新）
与回归流程见 `README.md`。**每条口径决策（尤其用户拍板的特例）都要记进 `CHANGELOG.md`。**
