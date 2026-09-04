# Changelog

## v0.5.0 (2026-09-05)

### feat: 先锋(PIONEER)全量数据入库
- 6 子职业 43 人入列（index 108→160，头像 52 张）：尖兵 16（推进之王/嵯峨/忍冬/焰尾 6★，凛冬/德克萨斯/贾维/青枳/红隼 5★，讯使/清道夫 4★，芬/香草 3★，夜刀 2★，CONFESS-47 1★ 公招机器人；不录预备干员-先锋/近战与 ★5 郁金香水月肉鸽临时形态）、冲锋手 7、战术家 7（含罗德岛隐秘队 1★ 怪猎联动）、执旗手 5、情报官 6、策士 2
- 召唤物 10 个入 TOKEN（磐蟹护卫队/眠兽/狼群/流形/樱桃三号/风雪之眼×3/牙猎犬/指挥中心，owner 自动关联）
- fetch-operators PIONEER 白名单补全 + TOKEN 扩充；修复 notchar1 子职业模式 owner 丢失 bug（持有者不在 allIds 致 ownerOperatorId 清空与 Mon3tr 技能注入丢失，ownerScan 扩展为全量非 TOKEN 干员扫描）

### feat: 尖兵(pioneer)子职业完整支持
- 15 人（4 天赋入表）：天赋驱动（香草攻击提升/清道夫单独行动者 E2 11%/推进之王万兽之王先锋光环覆盖自身）；冲锋号令纯回费系 11 技能归常态展示；持续型技能走通用 calcDamage（清道夫 S2/香草 S1/凛冬乌萨斯战吼/红隼醉刃乱舞/焰尾焰心/嵯峨怒目 BAT_ADD）
- 瞬发 AOE：德克萨斯剑雨两段法伤、焰尾红松林两段物伤、贾维火焰剥离、忍冬坠刃拷问、嵯峨除恶
- 新机制：推进之王碎颅击普攻改写 attack@atk_scale 专用分支（3.4×间隔 +1s→2.05s×10 击）、跃空锤 AUTO 充能 cycle、忍冬 S1 小施惩戒 TRIGGER 附加法伤（extra_damage_ratio 键）物法双档、忍冬 S3 攻速 +180 衰减按平均 90 折算、青枳 S2 数据 isPermanent 按永续 DPS 展示
- 口径决策（用户确认）：嵯峨 S3 半血追加不触发单段 / 忍冬 S3 平均攻速 / 概率类天赋走说明不建模 / 纯回费归常态
- 验证脚本 verify-pioneer.mjs（50 断言）

### feat: 阿米娅(近卫)形态补充 + 术战者说明文本用户版 + 干员选择器星级排序
- 升变形态 char_1001_amiya2 入列（index 160，WARRIOR/artsfghter，头像下载，PATCH_CHARS 登记）；青色怒火全场光环 atk/def+4~7% 入驱动 + 技能开启期效果加倍新机制（SKILL_TALENT_ATK_MUL 表：技能期补一份 talentAtk，奔夜/绝影均×2）
- S1 影霄·奔夜二连击（MULTI_HIT，dur28 atk+60%，技能期 atk=1.74 倍）；S2 影霄·绝影专用分支（10 斩：前 9 击 atk_scale×法伤 + 尾击系数加倍真伤，斩击期击杀叠层默认不触发同烈焰魔剑口径，整场一次 cycleDps=null，物法真三档）
- 术战者 6 条说明替换为用户权威文本（慕斯连击/星极满层/铸铁击杀增幅/史尔特尔默认不击杀+打一/维娜诸王叹息+召唤物查询/赤刃天喟龙只一次）；UI 干员选择器按星级降序排序（同星保持数据顺序）
- verify-artsfghter 扩至 36 断言

### docs: 先锋系说明文本入库（用户版）
- 先锋 4 条：忍冬（追凶额外伤害不计+隐狐之艺攻速取平均）/嵯峨（劝善增幅不计+怒目追加不计）/红隼（蛮力重击提升不计）/焰尾（前锋剑术连击不计）
- 冲锋手 2 条：风笛（精密填弹提升不计）/红豆（蛮力穿刺提升不计）
- 情报官 3 条：晓歌（“万全”默认未阻挡攻速+12 计面板）/谜图（“序列”满血目标提升不计）/冬时（“疾笔撰录”攻速提升不计）

### feat: 冲锋手(charger)子职业完整支持
- 7 人：新增限时被动机制（修复既有 bug：PASSIVE+duration>0 技能如芬 S2 执守阵线/野鬃 S1 骑枪刺击是部署后自动生效 N 秒的一次性强化，原被当永久常驻入面板；现按技能期=duration 计算，顺带修正红 S1/寻澜 S1/晓歌 S1/伊内丝 S3 同类错误，森蚺 S1/星熊 S2 永久被动不受影响）
- 芬 S1 贯敌刺枪 AUTO 二连击 / S2 执守阵线限时被动 dur19s atk+100%（专一档）19 击；风笛 S3 闭膛连发 BAT_ADD 间隔 +0.7→1.7s + 三连击 11 击×3 连；苇草 S2 生灵火花专用分支（dur27 物理普攻强化 + 每击附加 0.35×技能期 atk 法伤，物法双档）；野鬃 S1 限时被动攻速 +110 间隔 0.476×56 击
- 概率类天赋（风笛精密填弹 28%/红豆蛮力穿刺）不建模型待说明
- 验证脚本 verify-charger.mjs（22 断言）

