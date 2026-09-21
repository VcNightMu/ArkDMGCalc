# ArkDMGCalc - 明日方舟干员伤害计算器

填入敌人的生命 / 攻击 / 防御 / 法术抗性，选择干员（精英化 / 等级 / 信赖 / 潜能 / 模组 / 技能等级与专精），算出**常态 DPS、技能期总伤与 DPS、触发类周期 DPS、治疗 HPS 与总治疗量**，最多 5 名干员并排对比。

覆盖 **72/72 个子职业**（先锋 6、重装 8、医疗 7、术师 9、狙击 10、近卫 14、辅助 8、特种 10），数据索引共 **502 条**（含召唤物与傀儡师替身等附带单位）。

> 本 README 描述的是**当前实际架构**。`docs/` 下的文档是设计期的早期规划，其中提到的一些模块（Rust 侧抓取器 / 解析器 / 调度器、`src/js/calculator` 分层等）**并未按原计划实现**，实现方式以本文件与代码为准。

## 技术栈（现状）

- **前端**：原生 HTML + CSS + ES Module JavaScript。**无框架、无打包、无构建步骤、零 npm 依赖**，浏览器直接加载。
- **计算**：全部在前端 JS 内完成，无服务端。`damage-calc.js`（约 472 KB）是主引擎，聚集了各子职业的分支与全部口径表；部分子职业另有专用模块。
- **数据**：本地 JSON。干员/单位数据、索引、职业结构、口径说明文本都在 `src/frontend/data/` 下，前端用 `fetch` 读取。
- **桌面壳**：Tauri v2（Rust 只做窗口与资源协议，计算逻辑不进 Rust）。Windows 打包走 **GNU 工具链，不需要 Visual Studio / MSVC**，内嵌 WebView2 运行时加载器，产物为单个 exe。
- **数据抓取**：由 Node 脚本人工触发（`scripts/` 下），**不是**后端定时任务。

## 目录结构

```
ArkDMGCalc/
├── src/frontend/                     # 全部前端，无构建步骤
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── app.js                    # 入口，装配 UI
│   │   ├── ui.js                     # 界面与交互（干员槽、选择器、结果渲染）
│   │   ├── state.js                  # 全局状态
│   │   ├── operators.js              # 数据加载（索引 / 干员 JSON / 说明文本 / 头像）
│   │   ├── calculator.js             # 基础属性与攻击间隔
│   │   ├── damage-calc.js            # 主引擎：子职业分支、口径表、天赋/模组/技能处理
│   │   ├── damage-ops-calc.js        # 单次伤害结算（物理 / 法术 / 真实 / 元素）
│   │   └── *-calc.js                 # 子职业专用模块
│   │       ├── medic-calc.js         # 医疗（含周期 DPS 口径）
│   │       ├── element-calc.js       # 元素损伤与爆条
│   │       ├── ritualist-calc.js     # 巫役（损伤时间轴）
│   │       ├── summoner-calc.js      # 召唤师（召唤物）
│   │       ├── guardian-calc.js
│   │       ├── primcaster-calc.js
│   │       ├── primguard-calc.js
│   │       └── primprotector-calc.js
│   ├── data/
│   │   ├── index.json                # 干员/单位索引（502 条）
│   │   ├── sub-professions.json      # 职业 → 子职业结构
│   │   ├── notes.json                # 口径说明文本（不建模项逐条说明）
│   │   └── <职业>/<子职业>/<id>.json # 干员/单位数据（数值键，不含描述文本）
│   └── assets/avatars/<职业>/<子职业>/<id>.png
├── scripts/
│   ├── fetch-operators.js            # 抓干员/单位数值与天赋技能 → data（含召唤物登记）
│   ├── fetch-avatars.js              # 抓头像（断点续跑，已存在则跳过）
│   ├── dedup-index.js                # 索引去重/清理
│   └── tests/
│       ├── run-all.mjs               # 全量验证 runner
│       ├── verify-*.mjs              # 103 个子职业/机制验证脚本
│       ├── snapshots/baseline.json   # 全库数值基线快照
│       └── (其余为 dump / e2e / smoke 辅助脚本)
├── src-tauri/                        # Tauri v2 桌面壳
│   ├── src/main.rs                   # 窗口与资源协议
│   ├── src/webview2_loader.rs        # WebView2 加载器内嵌转发（见 BUILD.md）
│   ├── tauri.conf.json / build.rs / Cargo.toml / .cargo/config.toml / icons/
│   └── BUILD.md                      # 打包与复现步骤（GNU 路线）
├── dist/ArkDMGCalc.exe               # 打包产物（.gitignore，不入库）
├── docs/                             # 设计文档（早期规划，可能滞后）
├── dev-server.js / dev-server.ps1    # 本地静态服务
└── CHANGELOG.md                      # 逐版本变更与口径决策记录
```

## 功能

**干员选择**：主职业 → 子职业 → 干员三级下拉；顶部搜索框支持**按名称子串搜索**（打任意一段即命中，命中段高亮，点击才入槽，清空恢复三级列表）。搜索只匹配干员显示名，内部代号不参与匹配。选择面板顶部锚定，结果增减不会带动输入框。

