import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import App from "./App";
import { ReminderWindowApp } from "./pages/ReminderWindowApp";
import { REMINDER_WINDOW_LABEL } from "./services/tauri/reminder";
import "./styles/tokens.css";
import "./styles/base.css";

function resolveRootComponent() {
  try {
    if (getCurrentWebviewWindow().label === REMINDER_WINDOW_LABEL) {
      return ReminderWindowApp;
    }
  } catch {
    // Browser preview falls back to the main app shell.
  }
  return App;
}

const RootComponent = resolveRootComponent();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>,
);
