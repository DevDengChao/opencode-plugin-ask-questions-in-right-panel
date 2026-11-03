export interface Labels {
  title: string
  question: string
  answered: (answered: number, total: number) => string
  answeredFlag: string
  dismiss: string
  submit: string
  submitting: string
  close: string
  other: string
  otherHint: string
  customPlaceholder: string
  freeTextPlaceholder: string
  queue: (count: number) => string
  currentSession: string
  untitledSession: string
  questionN: (index: number) => string
  noPending: string
  requestFailed: string
  cancelled: string
}

const zh: Labels = {
  title: "问题",
  question: "问题",
  answered: (answered, total) => `已答 ${answered} / ${total}`,
  answeredFlag: "已答",
  dismiss: "忽略",
  submit: "提交",
  submitting: "提交中…",
  close: "关闭",
  other: "其他…",
  otherHint: "输入你自己的答案",
  customPlaceholder: "输入自定义答案…",
  freeTextPlaceholder: "输入回答…",
  queue: (count) => `${count} 个待答问题`,
  currentSession: "当前会话",
  untitledSession: "未命名会话",
  questionN: (index) => `问题 ${index}`,
  noPending: "当前没有待回答的问题。",
  requestFailed: "提交失败",
  cancelled: "问题已取消",
}

const en: Labels = {
  title: "Questions",
  question: "Question",
  answered: (answered, total) => `${answered} of ${total} answered`,
  answeredFlag: "Answered",
  dismiss: "Dismiss",
  submit: "Submit",
  submitting: "Submitting…",
  close: "Close",
  other: "Other…",
  otherHint: "Type your own answer",
  customPlaceholder: "Type a custom answer…",
  freeTextPlaceholder: "Type your answer…",
  queue: (count) => `${count} pending questions`,
  currentSession: "Current session",
  untitledSession: "Untitled session",
  questionN: (index) => `Question ${index}`,
  noPending: "No pending questions.",
  requestFailed: "Request failed",
  cancelled: "The question was cancelled",
}

export function labelsFor(locale: string): Labels {
  return locale.toLowerCase().startsWith("zh") ? zh : en
}
