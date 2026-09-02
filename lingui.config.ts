import { formatter } from "@lingui/format-po";
import type { LinguiConfig } from "@lingui/conf";

const config: LinguiConfig = {
  locales: ["en", "hi"],
  catalogs: [
    {
      path: "<rootDir>/locale/{locale}/messages",
      include: ["apps", "packages"],
    },
  ],
  format: formatter({ origins: true, lineNumbers: false }),
  fallbackLocales: {
    default: "en",
  },
};

export default config;
