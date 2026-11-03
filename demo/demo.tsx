import { createEffect, createSignal, For, Show, type JSX } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { render } from "solid-js/web"
import type { FormField, FormInfo, FormMultiselectField, FormStringField } from "@opencode/client/promise"
import type { Context, MountedSession } from "@opencode/plugin/gui"
import { QuestionPanel } from "../src/question-panel"
import type { QuestionDraft } from "../src/forms"
import styles from "../src/styles.css?inline"
import "./demo.css"

const style = document.createElement("style")
style.textContent = styles
document.head.append(style)

const ui = {
  Icon: (props: { name: string; size?: string }) => (
    <span class="demo-icon" data-size={props.size}>
      ?
    </span>
  ),
  IconButton: (props: { label: string; onClick?: () => void }) => (
    <button type="button" class="demo-icon-button" aria-label={props.label} onClick={props.onClick}>
      ×
    </button>
  ),
  Button: (props: {
    children?: JSX.Element
    variant?: string
    busy?: boolean
    disabled?: boolean
    onClick?: (event: MouseEvent) => void
  }) => (
    <button
      type="button"
      class="demo-button"
      data-variant={props.variant}
      disabled={props.disabled || props.busy}
      onClick={props.onClick}
    >
      {props.busy ? <span class="demo-spinner" aria-hidden="true" /> : null}
      {props.children}
    </button>
  ),
}

function option(value: string, label: string, description?: string) {
  return { value, label, description }
}

function choice(
  key: string,
  title: string,
  description: string,
  options: ReturnType<typeof option>[],
  extra: Partial<FormStringField> = {},
): FormStringField {
  return { key, type: "string", title, description, options, ...extra }
}

function multi(
  key: string,
  title: string,
  description: string,
  options: ReturnType<typeof option>[],
  extra: Partial<FormMultiselectField> = {},
): FormMultiselectField {
  return { key, type: "multiselect", title, description, options, ...extra }
}

function form(id: string, sessionID: string, fields: FormField[]): FormInfo {
  return { id, sessionID, title: "Question", metadata: { kind: "question" }, fields: fields as FormInfo["fields"] }
}

interface DemoDB {
  sessions: { id: string; parentID?: string; title?: string }[]
  status: Record<string, string>
  forms: Record<string, FormInfo[]>
}

const single: DemoDB = {
  sessions: [{ id: "root", title: "Deploy service" }],
  status: { root: "running" },
  forms: {
    root: [
      form("form-single", "root", [
        choice("target", "选择部署目标", "这次构建要发布到哪个环境？", [
          option("staging", "预发布环境", "pre.example.com"),
          option("production", "生产环境", "需要二次确认"),
          option("local", "仅本地", "不对外发布"),
        ]),
      ]),
    ],
  },
}

const multiScenario: DemoDB = {
  sessions: [{ id: "root", title: "Deploy service" }],
  status: { root: "running" },
  forms: {
    root: [
      form("form-multi", "root", [
        multi("checks", "选择要启用的检查项", "这些会在构建前依次执行。", [
          option("eslint", "ESLint", "lint 全部源码"),
          option("types", "TypeScript 类型检查", "tsc --noEmit"),
          option("tests", "单元测试", "vitest run"),
        ], { custom: true }),
        { key: "note", type: "string", title: "发布说明", description: "会写进 CHANGELOG 与发布记录。" } as FormStringField,
      ]),
    ],
  },
}

const queue: DemoDB = {
  sessions: [
    { id: "root", title: "Deploy service" },
    { id: "sub", parentID: "root", title: "db-migrate" },
  ],
  status: { root: "running", sub: "running" },
  forms: {
    root: [
      form("form-root", "root", [
        choice("target", "选择部署目标", "这次构建要发布到哪个环境？", [
          option("staging", "预发布环境", "pre.example.com"),
          option("production", "生产环境", "需要二次确认"),
          option("local", "仅本地", "不对外发布"),
        ]),
      ]),
    ],
    sub: [
      form("form-sub", "sub", [
        choice("retry", "是否继续执行迁移？", "上一次在 3/7 处失败并已回滚。", [
          option("continue", "继续重试", "从第 4 步开始"),
          option("restart", "从头重跑", "先清空目标库"),
          option("stop", "停止并回滚", "保留日志供排查"),
        ]),
      ]),
    ],
  },
}

