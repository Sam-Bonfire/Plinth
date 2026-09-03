import { i18n } from "@lingui/core";

export type SupportedLocale = "en" | "hi";

export const DEFAULT_LOCALE: SupportedLocale = "en";

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ["en", "hi"] as const;

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

export async function activateLocale(locale: SupportedLocale): Promise<void> {
  if (locale === "en") {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const mod = await import("../../../../locale/en/messages.js" as string);
    i18n.load(locale, (mod as { messages: Record<string, string> }).messages ?? {});
  } else if (locale === "hi") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mod = await import("../../../../locale/hi/messages.js" as string);
      i18n.load(locale, (mod as { messages: Record<string, string> }).messages ?? {});
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mod = await import("../../../../locale/en/messages.js" as string);
      i18n.load(locale, (mod as { messages: Record<string, string> }).messages ?? {});
    }
  }
  i18n.activate(locale);
}

export { i18n };
