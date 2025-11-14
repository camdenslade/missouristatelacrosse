// src/Men/Local/Pages/Store/hooks/useStore.js
import { useEffect, useState } from "react";
import API_BASE from "../../../../../Services/API.js";

const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;

export default function useStore(
  finalTotal,
  containerId = "paypal-buttons-container",
  setCart,
  navigate
) {
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [resolvedClientId, setResolvedClientId] = useState(clientId || "");

  useEffect(() => {
    if (!resolvedClientId) {
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/paypal/client-id`);
          const data = await res.json();
          if (data?.clientId) setResolvedClientId(data.clientId);
        } catch (e) {
          console.log("Error: ", e);
        }
      })();
      return;
    }

    if (window.paypal) {
      setPaypalLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${resolvedClientId}&currency=USD&components=buttons,funding-eligibility&enable-funding=card`;
    script.onload = () => setPaypalLoaded(true);
    document.body.appendChild(script);

    return () => (script.onload = null);
  }, [resolvedClientId]);

  useEffect(() => {
    if (!paypalLoaded) return;
    if (!finalTotal || finalTotal <= 0) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    const paypalButtons = window.paypal.Buttons({
      style: {
        layout: "vertical",
        color: "gold",
        shape: "rect",
        label: "checkout"
      },

      async createOrder() {
        const res = await fetch(`${API_BASE}/api/paypal/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: finalTotal.toFixed(2) })
        });

        const data = await res.json();
        if (!data?.id) throw new Error("Failed to create PayPal order");
        return data.id;
      },

      async onApprove(data) {
        const orderID = data.orderID;

        const captureRes = await fetch(
          `${API_BASE}/api/paypal/capture?orderID=${orderID}`,
          { method: "POST" }
        );
        const order = await captureRes.json();

        if (setCart) {
          setCart([]);
        }

        if (navigate) {
          navigate("/checkout/success", { state: { order } });
        }
      },

      onError(err) {
        console.error(err);
        alert("Payment failed. Try again.");
      }
    });

    paypalButtons.render(container);

    return () => {
      try {
        paypalButtons.close();
      } catch (e) {
        console.log("Error: ", e);
      }
    };
  }, [paypalLoaded, finalTotal, containerId, resolvedClientId, setCart, navigate]);

  return { paypalLoaded };
}
