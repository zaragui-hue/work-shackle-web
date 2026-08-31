import {
  getCurrentWindow,
  type Window as TauriWindow,
} from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";

export type FullscreenWindow = Pick<
  TauriWindow,
  "isFullscreen" | "onResized" | "setFullscreen"
>;

export function useWindowFullscreen(
  windowRef?: FullscreenWindow,
) {
  const [resolvedWindow] = useState<FullscreenWindow | null>(
    () => windowRef ?? resolveCurrentWindow(),
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!resolvedWindow) {
      return undefined;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    const sync = async () => {
      try {
        const next = await resolvedWindow.isFullscreen();
        if (!disposed) {
          setIsFullscreen(next);
        }
      } catch {
        if (!disposed) {
          setIsFullscreen(false);
        }
      }
    };

    void sync();
    void resolvedWindow
      .onResized(() => void sync())
      .then((cleanup) => {
        if (disposed) {
          cleanup();
        } else {
          unlisten = cleanup;
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [resolvedWindow]);

  const exitFullscreen = useCallback(async () => {
    if (exiting || !resolvedWindow) {
      return;
    }

    setExiting(true);
    try {
      await resolvedWindow.setFullscreen(false);
      setIsFullscreen(await resolvedWindow.isFullscreen());
    } catch {
      // Preserve the last native state until the next successful synchronization.
    } finally {
      setExiting(false);
    }
  }, [exiting, resolvedWindow]);

  return { isFullscreen, exiting, exitFullscreen };
}

function resolveCurrentWindow(): FullscreenWindow | null {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}
