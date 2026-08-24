import type { CSSProperties } from "react";
import spriteUrl from "../../assets/mascot/workhorse/workhorse-running-sprite-v1.png";
import type { WorkdayMood } from "./workdayProgress";
import "./WorkhorseRunner.css";

export function WorkhorseRunner({
  progress,
  mood,
  moodMark,
}: {
  progress: number;
  mood: WorkdayMood;
  moodMark: string;
}) {
  const position = Math.max(0, Math.min(100, progress));
  return (
    <span
      className="workhorse-runner"
      data-mood={mood}
      data-stopped={position >= 100 ? "true" : undefined}
      style={{
        left: `${position}%`,
        "--workhorse-shift": `-${position}%`,
      } as CSSProperties}
      aria-hidden="true"
    >
      <span className="workhorse-runner__mood">{moodMark}</span>
      <span
        className="workhorse-runner__sprite"
        style={{ backgroundImage: `url(${spriteUrl})` }}
      />
    </span>
  );
}
