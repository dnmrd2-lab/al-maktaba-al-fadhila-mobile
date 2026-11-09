import { describe, expect, it } from "vitest";
import {
  deleteLocalBookCache,
  ensureValidLocalPdf,
} from "../lib/book-cache";

describe("local library cache utilities", () => {
  it("safely falls back to remote URL on web environment without throwing", async () => {
    const remoteUrl = "https://example.com/library/files/book.pdf";
    const res = await ensureValidLocalPdf("test-book", remoteUrl);
    expect(res.uri).toBe(remoteUrl);
    expect(res.isLocal).toBe(false);
  });

  it("handles empty remote URL safely", async () => {
    const res = await ensureValidLocalPdf("test-book", "");
    expect(res.uri).toBe("");
    expect(res.isLocal).toBe(false);
  });

  it("deletes local book cache without error on web environment", async () => {
    await expect(deleteLocalBookCache("test-book")).resolves.not.toThrow();
  });
});
