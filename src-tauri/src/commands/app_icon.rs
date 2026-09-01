use tauri::AppHandle;

#[cfg(not(target_os = "macos"))]
use tauri::Manager;

const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";

fn validate_png(icon_bytes: &[u8]) -> Result<(), String> {
    if icon_bytes.starts_with(PNG_SIGNATURE) {
        Ok(())
    } else {
        Err("dynamic app icon must be a PNG image".to_string())
    }
}

#[cfg(target_os = "macos")]
fn set_macos_app_icon(icon_bytes: Vec<u8>) -> Result<(), String> {
    use objc2::{AnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let mtm = MainThreadMarker::new()
        .ok_or_else(|| "dynamic app icon update must run on the main thread".to_string())?;
    let data = NSData::with_bytes(&icon_bytes);
    let image = NSImage::initWithData(NSImage::alloc(), &data)
        .ok_or_else(|| "dynamic app icon PNG could not be decoded".to_string())?;
    let application = NSApplication::sharedApplication(mtm);
    unsafe {
        application.setApplicationIconImage(Some(&image));
    }
    Ok(())
}

#[tauri::command]
pub async fn set_dynamic_app_icon(app: AppHandle, icon_bytes: Vec<u8>) -> Result<(), String> {
    validate_png(&icon_bytes)?;

    #[cfg(target_os = "macos")]
    {
        app.run_on_main_thread(move || {
            if let Err(error) = set_macos_app_icon(icon_bytes) {
                eprintln!("dynamic app icon update failed: {error}");
            }
        })
        .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let image =
            tauri::image::Image::from_bytes(&icon_bytes).map_err(|error| error.to_string())?;
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "main window is unavailable".to_string())?;
        window.set_icon(image).map_err(|error| error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_png_signature() {
        assert_eq!(validate_png(PNG_SIGNATURE), Ok(()));
    }

    #[test]
    fn rejects_non_png_bytes() {
        assert_eq!(
            validate_png(b"not an icon"),
            Err("dynamic app icon must be a PNG image".to_string())
        );
    }
}
