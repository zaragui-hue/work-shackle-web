import { invoke } from "@tauri-apps/api/core";

export type ActiveOvertime = {
  id: string;
  workDate: string;
  startAtMs: number;
  autoEndAtMs: number;
};

export async function getActiveOvertime(): Promise<ActiveOvertime | null> {
  return invoke<ActiveOvertime | null>("get_active_overtime");
}

export async function startOvertime(): Promise<ActiveOvertime> {
  return invoke<ActiveOvertime>("start_overtime");
}

export async function endOvertime(): Promise<void> {
  return invoke<void>("end_overtime");
}
