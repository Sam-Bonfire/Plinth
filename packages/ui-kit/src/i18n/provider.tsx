import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import React, { ReactNode, useEffect, useState } from "react";
import { activateLocale, DEFAULT_LOCALE, SupportedLocale } from "./config.js";

export interface LinguiProviderProps {
  children: ReactNode;
  initialLocale?: SupportedLocale;
}

export const LinguiProvider: React.FC<LinguiProviderProps> = ({
  children,
  initialLocale = DEFAULT_LOCALE,
}) => {
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    activateLocale(initialLocale)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return (): void => {
      cancelled = true;
    };
  }, [initialLocale]);

  if (!ready) {
    return null;
  }

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
};
