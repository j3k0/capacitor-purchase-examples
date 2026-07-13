/**
 * Capacitor Purchase Plugin — Offline Entitlements Example
 *
 * Demonstrates:
 *  - Registering a subscription product on Apple App Store & Google Play
 *  - Receipt validation via iaptic
 *  - OfflineEntitlements: persists verified purchases so isOwned() works offline
 *  - Handling the approved → verify → verified → finish lifecycle
 *  - Logging offline.isOwned() and offline events for smoke-test grepping
 */

import { store, CdvPurchase, Logger, ProductType, Platform, LogLevel, Iaptic } from 'capacitor-plugin-cdv-purchase';
import { ENV } from './env';

const log = new Logger({ verbosity: LogLevel.DEBUG }, 'OfflineExample');

// ──────────────────────────────────────────────
// 1. Register products (configured in env.ts)
// ──────────────────────────────────────────────
store.register(ENV.subscriptionIds.flatMap((id: string) => [{
  id,
  type: ProductType.PAID_SUBSCRIPTION,
  platform: Platform.APPLE_APPSTORE,
  group: 'default',
}, {
  id,
  type: ProductType.PAID_SUBSCRIPTION,
  platform: Platform.GOOGLE_PLAY,
  group: 'default',
}]));

store.verbosity = LogLevel.DEBUG;
store.applicationUsername = ENV.applicationUsername;

// ──────────────────────────────────────────────
// 2. Receipt validation with iaptic (configured in env.ts)
// ──────────────────────────────────────────────
const iaptic = new Iaptic({
  appName: ENV.iapticAppName,
  apiKey: ENV.iapticApiKey,
  url: ENV.iapticUrl,
});
store.validator = iaptic.validator;

// ──────────────────────────────────────────────
// 3. OfflineEntitlements — persists verified purchases for offline use
// ──────────────────────────────────────────────
const offline = new CdvPurchase.OfflineEntitlements(store, {
  gracePeriodMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  onExpiredOffline: 'readonly',
  detectClockRollback: true,
});

// Register event callback to log offline entitlement events
let lastOfflineEvent: CdvPurchase.OfflineEntitlementEvent | null = null;
offline.onEvent((event: CdvPurchase.OfflineEntitlementEvent) => {
  lastOfflineEvent = event;
  // Log line the smoke test greps for — uses store.log so prefix is [CdvPurchase]
  store.log.info(`offline event: ${event.type} / ${event.productId} / ${event.message}`);
  renderOfflineEvent();
});

// ──────────────────────────────────────────────
// 4. Event handlers
// ──────────────────────────────────────────────
store.error(onStoreError);

let receiptsReady = false;
store.when()
  .receiptsVerified(() => { receiptsReady = true; renderUI(); })
  .productUpdated(() => renderUI())
  .approved(transaction => transaction.verify())
  .verified(receipt => receipt.finish())
  .finished(() => renderUI());

// ──────────────────────────────────────────────
// 5. Initialize — connects to the store, then loads offline cache
// ──────────────────────────────────────────────
// store.initialize() is called first so that any verified events fired
// during init update the in-memory cache before we load from storage.
// offline.ready() loads the persisted cache afterward so isOwned() can
// answer even if the device is offline. This avoids a race where
// loadFromStorage() could overwrite freshly-persisted data from onVerified().
store.initialize([
  Platform.APPLE_APPSTORE,
  Platform.GOOGLE_PLAY,
]);
offline.ready().then(() => {
  log.info('OfflineEntitlements ready — cache loaded');
  renderOfflineStatus();
});

renderUI();

// ─── UI helpers ────────────────────────────────

