import { describe, expect, it } from "vitest"
import type { FormField, FormInfo, FormMultiselectField, FormStringField } from "@opencode/client/promise"
import {
  answeredCount,
  answerValues,
  buildAnswer,
  createDraft,
  pendingQuestions,
  questionFields,
  sessionTreeIDs,
  toggleValue,
  type FormSource,
  type SessionNode,
} from "../src/forms"

function form(id: string, sessionID: string, fields: FormField[], kind = "question"): FormInfo {
  return {
    id,
    sessionID,
    title: "Question",
    metadata: { kind },
    fields: fields as unknown as FormInfo["fields"],
  }
}

function choice(key: string, values: string[], extra: Partial<FormStringField> = {}): FormStringField {
  return {
    key,
    type: "string",
    title: key,
    options: values.map((value) => ({ value, label: value })),
    ...extra,
  }
}

function multi(key: string, values: string[], extra: Partial<FormMultiselectField> = {}): FormMultiselectField {
  return {
    key,
    type: "multiselect",
    title: key,
    options: values.map((value) => ({ value, label: value })),
    ...extra,
  }
}

function source(sessions: SessionNode[], forms: Record<string, FormInfo[]>): FormSource {
  return {
    sessions: () => sessions,
    forms: (sessionID) => forms[sessionID],
  }
}

describe("sessionTreeIDs", () => {
  it("walks breadth first and keeps the routed session first", () => {
    const sessions: SessionNode[] = [
      { id: "a", parentID: "root" },
      { id: "b", parentID: "a" },
      { id: "c", parentID: "root" },
      { id: "d", parentID: "b" },
    ]

    expect(sessionTreeIDs(sessions, "root")).toEqual(["root", "a", "c", "b", "d"])
  })

  it("ignores sessions outside the tree and repeats", () => {
    const sessions: SessionNode[] = [
      { id: "a", parentID: "other" },
      { id: "b", parentID: "root" },
      { id: "c", parentID: "root" },
    ]

    expect(sessionTreeIDs(sessions, "root")).toEqual(["root", "b", "c"])
  })
})

describe("pendingQuestions", () => {
  it("collects question forms in tree order and skips other form kinds", () => {
    const forms = {
      root: [form("root-1", "root", [choice("one", ["a"])])],
      running: [form("child-1", "running", [choice("two", ["b"])])],
      idle: [form("idle-1", "idle", [choice("three", ["c"])])],
      other: [form("other-1", "other", [choice("four", ["d"])], "websearch.provider")],
    }
    const sessions: SessionNode[] = [
      { id: "running", parentID: "root" },
      { id: "idle", parentID: "root" },
      { id: "other", parentID: "root" },
    ]

    expect(pendingQuestions("root", source(sessions, forms)).map((item) => item.form.id)).toEqual([
      "root-1",
      "child-1",
      "idle-1",
    ])
  })

  it("returns nothing when no question is pending", () => {
    const forms = { root: [form("root-1", "root", [choice("one", ["a"])], "mcp-elicitation")] }

    expect(pendingQuestions("root", source([], forms))).toEqual([])
  })
})

describe("questionFields", () => {
  it("keeps single and multi choice fields only", () => {
    const info = form("form-1", "root", [
      choice("one", ["a"]),
      { key: "count", type: "integer" } as FormField,
      multi("many", ["a", "b"]),
    ])

    expect(questionFields(info).map((field) => field.key)).toEqual(["one", "many"])
  })
})

describe("createDraft", () => {
  it("starts from the field defaults", () => {
    const info = form("form-1", "root", [
      { ...choice("one", ["a", "b"]), default: "b" },
      { ...multi("many", ["a", "b"]), default: ["a"] },
    ])

    expect(createDraft(info)).toEqual({
      answers: { one: ["b"], many: ["a"] },
      custom: {},
      customOn: {},
    })
  })

  it("puts a free-text default in the textarea", () => {
    const info = form("form-1", "root", [
      { key: "note", type: "string", title: "note", default: "hello" } as FormStringField,
    ])

    expect(createDraft(info)).toEqual({
      answers: {},
      custom: { note: "hello" },
      customOn: { note: true },
    })
  })
})

describe("toggleValue", () => {
  it("replaces a single choice", () => {
    expect(toggleValue(["a"], "b", false)).toEqual(["b"])
  })

  it("toggles a multi choice", () => {
    expect(toggleValue(["a"], "b", true)).toEqual(["a", "b"])
    expect(toggleValue(["a", "b"], "a", true)).toEqual(["b"])
  })
})

describe("buildAnswer", () => {
  it("uses the first value for a single choice and the list for a multi choice", () => {
    const info = form("form-1", "root", [choice("one", ["a", "b"]), multi("many", ["a", "b"])])

    expect(
      buildAnswer(info, {
        answers: { one: ["b"], many: ["a", "b"] },
        custom: {},
        customOn: {},
      }),
    ).toEqual({ one: "b", many: ["a", "b"] })
  })

  it("adds custom text and leaves unanswered fields out", () => {
    const info = form("form-1", "root", [choice("one", ["a", "b"], { custom: true }), choice("two", ["a", "b"])])

    const draft = {
      answers: { one: ["a"] },
      custom: { one: "  mine  " },
      customOn: { one: true },
    }

    expect(buildAnswer(info, draft)).toEqual({ one: "mine" })
    expect(answeredCount(info, draft)).toBe(1)
  })

  it("keeps custom text alongside multi choices without repeating it", () => {
    const info = form("form-1", "root", [multi("many", ["a", "b"], { custom: true })])

    expect(
      buildAnswer(info, {
        answers: { many: ["a", "mine"] },
        custom: { many: "mine" },
        customOn: { many: true },
      }),
    ).toEqual({ many: ["a", "mine"] })
  })

  it("answers a free-text field from its textarea", () => {
    const info = form("form-1", "root", [{ key: "note", type: "string", title: "note" } as FormStringField])

    expect(
      buildAnswer(info, {
        answers: {},
        custom: { note: "hello" },
        customOn: { note: true },
      }),
    ).toEqual({ note: "hello" })
  })
})

describe("answerValues", () => {
  it("lets custom text replace a single choice and ignores blank custom text", () => {
    const field = choice("one", ["a"], { custom: true })

    expect(
      answerValues(field, { answers: { one: ["a"] }, custom: { one: "mine" }, customOn: { one: true } }),
    ).toEqual(["mine"])

    expect(
      answerValues(field, { answers: { one: ["a"] }, custom: { one: "   " }, customOn: { one: true } }),
    ).toEqual(["a"])
  })
})
