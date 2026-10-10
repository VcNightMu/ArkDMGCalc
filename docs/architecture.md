# 架构

> 本文描述**当前实际实现**。`docs/` 下其余文档若与本文冲突，以本文与代码为准。

## 总体形态

三层，且**层与层之间没有 IPC**——只有「文件」和「HTTP 抓取」两种关系：

```
┌──────────────────────────────────────────────────────────┐
│ 浏览器 / Tauri WebView                                     │
│                                                           │
│   index.html ──> app.js ──> ui.js  (界面与交互)            │
│                    │            │                         │
│                    │            ├─> operators.js  (加载数据)│
│                    │            └─> damage-calc.js (计算)  │
│                    │                     │                │
│   fetch('data/…')  │                     └─> 各子职业模块   │
│   fetch('assets/…')│                                      │
│                    └─> state.js  (全局状态：4 槽 + 敌人)     │
└──────────────────────────────────────────────────────────┘
        ▲ fetch 本地 JSON                    ▲ 加载静态资源
        │                                    │
   src/frontend/data/                  src/frontend/assets/
        ▲
        │ 写入（人工触发，非运行时）
        │
┌──────────────────────────────────────────────────────────┐
│ Node 脚本 scripts/*.js                                    │
│   fetch-operators.js  ← HTTP → Kengxxiao/ArknightsGameData │
│   fetch-avatars.js    ← HTTP → prts.wiki/api.php           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Tauri v2 外壳 src-tauri/（只剩窗口与资源协议）              │
│   main.rs = 1 个 fn main()；无自定义命令、无 IPC           │
└──────────────────────────────────────────────────────────┘
```

## 三个部分的职责

### 1. 前端（`src/frontend/`）—— 全部业务逻辑

**计算 100% 在前端 JS**，无服务端。这是从初版就定下的取舍，理由是：计算逻辑需要高频迭代，
JS 改完刷新即生效，不必重新编译；计算不涉及系统权限，不需要后端；前端可直接操作 DOM 渲染结果。

- `app.js`：唯一入口，`DOMContentLoaded` 时调用 `initEnemyPanel()` + `initOperatorSlots()`。
- `ui.js`：全部界面与交互（槽位、选择器、结果渲染、说明区），并**驱动重算**——所有输入项都绑定
  `input`/`change` 事件，改动即调 `updateResults()`，**没有「计算」按钮**。
- `operators.js`：数据加载与缓存（索引 / 干员 JSON / 说明文本 / 子职业字典）。
- `state.js`：全局状态，只有两项——`slots`（4 个）与 `enemy`（含 `grade`）。
- `calculator.js`：属性插值 `calcAttribute`（PRTS 属性基本公式）与物理/法术/真实三条伤害公式，
  是所有模块共用的地基。
- `damage-calc.js`：主引擎（全项目最大的文件）。入口 `calculateOperator()`，其余是各子职业分支与口径表。
  **计算体系详见 `skill-types.md`。**
- `damage-ops-calc.js`：通用单次命中结算与技能期/常态/循环的分流，见 `skill-types.md`。
- 各子职业专用模块：`medic-calc.js`（医疗）、`guardian-calc.js`（守护者）、`element-calc.js`（元素损伤）、
  `ritualist-calc.js`（巫役）、`summoner-calc.js`（召唤师）、`primprotector-calc.js`（本源铁卫）、
  `primcaster-calc.js`、`primguard-calc.js`。

**没有构建步骤**：原生 ES Module，浏览器直接加载。因此 `index.html` **不能用 `file://` 直接双击**
（ESM + `fetch` 会被浏览器同源策略拦截），必须走本地服务或打包后的 exe。

### 2. 数据抓取脚本（`scripts/`）—— 人工触发，与运行时无关

抓取**不是**运行时行为，也没有定时任务：桌面端离线可用被判定为更重要，同时避免对数据源造成无谓压力。

- `fetch-operators.js`：从 Kengxxiao/ArknightsGameData 拉干员与单位数值、天赋、技能 blackboard、
  模组（`battle_equip_table`）。内含三层白名单 `OPERATORS`（主职业→子职业→id）、升变形态表 `PATCH_CHARS`、
  召唤物登记（`displayTokenDict` / `ownerOperatorId`）与虚构派生条目 `VIRTUAL_TOKENS`。
  支持 `node scripts/fetch-operators.js <子职业>` 只拉指定子职业（与磁盘旧数据 upsert 合并，不覆盖全量索引）。
