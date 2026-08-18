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
          <p className="work-end-decision__title">理论下班时间到</p>
          <p className="work-end-decision__message">
            今天的正常打工时间结束了。
          </p>
        </div>
      </div>
      <div className="work-end-decision__actions">
        <Button
          onClick={onConfirmNormalOff}
          disabled={confirmingNormalOff}
        >
          {confirmingNormalOff ? "确认中…" : "正常下班"}
        </Button>
        <Button variant="secondary" onClick={onStartOvertime} disabled={startingOvertime}>
          {startingOvertime ? "开启中…" : "开启加班模式"}
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
          <p className="work-end-decision__title">今天的工作到此为止</p>
          <p className="work-end-decision__message">{message}</p>
        </div>
      </div>
    </div>
  );
}
