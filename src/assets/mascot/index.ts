import type { DdlEmotion } from "../../services/tauri/ddl";
import professionalSmileUrl from "./workhorse/reactions/professional-smile-v2.png";
import powerDownUrl from "./workhorse/reactions/power-down-v1.png";
import panicUrl from "./workhorse/reactions/panic-v2.png";
import overtimeStoneUrl from "./workhorse/reactions/overtime-stone-v2.png";
import {
  FALLBACK_MASCOT_ANIMATION,
  FALLBACK_MASCOT_STATE,
  isMascotAnimation,
  isMascotState,
  type MascotAnimation,
  type MascotAsset,
  type MascotState,
} from "./types";

export {
  FALLBACK_MASCOT_ANIMATION,
  FALLBACK_MASCOT_STATE,
  isMascotAnimation,
  isMascotState,
  MASCOT_ANIMATIONS,
  MASCOT_STATES,
  type MascotAnimation,
  type MascotAsset,
  type MascotSize,
  type MascotState,
} from "./types";

const professionalAsset: MascotAsset = { src: professionalSmileUrl, placeholder: false };
const powerDownAsset: MascotAsset = { src: powerDownUrl, placeholder: false };
const panicAsset: MascotAsset = { src: panicUrl, placeholder: false };
const overtimeAsset: MascotAsset = { src: overtimeStoneUrl, placeholder: false };

export const MASCOT_ASSETS: Record<MascotState, MascotAsset> = {
  "work-neutral": professionalAsset,
  "meeting-empty": powerDownAsset,
  "fish-relax": powerDownAsset,
  "lunch-happy": professionalAsset,
  "ddl-calm": professionalAsset,
  "ddl-anxious": powerDownAsset,
  "ddl-panic": panicAsset,
  "ddl-due": panicAsset,
  "ddl-overdue": overtimeAsset,
  "overtime-dead-eyes": overtimeAsset,
  "offwork-run": professionalAsset,
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
  progress_half: "ddl-calm",
  quarter_remaining: "ddl-anxious",
  one_hour_remaining: "ddl-panic",
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

const WORK_STATUS_TO_MASCOT: Record<string, MascotState> = {
  working: "work-neutral",
  focus_brick: "work-neutral",
  meeting: "meeting-empty",
  urgent_insert: "work-neutral",
  chased_by_requirements: "offwork-run",
  slacking: "fish-relax",
  gossip: "fish-relax",
  drinking: "fish-relax",
  lunch: "lunch-happy",
  nap: "fish-relax",
  daydream: "meeting-empty",
  preparing_leave: "offwork-run",
  overtime: "overtime-dead-eyes",
};

export function mascotStateForWorkStatus(statusType: string): MascotState {
  return WORK_STATUS_TO_MASCOT[statusType] ?? FALLBACK_MASCOT_STATE;
}

const DDL_EMOTION_TO_ANIMATION: Record<DdlEmotion, MascotAnimation> = {
  calm: "breathe",
  notice: "breathe",
  anxious: "shake",
  panic: "panic",
  burning: "angry",
  overdue: "angry",
};

const REMINDER_KIND_TO_ANIMATION: Record<string, MascotAnimation> = {
  progress_half: "breathe",
  quarter_remaining: "shake",
  one_hour_remaining: "panic",
  ddl_60: "breathe",
  ddl_30: "shake",
  ddl_10: "panic",
  ddl_due: "angry",
  custom: "breathe",
};

const WORK_STATUS_TO_ANIMATION: Record<string, MascotAnimation> = {
  working: "breathe",
  focus_brick: "breathe",
  meeting: "breathe",
  urgent_insert: "breathe",
  chased_by_requirements: "run",
  slacking: "breathe",
  gossip: "breathe",
  drinking: "breathe",
  lunch: "breathe",
  nap: "breathe",
  daydream: "breathe",
  preparing_leave: "run",
  overtime: "none",
};

export function mascotAnimationForDdlEmotion(
  emotion: DdlEmotion,
): MascotAnimation {
  return DDL_EMOTION_TO_ANIMATION[emotion] ?? FALLBACK_MASCOT_ANIMATION;
}

export function mascotAnimationForReminderKind(
  reminderKind: string,
): MascotAnimation {
  return REMINDER_KIND_TO_ANIMATION[reminderKind] ?? FALLBACK_MASCOT_ANIMATION;
}

export function mascotAnimationForWorkStatus(
  statusType: string,
): MascotAnimation {
  return WORK_STATUS_TO_ANIMATION[statusType] ?? FALLBACK_MASCOT_ANIMATION;
}

export function resolveMascotAnimationOrFallback(
  animation: string,
): MascotAnimation {
  if (isMascotAnimation(animation)) {
    return animation;
  }
  return FALLBACK_MASCOT_ANIMATION;
}