### fix: 限时被动与 skcom 通用技能 UI 技能期修复
- hasSkill 判定排除细化为仅永久被动（PASSIVE 且 duration≤0，如星熊 S2 荆棘）不显示技能期；限时被动按正常技能渲染技能期 + 常态双行
- skcom_ 排除限定为仅召唤物（TOKEN）：干员 skcom_ 通用主动技能（迅捷打击/冲锋号令/攻击力强化/治疗强化等 44 处）原被误判无技能期只显常态，现恢复技能期 + 常态双行（表驱动归常态者仍只显常态）
- verify-limpassive-ui 扩至 16 断言

### feat: 执旗手(bearer)子职业完整支持
- 5 人：职业特性技能开启期间停止攻击（持续回费/增益）技能期伤害记 0（STOP_ATTACK_SKILLS 10 处），常态普攻保留，清零同步清 dmgTypes 内部档（修复 UI dmgValHtml 优先读内部档导致技能期残留非零的既有隐患，年 S2 等旧 STOP_ATTACK 干员一并受益）
- 琴柳 S3 光辉旗帜专用分支（开启瞬间单发 atk_scale×atk 物理，眩晕/易伤/减攻不计）
- S2 治疗建模（机制查证：技能期普攻转治疗、间隔固定 1s、治疗=面板攻击力×ratio/秒）：桃金娘治愈之翼 0.4×16s HPS208 / 万顷应东风 0.2×15s HPS102.8 / 嘉辛塔伞下乘荫 0.22×30s HPS110.4 / 琴柳信仰传承 0.4×15s HPS234.4，BEARER_HEAL_SKILLS 表驱动 heal 型结果（技能期 HPS+总治疗量+常态普攻），极境聆听无治疗归 0
- 天赋入引擎：桃金娘浮光跃金全场先锋回血（新 TALENT_HPS_REGEN 常驻自回通道注入常态 HPS）+ 琴柳不退之旗军旗攻速光环（calcTalentAttackSpeed 扩展 {talentIndex,key} 前缀别名 bb 键支持）
- 验证脚本 verify-bearer.mjs（46 断言）

### feat: 情报官(agent)子职业完整支持
- 6 人：伊内丝偷攻天赋影织（单目标首次命中即触发全程生效，+90 攻击直接计入伤害计算不显示白值，新 TALENT_STEAL_ATK 通道，参与技能倍率）
- 线性模拟三连：伊内丝 S2 暗夜无明（攻击+90%+每击偷 6 攻速逐击爬升 100→160，17 击）、寻澜 S2 洞悉（每击偷 45 防至 5 层，敌 def600 逐降 375，14 击逐 def 结算）、谜图 S2 疑点追踪（DOT 每击叠层至 10 层，整秒跳×当前层离散模拟）
- 伊内丝 S1 淬影突袭（攻回 sp3 触发普攻+3 跳流血法伤 DOT 双档 cycle）/ S3 独影归途（被动 14s atk+140% 普攻 + 影哨单发物理）；晓歌万全天赋攻速档 + S2 浮光弹药 16 发；冬时/齐尔查克条件苛刻与概率机制不建模
- 验证脚本 verify-agent.mjs（22 断言）

### feat: 策士(counsellor)子职业完整支持
- 2 人（凛御银灰 6★/松桐 5★）：S1 纯回费归常态普攻；凛御 S2 御敌的锋锐瞬发 3.4×atk 物理走通用 cycle；S3 变革已至专用分支（48s 普攻改写 ×bird_atk_scale 1.8×脆弱 damage_scale 1.25=2.25×，40 击直线）
- 松桐 S2 万手成局攻击增幅与每秒自回均在 makiri_s_2[passive] 前缀键：SKILL_ATK_KEY_OVERRIDES 别名 + 新增 SKILL_HP_RECOVERY_KEY_OVERRIDES 自回键别名机制
- 凛御天赋 2 雪境先驱按满层口径入引擎（在场 15s 后防御与回血翻倍：新 TALENT_FLAT_DEF_PCT_REGEN 表 def+60→120 入面板白值/每秒回 1.5%→3% 最大生命注入常态 HPS）；松桐天赋慢手有筹为重装/辅助光环自身不吃不建模
- 验证脚本 verify-counsellor.mjs（18 断言）

### feat: 战术家(tactician)召唤物路由与技能归常通用修复
- 召唤物技能路由：hasRealSkills 排除 sktok_ 前缀（战术家狼群/眠兽/流形/樱桃三号等原生占位技能，原被当真技能算致 cycle 0.00 虚假输出），无真实技能召唤物统一按攻击型常态物理普攻处理（结构体特判泛化为 atk 基础>0 判定，磐蟹/眠兽/狼群/流形/樱桃/牙猎犬全生效）；UI 同步：技能选择器与 hasSkill 对 sktok_ 占位技能不显示技能期
- 本体归常态：伺夜 S1/S2、豆苗 S1/S2、夜半 S1/S2（新增 SKILL_REGEN_IGNORE 排除顶层 hp_recovery 误触为本体自回——bb 的 0.14 是眠兽休眠回血）、可露希尔 S1，无输出增益技能统一归常态普攻展示

### feat: 战术家分支特性攻击 1.5 倍建模
- 自身攻击援军（召唤物）阻挡的敌人时攻击力提升至 150%（用户口径：攻击力乘区非伤害乘区，提高破甲线），单目标模型默认召唤物在场阻挡 → 本体攻击常驻 ×1.5：calculateOperator 面板与 calcPanelStats 白值同乘（伺夜 542→813/渡桥 833），带 atk 加成的技能期攻击力同步补乘（渡桥 S2 修正为 15 击×P(833×1.65)=11604），召唤物（TOKEN 职业）不享受
- 配套：渡桥 S1 出击指令归常态（自爆 aoe_damage_scale 3.7 建模在召唤物侧）；缪尔赛思 S2 流形复制回血归属召唤物本体排除，本体保留 atk+40% 普攻

