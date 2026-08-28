# Compact Work Time Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized native hour/minute menus in the Work Shackle desk console with compact, scrollable, keyboard-accessible value panels capped at 200px.

**Architecture:** Add a focused `CompactClockSelect` component that owns popover visibility, active-option navigation, outside-click dismissal, and ARIA semantics while leaving schedule validation and persistence in `WorkScheduleEditor`. Integrate two instances for hour and minute, then restyle only the console time area so unrelated time inputs remain unchanged.

**Tech Stack:** React 19, TypeScript, CSS, Testing Library, Vitest, Tauri WebView

---

## File map

- Create `src/features/today/CompactClockSelect.tsx`: controlled compact value picker with listbox behavior.
- Create `src/features/today/CompactClockSelect.css`: bounded panel, option states, responsive alignment, and reduced-motion rules.
- Create `src/features/today/CompactClockSelect.test.tsx`: component interaction and keyboard coverage.
- Modify `src/features/today/WorkScheduleEditor.tsx`: replace native selects with two compact pickers.
- Modify `src/features/today/WorkScheduleEditor.css`: turn the time area into a restrained dark console base and remove native-select styling.
- Modify `src/features/today/WorkScheduleEditor.test.tsx`: verify integration, persistence, and failure rollback through the new buttons.

### Task 1: Build the compact clock value picker

**Files:**
- Create: `src/features/today/CompactClockSelect.test.tsx`
- Create: `src/features/today/CompactClockSelect.tsx`
- Create: `src/features/today/CompactClockSelect.css`

- [ ] **Step 1: Write failing pointer and keyboard interaction tests**

Create `src/features/today/CompactClockSelect.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CompactClockSelect } from "./CompactClockSelect";

const VALUES = ["17", "18", "19", "20"];

afterEach(cleanup);

describe("CompactClockSelect", () => {
  it("opens a bounded listbox and selects a value", () => {
    const onSelect = vi.fn();
    render(
      <CompactClockSelect
        label="下班小时"
        value="18"
        values={VALUES}
        onSelect={onSelect}
      />,
    );

    const trigger = screen.getByRole("button", { name: "下班小时：18" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("listbox", { name: "下班小时选项" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "18" }).getAttribute("aria-selected"))
      .toBe("true");

    fireEvent.click(screen.getByRole("option", { name: "19" }));
    expect(onSelect).toHaveBeenCalledWith("19");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("supports arrow navigation, confirmation, and escape", () => {
    const onSelect = vi.fn();
    render(
      <CompactClockSelect
        label="下班小时"
        value="18"
        values={VALUES}
        onSelect={onSelect}
      />,
    );

    const trigger = screen.getByRole("button", { name: "下班小时：18" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("option", { name: "19" }).className)
      .toContain("compact-clock-select__option--active");

    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("19");
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("closes on outside input or value refresh and disables interaction while saving", () => {
    const { rerender } = render(
      <CompactClockSelect
        label="下班小时"
        value="18"
        values={VALUES}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "下班小时：18" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();

    rerender(
      <CompactClockSelect
        label="下班小时"
        value="19"
        values={VALUES}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "下班小时：19" }));
    rerender(
      <CompactClockSelect
        label="下班小时"
        value="20"
        values={VALUES}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByRole("listbox")).toBeNull();

    rerender(
      <CompactClockSelect
        label="下班小时"
        value="20"
        values={VALUES}
        disabled
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "下班小时：20" }))
      .toHaveProperty("disabled", true);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
npm test -- src/features/today/CompactClockSelect.test.tsx
```

Expected: FAIL because `./CompactClockSelect` does not exist.

- [ ] **Step 3: Implement the controlled picker**

Create `src/features/today/CompactClockSelect.tsx`:

```tsx
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
```

- [ ] **Step 4: Add bounded panel styling**

Create `src/features/today/CompactClockSelect.css`:

