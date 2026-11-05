CREATE TABLE public.user_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  lifetime_premium boolean NOT NULL DEFAULT false,
  promo_code_redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own entitlements"
  ON public.user_entitlements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.user_entitlements FROM anon, public;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_entitlements FROM authenticated;
GRANT SELECT ON TABLE public.user_entitlements TO authenticated;