- `fetch-avatars.js`：从 PRTS Wiki `api.php` 解析「文件:头像_<中文名>.png」真实 URL 后下载，
  **已存在则跳过**（可断点续跑）。
- `dedup-index.js`：索引去重与清理。

### 3. Tauri 外壳（`src-tauri/`）—— 只做窗口

**Rust 侧不参与计算，也不抓数据。** `src/main.rs` 只有 1 个 `fn main()`：建窗口、挂资源协议。
没有自定义 `#[tauri::command]`，没有 IPC，没有 reqwest/tokio。

前端资源（`../src/frontend`）在 `cargo build` 时由 `tauri::generate_context!()` 打进二进制，
产物是单个自包含 exe（前端与数据全内嵌，运行时不联网、不需要 node）。
打包走 **Windows GNU 工具链，不需要 Visual Studio / MSVC**，细节见 `src-tauri/BUILD.md`。

## 数据流（一次真实交互）

```
启动
  └─ index.html 加载 app.js
       └─ initOperatorSlots()  建 4 个空槽
       └─ initEnemyPanel()     绑定敌人 4 项 + 敌人类型下拉（改动即重算）

用户点击空槽
  └─ showOperatorPicker(i)
       └─ getPopularOperators() → fetch data/index.json（502 条，首次后缓存）
       └─ 三级下拉：主职业 → 子职业 → 干员；或搜索框按显示名子串过滤全库（命中段高亮）
       └─ 点击某条 → 写入 state.slots[i] → renderSlot(i)

用户在槽内调整（精英化/等级/信赖/潜能/模组/技能/专精）
  └─ 槽内 'change' → 修正越界（如降精英化会回收模组、夹紧技能等级）→ renderSlot(i) → updateResults()

updateResults()
  └─ renderPanelStats()   每个槽：calcPanelStats() → 基础属性卡（生命/攻击/防御/法抗/攻击间隔）
  └─ 对每个已填槽：
       └─ getOperatorData(id) → fetch data/<职业>/<子职业>/<id>.json（缓存）
       └─ 召唤物需持有者面板时，联动加载持有者满练数据注入 ctx（见 summoner-calc.js 与 ui.js 的持有者引用表）
       └─ calculateOperator(op, slotData, ctx) → 结果对象
  └─ 按结果类型渲染（输出型 / 治疗型 / 双档混合，见 ui.js 的 dmgValHtml / normValHtml）
  └─ 按选择顺序渲染说明：data/notes.json 的 __subprof_* 子职业说明在前，干员个人说明在后
```

## 无网络时的行为

运行时**本来就不需要网络**：数据、头像、计算全部本地。抓取脚本是人工单独执行的，
所以不存在「网络不可用」的运行时分支，界面上也没有「数据可能不是最新」这类提示。

解析失败或字段缺失的容错放在引擎侧：各分支对 blackboard 键普遍做 `!== undefined` 判定与缺省值兜底，
未实现的机制走 `data/notes.json` 的说明文本（见 `skill-types.md` 的「不建模即说明」约定）。

## 依赖

- **前端：零依赖**。无框架、无打包器、无 npm 包。
- **脚本**：只用 Node 内置模块（`fs` / `path` / `https` 等）。
- **Tauri**：`tauri` / `serde` / `serde_json` 等框架依赖，仅外壳使用，不参与计算。

## 与初版设计的差异（为什么文档会不一致）

初版 `docs/architecture.md` 规划过一个 Rust 后端：抓取器、页面解析器、定时调度器，
以及 `check_update()` / `fetch_operator()` / `get_operator_data()` 等 5 个 Tauri IPC 命令，
并设计了「启动时检查 24h 内是否更新、超时则后台静默抓取」的数据流。

**这套设计没有实现，且已明确放弃**，原因：

1. 抓取是低频、需人工确认的操作，放在前端或脚本里就够，不值得为它引入 Rust 异步运行时；
2. 「启动时静默更新」与「桌面端离线可用」直接冲突，且会给数据源带来无谓压力；
3. 计算逻辑放前端让迭代成本最低，Rust 只保留窗口职责。

因此现在的边界是**文件**（脚本写、前端读），而不是 IPC。
