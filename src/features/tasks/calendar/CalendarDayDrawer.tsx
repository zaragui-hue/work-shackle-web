import { TaskList } from "../TaskList";
import { Drawer, EmptyState } from "../../../shared/ui";
import { countCalendarDayTasks } from "./calendarDayTasks";
import { formatCalendarDayDrawerTitle } from "./calendarGrid";
import { useCalendarDayTasks } from "./useCalendarDayTasks";
import "./CalendarDayDrawer.css";

type CalendarDayDrawerProps = {
  dateKey: string | null;
  open: boolean;
  onClose: () => void;
  onSelectTask: (taskId: string) => void;
};

export function CalendarDayDrawer({
  dateKey,
  open,
  onClose,
  onSelectTask,
}: CalendarDayDrawerProps) {
  const { dayTasks, loading, error } = useCalendarDayTasks(dateKey, open);
  const taskCount = dayTasks ? countCalendarDayTasks(dayTasks) : 0;
  const title = dateKey ? formatCalendarDayDrawerTitle(dateKey, taskCount) : "当天任务";

  const handleSelectTask = (taskId: string) => {
    onClose();
    onSelectTask(taskId);
  };

  return (
    <Drawer open={open} title={title} onClose={onClose}>
      {loading ? <p className="calendar-day-drawer__status">加载当天任务中…</p> : null}

      {error ? (
        <p className="calendar-day-drawer__status calendar-day-drawer__status--error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && dayTasks && taskCount === 0 ? (
        <EmptyState title="这天居然没安排" description="日历上没有落在这天的任务。" />
      ) : null}

      {!loading && !error && dayTasks && taskCount > 0 ? (
        <div className="calendar-day-drawer__sections">
          {dayTasks.formalTasks.length > 0 ? (
            <section className="calendar-day-drawer__section" aria-label="当天任务">
              <TaskList tasks={dayTasks.formalTasks} onSelect={handleSelectTask} />
            </section>
          ) : null}

          {dayTasks.overdueTasks.length > 0 ? (
            <section className="calendar-day-drawer__section" aria-labelledby="calendar-day-overdue">
              <h3 id="calendar-day-overdue" className="calendar-day-drawer__section-title">
                历史逾期
              </h3>
              <TaskList tasks={dayTasks.overdueTasks} onSelect={handleSelectTask} />
            </section>
          ) : null}

          {dayTasks.completedTasks.length > 0 ? (
            <section className="calendar-day-drawer__section" aria-labelledby="calendar-day-completed">
              <h3 id="calendar-day-completed" className="calendar-day-drawer__section-title">
                已完成
              </h3>
              <TaskList tasks={dayTasks.completedTasks} onSelect={handleSelectTask} />
            </section>
          ) : null}

          {dayTasks.cancelledTasks.length > 0 ? (
            <section className="calendar-day-drawer__section" aria-labelledby="calendar-day-cancelled">
              <h3 id="calendar-day-cancelled" className="calendar-day-drawer__section-title">
                已取消
              </h3>
              <TaskList tasks={dayTasks.cancelledTasks} onSelect={handleSelectTask} />
            </section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
