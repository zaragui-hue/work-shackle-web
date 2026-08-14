import type { WorkCountdownDisplay } from "./workCountdown";
import "./WorkCountdownBanner.css";

type WorkCountdownBannerProps = {
  display: WorkCountdownDisplay;
};

export function WorkCountdownBanner({ display }: WorkCountdownBannerProps) {
  if (display.phase === "working" && display.countdownText) {
    return (
      <div className="work-countdown" aria-live="polite">
        <p className="work-countdown__text">
          {display.primaryText}{" "}
          <span className="work-countdown__time">{display.countdownText}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="work-countdown" aria-live="polite">
      <p className="work-countdown__text">{display.primaryText}</p>
    </div>
  );
}