**每个干员槽可设**：精英化 0/1/2、等级、信赖 0–100%、潜能、模组（X / Y 各档位）、技能与技能等级（1–7 与专精 1–3）。

**敌人输入**：生命 / 攻击 / 防御 / 法术抗性，默认 50000 / 800 / 600 / 50。

**结果展示**（按类型分流）：

- 输出型：常态（技能未开启）DPS + 技能期 DPS 与总伤
- 触发型 / 瞬发型：单次伤害与周期 DPS；纯瞬发型只显示总伤，不显示技能期 DPS
- 治疗型：HPS 与技能期总治疗量
- 附带单位（召唤物、替身）：独立成条，部分可选技能，伤害按持有者面板结算

**口径说明**：任何不纳入计算的效果（概率/条件类天赋、反伤、非输出的增益、给友方的光环等）都会在界面上附说明文本，逐条记录在 `data/notes.json`。

## 计算口径（工程近似，务必先读）

本工具算的是**可复现的稳态口径**，不是逐帧战斗模拟。主要约定：

- **敌方条件类效果默认不触发**：概率触发、需特定敌人状态（被阻挡、冻结、能量层数等）、需击杀叠层等，一律按不生效处理，走说明文本。
- **叠层类天赋**只对「攻击次数型 / 时间型 / 必定触发型」三类按叠满计入；「击杀型 / 受击型」不计。
- **状态类收益按「先结算状态再结算伤害」**（如寒冷/冻结脆弱、削抗、减防）。
- **触发型技能**按充能周期折算成周期 DPS；**限时被动**按技能期显示，不折进常态面板。
- **技能期攻击力加成与天赋加成同池加算**（多例如此，已按游戏内实测口径处理）。
- **弹药型技能**按「弹药数 × 攻击间隔 = 技能窗口」，技能期总伤在窗口内结算，常态化列仍给自身普攻。
- **非输出效果不建模**：治疗、回复技力、护盾、阻挡、控制、给友方的增益等，除非直接影响该干员自身输出。
- 每个子职业的**逐干员口径决策**（含用户拍板的特例）记录在 `CHANGELOG.md` 与 `data/notes.json`，改动引擎前请先读。

## 本地运行

前端是 ESM + `fetch`，**不能直接双击 `index.html`**（`file://` 下会被浏览器拦截）。用本地服务：

```
node dev-server.js            # 或 .\dev-server.ps1
# 浏览器打开 http://localhost:8080
```

或者直接用打包好的 `dist\ArkDMGCalc.exe`（无需服务、无需安装）。

## 验证与回归

改动引擎或数据后**必须全量跑一遍**：

```
& "E:\Program Files\nodejs\node.exe" scripts\tests\run-all.mjs
# 期望：共 103 个脚本, 103 PASS, 0 FAIL，退出码 0
# 只跑部分：run-all.mjs picker instructor      （匹配脚本名关键字）
```

- runner 判定 = **子进程退出码 + 输出中的失败字样**双判（避免「只打印 FAIL 但退出码为 0」的假绿灯），任一脚本真失败即非零退出。
- `verify-snapshot.mjs` 会拿全库 502 条与 `scripts/tests/snapshots/baseline.json` 逐字段比对；确认差异只来自本次改动后，用 `--update` 重设基线。
- 新增子职业的验收标准是四件套：**引擎分支/口径表 + `verify-<子职业>.mjs` + `notes.json` 说明 + 基线快照更新**。
- `data` 里的 JSON 只存数值键、不含技能描述文本；描述需另查外部来源。

## 打包（单个 exe）

见 `src-tauri/BUILD.md`，要点：

- Tauri v2 + **Windows GNU 工具链**：`rustup toolchain install stable-x86_64-pc-windows-gnu` + `rustup component add llvm-tools-preview`（拿 `rust-lld` 当链接器），再从 w64devkit 借一个 `windres.exe` 编资源。**全程不需要 Visual Studio / MSVC / Windows SDK**，也不需要单独安装 MinGW。
- WebView2 加载器由 `src-tauri/src/webview2_loader.rs` 自定义符号转发（否则非 MSVC 目标下会产生 WebView2Loader.dll 的静态导入，双击报「找不到 WebView2Loader.dll」）。
- 产物：`dist\ArkDMGCalc.exe`（约 22.7 MB，前端与数据全部内嵌）。
- 目标机器：64 位 Windows 10 1803+ / Windows 11 + WebView2 运行时（Win11 自带）。不需要 .NET / VC++ 运行库 / Node。exe 未签名，首次运行可能被 SmartScreen 拦，需「更多信息」→「仍要运行」。

## 数据更新

- 干员数值：`node scripts/fetch-operators.js`；头像：`node scripts/fetch-avatars.js`（可断点续跑）。
- **不实现启动时自动抓取**：原设计的「后台静默定时更新」已放弃——桌面端离线可用更重要，也避免对 Wiki 造成无谓压力。新增干员时人工重跑脚本即可（重跑会自然带出新字段）。

## 许可与版权

本项目仅用于学习和个人使用。明日方舟及相关内容版权归鹰角网络所有；数据与头像抓取自 PRTS Wiki，归各贡献者所有。
