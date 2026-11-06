import { describe, expect, it } from "vitest";
import config from "../app.config";

describe("EAS project configuration", () => {
  it("links the preview APK to the existing Expo team project", () => {
    expect(config.owner).toBe("dnmrd2s-team");
    expect(config.slug).toBe("al-qaraawi-library");
    expect(config.extra?.eas).toEqual({
      projectId: "913f1286-c020-408a-9008-24d765eac88a",
    });
  });

  it("bundles only the public Supabase settings, never a service-role key", () => {
    expect(Object.keys(config.extra ?? {}).sort()).toEqual([
      "eas",
      "supabasePublishableKey",
      "supabaseUrl",
    ]);
  });
});
