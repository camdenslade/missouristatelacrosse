// src/Men/Local/Pages/Store/hooks/useStore.js
import { useEffect, useState } from "react";
import { apiRequest } from "../../../../../Services/API";

const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;

type PayPalButtonsInstance = {
  render: (container: HTMLElement) => void;
  close: () => void;
};

type PayPalNamespace = {
  Buttons?: (options: Record<string, unknown>) => PayPalButtonsInstance;
};

type NavigateFn = (path: string, options?: { state?: unknown }) => void;
type SetCartFn = (items: unknown[]) => void;

export default function useStore(
  finalTotal: number,
  containerId = "paypal-buttons-container",
  setCart: SetCartFn | null = null,
  navigate: NavigateFn | null = null,
  cart: any[] = [],
  shipping: any = null,
  donation = 0
) {
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [resolvedClientId, setResolvedClientId] = useState(clientId || "");

  useEffect(() => {
    if (!resolvedClientId) {
      (async () => {
        const data = await apiRequest<{ clientId?: string }>("/api/paypal/client-id");
        if (!data?.clientId) {
          throw new Error("PayPal clientId missing in backend response");
        }
        setResolvedClientId(data.clientId);
      })();
      return;
    }

    const paypal = window.paypal as PayPalNamespace | undefined;
    if (paypal?.Buttons) {
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
    if (!paypalLoaded || finalTotal <= 0) return;

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`PayPal container #${containerId} not found`);
    }

    container.innerHTML = "";

    const paypal = window.paypal as PayPalNamespace | undefined;
    const paypalButtons = paypal?.Buttons?.({
      style: {
        layout: "vertical",
        color: "gold",
        shape: "rect",
        label: "checkout",
      },

      async createOrder() {
        const data = await apiRequest<{ id?: string }>("/api/paypal/create", {
          method: "POST",
          json: { amount: finalTotal.toFixed(2) },
        });

        if (!data?.id) {
          throw new Error("Backend did not return a valid PayPal order id");
        }

        return data.id;
      },

      async onApprove(data) {
        try {
          const orderID = data.orderID;
          if (!orderID) {
            throw new Error("Missing PayPal orderID during approval");
          }

          // Capture PayPal payment
          const order = await apiRequest<Record<string, unknown>>(
            `/api/paypal/capture?orderID=${orderID}`,
            { method: "POST" }
          );

          // Create Printify order
          await apiRequest("/api/printify/create-order", {
            method: "POST",
            json: {
              orderId: orderID,
              items: cart.map((item) => ({
                productId: item.id,
                variantId: item.variantId,
                quantity: item.quantity || 1,
                size: item.size,
                price: item.price,
              })),
              shipping,
              donation,
            },
          });

          // Clear cart only after fulfillment request
          if (typeof setCart === "function") {
            setCart([]);
          }

          // Navigate to success
          if (navigate) {
            navigate("/checkout-success", { state: { order } });
          }
        } catch (err) {
          console.error("ERROR during PayPal onApprove:", err);
          alert("Payment was captured but fulfillment failed. Please contact support.");
          throw err;
        }
      },

      onError(err) {
        console.error("PayPal error:", err);
        alert("Payment failed. Try again.");
      },
    });

    if (!paypalButtons) {
      throw new Error("PayPal Buttons not available on window.paypal");
    }

    paypalButtons.render(container);

    return () => {
      paypalButtons.close();
    };
  }, [
    paypalLoaded,
    finalTotal,
    containerId,
    resolvedClientId,
    setCart,
    navigate,
    cart,
    shipping,
    donation,
  ]);

  return { paypalLoaded };
}
