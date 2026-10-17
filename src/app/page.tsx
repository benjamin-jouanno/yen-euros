"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Currency = "JPY" | "EUR";

type Quote = {
  base: Currency;
  rate: number;
  date: string;
};

type CachedQuote = {
  rate: number;
  date: string;
};

const currencyDetails: Record<
  Currency,
  { name: string; symbol: string }
> = {
  JPY: { name: "Japanese yen", symbol: "¥" },
  EUR: { name: "Euro", symbol: "€" },
};

function currencyFormatter(currency: Currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  });
}

function rateFormatter(currency: Currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumSignificantDigits: 5,
  });
}

function readCachedQuote(base: Currency): CachedQuote | null {
  try {
    const stored = window.localStorage.getItem(`yen-euros:quote:${base}`);
    if (!stored) return null;

    const quote: unknown = JSON.parse(stored);
    if (
      typeof quote === "object" &&
      quote !== null &&
      "rate" in quote &&
      typeof quote.rate === "number" &&
      Number.isFinite(quote.rate) &&
      quote.rate > 0 &&
      "date" in quote &&
      typeof quote.date === "string"
    ) {
      return {
        rate: quote.rate,
        date: quote.date,
      };
    }
  } catch (error) {
    console.error("Could not read the saved exchange rate.", error);
  }

  return null;
}

function saveCachedQuote(base: Currency, quote: CachedQuote) {
  try {
    window.localStorage.setItem(
      `yen-euros:quote:${base}`,
      JSON.stringify(quote),
    );
  } catch (error) {
    console.error("Could not save the exchange rate for offline use.", error);
  }
}

function CurrencyBadge({ currency }: { currency: Currency }) {
  return (
    <span
      className={`currency-badge currency-badge-${currency.toLowerCase()}`}
      aria-hidden="true"
    >
      {currency === "JPY" ? (
        <span className="flag-japan-dot" />
      ) : (
        <span className="flag-europe-star">✦</span>
      )}
    </span>
  );
}

