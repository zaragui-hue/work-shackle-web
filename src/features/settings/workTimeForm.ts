import { z } from "zod";

export const workTimeFormSchema = z
  .object({
    startTime: z.string().min(1, "请选择上班时间"),
    endTime: z.string().min(1, "请选择下班时间"),
  })
  .superRefine((values, context) => {
    const startMinutes = clockTimeToMinutes(values.startTime);
    const endMinutes = clockTimeToMinutes(values.endTime);
    if (startMinutes === null || endMinutes === null) {
      return;
    }
    if (startMinutes >= endMinutes) {
      context.addIssue({
        code: "custom",
        message: "上班时间必须早于下班时间",
        path: ["endTime"],
      });
    }
  });

export type WorkTimeFormValues = z.infer<typeof workTimeFormSchema>;

export function defaultWorkTimeValues(start: string, end: string): WorkTimeFormValues {
  return {
    startTime: start,
    endTime: end,
  };
}

function clockTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}
