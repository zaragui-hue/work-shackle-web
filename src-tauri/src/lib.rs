mod commands;
mod db;
mod errors;
mod services;
mod time;

use commands::{
    get_workspace_status, initialize_app, resolve_default_workspace_path,
    set_workspace_path_command, validate_workspace_candidate, AppState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            initialize_app,
            get_workspace_status,
            validate_workspace_candidate,
            set_workspace_path_command,
            resolve_default_workspace_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
