/**
 * @jest-environment jsdom
 */

import { loadPlinthFonts, PLINTH_FONTS_CONFIG } from "./loader.js";

describe("Font Loader", () => {
  beforeEach(() => {
    // Clear DOM head before each test
    document.head.innerHTML = "";

    // Reset spies if needed
    jest.clearAllMocks();
  });

  it("should inject preconnect and stylesheet link elements to document.head", () => {
    loadPlinthFonts(PLINTH_FONTS_CONFIG);

    const links = document.head.querySelectorAll("link");
    expect(links.length).toBe(3);

    const [preconnect1, preconnect2, stylesheet] = Array.from(links);

    expect(preconnect1?.rel).toBe("preconnect");
    expect(preconnect1?.href).toContain("fonts.googleapis.com");

    expect(preconnect2?.rel).toBe("preconnect");
    expect(preconnect2?.href).toContain("fonts.gstatic.com");
    expect(preconnect2?.crossOrigin).toBe("anonymous");

    expect(stylesheet?.rel).toBe("stylesheet");
    expect(stylesheet?.id).toBe("plinth-fonts");
    expect(stylesheet?.href).toContain("family=IBM+Plex+Mono:wght@400;500;600");
    expect(stylesheet?.href).toContain("family=Instrument+Sans:wght@400;500;600;700");
    expect(stylesheet?.href).toContain("display=swap");
  });

  it("should not inject duplicate stylesheets if already present", () => {
    loadPlinthFonts(PLINTH_FONTS_CONFIG);

    const initialLinksLength = document.head.querySelectorAll("link").length;

    // Call again
    loadPlinthFonts(PLINTH_FONTS_CONFIG);

    const subsequentLinksLength = document.head.querySelectorAll("link").length;

    expect(initialLinksLength).toBe(3);
    expect(subsequentLinksLength).toBe(3); // Should still be 3, not 6
  });
});
