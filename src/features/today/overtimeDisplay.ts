import { formatHmsCountdown } from "./workCountdown";

export type OvertimeDisplay = {
  elapsedText: string;
};

export function computeOvertimeDisplay(startAtMs: number, nowMs: number): OvertimeDisplay {
  const elapsedMs = Math.max(0, nowMs - startAtMs);
  return {
    elapsedText: formatHmsCountdown(elapsedMs),
  };
}