```css
.compact-clock-select {
  position: relative;
  min-width: 0;
}

.compact-clock-select__trigger {
  width: 100%;
  min-height: 72px;
  padding: 4px 8px 7px;
  border: 1px solid color-mix(in srgb, white 20%, transparent);
  border-radius: 3px;
  color: var(--color-signal);
  background: color-mix(in srgb, var(--color-anchor) 88%, black);
  font-family: var(--font-data);
  font-size: clamp(3rem, 5.5vw, 3.75rem);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.08em;
  line-height: .95;
  cursor: pointer;
}

.compact-clock-select__trigger:hover:not(:disabled) {
  color: #fff;
  border-color: var(--color-signal);
}

.compact-clock-select__trigger:focus-visible,
.compact-clock-select__trigger[aria-expanded="true"] {
  outline: 3px solid var(--color-signal);
  outline-offset: 2px;
}

.compact-clock-select__trigger:disabled {
  cursor: wait;
  opacity: .68;
}

.compact-clock-select__panel {
  position: absolute;
  z-index: 20;
  top: calc(100% + 8px);
  left: 0;
  width: 100%;
  max-height: 200px;
  padding: 5px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 2px solid var(--color-anchor);
  border-radius: 4px;
  color: var(--color-anchor);
  background: var(--color-paper-raised);
  box-shadow: 4px 4px 0 var(--color-danger);
  scrollbar-width: thin;
}

.compact-clock-select__option {
  padding: 7px 8px;
  border-radius: 2px;
  font-family: var(--font-data);
  font-size: .875rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-align: center;
  cursor: pointer;
}

.compact-clock-select__option--active {
  outline: 2px solid var(--color-anchor);
  outline-offset: -2px;
}

.compact-clock-select__option--selected {
  background: var(--color-signal);
  font-weight: 1000;
}

@media (max-width: 420px) {
  .compact-clock-select__trigger {
    min-height: 62px;
    font-size: clamp(2.5rem, 14vw, 3.25rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .compact-clock-select__panel {
    scroll-behavior: auto;
  }
}
```

- [ ] **Step 5: Run the component tests**

Run:

```bash
npm test -- src/features/today/CompactClockSelect.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit the focused component**

```bash
git add src/features/today/CompactClockSelect.tsx src/features/today/CompactClockSelect.css src/features/today/CompactClockSelect.test.tsx
git commit -m "feat(today): add compact clock value picker"
```

### Task 2: Integrate the picker into the desk console

**Files:**
- Modify: `src/features/today/WorkScheduleEditor.test.tsx`
- Modify: `src/features/today/WorkScheduleEditor.tsx`
- Modify: `src/features/today/WorkScheduleEditor.css`

- [ ] **Step 1: Rewrite the editor tests around button/listbox interaction**

In `src/features/today/WorkScheduleEditor.test.tsx`, replace native-select assertions and changes with the new trigger helpers:

```tsx
function selectClockValue(label: string, value: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}：`) }));
  fireEvent.click(screen.getByRole("option", { name: value }));
}
```

Replace the first test's native select block with:

```tsx
const hour = screen.getByRole("button", { name: "下班小时：18" });
const minute = screen.getByRole("button", { name: "下班分钟：30" });
expect(hour.tagName).toBe("BUTTON");
expect(minute.tagName).toBe("BUTTON");
expect(screen.queryByRole("combobox", { name: "下班小时" })).toBeNull();
selectClockValue("下班小时", "19");
```

Replace the override test's `fireEvent.change(...)` call with:

```tsx
selectClockValue("下班小时", "21");
```

Replace the failure test's native element declarations and change with:

```tsx
selectClockValue("下班小时", "19");

await waitFor(() => {
  expect(screen.getByRole("button", { name: "下班小时：18" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "下班分钟：30" })).toBeTruthy();
});
```

- [ ] **Step 2: Run the editor test and confirm the new expectations fail**

Run:

```bash
npm test -- src/features/today/WorkScheduleEditor.test.tsx
```

Expected: FAIL because the editor still renders native `select` elements.

- [ ] **Step 3: Replace the native selects in `WorkScheduleEditor`**

Add this import to `src/features/today/WorkScheduleEditor.tsx`:

```tsx
import { CompactClockSelect } from "./CompactClockSelect";
```

Replace the two native selects inside `.work-schedule-editor__time-controls` with:

