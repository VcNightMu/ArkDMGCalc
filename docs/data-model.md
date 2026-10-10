# 数据模型

> 本文描述**当前实际实现**。字段名与结构以实际 JSON 文件为准
> （示例取自 `src/frontend/data/MEDIC/physician/char_108_silent.json` 赫默，
> 字段键清单为逐键导出，非人工回忆）。
>
> 初版本文档大体正确，但**漏写了 `trait` / `talents` / `modules` / `skillType` / `ownerOperatorId`
> 等实际存在的字段**，且技能时长的字段名写错（实际是 `skillDuration`）。已补全。

## 目录结构

```
src/frontend/data/
  index.json                       干员/单位索引（505 条）
  sub-professions.json             子职业字典（76 条 = 72 真实 + 4 特殊）
  notes.json                       口径说明文本（手工维护，重抓不覆盖）
  <主职业>/<子职业>/<id>.json      干员/单位数据（只存数值键，不含技能描述文本）
src/frontend/assets/avatars/<主职业>/<子职业>/<id>.png
```

## 数据来源

- **干员/单位数值、天赋、技能 blackboard、模组**：来自
  [Kengxxiao/ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData)（游戏解包数据）。
- **头像**：来自 PRTS Wiki（`scripts/fetch-avatars.js`，源文件名「文件:头像_<中文名>.png」）。

> README 初版把「数据与头像」都写成 PRTS，已更正。

## 干员 JSON 顶层字段

实测键清单（顺序即文件中的顺序）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 干员内部 id（`char_*` / `token_*`），唯一，也是文件名 |
| `name` | string | 中文显示名（升变形态带半角括号，如 `阿米娅(医疗)`） |
| `rarity` | string | `TIER_1` ~ `TIER_6`（字符串，非数字） |
| `profession` | string | 主职业：`PIONEER`/`WARRIOR`/`TANK`/`SNIPER`/`CASTER`/`MEDIC`/`SUPPORT`/`SPECIAL`，召唤物为 `TOKEN` |
| `subProfessionId` | string | 子职业 id（查 `sub-professions.json`） |
| `damageType` | string | `physical` 或 `arts`（`true` 用于真伤召唤物） |
| `ownerOperatorId` | string \| null | **召唤物所属干员 id**，正常干员为 `null` |
| `phases` | array | 精英化阶段（见下） |
| `trustBonus` | object | 满信赖加成：`{atk, def, maxHp}` |
| `skills` | array | 技能（见下） |
| `talents` | array | **天赋**（见下） |
| `trait` | object \| null | **职业特性**：`{description, blackboard}`；无特性为 `null` |
| `modules` | array | **模组**（见下） |
| `potentialRanks` | array | 潜能（见下） |

> `index.json` 的条目另含 `ownerName`（召唤物显示用），数据文件里没有这个键。

### phases（精英化阶段）

```json
{ "eliteLevel": 0, "maxLevel": 50,
  "atk": [166, 273], "def": [62, 90], "maxHp": [845, 1191],
  "magicResistance": 0, "baseAttackTime": 2.85, "attackSpeed": 100 }
```

- `atk` / `def` / `maxHp` 是**长度 2 的数组** `[最小等级值, 最大等级值]`，中间等级线性插值。
- `magicResistance` 该阶段固定值；`baseAttackTime` 基础攻击间隔（秒）；`attackSpeed` 基础 100。

**插值公式**（`calculator.js`）：

```
实际值 = min值 + (max值 - min值) × (当前等级 - 1) / (最大等级 - 1)
```

### skills（技能）

```json
{ "skillId": "skcom_heal_up[3]", "name": "治疗强化·γ型",
  "levels": [ { "atk": 0.4, "level": 0, "spCost": 40, "initialSp": 20,
                "spType": "INCREASE_WITH_TIME", "skillDuration": 30,
                "skillType": "MANUAL", "isToggle": false, "isPermanent": false } ] }
```

**`levels` 下标 0–9 对应 Lv1 ~ 专三**（界面上的 `Lv1`–`Lv7`、`专一/专二/专三`）。

每个 level 对象的**固定字段**：