### feat: 战术家召唤物形态技能机制与眠兽 S2 建模
- 新增 SUMMON_FORM_MODES 形态表 + calcSummonFormMode 拦截（召唤物 sktok_ 占位技能位=持有者技能激活态输出，基值为召唤物自身面板）
- 眠兽 S2 食梦·安眠（夜半 S2 激活）：5s 沉睡窗口内普攻变群体法伤、攻击沉睡目标攻击力 ×1.7（M1），4 击总伤 1611.6 DPS 322.3 + 常态物伤保留；UI 技能选择器/hasSkill 对形态技能位放行（TOKEN_FORM_SKILLS 白名单含 PASSIVE 占位豁免），数据技能位改名
- 顺带修复攻击型泛化误伤医疗探机（phases.atk=治疗力 125 被当攻击型，HEAL_SUMMONS 白名单显式排除）
- 验证脚本 verify-tactician-summon.mjs（12 断言起步）

### feat: 狼群 S2 形态与伺夜 S3 本体建模
- 狼群 S2 狼群·馈赠（伺夜 S2 激活）：下次攻击攻击力 ×1.8（M1）触发单发（attack-buff-single 模式）；伺夜 S3 领袖的尊严本体专用分支：15s 普攻变三连击（物理×15 轮）+ 每轮附加 attack@vigil_s_3.atk_scale×伺夜攻击力法伤（M1 0.35，PRTS 备注附加受战术家特性加成→基值含 ×1.5 面板），物法双档（物理 9585/法伤 2134/总 11719/DPS 781.3）

### feat: 樱桃三号(模様)S1 自爆/S2 停攻与召唤物-持有者联动基建
- 跨干员联动：calculateOperator 第三参 ctx（ownerOp/ownerSlot），UI TOKEN_SUMMON_OWNER_REF 表对需持有者面板的召唤物联动加载持有者满练数据（E2 满级 trust100，同工具整体口径）
- 樱桃三号 S1 解体·自爆（渡桥遥控解体激活）：owner-phys-burst 模式，伤害=持有者渡桥面板 atk（含战术家特性 ×1.5，833）×3.7（M1）=2482 物理，自爆退场无常态行；S2 承压·停攻 0+常态普攻保留
- verify-tactician-summon 扩至 27 断言（含 UI 联动渲染）

### feat: 缪尔赛思流形双形态条目（远程/近战）与技能激活态建模
- 数据：原 token_10030 改流形·远程（damageType arts，法伤水炮）+ 新派生条目流形·近战（physical，同数值 302atk/1.5s/2000hp），index 160→161；fetch 新增 VIRTUAL_TOKENS 静态合并段（虚构派生条目重跑不丢）
- 引擎：SUMMON_FORM_MODES 新 flow-buff/flow-double 模式（缪尔赛思技能激活期自身与流形 atk+40% M1：远程 S1 攻速+40 间隔 1.0714 14 击法伤 / S2 生态耦合远程二连击 20hits / S3 束缚无增益；近战 S2 每秒回 5% 最大生命=HPS100 总治 1500 附于 damage 结果 UI 双显）；攻击型召唤物常态普攻类型化（damageType arts→法伤）

### feat: 眠兽 S1 休眠回血与狼群 S3 领袖附加建模
- 眠兽 S1 食梦·休眠（夜半半醒激活）：10s 休眠期每秒回 14% 最大生命（M1，2582×0.14=361.5/s 总治 3614.8，heal 型，休眠停止攻击无技能期伤害，常态普攻保留）
- 狼群 S3 狼群·领袖（伺夜领袖的尊严激活）：15s 内每击=狼群自身物伤 P(371)+伺夜面板 atk×0.35 法伤（M1，经跨干员 ctx 注入满练面板 813，12 击物 222.6/法 1707.3 双档）——沿用樱桃三号 owner 联动基建；狼群 S1 狼影召唤确认生存向无输出（常态视图保持）
- verify-tactician-summon 扩至 47 断言

## v0.4.0 (2026-09-04)

### feat: 要塞(fortress)子职业完整支持
- 号角/灰毫/火哨 3 人（远程炮击 interval 2.8s 物理）；天赋入表：号角军事要塞重装光环 atk+20%（自身必得同炎息先例）、灰毫炮术研习 atk+8%（四格地面 16% 条件档不计取无条件档）、火哨进退自如 atk+12%（默认未阻挡远程位）
- 号角 S1 照明榴弹 AUTO 2.4atk 物理单发 + 周期（修正 atk_scale 倍率被天赋重算覆盖的既有顺序 bug：乘算移至 modifiers 后，刺玫 S2 反伤 atk_scale 入排除表防误乘）；S2 暴风号令 10 发弹药不提前关闭，前 5 发 2×atk 物理、后 5 发过载弹药额外 0.5atk 法伤（DPS=总伤/28s，dmgTypes 物法双档）；S3 终极防线 dur24 过载两段前 12s atk+50% 后 12s atk+100% 间隔 1.0s（自损不计）
- 火哨 S1 野火 AUTO sp8 1.6atk 物理 + 引燃 4s×0.4atk 法伤（附带 DOT 计入同流明先例，4 跳物法双档）；S2 焦土普攻照常 6 击 + 燃烧区 5s>间隔 2.8s 重叠常驻每秒 0.75atk 法伤×17s 双通道；灰毫 S1 γ攻强 atk+75% / S2 专注轰击 atk+45% 间隔 2.3s 走通用
- 验证脚本 verify-fortress.mjs（21 断言）

