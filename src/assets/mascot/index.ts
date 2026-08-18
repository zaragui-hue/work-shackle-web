import type { DdlEmotion } from "../../services/tauri/ddl";
import placeholderUrl from "./placeholder.svg";
import {
  FALLBACK_MASCOT_STATE,
  isMascotState,
  type MascotAsset,
  type MascotState,
} from "./types";

export {
  FALLBACK_MASCOT_STATE,
  isMascotState,
  MASCOT_STATES,
  type MascotAsset,
  type MascotSize,
  type MascotState,
} from "./types";

const placeholderAsset: MascotAsset = {
  src: placeholderUrl,
  placeholder: true,
};

export const MASCOT_ASSETS: Record<MascotState, MascotAsset> = {
  "work-neutral": placeholderAsset,
  "meeting-empty": placeholderAsset,
  "fish-relax": placeholderAsset,
  "lunch-happy": placeholderAsset,
  "ddl-calm": placeholderAsset,
  "ddl-anxious": placeholderAsset,
  "ddl-panic": placeholderAsset,
  "ddl-due": placeholderAsset,
  "ddl-overdue": placeholderAsset,
  "overtime-dead-eyes": placeholderAsset,
  "offwork-run": placeholderAsset,
};

const DDL_EMOTION_TO_MASCOT: Record<DdlEmotion, MascotState> = {
  calm: "ddl-calm",
  notice: "ddl-calm",
  anxious: "ddl-anxious",
  panic: "ddl-panic",
  burning: "ddl-due",
  overdue: "ddl-overdue",
};

const REMINDER_KIND_TO_MASCOT: Record<string, MascotState> = {
  ddl_60: "ddl-calm",
  ddl_30: "ddl-anxious",
  ddl_10: "ddl-panic",
  ddl_due: "ddl-due",
};

export function resolveMascotAsset(state: MascotState): MascotAsset {
  return MASCOT_ASSETS[state];
}

export function resolveMascotAssetOrFallback(state: string): MascotAsset {
  if (isMascotState(state)) {
    return MASCOT_ASSETS[state];
  }
  return MASCOT_ASSETS[FALLBACK_MASCOT_STATE];
}

export function mascotStateForDdlEmotion(emotion: DdlEmotion): MascotState {
  return DDL_EMOTION_TO_MASCOT[emotion];
}

export function mascotStateForReminderKind(reminderKind: string): MascotState {
  return REMINDER_KIND_TO_MASCOT[reminderKind] ?? FALLBACK_MASCOT_STATE;
}
