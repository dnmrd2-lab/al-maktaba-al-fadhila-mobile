type SupabaseEnvironment = {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
};

type ResolvedSupabaseConfig = {
  supabaseUrl: string;
  publishableKey: string;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveSupabaseConfig(
  environment: SupabaseEnvironment,
  expoExtra: unknown,
): ResolvedSupabaseConfig {
  const extra =
    expoExtra !== null && typeof expoExtra === "object" && !Array.isArray(expoExtra)
      ? (expoExtra as Record<string, unknown>)
      : {};

  return {
    supabaseUrl:
      readString(environment.EXPO_PUBLIC_SUPABASE_URL) ||
      readString(extra.supabaseUrl),
    publishableKey:
      readString(environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
      readString(extra.supabasePublishableKey),
  };
}
