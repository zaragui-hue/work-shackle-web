import type { WorkSchedule } from "../../services/tauri/settings";
import type { MascotState } from "../../assets/mascot";
import { Mascot } from "../../shared/ui";
import { getWorkdayProgress } from "./workdayProgress";
import "./WorkdayBrief.css";

export function WorkdayBrief({ schedule }: { schedule: WorkSchedule }) {
  const state = getWorkdayProgress(schedule, Date.now());

  return (
    <aside className="workday-brief" aria-label="当前上班阶段">
      <div className="workday-brief__meta">
        <span className="workday-brief__index">{String(state.progress).padStart(2, "0")}%</span>
        <span className="workday-brief__label">人还在线</span>
      </div>
      <div>
        <p className="workday-brief__eyebrow">今日精神广播</p>
        <h2 className="workday-brief__headline">{state.headline}</h2>
      </div>
      <div className="workday-brief__reaction">
        <Mascot
          state={reactionForMood(state.mood)}
          size="sm"
          className="workday-brief__mascot"
        />
        <p className="workday-brief__encouragement">{state.encouragement}</p>
      </div>
      <span className="workday-brief__stamp" aria-hidden="true">{state.label}</span>
    </aside>
  );
}

function reactionForMood(mood: ReturnType<typeof getWorkdayProgress>["mood"]): MascotState {
  if (mood === "drained") return "ddl-anxious";
  if (mood === "offwork") return "offwork-run";
  if (mood === "sprint") return "work-neutral";
  if (mood === "power-save") return "fish-relax";
  return "work-neutral";
}