| 字段 | 说明 |
|---|---|
| `level` | 等级序号 0–9 |
| `spCost` / `initialSp` | SP 消耗 / 初始 SP |
| `spType` | SP 回复类型（`INCREASE_WITH_TIME` / `INCREASE_WHEN_ATTACK` / 受击回复等） |
| **`skillDuration`** | **技能持续时间（秒）**；`-1` 表示持续无限。**注意不是 `duration`** |
| `skillType` | `MANUAL` / `AUTO` / `PASSIVE` |
| `isToggle` / `isPermanent` | 切换型 / 永续型 |

> **易错点**：时长的权威字段是 **`skillDuration`**。`duration` 只出现在**部分技能的 blackboard 里**，
> 语义是「额外的作用时长」（如减益/增益持续时间），引擎对二者有不同处理
> （见 `skill-types.md` 的「技能数据的真实分类维度」）。
>
> 初版文档的示例里写了 `"duration": 0`，且未提 `skillDuration`——按那个示例写代码会读不到时长。

其余键是**从 blackboard 平铺进来的原始键名**（数值型，不含描述文本），语义见下节。

### blackboard 键（平铺在 level 对象上）

| key | 含义 |
|---|---|
| `atk` | 攻击力**百分比加成**（`2.0` = +200%），非倍率 |
| `def` | 防御力百分比变化（负值为减） |
| `atk_scale` | 输出伤害/治疗**倍率**（`1.9` = 190%），在天赋与 atk 重算之后才乘 |
| `attack_speed` | 攻击速度加成（`20` = +20） |
| `base_attack_time` | 攻击间隔变化；负值按加算秒，`(0,1)` 正小数按间隔倍率 |
| `heal_ratio` / `heal_scale` | 治疗倍率 / 治疗缩放 |
| `scale` | 咒愈师「伤害转治疗」比例（`0.5`） |
| `ep_heal_ratio` | 行医「元素损伤回复」比例（不建模） |
| `attack@max_target` | 攻击目标数 |
| `attack@times` / `attack@atk_scale` | 攻击次数 / 每击倍率（整数≥2 才算次数） |
| `attack@heal_scale` | 普攻治疗倍率改写 |
| `hp_recovery_per_sec` | 每秒生命恢复 |
| `hp_recovery_per_sec_by_max_hp_ratio` | 按最大生命值比例的每秒恢复 |
| `magic_resistance` | 法抗变化（负值 = 降抗；(0,1) 为比例，≤-1 为固定值语义） |
| `def_penetrate` | 无视防御比例 |
| `trueDamage` | 是否转为真实伤害 |

带前缀的键（`xxx_s_3[self].atk`、`aura.heal_scale`、`attack@chain.*` 等）是**原始嵌套键名的平铺形式**，
引擎通过别名表（`SKILL_ATK_KEY_OVERRIDES` 等）或前缀处理消费。

### talents（天赋）

```json
[ { "candidates": [
      { "phase": 1, "level": 1, "potentialRank": 0, "name": "强化注射",
        "description": "在场时，所有友方【医疗】职业干员攻速+6",
        "blackboard": { "attack_speed": 6 }, "isHideTalent": false } ] } ]
```

- 一个天赋有多个 `candidates`，按 **`phase`（精英阶段）+ `potentialRank`（潜能）** 分化档位。
- 引擎按当前精英化与潜能挑选生效档位，`blackboard` 给出数值。
- `description` 是**保留字段**（干员 JSON 其余部分只存数值）；界面说明走 `notes.json`，
  两者不是同一来源。

### modules（模组）

```json
[ { "id": "uniequip_001_silent", "name": "赫默证章", "type": "INITIAL",
    "typeName2": null, "isSpecialEquip": false, "unlockLevel": 0, "order": 0, "levels": [] },
  { "id": "uniequip_002_silent", "name": "紧急防卫程序", "type": "ADVANCED",
    "typeName2": "Y", "isSpecialEquip": false, "unlockLevel": 50,
    "order": 2,
    "levels": [ { "level": 1,
                  "attributeBlackboard": { "max_hp": 70, "attack_speed": 4 },
                  "traitEnhance": [ { "blackboard": { "heal_scale": 1.15 } } ] } ] } ]
```

