# 干员技能机制记录

## 医疗（MEDIC）子职业机制

### physician（医师）
- 单体治疗
- 治疗量 = ATK × heal_ratio（默认1.0）
- 无特殊trait

### ringhealer（群愈师）
- 群体治疗
- 治疗量计算同医师

### healer（行医）
- 较大治疗范围，远距离治疗量衰减
- Trait: heal_scale=0.8（远距离治疗量变为80%）

### wandermedic（行医）
- 恢复友方单位生命，并回复元素损伤
- Trait: ep_heal_ratio=0.5

### chainhealer（链愈师）
- 链式治疗，治疗在目标间跳跃
- Trait: attack@chain.max_target=3, attack@chain.atk_scale

### incantationmedic（咒愈师）
- 攻击造成法术伤害，攻击敌人时为攻击范围内一名友方治疗
- Trait: scale=0.5（伤害/治疗分配比例）
- 治疗量 = 实际造成伤害 × scale（受敌人法抗影响）
- 既能输出又能治疗，需要同时计算DPS和HPS

### watchman（观守者）
- 可以起飞（部署在高台）

## 通用治疗计算公式

### 基础治疗量
- 治疗量 = ATK × heal_ratio
- heal_ratio 默认1.0，部分技能/trait会修改

### 治疗间隔
- 默认等于攻击间隔（baseAttackTime）
- 技能可能修改攻击速度（attack_speed）来改变治疗间隔

### HPS 计算
- HPS = 单次治疗量 / 治疗间隔
- 总治疗量 = HPS × 持续时间（持续类技能）
- 总治疗量 = 单次治疗量（瞬发类技能）

## 需要的数据字段
- heal_ratio: 治疗倍率（默认1.0）
- heal_scale: 治疗缩放（如行医远距离衰减）
- attack_speed: 攻击速度（影响治疗间隔）
- base_attack_time: 基础攻击间隔
- hp_recovery_per_sec: 每秒生命恢复
- hp_recovery_per_sec_by_max_hp_ratio: 基于最大生命值的每秒恢复
