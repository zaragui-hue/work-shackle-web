import { addMonths, startOfMonth, subMonths } from "date-fns";
import { useMemo, useState } from "react";

import { Button } from "../../../shared/ui";
import {
  buildCalendarGrid,
  formatCalendarDayLabel,
  formatCalendarMonthTitle,
  getCalendarGridDateRange,
  WEEKDAY_LABELS,
} from "./calendarGrid";
import { useCalendarTaskCounts } from "./useCalendarTaskCounts";
import "./TaskCalendar.css";

type TaskCalendarProps = {
  /** Injected for tests; defaults to local now. */
  today?: Date;
  /** Injected for tests; defaults to the month containing `today`. */
  initialMonth?: Date;
};

export function TaskCalendar({
  today = new Date(),
  initialMonth,
}: TaskCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(initialMonth ?? today),
  );

  const monthTitle = formatCalendarMonthTitle(visibleMonth);
  const cells = useMemo(
    () => buildCalendarGrid(visibleMonth, today),
    [visibleMonth, today],
  );
  const gridRange = useMemo(() => getCalendarGridDateRange(cells), [cells]);
  const { countsByDate, loading: countsLoading, error: countsError } = useCalendarTaskCounts(
    gridRange?.startDate ?? null,
    gridRange?.endDate ?? null,
  );

  const isCurrentMonthView = visibleMonth.getTime() === startOfMonth(today).getTime();

  return (
    <section className="task-calendar" aria-label="任务月历">
      <header className="task-calendar__header">
        <div className="task-calendar__nav">
          <Button
            variant="secondary"
            className="task-calendar__nav-button"
            aria-label="上一个月"
            onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
          >
            ‹
          </Button>
          <h3 className="task-calendar__title">{monthTitle}</h3>
          <Button
            variant="secondary"
            className="task-calendar__nav-button"
            aria-label="下一个月"
            onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
          >
            ›
          </Button>
        </div>
        <Button
          variant="wheat"
          className="task-calendar__today-button"
          aria-label="回到今天"
          disabled={isCurrentMonthView}
          onClick={() => setVisibleMonth(startOfMonth(today))}
        >
          今天
        </Button>
      </header>

      {countsError ? (
        <p className="task-calendar__status" role="alert">
          {countsError}
        </p>
      ) : null}

      {countsLoading ? (
        <p className="task-calendar__status" aria-live="polite">
          加载任务数量中…
        </p>
      ) : null}

      <div className="task-calendar__weekdays" role="row">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="task-calendar__weekday" role="columnheader">
            {label}
          </div>
        ))}
      </div>

      <div className="task-calendar__grid" role="grid" aria-label={monthTitle}>
        {cells.map((cell) => {
          const taskCount = countsByDate[cell.dateKey] ?? 0;
          const dayLabel =
            taskCount > 0
              ? `${formatCalendarDayLabel(cell.date)}，${taskCount} 项任务`
              : formatCalendarDayLabel(cell.date);
          const classNames = [
            "task-calendar__day",
            cell.isCurrentMonth ? "task-calendar__day--current-month" : "task-calendar__day--outside",
            cell.isToday ? "task-calendar__day--today" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={cell.dateKey}
              type="button"
              className={classNames}
              role="gridcell"
              aria-label={dayLabel}
              aria-current={cell.isToday ? "date" : undefined}
            >
              <span className="task-calendar__day-number">{cell.dayNumber}</span>
              {taskCount > 0 ? (
                <span className="task-calendar__task-count" aria-hidden="true">
                  {taskCount} 项
                </span>
              ) : null}
              {cell.isToday ? (
                <span className="task-calendar__today-badge" aria-hidden="true">
                  今
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
