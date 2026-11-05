CREATE TABLE public.user_app_data (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  app_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(app_data) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_app_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own AutoLog data"
  ON public.user_app_data
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON TABLE public.user_app_data FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_app_data TO authenticated;
