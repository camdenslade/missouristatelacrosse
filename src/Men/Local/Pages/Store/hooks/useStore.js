// src/Men/Local/Pages/Store/hooks/useStore.js
import { useEffect, useState } from "react";
import API_BASE from "../../../../../Services/API.js";

const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;

export default function useStore(
  finalTotal,
  containerId = "paypal-buttons-container",
  setCart = null,
  navigate = null
) {
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [resolvedClientId, setResolvedClientId] = useState(clientId || "");

  useEffect(() => {
    if (!resolvedClientId) {
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/paypal/client-id`);
          if (!res.ok) throw new Error(`Failed to get PayPal clientId (status ${res.status})`);

          const data = await res.json();
          if (!data?.clientId) throw new Error("PayPal clientId missing in backend response");

          setResolvedClientId(data.clientId);
        } catch (err) {
          console.error("ERROR loading PayPal clientId:", err);
          throw err;
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
    script.onerror = (err) => {
      console.error("PayPal SDK failed to load:", err);
      throw err;
    };

    document.body.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [resolvedClientId]);

  useEffect(() => {
    try {
      if (!paypalLoaded) return;
      if (!finalTotal || finalTotal <= 0) return;

      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`PayPal container #${containerId} not found`);
      }

      container.innerHTML = "";

      const paypalButtons = window.paypal.Buttons({
        style: {
          layout: "vertical",
          color: "gold",
          shape: "rect",
          label: "checkout",
        },

        async createOrder() {
          try {
            const res = await fetch(`${API_BASE}/api/paypal/create`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount: finalTotal.toFixed(2) }),
            });

            if (!res.ok) {
              throw new Error(`PayPal create failed (status ${res.status})`);
            }

            const data = await res.json();
            if (!data?.id) {
              throw new Error("Backend did not return a valid PayPal order id");
            }

            return data.id;
          } catch (err) {
            console.error("ERROR creating PayPal order:", err);
            throw err;
          }
        },

        async onApprove(data) {
          try {
            const orderID = data.orderID;
            if (!orderID) {
              throw new Error("Missing PayPal orderID during approval");
            }

            const captureRes = await fetch(
              `${API_BASE}/api/paypal/capture?orderID=${orderID}`,
              { method: "POST" }
            );

            if (!captureRes.ok) {
              throw new Error(`PayPal capture failed (status ${captureRes.status})`);
            }

            const order = await captureRes.json();

            if (typeof setCart === "function") {
              setCart([]);
            }

            if (navigate) {
              navigate("/checkout/success", { state: { order } });
            }
          } catch (err) {
            console.error("ERROR during PayPal onApprove:", err);
            throw err;
          }
        },

        onError(err) {
          console.error("PayPal error:", err);
          alert("Payment failed. Try again.");
        },
      });

      paypalButtons.render(container);

      return () => {
        try {
          paypalButtons.close();
        } catch (err) {
          console.error("ERROR cleaning up PayPal buttons:", err);
          throw err;
        }
      };
    } catch (err) {
      console.error("ERROR inside PayPal render effect:", err);
      throw err;
    }
  }, [paypalLoaded, finalTotal, containerId, resolvedClientId, setCart, navigate]);

  return { paypalLoaded };
}
