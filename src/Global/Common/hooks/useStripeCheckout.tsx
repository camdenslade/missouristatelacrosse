// src/Global/Common/hooks/useStripeCheckout.tsx
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import toast from "react-hot-toast";

import { apiRequest } from "../../../Services/API";

type StripeSuccessHandler = (
  captureData: { id: string; payer?: { email_address?: string } },
  amount: number
) => void | Promise<void>;

type StripeConfigResponse = { publishableKey: string; enabled: boolean };
type CreateSessionResponse = { id: string; clientSecret: string };

// One Stripe.js load per publishable key, shared across every mount.
const stripePromises = new Map<string, Promise<Stripe | null>>();
function getStripe(pk: string): Promise<Stripe | null> {
  let p = stripePromises.get(pk);
  if (!p) {
    p = loadStripe(pk);
    stripePromises.set(pk, p);
  }
  return p;
}

/**
 * Drop-in counterpart to usePayPalButtons with the same signature. Renders Stripe
 * Embedded Checkout into `#${containerId}`; on completion it confirms server-side and
 * calls `onSuccess(payload, amount)` with a PayPal-capture-shaped object (so every
 * existing success handler works unchanged). `label` is accepted for signature parity
 * and unused (Stripe Checkout owns its own button UI).
 */
export default function useStripeCheckout(
  customAmount: number | string | null,
  containerId = "stripe-checkout",
  onSuccess?: StripeSuccessHandler,
  _label: "donate" | "pay" | "buynow" | "checkout" | "subscribe" = "pay",
  source?: string
) {
  const envPk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
  const [publishableKey, setPublishableKey] = useState(envPk || "");

  useEffect(() => {
    if (publishableKey) return;
    (async () => {
      try {
        const cfg = await apiRequest<StripeConfigResponse>("/api/stripe/config");
        if (cfg.publishableKey) setPublishableKey(cfg.publishableKey);
      } catch (err) {
        console.error("Error fetching Stripe config:", err);
      }
    })();
  }, [publishableKey]);

  const rootRef = useRef<Root | null>(null);

  // Keep the latest success handler without making it an effect dependency, so a
  // parent re-render that produces a new closure does not tear down the mounted
  // embedded checkout (which would re-create the Stripe session).
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (!publishableKey || customAmount == null) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    const amount =
      typeof customAmount === "number" ? customAmount : parseFloat(customAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    let cancelled = false;
    let capturedSessionId = "";

    const fetchClientSecret = async () => {
      const data = await apiRequest<CreateSessionResponse>("/api/stripe/create", {
        method: "POST",
        json: { amount: amount.toFixed(2), source },
      });
      // The session id is the client secret's prefix; keep it for the confirm call.
      capturedSessionId = data.id || data.clientSecret.split("_secret_")[0];
      return data.clientSecret;
    };

    const handleComplete = async () => {
      if (cancelled) return;
      try {
        const payload = await apiRequest<{ id: string; payer?: { email_address?: string } }>(
          `/api/stripe/confirm?sessionId=${encodeURIComponent(capturedSessionId)}`,
          { method: "POST" }
        );
        try {
          await onSuccessRef.current?.(payload, amount);
        } catch (err) {
          console.error("Post-payment handler failed:", err);
        }
      } catch (err) {
        console.error("Stripe confirm failed:", err);
        toast.error(
          `Your card was charged but we couldn't finish. Contact us with reference ${capturedSessionId}.`
        );
      }
    };

    container.innerHTML = "";
    const root = createRoot(container);
    rootRef.current = root;
    root.render(
      <EmbeddedCheckoutProvider
        stripe={getStripe(publishableKey)}
        options={{ fetchClientSecret, onComplete: handleComplete }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    );

    return () => {
      cancelled = true;
      const r = rootRef.current;
      rootRef.current = null;
      // Defer unmount so we never unmount synchronously from inside render/effect.
      setTimeout(() => {
        try {
          r?.unmount();
        } catch {
          /* already gone */
        }
      }, 0);
    };
    // onSuccess intentionally excluded — read via ref above.
  }, [publishableKey, customAmount, containerId, source]);

  return { stripeLoaded: !!publishableKey };
}
