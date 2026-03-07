import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  server: {
    open: true,
    fs: {
      allow: [resolve(__dirname, "../..")],
    },
  },
});
