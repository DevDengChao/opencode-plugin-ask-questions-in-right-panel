import { createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import {
  MenuItem,
  Panel,
  Plugin,
  Style,
  type Context,
  type PanelTab,
  type SessionRef,
} from "@opencode/plugin/gui"
import { pendingQuestions, sessionTreeIDs, type FormSource, type QuestionDraft } from "./forms"
import { labelsFor } from "./labels"
import { QuestionPanel } from "./question-panel"
import styles from "./styles.css?inline"

const PANEL_ID = "questions"

export default Plugin.define({
  setup(ctx) {
    const [drafts, setDrafts] = createStore<Record<string, QuestionDraft>>({})
    const [suppressed, setSuppressed] = createSignal<ReadonlySet<string>>(new Set())
    const panelKey = `${ctx.id}:${PANEL_ID}`

    const source = (session: SessionRef): FormSource => {
      const data = session.server.data

      return {
        sessions: () => data.session.list(),
        forms: (sessionID) => data.session.form.list(sessionID),
      }
    }

    const suppressionKey = (session: SessionRef, formID: string) => `${session.key}\u0000${formID}`

    const isSuppressed = (session: SessionRef, formID: string) =>
      suppressed().has(suppressionKey(session, formID))

    const suppress = (keys: readonly string[]) =>
      setSuppressed((previous) => {
        const next = new Set(previous)

        for (const key of keys) next.add(key)

        return next
      })

    const unsuppress = (keys: readonly string[]) =>
      setSuppressed((previous) => {
        const next = new Set(previous)

        for (const key of keys) next.delete(key)

        return next
      })

    // The host only syncs forms for the routed session and running descendants; do the same, so the
    // panel sees a question even when the host's own composer model is not the one that asked.
    const tree = createMemo(() => {
      const session = ctx.sessions.current()

      if (!session) return ""

      const data = session.server.data

      return sessionTreeIDs(data.session.list(), session.id)
        .filter((id) => id === session.id || data.session.status(id) === "running")
        .join("\n")
    })

    createEffect(() => {
      const session = ctx.sessions.current()
      const ids = tree()

      if (!session || !ids) return

      for (const id of ids.split("\n")) {
        void session.server.data.session.form.sync(id).catch(() => undefined)
      }
    })

    // Open the panel once for each question that arrives, unless the user closed it for that form.
    let opened: string | undefined

    createEffect(() => {
      const session = ctx.sessions.current()

      if (!session || ctx.layout.narrow()) {
        opened = undefined
        return
      }

      const target = pendingQuestions(session.id, source(session)).find(
        (item) => !isSuppressed(session, item.form.id),
      )

      if (!target) {
        opened = undefined
        return
      }

      const id = suppressionKey(session, target.form.id)

      if (opened === id) return

      opened = id
      ctx.layout.open(panelKey, session, { tab: "select" })
    })

    // A form that was answered or cancelled no longer keeps its "closed by the user" mark.
    createEffect(() => {
      const session = ctx.sessions.current()

      if (!session) return

      const prefix = `${session.key}\u0000`
      const alive = new Set(pendingQuestions(session.id, source(session)).map((item) => item.form.id))
      const stale = [...suppressed()].filter(
        (entry) => entry.startsWith(prefix) && !alive.has(entry.slice(prefix.length)),
      )

      if (stale.length > 0) unsuppress(stale)
    })

    // Hide the host's bottom question dock only while this panel is the thing showing that question.
    // Closing the panel, hiding the side region, switching sessions or narrowing the window removes
    // the attribute, and the dock comes back on its own.
    createEffect(() => {
      const session = ctx.sessions.current()
      const hidden =
        !!session &&
        !ctx.layout.narrow() &&
        pendingQuestions(session.id, source(session)).length > 0 &&
        ctx.layout.state(panelKey, session) === "visible"

      document.documentElement.toggleAttribute("data-aqrp-dock", hidden)
    })

    onCleanup(() => document.documentElement.removeAttribute("data-aqrp-dock"))

    let cachedTitle: string | undefined
    let cachedTab: PanelTab | undefined

    const tab = (title: string): PanelTab => {
      if (cachedTab && cachedTitle === title) return cachedTab

      cachedTitle = title
      cachedTab = {
        id: PANEL_ID,
        title,
        closable: "compact",
        label: () => (
          <span class="aqrp-tab">
            <ctx.ui.Icon name="help" size="small" />
            <span>{title}</span>
          </span>
        ),
      }

      return cachedTab
    }

    const panel: Panel = {
      id: PANEL_ID,
      region: "side",
      transient: true,
      list: ({ session }) => {
        if (ctx.layout.narrow()) return []

        const pending = pendingQuestions(session.id, source(session))

        if (!pending.some((item) => !isSuppressed(session, item.form.id))) return []

        return [tab(labelsFor(ctx.locale.locale()).title)]
      },
      render: (props) => (
        <QuestionPanel
          ctx={ctx as Context}
          session={props.session}
          panelKey={panelKey}
          drafts={drafts}
          setDrafts={setDrafts}
        />
      ),
      close: ({ session }) => {
        suppress(
          pendingQuestions(session.id, source(session)).map((item) => suppressionKey(session, item.form.id)),
        )
      },
    }

    ctx.add(Panel, panel)
    ctx.add(Style, styles)

    // The + menu can bring the panel back after the user closed it for a still-pending question.
    ctx.add(MenuItem, () => {
      const session = ctx.sessions.current()

      if (!session || ctx.layout.narrow()) return undefined

      const pending = pendingQuestions(session.id, source(session))

      if (!pending.length) return undefined

      const labels = labelsFor(ctx.locale.locale())

      return {
        menu: "session.panel" as const,
        id: PANEL_ID,
        title: labels.title,
        icon: "help" as const,
        description: labels.queue(pending.length),
        opened: ctx.layout.state(panelKey, session) !== "closed",
        order: 10,
        run: () => {
          const current = ctx.sessions.current()

          if (!current) return

          unsuppress(
            pendingQuestions(current.id, source(current)).map((item) =>
              suppressionKey(current, item.form.id),
            ),
          )

          ctx.layout.open(panelKey, current, { tab: "select" })
        },
      }
    })
  },
})