const long: DemoDB = {
  sessions: [{ id: "root", title: "Release review" }],
  status: { root: "running" },
  forms: {
    root: [
      form("form-long", "root", [
        choice("target", "选择部署目标", "这次构建要发布到哪个环境？", [
          option("staging", "预发布环境", "pre.example.com"),
          option("production", "生产环境", "需要二次确认"),
        ]),
        multi("checks", "选择要启用的检查项", "这些会在构建前依次执行。", [
          option("eslint", "ESLint"),
          option("types", "TypeScript 类型检查"),
          option("tests", "单元测试"),
        ]),
        choice("migration", "数据库迁移", "现在执行待应用的迁移吗？", [
          option("now", "立即应用", "在本次发布前执行"),
          option("tonight", "今晚定时执行", "02:00 UTC"),
          option("skip", "本次跳过", "保持当前 schema"),
        ]),
        { key: "note", type: "string", title: "发布说明", description: "会写进 CHANGELOG 与发布记录。" } as FormStringField,
        choice("notify", "通知方式", "发布完成后通知哪些渠道？", [
          option("email", "邮件", "dev@example.com"),
          option("slack", "Slack", "#deploys"),
          option("none", "不通知"),
        ]),
      ]),
    ],
  },
}

const scenarios = {
  single: { label: "单问题", db: single },
  multi: { label: "多选 + 自定义", db: multiScenario },
  queue: { label: "多表单队列", db: queue },
  long: { label: "多问题列表", db: long },
} as const

type ScenarioID = keyof typeof scenarios

const [scenario, setScenario] = createSignal<ScenarioID>("single")
const [theme, setTheme] = createSignal<"light" | "dark">("light")
const [width, setWidth] = createSignal(400)
const [open, setOpen] = createSignal(true)
const [toast, setToast] = createSignal<string>()
const [db, setDb] = createStore<DemoDB>(scenarios.single.db)
const [drafts, setDrafts] = createStore<Record<string, QuestionDraft>>({})

