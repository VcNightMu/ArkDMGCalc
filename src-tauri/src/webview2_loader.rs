//! 在 `x86_64-pc-windows-gnu` 目标下自包含地提供 WebView2Loader 的 5 个入口函数。
//!
//! ## 背景
//! `webview2-com-sys` 在非 MSVC 目标（即 windows-gnu）上使用的是：
//! ```ignore
//! #[link(name = "WebView2Loader.dll")]
//! extern "system" { ... }
//! ```
//! 也就是说，链接出来的是一个对 `WebView2Loader.dll` 的**静态导入**，
//! 运行时必须能在这个 DLL 才能启动（否则进程在进入 main 之前就弹「系统错误」）。
//! 这会让 exe 不再是单文件。
//!
//! ## 做法
//! 本模块用 `#[export_name]` 定义了与那 5 个入口**同名**的符号。
//! 由于这些定义位于最终 bin crate 的 object 里（而不是归档成员），
//! 链接器在扫描 `WebView2Loader.dll` 的导入库时已经能看到它们，
//! 于是不会再去拉取导入库成员，也就不会产生对 DLL 的导入。
//!
//! 函数体本身则把调用转发给真正的 `WebView2Loader.dll`：
//! 该 DLL 在构建时被内嵌进二进制（见 `build.rs`），首次调用时释放到
//! 临时目录，用 `LoadLibraryW` 加载后 `GetProcAddress` 转发。
//! 这样既保留了微软官方 loader 的完整逻辑（版本探测、通道选择等），
//! 又不需要用户额外放置任何文件。
//!
//! 仅在本机（GNU 工具链）编译：MSVC 工具链下本模块整体为空。
#![cfg(all(target_os = "windows", target_env = "gnu"))]

use core::ffi::c_void;
use std::sync::OnceLock;

type Hresult = i32;
type Pcwstr = *const u16;
type Pwstr = *mut u16;

const E_FAIL: Hresult = 0x8000_4005u32 as i32;

/// 构建时由 build.rs 从 webview2-com-sys 的 x64 目录取出并放到 OUT_DIR。
const LOADER_DLL_BYTES: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/WebView2Loader.x64.dll"));

extern "system" {
    fn LoadLibraryW(lp_lib_file_name: *const u16) -> *mut c_void;
    fn GetProcAddress(h_module: *mut c_void, lp_proc_name: *const u8) -> *mut c_void;
}

static REAL_LOADER: OnceLock<usize> = OnceLock::new();

/// 把内嵌的 WebView2Loader.dll 释放到临时目录并加载，返回模块句柄。
fn resolve_loader() -> Option<usize> {
    let cached = REAL_LOADER.get_or_init(|| {
        let path = match extract_loader() {
            Some(p) => p,
            None => return 0,
        };
        unsafe { LoadLibraryW(path.as_ptr()) as usize }
    });
    if *cached == 0 {
        None
    } else {
        Some(*cached)
    }
}

fn extract_loader() -> Option<Vec<u16>> {
    let dir = std::env::temp_dir().join("ArkDMGCalc");
    let _ = std::fs::create_dir_all(&dir);
    let file = dir.join("WebView2Loader.x64.dll");

    let need_write = match std::fs::metadata(&file) {
        Ok(m) => m.len() != LOADER_DLL_BYTES.len() as u64,
        Err(_) => true,
    };
    if need_write {
        // 写到临时文件再改名，避免并发/半截文件
        let tmp = dir.join("WebView2Loader.x64.dll.tmp");
        std::fs::write(&tmp, LOADER_DLL_BYTES).ok()?;
        std::fs::rename(&tmp, &file).ok()?;
    }

    // LoadLibraryW 需要绝对路径；这里 file 已是绝对路径
    let mut wide: Vec<u16> = file.as_os_str().to_string_lossy().encode_utf16().collect();
    wide.push(0);
    Some(wide)
}

/// 取真实 loader 中的某个导出函数指针。
unsafe fn proc(name: &'static [u8]) -> Option<*mut c_void> {
    let module = resolve_loader()? as *mut c_void;
    let p = GetProcAddress(module, name.as_ptr());
    if p.is_null() {
        None
    } else {
        Some(p)
    }
}

#[export_name = "CompareBrowserVersions"]
pub unsafe extern "system" fn compare_browser_versions(
    version1: Pcwstr,
    version2: Pcwstr,
    result: *mut i32,
) -> Hresult {
    unsafe {
        match proc(b"CompareBrowserVersions\0") {
            Some(p) => {
                let f: unsafe extern "system" fn(Pcwstr, Pcwstr, *mut i32) -> Hresult =
                    core::mem::transmute(p);
                f(version1, version2, result)
            }
            None => E_FAIL,
        }
    }
}

#[export_name = "CreateCoreWebView2Environment"]
pub unsafe extern "system" fn create_core_webview2_environment(
    environment_created_handler: *mut c_void,
) -> Hresult {
    unsafe {
        match proc(b"CreateCoreWebView2Environment\0") {
            Some(p) => {
                let f: unsafe extern "system" fn(*mut c_void) -> Hresult = core::mem::transmute(p);
                f(environment_created_handler)
            }
            None => E_FAIL,
        }
    }
}

#[export_name = "CreateCoreWebView2EnvironmentWithOptions"]
pub unsafe extern "system" fn create_core_webview2_environment_with_options(
    browser_executable_folder: Pcwstr,
    user_data_folder: Pcwstr,
    environment_options: *mut c_void,
    environment_created_handler: *mut c_void,
) -> Hresult {
    unsafe {
        match proc(b"CreateCoreWebView2EnvironmentWithOptions\0") {
            Some(p) => {
                let f: unsafe extern "system" fn(Pcwstr, Pcwstr, *mut c_void, *mut c_void) -> Hresult =
                    core::mem::transmute(p);
                f(
                    browser_executable_folder,
                    user_data_folder,
                    environment_options,
                    environment_created_handler,
                )
            }
            None => E_FAIL,
        }
    }
}

#[export_name = "GetAvailableCoreWebView2BrowserVersionString"]
pub unsafe extern "system" fn get_available_core_webview2_browser_version_string(
    browser_executable_folder: Pcwstr,
    version_info: *mut Pwstr,
) -> Hresult {
    unsafe {
        match proc(b"GetAvailableCoreWebView2BrowserVersionString\0") {
            Some(p) => {
                let f: unsafe extern "system" fn(Pcwstr, *mut Pwstr) -> Hresult =
                    core::mem::transmute(p);
                f(browser_executable_folder, version_info)
            }
            None => E_FAIL,
        }
    }
}

#[export_name = "GetAvailableCoreWebView2BrowserVersionStringWithOptions"]
pub unsafe extern "system" fn get_available_core_webview2_browser_version_string_with_options(
    browser_executable_folder: Pcwstr,
    environment_options: *mut c_void,
    version_info: *mut Pwstr,
) -> Hresult {
    unsafe {
        match proc(b"GetAvailableCoreWebView2BrowserVersionStringWithOptions\0") {
            Some(p) => {
                let f: unsafe extern "system" fn(Pcwstr, *mut c_void, *mut Pwstr) -> Hresult =
                    core::mem::transmute(p);
                f(browser_executable_folder, environment_options, version_info)
            }
            None => E_FAIL,
        }
    }
}
