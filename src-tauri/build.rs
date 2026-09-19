// ArkDMGCalc - Tauri 单文件 exe 构建脚本（GNU 工具链，绕开 MSVC）
//
// 除标准的 tauri_build 外，这里额外做一件事：
// 把 WebView2Loader.dll（x64）从 webview2-com-sys 的 cargo 缓存中取出，
// 复制到 OUT_DIR，供 src/webview2_loader.rs 用 include_bytes! 内嵌进 exe。
// 这样产出的 exe 不依赖任何外部 WebView2Loader.dll 文件。

use std::path::{Path, PathBuf};

fn main() {
    tauri_build::build();

    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    if target_os == "windows" && target_env == "gnu" {
        stage_webview2_loader();
    }
}

fn stage_webview2_loader() {
    let out_dir = PathBuf::from(std::env::var("OUT_DIR").expect("OUT_DIR"));
    let dest = out_dir.join("WebView2Loader.x64.dll");

    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let local = manifest_dir.join("assets").join("WebView2Loader.x64.dll");
    println!("cargo:rerun-if-changed={}", local.display());

    let src = if local.is_file() {
        Some(local.clone())
    } else {
        find_in_cargo_registry()
    };

    let src = match src {
        Some(p) => p,
        None => panic!(
            "未找到 WebView2Loader.x64.dll。可把它放到 {} ，\
             或先让 cargo 下载 webview2-com-sys 依赖（其 x64/ 目录内自带该文件）。",
            local.display()
        ),
    };

    std::fs::copy(&src, &dest)
        .unwrap_or_else(|e| panic!("复制 WebView2Loader.x64.dll 失败: {src:?} -> {dest:?}: {e}"));
    println!("cargo:rerun-if-changed={}", src.display());
    println!("cargo:warning=WebView2Loader.x64.dll staged from {}", src.display());
}

/// 在 $CARGO_HOME/registry/src/*/webview2-com-sys-*/x64/WebView2Loader.dll 中查找。
fn find_in_cargo_registry() -> Option<PathBuf> {
    let cargo_home = std::env::var("CARGO_HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok().map(|p| format!("{p}\\.cargo")))?;
    let src_root = Path::new(&cargo_home).join("registry").join("src");
    for registry in std::fs::read_dir(&src_root).ok()?.flatten() {
        let registry_path = registry.path();
        if !registry_path.is_dir() {
            continue;
        }
        for krate in std::fs::read_dir(&registry_path).ok()?.flatten() {
            let name = krate.file_name().to_string_lossy().to_string();
            if name.starts_with("webview2-com-sys-") {
                let cand = krate.path().join("x64").join("WebView2Loader.dll");
                if cand.is_file() {
                    return Some(cand);
                }
            }
        }
    }
    None
}
