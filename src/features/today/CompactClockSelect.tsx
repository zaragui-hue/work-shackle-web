import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import "./CompactClockSelect.css";

type CompactClockSelectProps = {
  label: string;
  value: string;
  values: readonly string[];
  disabled?: boolean;
  onSelect: (value: string) => void;
};

export function CompactClockSelect({
  label,
  value,
  values,
  disabled = false,
  onSelect,
}: CompactClockSelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const activeOptionRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, values.indexOf(value)),
  );

  const close = () => setOpen(false);
  const openAtCurrentValue = () => {
    setActiveIndex(Math.max(0, values.indexOf(value)));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    activeOptionRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (disabled) close();
  }, [disabled]);

  useEffect(() => {
    setActiveIndex(Math.max(0, values.indexOf(value)));
    close();
  }, [value, values]);

  const selectActiveValue = () => {
    const nextValue = values[activeIndex];
    if (nextValue !== undefined) onSelect(nextValue);
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (!open) {
        const currentIndex = Math.max(0, values.indexOf(value));
        setActiveIndex(Math.min(values.length - 1, Math.max(0, currentIndex + direction)));
        setOpen(true);
      } else {
        setActiveIndex((current) =>
          Math.min(values.length - 1, Math.max(0, current + direction)),
        );
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) selectActiveValue();
      else openAtCurrentValue();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") close();
  };

  return (
    <div className="compact-clock-select" ref={rootRef}>
      <button
        type="button"
        className="compact-clock-select__trigger"
        aria-label={`${label}：${value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openAtCurrentValue())}
        onKeyDown={onKeyDown}
      >
        {value}
      </button>
      {open ? (
        <div
          id={listboxId}
          className="compact-clock-select__panel"
          role="listbox"
          aria-label={`${label}选项`}
          aria-activedescendant={`${listboxId}-${activeIndex}`}
        >
          {values.map((option, index) => {
            const selected = option === value;
            const active = index === activeIndex;
            return (
              <div
                id={`${listboxId}-${index}`}
                key={option}
                ref={active ? activeOptionRef : undefined}
                role="option"
                aria-selected={selected}
                className={`compact-clock-select__option${
                  selected ? " compact-clock-select__option--selected" : ""
                }${active ? " compact-clock-select__option--active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onSelect(option);
                  close();
                }}
              >
                {option}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
