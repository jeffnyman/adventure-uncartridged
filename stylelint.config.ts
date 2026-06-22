import type { Config } from "stylelint";

export default {
  extends: ["stylelint-config-standard"],
  plugins: ["stylelint-use-nesting"],
} satisfies Config;
