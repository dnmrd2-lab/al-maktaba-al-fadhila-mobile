import { describe, expect, it } from "vitest";
import dotenv from "dotenv";

dotenv.config();

const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function expectReadable(path: string) {
  expect(projectUrl, "EXPO_PUBLIC_SUPABASE_URL must be configured").toBeTruthy();
  expect(
    publishableKey,
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY must be configured",
  ).toBeTruthy();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${projectUrl!.replace(/\/$/, "")}/rest/v1/${path}`, {
      method: "GET",
      headers: {
        apikey: publishableKey!,
        Authorization: `Bearer ${publishableKey}`,
      },
      signal: controller.signal,
    });
    const body = await response.text();
    expect(response.status, `Supabase request returned HTTP ${response.status}: ${body.slice(0, 300)}`).toBe(200);
  } finally {
    clearTimeout(timeout);
  }
}

describe("Supabase library connection", () => {
  it("can read the folders endpoint", async () => {
    await expectReadable("folders?select=id,slug,name,description,locked,sort&order=sort&limit=1");
  }, 15000);

  it("can read the books endpoint with the app's selected columns", async () => {
    await expectReadable("books?select=id,folder_id,title,author,description,category,cover_key,cover_url,pdf_url,pages,published,sort,download_policy&order=sort&limit=1");
  }, 15000);
});
