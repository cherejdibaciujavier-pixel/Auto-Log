# Stripe billing setup for AutoLog

AutoLog uses Stripe Checkout for subscriptions, Stripe webhooks as the source of truth for Premium access, and Stripe's Billing Portal for cancellations and payment-method changes. The app never receives card numbers.

## 1. Create Stripe products and recurring prices

In Stripe, create an `AutoLog Premium` product with these recurring EUR prices:

- Monthly: **€4.99**, recurring every month.
- Yearly: **€39.99**, recurring every year.

Keep both prices active. The checkout Edge Function validates the configured Price IDs against these amounts, currency, and interval; it will refuse checkout if a different price is configured.

Use Stripe **test mode** first. Test and live Price IDs and secrets are different.

## 2. Add Supabase function secrets

In the Supabase Dashboard for the AutoLog project, open **Edge Functions → Secrets** and set:

- `STRIPE_SECRET_KEY` — test secret key initially (`sk_test_…`).
- `STRIPE_PRICE_MONTHLY` — monthly recurring Price ID (`price_…`).
- `STRIPE_PRICE_YEARLY` — yearly recurring Price ID (`price_…`).
- `STRIPE_WEBHOOK_SECRET` — signing secret for the webhook endpoint (`whsec_…`).
- `AUTOLOG_SITE_URL` — canonical app URL, currently `https://autolog-neon.vercel.app`.

Do not put secret keys in Vite variables, source files, Git, or chat. The Stripe secret key and webhook secret belong only in Supabase Edge Function secrets.

## 3. Apply the database migration and deploy the functions

From the repository root, with the Supabase CLI linked to the AutoLog project:

```sh
supabase db push
supabase functions deploy create-checkout-session
supabase functions deploy create-billing-portal-session
supabase functions deploy stripe-webhook
supabase functions deploy delete-account
```

The migration creates `user_subscriptions` (readable only by its owner; server writes only) and private `stripe_webhook_events` receipts. Checkout and portal functions require a valid Supabase user JWT. The webhook function verifies Stripe's signature instead of a Supabase JWT.

## 4. Register the Stripe webhook

In Stripe's **test-mode** Developers/Webhooks settings, add this endpoint:

```text
https://upqqenacczgalypyoxol.supabase.co/functions/v1/stripe-webhook
```

Subscribe to these events:

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Copy the endpoint's signing secret into the Supabase `STRIPE_WEBHOOK_SECRET` secret. The webhook function checks the raw request-body signature and rejects invalid or stale signatures.

## 5. Configure the Stripe Billing Portal

Enable the customer portal in Stripe. Allow customers to update payment methods and cancel subscriptions. If customers should be able to switch between monthly and yearly, enable plan changes and add both AutoLog prices to the portal configuration. The app's **Manage billing in Stripe** button opens a customer-specific portal session.

## 6. Test before going live

Test a new monthly and yearly checkout, cancellation at period end, plan changes, payment-method updates, failed payments, and account deletion. Confirm each action updates the AutoLog account only after the signed webhook is processed. The app briefly polls Supabase after a successful Checkout return while the webhook syncs.

Before live payments, switch to the live Stripe secret, live Price IDs, and a live-mode webhook signing secret, then recheck all settings. Stripe Tax is not automatically enabled in this implementation: decide how VAT should be presented and collected for your business, configure Stripe Tax if appropriate, and confirm the tax treatment with your accountant before launch.

## Implementation notes

- The browser supplies only `monthly` or `yearly`; the server chooses the configured Price ID and validates its EUR amount and recurring interval.
- Premium is derived from the server-synced subscription status and period end, or the separate lifetime entitlement. It is no longer granted by the old local demo checkout.
- Account deletion cancels an active Stripe subscription before deleting the Supabase user; deletion is stopped if cancellation cannot be confirmed.
- The Stripe customer and subscription identifiers are stored server-side. No card data is stored by AutoLog.
