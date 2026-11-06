import { describe, expect, it } from "vitest";
import { resolveSupabaseConfig } from "../lib/supabase-config";

describe("Supabase runtime configuration", () => {
  it("reads the public Supabase settings embedded in the Expo manifest", () => {
    expect(
      resolveSupabaseConfig({}, {
        supabaseUrl: "https://library-example.supabase.co",
        supabasePublishableKey: "sb_publishable_example",
      }),
    ).toEqual({
      supabaseUrl: "https://library-example.supabase.co",
      publishableKey: "sb_publishable_example",
    });
  });

  it("prefers build environment values when they are present", () => {
    expect(
      resolveSupabaseConfig(
        {
          EXPO_PUBLIC_SUPABASE_URL: "https://build.supabase.co",
          EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_build",
        },
        {
          supabaseUrl: "https://manifest.supabase.co",
          supabasePublishableKey: "sb_publishable_manifest",
        },
      ),
    ).toEqual({
      supabaseUrl: "https://build.supabase.co",
      publishableKey: "sb_publishable_build",
    });
  });

  it("returns empty values when no public settings are supplied", () => {
    expect(resolveSupabaseConfig({}, null)).toEqual({
      supabaseUrl: "",
      publishableKey: "",
    });
  });
});
