import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { apiRequest } from "../../../Services/API";

type PayPalSuccessHandler = (
  captureData: PayPalCaptureResponse,
  amount: number
) => void | Promise<void>;

type PayPalClientIdResponse = {
  clientId: string;
};

type PayPalCreateOrderResponse = {
  id: string;
};

type PayPalPayer = {
  email_address?: string;
};

type PayPalCaptureResponse = {
  id: string;
  payer?: PayPalPayer;
};

export default function usePayPalButtons(
  customAmount: number | string | null,
  containerId = "paypal-buttons",
  onSuccess?: PayPalSuccessHandler,
  label: "donate" | "pay" | "buynow" | "checkout" | "subscribe" = "donate",
  source?: string
) {
  const [paypalLoaded, setPaypalLoaded] = useState(false);

  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
  const [resolvedClientId, setResolvedClientId] = useState(clientId || "");

  useEffect(() => {
    if (!resolvedClientId) {
      (async () => {
        try {
          const data = await apiRequest<PayPalClientIdResponse>(
            "/api/paypal/client-id"
          );
          setResolvedClientId(data.clientId);
        } catch (err) {
          console.error("Error fetching PayPal client ID:", err);
        }
      })();
      return;
    }

    if (window.paypal?.Buttons) {
      setPaypalLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${resolvedClientId}&currency=USD`;
    script.onload = () => setPaypalLoaded(true);
    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [resolvedClientId]);

  useEffect(() => {
    if (!paypalLoaded || customAmount == null) return;

    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const amount =
      typeof customAmount === "number"
        ? customAmount
        : parseFloat(customAmount);

    if (!Number.isFinite(amount) || amount <= 0) return;

    const buttons = window.paypal?.Buttons?.({
      style: {
        layout: "vertical",
        color: "gold",
        shape: "rect",
        label,
      },

      createOrder: async () => {
        const data = await apiRequest<PayPalCreateOrderResponse>(
          "/api/paypal/create",
          {
            method: "POST",
            json: { amount: amount.toFixed(2), source },
          }
        );

        return data.id;
      },

      onApprove: async (data) => {
        // source is intentionally NOT sent here - it's bound server-side at order-creation
        // time (see createOrder above) so a capture can't be relabeled after the fact.
        const captureData = await apiRequest<PayPalCaptureResponse>(
          `/api/paypal/capture?orderID=${data.orderID}`,
          { method: "POST" }
        );

        // Confirmation emails are each flow's own responsibility (DuesPaymentController's
        // receipt email, Donate/FundraiserSuccess's /api/email/send call, etc.) - this hook
        // used to also fire a generic /api/email/confirm-donation here, but that endpoint
        // never existed server-side, so it silently failed on every single payment.

        // Wrap so any post-capture error never surfaces as "Payment failed"
        try {
          await onSuccess?.(captureData, amount);
        } catch (err) {
          console.error("Post-capture handler failed:", err);
        }
      },

      onError: (err) => {
        console.error("PayPal error:", err);
        toast.error("Payment failed. Try again.");
      },
    });

    if (!buttons) return;

    buttons.render(`#${containerId}`);
  }, [paypalLoaded, customAmount, containerId, onSuccess, label, source]);

  return { paypalLoaded };
}
