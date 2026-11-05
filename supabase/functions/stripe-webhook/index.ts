import {
  createAdminClient,
  json,
  stripeApi,
} from "../_shared/stripe.ts";

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value).filter(Boolean);
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false;
  if (signatures.length === 0) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const expected = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return signatures.some((signature) => constantTimeEqual(signature, expected));
}

function objectId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
}

function isoFromUnix(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function subscriptionFromInvoice(invoice: Record<string, unknown>): string | null {
  const direct = objectId(invoice.subscription);
  if (direct) return direct;
  const parent = invoice.parent as Record<string, unknown> | undefined;
  const details = parent?.subscription_details as Record<string, unknown> | undefined;
  return objectId(details?.subscription);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("Stripe webhook secret is not configured.");
    return json({ error: "Webhook is not configured." }, 500);
  }

  const signature = request.headers.get("Stripe-Signature");
  if (!signature) return json({ error: "Missing Stripe signature." }, 400);
  const payload = await request.text();
  let validSignature = false;
  try {
    validSignature = await verifySignature(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Unable to verify Stripe webhook signature", error);
  }
  if (!validSignature) return json({ error: "Invalid Stripe signature." }, 400);

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid event body." }, 400);
  }
  if (typeof event.id !== "string" || typeof event.type !== "string") {
    return json({ error: "Invalid Stripe event." }, 400);
  }

  try {
    const admin = createAdminClient();
    const { data: alreadyProcessed, error: lookupError } = await admin
      .from("stripe_webhook_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();
    if (lookupError) {
      console.error("Unable to check Stripe webhook event receipt", lookupError);
      return json({ error: "Webhook storage isn't ready. Apply the Stripe billing database migration first." }, 503);
    }
    if (alreadyProcessed) return json({ received: true, duplicate: true });

    const data = event.data as { object?: Record<string, unknown> } | undefined;
    const object = data?.object;
    if (!object) return json({ error: "Stripe event has no object." }, 400);

    let subscriptionId: string | null = null;
    let fallbackUserId: string | null = null;
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      subscriptionId = objectId(object.subscription);
      fallbackUserId = typeof object.client_reference_id === "string" ? object.client_reference_id : null;
      const sessionMetadata = object.metadata as Record<string, unknown> | undefined;
      if (typeof sessionMetadata?.supabase_user_id === "string") fallbackUserId = sessionMetadata.supabase_user_id;
    } else if (event.type.startsWith("customer.subscription.")) {
      subscriptionId = objectId(object.id);
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      subscriptionId = subscriptionFromInvoice(object);
    }

    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const sessionMetadata = object.metadata as Record<string, unknown> | undefined;
      const userId = typeof sessionMetadata?.supabase_user_id === "string"
        ? sessionMetadata.supabase_user_id
        : typeof object.client_reference_id === "string" ? object.client_reference_id : null;
      if (userId && typeof object.id === "string") {
        const { error: clearSessionError } = await admin
          .from("user_subscriptions")
          .update({
            checkout_session_id: null,
            checkout_session_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("checkout_session_id", object.id);
        if (clearSessionError) throw clearSessionError;
      }
    }

    if (subscriptionId) {
      let subscription: Record<string, unknown>;
      try {
        subscription = await stripeApi(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "GET" });
      } catch (error) {
        if (event.type === "customer.subscription.deleted") {
          subscription = object;
        } else {
          throw error;
        }
      }

      const metadata = subscription.metadata as Record<string, unknown> | undefined;
      let userId = typeof metadata?.supabase_user_id === "string" ? metadata.supabase_user_id : fallbackUserId;
      const customerId = objectId(subscription.customer) ?? objectId(object.customer);
      if (!userId && customerId) {
        const { data: mapping, error: mappingError } = await admin
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (mappingError) throw mappingError;
        userId = typeof mapping?.user_id === "string" ? mapping.user_id : null;
      }

      if (userId) {
        const items = subscription.items as { data?: Array<Record<string, unknown>> } | undefined;
        const firstItem = items?.data?.[0];
        const price = firstItem?.price as Record<string, unknown> | undefined;
        const recurring = price?.recurring as Record<string, unknown> | undefined;
        const interval = recurring?.interval;
        const cycle = interval === "year" ? "yearly" : interval === "month" ? "monthly" : null;
        const currentPeriodEnd = isoFromUnix(subscription.current_period_end)
          ?? isoFromUnix(firstItem?.current_period_end);
        const createdAt = isoFromUnix(subscription.created) ?? new Date().toISOString();

        const { error: saveError } = await admin.from("user_subscriptions").upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: typeof price?.id === "string" ? price.id : null,
          checkout_session_id: null,
          checkout_session_expires_at: null,
          billing_cycle: cycle,
          status: typeof subscription.status === "string" ? subscription.status : "incomplete",
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: subscription.cancel_at_period_end === true,
          created_at: createdAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (saveError?.code === "23503") {
          // The user may have deleted their AutoLog account after cancelling in Stripe.
          console.info("Acknowledging Stripe event for a deleted AutoLog account", { eventId: event.id });
        } else if (saveError) {
          console.error("Unable to sync Stripe subscription", saveError);
          throw saveError;
        }
      } else {
        console.error("Stripe subscription event has no matching AutoLog user", { eventId: event.id, subscriptionId });
      }
    }

    const { error: receiptError } = await admin.from("stripe_webhook_events").insert({
      event_id: event.id,
      event_type: event.type,
    });
    if (receiptError && receiptError.code !== "23505") {
      console.error("Unable to store Stripe webhook receipt", receiptError);
      throw receiptError;
    }

    return json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    return json({ error: "Webhook processing failed; Stripe may retry this event." }, 500);
  }
});
