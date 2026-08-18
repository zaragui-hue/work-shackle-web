use std::fmt;

use tauri::{AppHandle, Manager, Runtime, WebviewWindow};

use super::reminder_attention::MAIN_WINDOW_LABEL;

pub trait FocusableMainWindow {
    fn show(&self) -> Result<(), String>;
    fn unminimize(&self) -> Result<(), String>;
    fn set_focus(&self) -> Result<(), String>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FocusMainWindowError {
    Missing,
    Show(String),
    Unminimize(String),
    Focus(String),
}

impl fmt::Display for FocusMainWindowError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Missing => {
                write!(formatter, "main window '{MAIN_WINDOW_LABEL}' not found")
            }
            Self::Show(error) => write!(formatter, "show failed: {error}"),
            Self::Unminimize(error) => write!(formatter, "unminimize failed: {error}"),
            Self::Focus(error) => write!(formatter, "focus failed: {error}"),
        }
    }
}

impl<R: Runtime> FocusableMainWindow for WebviewWindow<R> {
    fn show(&self) -> Result<(), String> {
        WebviewWindow::show(self).map_err(|error| error.to_string())
    }

    fn unminimize(&self) -> Result<(), String> {
        WebviewWindow::unminimize(self).map_err(|error| error.to_string())
    }

    fn set_focus(&self) -> Result<(), String> {
        WebviewWindow::set_focus(self).map_err(|error| error.to_string())
    }
}

pub fn focus_existing_main_window<W: FocusableMainWindow>(
    window: Option<&W>,
) -> Result<(), FocusMainWindowError> {
    let window = window.ok_or(FocusMainWindowError::Missing)?;
    let mut first_error = None;

    if let Err(error) = window.show() {
        first_error.get_or_insert(FocusMainWindowError::Show(error));
    }
    if let Err(error) = window.unminimize() {
        first_error.get_or_insert(FocusMainWindowError::Unminimize(error));
    }
    if let Err(error) = window.set_focus() {
        first_error.get_or_insert(FocusMainWindowError::Focus(error));
    }

    match first_error {
        Some(error) => Err(error),
        None => Ok(()),
    }
}

pub fn handle_second_instance<R: Runtime>(app: &AppHandle<R>) {
    let window = app.get_webview_window(MAIN_WINDOW_LABEL);
    if let Err(error) = focus_existing_main_window(window.as_ref()) {
        eprintln!("single-instance: failed to focus main window '{MAIN_WINDOW_LABEL}': {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::reminder_window::REMINDER_WINDOW_LABEL;
    use std::sync::Mutex;

    #[derive(Default)]
    struct RecordingWindow {
        shown: Mutex<usize>,
        unminimized: Mutex<usize>,
        focused: Mutex<usize>,
        fail_show: Mutex<bool>,
        fail_unminimize: Mutex<bool>,
        fail_focus: Mutex<bool>,
    }

    impl RecordingWindow {
        fn new() -> Self {
            Self::default()
        }

        fn counts(&self) -> (usize, usize, usize) {
            (
                *self.shown.lock().expect("shown"),
                *self.unminimized.lock().expect("unminimized"),
                *self.focused.lock().expect("focused"),
            )
        }
    }

    impl FocusableMainWindow for RecordingWindow {
        fn show(&self) -> Result<(), String> {
            *self.shown.lock().expect("shown") += 1;
            if *self.fail_show.lock().expect("fail_show") {
                return Err("show denied".to_string());
            }
            Ok(())
        }

        fn unminimize(&self) -> Result<(), String> {
            *self.unminimized.lock().expect("unminimized") += 1;
            if *self.fail_unminimize.lock().expect("fail_unminimize") {
                return Err("unminimize denied".to_string());
            }
            Ok(())
        }

        fn set_focus(&self) -> Result<(), String> {
            *self.focused.lock().expect("focused") += 1;
            if *self.fail_focus.lock().expect("fail_focus") {
                return Err("focus denied".to_string());
            }
            Ok(())
        }
    }

    #[test]
    fn second_instance_targets_main_window_not_reminder_window() {
        assert_eq!(MAIN_WINDOW_LABEL, "main");
        assert_ne!(MAIN_WINDOW_LABEL, REMINDER_WINDOW_LABEL);
        assert_eq!(REMINDER_WINDOW_LABEL, "ddl-reminder");
    }

    #[test]
    fn missing_main_window_does_not_panic() {
        let result = focus_existing_main_window::<RecordingWindow>(None);
        assert_eq!(result, Err(FocusMainWindowError::Missing));
    }

    #[test]
    fn hidden_main_window_is_shown_restored_and_focused() {
        let window = RecordingWindow::new();
        focus_existing_main_window(Some(&window)).expect("focus");
        assert_eq!(window.counts(), (1, 1, 1));
    }

    #[test]
    fn minimized_main_window_is_unminimized_and_focused() {
        let window = RecordingWindow::new();
        focus_existing_main_window(Some(&window)).expect("focus");
        let (_, unminimized, focused) = window.counts();
        assert_eq!(unminimized, 1);
        assert_eq!(focused, 1);
    }

    #[test]
    fn show_failure_does_not_panic_and_still_attempts_restore_and_focus() {
        let window = RecordingWindow::new();
        *window.fail_show.lock().expect("fail_show") = true;
        let result = focus_existing_main_window(Some(&window));
        assert_eq!(
            result,
            Err(FocusMainWindowError::Show("show denied".to_string()))
        );
        assert_eq!(window.counts(), (1, 1, 1));
    }

    #[test]
    fn unminimize_failure_does_not_panic_and_still_attempts_focus() {
        let window = RecordingWindow::new();
        *window.fail_unminimize.lock().expect("fail_unminimize") = true;
        let result = focus_existing_main_window(Some(&window));
        assert_eq!(
            result,
            Err(FocusMainWindowError::Unminimize(
                "unminimize denied".to_string()
            ))
        );
        assert_eq!(window.counts(), (1, 1, 1));
    }

    #[test]
    fn focus_failure_does_not_panic() {
        let window = RecordingWindow::new();
        *window.fail_focus.lock().expect("fail_focus") = true;
        let result = focus_existing_main_window(Some(&window));
        assert_eq!(
            result,
            Err(FocusMainWindowError::Focus("focus denied".to_string()))
        );
        assert_eq!(window.counts(), (1, 1, 1));
    }
}
