import afternoon from "../../assets/app-icons/offwork-ghost/runtime/afternoon.png";
import deadlineAlert from "../../assets/app-icons/offwork-ghost/runtime/deadline_alert.png";
import defaultIcon from "../../assets/app-icons/offwork-ghost/runtime/default.png";
import morning from "../../assets/app-icons/offwork-ghost/runtime/morning.png";
import offworkSoon from "../../assets/app-icons/offwork-ghost/runtime/offwork_soon.png";
import overtime from "../../assets/app-icons/offwork-ghost/runtime/overtime.png";
import type { DynamicAppIconState } from "./dynamicAppIconState";

export const DYNAMIC_APP_ICON_ASSETS = {
  morning,
  default: defaultIcon,
  afternoon,
  offwork_soon: offworkSoon,
  deadline_alert: deadlineAlert,
  overtime,
} as const satisfies Record<DynamicAppIconState, string>;
