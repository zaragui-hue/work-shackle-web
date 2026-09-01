import { useEffect } from "react";

const nextLocalMidnightDelay = () => {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight.getTime() - now.getTime();
};

export function useCalendarDayRefresh(
  refresh: () => void | Promise<void>,
) {
  useEffect(() => {
    let timerId: number | undefined;

    const scheduleNextMidnight = () => {
      timerId = window.setTimeout(() => {
        void refresh();
        scheduleNextMidnight();
      }, nextLocalMidnightDelay());
    };
    const handleFocus = () => void refresh();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    scheduleNextMidnight();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);
}
