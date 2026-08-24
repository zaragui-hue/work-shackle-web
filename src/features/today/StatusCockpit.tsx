import type { ReactNode } from "react";

import type { WorkSchedule } from "../../services/tauri/settings";
import { Mascot } from "../../shared/ui";
import { WorkStatusPanel } from "./WorkStatusPanel";
import { useWorkStatus } from "./WorkStatusContext";
import { getWorkdayProgress } from "./workdayProgress";
import { getWorkStatusReaction } from "./workStatusReaction";
import "./StatusCockpit.css";

export function StatusCockpit({
  schedule,
  children,
}: {
  schedule?: WorkSchedule | null;
  children: ReactNode;
}) {
  const { current, loading } = useWorkStatus();
  const progress = schedule ? getWorkdayProgress(schedule, Date.now()) : null;
  const reaction = current
    ? getWorkStatusReaction(current, progress?.mood)
    : null;

  return (
    <div className="status-cockpit">
      <section className="status-cockpit__work" aria-label="下班倒计时">
        {children}
      </section>
      <aside className="status-cockpit__reaction" aria-label="当前工作状态">
        <div className="status-cockpit__status-row">
          <span>当前精神档位</span>
          <WorkStatusPanel variant="stage" />
        </div>
        {loading || !current || !reaction ? (
          <div className="status-cockpit__reaction-skeleton" aria-label="读取当前状态" />
        ) : (
          <div className="status-cockpit__meme">
            <span className="status-cockpit__meme-mark" aria-hidden="true">
              {reaction.memeMark}
            </span>
            <Mascot
              state={reaction.mascot}
              animation={reaction.animation}
              size="lg"
              className="status-cockpit__mascot"
            />
            <div
              key={`${current.statusType}-${current.startAtMs}`}
              className="status-cockpit__speech"
            >
              <strong>{current.emoji} {current.name}</strong>
              <p>{reaction.copy}</p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
