import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  defaultWorkTimeValues,
  workTimeFormSchema,
  type WorkTimeFormValues,
} from "../features/settings/workTimeForm";
import { StatusCopySection } from "../features/settings/StatusCopySection";
import { BusyRuleSection } from "../features/settings/BusyRuleSection";
import {
  clearTodayWorkOverride,
  formatWorkTimeRange,
  getLunchSchedule,
  getWorkSchedule,
  mapSettingsError,
  saveDefaultWorkTimes,
  saveLunchTimes,
  saveTodayWorkOverride,
  type LunchSchedule,
  type SettingsAppError,
  type WorkSchedule,
} from "../services/tauri/settings";
import { Button, Card, Input, Modal } from "../shared/ui";
import "./SettingsPage.css";

export function SettingsPage() {
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [lunchSchedule, setLunchSchedule] = useState<LunchSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [defaultSaveError, setDefaultSaveError] = useState<string | null>(null);
  const [lunchSaveError, setLunchSaveError] = useState<string | null>(null);
  const [todayActionError, setTodayActionError] = useState<string | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideSubmitError, setOverrideSubmitError] = useState<string | null>(null);

  const defaultForm = useForm<WorkTimeFormValues>({
    resolver: zodResolver(workTimeFormSchema),
    defaultValues: defaultWorkTimeValues("09:30", "18:30"),
  });

  const lunchForm = useForm<WorkTimeFormValues>({
    resolver: zodResolver(workTimeFormSchema),
    defaultValues: defaultWorkTimeValues("12:00", "13:00"),
  });

  const overrideForm = useForm<WorkTimeFormValues>({
    resolver: zodResolver(workTimeFormSchema),
    defaultValues: defaultWorkTimeValues("09:30", "18:30"),
  });

  const refreshSchedule = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [next, nextLunch] = await Promise.all([
        getWorkSchedule(),
        getLunchSchedule(),
      ]);
      setSchedule(next);
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

  useEffect(() => {
    if (!overrideModalOpen || !schedule) {
      return;
    }
    overrideForm.reset(
      defaultWorkTimeValues(schedule.effectiveStart, schedule.effectiveEnd),
    );
    setOverrideSubmitError(null);
  }, [overrideModalOpen, overrideForm, schedule]);

  const onSaveDefault = defaultForm.handleSubmit(async (values) => {
    setDefaultSaveError(null);
    try {
      const next = await saveDefaultWorkTimes({
        startTime: values.startTime,
        endTime: values.endTime,
      });
      setSchedule(next);
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

  const onSaveTodayOverride = overrideForm.handleSubmit(async (values) => {
    setOverrideSubmitError(null);
    try {
      const next = await saveTodayWorkOverride({
        startTime: values.startTime,
        endTime: values.endTime,
      });
      setSchedule(next);
      setOverrideModalOpen(false);
    } catch (error) {
      setOverrideSubmitError(mapSettingsError(error as SettingsAppError));
    }
  });

  const onClearTodayOverride = async () => {
    setTodayActionError(null);
    try {
      const next = await clearTodayWorkOverride();
      setSchedule(next);
    } catch (error) {
      setTodayActionError(mapSettingsError(error as SettingsAppError));
    }
  };

  const {
    register: registerDefault,
    formState: { errors: defaultErrors, isSubmitting: isSavingDefault },
  } = defaultForm;

  const {
    register: registerLunch,
    formState: { errors: lunchErrors, isSubmitting: isSavingLunch },
  } = lunchForm;

  const {
    register: registerOverride,
    formState: { errors: overrideErrors, isSubmitting: isSavingOverride },
  } = overrideForm;

  return (
    <>
      <Card title="设置" headerAccent>
        <section className="settings-section">
          <h3 className="settings-section__title">工作时间</h3>

          {loading ? <p className="settings-section__hint">加载中…</p> : null}
          {loadError ? (
            <p className="settings-section__error" role="alert">
              {loadError}
            </p>
          ) : null}

          {!loading && !loadError ? (
            <>
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

              <div className="settings-work-time settings-work-time--today">
                <p className="settings-section__label">今日工作时间</p>
                <p className="settings-work-time__effective">
                  当前生效：
                  {schedule
                    ? formatWorkTimeRange(
                        schedule.effectiveStart,
                        schedule.effectiveEnd,
                      )
                    : "—"}
                </p>
                {todayActionError ? (
                  <p className="settings-section__error" role="alert">
                    {todayActionError}
                  </p>
                ) : null}
                <div className="settings-work-time__actions">
                  <Button
                    variant="secondary"
                    onClick={() => setOverrideModalOpen(true)}
                  >
                    仅修改今天
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void onClearTodayOverride()}
                    disabled={!schedule?.hasTodayOverride}
                  >
                    恢复默认
                  </Button>
                </div>
              </div>
            </>
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
        {!loading && !loadError ? <BusyRuleSection /> : null}
      </Card>

      <Modal
        open={overrideModalOpen}
        title="仅修改今天"
        onClose={() => setOverrideModalOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setOverrideModalOpen(false)}
              disabled={isSavingOverride}
            >
              取消
            </Button>
            <Button
              type="submit"
              form="today-work-override-form"
              disabled={isSavingOverride}
            >
              {isSavingOverride ? "保存中…" : "保存"}
            </Button>
          </>
        }
      >
        <form
          id="today-work-override-form"
          className="settings-work-time settings-work-time--modal"
          onSubmit={onSaveTodayOverride}
        >
          <p className="settings-section__hint">
            今天的临时调整只影响今天，明天会自动恢复默认时间。
          </p>
          <div className="settings-work-time__row">
            <Input
              label="今天上班时间"
              type="time"
              step={60}
              autoFocus
              error={overrideErrors.startTime?.message}
              {...registerOverride("startTime")}
            />
            <span className="settings-work-time__separator">至</span>
            <Input
              label="今天下班时间"
              type="time"
              step={60}
              error={overrideErrors.endTime?.message}
              {...registerOverride("endTime")}
            />
          </div>
          {overrideSubmitError ? (
            <p className="settings-section__error" role="alert">
              {overrideSubmitError}
            </p>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
