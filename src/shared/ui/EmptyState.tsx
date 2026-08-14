import type { ReactNode } from "react";
import mascotUrl from "../../assets/mascot/placeholder.svg";
import "./EmptyState.css";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="ws-empty">
      <img
        className="ws-empty__mascot"
        src={mascotUrl}
        alt=""
        width={96}
        height={96}
      />
      <h3 className="ws-empty__title">{title}</h3>
      <p className="ws-empty__desc">{description}</p>
      {action ? <div className="ws-empty__action">{action}</div> : null}
    </div>
  );
}
