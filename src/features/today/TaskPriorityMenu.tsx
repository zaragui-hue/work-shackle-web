import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { TASK_PRIORITIES } from "../tasks/createTaskForm";
import { priorityLabel, priorityToneClass } from "../tasks/taskDisplay";

type TaskPriorityMenuProps = {
  taskTitle: string;
  value: number;
  disabled?: boolean;
  onChange: (priority: number) => void;
};

export function TaskPriorityMenu({
  taskTitle,
  value,
  disabled = false,
  onChange,
}: TaskPriorityMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusOnOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (focusOnOpenRef.current) {
      focusOnOpenRef.current = false;
      optionRefs.current[0]?.focus();
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  const closeAndRestoreFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const openFromKeyboard = () => {
    if (disabled) {
      return;
    }
    focusOnOpenRef.current = true;
    setOpen(true);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (open) {
        optionRefs.current[0]?.focus();
      } else {
        openFromKeyboard();
      }
    }
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const lastIndex = TASK_PRIORITIES.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowDown"
            ? (index + 1) % TASK_PRIORITIES.length
            : (index - 1 + TASK_PRIORITIES.length) % TASK_PRIORITIES.length;
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="task-priority-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`task-priority-menu__trigger ${priorityToneClass(value)}`}
        aria-label={`${taskTitle} 紧急程度：${priorityLabel(value)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{priorityLabel(value)}</span>
        {!disabled ? <span aria-hidden="true">⌄</span> : null}
      </button>

      {open ? (
        <div
          className="task-priority-menu__popover"
          role="menu"
          aria-label={`${taskTitle} 紧急程度选项`}
        >
          {TASK_PRIORITIES.map((option, index) => (
            <button
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              className={priorityToneClass(option.value)}
              key={option.value}
              onClick={() => {
                setOpen(false);
                if (option.value !== value) {
                  onChange(option.value);
                }
              }}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
            >
              <span>{option.label}</span>
              {option.value === value ? <strong aria-hidden="true">✓</strong> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
