import { z } from "zod";

export const busyRuleMessageSchema = z.object({
  clientId: z.string(),
  content: z.string(),
});

export const busyRuleLevelSchema = z
  .object({
    clientId: z.string(),
    minTasks: z.number({ error: "请输入整数" }).int().min(0, "任务数不能为负"),
    maxTasks: z.union([z.literal(""), z.number({ error: "请输入整数" }).int()]).optional(),
    emoji: z.string().trim().min(1, "请填写 emoji"),
    name: z.string().trim().min(1, "请填写名称"),
    messages: z.array(busyRuleMessageSchema).min(1, "至少保留一条文案"),
  })
  .superRefine((level, context) => {
    const maxValue = level.maxTasks;
    if (maxValue === "" || maxValue === undefined) {
      return;
    }
    if (maxValue < level.minTasks) {
      context.addIssue({
        code: "custom",
        message: "最大任务数不能小于最小任务数",
        path: ["maxTasks"],
      });
    }
  });

export const busyRuleFormSchema = z.object({
  levels: z.array(busyRuleLevelSchema).min(1, "至少保留一个档位"),
});

export type BusyRuleMessageFormValues = z.infer<typeof busyRuleMessageSchema>;
export type BusyRuleLevelFormValues = z.infer<typeof busyRuleLevelSchema>;
export type BusyRuleFormValues = z.infer<typeof busyRuleFormSchema>;

export function createClientId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyMessage(): BusyRuleMessageFormValues {
  return {
    clientId: createClientId("msg"),
    content: "",
  };
}

export function createEmptyLevel(
  minTasks = 0,
  maxTasks: number | "" = "",
): BusyRuleLevelFormValues {
  return {
    clientId: createClientId("level"),
    minTasks,
    maxTasks,
    emoji: "🙂",
    name: "",
    messages: [createEmptyMessage()],
  };
}

export function trimMessages(messages: BusyRuleMessageFormValues[]): string[] {
  return messages
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0);
}

export function toSavePayload(values: BusyRuleFormValues) {
  const sortedLevels = [...values.levels].sort((left, right) => left.minTasks - right.minTasks);

  return {
    levels: sortedLevels.map((level, index) => {
      const isLastLevel = index === sortedLevels.length - 1;
      const maxTasks =
        isLastLevel || level.maxTasks === "" || level.maxTasks === undefined
          ? null
          : level.maxTasks;

      return {
        minTasks: level.minTasks,
        maxTasks,
        emoji: level.emoji.trim(),
        name: level.name.trim(),
        messages: trimMessages(level.messages),
      };
    }),
  };
}

export function fromBusyLevelRules(
  levels: Array<{
    id: string;
    minTasks: number;
    maxTasks: number | null;
    emoji: string;
    name: string;
    messages: Array<{ id: string; content: string }>;
  }>,
): BusyRuleFormValues {
  const sorted = [...levels].sort((left, right) => left.minTasks - right.minTasks);

  return {
    levels: sorted.map((level, index) => {
      const isLastLevel = index === sorted.length - 1;
      return {
        clientId: level.id,
        minTasks: level.minTasks,
        maxTasks: isLastLevel || level.maxTasks === null ? "" : level.maxTasks,
        emoji: level.emoji,
        name: level.name,
        messages:
          level.messages.length > 0
            ? level.messages.map((message) => ({
                clientId: message.id,
                content: message.content,
              }))
            : [createEmptyMessage()],
      };
    }),
  };
}
