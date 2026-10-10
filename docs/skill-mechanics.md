# 医疗子职业与治疗口径

> 本文描述**当前实际实现**，内容以 `src/frontend/data/MEDIC/**` 的 trait 数据与
> `medic-calc.js` 的代码为准。
>
> 初版本文档的错误已订正，记录在此以免再犯：
> - 旧文把链愈师的 `attack@chain.*` 写在**咒愈师**名下（实际在 `chainhealer` 数据里，见下文）；
> - 旧文写「`watchman`（守望者）可以起飞（部署在高台）」曾被误判为不存在的子职业——**它确实存在**
>   （医疗·守望者，如 `char_4222_taraxa` 风絮、`char_1052_kalts2`）；
> - 旧文说疗养师的「远距离治疗量 80%」不存在——**该数据是真的**（`trait.blackboard.heal_scale = 0.8`），
>   只是引擎按单目标口径**不建模**，只写说明。

## 一、医疗子职业清单（7 个）

| subProfessionId | 中文名 | trait（数据原文） | trait 是否建模 |
|---|---|---|---|
| `physician` | 医师 | 恢复友方单位生命 | 基础治疗模板 |
| `ringhealer` | 群愈师 | 恢复友方单位生命（数据中 `trait` 为 `null`） | 按**单目标**计算，不考虑治疗目标数 |
| `healer` | 疗养师 | 拥有较大治疗范围，但治疗较远目标时治疗量变为 80%（`heal_scale: 0.8`） | **不建模**（单目标默认近距离），见 `notes.json` 的 `__subprof_healer` |
| `wandermedic` | 行医 | 恢复友方单位生命，并回复相当于攻击力 50% 的元素损伤（`ep_heal_ratio: 0.5`） | 元素损伤回复**不建模**（模型只有 HP）；技能侧 HP 治疗由既有能力覆盖 |
| `chainhealer` | 链愈师 | 治疗在目标间跳跃（`attack@chain.max_target: 3`、`attack@chain.atk_scale: 0.75`） | **只算第一跳**（100%），跳跃衰减不建模，见 `__subprof_chainhealer` |
| `incantationmedic` | 咒愈师 | 攻击造成法术伤害，攻击时为范围内一名友方治疗（`scale: 0.5`） | **建模**：输出 + 治疗双轨，治疗 = 实际法伤 × `scale` |
| `watchman` | 守望者 | 恢复友方单位生命，**并且可以起飞** | 起飞本身不建模；其普攻改写键（`attack@*`）由引擎消费 |

**咒愈师与链愈师的 trait 不要弄混**：`scale: 0.5` 属于咒愈师，`attack@chain.*` 属于链愈师。
两者在子职业列表里是相邻的两个条目。

## 二、治疗量公式（`medic-calc.js` 的 `calcMedical`）

```
healRatio  = (blackboard.heal_ratio ?? 1.0) × 天赋治疗倍率
skillHealRatio = healRatio × (blackboard['attack@heal_scale'] ?? 1) × 单次多重治疗数(healChain) × 模组技能治疗倍率

常态单次治疗量 = panelAtk × healRatio
技能期单次治疗量 = skillAtk × skillHealRatio
```

- **治疗者攻击力决定治疗量**；`skillAtk` 已含技能期攻击力加成与 `atk_scale`。
- 天赋治疗倍率（如瑰盐「攻 -5% 换治疗 ×1.05~1.17」）**同时作用于常态与技能期**。
- `attack@heal_scale` 与模组技能治疗倍率**只作用于技能期**，常态普攻维持 100%。
- `healChain`：单次攻击多重治疗（纯烬艾雅法拉 S3 五连发，`SKILL_HEAL_CHAIN` 表驱动）。

**技能期 HPS 与总治疗量**：

```
切换/永续：  skillHps = 单次治疗量 / 真实间隔        totalHeal = null（永续无总量概念）
有时长：     skillHps = 单次治疗量 / 真实间隔        totalHeal = 单次治疗量 × floor(时长 / 真实间隔)
无时长：     skillHps = 0                            totalHeal = 单次治疗量（瞬发）
常态 HPS：   normalHps = panelAtk × healRatio / 基础间隔
```

