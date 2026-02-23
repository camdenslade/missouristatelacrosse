// src/Global/Common/hooks/usePayPalButtons.ts
import { useEffect, useState } from "react";
import { apiRequest } from "../../../Services/API";

type PayPalSuccessHandler = (
  captureData: PayPalCaptureResponse,
  amount: number
) => void;

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
  onSuccess?: PayPalSuccessHandler
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
        label: "donate",
      },

      createOrder: async () => {
        const data = await apiRequest<PayPalCreateOrderResponse>(
          "/api/paypal/create",
          {
            method: "POST",
            json: { amount: amount.toFixed(2) },
          }
        );

        return data.id;
      },

      onApprove: async (data) => {
        const captureData = await apiRequest<PayPalCaptureResponse>(
          `/api/paypal/capture?orderID=${data.orderID}`,
          { method: "POST" }
        );

        // Fire-and-forget — don't block onSuccess on email delivery
        apiRequest("/api/email/confirm-donation", {
          method: "POST",
          json: {
            orderId: captureData.id,
            payerEmail: captureData.payer?.email_address,
            amount,
          },
        }).catch((err) => console.error("Donation confirmation email failed:", err));

        // Wrap so any post-capture error never surfaces as "Payment failed"
        try {
          await onSuccess?.(captureData, amount);
        } catch (err) {
          console.error("Post-capture handler failed:", err);
        }
      },

      onError: (err) => {
        console.error("PayPal error:", err);
        alert("Payment failed. Try again.");
      },
    });

    if (!buttons) return;

    buttons.render(`#${containerId}`);
  }, [paypalLoaded, customAmount, containerId, onSuccess]);

  return { paypalLoaded };
}
