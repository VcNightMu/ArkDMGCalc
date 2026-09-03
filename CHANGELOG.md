# Changelog

## v0.3.1 (2026-09-03)

### feat: 华法琳特殊治疗处理
- 1技能「紧急包扎」：攻击回复触发型（INCREASE_WHEN_ATTACK，每次攻击回 1 sp），额外回复目标最大生命值 hp_ratio 比例，计算器默认目标为自身（取干员自身 maxHp）；总治疗量 = 触发那一次的实际回复（普攻 + 额外），周期 HPS = 蓄满 spCost 次攻击的全程普攻 + 单次额外
- 2技能「不稳定血浆」：手动开启自身必然获得的加攻 buff（atk 直接乘算），skillDuration=-1 + duration=15 映射为持续型技能，技能期 = duration，含技能期 HPS 与总治疗量

### feat: 凯尔希召唤物 Mon3tr 入列表
- 数据抓取支持天赋召唤物关联（talent candidate 的 tokenKey，区别于赫默医疗探机的技能 overrideTokenKey）；凯尔希「Mon3tr」天赋 tokenKey 指向 token_10002_kalts_mon3tr
- 新增 TOKEN/notchar1/token_10002_kalts_mon3tr.json（近战物理召唤物，0 技能，随凯尔希精英化 50/80/90 三档成长）+ 头像（PRTS 文件:头像_召唤物Mon3tr.png，与链愈师干员 Mon3tr 的头像_前缀不冲突）
- 与链愈师干员 Mon3tr（char_4179_monstr，MEDIC/chainhealer）区分：id 前缀、profession、技能结构均不同；链愈师 Mon3tr 待后续新增

### feat: Mon3tr 技能注入与衰减真伤计算
- 召唤物技能注入：无自身技能的召唤物注入持有者技能（attack@ 前缀 key 剥离为召唤物自身加成）；Mon3tr 1/2/3 技能 = 凯尔希「指令：结构加固/战术协同/熔毁」
- 1技能防御型（输出=常态物理）、2技能加攻物理、3技能攻击力增幅线性衰减（+260%→+0%）+ 真实伤害：按每次攻击时刻（0/2/4…s）即时攻击力逐次结算技能期总伤与平均 DPS
- calcDamage 支持真实伤害（calcTrueDamage）与 atkDecay 线性衰减分支；召唤物路由按是否有独立技能区分（攻击型召唤物走伤害计算，医疗探机仍走治疗）；技能选择器放开带注入技能的召唤物

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
