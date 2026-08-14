import { useCallback, useEffect, useRef, useState } from "react";

import {
  checkLunchReminder,
  type LunchReminder,
} from "../../services/tauri/lunchReminder";

const POLL_INTERVAL_MS = 30_000;

type LunchReminderState = {
  reminder: LunchReminder | null;
  loading: boolean;
  dismissed: boolean;
};

export function useLunchReminder(): LunchReminderState & {
  dismiss: () => void;
} {
  const [reminder, setReminder] = useState<LunchReminder | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const pollingRef = useRef(false);

  const poll = useCallback(async () => {
    if (pollingRef.current) {
      return;
    }

    pollingRef.current = true;
    try {
      const next = await checkLunchReminder();
      if (next) {
        setReminder(next);
        setDismissed(false);
      }
    } finally {
      pollingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [poll]);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  return {
    reminder,
    loading,
    dismissed,
    dismiss,
  };
}
