export type AppUpdateProgress =
  | { phase: "downloading"; downloaded: number; total: number | null }
  | { phase: "installing" };

export interface AppUpdateCandidate {
  version: string;
  body: string | null;
  date: string | null;
  downloadAndInstall(
    onProgress: (event: AppUpdateProgress) => void,
  ): Promise<void>;
}

export interface AppUpdateClient {
  check(): Promise<AppUpdateCandidate | null>;
  relaunch(): Promise<void>;
}

type NativeDownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

type NativeUpdate = {
  version: string;
  body?: string;
  date?: string;
  downloadAndInstall(
    listener: (event: NativeDownloadEvent) => void,
  ): Promise<void>;
};

type UpdateBindings = {
  check(): Promise<NativeUpdate | null>;
  relaunch(): Promise<void>;
};

type UpdateClientOptions = {
  isTauri?: () => boolean;
  loadBindings?: () => Promise<UpdateBindings>;
};

export function createAppUpdateClient(
  options: UpdateClientOptions = {},
): AppUpdateClient {
  const isTauri = options.isTauri ?? (() => "__TAURI_INTERNALS__" in window);
  const loadBindings = options.loadBindings ?? loadNativeBindings;

  return {
    async check() {
      if (!isTauri()) {
        return null;
      }

      const bindings = await loadBindings();
      const update = await bindings.check();
      if (!update) {
        return null;
      }

      return {
        version: update.version,
        body: update.body ?? null,
        date: update.date ?? null,
        async downloadAndInstall(onProgress) {
          let downloaded = 0;
          let total: number | null = null;

          await update.downloadAndInstall((event) => {
            if (event.event === "Started") {
              total = event.data.contentLength ?? null;
              onProgress({ phase: "downloading", downloaded, total });
              return;
            }

            if (event.event === "Progress") {
              downloaded += event.data.chunkLength;
              onProgress({ phase: "downloading", downloaded, total });
              return;
            }

            onProgress({ phase: "installing" });
          });
        },
      };
    },

    async relaunch() {
      const bindings = await loadBindings();
      await bindings.relaunch();
    },
  };
}

async function loadNativeBindings(): Promise<UpdateBindings> {
  const [{ check }, { relaunch }] = await Promise.all([
    import("@tauri-apps/plugin-updater"),
    import("@tauri-apps/plugin-process"),
  ]);

  return {
    check: () => check(),
    relaunch: () => relaunch(),
  };
}

export const appUpdateClient = createAppUpdateClient();
