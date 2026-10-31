export interface Tokens {
  bg: string;
  acc: string;
  s1: string;
  s2: string;
  s3: string;
  s4: string;
  s5: string;
  b1: string;
  font: string;
  mono: string;
  g: string;
  r: string;
  y: string;
  bl: string;
  p: string;
  o: string;
}

export const TOKENS: Tokens = {
  bg: "#f4f5f4",
  acc: "#0d110e",
  s1: "#ffffff",
  s2: "#f9faf9",
  s3: "#eeefee",
  s4: "#e5e7e5",
  s5: "#d8dbd8",
  b1: "rgba(0, 0, 0, 0.08)",
  font: "\"Instrument Sans\", sans-serif",
  mono: "\"IBM Plex Mono\", monospace",
  g: "#16a34a",
  r: "#dc2626",
  y: "#ca8a04",
  bl: "#2563eb",
  p: "#9333ea",
  o: "#ea580c",
};

export const TOKENS_BY_MODE: Record<"light" | "dark", Tokens> = {
  light: TOKENS,
  dark: {
    ...TOKENS,
    bg: "#0e1110",
    acc: "#e8ece8",
    s1: "#171b17",
    s2: "#1d221d",
    s3: "#262b26",
    s4: "#313631",
    s5: "#3f453f",
    b1: "rgba(255, 255, 255, 0.12)",
    g: "#4ade80",
    r: "#f87171",
    y: "#facc15",
    bl: "#60a5fa",
    p: "#c084fc",
    o: "#fb923c",
  },
};
