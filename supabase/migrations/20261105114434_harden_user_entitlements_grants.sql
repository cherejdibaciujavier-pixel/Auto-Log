REVOKE ALL ON TABLE public.user_entitlements FROM anon, authenticated, public;
GRANT SELECT ON TABLE public.user_entitlements TO authenticated;
GRANT ALL ON TABLE public.user_entitlements TO service_role;
