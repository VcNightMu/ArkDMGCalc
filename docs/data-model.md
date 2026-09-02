# 数据模型

## 目录结构

- `src/frontend/data/{主职业}/{子职业}/{char_id}.json` —— 干员数据
- `src/frontend/data/index.json` —— 干员索引列表
- `src/frontend/data/sub-professions.json` —— 子职业字典（subProfessionId → 中文名）
- `src/frontend/assets/avatars/{主职业}/{子职业}/{char_id}.png` —— 干员头像（与 JSON 数据目录同构）

## 干员数据结构

每个干员一个 JSON 文件，文件名用干员内部 id（char_id）。示例（银灰 `WARRIOR/lord/char_172_svrash.json`）：

```json
{
  "id": "char_172_svrash",
  "name": "银灰",
  "rarity": "TIER_6",
  "profession": "WARRIOR",
  "subProfessionId": "lord",
  "damageType": "physical",

  "phases": [
    {
      "eliteLevel": 0,
      "maxLevel": 50,
      "atk": [297, 444],
      "def": [189, 259],
      "maxHp": [1075, 1536],
      "magicResistance": 5,
      "baseAttackTime": 1.3,
      "attackSpeed": 100
    },
    {
      "eliteLevel": 1,
      "maxLevel": 80,
      "atk": [444, 577],
      "def": [259, 329],
      "maxHp": [1536, 2022],
      "magicResistance": 10,
      "baseAttackTime": 1.3,
      "attackSpeed": 100
    },
    {
      "eliteLevel": 2,
      "maxLevel": 90,
      "atk": [577, 713],
      "def": [329, 397],
      "maxHp": [2022, 2560],
      "magicResistance": 10,
      "baseAttackTime": 1.3,
      "attackSpeed": 100
    }
  ],

  "trustBonus": { "atk": 50, "def": 50, "maxHp": 0 },

  "skills": [
    {
      "skillId": "skchr_svrash_1",
      "name": "强力击·γ型",
      "levels": [
        {
          "level": 0,
          "atk_scale": 1.9,
          "spCost": 4,
          "initialSp": 0,
          "spType": "INCREASE_WHEN_ATTACK",
          "duration": 0,
          "isToggle": false,
          "isPermanent": false
        }
      ]
    },
    {
      "skillId": "skchr_svrash_3",
      "name": "真银斩",
      "levels": [
        {
          "level": 9,
          "def": -0.7,
          "atk": 2.0,
          "attack@max_target": 6,
          "spCost": 90,
          "initialSp": 75,
          "spType": "INCREASE_WITH_TIME",
          "duration": 30,
          "isToggle": false,
          "isPermanent": false
        }
      ]
    }
  ],

  "potentialRanks": [
    {
      "description": "部署费用-1",
      "type": "BUFF",
      "modifiers": [
        { "attr": "COST", "formula": "ADDITION", "value": -1 }
      ]
    },
    {
      "description": "再部署时间-4秒",
      "type": "BUFF",
      "modifiers": [
        { "attr": "RESPAWN_TIME", "formula": "ADDITION", "value": -4 }
      ]
    }
  ]
}
```

## 字段说明

### 顶层字段

| 字段 | 说明 |
|------|------|
| id | 干员内部 id（char_id），唯一 |
| name | 中文名（也用于头像文件名 `头像_<name>.png`） |
| rarity | 稀有度，字符串 `TIER_1` ~ `TIER_6` |
| profession | 主职业（PIONEER / WARRIOR / TANK / SNIPER / CASTER / MEDIC / SUPPORT / SPECIAL） |
| subProfessionId | 子职业 id（见 sub-professions.json） |
| damageType | 伤害类型，`physical` 或 `arts`（由子职业判定） |

### phases（精英化阶段）

每个阶段一个对象，字段：

| 字段 | 说明 |
|------|------|
| eliteLevel | 精英化阶段（0/1/2） |
| maxLevel | 该阶段最高等级 |
| atk / def / maxHp | 长度 2 的数组 `[最小等级值, 最大等级值]`，中间等级线性插值 |
| magicResistance | 法术抗性（该阶段固定值，0-100） |
| baseAttackTime | 基础攻击间隔（秒） |
| attackSpeed | 攻击速度（基础值 100） |

