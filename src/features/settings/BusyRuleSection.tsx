import { useCallback, useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  busyRuleFormSchema,
  createEmptyLevel,
  createEmptyMessage,
  fromBusyLevelRules,
  toSavePayload,
  type BusyRuleFormValues,
} from "./busyRuleForm";
import {
  formatBusyRangeLabel,
  getBusyRules,
  mapBusyRulesError,
  saveBusyRules,
  type BusyRulesAppError,
} from "../../services/tauri/busyRules";
import { Button, Input } from "../../shared/ui";
import "./BusyRuleSection.css";

export function BusyRuleSection() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const form = useForm<BusyRuleFormValues>({
    resolver: zodResolver(busyRuleFormSchema),
    defaultValues: { levels: [] },
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const {
    fields: levelFields,
    append: appendLevel,
    remove: removeLevel,
    insert: insertLevel,
  } = useFieldArray({
    control,
    name: "levels",
    keyName: "fieldKey",
  });

  const loadRules = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rules = await getBusyRules();
      reset(fromBusyLevelRules(rules));
    } catch (error) {
      setLoadError(mapBusyRulesError(error as BusyRulesAppError));
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const onAddLevel = () => {
    const levels = form.getValues("levels");
    if (levels.length === 0) {
      appendLevel(createEmptyLevel(0, ""));
      return;
    }

    const sorted = [...levels].sort((left, right) => left.minTasks - right.minTasks);
    const lastLevel = sorted[sorted.length - 1];
    const previousMax =
      lastLevel.maxTasks === "" || lastLevel.maxTasks === undefined
        ? lastLevel.minTasks
        : lastLevel.maxTasks;
    const nextMin = previousMax + 1;

    const newLevel = createEmptyLevel(nextMin, nextMin);
    const insertAt = Math.max(levels.length - 1, 0);
    insertLevel(insertAt, newLevel);
  };

  const onRemoveLevel = (index: number) => {
    if (levelFields.length <= 1) {
      return;
    }
    removeLevel(index);
  };

  const onSave = handleSubmit(async (values) => {
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const saved = await saveBusyRules(toSavePayload(values));
      reset(fromBusyLevelRules(saved));
      setSaveSuccess(true);
    } catch (error) {
      setSaveError(mapBusyRulesError(error as BusyRulesAppError));
    }
  });

  const sortedLevelIndexes = [...levelFields.keys()].sort((left, right) => {
    const leftMin = form.watch(`levels.${left}.minTasks`) ?? 0;
    const rightMin = form.watch(`levels.${right}.minTasks`) ?? 0;
    return leftMin - rightMin;
  });

  return (
    <section className="settings-busy-rules">
      <h3 className="settings-section__title">日历忙碌状态</h3>
      <p className="settings-section__hint">
        根据当天任务数量，决定日历里显示的忙碌状态。
      </p>

      {loading ? <p className="settings-section__hint">加载中…</p> : null}
      {loadError ? (
        <p className="settings-section__error" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError ? (
        <form className="settings-busy-rules__form" onSubmit={onSave}>
          {sortedLevelIndexes.map((levelIndex, displayIndex) => {
            const isLastLevel = displayIndex === sortedLevelIndexes.length - 1;
            const levelErrors = errors.levels?.[levelIndex];
            const emoji = form.watch(`levels.${levelIndex}.emoji`) ?? "";
            const name = form.watch(`levels.${levelIndex}.name`) ?? "";
            const minTasks = form.watch(`levels.${levelIndex}.minTasks`) ?? 0;
            const maxTasks = form.watch(`levels.${levelIndex}.maxTasks`);
            const messages = form.watch(`levels.${levelIndex}.messages`) ?? [];

            return (
              <article
                key={levelFields[levelIndex]?.fieldKey ?? levelIndex}
                className="settings-busy-rules__card"
              >
                <header className="settings-busy-rules__card-header">
                  <span className="settings-busy-rules__card-title">
                    <span aria-hidden="true">{emoji || "🙂"}</span>
                    <span>{name || "未命名档位"}</span>
                  </span>
                  <span className="settings-busy-rules__range-preview">
                    任务数：
                    {formatBusyRangeLabel(
                      minTasks,
                      maxTasks === "" ? null : maxTasks ?? null,
                      isLastLevel,
                    )}
                  </span>
                </header>

                <div className="settings-busy-rules__fields">
                  <Input
                    label="Emoji"
                    {...register(`levels.${levelIndex}.emoji`)}
                    error={levelErrors?.emoji?.message}
                  />
                  <Input
                    label="名称"
                    {...register(`levels.${levelIndex}.name`)}
                    error={levelErrors?.name?.message}
                  />
                  <div className="settings-busy-rules__range-row">
                    <Input
                      label="最小任务数"
                      type="number"
                      min={0}
                      step={1}
                      {...register(`levels.${levelIndex}.minTasks`, { valueAsNumber: true })}
                      error={levelErrors?.minTasks?.message}
                    />
                    {isLastLevel ? (
                      <div className="settings-busy-rules__open-ended">
                        <span className="settings-section__label">最大任务数</span>
                        <p className="settings-busy-rules__open-ended-value">{minTasks}+</p>
                      </div>
                    ) : (
                      <Input
                        label="最大任务数"
                        type="number"
                        min={0}
                        step={1}
                        {...register(`levels.${levelIndex}.maxTasks`, { valueAsNumber: true })}
                        error={levelErrors?.maxTasks?.message}
                      />
                    )}
                  </div>
                </div>

                <div className="settings-busy-rules__messages">
                  <p className="settings-section__label">随机文案</p>
                  <ul className="settings-busy-rules__message-list">
                    {messages.map((message, messageIndex) => (
                      <li
                        key={message.clientId || `${levelIndex}-${messageIndex}`}
                        className="settings-busy-rules__message-item"
                      >
                        <Input
                          label={`文案 ${messageIndex + 1}`}
                          {...register(
                            `levels.${levelIndex}.messages.${messageIndex}.content`,
                          )}
                          error={
                            levelErrors?.messages?.[messageIndex]?.content?.message ??
                            (typeof levelErrors?.messages?.message === "string"
                              ? levelErrors.messages.message
                              : undefined)
                          }
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={messages.length <= 1}
                          onClick={() => {
                            const current = form.getValues(`levels.${levelIndex}.messages`);
                            if (current.length <= 1) {
                              return;
                            }
                            form.setValue(
                              `levels.${levelIndex}.messages`,
                              current.filter((_, index) => index !== messageIndex),
                              { shouldDirty: true, shouldValidate: true },
                            );
                          }}
                        >
                          删除文案
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="settings-busy-rules__message-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const current = form.getValues(`levels.${levelIndex}.messages`);
                        form.setValue(
                          `levels.${levelIndex}.messages`,
                          [...current, createEmptyMessage()],
                          { shouldDirty: true },
                        );
                      }}
                    >
                      添加文案
                    </Button>
                  </div>
                </div>

                <div className="settings-busy-rules__card-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={levelFields.length <= 1}
                    onClick={() => onRemoveLevel(levelIndex)}
                  >
                    删除档位
                  </Button>
                </div>
              </article>
            );
          })}

          <div className="settings-busy-rules__toolbar">
            <Button type="button" variant="secondary" onClick={onAddLevel}>
              添加档位
            </Button>
          </div>

          {saveError ? (
            <p className="settings-section__error" role="alert">
              {saveError}
            </p>
          ) : null}
          {saveSuccess && !isDirty ? (
            <p className="settings-busy-rules__success" aria-live="polite">
              已保存
            </p>
          ) : null}

          <div className="settings-busy-rules__save-actions">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "保存中…" : "保存"}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
