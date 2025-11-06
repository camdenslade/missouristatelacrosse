// src/Men/Local/Pages/Store/hooks/useStore.js
import { useEffect, useState } from "react";

const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;

export default function useStore(cart, containerId = "paypal-buttons-container") {
  const [paypalLoaded, setPaypalLoaded] = useState(false);

  useEffect(() => {
    if (window.paypal){
      setPaypalLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.onload = () => setPaypalLoaded(true);
    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, []);

  useEffect(() => {
    if (!paypalLoaded || !Array.isArray(cart) || cart.length === 0) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    const totalPrice = Math.ceil(
      cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)
    );

    if (!totalPrice || totalPrice <= 0) return;

    window.paypal
      .Buttons({
        style: {
          layout: "vertical",
          color: "gold",
          shape: "rect",
          label: "checkout",
        },

        createOrder: async () => {
          const res = await fetch("/api/paypal/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: totalPrice.toFixed(2) }),
          });
          const data = await res.json();
          return data.id;
        },

        onApprove: async (data) => {
          const orderID = data.orderID || data.id;
          const captureRes = await fetch(`/api/paypal/capture?orderID=${orderID}`, {
            method: "POST",
          });
          const captureData = await captureRes.json();

          const pu0 = captureData?.purchase_units?.[0];
          const ship = pu0?.shipping?.address || {};
          const payer = captureData?.payer || {};
          const payerName = payer?.name || {};

          const printifyRes = await fetch("/api/printify/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: captureData?.id,
              items: cart.map((item) => ({
                productId: item.id,
                variantId: item.variantId,
                quantity: item.quantity || 1,
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
      })
      .render(`#${containerId}`);
  }, [paypalLoaded, cart, containerId]);

  return { paypalLoaded };
}
