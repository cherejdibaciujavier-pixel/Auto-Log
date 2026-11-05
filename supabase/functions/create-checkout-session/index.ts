import {
  authenticateUser,
  configuredPriceId,
  json,
  optionsResponse,
  siteOrigin,
  stripeApi,
} from "../_shared/stripe.ts";

const expectedPrices = {
  monthly: { amount: 499, interval: "month" },
  yearly: { amount: 3999, interval: "year" },
} as const;

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const { user, admin, error: authError, status } = await authenticateUser(request);
  if (!user || !admin) return json({ error: authError ?? "Sign in to continue." }, status);

  let body: { cycle?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Choose a valid billing cycle." }, 400);
  }
  if (body.cycle !== "monthly" && body.cycle !== "yearly") {
    return json({ error: "Choose a valid billing cycle." }, 400);
  }
  const cycle = body.cycle;

  try {
    const priceId = configuredPriceId(cycle);
    const [origin, price, existingResult] = await Promise.all([
      Promise.resolve(siteOrigin()),
      stripeApi(`/v1/prices/${encodeURIComponent(priceId)}`, { method: "GET" }),
      admin
        .from("user_subscriptions")
        .select("stripe_customer_id,status,current_period_end,billing_cycle,checkout_session_id,checkout_session_expires_at")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    if (existingResult.error) {
      console.error("Unable to read Stripe customer mapping", existingResult.error);
      return json({ error: "Billing storage isn't ready. Apply the Stripe billing database migration first." }, 503);
    }

    const expected = expectedPrices[cycle];
    const recurring = price.recurring as { interval?: unknown; interval_count?: unknown } | null;
    if (
      price.active !== true
      || price.currency !== "eur"
      || price.unit_amount !== expected.amount
      || recurring?.interval !== expected.interval
      || recurring.interval_count !== 1
    ) {
      console.error("Stripe price configuration does not match AutoLog's advertised plan", { cycle, priceId });
      return json({ error: `The Stripe ${cycle} price is misconfigured. It must be €${(expected.amount / 100).toFixed(2)} EUR billed every ${expected.interval}.` }, 503);
    }

    const existing = existingResult.data;
    const currentEnd = existing?.current_period_end ? Date.parse(existing.current_period_end) : 0;
    if (
      existing
      && ["active", "trialing", "past_due"].includes(existing.status)
      && currentEnd > Date.now()
    ) {
      return json({ error: "You already have an active Premium subscription. Use Manage billing to change or cancel it." }, 409);
    }

    const openSessionIsFresh = Boolean(
      existing?.checkout_session_id
      && existing.checkout_session_expires_at
      && Date.parse(existing.checkout_session_expires_at) > Date.now(),
    );
    if (openSessionIsFresh && existing?.checkout_session_id) {
      const openSession = await stripeApi(
        `/v1/checkout/sessions/${encodeURIComponent(existing.checkout_session_id)}`,
        { method: "GET" },
      );
      if (openSession.status === "open" && existing.billing_cycle === cycle && typeof openSession.url === "string") {
        return json({ url: openSession.url });
      }
      if (openSession.status === "open") {
        await stripeApi(
          `/v1/checkout/sessions/${encodeURIComponent(existing.checkout_session_id)}/expire`,
          { method: "POST" },
        );
      }
    }

    let customerId = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripeApi("/v1/customers", {
        params: {
          email: user.email ?? "",
          ...(typeof user.user_metadata?.full_name === "string"
            ? { name: user.user_metadata.full_name }
            : {}),
          "metadata[supabase_user_id]": user.id,
        },
        idempotencyKey: `autolog-customer-${user.id}`,
      });
      customerId = typeof customer.id === "string" ? customer.id : null;
      if (!customerId) throw new Error("Stripe did not return a customer ID.");

      const { error: saveCustomerError } = existing
        ? await admin.from("user_subscriptions").update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id)
        : await admin.from("user_subscriptions").insert({
          user_id: user.id,
          stripe_customer_id: customerId,
          status: "incomplete",
        });
      if (saveCustomerError) {
        console.error("Unable to save Stripe customer mapping", saveCustomerError);
        return json({ error: "Couldn't prepare billing for this account. Please try again." }, 500);
      }
    }

    const checkout = await stripeApi("/v1/checkout/sessions", {
      params: {
        mode: "subscription",
        customer: customerId,
        client_reference_id: user.id,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "metadata[supabase_user_id]": user.id,
        "metadata[billing_cycle]": cycle,
        "subscription_data[metadata][supabase_user_id]": user.id,
        "subscription_data[metadata][billing_cycle]": cycle,
        success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?checkout=cancel`,
      },
      idempotencyKey: `autolog-checkout-${user.id}-${crypto.randomUUID()}`,
    });
    if (typeof checkout.url !== "string" || typeof checkout.id !== "string") {
      throw new Error("Stripe did not return a Checkout URL.");
    }
    const expiresAt = typeof checkout.expires_at === "number"
      ? new Date(checkout.expires_at * 1000).toISOString()
      : null;
    const { error: saveSessionError } = await admin.from("user_subscriptions").update({
      checkout_session_id: checkout.id,
      checkout_session_expires_at: expiresAt,
      billing_cycle: cycle,
      status: "incomplete",
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);
    if (saveSessionError) {
      console.error("Unable to save Stripe Checkout Session mapping", saveSessionError);
      return json({ error: "Couldn't prepare the checkout link. Please try again." }, 500);
    }
    return json({ url: checkout.url });
  } catch (checkoutError) {
    const message = checkoutError instanceof Error ? checkoutError.message : "Stripe checkout failed.";
    console.error("Unable to create Stripe Checkout Session", message);
    return json({ error: "Secure checkout is temporarily unavailable. Please try again later." }, 503);
  }
});
