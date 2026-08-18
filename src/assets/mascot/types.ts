export const MASCOT_STATES = [
  "work-neutral",
  "meeting-empty",
  "fish-relax",
  "lunch-happy",
  "ddl-calm",
  "ddl-anxious",
  "ddl-panic",
  "ddl-due",
  "ddl-overdue",
  "overtime-dead-eyes",
  "offwork-run",
] as const;

export type MascotState = (typeof MASCOT_STATES)[number];

export const FALLBACK_MASCOT_STATE: MascotState = "work-neutral";

export type MascotSize = "sm" | "md" | "lg";

export type MascotAsset = {
  src: string;
  placeholder: boolean;
};

export function isMascotState(value: string): value is MascotState {
  return (MASCOT_STATES as readonly string[]).includes(value);
}
