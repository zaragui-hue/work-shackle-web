import type { ReactNode } from "react";
import "./StartupPanel.css";

export function StartupPanel({ title, copy, children, tone }: { title: string; copy: string; children?: ReactNode; tone?: "danger" }) {
  return (
    <main className="web-startup">
      <section className={`web-startup__card${tone ? ` web-startup__card--${tone}` : ""}`}>
        <header className="web-startup__brand">
          <span className="web-startup__logo" aria-hidden="true">WS</span>
          <div><strong>精神状态事务所</strong><small>OFFICE SURVIVAL SYSTEM</small></div>
        </header>
        <div className="web-startup__body">
          <span className="kicker">LOCAL WEB / DATA SAFE</span>
          <div className="web-startup__stamp" aria-hidden="true">档案<br />待接入</div>
          <h1>{title}</h1>
          <p>{copy}</p>
          {children ? <div className="web-startup__actions">{children}</div> : null}
        </div>
      </section>
    </main>
  );
}
