import {
  mascotAnimationForDdlEmotion,
  mascotStateForDdlEmotion,
} from "../../assets/mascot";
import type { Task } from "../../services/tauri/tasks";
import { Mascot } from "../../shared/ui";
import { priorityLabel, statusLabel } from "../tasks/taskDisplay";
import { taskStatusStampCopy } from "./ddlProgressDisplay";
import type { TaskPressure } from "./taskPressure";

type TaskPressureStampProps = {
  task: Task;
  pressure: TaskPressure;
  autoStarted?: boolean;
};

export function TaskPressureStamp({
  task,
  pressure,
  autoStarted = false,
}: TaskPressureStampProps) {
  return (
    <span
      className={`task-pressure-stamp task-pressure-stamp--${pressure.emotion}${autoStarted ? " task-pressure-stamp--announced" : ""}`}
      aria-label={`任务状态：${statusLabel(task.status)}，紧急程度：${priorityLabel(task.priority)}，时间已走过 ${pressure.percentLabel}`}
    >
      <Mascot
        state={mascotStateForDdlEmotion(pressure.emotion)}
        animation={mascotAnimationForDdlEmotion(pressure.emotion)}
        size="sm"
        className="task-pressure-stamp__mascot"
      />
      <span className="task-pressure-stamp__content" aria-hidden="true">
        <span className="task-pressure-stamp__eyebrow">
          <span>TIME USED</span>
          {autoStarted ? <b>AUTO</b> : null}
        </span>
        <strong className="task-pressure-stamp__percent">
          {pressure.percentLabel}
        </strong>
        <span className="task-pressure-stamp__status">
          {taskStatusStampCopy(task.status)}
        </span>
      </span>
    </span>
  );
}