### feat: 决战者(duelist)子职业完整支持
- 森蚺/极光/洋灰 3 人（单阻挡决战 interval 1.6s 物理）；通用伤害乘区驱动 TALENT_DMG_MUL_DRIVERS（非白值加成精确乘伤害：森蚺勇冠三军 hp>50% 时攻击 ×1.15/1.17 默认满血必触发，calcDamage 物理/法术/真伤一律乘，含常态与衰减循环，未来干员复用）
- 森蚺 S1 轻型挂斧 PASSIVE atk/def+20% 装备即常驻入面板（引擎既有通道，仅装 S1 生效）、S2 震慑劈砍 atk+145% 间隔增大 +0.4→2.0s（BAT_ADD）、S3 钢铁意志 atk+190% + 每秒回 4%maxHp 走自回通道
- 极光 S1 固守家园纯防御普攻照常、S2 人工降雪 9 发弹药（间隔 +0.25→1.85s）每 3 发循环寒冷/冻结/暴击 = 普通发 1.65atk×6 + 暴击发 3.1atk×3，DPS=总伤/16.65s（冻结 310% 为替换非叠加，引擎 atk_scale 会误乘全发故拦截）；洋灰 S1 突破矿层手动充能 2.5atk 单发走自然回周期、S2 结构加固纯防御对输出无影响（层数受击消耗不计）
- 验证脚本 verify-duelist.mjs（15 断言）

### feat: 哨戒铁卫(shotprotector)与涤火杰西卡/机械师召唤物支持
- 6 人 + 2 附带单位（涤火杰西卡/信仰搅拌机/机械师 6★，雷蛇/深巡/闪击 5★，interval 1.2s；机动盾牌 token_10032 纯防御无攻击、结构性原理 token_10069 攻击型附单精二 atk600）
- 杰西卡 S1 永续 / S2 间隔 0.3s 50 击 / S3 弹药数据驱动 + 首炮 2.5atk（默认放盾开炮，天赋 def 不计用户口径）；雷蛇 S2 攻击切法伤间隔 1.9s 10 击、S1 纯防御归常态（NORMAL_ATK_SKILLS）；深巡天赋 DOT 等效恒 80/s 法伤（TALENT_FLAT_DOT，吃法抗不吃攻击）
- 搅拌机 S1 三连击 MULTI_HIT / S2 47 发弹药 / S3 停攻反击不计；机械师 S1 五连击 hitMul + 间隔 1.3 加算 / S2 永续（弹药爆盾无受击模型）/ S3 拦截落地（普攻改写 attack@atk_scale × 技能期攻击力法伤 11 击 + 结构体冲锋 3 倍物理一发，虚弱不计）；闪击 S2 先手 1.8 + 眩晕 6s 内 15 击 2.4 倍
- fetch-operators 新增 displayTokenDict owner 收集 + tokenDropNativeSkills 剔除召唤物占位/联动技能（结构体冲锋被动与盾牌 attack@ 注入跳过）；引擎新增攻击型无技能召唤物常态物理通道
- 验证脚本 verify-shotprotector.mjs（31 断言）

### feat: 本源铁卫(primprotector)子职业完整支持与元素损伤系统
- 余/珊比/响石/菲莱/裂响 5 人（index 102 数据已入库）；元素损伤模拟 element-calc.js：EP 条驱动（普通/精英 1000/领袖 2000，敌人面板新增类型下拉 enemy-grade），三类爆发结算（灼燃 7000 法伤 + 期间法抗 -20 十秒冷却 / 侵蚀 5000 + 减防不计 / 神经 6000），技能期时间轴模拟（爆条伤害全部计入技能期，灼燃减抗窗口=冷却期），真伤独立归账
- 本源铁卫元素系三人（余灼燃/珊比侵蚀/响石神经）走 calcPrimSkill 时间轴（技能 bb 的 atk_scale 均为附加伤害倍率非普攻倍率，内部以 panelAtk×(1+atk) 重算），no-skill 常态三档（物理普攻 + 天赋法伤 + 元素爆条均摊 normalTypes）
- 余 S2 瞬发 3 倍法伤 + 灼燃 / 余 S3 普攻物理 + 每秒法伤与灼燃（45s 爆 3 次×7000，天赋 2 闲云隐市条件天赋不计）；珊比侵蚀冷却折算 5s（每击减 1s 冷却）、S2 胶与 S3 传送带每跳物理 + 侵蚀；响石每秒神经损伤；菲莱/裂响纯防御注册 STOP_ATTACK/NORMAL_ATK（受击反伤/屏障/损伤条不计）
- UI 常态 DPS 多档渲染 normValHtml（物理红/法伤黄/元素灰 dmg-group 紧凑排列）
- 验证脚本 verify-element-core.mjs（12 断言）+ verify-primprotector.mjs（37 断言）+ verify-primprotector-ui.mjs（11 断言）

### fix: 重装干员面板与UI展示修复
- 可颂 S2 磁爆锤等受击回复触发型无技能期概念补常态 DPS（按职业普攻口径，有持续时间受击型如斥罪 S3 已带 normalDps 不覆盖）
- 星熊天赋 2 特种作战策略（全场重装 def+6~8% 自身必得）入 TALENT_HP_DEF_DRIVERS 白值含 ×1.06
- calcPanelStats 支持 PASSIVE 被动（星熊 S2 荆棘 def+21~24% 装备即入面板，白值面板 renderPanelStats 同步，同 calculateOperator 口径，召唤物排除）
- UI hasSkill 判定（当前槽位技能存在且非 skcom_ 通用被动且非 PASSIVE）包裹技能期行——无技能干员（医疗探机/机动盾牌/结构体）与 PASSIVE 干员（星熊 S2）卡片只显示常态信息，不再出现技能期 DPS/总伤/HPS/攻击间隔/ATK 行
- verify-protector 扩至 57 断言 + verify-summon-ui 加无技能期条目断言