function renderUI() {
  const store = CdvPurchase.store;
  const statusEl = document.getElementById('status');
  const productsEl = document.getElementById('products');
  if (!statusEl || !productsEl) return;

  // Subscription status
  const subscriptions = store.products.filter(p => p.type === ProductType.PAID_SUBSCRIPTION);
  const owned = subscriptions.find(p => p.owned);
  if (owned) {
    const vp = store.findInVerifiedReceipts(owned);
    statusEl.innerHTML = `<h2>Subscribed</h2>`
      + `<div>Product: ${owned.id}</div>`
      + (vp?.expiryDate ? `<div>Renews: ${new Date(vp.expiryDate).toLocaleDateString()}</div>` : '');
  } else if (subscriptions.some(p => {
    const t = store.findInLocalReceipts(p);
    return t && (t.state === CdvPurchase.TransactionState.APPROVED || t.state === CdvPurchase.TransactionState.INITIATED);
  })) {
    statusEl.innerHTML = '<h2>Processing...</h2>';
  } else if (!receiptsReady) {
    statusEl.innerHTML = '<h2>Checking your subscription...</h2>';
  } else {
    statusEl.innerHTML = '<h2>Not Subscribed</h2>';
  }

  // Product list
  const validProducts = store.products.filter(p => p.offers.length > 0);
  productsEl.innerHTML = validProducts.map(p => `<div id="product-${p.id}"></div>`).join('');
  validProducts.forEach(product => {
    const el = document.getElementById(`product-${product.id}`);
    if (!el) return;
    const offers = product.offers.map(offer => {
      const pricing = offer.pricingPhases.map(phase => {
        const cycle =
          phase.recurrenceMode === 'FINITE_RECURRING'
            ? `${phase.billingCycles ?? ''} × `
            : phase.recurrenceMode === 'NON_RECURRING' ? ''
              : 'every ';
        return `${phase.price} (${cycle}${formatDuration(phase.billingPeriod)})`;
      }).join(' then ');
      const buyBtn = offer.canPurchase
        ? ` <button onclick="orderOffer('${product.platform}','${product.id}','${offer.id}')">Subscribe</button>`
        : '';
      return `<li>${pricing}${buyBtn}</li>`;
    }).join('');
    el.innerHTML = `<h3>${product.title}</h3>`
      + `<div>${product.description || ''}</div>`
      + `<ul>${offers}</ul>`;
  });

  const storefrontEl = document.getElementById('storefront');
  const storefront = store.getStorefront();
  if (storefrontEl && storefront) storefrontEl.innerHTML = `
    <p>Store: ${storefront.platform} (${storefront.countryCode})</p>
  `;

  // Also refresh offline status
  renderOfflineStatus();
}

function renderOfflineStatus() {
  const el = document.getElementById('offline-status');
  if (!el) return;
  // Check offline.isOwned() for each registered product
  const results = ENV.subscriptionIds.map((id: string) => {
    const owned = offline.isOwned(id);
    // Log line the smoke test greps for — uses store.log so prefix is [CdvPurchase]
    store.log.info(`offline.isOwned('${id}') = ${owned}`);
    return `<div>offline.isOwned('${id}') = <strong>${owned}</strong></div>`;
  });
  el.innerHTML = '<h3>Offline Entitlements</h3>' + results.join('');
}

function renderOfflineEvent() {
  const el = document.getElementById('offline-event');
  if (!el) return;
  if (lastOfflineEvent) {
    el.innerHTML = `<h3>Last Offline Event</h3>`
      + `<div>type: ${lastOfflineEvent.type}</div>`
      + `<div>product: ${lastOfflineEvent.productId}</div>`
      + `<div>message: ${lastOfflineEvent.message}</div>`;
  } else {
    el.innerHTML = '';
  }
}

// Expose globally so HTML onclick handlers work
const w = window as unknown as { orderOffer: (platform: string, productId: string, offerId: string) => void; restorePurchases: () => void };
w.orderOffer = function(platform: string, productId: string, offerId: string) {
  const offer = CdvPurchase.store.get(productId, platform as CdvPurchase.Platform)?.getOffer(offerId);
  if (offer) CdvPurchase.store.order(offer);
};

w.restorePurchases = function() {
  CdvPurchase.store.restorePurchases();
};

function formatDuration(iso: string | undefined): string {
  if (!iso) return '';
  const n = iso.slice(1, iso.length - 1);
  const unit = iso[iso.length - 1];
  const units: Record<string, [string, string]> = {
    D: ['day', 'days'], W: ['week', 'weeks'], M: ['month', 'months'], Y: ['year', 'years'],
  };
  const [singular, plural] = units[unit] || [unit, unit];
  return n === '1' ? `1 ${singular}` : `${n} ${plural}`;
}

function onStoreError(error: CdvPurchase.IError) {
  if (error.code === CdvPurchase.ErrorCode.PAYMENT_CANCELLED) return;
  const el = document.getElementById('error');
  if (!el) return;
  el.textContent = `ERROR ${error.code}: ${error.message}`;
  setTimeout(() => { el.textContent = ''; }, 10000);
}