import { createClient } from "@supabase/supabase-js";

// The publishable/anon key is intended for browser apps. It identifies the
// AutoLog project; users never need to create or provide their own Supabase key.
// Keep service_role / sb_secret keys out of all VITE_* variables and client code.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? "https://upqqenacczgalypyoxol.supabase.co";
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_M21070jjoA7vkxRNGb3CyQ_VVLtMrku";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