const locale = () => (navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en")

function removeForm(sessionID: string, formID: string) {
  setDb("forms", sessionID, (forms = []) => forms.filter((item) => item.id !== formID))
}

const ctx = {
  id: "demo",
  locale: { locale },
  layout: {
    narrow: () => false,
    open: () => setOpen(true),
    close: () => setOpen(false),
    state: () => (open() ? "visible" : "closed"),
  },
  toast: {
    show: (options: { title: string; description?: string }) =>
      setToast(options.description ? `${options.title} · ${options.description}` : options.title),
  },
  ui,
} as unknown as Context

const session = {
  id: "root",
  key: "demo\nroot",
  server: {
    data: {
      session: {
        list: () => db.sessions,
        status: (id: string) => db.status[id] ?? "idle",
        form: {
          list: (id: string) => db.forms[id],
          sync: async () => undefined,
          reply: async (input: { sessionID: string; formID: string }) => {
            removeForm(input.sessionID, input.formID)
          },
          cancel: async (input: { sessionID: string; formID: string }) => {
            removeForm(input.sessionID, input.formID)
          },
        },
      },
    },
  },
} as unknown as MountedSession

function load(id: ScenarioID) {
  setScenario(id)
  setOpen(true)
  setToast(undefined)
  setDb(scenarios[id].db)
  setDrafts(produce((drafts) => {
    for (const key of Object.keys(drafts)) delete drafts[key]
  }))
}

const params = new URLSearchParams(location.search)
const requested = params.get("scenario")

if (requested && requested in scenarios) load(requested as ScenarioID)
if (params.get("theme") === "dark") setTheme("dark")
if (params.get("width")) setWidth(Number(params.get("width")))
if (params.get("panel") === "closed") setOpen(false)
if (params.get("clean") === "1") document.documentElement.dataset.clean = "1"

if (params.get("custom") === "1") {
  const item = db.forms.root?.[0]
  const field = item?.fields.find((candidate) => candidate.type === "string" || candidate.type === "multiselect")

  if (item && field?.custom) {
    setDrafts(item.id, {
      answers: {},
      custom: { [field.key]: "只跑改动的文件" },
      customOn: { [field.key]: true },
    })
  }
}

const firstQuestion = () => {
  const forms = db.forms.root ?? []

  for (const item of forms) {
    const field = item.fields.find((candidate) => candidate.type === "string" || candidate.type === "multiselect")

    if (field) return field
  }

  return undefined
}

function App() {
  createEffect(() => {
    document.documentElement.dataset.theme = theme()
  })

  return (
    <div class="demo">
      <header class="demo-bar">
        <strong>Questions panel</strong>
        <For each={Object.entries(scenarios)}>
          {([id, item]) => (
            <button
              type="button"
              class="demo-chip"
              data-active={scenario() === id}
              onClick={() => load(id as ScenarioID)}
            >
              {item.label}
            </button>
          )}
        </For>
        <span class="demo-spacer" />
        <label class="demo-knob">
          侧栏宽
          <input
            type="range"
            min="300"
            max="560"
            step="10"
            value={width()}
            onInput={(event) => setWidth(Number(event.currentTarget.value))}
          />
          <span>{width()}</span>
        </label>
        <button type="button" class="demo-chip" onClick={() => setTheme(theme() === "dark" ? "light" : "dark")}>
          明暗
        </button>
        <button type="button" class="demo-chip" onClick={() => setOpen(!open())}>
          {open() ? "关闭面板" : "打开面板"}
        </button>
      </header>

      <main class="demo-stage">
        <section class="demo-window" data-dock={!open()}>
          <div class="demo-timeline">
            <div class="demo-msg">
              <div class="demo-who">你</div>
              <div class="demo-bubble">帮我把这个服务发布到预发布环境，发布前跑一下检查。</div>
            </div>
            <div class="demo-msg">
              <div class="demo-who">OpenCode</div>
              <p>好的。构建已通过，接下来需要确认两个信息：发布目标，以及要启用的检查项。</p>
              <div class="demo-tool"><span class="demo-dot" />build · exited 0 · 12.4s</div>
              <p class="demo-faint">等待你的回答后继续。</p>
            </div>
            <div class="demo-composer">继续描述任务…<span class="demo-send">↑</span></div>
          </div>

          <Show when={open()}>
            <aside class="demo-side" style={{ width: `${width()}px` }}>
              <div class="demo-strip">
                <span class="demo-tab" data-active="true">Questions ×</span>
                <span class="demo-tab">Files</span>
                <span class="demo-tab">Details</span>
              </div>
              <QuestionPanel
                ctx={ctx}
                session={session}
                panelKey="demo:questions"
                drafts={drafts}
                setDrafts={setDrafts}
              />
            </aside>
          </Show>

          <Show when={!open()}>
            <div class="demo-dock">
              <div class="demo-dock-card">
                <div class="demo-dock-head">
                  <span>QUESTION</span>
                  <span>1 / 1</span>
                </div>
                <strong>{firstQuestion()?.title ?? "没有待答问题"}</strong>
                <p>{firstQuestion()?.description ?? "面板已关闭，底部 dock 恢复。"}</p>
                <div class="demo-dock-actions">
                  <button type="button" class="demo-button" onClick={() => setOpen(true)}>
                    在侧栏中打开
                  </button>
                </div>
              </div>
            </div>
          </Show>

          <Show when={toast()}>{(value) => <div class="demo-toast">{value()}</div>}</Show>
        </section>
      </main>
    </div>
  )
}

render(() => <App />, document.querySelector("#root")!)