### docs: 重装干员特殊说明文本入库
- 17 条：古米（平底锅专精 atk 不计）/星熊（战术装甲 atk 不计 + 荆棘 def 直接显示到白值）/塞雷娅（莱茵充能护服默认叠满）/年（干明可鉴 atk 不计）/泥岩（沃土予身回血 + 手足相惜增伤不计）/闪击（持盾射击 atk 不计）/灰毫（炮术演习默认附近非地面）/极光（低温休憩停攻 + 回血不计）/暮落（回忆之地 atk+攻速+厄运宣告减抗不计）/号角（血战全不计）/火哨（进退自如默认未阻挡）/涤火杰西卡（饱和迸射默认盾牌存在且仅一次）/余（闲云隐市回血不计）/信仰搅拌机（扫射迎宾仪礼默认满层 + 架盾送客仪礼 atk 不计）/斩业星熊（鬼之架势 atk 默认不计 + 无始无明数据不可信）/机械师（协防术式默认弹药不触发视为永续）/珊比（探险理论侵蚀冷却等效 5 秒）
- verify-notes 测试场景数据修正（塞雷娅已有说明，换斑点作无说明干员）

### feat: 术战者(artsfghter)全子职业数据入库
- 慕斯 4/星极 5/铸铁 5/史尔特尔 6/薇薇安娜 6/维娜·维多利亚 6(异格)/赤刃明霄陈 6(异格) 补全 7 人（原仅史尔特尔，index 102→108，头像下载 6 张）
- fetch-operators 新增 subFilter 子职业过滤模式（node fetch-operators.js artsfghter 只拉指定子职业，index 与磁盘旧数据 upsert 合并避免覆盖全量索引）
- 术战者特性「攻击造成法术伤害」=常态法伤，op.damageType=arts 引擎既有通道覆盖，无需子职业特判

### feat: 弱点伤害引擎与赤刃明霄陈完整支持
- 弱点伤害（PRTS 定义：造成物理/法术伤害时按目标 def/res 各结算一次取高者，类型随赢家，非独立档位，atk 跨阈值翻转：def600/res50 下 atk=1200 两式相等，高于走物理低于走法伤）
- calcDamage 加 isWeakness 逐击 max 结算并回标 damageType/normalDamageType/dmgTypes，no-skill 常态同步支持
- 形意洞照（精 1+ 解锁，精 0 全法伤）atk+8~16% 入 TALENT_ATK_DRIVERS + 攻速 8~16 入 TALENT_SPD_DRIVERS + WEAKNESS_DAMAGE 开关表
- S1 奔夜 atk+X% 二连击（MULTI_HIT×2，走通用 calcDamage）；S2 绝影-驰专用拦截 = 10 斩瞬发（每斩面板×atk_scale 逐级取档 3.5→4.8，默认打不死不转移，斩击不吃后置加攻）+ 移动后 6s 加攻普攻（respawn_buff.atk+1 逐级×3→×4，floor(6/间隔) 击），skillDps=0 只展示精确总伤；S3 天喟拦截 = 剑气 1 次（max(6% 敌当前生命，面板×projectile_min_atk_scale 逐级 5→5.8) 弱点）+ 20s 内每次攻击 3 连击×attack@atk_scale（逐级 1.5→2.1，floor(20/间隔) 次），DPS=总伤/20
- verify-artsfghter 11 断言含类型翻转验证

### feat: 维娜·维多利亚黄金盟誓召唤物入库
- token_10040_siege2_vlion（6 星真伤攻击型附带单位，E2 atk425/间隔 2.5s/阻挡 1，无技能独立查询）
- fetch-operators 新增真伤召唤物标记（tokenTrueIds→damageType=true，攻击造成真实伤害无视防御法抗）与 TOKEN_OWNER_FALLBACK 静态兜底（subFilter 模式只拉 TOKEN 时持有者不在 allIds 扫不到 displayTokenDict，显式登记黄金盟誓←维娜）
- tokenDropNativeSkills 剔除黄金盟誓（无技能攻击型召唤物同结构体口径）；index 107→108 挂 owner=维娜·维多利亚

### feat: 术战者剩余5人引擎支持
- 常驻天赋体系扩展：史尔特尔「熔火」固定法抗穿透 12~22 入 TALENT_RES_PEN_DRIVERS（calcDamage 与 no-skill 法伤结算统一吃有效法抗 resPen，弱点法伤侧同减）；星极「天体仪」叠层攻速按满层等效常驻（calcTalentAttackSpeed 支持 max_stack_cnt×5，同塞雷娅叠层先例）；薇薇安娜「燃烛施明」法伤加成 additive 化（calcTalentDmgMul 支持 superKey 按敌人类型翻倍：精英/领袖×super_scale，state.enemy.grade 驱动）
- 维娜 S1 普攻法伤 + 额外 atk_scale×atk 真伤混合单发（拦截 + cycleDps 自然回折算）/ S3 技能期伤害变真实（25s atk+X% 间隔 -0.25→1.0s 真伤普攻，黄金盟誓独立入库）；史尔特尔 S2 熔核巨影单目标 critical 1.4~1.6 与 atk 加成相乘（SINGLE_CRIT_MUL 并入 hitMul）/ S3 黄昏 isPermanent 永续自损不建模；薇薇安娜 S1 二连击×2（MULTI_HIT）/ S3 明灭间隔 +0.5 加算至 1.75s（BAT_ADD）+ 二连击 + 首次 15s（暖机三连不计）
- 说明文本 7 条（慕斯连击概率/星极叠满/铸铁击杀条件/史尔特尔熔火已计入 + 自损与击杀回复不计/薇薇安娜按敌人类型 + 明灭首次/维娜诸王叹息需友方不计 + 黄金盟誓独立查询/赤霄陈弱点机制）
- verify-artsfghter 扩至 31 断言

