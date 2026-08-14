import type { ReactNode } from "react";
import { useEffect } from "react";
import "./Modal.css";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
};

export function Modal({ open, title, onClose, children, footer, wide = false }: ModalProps) {
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
    <div className="ws-modal" role="presentation">
      <button
        type="button"
        className="ws-modal__backdrop"
        aria-label="关闭弹层"
        onClick={onClose}
      />
      <div
        className={`ws-modal__panel${wide ? " ws-modal__panel--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-modal-title"
      >
        <header className="ws-modal__header">
          <h2 id="ws-modal-title">{title}</h2>
        </header>
        <div className="ws-modal__body">{children}</div>
        {footer ? <footer className="ws-modal__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
