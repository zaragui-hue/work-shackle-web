# Today Dashboard Interaction Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一今日页时间选择交互，增加分阶段下班文案和卡片延期入口，并完善新建时间校准与只读视觉。

**Architecture:** 保持现有 Tauri IPC、任务状态和延期数据模型不变。用小型纯函数处理时分转换、进度文案和默认时间校准；页面只编排现有延期弹窗，共享表单组件统一禁用视觉。

**Tech Stack:** React 19、TypeScript、React Hook Form、Vitest、Testing Library、Tauri 2、CSS

---

## 文件结构

- Modify `src/features/today/WorkScheduleEditor.tsx`：控制台双下拉及即时保存。
- Modify `src/features/today/WorkScheduleEditor.css`：大号小时/分钟计分牌样式。
- Modify `src/features/today/WorkScheduleEditor.test.tsx`：选择、保存、回滚测试。
- Modify `src/features/today/workCountdown.ts`：按进度选择稳定文案。
- Modify `src/features/today/workCountdown.test.ts`：进度边界测试。
- Modify `src/pages/TodayPage.tsx`：今日标题结构及延期弹窗编排。
- Modify `src/pages/TodayPage.css`：今日标题与昨日标题对齐。
- Modify `src/features/today/TodayTaskBoard.tsx`：透传延期请求。
- Modify `src/features/today/TodayTaskCard.tsx`：状态下拉中的延期操作项。
- Modify `src/features/today/TodayTaskBoard.test.tsx`：延期入口与原状态保持测试。
- Modify `src/features/tasks/CreateTaskDrawer.tsx`：未修改默认开始时间的提交前校准。
- Modify `src/features/tasks/CreateTaskDrawer.test.tsx`：跨分钟校准及用户修改保护测试。
- Modify `src/features/tasks/TaskCoreFields.tsx`：开始时间修改通知及禁用样式钩子。
- Modify `src/features/tasks/TaskCoreFields.css`：时间区只读视觉。
- Modify `src/shared/ui/Input.css`：共享禁用控件视觉。

### Task 1: 控制台双下拉时间选择器

- [ ] **Step 1: 修改测试，要求小时和分钟选择器存在并即时保存**

在 `WorkScheduleEditor.test.tsx` 中把原生时间输入断言替换为：

```tsx
const hour = screen.getByLabelText("下班小时") as HTMLSelectElement;
const minute = screen.getByLabelText("下班分钟") as HTMLSelectElement;
expect(hour.value).toBe("18");
expect(minute.value).toBe("30");
expect(hour.options).toHaveLength(24);
expect(minute.options).toHaveLength(60);
fireEvent.change(hour, { target: { value: "19" } });
await waitFor(() => expect(saveDefaultWorkTimes).toHaveBeenCalledWith({
  startTime: "09:30",
  endTime: "19:30",
}));
```

失败回滚测试分别断言小时与分钟恢复为 `18`、`30`。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/features/today/WorkScheduleEditor.test.tsx`

Expected: FAIL，因为当前只有 `下班时间` 原生输入。

- [ ] **Step 3: 实现小时/分钟拆分、合并与即时保存**

在 `WorkScheduleEditor.tsx` 增加并使用：

```tsx
const HOURS = Array.from({ length: 24 }, (_, value) => String(value).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, value) => String(value).padStart(2, "0"));

function splitClock(value: string) {
  const [hour = "", minute = ""] = value.split(":");
  return { hour, minute };
}

const selected = splitClock(endTime);

<div className="work-schedule-editor__time-controls" aria-label="下班时间">
  <select aria-label="下班小时" value={selected.hour} disabled={saving}
    onChange={(event) => void persist(`${event.target.value}:${selected.minute}`)}>
    {HOURS.map((hour) => <option value={hour} key={hour}>{hour}</option>)}
  </select>
  <span aria-hidden="true">:</span>
  <select aria-label="下班分钟" value={selected.minute} disabled={saving}
    onChange={(event) => void persist(`${selected.hour}:${event.target.value}`)}>
    {MINUTES.map((minute) => <option value={minute} key={minute}>{minute}</option>)}
  </select>
</div>
```

在 `WorkScheduleEditor.css` 用三列网格、现有信号黄背景和大号数据字体替换 `.work-schedule-editor__time` 样式。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run src/features/today/WorkScheduleEditor.test.tsx`

