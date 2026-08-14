import type { ReactNode } from "react";
import { useEffect } from "react";
import "./Drawer.css";

type DrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Drawer({ open, title, onClose, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ws-drawer" role="presentation">
      <button
        type="button"
        className="ws-drawer__backdrop"
        aria-label="关闭抽屉"
        onClick={onClose}
      />
      <aside
        className="ws-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-drawer-title"
      >
        <header className="ws-drawer__header">
          <h2 id="ws-drawer-title">{title}</h2>
          <button type="button" className="ws-drawer__close" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="ws-drawer__body">{children}</div>
      </aside>
    </div>
  );
}