function Converter() {
  const [base, setBase] = useState<Currency>("JPY");
  const [amount, setAmount] = useState("10000");
  const [refreshKey, setRefreshKey] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadedBase, setLoadedBase] = useState<Currency | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target: Currency = base === "JPY" ? "EUR" : "JPY";
  const isLoading = loadedBase !== base;

  useEffect(() => {
    const controller = new AbortController();
    const cached = readCachedQuote(base);

    async function loadQuote() {
      try {
        const response = await fetch(
          `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${target}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`Exchange-rate service returned ${response.status}.`);
        }

        const data: unknown = await response.json();
        if (
          typeof data !== "object" ||
          data === null ||
          !("date" in data) ||
          typeof data.date !== "string" ||
          !("rates" in data) ||
          typeof data.rates !== "object" ||
          data.rates === null ||
          !(target in data.rates)
        ) {
          throw new Error("The exchange-rate service returned an invalid quote.");
        }

        const rate = (data.rates as Record<string, unknown>)[target];
        if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
          throw new Error("The exchange-rate service returned an invalid rate.");
        }

        setQuote({ base, rate, date: data.date });
        saveCachedQuote(base, { rate, date: data.date });
      } catch (caughtError) {
        if (controller.signal.aborted) return;
        console.error("Could not load the latest exchange rate.", caughtError);
        if (cached) setQuote({ base, rate: cached.rate, date: cached.date });
        setError(
          cached
            ? "Couldn’t refresh the rate. Showing your last saved quote."
            : "Couldn’t load a rate. Check your connection and try again.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadedBase(base);
          setIsRefreshing(false);
        }
      }
    }

    void loadQuote();
    return () => controller.abort();
  }, [base, target, refreshKey]);

  const numericAmount = amount.trim() === "" ? Number.NaN : Number(amount);
  const converted =
    quote?.base === base && Number.isFinite(numericAmount) && numericAmount >= 0
      ? numericAmount * quote.rate
      : null;
  const presetAmounts = base === "JPY" ? [500, 1_000, 5_000, 10_000] : [5, 10, 50, 100];

  function swapCurrencies() {
    setError(null);
    setIsRefreshing(false);
    setBase(target);
  }

  return (
    <section className="converter-card" aria-labelledby="converter-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">CURRENCY CONVERTER</p>
          <h2 id="converter-title">Convert an amount</h2>
        </div>
        <span className="live-indicator">
          <span className="live-dot" />
          ECB RATE
        </span>
      </div>

      <div className="currency-fields">
        <label className="currency-field" htmlFor="amount">
          <span className="field-label">YOU SEND</span>
          <span className="field-content">
            <CurrencyBadge currency={base} />
            <span className="currency-description">
              <span className="currency-code">{base}</span>
              <span className="currency-name">{currencyDetails[base].name}</span>
            </span>
            <input
              id="amount"
              aria-label={`Amount in ${currencyDetails[base].name}`}
              className="amount-input"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </span>
        </label>

        <div className="swap-row">
          <span className="field-divider" />
          <button
            className="swap-button"
            type="button"
            onClick={swapCurrencies}
            aria-label={`Swap ${base} and ${target}`}
            title="Swap currencies"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              width="19"
              height="19"
            >
              <path
                d="M4 6h11m0 0-3-3m3 3-3 3M16 14H5m0 0 3 3m-3-3 3-3"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="currency-field result-field" aria-live="polite">
          <span className="field-label">THEY RECEIVE</span>
          <span className="field-content">
            <CurrencyBadge currency={target} />
            <span className="currency-description">
              <span className="currency-code">{target}</span>
              <span className="currency-name">
                {currencyDetails[target].name}
              </span>
            </span>
            <output className="amount-output" htmlFor="amount">
              {converted === null
                ? isLoading
                  ? "Loading…"
                  : "—"
                : currencyFormatter(target).format(converted)}
            </output>
          </span>
        </div>
      </div>

      <div className="presets-heading">
        <span>QUICK AMOUNTS</span>
        <span>Tap to fill</span>
      </div>
      <div className="amount-presets" aria-label={`Quick amounts in ${base}`}>
        {presetAmounts.map((preset) => (
          <button
            key={preset}
            className={`amount-preset ${numericAmount === preset ? "is-selected" : ""}`}
            type="button"
            aria-label={`Set amount to ${currencyFormatter(base).format(preset)}`}
            aria-pressed={numericAmount === preset}
            onClick={() => setAmount(String(preset))}
          >
            {currencyFormatter(base).format(preset)}
          </button>
        ))}
      </div>

      {error && (
        <p className={`quote-message ${quote ? "quote-warning" : "quote-error"}`}>
          {error}
        </p>
      )}

      <div className="rate-summary">
        <div className="rate-copy">
          <span className="rate-label">EXCHANGE RATE</span>
          <strong>
            1 {base} <span aria-hidden="true">=</span>{" "}
            {quote?.base === base
              ? rateFormatter(target).format(quote.rate)
              : "—"}
          </strong>
          <span className="rate-meta">
            {quote?.base === base ? (
              <>
                ECB reference · {quote.date}
              </>
            ) : (
              "Rates provided by the European Central Bank"
            )}
          </span>
        </div>
        <span className="rate-arrows" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" width="19" height="19">
            <path
              d="M3.5 10h13m0 0-4.5-4.5M16.5 10 12 14.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      <div className="card-footer">
        <span>
          Rates are updated on ECB business days.
        </span>
        <button
          className="refresh-button"
          type="button"
          onClick={() => {
            setIsRefreshing(true);
            setError(null);
            setRefreshKey((current) => current + 1);
          }}
          disabled={isRefreshing}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            width="14"
            height="14"
          >
            <path
              d="M13.5 8a5.5 5.5 0 0 1-9.42 3.89M2.5 8a5.5 5.5 0 0 1 9.42-3.89M4.08 11.89H4v-2m0 2H2m9.92-7.78H12v2m0-2h2"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {isRefreshing ? "Refreshing" : "Refresh rate"}
        </button>
      </div>
    </section>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function PwaControls() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installError, setInstallError] = useState(false);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js")
        .then(async () => {
          const assets = [
            ...new Set(
              performance
                .getEntriesByType("resource")
                .map((resource) => new URL(resource.name).pathname)
                .filter(
                  (path) =>
                    path.startsWith("/_next/static/") &&
                    /\.(?:css|js)$/i.test(path),
                ),
            ),
          ];
          if (assets.length === 0) return;
          const cache = await caches.open("yen-euros-v2");
          await cache.addAll(assets);
        })
        .catch((error: unknown) => {
          console.error("Could not prepare offline app assets.", error);
        });
    } else {
      console.error("This browser does not support offline service workers.");
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      setInstallError(false);
    } catch (error) {
      console.error("Could not open the app installation prompt.", error);
      setInstallError(true);
    }
  }

  return (
    <>
      {installPrompt ? (
        <button className="install-button" type="button" onClick={installApp}>
          <svg
            aria-hidden="true"
            viewBox="0 0 18 18"
            fill="none"
            width="16"
            height="16"
          >
            <path
              d="M9 2.75v8m0 0 3-3m-3 3-3-3M3.5 11.5v2.75h11V11.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Install app
        </button>
      ) : null}
      {installError && (
        <span className="install-error" role="status">
          Install prompt unavailable
        </span>
      )}
    </>
  );
}

export default function Home() {
  return (
    <main className="page-shell">
      <div className="blossom-decoration blossom-decoration-top" aria-hidden="true">
        <svg viewBox="0 0 160 160" fill="none">
          <path
            d="M8 147c34-23 55-53 63-91 5-22 20-38 43-49m-93 116c13-2 26 0 38 8m-20-31c13-1 24 1 35 7m12-45c-1-12 2-23 10-34"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <g fill="currentColor">
            <circle cx="70" cy="54" r="5" />
            <circle cx="61" cy="48" r="5" />
            <circle cx="65" cy="38" r="5" />
            <circle cx="76" cy="39" r="5" />
            <circle cx="80" cy="49" r="5" />
            <circle cx="96" cy="31" r="4" />
            <circle cx="88" cy="26" r="4" />
            <circle cx="92" cy="18" r="4" />
            <circle cx="101" cy="20" r="4" />
            <circle cx="104" cy="28" r="4" />
            <circle cx="43" cy="91" r="4" />
            <circle cx="35" cy="86" r="4" />
            <circle cx="38" cy="78" r="4" />
            <circle cx="47" cy="80" r="4" />
            <circle cx="51" cy="87" r="4" />
          </g>
          <g fill="#fff8fc">
            <circle cx="70" cy="45" r="2" />
            <circle cx="96" cy="25" r="1.7" />
            <circle cx="43" cy="84" r="1.7" />
          </g>
        </svg>
      </div>
      <div className="blossom-decoration blossom-decoration-bottom" aria-hidden="true">
        <svg viewBox="0 0 160 160" fill="none">
          <path
            d="M8 147c34-23 55-53 63-91 5-22 20-38 43-49m-93 116c13-2 26 0 38 8m-20-31c13-1 24 1 35 7m12-45c-1-12 2-23 10-34"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <g fill="currentColor">
            <circle cx="70" cy="54" r="5" />
            <circle cx="61" cy="48" r="5" />
            <circle cx="65" cy="38" r="5" />
            <circle cx="76" cy="39" r="5" />
            <circle cx="80" cy="49" r="5" />
            <circle cx="96" cy="31" r="4" />
            <circle cx="88" cy="26" r="4" />
            <circle cx="92" cy="18" r="4" />
            <circle cx="101" cy="20" r="4" />
            <circle cx="104" cy="28" r="4" />
            <circle cx="43" cy="91" r="4" />
            <circle cx="35" cy="86" r="4" />
            <circle cx="38" cy="78" r="4" />
            <circle cx="47" cy="80" r="4" />
            <circle cx="51" cy="87" r="4" />
          </g>
          <g fill="#fff8fc">
            <circle cx="70" cy="45" r="2" />
            <circle cx="96" cy="25" r="1.7" />
            <circle cx="43" cy="84" r="1.7" />
          </g>
        </svg>
      </div>

      <header className="site-header">
        <Link className="brand" href="/" aria-label="Yen and Euro home">
          <span className="brand-mark" aria-hidden="true">
            <span>¥</span>
            <span>€</span>
          </span>
          <span className="brand-copy">
            <span className="brand-name">YENLY</span>
            <span className="brand-caption">JPY <i /> EUR</span>
          </span>
        </Link>
        <div className="header-actions">
          <PwaControls />
        </div>
      </header>

      <div className="main-content">
        <section className="intro">
          <div className="intro-topline">
            <span className="intro-blossom" aria-hidden="true">✿</span>
            A LITTLE CURRENCY MAGIC
          </div>
          <h1>
            From yen
            <br />
            to <span>euro.</span>
          </h1>
          <p className="intro-copy">
            Your pocket-sized exchange companion.
            <br className="desktop-break" /> A softer way to see the difference.
          </p>
        </section>

        <div className="converter-column">
          <Converter />
          <p className="trust-note">
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              width="15"
              height="15"
            >
              <path
                d="M8 1.75 13 3.5v3.75c0 3.25-2.2 5.6-5 7-2.8-1.4-5-3.75-5-7V3.5l5-1.75Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <path
                d="m5.8 7.7 1.45 1.45 3-3"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            The latest reference rate, updated on ECB business days.
          </p>
        </div>
      </div>

      <footer className="site-footer">
        <span className="footer-flower" aria-hidden="true">✿</span>
        <span className="install-instructions">iPhone/iPad: Share → Add to Home Screen</span>
        <span className="footer-source">
          Rates by{" "}
          <a
            href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html"
            target="_blank"
            rel="noreferrer"
          >
            European Central Bank
          </a>
        </span>
      </footer>
    </main>
  );
}
