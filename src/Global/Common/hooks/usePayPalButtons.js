// src/hooks/usePayPalButtons.js
import { useEffect, useState } from "react";

export default function usePayPalButtons(
  customAmount,
  containerId = "paypal-buttons",
  onSuccess
) {
  const [paypalLoaded, setPaypalLoaded] = useState(false);

  const API_BASE =
    window.location.hostname === "localhost"
      ? "http://localhost:8080"
      : "https://api.missouristatelacrosse.com";
  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
  const [resolvedClientId, setResolvedClientId] = useState(clientId || "");

  useEffect(() => {
    if (!resolvedClientId) {
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/paypal/client-id`);
          const data = await res.json();
          if (data?.clientId) setResolvedClientId(data.clientId);
          else console.error("Failed to resolve PayPal client ID from backend");
        } catch (e) {
          console.error("Error fetching PayPal client ID:", e);
        }
      })();
    }

    if (window.paypal) {
      setPaypalLoaded(true);
      return;
    }

    if (!resolvedClientId) {
      console.error("PayPal client ID is missing. Set VITE_PAYPAL_CLIENT_ID in your environment.");
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${resolvedClientId}&currency=USD`;
    script.onload = () => setPaypalLoaded(true);
    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [resolvedClientId, API_BASE]);


  useEffect(() => {
    if (!paypalLoaded || !customAmount) return;

    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) return;

    window.paypal
      .Buttons({
        style: {
          layout: "vertical",
          color: "gold",
          shape: "rect",
          label: "donate",
        },

        createOrder: async () => {
          const res = await fetch(`${API_BASE}/api/paypal/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: amount.toFixed(2) }),
          });

          const data = await res.json();
          if (!data?.id) {
            console.error("PayPal create error:", data);
            throw new Error("No order ID returned from backend");
          }

          return data.id;
        },

        onApprove: async (data) => {
          const orderID = data.orderID;

          const captureRes = await fetch(
            `${API_BASE}/api/paypal/capture?orderID=${orderID}`,
            { method: "POST" }
          );
          const captureData = await captureRes.json();

          await fetch(`${API_BASE}/api/email/confirm-donation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: captureData.id,
              payerEmail: captureData.payer?.email_address,
              amount,
            }),
          });

          if (onSuccess) onSuccess(captureData, amount);
        },

        onError: (err) => {
          console.error("PayPal error:", err);
          alert("Payment failed. Try again.");
        },
      })
      .render(`#${containerId}`);
  }, [paypalLoaded, customAmount, containerId, onSuccess, API_BASE]);

  return { paypalLoaded };
}
