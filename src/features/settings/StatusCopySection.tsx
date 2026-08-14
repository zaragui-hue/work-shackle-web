import { useCallback, useEffect, useState } from "react";

import {
  listStatusCopies,
  listWorkStatuses,
  mapWorkStatusError,
  saveStatusCopy,
  type FixedWorkStatus,
  type StatusCopy,
  type WorkStatusAppError,
} from "../../services/tauri/workStatus";
import { Button, Input } from "../../shared/ui";
import "./StatusCopySection.css";

export function StatusCopySection() {
  const [statuses, setStatuses] = useState<FixedWorkStatus[]>([]);
  const [copiesByStatus, setCopiesByStatus] = useState<Record<string, StatusCopy[]>>(
    {},
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string | null>>({});
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const fixedStatuses = await listWorkStatuses();
      const editable = fixedStatuses.filter((status) => status.selectable);
      const copyEntries = await Promise.all(
        editable.map(async (status) => {
          const copies = await listStatusCopies(status.id);
          return [status.id, copies] as const;
        }),
      );

      setStatuses(editable);
      setCopiesByStatus(Object.fromEntries(copyEntries));
    } catch (error) {
      setLoadError(mapWorkStatusError(error as WorkStatusAppError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (status: FixedWorkStatus) => {
    const content = (drafts[status.id] ?? "").trim();
    if (!content) {
      setSaveErrors((current) => ({
        ...current,
        [status.id]: "文案不能为空",
      }));
      return;
    }

    setSavingStatusId(status.id);
    setSaveErrors((current) => ({ ...current, [status.id]: null }));
    try {
      const saved = await saveStatusCopy({
        statusType: status.id,
        content,
      });
      setCopiesByStatus((current) => ({
        ...current,
        [status.id]: [...(current[status.id] ?? []), saved],
      }));
      setDrafts((current) => ({ ...current, [status.id]: "" }));
    } catch (error) {
      setSaveErrors((current) => ({
        ...current,
        [status.id]: mapWorkStatusError(error as WorkStatusAppError),
      }));
    } finally {
      setSavingStatusId(null);
    }
  };

  return (
    <section className="settings-status-copies">
      <h3 className="settings-section__title">状态文案</h3>
      <p className="settings-section__hint">
        状态名称和顺序固定，只能给每个状态添加多条展示文案。切换状态时会随机抽一条。
      </p>

      {loading ? <p className="settings-section__hint">加载中…</p> : null}
      {loadError ? (
        <p className="settings-section__error" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError
        ? statuses.map((status) => {
            const copies = copiesByStatus[status.id] ?? [];
            const draft = drafts[status.id] ?? "";
            const saveError = saveErrors[status.id];
            const isSaving = savingStatusId === status.id;

            return (
              <article key={status.id} className="settings-status-copies__item">
                <header className="settings-status-copies__header">
                  <span aria-hidden="true">{status.emoji}</span>
                  <span>{status.name}</span>
                </header>

                {copies.length > 0 ? (
                  <ul className="settings-status-copies__list">
                    {copies.map((copy) => (
                      <li key={copy.id}>{copy.content}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="settings-section__hint">还没有文案。</p>
                )}

                <div className="settings-status-copies__form">
                  <Input
                    label={`新增「${status.name}」文案`}
                    value={draft}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [status.id]: event.target.value,
                      }))
                    }
                    error={saveError ?? undefined}
                  />
                  <div className="settings-status-copies__actions">
                    <Button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void onSave(status)}
                    >
                      {isSaving ? "保存中…" : "添加文案"}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })
        : null}
    </section>
  );
}
