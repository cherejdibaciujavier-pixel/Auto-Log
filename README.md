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

## Data and deployment

Vehicle records and demo accounts are stored in the current browser, not synced to a server. The existing account and subscription flows are local demonstrations, not production authentication or payment processing. The Vite build produces static files in `dist/` for deployment to a static host.