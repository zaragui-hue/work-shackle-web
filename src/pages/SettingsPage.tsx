import { useState } from "react";
import { Button, Card, Drawer, EmptyState, Modal } from "../shared/ui";

export function SettingsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <Card title="设置" headerAccent>
        <EmptyState
          title="设置还在午睡"
          description="这里先用来验收组件。点下面按钮看看弹层手感。"
          action={
            <>
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                打开 Modal
              </Button>
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                打开 Drawer
              </Button>
            </>
          }
        />
      </Card>

      <Modal
        open={modalOpen}
        title="提示信息"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              确认
            </Button>
          </>
        }
      >
        <p>这是视觉验收用的 Modal，没有业务逻辑。</p>
      </Modal>

      <Drawer
        open={drawerOpen}
        title="侧栏抽屉"
        onClose={() => setDrawerOpen(false)}
      >
        <p>这是从右侧滑入的 Drawer，用于验收圆角与纸感面板。</p>
      </Drawer>
    </>
  );
}
