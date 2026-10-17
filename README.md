# Yen & Euro

A small installable PWA for converting between Japanese yen (JPY) and euros (EUR). Exchange rates are fetched from [Frankfurter](https://frankfurter.dev/), which provides reference rates published by the European Central Bank.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The converter fetches the latest available rate when it opens and lets you switch the conversion direction or refresh the quote.

## Scan a yen price

Choose **Scan a yen price** to open the full-screen camera scanner. Allow camera access, point the camera at a price, and tap a detected amount to fill the converter. The scanner also accepts a photo if camera access is unavailable.

Text recognition runs on the device using Tesseract.js; camera frames and selected photos are not uploaded. The Japanese and English OCR models download the first time the scanner is used and are cached by the browser. Camera access requires HTTPS (or localhost).

## Install and offline use

Deploy over HTTPS to make the app installable. Supported browsers show their native install prompt; on iOS, use **Share → Add to Home Screen**. A service worker precaches the app shell and its JavaScript and CSS so the converter can reopen offline. The most recently fetched exchange rate is saved on the device and remains available offline.

Exchange rates are reference rates, not real-time trading or guaranteed transaction rates. They are normally updated on working days.

## Production

```bash
npm run build
npm run start
```
