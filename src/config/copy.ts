export const copy = {
  today: {
    emptyTitle: "今天居然没什么事",
    emptyDescription: "班味暂未加载。先喝口水，有事了再记一笔。",
  },
  reminder: {
    emotion: {
      ddl_60: { emoji: "🙂", label: "轻轻提醒" },
      ddl_30: { emoji: "😐", label: "开始催啦" },
      ddl_10: { emoji: "😟", label: "有点着急" },
      ddl_due: { emoji: "😱", label: "到点啦" },
    },
    customEmotion: { emoji: "🙂", label: "自定义提醒" },
    fallbackEmotion: { emoji: "🙂", label: "提醒一下" },
    headline: {
      ddl_60: "距离 DDL 还有 1 小时",
      ddl_30: "距离 DDL 还有 30 分钟",
      ddl_10: "距离 DDL 还有 10 分钟",
      ddl_due: "DDL 到啦",
      customFallback: "该提醒啦",
      fallback: "提醒一下",
    },
    remaining: {
      ddl_60: "剩余约 1 小时",
      ddl_30: "剩余约 30 分钟",
      ddl_10: "剩余约 10 分钟",
      ddl_due: "已到 DDL",
      custom: "提醒时间到",
      fallback: "请关注截止时间",
    },
    kind: {
      ddl_60: "DDL 前 60 分钟",
      ddl_30: "DDL 前 30 分钟",
      ddl_10: "DDL 前 10 分钟",
      ddl_due: "DDL 到点",
      custom: "自定义提醒",
      fallback: "系统提醒",
    },
  },
  ddl: {
    emotions: {
      calm: "从容",
      notice: "注意",
      anxious: "着急",
      panic: "慌张",
      burning: "火烧眉毛",
      overdue: "已逾期",
    },
  },
  overtime: {
    title: "加班模式",
    label: "已加班",
    end: "结束加班",
  },
  workEnd: {
    decisionTitle: "理论下班时间到",
    decisionMessage: "今天的正常打工时间结束了。",
    confirmOff: "正常下班",
    startOvertime: "开启加班模式",
    completeTitle: "今天的工作到此为止",
  },
  lunch: {
    title: "到饭点啦",
  },
} as const;

export type AppCopy = typeof copy;
