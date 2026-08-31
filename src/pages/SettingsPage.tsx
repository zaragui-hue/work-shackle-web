import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  defaultWorkTimeValues,
  workTimeFormSchema,
  type WorkTimeFormValues,
} from "../features/settings/workTimeForm";
import { StatusCopySection } from "../features/settings/StatusCopySection";
import { WorkspaceSection } from "../features/settings/WorkspaceSection";
import {
  formatWorkTimeRange,
  getLunchSchedule,
  getWorkSchedule,
  mapSettingsError,
  saveDefaultWorkTimes,
  saveLunchTimes,
  type LunchSchedule,
  type SettingsAppError,
} from "../services/tauri/settings";
import { Button, Card, Input, Mascot } from "../shared/ui";
import "./SettingsPage.css";

export function SettingsPage() {
  const [lunchSchedule, setLunchSchedule] = useState<LunchSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [defaultSaveError, setDefaultSaveError] = useState<string | null>(null);
  const [lunchSaveError, setLunchSaveError] = useState<string | null>(null);

  const defaultForm = useForm<WorkTimeFormValues>({
    resolver: zodResolver(workTimeFormSchema),
    defaultValues: defaultWorkTimeValues("09:30", "18:30"),
  });

  const lunchForm = useForm<WorkTimeFormValues>({
    resolver: zodResolver(workTimeFormSchema),
    defaultValues: defaultWorkTimeValues("12:00", "13:00"),
  });

  const refreshSchedule = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [next, nextLunch] = await Promise.all([
        getWorkSchedule(),
        getLunchSchedule(),
      ]);
      setLunchSchedule(nextLunch);
      defaultForm.reset(defaultWorkTimeValues(next.defaultStart, next.defaultEnd));
      lunchForm.reset(defaultWorkTimeValues(nextLunch.lunchStart, nextLunch.lunchEnd));
    } catch (error) {
      setLoadError(mapSettingsError(error as SettingsAppError));
    } finally {
      setLoading(false);
    }
  }, [defaultForm, lunchForm]);

  useEffect(() => {
    void refreshSchedule();
  }, [refreshSchedule]);

  const onSaveDefault = defaultForm.handleSubmit(async (values) => {
    setDefaultSaveError(null);
    try {
      const next = await saveDefaultWorkTimes({
        startTime: values.startTime,
        endTime: values.endTime,
      });
      defaultForm.reset(defaultWorkTimeValues(next.defaultStart, next.defaultEnd));
    } catch (error) {
      setDefaultSaveError(mapSettingsError(error as SettingsAppError));
    }
  });

  const onSaveLunch = lunchForm.handleSubmit(async (values) => {
    setLunchSaveError(null);
    try {
      const next = await saveLunchTimes({
        lunchStart: values.startTime,
        lunchEnd: values.endTime,
      });
      setLunchSchedule(next);
      lunchForm.reset(defaultWorkTimeValues(next.lunchStart, next.lunchEnd));
    } catch (error) {
      setLunchSaveError(mapSettingsError(error as SettingsAppError));
    }
  });

  const {
    register: registerDefault,
    formState: { errors: defaultErrors, isSubmitting: isSavingDefault },
  } = defaultForm;

  const {
    register: registerLunch,
    formState: { errors: lunchErrors, isSubmitting: isSavingLunch },
  } = lunchForm;

  return (
    <Card title="工位使用说明 / 生存设置" headerAccent className="settings-page">
      <div className="settings-page__intro">
        <Mascot state="work-neutral" size="sm" className="settings-page__mascot" />
        <div>
          <p className="settings-page__eyebrow">OPERATING MANUAL / 仅供本人</p>
          <h2>规则可以改，班还是得上</h2>
          <p>这里负责调整默认时间、午餐和状态文案，不负责说服老板。</p>
        </div>
      </div>
      {!loading && !loadError ? <WorkspaceSection /> : null}
      <section className="settings-section">
        <h3 className="settings-section__title">工作时间</h3>

        {loading ? <p className="settings-section__hint">加载中…</p> : null}
        {loadError ? (
          <p className="settings-section__error" role="alert">
            {loadError}
          </p>
        ) : null}

        {!loading && !loadError ? (
          <form className="settings-work-time" onSubmit={onSaveDefault}>
            <p className="settings-section__label">默认工作时间</p>
            <div className="settings-work-time__row">
              <Input
                label="上班时间"
                type="time"
                step={60}
                error={defaultErrors.startTime?.message}
                {...registerDefault("startTime")}
              />
              <span className="settings-work-time__separator">至</span>
              <Input
                label="下班时间"
                type="time"
                step={60}
                error={defaultErrors.endTime?.message}
                {...registerDefault("endTime")}
              />
            </div>
            {defaultSaveError ? (
              <p className="settings-section__error" role="alert">
                {defaultSaveError}
              </p>
            ) : null}
            <div className="settings-work-time__actions">
              <Button type="submit" disabled={isSavingDefault}>
                {isSavingDefault ? "保存中…" : "保存"}
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      {!loading && !loadError ? (
        <section className="settings-section">
          <h3 className="settings-section__title">午餐时间</h3>
          <form className="settings-work-time" onSubmit={onSaveLunch}>
            <p className="settings-section__hint">
              到达午餐开始时间后，今日页会轻量提醒一次。不会自动切换工作状态。
            </p>
            <div className="settings-work-time__row">
              <Input
                label="午餐开始"
                type="time"
                step={60}
                error={lunchErrors.startTime?.message}
                {...registerLunch("startTime")}
              />
              <span className="settings-work-time__separator">至</span>
              <Input
                label="午餐结束"
                type="time"
                step={60}
                error={lunchErrors.endTime?.message}
                {...registerLunch("endTime")}
              />
            </div>
            {lunchSchedule ? (
              <p className="settings-work-time__effective">
                当前设置：
                {formatWorkTimeRange(lunchSchedule.lunchStart, lunchSchedule.lunchEnd)}
              </p>
            ) : null}
            {lunchSaveError ? (
              <p className="settings-section__error" role="alert">
                {lunchSaveError}
              </p>
            ) : null}
            <div className="settings-work-time__actions">
              <Button type="submit" disabled={isSavingLunch}>
                {isSavingLunch ? "保存中…" : "保存"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {!loading && !loadError ? <StatusCopySection /> : null}
    </Card>
  );
}
