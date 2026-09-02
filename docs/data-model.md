# 数据模型

## 干员数据结构

每个干员存储为一个 JSON 文件，文件名为干员代号（如 `silverash.json`）。

```json
{
  "id": "char_002_silver",
  "name": "银灰",
  "appellation": "SilverAsh",
  "rarity": 6,
  "profession": "WARRIOR",
  "subProfessionId": "lord",
  "position": "MELEE",
  "trait": "可以进行远程攻击，但此时攻击力降低至80%",

  "phases": [
    {
      "eliteLevel": 0,
      "maxLevel": 30,
      "attributes": {
        "maxHp": [1075, 1536],
        "atk": [297, 444],
        "def": [189, 259],
        "magicResistance": 5,
        "cost": 18,
        "blockCnt": 2,
        "attackSpeed": 100,
        "baseAttackTime": 1.3
      }
    },
    {
      "eliteLevel": 1,
      "maxLevel": 50,
      "attributes": {
        "maxHp": [1536, 2022],
        "atk": [444, 577],
        "def": [259, 329],
        "magicResistance": 10,
        "cost": 20,
        "blockCnt": 2,
        "attackSpeed": 100,
        "baseAttackTime": 1.3
      }
    },
    {
      "eliteLevel": 2,
      "maxLevel": 80,
      "attributes": {
        "maxHp": [2022, 2560],
        "atk": [577, 713],
        "def": [329, 397],
        "magicResistance": 10,
        "cost": 20,
        "blockCnt": 2,
        "attackSpeed": 100,
        "baseAttackTime": 1.3
      }
    }
  ],

  "trustBonus": {
    "atk": 50,
    "def": 50
  },
  // trustBonus 存的是满信赖（100%）的加成值
  // 实际加成 = trustBonus × trustPercent（trustPercent 由用户在界面输入，0-100）
  // 例：精0一级 50% 信赖 → ATK = 精0一级基础ATK + trustBonus.atk × 0.5,

  "talents": [
    {
      "name": "领袖",
      "candidates": [
        {
          "eliteLevel": 1,
          "potentialRank": 0,
          "description": "攻击力+5%",
          "effects": [
            { "type": "atk_percent", "value": 0.05 }
          ]
        },
        {
          "eliteLevel": 2,
          "potentialRank": 0,
          "description": "攻击力+10%",
          "effects": [
            { "type": "atk_percent", "value": 0.10 }
          ]
        }
      ]
    }
  ],

  "potentialBonuses": [
    { "rank": 2, "type": "cost", "value": -1 },
    { "rank": 3, "type": "respawn", "value": -4 },
    { "rank": 4, "type": "atk_flat", "value": 26 },
    { "rank": 5, "type": "talent_enhance", "target": 0 }
  ],

  "skills": [
    {
      "skillId": "skcom_attack_def",
      "name": "强力击·γ型",
      "skillType": "AUTO",          // AUTO=自动触发, MANUAL=手动触发, PASSIVE=被动
      "spType": "OFFENSIVE_RECOVERY", // 回复类型
      "durationType": "NONE",        // NONE=无持续, DURATION=持续, INSTANT=瞬发
      "levels": [
        {
          "level": 1,
          "description": "下次攻击的攻击力提高至190%",
          "initialSp": 0,
          "spCost": 4,
          "duration": 0,
          "effects": [
            { "type": "atk_scale", "value": 1.9, "operator": "direct_add" }
          ]
        },
        {
          "level": 7,
          "description": "下次攻击的攻击力提高至225%",
          "initialSp": 0,
          "spCost": 3,
          "duration": 0,
          "effects": [
            { "type": "atk_scale", "value": 2.25 }
          ]
        },
        {
          "level": 10,
          "name": "强力击·γ型",
          "description": "下次攻击的攻击力提高至290%",
          "initialSp": 0,
          "spCost": 2,
          "duration": 0,
          "effects": [
            { "type": "atk_scale", "value": 2.9, "operator": "direct_add" }
          ]
        }
      ]
    },
    {
      "skillId": "skchr_silvr_3",
      "name": "真银斩",
      "skillType": "MANUAL",
      "spType": "INCREASE_WITH_TIME",
      "durationType": "DURATION",
      "levels": [
        {
          "level": 7,
          "description": "防御力-70%，攻击力+140%，攻击范围扩大，同时攻击至多5个目标",
          "initialSp": 60,
          "spCost": 90,
          "duration": 26,
          "effects": [
            { "type": "def_percent", "value": -0.70, "operator": "direct_add" },
            { "type": "atk_percent", "value": 1.40, "operator": "direct_add" },
            { "type": "attack_targets", "value": 5 }
          ]
        },
        {
          "level": 10,
          "name": "真银斩",
          "description": "防御力-70%，攻击力+200%，攻击范围扩大，同时攻击至多6个目标",
          "initialSp": 75,
          "spCost": 90,
          "duration": 30,
          "effects": [
            { "type": "def_percent", "value": -0.70, "operator": "direct_add" },
            { "type": "atk_percent", "value": 2.00, "operator": "direct_add" },
            { "type": "attack_targets", "value": 6 }
          ]
        }
      ]
    }
  ],

  "avatarUrl": "https://prts.wiki/w/文件:头像_silver.png",
  "lastUpdated": "2026-09-02T12:00:00+08:00"
}
```

