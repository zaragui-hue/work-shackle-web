export const HIDDEN_WORKING_STATUS = "working";
export const AUTOMATIC_FOCUS_STATUS = "focus_brick";
export const AUTOMATIC_PREPARE_STATUS = "preparing_leave";

export function isManualWorkStatus(statusType: string): boolean {
  return statusType !== HIDDEN_WORKING_STATUS;
}

export function isReminderWorkStatus(statusType: string): boolean {
  return isManualWorkStatus(statusType)
    && statusType !== AUTOMATIC_FOCUS_STATUS
    && statusType !== AUTOMATIC_PREPARE_STATUS;
}

export const isSettingsWorkStatus = isManualWorkStatus;
