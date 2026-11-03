import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { produce, type SetStoreFunction, type Store } from "solid-js/store"
import type { FormInfo, FormOption } from "@opencode/client/promise"
import type { Context, MountedSession } from "@opencode/plugin/gui"
import {
  answerValues,
  answeredCount,
  buildAnswer,
  createDraft,
  isAnswered,
  pendingQuestions,
  questionFields,
  toggleValue,
  type FormSource,
  type PendingQuestion,
  type QuestionDraft,
  type QuestionField,
} from "./forms"
import { labelsFor } from "./labels"

const EMPTY_DRAFT: QuestionDraft = { answers: {}, custom: {}, customOn: {} }

export interface QuestionPanelProps {
  readonly ctx: Context
  readonly session: MountedSession
  readonly panelKey: string
  readonly drafts: Store<Record<string, QuestionDraft>>
  readonly setDrafts: SetStoreFunction<Record<string, QuestionDraft>>
}

function optionsOf(field: QuestionField): readonly FormOption[] {
  return field.type === "string" ? (field.options ?? []) : field.options
}

function isFreeText(field: QuestionField): boolean {
  return field.type === "string" && (field.options?.length ?? 0) === 0
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function QuestionPanel(props: QuestionPanelProps) {
  const [activeID, setActiveID] = createSignal<string>()
  const [busy, setBusy] = createSignal(false)

  const labels = () => labelsFor(props.ctx.locale.locale())

  const source = (): FormSource => {
    const data = props.session.server.data

    return {
      sessions: () => data.session.list(),
      forms: (sessionID) => data.session.form.list(sessionID),
    }
  }

  const pending = createMemo(() => pendingQuestions(props.session.id, source()))

  const active = createMemo<PendingQuestion | undefined>(() => {
    const list = pending()
    const id = activeID()

    return list.find((item) => item.form.id === id) ?? list[0]
  })

  const draft = createMemo(() => {
    const item = active()

    return item ? (props.drafts[item.form.id] ?? EMPTY_DRAFT) : EMPTY_DRAFT
  })

  const counts = createMemo(() => {
    const item = active()

    if (!item) return { answered: 0, total: 0 }

    return { answered: answeredCount(item.form, draft()), total: questionFields(item.form).length }
  })

  // Start every pending form with its defaults, so the first render already shows them.
  createEffect(() => {
    for (const item of pending()) {
      if (!props.drafts[item.form.id]) props.setDrafts(item.form.id, createDraft(item.form))
    }
  })

  const mutate = (change: (draft: QuestionDraft) => void) => {
    const item = active()

    if (!item) return

    if (!props.drafts[item.form.id]) props.setDrafts(item.form.id, createDraft(item.form))

    props.setDrafts(item.form.id, produce(change))
  }

  const pick = (field: QuestionField, value: string) =>
    mutate((draft) => {
      draft.answers[field.key] = toggleValue(draft.answers[field.key] ?? [], value, field.type === "multiselect")

      if (field.type === "string") draft.customOn[field.key] = false
    })

  const startCustom = (field: QuestionField) =>
    mutate((draft) => {
      draft.customOn[field.key] = true
    })

  const setCustom = (field: QuestionField, value: string) =>
    mutate((draft) => {
      draft.custom[field.key] = value
      draft.customOn[field.key] = true

      if (field.type === "string" && value.trim().length > 0) draft.answers[field.key] = []
    })

  const setCustomOn = (field: QuestionField, on: boolean) =>
    mutate((draft) => {
      draft.customOn[field.key] = on
    })

  const close = () => props.ctx.layout.close(props.panelKey, props.session)

  const reply = async () => {
    const item = active()

    if (!item || busy()) return

    setBusy(true)

    try {
      await props.session.server.data.session.form.reply({
        sessionID: item.sessionID,
        formID: item.form.id,
        answer: buildAnswer(item.form, draft()),
      })
    } catch (error) {
      props.ctx.toast.show({
        title: labels().requestFailed,
        description: messageOf(error),
        variant: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  const dismiss = async () => {
    const item = active()

    if (!item || busy()) return

    setBusy(true)

    try {
      await props.session.server.data.session.form.cancel({ sessionID: item.sessionID, formID: item.form.id })
    } catch (error) {
      props.ctx.toast.show({
        title: labels().requestFailed,
        description: messageOf(error),
        variant: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing) return

    if (event.key === "Escape") {
      event.preventDefault()
      void dismiss()
      return
    }

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void reply()
    }
  }

  const onSectionKeyDown = (field: QuestionField, event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return

    const target = event.target as HTMLElement | null

    if (target?.closest("textarea, input")) return
    if (event.key.length !== 1) return

    const index = Number(event.key)
    const option = optionsOf(field)[index - 1]

    if (!Number.isInteger(index) || index < 1 || !option) return

    event.preventDefault()
    pick(field, option.value)
  }

  const sessionLabel = (item: PendingQuestion) => {
    if (item.sessionID === props.session.id) return labels().currentSession

    const info = props.session.server.data.session.list().find((session) => session.id === item.sessionID)

    return info?.title ?? labels().untitledSession
  }

  const formLabel = (form: FormInfo) => {
    const field = questionFields(form)[0]

    return field?.title ?? field?.description ?? labels().questionN(1)
  }

  return (
    <div class="aqrp" onKeyDown={onKeyDown}>
      <header class="aqrp-head">
        <span class="aqrp-eyebrow">{labels().question}</span>
        <span class="aqrp-count">{labels().answered(counts().answered, counts().total)}</span>
        <props.ctx.ui.IconButton icon="close" label={labels().close} size="small" variant="ghost" onClick={close} />
      </header>

      <Show when={pending().length > 1}>
        <div class="aqrp-queue">
          <div class="aqrp-queue-title">{labels().queue(pending().length)}</div>
          <For each={pending()}>
            {(item, index) => (
              <button
                type="button"
                class="aqrp-queue-item"
                data-active={item.form.id === active()?.form.id}
                onClick={() => setActiveID(item.form.id)}
              >
                <span class="aqrp-queue-badge" aria-hidden="true">
                  {index() + 1}
                </span>
                <span class="aqrp-queue-label">
                  <span class="aqrp-queue-session">{sessionLabel(item)}</span>
                  <span class="aqrp-queue-form">{formLabel(item.form)}</span>
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>

      <div class="aqrp-scroll">
        <Show when={active()} fallback={<p class="aqrp-empty">{labels().noPending}</p>}>
          {(item) => (
            <div class="aqrp-sections">
              <For each={questionFields(item().form)}>
                {(field, index) => {
                  let textarea: HTMLTextAreaElement | undefined

                  const multiple = field.type === "multiselect"
                  const options = optionsOf(field)
                  const freeText = isFreeText(field)
                  const values = () => draft().answers[field.key] ?? []
                  const custom = () => draft().custom[field.key] ?? ""
                  const customOn = () => draft().customOn[field.key] ?? false
                  const customPicked = () => customOn() && custom().trim().length > 0

                  const toggleCustom = () => {
                    if (multiple && customOn()) {
                      setCustomOn(field, false)
                      return
                    }

                    startCustom(field)
                    textarea?.focus()
                  }

                  return (
                    <section
                      class="aqrp-section"
                      data-answered={isAnswered(field, draft())}
                      onKeyDown={(event) => onSectionKeyDown(field, event)}
                    >
                      <header class="aqrp-section-head">
                        <span class="aqrp-index" aria-hidden="true">
                          {index() + 1}
                        </span>
                        <span class="aqrp-section-title">
                          <span class="aqrp-section-name">
                            {field.title ?? labels().questionN(index() + 1)}
                          </span>
                          <Show when={field.description}>
                            <span class="aqrp-section-desc">{field.description}</span>
                          </Show>
                        </span>
                        <Show when={isAnswered(field, draft())}>
                          <span class="aqrp-answered">{labels().answeredFlag}</span>
                        </Show>
                      </header>

                      <Show
                        when={!freeText}
                        fallback={
                          <div class="aqrp-free-text">
                            <textarea
                              ref={(element) => (textarea = element)}
                              class="aqrp-textarea"
                              rows={2}
                              placeholder={labels().freeTextPlaceholder}
                              value={custom()}
                              onInput={(event) => setCustom(field, event.currentTarget.value)}
                            />
                          </div>
                        }
                      >
                        <div
                          class="aqrp-options"
                          role={multiple ? "group" : "radiogroup"}
                          aria-label={field.description ?? field.title ?? labels().questionN(index() + 1)}
                        >
                          <For each={options}>
                            {(option, optionIndex) => (
                              <button
                                type="button"
                                class="aqrp-option"
                                data-picked={values().includes(option.value)}
                                role={multiple ? "checkbox" : "radio"}
                                aria-checked={values().includes(option.value)}
                                onClick={() => pick(field, option.value)}
                              >
                                <span class="aqrp-key" aria-hidden="true">
                                  {optionIndex() < 9 ? optionIndex() + 1 : ""}
                                </span>
                                <span
                                  class="aqrp-mark"
                                  data-kind={multiple ? "check" : "radio"}
                                  aria-hidden="true"
                                />
                                <span class="aqrp-option-body">
                                  <span class="aqrp-option-label">{option.label}</span>
                                  <Show when={option.description}>
                                    <span class="aqrp-option-desc">{option.description}</span>
                                  </Show>
                                </span>
                              </button>
                            )}
                          </For>

                          <Show when={field.custom}>
                            <div
                              class="aqrp-option aqrp-custom-option"
                              data-picked={customPicked()}
                              data-editing={customOn()}
                              role={multiple ? "checkbox" : "radio"}
                              aria-checked={customPicked()}
                              tabIndex={0}
                              onClick={toggleCustom}
                              onKeyDown={(event) => {
                                if (event.target !== event.currentTarget) return
                                if (event.key !== "Enter" && event.key !== " ") return

                                event.preventDefault()
                                toggleCustom()
                              }}
                            >
                              <span class="aqrp-key" aria-hidden="true">
                                {options.length < 9 ? options.length + 1 : ""}
                              </span>
                              <span class="aqrp-mark" data-kind={multiple ? "check" : "radio"} aria-hidden="true" />
                              <span class="aqrp-option-body">
                                <span class="aqrp-option-label">{labels().other}</span>
                                <Show
                                  when={customOn()}
                                  fallback={<span class="aqrp-option-desc">{labels().otherHint}</span>}
                                >
                                  <textarea
                                    ref={(element) => (textarea = element)}
                                    class="aqrp-textarea aqrp-custom"
                                    rows={2}
                                    placeholder={labels().customPlaceholder}
                                    value={custom()}
                                    onClick={(event) => event.stopPropagation()}
                                    onInput={(event) => setCustom(field, event.currentTarget.value)}
                                    onFocus={() => startCustom(field)}
                                  />
                                </Show>
                              </span>
                            </div>
                          </Show>
                        </div>
                      </Show>
                    </section>
                  )
                }}
              </For>
            </div>
          )}
        </Show>
      </div>

      <Show when={active()}>
        <footer class="aqrp-footer">
          <props.ctx.ui.Button variant="ghost" onClick={() => void dismiss()} disabled={busy()}>
            {labels().dismiss}
          </props.ctx.ui.Button>
          <span class="aqrp-spacer" />
          <props.ctx.ui.Button variant="contrast" busy={busy()} onClick={() => void reply()}>
            {busy() ? labels().submitting : labels().submit}
          </props.ctx.ui.Button>
        </footer>
      </Show>
    </div>
  )
}
