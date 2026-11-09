import { describe, expect, it } from "vitest";
import { sanitizeTextForSpeech } from "../lib/speech-service";

describe("speech-service text sanitization", () => {
  it("cleans HTML tags and markdown markup for clear pronunciation", () => {
    const raw = "<h3>عنوان الكتاب</h3>\n**مقدمة** [رابط](http://test) *نص مهم*";
    const cleaned = sanitizeTextForSpeech(raw);
    expect(cleaned).toBe("عنوان الكتاب مقدمة رابط نص مهم");
  });

  it("handles empty or whitespace-only text safely", () => {
    expect(sanitizeTextForSpeech("")).toBe("");
    expect(sanitizeTextForSpeech("   \n\t  ")).toBe("");
  });

  it("preserves Arabic diacritics and letters", () => {
    const arabic = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
    expect(sanitizeTextForSpeech(arabic)).toBe(arabic);
  });
});
