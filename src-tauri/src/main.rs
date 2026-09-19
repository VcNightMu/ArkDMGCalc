// ArkDMGCalc - Tauri 单文件 exe 启动器
// 纯前端静态资源（../src/frontend）在构建时被打进二进制，
// 运行时不联网、不需要本地 http 服务。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 在 windows-gnu 目标下自包含地提供 WebView2Loader 入口（见模块注释）。
mod webview2_loader;

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running ArkDMGCalc");
}
