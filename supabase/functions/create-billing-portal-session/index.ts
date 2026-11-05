import {
  authenticateUser,
  json,
  optionsResponse,
  siteOrigin,
  stripeApi,
} from "../_shared/stripe.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const { user, admin, error: authError, status } = await authenticateUser(request);
  if (!user || !admin) return json({ error: authError ?? "Sign in to continue." }, status);

  try {
    const origin = siteOrigin();
    const { data, error } = await admin
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("Unable to find Stripe customer mapping", error);
      return json({ error: "Billing storage isn't ready. Apply the Stripe billing database migration first." }, 503);
    }
    if (!data?.stripe_customer_id) {
      return json({ error: "There is no Stripe billing account to manage yet." }, 404);
    }

    const portal = await stripeApi("/v1/billing_portal/sessions", {
      params: {
        customer: data.stripe_customer_id,
        return_url: `${origin}/?billing=return`,
      },
    });
    if (typeof portal.url !== "string") throw new Error("Stripe did not return a billing portal URL.");
    return json({ url: portal.url });
  } catch (portalError) {
    const message = portalError instanceof Error ? portalError.message : "Stripe billing portal failed.";
    console.error("Unable to create Stripe Billing Portal Session", message);
    return json({ error: "Billing management is temporarily unavailable. Please try again later." }, 503);
  }
});