Expected: PASS。

### Task 2: 分阶段下班文案

- [ ] **Step 1: 增加边界测试**

在 `workCountdown.test.ts` 增加 0%、25%、50%、75%、90% 对应时间，并断言：

```ts
expect(computeWorkCountdown(schedule, atProgress(0)).primaryText)
  .toBe("离下班还早，先把今天骗过去");
expect(computeWorkCountdown(schedule, atProgress(25)).primaryText)
  .toBe("工位坐稳，释放正在路上");
expect(computeWorkCountdown(schedule, atProgress(50)).primaryText)
  .toBe("已经熬过一半，别在这时散架");
expect(computeWorkCountdown(schedule, atProgress(75)).primaryText)
  .toBe("下班开始有轮廓了");
expect(computeWorkCountdown(schedule, atProgress(90)).primaryText)
  .toBe("再撑一下，门禁快拦不住你了");
```

100% 继续断言现有“今天已经到下班时间”。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/features/today/workCountdown.test.ts`

Expected: FAIL，因为工作阶段仍固定为“距离下班还有”。

- [ ] **Step 3: 实现稳定文案选择器**

在 `workCountdown.ts` 增加：

```ts
export function workCountdownHeadline(progress: number): string {
  if (progress >= 90) return "再撑一下，门禁快拦不住你了";
  if (progress >= 75) return "下班开始有轮廓了";
  if (progress >= 50) return "已经熬过一半，别在这时散架";
  if (progress >= 25) return "工位坐稳，释放正在路上";
  return "离下班还早，先把今天骗过去";
}
```

工作阶段按 `(now - start) / (end - start) * 100` 计算精确进度并传入该函数；倒计时保持不变。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run src/features/today/workCountdown.test.ts`

Expected: PASS。

### Task 3: 今日标题与昨日标题对齐

- [ ] **Step 1: 调整页面结构**

在 `TodayPage.tsx` 删除 `Card` 的 `title` 与 `headerAccent`，在卡片正文首部加入：

```tsx
<header className="today-page__tasks-heading today-board__section-head">
  <h2 className="today-board__section-title">今天这些破事 / 先狠狠干掉</h2>
  <span className="today-board__section-badge">今日清单</span>
</header>
```

- [ ] **Step 2: 对齐视觉样式**

在 `TodayPage.css` 增加：

```css
.today-page__tasks-heading {
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 3px solid var(--color-anchor);
}
```

标题和徽章直接复用 `TodayTaskBoard.css` 的结构类，确保字号、字重、分隔线和徽章规格一致。

- [ ] **Step 3: 运行导航与任务区相关测试**

Run: `npm test -- --run src/features/today/TodayTaskBoard.test.tsx src/pages/taskCreationEntryPoints.test.ts`

Expected: PASS。

### Task 4: 任务卡片延期入口

- [ ] **Step 1: 增加卡片延期操作测试**

在 `TodayTaskBoard.test.tsx` 增加：

```tsx
const onPostpone = vi.fn();
render(<TodayTaskBoard tasks={tasks} onPostpone={onPostpone} />);
const status = screen.getByLabelText("卡片内管理 主状态") as HTMLSelectElement;
fireEvent.change(status, { target: { value: "__postpone__" } });
expect(onPostpone).toHaveBeenCalledWith(started);
expect(onStatusChange).not.toHaveBeenCalled();
expect(status.value).toBe("in_progress");
```

另加无 `deadlineAtMs` 和终态任务不显示延期操作的断言。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/features/today/TodayTaskBoard.test.tsx`

Expected: FAIL，因为卡片还没有延期操作项。

- [ ] **Step 3: 透传延期请求并打开现有弹窗**

在 `TodayTaskCard.tsx` 使用 UI 专用值：

```tsx
const POSTPONE_ACTION = "__postpone__";

{task.deadlineAtMs != null ? (
  <option value={POSTPONE_ACTION}>申请延期</option>
) : null}
```

`onChange` 遇到该值时调用 `onPostpone?.(task)`，否则调用现有 `onStatusChange`。在 `TodayTaskBoard.tsx` 逐层透传 `onPostpone`。

在 `TodayPage.tsx` 保存 `postponingTask: Task | null`，并渲染：

```tsx
<PostponeTaskModal
  open={postponingTask !== null}
  taskId={postponingTask?.id ?? null}
  currentDeadlineAtMs={postponingTask?.deadlineAtMs}
  plannedAtMs={postponingTask?.plannedAtMs}
  onClose={() => setPostponingTask(null)}
  onPostponed={() => void loadTodayTasks()}
