# Yen & Euro

A small installable PWA for converting between Japanese yen (JPY) and euros (EUR). Exchange rates are fetched from [Frankfurter](https://frankfurter.dev/), which provides reference rates published by the European Central Bank.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The converter fetches the latest available rate when it opens and lets you switch the conversion direction or refresh the quote.

## Install and offline use

Deploy over HTTPS to make the app installable. Supported browsers show their native install prompt; on iOS, use **Share → Add to Home Screen**. A service worker precaches the app shell and its JavaScript and CSS so the converter can reopen offline. The most recently fetched exchange rate is saved on the device and remains available offline.

Exchange rates are reference rates, not real-time trading or guaranteed transaction rates. They are normally updated on working days.

## Production

```bash
npm run build
npm run start
```
