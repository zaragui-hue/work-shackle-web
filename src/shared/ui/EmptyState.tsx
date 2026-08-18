import type { ReactNode } from "react";
import { Mascot } from "./Mascot";
import "./EmptyState.css";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="ws-empty">
      <Mascot state="fish-relax" size="md" className="ws-empty__mascot" />
      <h3 className="ws-empty__title">{title}</h3>
      <p className="ws-empty__desc">{description}</p>
      {action ? <div className="ws-empty__action">{action}</div> : null}
    </div>
  );
}