/>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run src/features/today/TodayTaskBoard.test.tsx src/features/tasks/PostponeTaskModal.test.tsx`

Expected: PASS。

### Task 5: 新建任务默认开始时间提交前校准

- [ ] **Step 1: 增加跨分钟与用户修改测试**

在 `CreateTaskDrawer.test.tsx` 使用假时间：

```tsx
vi.useFakeTimers();
vi.setSystemTime(new Date(2026, 7, 27, 18, 17, 0));
render(<CreateTaskDrawer open onClose={vi.fn()} />);
vi.setSystemTime(new Date(2026, 7, 27, 18, 18, 0));
fireEvent.change(screen.getByLabelText("任务名称"), { target: { value: "跨分钟任务" } });
fireEvent.click(screen.getByRole("button", { name: "创建任务" }));
await waitFor(() => expect(createTask).toHaveBeenCalledWith(
  expect.objectContaining({ plannedAtMs: new Date(2026, 7, 27, 18, 18).getTime() }),
));
```

第二个测试先修改开始分钟为 `30`，推进系统时间后提交，断言仍保存 `18:30`。第三个测试将完成时间设为与校准后的开始时间冲突，断言完成时间变为开始时间后 1 分钟。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/features/tasks/CreateTaskDrawer.test.tsx`

Expected: FAIL，因为当前过时默认值在 resolver 阶段直接报错。

- [ ] **Step 3: 实现修改标记与提交前校准**

给 `TaskCoreFields` 增加 `onStartAtChange?: () => void`，包装开始时间字段：

```tsx
onChange={(value) => {
  onStartAtChange?.();
  field.onChange(value);
}}
```

在 `CreateTaskDrawer` 用 ref 记录用户修改，并在调用 `handleSubmit` 前执行：

```tsx
if (!startAtEditedRef.current) {
  const values = getValues();
  const minimum = currentMinuteValue();
  if (values.startAt < minimum) {
    setValue("startAt", minimum);
    if (values.endAt <= minimum) {
      setValue("endAt", addMinutesToDateTime(minimum, 1));
    }
  }
}
```

抽屉每次打开并 reset 时把 ref 恢复为 `false`；已有任务编辑不传该回调。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run src/features/tasks/CreateTaskDrawer.test.tsx src/features/tasks/TaskDrawer.test.tsx`

Expected: PASS。

### Task 6: 禁用字段置灰与完整验证

- [ ] **Step 1: 增加语义样式钩子**

在 `TaskCoreFields.tsx` 为时间区增加：

```tsx
className={`task-core-fields__time-range${
  timeFieldsDisabled ? " task-core-fields__time-range--disabled" : ""
}`}
```

现有原生 `disabled` 属性保持不变。

- [ ] **Step 2: 实现共享禁用视觉**

在 `Input.css` 增加：

```css
.ws-input:disabled {
  border-color: #aaa79f;
  color: #77746d;
  background: #e7e5df;
  background-image: none;
  cursor: not-allowed;
  opacity: 1;
}
```

在 `TaskCoreFields.css` 增加：

```css
.task-core-fields__time-range--disabled {
  border-color: #aaa79f;
  background: #e7e5df;
  box-shadow: 4px 4px 0 #c4c1ba;
}

.task-core-fields__time-range--disabled h3 {
  border-color: #8c8982;
  color: #68655f;
  background: #d1cec7;
}
```

- [ ] **Step 3: 运行相关测试**

Run: `npm test -- --run src/features/tasks/TaskDateTimeField.test.tsx src/features/tasks/TaskDrawer.test.tsx`

Expected: PASS。

- [ ] **Step 4: 运行完整前端测试**

Run: `npm test`

Expected: 所有 Vitest 测试 PASS。

- [ ] **Step 5: 运行生产构建**

Run: `npm run build`

Expected: TypeScript 检查和 Vite 构建成功。

- [ ] **Step 6: 重启桌面应用并人工检查**

停止当前开发会话后运行 `npm run tauri dev`。确认控制台双下拉、动态文案、对齐标题、卡片延期弹窗、默认时间校准和禁用置灰均在桌面窗口中生效。

