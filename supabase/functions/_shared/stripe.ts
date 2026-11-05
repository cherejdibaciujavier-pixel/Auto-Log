import { createClient, type User } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

export function optionsResponse() {
  return new Response("ok", { headers: corsHeaders });
}

export async function authenticateUser(request: Request): Promise<{
  user: User | null;
  admin: ReturnType<typeof createClient> | null;
  error: string | null;
  status: number;
}> {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return { user: null, admin: null, error: "Sign in to continue.", status: 401 };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return { user: null, admin: null, error: "Billing is temporarily unavailable.", status: 500 };
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    return { user: null, admin: null, error: "Your session expired. Sign in again.", status: 401 };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { user, admin, error: null, status: 200 };
}

export function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service credentials are missing.");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function siteOrigin(): string {
  const configured = Deno.env.get("AUTOLOG_SITE_URL");
  if (!configured) throw new Error("AUTOLOG_SITE_URL is not configured.");
  const url = new URL(configured);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("AUTOLOG_SITE_URL must use HTTPS.");
  }
  return url.origin;
}

export async function stripeApi(
  path: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    params?: Record<string, string>;
    idempotencyKey?: string;
  } = {},
): Promise<Record<string, unknown>> {
  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret) throw new Error("Stripe is not configured. Add STRIPE_SECRET_KEY to Supabase function secrets.");

  const method = options.method ?? "POST";
  const url = new URL(`https://api.stripe.com${path}`);
  const headers: Record<string, string> = { Authorization: `Bearer ${secret}` };
  let body: string | undefined;
  if (method === "GET") {
    for (const [key, value] of Object.entries(options.params ?? {})) url.searchParams.set(key, value);
  } else if (options.params) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(options.params).toString();
  }
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const response = await fetch(url, { method, headers, body });
  let result: Record<string, unknown>;
  try {
    result = await response.json() as Record<string, unknown>;
  } catch {
    throw new Error("Stripe returned an unreadable response.");
  }
  if (!response.ok) {
    const stripeError = result.error as { message?: unknown } | undefined;
    const message = typeof stripeError?.message === "string" ? stripeError.message : "Stripe request failed.";
    throw new Error(message);
  }
  return result;
}

export function configuredPriceId(cycle: "monthly" | "yearly"): string {
  const key = cycle === "monthly" ? "STRIPE_PRICE_MONTHLY" : "STRIPE_PRICE_YEARLY";
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured in Supabase function secrets.`);
  return value;
}
