import { describe, expect, it, vi, beforeEach } from "vitest";

const memoryStore: Record<string, string> = {};

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn().mockImplementation((key: string) => Promise.resolve(memoryStore[key] ?? null)),
    setItem: vi.fn().mockImplementation((key: string, val: string) => {
      memoryStore[key] = val;
      return Promise.resolve();
    }),
    removeItem: vi.fn().mockImplementation((key: string) => {
      delete memoryStore[key];
      return Promise.resolve();
    }),
  },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/supabase", () => {
  const queryBuilder = {
    insert: vi.fn().mockResolvedValue({ error: null }),
    select: vi.fn().mockImplementation((_cols, options) => {
      if (options?.count === "exact") {
        return Promise.resolve({ count: 42, error: null });
      }
      return {
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { views_count: 5 }, error: null }),
        }),
      };
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  };

  return {
    supabaseConfigured: true,
    supabase: {
      rpc: vi.fn().mockResolvedValue({ data: 10, error: null }),
      from: vi.fn().mockReturnValue(queryBuilder),
    },
  };
});

import { getOrCreateDeviceId, recordAppInstallation, recordBookView, fetchTotalAppInstalls } from "../lib/analytics";

describe("analytics module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates and returns a consistent device id", async () => {
    const id1 = await getOrCreateDeviceId();
    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThan(5);

    const id2 = await getOrCreateDeviceId();
    expect(id2).toBe(id1);
  });

  it("records app installation without throwing", async () => {
    const result = await recordAppInstallation();
    expect(result).toBe(true);
  });

  it("increments and returns book view count", async () => {
    const result = await recordBookView("mock-book-id");
    expect(result).toBe(10);
  });

  it("fetches total app installations count", async () => {
    const count = await fetchTotalAppInstalls();
    expect(count).toBe(42);
  });
});
