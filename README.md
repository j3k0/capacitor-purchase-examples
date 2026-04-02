# Capacitor Purchase Examples

Minimal, standalone examples for [capacitor-plugin-purchase](https://github.com/j3k0/cordova-plugin-purchase/tree/feat/capacitor-plugin-support/capacitor) using the **CdvPurchase v13+ API** with [iaptic](https://www.iaptic.com) receipt validation.

## Examples

| Example | Description |
|---------|-------------|
| [subscriptions/](subscriptions/) | Auto-renewable subscriptions (Apple App Store & Google Play) |
| [consumables/](consumables/) | Consumable products with quantity support |

## Getting Started

Each example is a **complete, standalone Capacitor project**. To run one:

```bash
cd subscriptions/                         # pick an example
npm install
cp src/js/env.example.ts src/js/env.ts    # copy environment template
# edit src/js/env.ts with your product IDs and iaptic credentials
npm run build
npx cap add ios                           # or android
npx cap sync
npx cap open ios                          # opens Xcode
```

Before building, update the placeholder values:
- **Product IDs** in `src/js/env.ts` — replace with your own
- **iaptic credentials** — replace `YOUR_IAPTIC_APP_NAME` and `YOUR_IAPTIC_API_KEY`
- **App ID** in `capacitor.config.json` — replace with your bundle identifier

## Shared Scripts

- **`shared/update-plugin.sh <version>`** — Update `capacitor-plugin-purchase` to a specific version in all examples
- **`shared/build-all.sh <platform>`** — Build all examples for a given platform and report pass/fail

## TypeScript

Each example uses TypeScript with Vite. Edit `src/js/index.ts`, then build:

```bash
npm run build     # production build (outputs to dist/)
npm run start     # Vite dev server
```

## License

MIT