| 字段 | 说明 |
|---|---|
| `type` | `INITIAL`（证章，恒有、不受解锁限制） / `ADVANCED`（效果模组） |
| `typeName2` | 模组分支标记（`X` / `Y` / `null`） |
| `unlockLevel` | 效果模组的解锁等级（四星 40 / 五星 50 / 六星 60，且需 E2） |
| `levels[].attributeBlackboard` | 白值加成（`atk`/`def`/`max_hp`/`attack_speed`/`magic_resistance`） |
| `levels[].talentEnhance` | **对天赋数值的覆盖/增强**（按 `name` + `requiredPotentialRank` 匹配天赋档） |
| `levels[].traitEnhance` | 对职业特性的增强（如咒愈师 `scale` 由 `0.5` 提到 `0.6`） |

> **白值加成 vs 天赋增强是两条路**：`attributeBlackboard` 直接进面板；
> `talentEnhance` 覆盖天赋数值（需与天赋候选匹配）；`traitEnhance` 改特性。
> 三者都通过 `calcModuleBonus` / `calcModuleTalentEnhance` / `calcTraitScale` 消费。

### potentialRanks（潜能）

```json
{ "description": "部署费用-1", "type": "BUFF",
  "modifiers": [ { "attr": "COST", "formula": "ADDITION", "value": -1 } ] }
```

- `modifiers[].attr`：`ATK` / `DEF` / `MAX_HP` / `COST` / `RESPAWN_TIME` 等；
  `formula`：`ADDITION` 等；`value`：数值。
- **只有 `ATK` / `DEF` / `MAX_HP` 的 `ADDITION` 会计入面板**，其余（费用、再部署）不影响伤害计算。

## 属性叠加公式

`calculator.js` 的 `calcAttribute`，遵循 PRTS 属性基本公式：

```
A_f = F_t × [(A + D_p) × (1 + D_t) + F_p]

A   = 基础值（精英/等级插值 + 信赖加成 + 潜能加算 + 模组加算）
D_p = Σ 直接加算（direct_add）
D_t = Σ 直接乘算（direct_mul）
F_p = Σ 最终加算（final_add）
F_t = Π 最终乘算（final_mul；任一项 < 0 时补正为该项 + 1）

若 1 + D_t < 0，补正为 0（即整体取 0）
```

**信赖**：`trustBonus.attr × trustPercent / 100`，`trustPercent` 由界面输入（0–100）。

**运算符不存进数据文件**：`direct_mul` / `final_mul` 等由计算代码按 key 指定
（如 `atk` → 直接乘算、`def` → 最终乘算），数据侧只有数值。

## 敌人数据结构

敌人不持久化，只存在于界面状态（`state.js`）：

```json
{ "hp": 50000, "atk": 800, "def": 600, "res": 50, "grade": "normal" }
```

- `grade` 取 `normal` / `elite` / `leader`，**只用于决定元素损伤的 EP 容量**
  （普通/精英 1000、领袖 2000），其余计算不使用 `hp` / `atk`。
- 实际参与伤害结算的只有 `def` 与 `res`（经有效防御/有效法抗换算，见 `skill-types.md`）。

## 索引与说明文本

**`index.json`**（505 条，干员与召唤物混排）：

```json
{ "id": "char_112_siege", "name": "推进之王", "rarity": "TIER_6",
  "profession": "PIONEER", "subProfessionId": "pioneer",
  "ownerOperatorId": null, "ownerName": null }
```

**`sub-professions.json`**（76 条）：`{subProfessionId, subProfessionName, subProfessionCatagory}`。
其中 72 条是真实子职业，4 条为特殊项（`notchar1` 干员附带单位、`notchar2` 无职业陷阱、`none1`/`none2` 预留）。

**`notes.json`**：键为**干员 id** 或 **`__subprof_<子职业id>`**（子职业级通用说明）。值为中文说明文本。
**手工维护，重抓干员数据不会覆盖**——所有「不建模」的口径都记录在这里，
渲染顺序为子职业说明在前、干员个人说明在后（见 `ui-design.md`）。

## 头像

按 `assets/avatars/<主职业>/<子职业>/<id>.png` 存放，与 JSON 目录同构。
源文件名「文件:头像_<中文名>.png」，召唤物为「文件:头像_召唤物_<中文名>.png」；
精确名查不到时回退前缀搜索（活动形态命名带后缀）。已存在则跳过，可断点续跑。
