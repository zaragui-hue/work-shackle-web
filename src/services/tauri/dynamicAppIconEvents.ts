export const DYNAMIC_APP_ICON_REFRESH_EVENT =
  "work-shackle:dynamic-icon-refresh";

export function requestDynamicAppIconRefresh(): void {
  window.dispatchEvent(new Event(DYNAMIC_APP_ICON_REFRESH_EVENT));
}

export async function refreshDynamicAppIconAfter<T>(
  mutation: Promise<T>,
): Promise<T> {
  const result = await mutation;
  requestDynamicAppIconRefresh();
  return result;
}