### trustBonus（信赖加成）

```json
{ "atk": 50, "def": 50, "maxHp": 0 }
```

存的是满信赖（100%）的加成值。实际加成 = `trustBonus.属性 × trustPercent / 100`，`trustPercent` 由界面输入（0-100）。

### skills（技能）

每个技能：`skillId`、`name`、`levels`。

`levels` 数组下标 0-9 对应技能等级 Lv1 ~ 专三，每个 level 对象直接平铺技能的黑盒数值（blackboard key），另含固定字段：

| 字段 | 说明 |
|------|------|
| level | 等级序号（0-9） |
| spCost / initialSp | SP 消耗 / 初始 SP |
| spType | SP 回复类型（INCREASE_WITH_TIME / INCREASE_WHEN_ATTACK 等） |
| duration | 持续时间（秒，-1 表示持续无限） |
| isToggle | 是否为切换型技能 |
| isPermanent | 是否为永续技能 |

**黑盒数值（blackboard key）**：从 PRTS `skill_table` 的 `blackboard` 数组直接提取，key 为原始键名，平铺在 level 对象里。常见 key：

| key | 含义 | 示例 |
|-----|------|------|
| atk | 攻击力百分比加成 | `2.0` = +200% |
| def | 防御力百分比变化 | `-0.7` = -70% |
| atk_scale | 攻击力倍率 | `1.9` = 190% |
| attack_speed | 攻击速度加成 | `20` = +20 |
| base_attack_time | 攻击间隔变化（负值为缩短） | `-2.1` = 间隔 -2.1s |
| heal_ratio | 治疗倍率 | `1.5` = +50% |
| scale | 咒愈师伤害转治疗比例 | `0.5` |
| attack@max_target | 攻击目标数 | `6` |
| hp_recovery_per_sec_by_max_hp_ratio | 每秒按最大生命恢复 | `0.03` |

### potentialRanks（潜能）

```json
{
  "description": "部署费用-1",
  "type": "BUFF",
  "modifiers": [
    { "attr": "COST", "formula": "ADDITION", "value": -1 }
  ]
}
```

`modifiers` 里的 `attr` 为属性名（ATK / DEF / MAX_HP / COST / RESPAWN_TIME 等），`formula` 为 `ADDITION`（加算）等，`value` 为数值。潜能对 ATK/DEF/MAX_HP 的 `ADDITION` 加成会计入面板。

## 属性插值

每个精英阶段存储最小等级和最大等级两个关键帧的数值，中间等级线性插值：

```
实际值 = min值 + (max值 - min值) × (当前等级 - 1) / (最大等级 - 1)
```

## 属性叠加公式

面板属性叠加遵循 PRTS Wiki 属性基本公式（实现见 `calculator.js` 的 `calcAttribute`）：

```
A_f = F_t × [(A + D_p) × (1 + D_t) + F_p]

A   = 基础属性值（精英/等级/信赖/潜能叠加后）
D_p = Σ(直接加算)
D_t = Σ(直接乘算)
F_p = Σ(最终加算)
F_t = Π(最终乘算)

若 1 + D_t < 0，自动补正为 0。
```

运算符（direct_add / direct_mul / final_add / final_mul）在计算代码中按 key 指定（如 `atk` → direct_mul，`def` → final_mul），数据文件里不存运算符。

## 敌人数据结构

敌人数据不持久化，界面输入，存在 `state.enemy`（见 `state.js`）：

```json
{
  "hp": 50000,
  "atk": 800,
  "def": 600,
  "res": 50
}
```

## 头像

头像文件按 `assets/avatars/{主职业}/{子职业}/{char_id}.png` 存放，与 JSON 数据目录同构。PRTS wiki 上头像源文件名为「文件:头像_<中文名>.png」，通过 MediaWiki API 解析真实图片 URL 后下载（见 `scripts/fetch-avatars.js`，已存在则跳过）。
