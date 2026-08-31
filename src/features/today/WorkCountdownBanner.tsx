import type { WorkCountdownDisplay } from "./workCountdown";
import type { WorkSchedule } from "../../services/tauri/settings";
import { WorkhorseRunner } from "./WorkhorseRunner";
import { getWorkdayProgress } from "./workdayProgress";
import "./WorkCountdownBanner.css";

type WorkCountdownBannerProps = {
  display: WorkCountdownDisplay;
  schedule?: WorkSchedule | null;
};

export function WorkCountdownBanner({ display, schedule }: WorkCountdownBannerProps) {
  const parts = splitHms(display.countdownText);
  const progressState = schedule ? getWorkdayProgress(schedule, Date.now()) : null;

  return (
    <div className="work-countdown" aria-live="polite">
      <div className="work-countdown__heading">
        <div className="work-countdown__heading-row">
          <p className="work-countdown__kicker">
            <span className="work-countdown__live" aria-hidden="true" />
            LIVE / 距离释放
          </p>
          {progressState ? (
            <span className="work-countdown__percent">
              班味 {progressState.progress}%
            </span>
          ) : null}
        </div>
        <div className="work-countdown__alert-strip">
          <span className="work-countdown__alert-code">
            SYSTEM NOTICE / SHIFT RELEASE
          </span>
          <h2 className="work-countdown__headline">{display.primaryText}</h2>
        </div>
      </div>
      {parts ? (
        <div className="work-countdown__clock" aria-label={display.countdownText ?? undefined}>
          <div className="work-countdown__hours">
            <span className="work-countdown__digit work-countdown__digit--hours">{parts[0]}</span>
            <span className="work-countdown__unit-label">时</span>
          </div>
          <div className="work-countdown__stack">
            <ClockUnit value={parts[1]} label="分" />
            <ClockUnit value={parts[2]} label="秒" />
          </div>
        </div>
      ) : null}
      {schedule && progressState ? (
        <div className="work-countdown__progress">
          <div
            className="work-countdown__track"
            role="progressbar"
            aria-label="今日工作进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressState.progress}
          >
            <span
              className="work-countdown__fill"
              style={{ width: `${progressState.progress}%` }}
            />
            <span className="work-countdown__finish" aria-hidden="true">下班</span>
            <WorkhorseRunner
              progress={progressState.progress}
              mood={progressState.mood}
              moodMark={progressState.moodMark}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ClockUnit({ value, label }: { value: string; label: string }) {
  return (
    <div className="work-countdown__unit">
      <span className="work-countdown__digit">{value}</span>
      <span className="work-countdown__unit-label">{label}</span>
    </div>
  );
}

function splitHms(value: string | null): [string, string, string] | null {
  if (!value) {
    return null;
  }
  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return [match[1], match[2], match[3]];
}
