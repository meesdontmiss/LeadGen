import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env, hasSupabaseServerEnv } from "@/lib/env";

export function getSupabaseAdmin() {
  if (!hasSupabaseServerEnv()) {
    return null;
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
