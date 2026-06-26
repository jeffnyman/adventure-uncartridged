import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
  },
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
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "typescript/explicit-function-return-type": "error",
      "typescript/strict-void-return": "error",
      "typescript/no-unnecessary-type-assertion": "warn",
      eqeqeq: "error",
    },
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
