import type { Task } from "../../services/tauri/tasks";
import {
  formatContact,
  formatDeadlineShort,
  isTerminalStatus,
  priorityLabel,
  priorityToneClass,
  statusLabel,
} from "./taskDisplay";
import "./priorityTone.css";
import "./TaskList.css";

type TaskListProps = {
  tasks: Task[];
  onSelect?: (taskId: string) => void;
};

export function TaskList({ tasks, onSelect }: TaskListProps) {
  return (
    <ul className="task-list" aria-label="任务清单">
      {tasks.map((task) => (
        <li
          key={task.id}
          className={`task-list__item${isTerminalStatus(task.status) ? " task-list__item--terminal" : ""}`}
        >
          <button
            type="button"
            className="task-list__button"
            onClick={() => onSelect?.(task.id)}
          >
            <span
              className={`task-list__priority ${priorityToneClass(task.priority)}`}
              aria-hidden="true"
            />
            <div className="task-list__body">
              <div className="task-list__top">
                <h3 className="task-list__title">{task.title}</h3>
                <p
                  className={`task-list__ddl${task.deadlineAtMs == null ? " task-list__ddl--empty" : ""}`}
                >
                  <span className="task-list__ddl-label">DDL</span>
                  <span className="task-list__ddl-value">
                    {formatDeadlineShort(task.deadlineAtMs)}
                  </span>
                </p>
              </div>
              <div className="task-list__foot">
                <span className="task-list__chip" title="紧急程度">
                  {priorityLabel(task.priority)}
                </span>
                <span className="task-list__chip task-list__chip--status">
                  {statusLabel(task.status)}
                </span>
                <span className="task-list__contact">{formatContact(task)}</span>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
