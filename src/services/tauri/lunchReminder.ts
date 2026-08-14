import { invoke } from "@tauri-apps/api/core";

export type LunchReminder = {
  message: string;
  reminderDate: string;
  lunchStart: string;
  lunchEnd: string;
};

export async function checkLunchReminder(): Promise<LunchReminder | null> {
  return invoke<LunchReminder | null>("check_lunch_reminder");
}
