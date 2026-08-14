import { Card, EmptyState } from "../shared/ui";

export function TodayPage() {
  return (
    <Card title="今日" headerAccent>
      <EmptyState
        title="今天还没安排"
        description="班味暂未加载。先喝口水，业务页面稍后接上。"
      />
    </Card>
  );
}