## v0.3.5 (2026-09-03 深夜)

### feat: 重装(TANK)全子职业数据入库
- 铁卫 15/守护者 9/不屈者 5/驭法铁卫 5/决战者 3/要塞 3/哨戒铁卫 6/本源铁卫 5 共 51 人入列（index 52→102，头像 51 张）
- 职业码为 TANK（非 DEFENDER，侦察过滤注意）；暮落取 VC07 正式版 char_4025_aprot2（旧占位 char_512_aprot 跳过）
- fetch-avatars 新增前缀搜索兜底（活动形态命名如 Mechanist→头像_Mechanist(卫戍协议).png，取最短且非 _skin/_1+ 候选）

### feat: 铁卫(protector)子职业完整支持
- 12 人（含黑角/卡缇/米格鲁/角峰/蛇屠箱/泡泡/可颂/拜松/暴雨/星熊/年/Friston-3；移除活动特殊干员 Mechanist 与预备干员-重装 rdfend/cdfend）
- 通用规则：PASSIVE 被动常驻入面板（星熊 S2 荆棘 def+24%，装备即生效无技能期，排除召唤物 skcom 被动）、停止攻击防御技技能期伤害记 0（STOP_ATTACK_SKILLS 表：年 S2/拜松 S2/蛇屠箱 S2/泡泡 S2/暴雨 S2）、自回治疗通道（hp_recovery_per_sec 角峰 S1 33/s 与 hp_recovery_per_sec_by_max_hp_ratio 蛇屠箱 S2 2%/s 展示 skillHps+totalHeal）、非医疗 heal_scale 一次性自愈（卡缇 S1 恢复 40%maxHp）
- 年 S1 锡灼技能期普攻切法伤（SKILL_ARTS_OVERRIDES，常态物理）/ S3 铁御 atk 前缀别名 nian_s_3[self].atk；常驻天赋：年积甲成山编队 maxHp+8~20% 自身必得入 TALENT_HP_DEF_DRIVERS
- 受击回复触发型（INCREASE_WHEN_TAKEN_DAMAGE）不展示周期仅单次总伤（可颂 S2 磁爆锤 4×atk 物理）；AUTO 触发型自回输出归常态（暴雨 S1 应急迷彩 55/s×4s 默认给自身）；反伤系（泡泡/年/星熊）确认不建模型
- 验证脚本 verify-protector.mjs（58 断言）

### feat: 守护者(guardian)子职业完整支持
- 9 人（塞雷娅/瑕光/黍 6★，临光/吽/深律/森西 5★，古米 4★，斑点 3★）
- 通用治疗模块 guardian-calc.js：治疗模式型（base_attack_time 普攻转治疗，每次=技能期攻击力×100%×治疗天赋倍率，间隔 1.2+1.3=2.5s，古米 S2 前 10s 烹饪 disarm 不计）、急救族 AUTO（heal_scale 充能触发，周期 HPS=单次/spCost，普攻归常态，受击型吽 S1 仅单次量）、治疗目标默认自身、isHealType 扩展 normalHps
- 治疗天赋入表：临光天马光环×1.1/森西×1.1（TALENT_HEAL）+ 森西 def10%/吽门神 def6-8%（HP_DEF）
- 特殊技能：塞雷娅天赋 1 莱茵充能护服按满层（叠层 max_stack_cnt 乘算 atk+25%/def+20%）、S3 钙质化技能期只治疗每秒 0.25atk HOT×24s；瑕光 S1 光芒涌动 AUTO 双通道（2.3atk 物理/sp4 + 1.3atk 疗）、S2 慑敌辉光必睡普攻×仁慈 1.4 + 每秒 0.18atk HOT（calcSleepAtkMul）、S3 先贤化身每击物理 + 0.8atk 法伤混合 + 0.9atk 疗/击；黍 S3 离离枯荣攻击治疗双轨 + 播种自身吃 e_atk20%/攻速 +20；森西 S2 团体魔物大餐停攻每秒 0.4atk HOT×1.1 + 收尾 1.6atk 大奶
- 混合伤害规范化 dmgTypes（类型→{skillDps, skillTotalDamage, cycleDps}，calcDamage 单类型单档，avatar 物理+法术双档）；UI dmgValHtml 逐类型渲染仅显示 >0 档位，多档 + 号分隔
- 验证脚本 verify-guardian.mjs（49 断言）+ verify-guardian-ui.mjs（6 断言）

