export const copy = {
  today: {
    emptyTitle: "今天居然没什么事",
    emptyDescription: "班味暂未加载。先喝口水，有事了再记一笔。",
  },
  reminder: {
    emotion: {
      progress_half: { emoji: "🙂", label: "工期过半" },
      quarter_remaining: { emoji: "😐", label: "死线逼近" },
      one_hour_remaining: { emoji: "😟", label: "最后一小时" },
      ddl_due: { emoji: "💥", label: "到点爆炸" },
    },
    customEmotion: { emoji: "🙂", label: "自定义提醒" },
    fallbackEmotion: { emoji: "🙂", label: "提醒一下" },
    headline: {
      progress_half: "工期已烧掉一半，你的进度还在加载企业文化。",
      quarter_remaining: "只剩四分之一。建议停止同步上下文，上下文已经开始同步你的死线。",
      one_hour_remaining: "最后一小时。现在开始努力，至少能显得之前不是纯摸鱼。",
      ddl_due: "这活正式炸了。现在处理还能叫抢救，再拖就只能叫考古。",
      customFallback: "该提醒啦",
      fallback: "提醒一下",
    },
    remaining: {
      progress_half: "工期已消耗 50%",
      quarter_remaining: "工期仅剩 25%",
      one_hour_remaining: "距离完成时间仅剩 1 小时",
      ddl_due: "截止时间已到",
      custom: "提醒时间到",
      fallback: "请关注截止时间",
    },
    kind: {
      progress_half: "进度过半",
      quarter_remaining: "剩余四分之一",
      one_hour_remaining: "最后一小时",
      ddl_due: "到点爆炸",
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
