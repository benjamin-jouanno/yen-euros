"use client";

import { useEffect, useRef, useState } from "react";
import type Tesseract from "tesseract.js";
import { extractYenPrices } from "./price-parser";

type PriceScannerProps = {
  yenToEuroRate: number | null;
  onClose: () => void;
  onUsePrice: (amount: number) => void;
};

type ScannerError = "camera" | "permission" | "insecure" | "ocr" | null;

function formatCurrency(amount: number, currency: "JPY" | "EUR") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(amount);
}

function scannerErrorMessage(error: ScannerError) {
  switch (error) {
    case "permission":
      return "Camera access was blocked. Allow camera access in your browser settings, or choose a photo instead.";
    case "insecure":
      return "Camera access needs HTTPS. Open this app over a secure connection, or choose a photo instead.";
    case "ocr":
      return "The text scanner could not start. Check your connection and try again.";
    case "camera":
      return "Could not start the camera. Choose a photo instead.";
    default:
      return null;
  }
}

export default function PriceScanner({
  yenToEuroRate,
  onClose,
  onUsePrice,
}: PriceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const busyRef = useRef(false);
  const resultsFoundRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [ocrReady, setOcrReady] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("Preparing the text scanner…");
  const [error, setError] = useState<ScannerError>(null);
  const [prices, setPrices] = useState<number[]>([]);
  const [noPriceFound, setNoPriceFound] = useState(false);
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(window.isSecureContext ? "camera" : "insecure");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (!cancelled) setCameraReady(true);
      } catch (caughtError) {
        if (cancelled) return;
        console.error("Could not start the camera.", caughtError);
        const name =
          caughtError instanceof DOMException ? caughtError.name : "";
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "permission"
            : window.isSecureContext
              ? "camera"
              : "insecure",
        );
      }
    }

    async function startOcr() {
      try {
        const { createWorker, PSM } = await import("tesseract.js");
        const worker = await createWorker(["jpn", "eng"], undefined, {
          logger: (message) => {
            if (cancelled) return;
            setOcrProgress(Math.round(message.progress * 100));
            if (message.status !== "recognizing text") {
              setOcrStatus("Preparing the text scanner…");
            }
          },
        });

        if (cancelled) {
          await worker.terminate();
          return;
        }

        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SPARSE_TEXT,
          preserve_interword_spaces: "1",
          user_defined_dpi: "300",
        });
        workerRef.current = worker;
        setOcrReady(true);
      } catch (caughtError) {
        if (cancelled) return;
        console.error("Could not prepare the on-device text scanner.", caughtError);
        setError("ocr");
      }
    }

    void startCamera();
    void startOcr();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      const worker = workerRef.current;
      workerRef.current = null;
      if (worker) void worker.terminate();
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled):not([type="file"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (!cameraReady || !ocrReady) return;

    let cancelled = false;
    let timeout: number;

    async function scanFrame() {
      if (cancelled || resultsFoundRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const worker = workerRef.current;

      if (
        busyRef.current ||
        !video ||
        !canvas ||
        !worker ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        timeout = window.setTimeout(scanFrame, 300);
        return;
      }

      busyRef.current = true;
      const scale = Math.min(1, 960 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d");

      if (!context) {
        busyRef.current = false;
        setError("camera");
        timeout = window.setTimeout(scanFrame, 1_600);
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setOcrStatus("Looking for yen prices…");

      try {
        const { data } = await worker.recognize(canvas);
        if (!cancelled) {
          const detected = extractYenPrices(data.text);
          resultsFoundRef.current = detected.length > 0;
          setPrices(detected);
          setNoPriceFound(detected.length === 0);
          setError(null);
        }
      } catch (caughtError) {
        if (!cancelled) {
          console.error("Could not read prices from the camera.", caughtError);
          setError("ocr");
        }
      } finally {
        busyRef.current = false;
        if (!cancelled) timeout = window.setTimeout(scanFrame, 1_600);
      }
    }

    timeout = window.setTimeout(scanFrame, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [cameraReady, ocrReady]);

  async function recognizeCanvas(canvas: HTMLCanvasElement) {
    const worker = workerRef.current;
    if (!worker || busyRef.current) return;

    busyRef.current = true;
    try {
      const { data } = await worker.recognize(canvas);
      const detected = extractYenPrices(data.text);
      resultsFoundRef.current = detected.length > 0;
      setPrices(detected);
      setNoPriceFound(detected.length === 0);
      setError(null);
    } catch (caughtError) {
      console.error("Could not read prices from the camera.", caughtError);
      setError("ocr");
    } finally {
      busyRef.current = false;
    }
  }

  async function readPhoto(file: File) {
    const worker = workerRef.current;
    if (!worker) {
      setError("ocr");
      return;
    }

    while (busyRef.current) {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    if (!workerRef.current) return;

    busyRef.current = true;
    setIsReadingPhoto(true);
    setError(null);
    resultsFoundRef.current = false;
    setPrices([]);

    try {
      const { data } = await worker.recognize(file);
      const detected = extractYenPrices(data.text);
      resultsFoundRef.current = detected.length > 0;
      setPrices(detected);
      setNoPriceFound(detected.length === 0);
      setError(null);
    } catch (caughtError) {
      console.error("Could not read prices from the selected photo.", caughtError);
      setError("ocr");
    } finally {
      busyRef.current = false;
      setIsReadingPhoto(false);
    }
  }

  async function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!video || !canvas || !context || !workerRef.current) {
      return;
    }

    while (busyRef.current) {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    if (!workerRef.current) return;

    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    await recognizeCanvas(canvas);
  }

  const errorMessage = scannerErrorMessage(error);

  return (
    <section
      ref={dialogRef}
      className="scanner-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-title"
    >
      <header className="scanner-header">
        <button
          ref={closeButtonRef}
          className="scanner-close"
          type="button"
          onClick={onClose}
          aria-label="Close price scanner"
        >
          <svg viewBox="0 0 20 20" fill="none" width="22" height="22">
            <path
              d="m5 5 10 10M15 5 5 15"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="scanner-title-group">
          <h2 id="scanner-title">Scan a price</h2>
          <span>JAPANESE YEN → EURO</span>
        </div>
        <span className="scanner-status-dot" aria-label="Camera scanner" />
      </header>

      <div className="scanner-camera">
        <video
          ref={videoRef}
          className={`scanner-video ${cameraReady ? "is-ready" : ""}`}
          autoPlay
          playsInline
          muted
          aria-label="Live camera preview"
        />
        <canvas ref={canvasRef} className="scanner-canvas" />

        {!cameraReady && (
          <div
            className="scanner-camera-placeholder"
            role="status"
            aria-live="polite"
          >
            <span className="scanner-camera-icon">
              <svg viewBox="0 0 32 32" fill="none" width="30" height="30">
                <path
                  d="M5 10.5h5l2-3h8l2 3h5v14H5v-14Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <circle
                  cx="16"
                  cy="17"
                  r="4.25"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
              </svg>
            </span>
            <span>
              {errorMessage ?? "Opening your camera…"}
            </span>
          </div>
        )}

        <div className="scanner-viewfinder" aria-hidden="true">
          <span className="viewfinder-corner viewfinder-top-left" />
          <span className="viewfinder-corner viewfinder-top-right" />
          <span className="viewfinder-corner viewfinder-bottom-left" />
          <span className="viewfinder-corner viewfinder-bottom-right" />
          <span className={`scanner-line ${cameraReady && ocrReady ? "is-active" : ""}`} />
        </div>

        <div className="scanner-camera-tip">
          <span className="scanner-pulse" />
          Center a yen price inside the frame
        </div>

        {cameraReady && errorMessage && (
          <p className="scanner-error-overlay">{errorMessage}</p>
        )}
      </div>

      <div className="scanner-bottom">
        {prices.length > 0 ? (
          <div className="scan-results" aria-live="polite">
            <div className="scan-results-heading">
              <span className="scan-success-icon" aria-hidden="true">✓</span>
              <span>
                <strong>Price found!</strong>
                <span>Tap a price to convert it</span>
              </span>
              <button
                className="scan-again-button"
                type="button"
                onClick={() => {
                  resultsFoundRef.current = false;
                  setPrices([]);
                  setNoPriceFound(false);
                }}
              >
                Scan again
              </button>
            </div>
            <div className="scan-result-list">
              {prices.map((price) => (
                <button
                  className="scan-result"
                  type="button"
                  key={price}
                  onClick={() => onUsePrice(price)}
                >
                  <span className="scan-result-yen">
                    {formatCurrency(price, "JPY")}
                  </span>
                  <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                    <path
                      d="M3.5 10h13m0 0-4.5-4.5M16.5 10 12 14.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="scan-result-euro">
                    {yenToEuroRate
                      ? formatCurrency(price * yenToEuroRate, "EUR")
                      : "Rate unavailable"}
                  </span>
                  <span className="scan-result-action">USE</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="scanner-hint">
            <span className="scanner-hint-icon" aria-hidden="true">¥</span>
            <span>
              <strong>
                {isReadingPhoto
                  ? "Reading your photo…"
                  : !ocrReady
                    ? ocrStatus
                    : noPriceFound
                      ? "No yen price spotted yet"
                      : "Your price will appear here"}
              </strong>
              <span>
                {ocrReady
                  ? errorMessage
                    ? "Try choosing a clear photo of the price."
                    : "Look for ¥, ￥ or 円 next to the amount."
                  : `Loading the Japanese + English text model${ocrProgress > 0 ? ` · ${ocrProgress}%` : ""}`}
              </span>
            </span>
          </div>
        )}

        <div className="scanner-actions">
          <button
            className="scanner-photo-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!ocrReady || isReadingPhoto}
          >
            <svg viewBox="0 0 20 20" fill="none" width="19" height="19">
              <path
                d="M4 5.5h3l1.2-1.7h3.6L13 5.5h3v10H4v-10Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <circle
                cx="10"
                cy="10.5"
                r="2.6"
                stroke="currentColor"
                strokeWidth="1.4"
              />
            </svg>
            Choose photo
          </button>
          <button
            className="scanner-shutter"
            type="button"
            aria-label="Take a photo to scan"
            onClick={() => void captureFrame()}
            disabled={!cameraReady || !ocrReady}
          >
            <span />
          </button>
          <button
            className="scanner-close-action"
            type="button"
            onClick={onClose}
          >
            Done
          </button>
        </div>

        <p className="scanner-privacy">
          Your camera and photos stay on this device.
        </p>

        <input
          ref={fileInputRef}
          className="scanner-file-input"
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Choose a photo to scan"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void readPhoto(file);
            event.currentTarget.value = "";
          }}
        />
      </div>
    </section>
  );
}
