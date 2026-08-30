// src/Global/Common/hooks/usePaymentButtons.ts
import { resolvePaymentProvider } from "./usePaymentProvider";
import usePayPalButtons from "./usePayPalButtons";
import useStripeCheckout from "./useStripeCheckout";

type SuccessHandler = (
  captureData: { id: string; payer?: { email_address?: string } },
  amount: number
) => void | Promise<void>;

/**
 * Single entry point for every paid flow. Renders either the PayPal buttons or Stripe
 * Embedded Checkout into `#${containerId}` depending on VITE_PAYMENT_PROVIDER(_WOMEN).
 * The inactive rail is called with a null amount so it stays inert (rules-of-hooks:
 * both hooks are always invoked). Callers keep the exact usePayPalButtons signature.
 */
export default function usePaymentButtons(
  customAmount: number | string | null,
  containerId = "payment-buttons",
  onSuccess?: SuccessHandler,
  label: "donate" | "pay" | "buynow" | "checkout" | "subscribe" = "pay",
  source?: string
) {
  const useStripe = resolvePaymentProvider() === "stripe";

  const paypal = usePayPalButtons(
    useStripe ? null : customAmount,
    containerId,
    onSuccess,
    label,
    source
  );
  const stripe = useStripeCheckout(
    useStripe ? customAmount : null,
    containerId,
    onSuccess,
    label,
    source
  );

  return {
    provider: useStripe ? ("stripe" as const) : ("paypal" as const),
    paypalLoaded: paypal.paypalLoaded,
    stripeLoaded: stripe.stripeLoaded,
    // Back-compat: callers that only checked `paypalLoaded` for a spinner still work,
    // and new callers can check `ready` regardless of provider.
    ready: useStripe ? stripe.stripeLoaded : paypal.paypalLoaded,
  };
}
