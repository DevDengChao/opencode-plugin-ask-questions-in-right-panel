import type {
  FormAnswer,
  FormField,
  FormInfo,
  FormMultiselectField,
  FormStringField,
} from "@opencode/client/promise"

/** A form field the question dock renders: a single choice or a multi choice. */
export type QuestionField = FormStringField | FormMultiselectField

/** The part of a session the tree walk needs. */
export interface SessionNode {
  readonly id: string
  readonly parentID?: string
}

/** Where `pendingQuestions` reads sessions and their forms from. */
export interface FormSource {
  readonly sessions: () => readonly SessionNode[]
  readonly forms: (sessionID: string) => readonly FormInfo[] | undefined
}

/** A pending question form and the session that owns it. */
export interface PendingQuestion {
  readonly sessionID: string
  readonly form: FormInfo
}

/** The in-progress answers of one form, kept while the panel is closed or another form is shown. */
export interface QuestionDraft {
  /** Picked option values per field key, as a list even for a single choice. */
  readonly answers: Record<string, string[]>
  /** The custom answer text per field key. */
  readonly custom: Record<string, string>
  /** Whether the custom answer counts as a pick per field key. */
  readonly customOn: Record<string, boolean>
}

export function isQuestionField(field: FormField): field is QuestionField {
  return field.type === "string" || field.type === "multiselect"
}

/** The fields a question form asks, in order. Other field kinds belong to other form UIs. */
export function questionFields(form: FormInfo): QuestionField[] {
  return form.fields.filter(isQuestionField)
}

/**
 * The routed session and its descendants, breadth first, matching the order the host uses to pick
 * the question it shows.
 */
export function sessionTreeIDs(sessions: readonly SessionNode[], rootID: string): string[] {
  const children = new Map<string, string[]>()

  for (const session of sessions) {
    if (!session.parentID) continue

    const list = children.get(session.parentID)

    if (list) list.push(session.id)
    else children.set(session.parentID, [session.id])
  }

  const seen = new Set([rootID])
  const ids = [rootID]

  for (const id of ids) {
    for (const child of children.get(id) ?? []) {
      if (seen.has(child)) continue

      seen.add(child)
      ids.push(child)
    }
  }

  return ids
}

/**
 * Every question form pending in the routed session's tree, in the order the host picks one. The
 * forms store already holds only pending forms: creation and settlement events keep it current.
 */
export function pendingQuestions(rootID: string, source: FormSource): PendingQuestion[] {
  const result: PendingQuestion[] = []

  for (const sessionID of sessionTreeIDs(source.sessions(), rootID)) {
    for (const form of source.forms(sessionID) ?? []) {
      if (form.metadata?.kind === "question") result.push({ sessionID, form })
    }
  }

  return result
}

export function createDraft(form: FormInfo): QuestionDraft {
  const draft: QuestionDraft = { answers: {}, custom: {}, customOn: {} }

  for (const field of questionFields(form)) {
    const value = field.default

    // A string field without options is a free-text answer, so its default belongs in the textarea.
    if (field.type === "string" && (field.options?.length ?? 0) === 0) {
      if (typeof value === "string" && value.length > 0) {
        draft.custom[field.key] = value
        draft.customOn[field.key] = true
      }

      continue
    }

    if (Array.isArray(value)) {
      if (value.length > 0) draft.answers[field.key] = [...value]
      continue
    }

    if (typeof value === "string" && value.length > 0) draft.answers[field.key] = [value]
  }

  return draft
}

/** Applies a pick: a single choice replaces the previous value, a multi choice toggles it. */
export function toggleValue(current: readonly string[], value: string, multiple: boolean): string[] {
  if (!multiple) return [value]

  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
}

/** The answer values of one field, with the custom text included while it is on. */
export function answerValues(field: QuestionField, draft: QuestionDraft): string[] {
  const picked = draft.answers[field.key] ?? []
  const text = (draft.custom[field.key] ?? "").trim()

  if (!draft.customOn[field.key] || !text) return picked

  if (field.type === "string") return [text]

  return picked.includes(text) ? picked : [...picked, text]
}

export function isAnswered(field: QuestionField, draft: QuestionDraft): boolean {
  return answerValues(field, draft).length > 0
}

export function answeredCount(form: FormInfo, draft: QuestionDraft): number {
  return questionFields(form).filter((field) => isAnswered(field, draft)).length
}

/**
 * The reply the server expects: unanswered fields are left out, a multi choice is a list and a single
 * choice is its one value, and custom text rides along as another value.
 */
export function buildAnswer(form: FormInfo, draft: QuestionDraft): FormAnswer {
  const answer: Record<string, string | string[]> = {}

  for (const field of questionFields(form)) {
    const values = answerValues(field, draft)

    if (values.length === 0) continue

    answer[field.key] = field.type === "multiselect" ? values : values[0]
  }

  return answer
}
