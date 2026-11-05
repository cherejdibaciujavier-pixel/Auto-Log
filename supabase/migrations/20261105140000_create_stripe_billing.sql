CREATE TABLE public.user_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  checkout_session_id text UNIQUE,
  checkout_session_expires_at timestamptz,
  billing_cycle text CHECK (billing_cycle IN ('monthly', 'yearly')),
  status text NOT NULL DEFAULT 'incomplete',
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.user_subscriptions FROM anon, public;
REVOKE ALL ON TABLE public.user_subscriptions FROM authenticated;
GRANT SELECT ON TABLE public.user_subscriptions TO authenticated;
GRANT ALL ON TABLE public.user_subscriptions TO service_role;

CREATE TABLE public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_webhook_events FROM anon, authenticated, public;
GRANT ALL ON TABLE public.stripe_webhook_events TO service_role;
