import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Sign in to redeem a Premium code." }, 401);

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Enter a valid code." }, 400);
  }

  const expectedCode = Deno.env.get("AUTOLOG_LIFETIME_PREMIUM_CODE")?.trim().toUpperCase();
  const submittedCode = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!expectedCode) return json({ error: "Code redemption is temporarily unavailable." }, 500);
  if (!submittedCode || submittedCode !== expectedCode) {
    return json({ error: "That Premium code isn't valid." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return json({ error: "Code redemption is temporarily unavailable." }, 500);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Your session expired. Sign in again." }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: entitlementError } = await adminClient
    .from("user_entitlements")
    .upsert({
      user_id: user.id,
      lifetime_premium: true,
      promo_code_redeemed_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (entitlementError) {
    console.error("Failed to record lifetime Premium entitlement", entitlementError);
    return json({ error: "Couldn't activate Premium right now. Please try again." }, 500);
  }

  return json({ success: true, lifetime_premium: true });
});
