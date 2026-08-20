import { useEffect, useState } from "react";

export interface FontConfig {
  family: string;
  weights: number[];
  styles?: string[];
  fallback?: string;
}

export interface FontLoader {
  (configs?: FontConfig[]): void;
}

export const INSTRUMENT_SANS_CONFIG: FontConfig = {
  family: "Instrument Sans",
  weights: [400, 500, 600, 700],
  fallback: "sans-serif",
};

export const IBM_PLEX_MONO_CONFIG: FontConfig = {
  family: "IBM Plex Mono",
  weights: [400, 500, 600],
  fallback: "monospace",
};

export const PLINTH_FONTS_CONFIG: FontConfig[] = [
  IBM_PLEX_MONO_CONFIG,
  INSTRUMENT_SANS_CONFIG,
];

const generateGoogleFontsUrl = (configs: FontConfig[]): string => {
  const families = configs
    .map((config) => {
      const familyName = config.family.replace(/ /g, "+");
      const weights = config.weights.join(";");
      return `family=${familyName}:wght@${weights}`;
    })
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
};

export const loadPlinthFonts: FontLoader = (
  configs: FontConfig[] = PLINTH_FONTS_CONFIG,
): void => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const id = "plinth-fonts";
  if (document.getElementById(id)) {
    return;
  }

  const preconnect1 = document.createElement("link");
  preconnect1.rel = "preconnect";
  preconnect1.href = "https://fonts.googleapis.com";

  const preconnect2 = document.createElement("link");
  preconnect2.rel = "preconnect";
  preconnect2.href = "https://fonts.gstatic.com";
  preconnect2.crossOrigin = "anonymous";

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.id = id;
  stylesheet.href = generateGoogleFontsUrl(configs);

  document.head.appendChild(preconnect1);
  document.head.appendChild(preconnect2);
  document.head.appendChild(stylesheet);
};

export const useFontsLoaded = (): boolean => {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    loadPlinthFonts(PLINTH_FONTS_CONFIG);

    if ("fonts" in document) {
      document.fonts.ready
        .then(() => setIsLoaded(true))
        .catch(() => setIsLoaded(true));
    } else {
      setIsLoaded(true);
    }
  }, []);

  return isLoaded;
};
