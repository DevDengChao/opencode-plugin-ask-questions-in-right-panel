import { defineConfig } from "vite"
import solid from "vite-plugin-solid"

export default defineConfig({
  root: "demo",
  plugins: [solid()],
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: [".."] },
  },
})
