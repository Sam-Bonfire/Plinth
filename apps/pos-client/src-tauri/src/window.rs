use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq, Default)]
pub enum WindowMode {
    #[default]
    Windowed,
    Fullscreen,
    Kiosk { exit_pin: String },
}

pub struct WindowMachine {
    pub mode: WindowMode,
}

impl Default for WindowMachine {
    fn default() -> Self {
        Self::new()
    }
}

impl WindowMachine {
    #[must_use]
    pub fn new() -> Self {
        Self {
            mode: WindowMode::default(),
        }
    }

    /// Transitions to kiosk mode.
    ///
    /// # Errors
    ///
    /// Returns an error if the pin is empty or if already in kiosk mode.
    pub fn enter_kiosk(&mut self, pin: String) -> Result<(), String> {
        if pin.trim().is_empty() {
            return Err("PIN cannot be empty".into());
        }

        if let WindowMode::Kiosk { .. } = self.mode {
            return Err("Already in Kiosk mode".into());
        }

        self.mode = WindowMode::Kiosk { exit_pin: pin };
        Ok(())
    }

    /// Transitions out of kiosk mode.
    ///
    /// # Errors
    ///
    /// Returns an error if not in kiosk mode, or if the provided pin does not match.
    pub fn exit_kiosk(&mut self, pin: &str) -> Result<(), String> {
        match &self.mode {
            WindowMode::Kiosk { exit_pin } => {
                if exit_pin != pin {
                    return Err("Invalid PIN".into());
                }
                self.mode = WindowMode::Windowed;
                Ok(())
            }
            _ => Err("Not in Kiosk mode".into()),
        }
    }

    /// Toggles fullscreen mode.
    /// If in kiosk mode, returns an error.
    ///
    /// # Errors
    ///
    /// Returns an error if the application is currently in kiosk mode.
    pub fn toggle_fullscreen(&mut self) -> Result<WindowMode, String> {
        match self.mode {
            WindowMode::Kiosk { .. } => Err("Cannot toggle fullscreen in Kiosk mode".into()),
            WindowMode::Windowed => {
                self.mode = WindowMode::Fullscreen;
                Ok(self.mode.clone())
            }
            WindowMode::Fullscreen => {
                self.mode = WindowMode::Windowed;
                Ok(self.mode.clone())
            }
        }
    }
}

/// Enters kiosk mode, locking the window to fullscreen and always on top.
///
/// # Errors
///
/// Returns an error if the pin is empty or if already in kiosk mode.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn enter_kiosk(
    window: tauri::Window,
    state: tauri::State<'_, std::sync::Mutex<WindowMachine>>,
    pin: &str,
) -> Result<(), String> {
    let mut machine = state.lock().map_err(|_| "Failed to lock state")?;
    machine.enter_kiosk(pin.to_string())?;

    window.set_fullscreen(true).map_err(|e| e.to_string())?;
    window.set_always_on_top(true).map_err(|e| e.to_string())?;

    Ok(())
}

/// Exits kiosk mode, restoring the window to standard state.
///
/// # Errors
///
/// Returns an error if not in kiosk mode, or if the provided pin does not match.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn exit_kiosk(
    window: tauri::Window,
    state: tauri::State<'_, std::sync::Mutex<WindowMachine>>,
    pin: &str,
) -> Result<(), String> {
    let mut machine = state.lock().map_err(|_| "Failed to lock state")?;
    machine.exit_kiosk(pin)?;

    window.set_fullscreen(false).map_err(|e| e.to_string())?;
    window.set_always_on_top(false).map_err(|e| e.to_string())?;

    Ok(())
}

/// Toggles the window fullscreen state.
///
/// # Errors
///
/// Returns an error if the application is currently in kiosk mode.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn toggle_fullscreen(
    window: tauri::Window,
    state: tauri::State<'_, std::sync::Mutex<WindowMachine>>,
) -> Result<(), String> {
    let mut machine = state.lock().map_err(|_| "Failed to lock state")?;
    let new_mode = machine.toggle_fullscreen()?;

    match new_mode {
        WindowMode::Fullscreen => {
            window.set_fullscreen(true).map_err(|e| e.to_string())?;
        }
        WindowMode::Windowed => {
            window.set_fullscreen(false).map_err(|e| e.to_string())?;
        }
        WindowMode::Kiosk { .. } => unreachable!(),
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let machine = WindowMachine::new();
        assert_eq!(machine.mode, WindowMode::Windowed);
    }

    #[test]
    fn test_enter_kiosk_valid_pin() {
        let mut machine = WindowMachine::new();
        let res = machine.enter_kiosk("1234".to_string());
        assert!(res.is_ok());
        assert_eq!(
            machine.mode,
            WindowMode::Kiosk {
                exit_pin: "1234".to_string()
            }
        );
    }

    #[test]
    fn test_enter_kiosk_empty_pin() {
        let mut machine = WindowMachine::new();
        let res = machine.enter_kiosk("   ".to_string());
        assert!(res.is_err());
        assert_eq!(machine.mode, WindowMode::Windowed);
    }

    #[test]
    fn test_enter_kiosk_already_in_kiosk() {
        let mut machine = WindowMachine::new();
        machine.enter_kiosk("1234".to_string()).unwrap();
        let res = machine.enter_kiosk("5678".to_string());
        assert!(res.is_err());
        assert_eq!(
            machine.mode,
            WindowMode::Kiosk {
                exit_pin: "1234".to_string()
            }
        );
    }

    #[test]
    fn test_exit_kiosk_valid_pin() {
        let mut machine = WindowMachine::new();
        machine.enter_kiosk("1234".to_string()).unwrap();
        let res = machine.exit_kiosk("1234");
        assert!(res.is_ok());
        assert_eq!(machine.mode, WindowMode::Windowed);
    }

    #[test]
    fn test_exit_kiosk_invalid_pin() {
        let mut machine = WindowMachine::new();
        machine.enter_kiosk("1234".to_string()).unwrap();
        let res = machine.exit_kiosk("9999");
        assert!(res.is_err());
        assert_eq!(
            machine.mode,
            WindowMode::Kiosk {
                exit_pin: "1234".to_string()
            }
        );
    }

    #[test]
    fn test_exit_kiosk_not_in_kiosk() {
        let mut machine = WindowMachine::new();
        let res = machine.exit_kiosk("1234");
        assert!(res.is_err());
        assert_eq!(machine.mode, WindowMode::Windowed);
    }

    #[test]
    fn test_toggle_fullscreen() {
        let mut machine = WindowMachine::new();

        let res = machine.toggle_fullscreen();
        assert!(res.is_ok());
        assert_eq!(machine.mode, WindowMode::Fullscreen);

        let res = machine.toggle_fullscreen();
        assert!(res.is_ok());
        assert_eq!(machine.mode, WindowMode::Windowed);
    }

    #[test]
    fn test_toggle_fullscreen_in_kiosk() {
        let mut machine = WindowMachine::new();
        machine.enter_kiosk("1234".to_string()).unwrap();

        let res = machine.toggle_fullscreen();
        assert!(res.is_err());
        assert_eq!(
            machine.mode,
            WindowMode::Kiosk {
                exit_pin: "1234".to_string()
            }
        );
    }
}
