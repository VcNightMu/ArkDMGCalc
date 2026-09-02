# Changelog

## v0.3.0 (2026-09-02)

### feat: 医疗干员治疗计算
- 医疗干员区分计算：常态HPS / 技能期HPS / 总治疗量
- 咒愈师（incantationmedic）双重输出：DPS + HPS，治疗量基于实际伤害×scale
- 纯治疗型（医师/群愈师/疗养师/行医/链愈师）走HPS体系
- 医疗数据按MEDIC/physician目录拉取，新增13名医师干员
- 代码拆分为多模块：state.js / damage-calc.js / medic-calc.js / damage-ops-calc.js / ui.js / app.js
- 干员数据目录重构：{主职业}/{子职业}/{char_id}.json，适配400+干员管理
- 咒愈师治疗量改为基于实际伤害×scale（法抗会影响治疗量）
- 永续技能判断改为读取技能描述是否包含"持续时间无限"
- 切换型技能精确匹配："可以在下列状态和初始状态间切换"
- 移除特殊模式干员（Touch双版本/预备干员）
- 无技能干员（如Lancet-2）不显示技能选择器，仍可计算常态HPS

## v0.2.0 (2026-09-02)

### feat: 循环DPS与技能分类
- 循环DPS计算：攻击回复/自然回复两种SP充能算法
- 技能三种分类显示：瞬发→总伤+循环DPS / 持续→技能期DPS+总伤+常态DPS / 切换·永续→仅DPS
- 技能等级与精英化限制：E0最高Lv4，E1最高Lv7，E2最高专三
- SP数据从spData正确读取（spCost/initSp/spType）
- 等级输入clamp到1~maxLevel，信赖clamp到0~100
- 黑盒duration覆盖bug修复：...bb展开不再覆盖核心字段duration

## v0.1.0 (2026-09-02)

### feat: 基础计算器框架
- Tauri v2项目结构，纯前端可运行
- 8个干员数据（银灰/陈/棘刺/能天使/艾雅法拉/史尔特尔/风笛/塞雷娅）
- 物理/法术伤害类型区分，基于子职业判断
- 技能效果blackboard key正确映射（atk/def/attack@max_target/attack_speed）
- 物理伤害公式 `ATK - DEF` 保底5%，法术伤害公式 `ATK × (100-RES)/100`
- 总伤按单目标计算
- 潜能配置、JSON数据持久化 + 异步加载
- 深色方舟风格UI
- 新增闪灵/安洁莉娜/红，覆盖全部8个主职业
- 主职业内部代号映射修正（DEFENDER→TANK, VANGUARD→PIONEER等）
- 等级输入不受maxLevel限制的修复
