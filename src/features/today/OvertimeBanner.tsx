import { Button, Mascot } from "../../shared/ui";
import "./OvertimeBanner.css";

type OvertimeBannerProps = {
  elapsedText: string;
  onEnd: () => void;
  ending?: boolean;
};

export function OvertimeBanner({
  elapsedText,
  onEnd,
  ending = false,
}: OvertimeBannerProps) {
  return (
    <div className="overtime-banner" role="status" aria-live="polite">
      <div className="overtime-banner__content">
        <Mascot
          state="overtime-dead-eyes"
          size="sm"
          className="overtime-banner__mascot"
        />
        <div className="overtime-banner__text">
          <p className="overtime-banner__title">加班模式</p>
          <p className="overtime-banner__label">已加班</p>
          <p className="overtime-banner__timer" aria-label={`已加班 ${elapsedText}`}>
            {elapsedText}
          </p>
        </div>
      </div>
      <div className="overtime-banner__actions">
        <Button variant="secondary" onClick={onEnd} disabled={ending}>
          {ending ? "结束中…" : "结束加班"}
        </Button>
      </div>
    </div>
  );
}
