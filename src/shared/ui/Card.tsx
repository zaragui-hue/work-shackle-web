import type { ReactNode } from "react";
import "./Card.css";

type CardProps = {
  title?: string;
  headerAccent?: boolean;
  children: ReactNode;
  className?: string;
};

export function Card({
  title,
  headerAccent = false,
  children,
  className = "",
}: CardProps) {
  return (
    <section className={`ws-card ${className}`.trim()}>
      {title ? (
        <header
          className={`ws-card__header${headerAccent ? " ws-card__header--accent" : ""}`}
        >
          <h2 className="ws-card__title">{title}</h2>
        </header>
      ) : null}
      <div className="ws-card__body">{children}</div>
    </section>
  );
}
