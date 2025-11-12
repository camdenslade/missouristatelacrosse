// src/Women/Local/Pages/Store/hooks/useStore.js
import { useEffect, useState } from "react";
import API_BASE from "../../../../../Services/API.js";

const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;

export default function useStore(cart, containerId = "paypal-buttons-container") {
  const [paypalLoaded, setPaypalLoaded] = useState(false);
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
      console.error(
        "PayPal client ID is missing."
      );
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
    if (!paypalLoaded || !Array.isArray(cart) || cart.length === 0) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    const safeCart = Array.isArray(cart) ? cart : [];
    const totalPrice = Math.ceil(
      safeCart.reduce(
        (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
        0
      )
    );

    if (!totalPrice || totalPrice <= 0) return;

    const paypalButtons = window.paypal.Buttons({
      style: {
        layout: "vertical",
        color: "gold",
        shape: "rect",
        label: "checkout",
      },

      createOrder: async () => {
        const res = await fetch(`${API_BASE}/api/paypal/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: totalPrice.toFixed(2) }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to create PayPal order");
        }
        const data = await res.json();
        if (!data?.id) {
          throw new Error("No order ID returned from backend");
        }
        return data.id;
      },

      onApprove: async (data) => {
        const missingSizes = safeCart.filter((item) => !item.size || item.size.trim() === "");
          if (missingSizes.length > 0) {
            alert("Please select a size for all items before checking out.");
            throw new Error("Missing size selection for one or more items.");
          }

        const orderID = data.orderID || data.id;
        const captureRes = await fetch(
          `${API_BASE}/api/paypal/capture?orderID=${orderID}`,
          { method: "POST" }
        );
        if (!captureRes.ok) {
          const errorData = await captureRes.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to capture PayPal order");
        }

        const captureData = await captureRes.json();
        const pu0 = captureData?.purchase_units?.[0];
        const ship = pu0?.shipping?.address || {};
        const payer = captureData?.payer || {};
        const payerName = payer?.name || {};

        const printifyRes = await fetch(`${API_BASE}/api/printify/create-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: captureData?.id,
            items: safeCart.map((item) => ({
              productId: item.id,
              variantId: item.variantId,
              quantity: item.quantity || 1,
              size: item.size || "",
            })),
            shipping: {
              firstName: payerName.given_name || "",
              lastName: payerName.surname || "",
              email: payer?.email_address || "",
              phone: "",
              country: ship.country_code || "",
              region: ship.admin_area_1 || "",
              city: ship.admin_area_2 || "",
              address1: ship.address_line_1 || "",
              address2: ship.address_line_2 || "",
              zip: ship.postal_code || "",
            },
          }),
        });

        const printifyJson = await printifyRes.json();
        if (!printifyRes.ok) {
          console.error("Printify order error:", printifyJson);
          alert("Payment captured, but product fulfillment failed.");
          return;
        }

        alert("Order placed successfully!");
      },

      onError: (err) => {
        console.error("PayPal error:", err);
        alert("Payment failed. Try again.");
      },
    });

    paypalButtons.render(`#${containerId}`);

    return () => {
      try {
        paypalButtons.close();
      } catch (err) {
        console.warn("PayPal cleanup error:", err);
      }
    };
  }, [paypalLoaded, cart, containerId, resolvedClientId]);

  return { paypalLoaded };
}
