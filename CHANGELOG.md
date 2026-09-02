# Changelog

## v0.1.0 (2026-09-02)

### feat: 基础计算器框架
- Tauri v2 项目结构，纯前端可运行
- 8个干员数据（银灰/陈/棘刺/能天使/艾雅法拉/史尔特尔/风笛/塞雷娅）
- 物理/法术伤害类型区分，基于子职业判断
- 技能效果 blackboard key 正确映射（atk/def/attack@max_target/attack_speed）
- 物理伤害公式 `ATK - DEF` 保底5%，法术伤害公式 `ATK × (100-RES)/100`
- 总伤按单目标计算
- 精英化限制技能选择和技能等级
- 潜能配置
- JSON 数据持久化 + 异步加载
- 深色方舟风格 UI，技能选择框适配8字中文名

### fix: 修复项
- 物理伤害公式从 `ATK × 100/(100+DEF)` 修正为 `ATK - DEF`
- blackboard key 名从 `atk_percent`/`def_percent` 修正为 `atk`/`def`
- 技能名显示为中文（从 skill_table 提取）
- 技能等级值从 1-10 修正为 0-9
- app.js 编码损坏修复（PowerShell 写文件破坏 UTF-8）
