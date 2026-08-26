import {
  cancelTask,
  completeTask,
  updateTask,
  type TaskStatus,
} from "../../services/tauri/tasks";

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "not_started", label: "未开始" },
  { value: "in_progress", label: "进行中" },
  { value: "paused", label: "暂停" },
  { value: "waiting", label: "等别人" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

export function changeTaskStatus(id: string, status: TaskStatus) {
  if (status === "completed") {
    return completeTask(id);
  }
  if (status === "cancelled") {
    return cancelTask(id);
  }
  return updateTask({ id, status });
}
