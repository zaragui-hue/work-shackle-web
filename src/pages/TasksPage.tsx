import { Card, EmptyState } from "../shared/ui";

export function TasksPage() {
  return (
    <Card title="任务" headerAccent>
      <EmptyState
        title="任务清单空空"
        description="暂时没有砖可搬。Foundation 先把壳搭好。"
      />
    </Card>
  );
}
