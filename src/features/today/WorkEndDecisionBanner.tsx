import { copy } from "../../config/copy";
import { Button, Mascot } from "../../shared/ui";
import "./WorkEndDecisionBanner.css";

type WorkEndDecisionBannerProps = {
  onConfirmNormalOff: () => void;
  onStartOvertime: () => void;
  confirmingNormalOff?: boolean;
  startingOvertime?: boolean;
};

export function WorkEndDecisionBanner({
  onConfirmNormalOff,
  onStartOvertime,
  confirmingNormalOff = false,
  startingOvertime = false,
}: WorkEndDecisionBannerProps) {
  return (
    <div className="work-end-decision" role="status" aria-live="polite">
      <div className="work-end-decision__content">
        <Mascot
          state="offwork-run"
          animation="run"
          size="sm"
          className="work-end-decision__mascot"
        />
        <div className="work-end-decision__text">
          <p className="work-end-decision__title">{copy.workEnd.decisionTitle}</p>
          <p className="work-end-decision__message">
            {copy.workEnd.decisionMessage}
          </p>
        </div>
      </div>
      <div className="work-end-decision__actions">
        <Button
          onClick={onConfirmNormalOff}
          disabled={confirmingNormalOff}
        >
          {confirmingNormalOff ? "确认中…" : copy.workEnd.confirmOff}
        </Button>
        <Button variant="secondary" onClick={onStartOvertime} disabled={startingOvertime}>
          {startingOvertime ? "开启中…" : copy.workEnd.startOvertime}
        </Button>
      </div>
    </div>
  );
}

type WorkOffCompleteBannerProps = {
  message: string;
};

export function WorkOffCompleteBanner({ message }: WorkOffCompleteBannerProps) {
  return (
    <div className="work-end-decision work-end-decision--complete" role="status">
      <div className="work-end-decision__content">
        <Mascot
          state="offwork-run"
          animation="run"
          size="sm"
          className="work-end-decision__mascot"
        />
        <div className="work-end-decision__text">
          <p className="work-end-decision__title">{copy.workEnd.completeTitle}</p>
          <p className="work-end-decision__message">{message}</p>
        </div>
      </div>
    </div>
  );
}
