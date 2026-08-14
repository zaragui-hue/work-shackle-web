mod commands;
mod db;
mod errors;
mod services;
mod time;

use commands::{
    cancel_task, complete_task, create_contact, create_task, deactivate_contact, get_task_by_id,
    get_task_detail, get_workspace_status, initialize_app, list_contacts, postpone_task,
    query_tasks, query_today_tasks, resolve_default_workspace_path, set_workspace_path_command,
    update_task, validate_workspace_candidate, AppState,
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
            create_task,
            update_task,
            get_task_by_id,
            get_task_detail,
            query_tasks,
            query_today_tasks,
            complete_task,
            cancel_task,
            postpone_task,
            list_contacts,
            create_contact,
            deactivate_contact,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