### feat: 不屈者(unyield)子职业完整支持
- 5 人（泥岩/斥罪 6★，火神/折桠 5★，露托 4★，间隔 1.6s）；通用极少直接引擎现成（泥岩 S1 纯 def/折桠 S1 受击 def 型/S2 atk+130%/火神 S1 def+自回走自回通道）
- 新机制表：BAT_ADD_OVERRIDES（base_attack_time 正小数「间隔增大」按加算：火神 S2 +0.4→2.0s/斥罪 S3 +0.9→2.5s，默认 (0,1) 为乘算缩短）、TALENT_SKILL_RECOVER（火神天赋技能开启自回 4~5%/s 与技能键求和，S1=8%/s）、LEECH_SKILLS（火神 S2 攻击吸血 8%maxHp/击，HPS=单次/间隔）、TAKEN_SELF_HEAL（泥岩 S2 受击触发自疗 5%maxHp 单发）、DELAYED_OUTPUT（泥岩 S3 前 10s 沉睡仅后 20s 攻击间隔 1.3s atk×2.1×15 击）、TALENT_SKILL_END_HEAL（折桠技能结束回 50%maxHp）、PERIODIC_DOT（停攻周期法伤：露托 S2 每 2s 0.8atk×15 跳/斥罪 S2 每秒 1.2atk×20 跳）、TRIGGER_ARTS_ADD（斥罪 S1 AUTO 普攻物理 + 1.9atk 法伤混合单发，蓄力分支持续输出永不触发不计，cycleDps=(3×普攻+法伤)/4s）
- UI 伤害卡常态 DPS 判空修复（受击单发型）；验证脚本 verify-unyield.mjs（43 断言）

### feat: 驭法铁卫(artsprotector)子职业完整支持
- 特性=技能开启时普攻变法伤（常态物理，calcDamage 常态 normalHitDamage 与技能期伤害类型分离 normalTypeArts，年 S1 既有切法伤常态误算法伤一并修正）
- 5 人：坚雷天赋攻守兼备 atk/def+7% 常驻入表、S1 攻强 β/S2 起盾回击受击 dur atk+60% 通用法伤；石棉 S1 固守纯防御普攻照常、S2 火电 atk+70% 间隔增大 +0.4（BAT_ADD）；暮落 S1 间隔 -0.35→1.25s、S2 燃命狂欢 0.7×6 连发（hitMul=attack@atk_scale×attack@times 数据驱动）受击 dur
- 车尔尼 S1 atk+60%、S2 受击叠攻默认 0 层（atk/atk_scale 双排除 SKILL_ATK_EXCLUDE/SCALE_EXCLUDE，普攻常态法伤）+ 技能结束 2.1atk 法伤爆炸（SKILL_END_ARTS_BURST）
- 斩业星熊 S1 恶业苦果受击触发即开无限按常驻 atk+60% 法伤（默认坦克受击，待用户确认）、S2 投盾系伤害不计算（SKIP_SKILLS，常态普攻展示）、S3 地狱变相不主动关闭=二连击（MULTI_HIT×2）atk+190% 法伤×20 攻击
- 验证脚本 verify-artsprotector.mjs（26 断言）

### fix: 斩业星熊S2口径修正
- 只算本体三连击（AUTO 攻回 sp7 触发，0.75atk 法伤×3=2.25 倍，盾牌环绕法伤/吸血/停顿不计），cycleDps 按攻回 7 普攻 + 1 触发周期拆物法双档
- 移除 SKIP_SKILLS 整技能跳过（表暂空）；S1 确认按永续技能引擎通道（isPermanent 分支，未入白值）
- verify-artsprotector 扩至 27 断言

## v0.3.4 (2026-09-03)

### docs: 行医与咒愈师特殊说明文本
- 行医 3 条：褐果「厚土迸发」默认持续治疗同一目标 / 桑葚「助手」增幅不计 / 纯烬「氤氲」HOT 与「云霭荫佑」损伤屏障不计
- 咒愈师 3 条：芙蓉「朝开夕落」法脆默认生效 / 焰苇灼痕仅 S3 期计算且 S2 默认单干员持球且 S3 默认无法致死 / 缇缇「凝固的时光」DOT 与额外伤害不计 +「勇气的报偿」不计 +「旧日绽放」默认单目标 5s 醒伤

### feat: 咒愈师(incantationmedic)子职业完整支持
- 焰影苇草/濯尘芙蓉/刺玫/缇缇/阿米娅(医疗) 5 人入列（index 44→48，头像下载）；fetch-operators 支持 char_patch_table 升变干员（阿米娅医疗形态）与形态命名、保存 trait（咒愈师 scale 0.5）与模组 traitEnhance（效果模组 L1 起 0.6）、damageType 补 incantationmedic
- 模板引擎普攻法伤 + 治疗双轨（治疗=实际法伤×traitScale，含常态 DPS）；法脆增伤驱动（芙蓉朝开夕落必触发 ×1.06~1.22）
- 特殊技能模式：芙蓉 S2 抚业之触每秒 DOT、阿米娅 S1 哀恸共情攻速 + 每击额外群疗、阿米娅 S2 慈悲愿景开启 0 命中后续真伤（zerohit-true）、焰苇 S2 枯荣共息三火球每 1.5s 齐发 + 自身普攻双通道、焰苇 S3 生命火种灼痕 100% 法脆 + 灼痕秒伤吃法脆（死亡爆炸不计）、缇缇 S1 缓蚀通用加攻（概率沉睡不建模）、S2 封护停止攻击无输出（standby）、S3 旧日绽放睡眠循环（15 击全额法伤 + 4 次睡满醒伤 max 档，slumber）
- 加攻键别名 SKILL_ATK_KEY_OVERRIDES
- 验证脚本 verify-incantationmedic.mjs（85 断言）+ UI（14 断言）

