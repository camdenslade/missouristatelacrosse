// src/hooks/usePayPalButtons.js
import { useEffect, useState } from "react";

export default function usePayPalButtons(
  customAmount,
  containerId = "paypal-buttons",
  onSuccess
) {
  const [paypalLoaded, setPaypalLoaded] = useState(false);

  useEffect(() => {
    if (window.paypal) {
      setPaypalLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${
      import.meta.env.VITE_PAYPAL_CLIENT_ID
    }&currency=USD`;
    script.onload = () => setPaypalLoaded(true);
    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, []);

  useEffect(() => {
    if (!paypalLoaded || !customAmount) return;

    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) return;

    window.paypal
      .Buttons({
        style: { layout: "vertical", color: "gold", shape: "rect", label: "donate" },

        createOrder: async () => {
          const res = await fetch("/api/paypal/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount }),
          });
          const data = await res.json();
          return data.id;
        },

        onApprove: async (data) => {
          const orderID = data.orderID;
          const captureRes = await fetch(`/api/paypal/capture?orderID=${orderID}`, {
            method: "POST",
          });
          const captureData = await captureRes.json();

          await fetch("/api/email/confirm-donation", {
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
  }, [paypalLoaded, customAmount, containerId, onSuccess]);

  return { paypalLoaded };
}
