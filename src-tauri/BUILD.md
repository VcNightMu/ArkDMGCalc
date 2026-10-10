# Tauri 单文件 exe 打包说明（GNU 工具链，全程不需 MSVC）

本目录是 ArkDMGCalc 的 Tauri v2 打包脚手架。前端资源（`../src/frontend`，约 26 MB）
在 `cargo build` 时由 `tauri::generate_context!()` 打进二进制，产出一个自包含的
`arkdmgcalc.exe`，双击即用，不需要 node / python / 本地 http 服务，也不联网。

## 为什么要绕开 MSVC

本机装不上 Visual Studio / MSVC。因此不使用 `x86_64-pc-windows-msvc`，而是走
rustup 已安装的 `stable-x86_64-pc-windows-gnu`：

- 该 toolchain 自带 `rust-mingw` self-contained 库（`crt2.o` / `libmingw32.a` / `libkernel32.a` / `libgcc.a` …），
  不需要额外装 MinGW 就能链接 Windows 程序；
- 链接器用 toolchain 内的 `rust-lld`（来自 `llvm-tools-preview` 组件），见 `.cargo/config.toml`；
- `tauri-build` 需要 `windres` 编译 Windows 资源（图标/清单），由 w64devkit 提供（加进 PATH 即可）。

## 前置条件（在一台干净机器上复现）

1. **rustup + Rust**（stable 即可），并安装 GNU toolchain：
   ```
   rustup toolchain install stable-x86_64-pc-windows-gnu
   rustup target add x86_64-pc-windows-gnu --toolchain stable-x86_64-pc-windows-gnu
   rustup component add llvm-tools-preview --toolchain stable-x86_64-pc-windows-gnu
   ```
   最后一步给出 `rust-lld`（链接器）。国内慢可先设
   `RUSTUP_DIST_SERVER=https://rsproxy.cn`、`RUSTUP_UPDATE_ROOT=https://rsproxy.cn/rustup`。
2. **windres**：解压 [w64devkit](https://github.com/skeeto/w64devkit/releases)
   （例如 `w64devkit-x64-2.10.0.7z.exe`，自解压，无需 MSVC），把它的 `bin` 目录加进 PATH。
   只需要其中的 `windres.exe`；`gcc/ld` 用不到。
3. **Tauri CLI**（用预编译的 npm 包，不要 `cargo install tauri-cli`，否则要现场编译）：
   ```
   npm i -D @tauri-apps/cli@^2
   ```
4. 已装 **WebView2 运行时**（Win11 自带；其它系统由 exe 内的 embedBootstrapper 兜底）。

## 构建

```powershell
$env:RUSTUP_TOOLCHAIN = "stable-x86_64-pc-windows-gnu"
$env:PATH = "C:\w64devkit\bin;" + $env:PATH      # 提供 windres
cd src-tauri
cargo build --release --target x86_64-pc-windows-gnu
# 或： npx tauri build --target x86_64-pc-windows-gnu
```

产物：`src-tauri/target/x86_64-pc-windows-gnu/release/arkdmgcalc.exe`

> **换了检出目录（或复制过仓库）后必须先删 `target/` 再构建**：`target/` 里的 `.d` 依赖文件
> 记录的是构建时的绝对路径，迁移后会残留旧路径，`tauri-build` 读 `permissions\...` 时报
> `系统找不到指定的路径 (os error 3)`。实测：`Remove-Item target -Recurse -Force` 后
> 从零构建 **150 秒**可出包（24032768 字节）。

`Cargo.lock` 已提交，`[patch]`/镜像等都在 `.cargo/config.toml` 里（crates.io 走 rsproxy 加速），
不改用户级 `~/.cargo/config.toml`。

## 关于 WebView2Loader（重要）

`webview2-com-sys` 在非 MSVC 目标上默认 `#[link(name = "WebView2Loader.dll")]`，
即对 `WebView2Loader.dll` 的**静态导入**——这样产出的 exe 不是单文件，
运行时缺这个 DLL 会直接弹「系统错误」对话框。

本项目在 `src/webview2_loader.rs` 里用 `#[export_name]` 定义了同名的 5 个入口，
把真正的 `WebView2Loader.dll`（构建时由 `build.rs` 从 `webview2-com-sys/x64/` 取出、
`include_bytes!` 内嵌）在首次调用时释放到临时目录并 `LoadLibraryW` 加载后转发。
结果是：导入表里不再有 `WebView2Loader.dll`，exe 真正自包含
（只依赖系统 DLL + WebView2 运行时）。

## 测试

打包脚手架为新增目录，未改动 `src/frontend/js/*` 与既有测试：

```powershell
cd scripts/tests
node verify-snapshot.mjs        # 期望输出「计算条目: 505 / 快照全等: 505 干员 无差异」
# 其余 verify-*.mjs 共 103 个用例全部通过
```

## 出包后的验收（建议每次都做）

单元回归证明**引擎**对，但证明不了**包**能用（内嵌资源、WebView2 拉起、打包环境下的渲染）。
最低成本的做法是让 WebView2 打开远程调试端口，再用 CDP 驱动应用内真实页面：

```powershell
# 1) 进程级：把包复制到临时目录再跑，别在仓库里留浏览器 profile
$stage = Join-Path $env:TEMP 'arkverify-stage'; New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item dist\arkdmgcalc.exe "$stage\ArkDMGCalc-verify.exe" -Force

# 2) 带调试端口启动（该环境变量只对本次启动的进程有效，不写系统设置）
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9555'
Start-Process "$stage\ArkDMGCalc-verify.exe"

# 3) 期望：进程存活、窗口标题「ArkDMGCalc - 明日方舟干员输出计算器」、
#    有 msedgewebview2 子进程、下面端点可用（Browser 为 Edg/149…）
Invoke-WebRequest http://127.0.0.1:9555/json/version -UseBasicParsing | Select-Object -Expand Content
# 应用内页面 URL 是 http://tauri.localhost/（说明走内嵌资源，不是 dev-server）
Invoke-WebRequest http://127.0.0.1:9555/json/list -UseBasicParsing | Select-Object -Expand Content
```

接上 CDP 后的断言集合（`.probe-sessions/exe-e2e.mjs` 即这套，2026-10-10 实测 12 条全过）：
4 个空槽渲染 → 点槽位开选择器 → 搜「克莱门莎」→ 点击入槽 → 设 E2/90/信赖100/潜0/冲蚀/专一 →
读回结果卡（总伤 5838+5000、循环 DPS 4480、技能期 ATK 2575）与基础属性卡（生命 2720 / 攻击 1030），
并确认头像 `<img>` 的 `naturalWidth > 0`（证明 `assets/` 也在包内）。

> 注意：**不要**用「源文件字节是否为 exe 子串」判断内嵌是否完整——Tauri 把前端**整体压缩**嵌入，
> 只有 ASCII 短串可能碰巧命中，中文一律找不到，容易误判成「缺数据」。以运行时渲染为准。