### feat: 链愈师(chainhealer)子职业完整支持
- 明椒/莎草/乌啾/Mon3tr(6 星干员本体) 4 人入列（index 48→52，头像下载）；通用口径=默认仅治疗 1 人（第一跳 100%），跳跃衰减（trait 0.75/3 目标）不入引擎，普攻治疗=攻击力×1.0/2.85 与医师同模板
- Mon3tr 天赋 2 战术协同常驻攻速入 SPD 驱动（治疗每 2.85s 刷新 10s buff 等效常驻 +10~22）、S1 超压链接攻回 sp3 下次治疗 1.8 倍（絮雨模式 calcTriggerHeal）、S2 超负荷攻速×talent_scale 放大（20→50，damage-calc 加 skillAspdExtra）、S3 熔毁真伤输出模式（间隔 (2.85-1.5)/1.2=1.125s×22 击真伤 + 每击自疗 0.5×技能 atk，每秒自损 80 不建模型，damageType true）
- 乌啾 S2 捉迷藏触发型（立即普攻治疗 + HOT 每秒 0.29×12s）、S1 攻速 +60 通用；莎草 S1 巧思乍现末药式 AUTO 充能（下次治疗 1.8 倍）、S2 临考发挥虚拟目标正常奶（atk+40% + 间隔 -1.1s→1.75s）；明椒 S2 同伴意识纯 atk+60% 通用、S1 攻速 +65 通用
- 说明文本入库（通用 + 4 人 5 条）；验证脚本 verify-chainhealer.mjs（52 断言）

## v0.3.3 (2026-09-03)

### feat: 行医子职业（褐果/桑葚/蜜莓/哈洛德/纯烬艾雅法拉）
- 数据入列（index 39→44）+ 头像；技能侧 HP 治疗均由引擎既有能力覆盖：哈洛德 S1 atk 强化 / S2 攻速、褐果 S1 瞬发普攻治疗 / S2 攻速、桑葚 S1 AUTO 触发 heal_scale（触发发=1.8×面板）/ S2 间隔×0.26、纯烬 S1 永续 atk+ / S2 瞬发普攻治疗 / S3 五连发
- 元素回复（ep_*）与元素减伤字段按 HP 单目标模型全部忽略；条件性增益默认不触发（桑葚天赋需双医疗、褐果 S2 连续治疗、哈洛德 S2 元素条件）
- 纯烬 S3「火山回响」：5 连发全打单目标，SKILL_HEAL_CHAIN 驱动，每攻击回复 5×0.6×面板
- 验证脚本 verify-wandermedic.mjs（32 断言）

- 范围光环绝对值自加成（SELF_AURA_DRIVERS）：单目标模型自身必在自身攻击范围内——闪灵「黑恶魔的庇护」防御光环自加成（E2 无模 DEF 158→218，Y 模 L2/L3 强化覆盖 80/100），夜莺「白恶魔的庇护」法抗光环自加成（E2 法抗 5→20，002 模另加白值法抗+5）；地面限定(def_lowland)与幻影系不入
### feat: 常驻面板天赋驱动体系（基础属性显示与计算同步）
- 新增 TALENT_HP_DEF_DRIVERS（hpMul/defMul 乘区）：凯尔希·思衡托「遗尘守望」生命+防御 5%~30%、陈「持刀格斗术」防御 5%~6%、能天使「天使的祝福」生命 10%~13%
- TALENT_ATK_DRIVERS 扩：银灰「领袖」+5%~12%、陈 +5%~6%、能天使 +6%~8%、艾雅法拉「炎息」+7%~16%（团队光环覆盖自身，同赫默先例）
- TALENT_SPD_DRIVERS 扩：能天使「快速弹匣」攻速+6
- 撤销桑葚「助手」atk 驱动（需自身+另一医疗在场，条件不必然成立）
- 不入表判定口径：范围友方光环（蜜莓/纯烬/白恶魔——自身不在自身攻击范围内）、限时（嘉维尔 15s）、叠层（塞雷娅）均不计


## v0.3.2 (2026-09-03)

### feat: 模组系统（数据 + UI + 计算）
- 抓取 battle_equip_table，干员 JSON 挂 modules（INITIAL 证章恒有 + ADVANCED 效果模组），等级含 attributeBlackboard 与 talentEnhance（模组对天赋的数值覆盖/附加效果）
- 槽位配置新增「模组」下拉：证章 / X/Y 模组 1~3 级；未达精二解锁等级（四星 40/五星 50/六星 60）显示禁用提示；降精英化/等级自动回收为「无」
- 模组白值加成注入面板（atk/def/maxHp 加算、法抗仅显示、攻速真实缩短间隔），面板变化自然传导到计算

### feat: 天赋驱动扩展
- 常驻攻速天赋：闪灵「法典」（精二 +10，潜 3 起 +13；X 模组 L2 起覆盖为 15/18）、赫默「医疗支援」（全体医疗攻速 +6/8 精一、+12/14 精二满潜，自身必得）
- 闪灵 X 模组 ≥L2 且装备 2 技能（自动掩护）时面板攻击直接乘算 ×1.15/×1.25；Y 模组强化黑恶魔（友方防御光环，不影响自身计算）
- 常驻治疗倍率天赋：瑰盐（攻 -5% 换治疗量 ×1.05~1.17，随精化/潜能增强），普攻/技能期/触发治疗全乘

### feat: 群愈师子职业
- 数据补齐：调香师/微风/瑰盐入列（index 27→31），头像下载
- 夜莺召唤物「幻影」入列（index 32，owner 夜莺自动关联）：无攻击能力按 DPS 0 计算，伤害色定义为法术
- 治疗口径：群愈师按单目标计算，不考虑治疗目标数；调香师天赋（全场 HOT）、微风 attack@scale（友方受疗减半）不计算

### feat: 干员说明区
- 结果下方按选择顺序展示说明（notes.json 独立维护不随重抓覆盖），无说明干员跳过

### fix: 召唤物技能注入与真伤
- Mon3tr：持有者技能 attack@ 前缀剥离注入；3 技能线性衰减真实伤害按攻击时刻逐次结算；ui 颜色统一 'true' 口径，常态普攻伤害类型独立返回

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
