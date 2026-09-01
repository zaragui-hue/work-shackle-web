import { invoke } from "@tauri-apps/api/core";

import { DYNAMIC_APP_ICON_ASSETS } from "./dynamicAppIconAssets";
import type { DynamicAppIconState } from "./dynamicAppIconState";

export type IconInvoker = (
  command: string,
  args: { iconBytes: number[] },
) => Promise<unknown>;

export async function applyDynamicAppIcon(
  state: DynamicAppIconState,
  invokeCommand: IconInvoker = invoke,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(DYNAMIC_APP_ICON_ASSETS[state]);
  if (!response.ok) {
    throw new Error(`dynamic icon asset unavailable: ${state}`);
  }
  const iconBytes = Array.from(new Uint8Array(await response.arrayBuffer()));
  await invokeCommand("set_dynamic_app_icon", { iconBytes });
}
