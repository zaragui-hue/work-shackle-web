import { useEffect, useState } from "react";

import {
  mascotAnimationForDdlEmotion,
  mascotStateForDdlEmotion,
} from "../../assets/mascot";
import { Mascot } from "../../shared/ui";
import {
  formatOverdueDuration,
  formatRemainingUntilDeadline,
} from "./todayDisplay";
import {
  ddlEmotionLabel,
  ddlProgressFillPercent,
  formatTimeElapsedCopy,
} from "./ddlProgressDisplay";
import { useDdlProgress } from "./useDdlProgress";
import "./DdlTimeProgress.css";

type DdlTimeProgressProps = {
  plannedAtMs: number;
  deadlineAtMs?: number;
  showRemaining?: boolean;
  showMeta?: boolean;
  presentation?: "full" | "remaining-only";
};

export function DdlTimeProgress({
  plannedAtMs,
  deadlineAtMs,
  showRemaining = true,
  showMeta = true,
  presentation = "full",
}: DdlTimeProgressProps) {
  const progress = useDdlProgress(plannedAtMs, deadlineAtMs);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!showRemaining || deadlineAtMs == null) {
      return;
    }

    const tick = () => {
      setNowMs(Date.now());
    };

    tick();
    const intervalId = window.setInterval(tick, 1_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [deadlineAtMs, showRemaining]);

  if (deadlineAtMs == null) {
    return null;
  }

  const isOverdue = progress?.isOverdue ?? deadlineAtMs <= nowMs;
  const remainingText = isOverdue
    ? formatOverdueDuration(deadlineAtMs, nowMs)
    : formatRemainingUntilDeadline(deadlineAtMs, nowMs);

  if (presentation === "remaining-only") {
    return (
      <span
        className="ddl-time-progress__remaining-inline"
        data-testid="ddl-remaining-inline"
      >
        {remainingText}
      </span>
    );
  }

  if (progress == null) {
    return null;
  }

  const fillPercent = ddlProgressFillPercent(progress.progressRatio);

  return (
    <div
      className={`ddl-time-progress ddl-time-progress--${progress.emotion}`}
    >
      <div
        className="ddl-time-progress__track"
        role="progressbar"
        aria-label="时间进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fillPercent)}
      >
        <div
          className="ddl-time-progress__fill"
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      {showMeta ? (
        <div className="ddl-time-progress__meta">
          <Mascot
            state={mascotStateForDdlEmotion(progress.emotion)}
            animation={mascotAnimationForDdlEmotion(progress.emotion)}
            size="sm"
            className="ddl-time-progress__mascot"
          />
          <p className="ddl-time-progress__copy">
            {formatTimeElapsedCopy(progress.progressRatio)}
          </p>
          <p className="ddl-time-progress__emotion">
            {ddlEmotionLabel(progress.emotion)}
          </p>
        </div>
      ) : null}
      {showRemaining && remainingText ? (
        <p className="ddl-time-progress__remaining">{remainingText}</p>
      ) : null}
    </div>
  );
}
