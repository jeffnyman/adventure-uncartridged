import { defineConfig } from "vite-plus";

export default defineConfig({
  base: "/adventure-uncartridged/",

  define: {
    "import.meta.env.VITE_APP_TITLE": JSON.stringify("Adventure: Uncartridged"),
  },

  resolve: {
    alias: {
      "@": "/src",
    },
  },

  staged: {
    "*.css": "stylelint --fix",
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    tasks: {
      fallow: {
        command: "fallow",
        cache: true,
      },
      stylelint: {
        command: "stylelint **/*.css",
        cache: true,
      },
      checks: {
        dependsOn: ["stylelint", "fallow"],
        command: "vp check && vp test",
      },
    },
  },
});
