import { useCallback } from "react";

import usePaymentButtons from "../../../../../Global/Common/hooks/usePaymentButtons";
import { apiRequest } from "../../../../../Services/API";

type NavigateFn = (path: string, options?: { state?: unknown }) => void;
type SetCartFn = (items: any[] | ((prev: any[]) => any[])) => void;

/**
 * Women's store checkout. Delegates the payment UI to usePaymentButtons (PayPal or
 * Stripe per VITE_PAYMENT_PROVIDER_WOMEN); post-payment fulfilment (Printify order +
 * receipt email + cart clear + navigate) runs from the shared onSuccess callback.
 * `finalTotal` must already include the shipping fee.
 */
export default function useStore(
  finalTotal: number,
  containerId = "paypal-buttons-container",
  setCart: SetCartFn | null = null,
  navigate: NavigateFn | null = null,
  cart: any[] = [],
  shipping: any = null,
  donation = 0
) {
  const onSuccess = useCallback(
    async (captureData: { id: string }) => {
      const orderID = captureData?.id;
      if (!orderID) {
        throw new Error("Missing order id after payment");
      }

      const printifyItems = cart.filter((item) => !item.isCustom);
      const customItems = cart.filter((item) => item.isCustom);

      if (printifyItems.length > 0 || customItems.length > 0) {
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
              productId:
                (item as any)._customProductId ??
                String(item.id).replace(/^custom-(\d+).*/, "$1"),
              variantId: (item as any)._customVariantId ?? null,
              variantLabel: item.variantLabel || item.size || "",
              quantity: item.quantity || 1,
            })),
            shipping,
            donation,
          },
        });
      }

      try {
        await apiRequest("/api/email/receipt", {
          method: "POST",
          json: {
            email: shipping?.email,
            name: `${shipping?.firstName || ""} ${shipping?.lastName || ""}`.trim(),
            orderId: orderID,
            body: `Thank you for your order from Missouri State Lacrosse! Your order ID is ${orderID}.`,
          },
        });
      } catch (emailErr) {
        console.warn("Receipt email failed (non-blocking):", emailErr);
      }

      if (typeof setCart === "function") {
        setCart([]);
      }

      if (navigate) {
        navigate("/women/checkout-success", { state: { order: captureData } });
      }
    },
    [cart, shipping, donation, setCart, navigate]
  );

  const { ready } = usePaymentButtons(
    finalTotal > 0 ? finalTotal : null,
    containerId,
    onSuccess as Parameters<typeof usePaymentButtons>[2],
    "checkout",
    "store"
  );

  return { paypalLoaded: ready };
}
