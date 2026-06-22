// src/Women/Local/Pages/Store/hooks/useStore.js
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
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
        try {
          const data = await apiRequest<{ clientId?: string }>("/api/paypal/client-id");
          if (data?.clientId) setResolvedClientId(data.clientId);
        } catch (e) {
          console.log("Error: ", e);
        }
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
    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [resolvedClientId]);

  useEffect(() => {
    if (!paypalLoaded) return;
    if (!finalTotal || finalTotal <= 0) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    const paypal = window.paypal as PayPalNamespace | undefined;
    const paypalButtons = paypal?.Buttons?.({
      style: {
        layout: "vertical",
        color: "gold",
        shape: "rect",
        label: "checkout"
      },

      async createOrder() {
        const data = await apiRequest<{ id?: string }>(
          "/api/paypal/create",
          {
            method: "POST",
            json: { amount: finalTotal.toFixed(2), includeShippingFee: true }
          }
        );
        if (!data?.id) throw new Error("Failed to create PayPal order");
        return data.id;
      },

      async onApprove(data) {
        try {
          const orderID = data.orderID;

          const order = await apiRequest<Record<string, unknown>>(
            `/api/paypal/capture?orderID=${orderID}`,
            { method: "POST" }
          );

          // Split cart into Printify items vs custom (non-Printify) items
          const printifyItems = cart.filter((item) => !item.isCustom);
          const customItems = cart.filter((item) => item.isCustom);

          if ((printifyItems.length > 0 || customItems.length > 0) && shipping) {
            await apiRequest("/api/printify/create-order", {
              method: "POST",
              json: {
                orderId: orderID,
                items: printifyItems.map((item) => ({
                  productId: item.id,
                  variantId: item.variantId,
                  quantity: item.quantity || 1,
                  size: item.size,
                  price: item.price,
                })),
                customItems: customItems.map((item) => ({
                  productId: (item as any)._customProductId ?? String(item.id).replace(/^custom-(\d+).*/, "$1"),
                  variantId: (item as any)._customVariantId ?? null,
                  variantLabel: item.variantLabel || item.size || "",
                  quantity: item.quantity || 1,
                })),
                shipping,
                donation,
              },
            });
          }

          if (setCart) {
            setCart([]);
          }

          if (navigate) {
            navigate("/checkout/success", { state: { order } });
          }
        } catch (err) {
          console.error("ERROR during PayPal onApprove:", err);
          toast.error("Payment was captured but fulfillment failed. Please contact support.");
          throw err;
        }
      },

      onError(err) {
        console.error(err);
        toast.error("Payment failed. Try again.");
      }
    });

    if (!paypalButtons) {
      return;
    }

    paypalButtons.render(container);

    return () => {
      try {
        paypalButtons.close();
      } catch (e) {
        console.log("Error: ", e);
      }
    };
  }, [paypalLoaded, finalTotal, containerId, resolvedClientId, setCart, navigate, cart, shipping, donation]);

  return { paypalLoaded };
}