注意 **HPS 一律除以 `真实间隔`**（已含攻速加成），常态 HPS 用 `baseInterval`、
技能期用 `realInterval`——初版文档写的「总治疗量 = HPS × 持续时间」只在「有时长」分支且
攻击次数为整数时成立，实际实现按 `floor(时长/间隔)` 计次数。

## 三、触发型治疗（`calcTriggerHeal`）

`heal_scale`（或光环前缀 `aura.heal_scale`）且**无 `atk` 加成** → 走触发型。分两类：

| 类型 | 判定 | 处理 |
|---|---|---|
| 持续增益型（HOT） | 有 `interval` | 每次回复量 × `floor(增益时长 / interval)`；`duration` 优先，其次 `aura.projectile_life_time`、`status_resistance[limit]` |
| 一次性额外型 | 无 `interval` | 触发时额外治疗一次 |

**周期 HPS** 按充能方式分两种：

```
攻击回复（INCREASE_WHEN_ATTACK）：
  充能攻击次数 = ceil(spCost / increment)
  周期 HPS = (常态HPS × 周期时长 + max(0, 触发治疗量 - 常态治疗量)) / 周期时长
  ← 触发那一下与常态普攻重叠，故只叠加「增量」

自然回复（INCREASE_WITH_TIME）：
  触发时机 = sp 蓄满后的下一次普攻；AUTO 技能蓄满到下次普攻之间多攒的 sp 被吞（延迟），
  手动技能玩家可卡普攻瞬间释放 → 无延迟。二者差别体现在 cycleHps 上。
```

个别干员有专用分支：Mon3tr S3「策略：熔毁」（真伤输出 + 每击自疗，每秒自损不建模）、
乌啾 S2「捉迷藏！」（立即治疗 + HOT）、亚叶「复合型药物弹片」（治疗与法伤完全独立）、
华法琳「紧急包扎」（按最大生命值比例回复，目标默认为自身）。

## 四、不建模即说明（医疗侧）

`data/notes.json` 中与医疗相关的条目（前缀 `__subprof_` 的是子职业级说明）：

- `__subprof_healer` 疗养师不考虑治疗较远目标时的衰减；
- `__subprof_chainhealer` 链愈师默认仅治疗 1 人，因此不考虑跳跃治疗量降低；
- **元素损伤回复一律不建模**（行医的 `ep_heal_ratio`、纯烬的损伤屏障等）——模型只有 HP 单目标；
- 治疗目标默认为**自身**（单目标模型假定友方必在攻击范围内）；
- 各类概率/条件增益（如桑葚「助手」需另一名医疗在场）默认不触发。

**咒愈师的双轨**：治疗量基于**实际造成的法术伤害** × `scale`，所以敌方法抗会影响治疗量
（这与纯治疗型「治疗量只看攻击力」不同，是本项目里医疗侧唯一吃敌方属性的口径）。

## 五、新增医疗干员的检查清单

1. 数据：`fetch-operators.js` 的 OPERATORS 白名单（`MEDIC` 下对应子职业）补 id → 跑抓取；
2. trait：确认 `trait.blackboard` 是否有需要建模的键（多数医疗 trait 按 HP 单目标不建模）；
3. 技能：先用既有能力覆盖——`heal_ratio` / `heal_scale` / `attack@heal_scale` / `atk` / `attack_speed` /
   `base_attack_time` / `hp_recovery_per_sec*` 大多是**表驱动或通用通道**，通常无需写新分支；
   只有机制确实无法表达时才在 `medic-calc.js` 加分支；
4. 说明：把不建模的项写进 `data/notes.json`（子职业级用 `__subprof_<id>`）；
5. 验证：新增 `verify-<子职业>.mjs` 或并入既有医疗验证脚本，并更新基线快照；
6. 回归：`node scripts/tests/run-all.mjs` 全量通过。
