import { Plugin } from "@opencode/plugin"

export default Plugin.define({
  id: "opencode-plugin-ask-questions-in-right-panel",
  setup(ctx) {
    console.info(`[ask-questions-in-right-panel] server part loaded in OpenCode ${ctx.app.version}`)
  },
})
