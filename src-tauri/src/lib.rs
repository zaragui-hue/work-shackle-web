mod commands;
mod db;
mod errors;
mod services;
mod time;

use commands::{
    cancel_task, check_lunch_reminder, clear_today_work_override, complete_task,
    confirm_normal_off_work, create_contact, create_task, deactivate_contact, end_overtime,
    get_active_overtime, get_current_work_status, get_lunch_schedule, get_task_by_id,
    get_task_detail, get_work_end_state, get_work_schedule, get_workspace_status, initialize_app,
    list_contacts, list_status_copies, list_work_statuses, postpone_task, query_tasks,
    query_today_tasks, resolve_default_workspace_path, save_default_work_times, save_lunch_times,
    save_status_copy, save_today_work_override, set_workspace_path_command, start_overtime,
    switch_work_status, update_task, validate_workspace_candidate, AppState,
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
            get_work_schedule,
            save_default_work_times,
            save_today_work_override,
            clear_today_work_override,
            get_lunch_schedule,
            save_lunch_times,
            check_lunch_reminder,
            get_work_end_state,
            confirm_normal_off_work,
            get_active_overtime,
            start_overtime,
            end_overtime,
            list_work_statuses,
            get_current_work_status,
            switch_work_status,
            list_status_copies,
            save_status_copy,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