```tsx
<CompactClockSelect
  label="下班小时"
  value={selectedEndTime.hour}
  values={HOURS}
  disabled={saving}
  onSelect={(hour) => {
    void persist(`${hour}:${selectedEndTime.minute}`);
  }}
/>
<span aria-hidden="true">:</span>
<CompactClockSelect
  label="下班分钟"
  value={selectedEndTime.minute}
  values={MINUTES}
  disabled={saving}
  onSelect={(minute) => {
    void persist(`${selectedEndTime.hour}:${minute}`);
  }}
/>
```

Do not change `persist`; it remains the single validation, saving, and rollback path.

- [ ] **Step 4: Restyle the time-control base and remove native-select rules**

In `src/features/today/WorkScheduleEditor.css`, replace `.work-schedule-editor__time-controls` and all of its `select` rules with:

```css
.work-schedule-editor__time-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  width: min(100%, 300px);
  min-width: 0;
  max-width: 100%;
  margin: 2px 0 6px;
  padding: 7px;
  border: 2px solid var(--color-signal);
  border-radius: 5px;
  color: var(--color-signal);
  background: color-mix(in srgb, var(--color-anchor) 88%, black);
  box-shadow: 4px 4px 0 var(--color-danger);
}

.work-schedule-editor__time-controls > span {
  padding-bottom: 6px;
  color: #fff;
  font-family: var(--font-data);
  font-size: clamp(2.5rem, 4.7vw, 3.2rem);
  font-weight: 900;
  line-height: 1;
}

.work-schedule-editor__time-controls:focus-within {
  position: relative;
  z-index: 4;
}
```

This removes the large font from native system controls entirely; the large type now lives only on the trigger buttons.

- [ ] **Step 5: Run integration and component tests**

Run:

```bash
npm test -- src/features/today/CompactClockSelect.test.tsx src/features/today/WorkScheduleEditor.test.tsx
```

Expected: 6 tests PASS.

- [ ] **Step 6: Commit the editor integration**

```bash
git add src/features/today/WorkScheduleEditor.tsx src/features/today/WorkScheduleEditor.css src/features/today/WorkScheduleEditor.test.tsx
git commit -m "fix(today): constrain desk console time menus"
```

### Task 3: Regression and visual verification

**Files:**
- Modify only if a verified defect requires a focused correction: `src/features/today/CompactClockSelect.tsx`, `src/features/today/CompactClockSelect.css`, `src/features/today/WorkScheduleEditor.css`

- [ ] **Step 1: Run the complete frontend test suite**

Run:

```bash
npm test
```

Expected: all Vitest suites PASS with no new warnings from the picker.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite complete successfully and produce `dist`.

- [ ] **Step 3: Launch the Tauri development app**

Run:

```bash
npm run tauri dev
```

Expected: the Work Shackle desktop window opens and the Today page renders.

- [ ] **Step 4: Verify the pointer interaction visually**

On the Today page, scroll to `工位控制台`, click the hour and minute values, and confirm all of the following:

```text
- Each panel is no taller than 200px.
- The panel width matches its number trigger.
- The current value is visible and highlighted when opened.
- The list scrolls inside the panel and never expands the app layout.
- Selecting a value closes the panel and updates the displayed end time.
- Clicking outside closes the panel without changing the time.
```

- [ ] **Step 5: Verify keyboard, narrow-window, and saving behavior**

Confirm:

```text
- Tab can focus each number trigger.
- ArrowUp/ArrowDown opens and moves the active option.
- Enter confirms; Escape closes without saving.
- At a window width below 420px, neither panel leaves the console card or viewport.
- During saving, both triggers are disabled and no second save can start.
- A simulated save failure restores the effective end time and keeps the existing alert visible.
```

- [ ] **Step 6: Commit only if visual verification required a correction**

If Task 3 caused a focused correction, run the relevant focused tests again and commit only the touched picker/editor files:

```bash
git add src/features/today/CompactClockSelect.tsx src/features/today/CompactClockSelect.css src/features/today/WorkScheduleEditor.css
git commit -m "fix(today): polish compact time picker behavior"
```

If no correction was needed, do not create an empty commit.
