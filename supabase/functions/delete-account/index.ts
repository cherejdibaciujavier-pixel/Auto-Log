import { createClient } from "npm:@supabase/supabase-js@2";
import { stripeApi } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, {
      status: 405,
      headers: corsHeaders,
    });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return Response.json({ error: "Sign in is required." }, {
      status: 401,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return Response.json({ error: "Account deletion is not configured." }, {
      status: 500,
      headers: corsHeaders,
    });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Your session has expired. Sign in again." }, {
      status: 401,
      headers: corsHeaders,
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: billing, error: billingLookupError } = await adminClient
    .from("user_subscriptions")
    .select("stripe_subscription_id,status,checkout_session_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (billingLookupError) {
    console.error("Unable to check billing before account deletion", billingLookupError);
    return Response.json({ error: "Unable to confirm billing status. Please try again later." }, {
      status: 503,
      headers: corsHeaders,
    });
  }
  let stripeSubscriptionId = billing?.stripe_subscription_id ?? null;
  try {
    if (billing?.checkout_session_id) {
      const session = await stripeApi(
        `/v1/checkout/sessions/${encodeURIComponent(billing.checkout_session_id)}`,
        { method: "GET" },
      );
      if (session.status === "open") {
        await stripeApi(
          `/v1/checkout/sessions/${encodeURIComponent(billing.checkout_session_id)}/expire`,
          { method: "POST" },
        );
      } else if (session.status === "complete" && typeof session.subscription === "string") {
        stripeSubscriptionId ??= session.subscription;
      }
    }

    if (
      stripeSubscriptionId
      && ["active", "trialing", "past_due", "incomplete", "unpaid"].includes(billing?.status ?? "")
    ) {
      await stripeApi(`/v1/subscriptions/${encodeURIComponent(stripeSubscriptionId)}`, {
        method: "DELETE",
        params: { invoice_now: "false", prorate: "false" },
      });
    }
  } catch (stripeError) {
    console.error("Unable to cancel Stripe billing before account deletion", stripeError);
    return Response.json({ error: "We couldn't safely cancel your paid subscription. Manage billing first, then retry account deletion." }, {
      status: 503,
      headers: corsHeaders,
    });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return Response.json({ error: "Unable to delete this account right now." }, {
      status: 500,
      headers: corsHeaders,
    });
  }

  return Response.json({ success: true }, { headers: corsHeaders });
});
