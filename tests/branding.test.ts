import { describe, expect, it } from "vitest";
import { APP_NAME, APP_ROLE, APP_TAGLINE, APP_TITLE } from "../lib/branding";

describe("Fadhila splash branding", () => {
  it("keeps the requested scholar name and mosque role in the app name", () => {
    expect(APP_TITLE).toBe("تطبيق فضيلة الشيخ عبدالله بن إبراهيم بن عثمان القرعاوي");
    expect(APP_ROLE).toBe("إمام الجامع الكبير (جامع خادم الحرمين الشريفين ببريدة)");
    expect(APP_NAME).toBe(`${APP_TITLE} ${APP_ROLE}`);
  });

  it("provides a short Arabic tagline for the splash screen", () => {
    expect(APP_TAGLINE).toBe("تراث علمي بين يديك");
  });
});