## 字段说明

### 属性字段

| 字段 | 说明 | 单位 |
|------|------|------|
| maxHp | 生命上限 | 数值 |
| atk | 攻击力 | 数值 |
| def | 防御力 | 数值 |
| magicResistance | 法术抗性 | 百分比（0-100） |
| cost | 部署费用 | 数值 |
| blockCnt | 阻挡数 | 数值 |
| attackSpeed | 攻击速度 | 基础值 100 |
| baseAttackTime | 攻击间隔 | 秒 |

### 属性插值

每个精英阶段存储最小等级和最大等级两个关键帧的数值。
中间等级的数值通过线性插值计算：

```
实际值 = minLevel值 + (maxLevel值 - minLevel值) × (当前等级 - 1) / (最大等级 - 1)
```

### effects 类型枚举

| type | 说明 | value 含义 |
|------|------|-----------|
| atk_percent | 攻击力百分比加成 | 1.40 = +140% |
| atk_flat | 攻击力固定值加成 | 直接加数值 |
| atk_scale | 攻击力倍率（覆盖基础攻击） | 1.9 = 攻击力变为190% |
| def_percent | 防御力百分比加成 | -0.70 = -70% |
| def_flat | 防御力固定值加成 | 直接加数值 |
| res_flat | 法术抗性变化 | 直接加数值 |
| res_percent | 法术抗性百分比变化 | 百分比 |
| attack_speed | 攻击速度变化 | 加减数值 |
| attack_targets | 攻击目标数 | 数值 |
| heal_percent | 治疗量百分比加成 | 1.5 = +50% |
| heal_flat | 治疗量固定值加成 | 直接加数值 |
| duration | 持续时间变化 | 秒 |
| sp_cost | SP消耗变化 | 数值 |
| interval | 攻击间隔变化 | 秒 |
| dot | 持续伤害 | 每秒伤害值或倍率 |

### effects 运算符（operator 字段）

每个 effect 可以带一个 `operator` 字段，表示该数值的运算方式。从 PRTS Wiki 的“显示算法”模式中提取，通过 HTML 颜色编码识别：

| operator | 对应 Wiki 颜色 | 说明 | 计算方式 |
|----------|---------------|------|----------|
| `direct_add` | 绿色 `mdi-plus` | 直接加算 | 同类属性直接相加 |
| `direct_mul` | 蓝色 `mdi-plus` (#007DFA) | 直接乘算 | 直接乘算之间为加法，再与基础值相乘 |
| `final_add` | 橙色 `mdi-plus` | 最终加算 | 在直接乘算结果上再加 |
| `final_mul` | 橙色 `mdi-close` | 最终乘算 | 最终乘算之间为乘法 |

**属性叠加公式**（来自 PRTS Wiki 游戏数据基础#属性基本公式）：

```
A_f = F_t × [(A + D_p) × (1 + D_t) + F_p]

A   = 基础属性值（精英/等级/信赖/潜能叠加后）
D_p = Σ(直接加算)     同类属性直接相加
D_t = Σ(直接乘算)     同类属性直接相加
F_p = Σ(最终加算)     同类属性直接相加
F_t = Π(最终乘算)     各项相乘；任一项 < 0 时补正为该项 + 1

若 1 + D_t < 0，自动补正为 0。
最后经数值范围限制下限/上限得到最终结果。
```

不带 `operator` 字段的 effect 默认为 `direct_add`。

## 敌人数据结构

敌人数据不需要持久化，直接在界面输入，传入计算模块。

```json
{
  "hp": 50000,
  "atk": 800,
  "def": 600,
  "magicResistance": 50,
  "type": "elite"  // normal / elite / boss
}
```

## 元数据

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-09-02T12:00:00+08:00",
  "operatorCount": 450,
  "dataHash": "abc123..."
}
```
