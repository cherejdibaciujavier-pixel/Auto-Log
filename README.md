# AutoLog

AutoLog is a client-side vehicle maintenance and expense tracker built with React and Vite.

```sh
npm install
npm run dev
npm run build
```

## Logging a fill-up

The fuel form is money-first, matching how a pump receipt reads: enter the **amount spent** and the **price per litre**, and the volume is derived (`amount ÷ price`). A "litres → money" toggle mirrors the calculation for receipts that only list the volume.

The derived figure is shown live, alongside the range that fuel buys on the driver's own measured average, a gauge comparing the fill-up with their typical one, and quick-amount shortcuts. Saving is blocked until both the amount and the pump price are known, so a record can never be stored with a zero or guessed price.

Pump prices are always displayed and stored to three decimals (`€1.879/L`); only totals are rounded to two. Electric vehicles use the same calculator in kWh. Volumes are stored canonically in litres (kWh for EVs) and converted for display only, so switching between kilometres and miles never changes the saved data.

## Nearby fuel and charging

The Fuel tab includes an interactive map, location search, station list, fuel-grade selection, price sorting, and directions. Location permission is optional; users can also search by city or drag the map and search that area. Location and search queries are sent to the providers below when a search is requested. AutoLog does not save the location to its local database.

- Station locations and map tiles come from OpenStreetMap. Nearby searches use Photon, with Overpass as a fallback. Public services have rate limits and no availability guarantee; production deployments should consider self-hosted or commercial providers.
- Station-level petrol and diesel prices for metropolitan France and Corsica come from the French government's open data service. Spain, Italy and Western Australia prices come from FuelWide's government-data feeds.
- Other regions still show available station locations, but prices are not supplied. Charging prices are not available. Missing prices are never estimated.
- Quotes use the source's currency and price per litre. Individual quote or feed timestamps are shown when available; old reports are marked. Prices can be delayed or change without notice, so confirm them at the pump. Refresh requests new data, subject to the provider's cache and availability.
- Mapping and live search require an internet connection. Geolocation requires a secure context such as HTTPS or localhost.

## Accounts and Supabase

Email/password sign-up and sign-in use the AutoLog Supabase project. Visitors use the normal account form; they do **not** need their own Supabase key. The app includes only the project's browser-safe publishable key, which is designed to be public. Never put a `service_role` or `sb_secret` key in browser code or any `VITE_*` variable.

Supabase Auth handles password storage, sessions, profile-name updates, and password changes. The project currently permits email sign-ups and auto-confirms new accounts. Account deletion is handled by the `delete-account` Edge Function, which verifies the signed-in user and uses the server-side Supabase service-role environment variable; that secret is never shipped to the browser.

To run locally:

```sh
npm install
npm run dev
```

The Supabase project URL and publishable key are set as safe defaults in `src/lib/supabase.ts`, so there is no per-user setup. To point a deployment at another project, copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The Supabase redirect allow-list includes the repository's GitHub Pages URL (`https://cherejdibaciujavier-pixel.github.io/Auto-Log/`), localhost development, and the existing Vercel domains. If you deploy under a custom domain or a different path, add that URL to Supabase Auth's **URL Configuration → Redirect URLs** and set the production **Site URL**.

## Data and deployment

Signed-in users' vehicle records, fuel/service logs, documents, and settings are stored in the Supabase `user_app_data` table and sync when changes are saved. Gallery car photos are uploaded to a private Supabase Storage bucket with owner-only access. Row-level security restricts every record and photo to its owner. Guest mode is a temporary in-memory demo and is not persisted. If an account has no cloud row yet, matching legacy demo data is copied to Supabase and removed from that browser after the cloud save succeeds. Premium checkout and subscriptions are still a local demo, not real payment processing. The Vite build produces static files in `dist/` for deployment to a static host.