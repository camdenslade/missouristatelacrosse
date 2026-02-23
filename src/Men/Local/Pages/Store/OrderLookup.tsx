import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiRequest } from "../../../../Services/API";
import type { PrintifyProduct, PublicOrderDetails } from "../../../../types/api";

type EnrichedItem = {
  title: string;
  quantity: number;
  size?: string;
};

export default function OrderLookup() {
  const location = useLocation();
  const [inputValue, setInputValue] = useState("");
  const [currentOrderId, setCurrentOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderDetails, setOrderDetails] = useState<PublicOrderDetails | null>(null);
  const [items, setItems] = useState<EnrichedItem[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paramId = params.get("orderID")?.trim();
    if (paramId) {
      setInputValue(paramId);
      setCurrentOrderId(paramId);
    }
  }, [location.search]);

  useEffect(() => {
    if (!currentOrderId) {
      setOrderDetails(null);
      setItems([]);
      setError("");
      setLoading(false);
      return;
    }

    let canceled = false;
    setLoading(true);
    setError("");
    setOrderDetails(null);
    setItems([]);

    (async () => {
      try {
        const order = await apiRequest<PublicOrderDetails>(
          `/api/printify/orders/${encodeURIComponent(currentOrderId)}`
        );
        const products = await apiRequest<PrintifyProduct[]>("/api/printify/products");
        if (canceled) return;
        setOrderDetails(order);
        setItems(enrichItems(order.items || [], products));
      } catch (err) {
        if (canceled) return;
        const message = err instanceof Error ? err.message : "Failed to load order";
        setError(message);
        setOrderDetails(null);
        setItems([]);
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [currentOrderId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError("Enter an order ID");
      return;
    }
    setError("");
    setCurrentOrderId(trimmed);
    updateQueryParam(trimmed);
  };

  const shipping = orderDetails?.shipping;

  const shippingLines = useMemo(() => {
    if (!shipping) return [];
    const lines = [];
    if (shipping.first_name || shipping.last_name) {
      lines.push(
        [shipping.first_name, shipping.last_name]
          .filter(Boolean)
          .join(" ")
          .trim()
      );
    }
    if (shipping.address1) lines.push(shipping.address1);
    if (shipping.address2) lines.push(shipping.address2);
    if (shipping.city || shipping.region || shipping.zip) {
      const parts = [shipping.city, shipping.region].filter(Boolean).join(", ");
      const cityRegion = parts ? `${parts} ${shipping.zip ?? ""}`.trim() : shipping.zip ?? "";
      if (cityRegion) lines.push(cityRegion);
    }
    if (shipping.country) lines.push(shipping.country);
    return lines;
  }, [shipping]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div className="bg-white border border-gray-200 rounded p-6 shadow-sm space-y-3">
        <h1 className="text-2xl font-bold text-[#5E0009]">Order Lookup</h1>
        <p className="text-sm text-gray-600">
          Enter the PayPal/Printify order ID (the same value that appears on your email receipt) to
          view the items and shipping information. The link in your receipt pre-fills the order ID.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="49647108GM469223U"
            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-[#5E0009] text-white rounded hover:bg-red-800 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Looking up…" : "Lookup Order"}
          </button>
        </form>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-10 h-10 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Fetching order details…</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-4 text-sm">
          {error}
        </div>
      )}

      {orderDetails && (
        <div className="bg-white border border-gray-200 rounded p-6 shadow-sm space-y-6">
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Order ID</p>
            <p className="text-lg font-semibold text-gray-900">{orderDetails.orderId}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-700">Shipping</h2>
              {shippingLines.length > 0 ? (
                <div className="text-sm text-gray-700 space-y-1">
                  {shippingLines.map((line, idx) => (
                    <p key={idx}>{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Shipping information is not available.</p>
              )}
              {shipping?.email && (
                <p className="text-sm text-gray-600">Email: {shipping.email}</p>
              )}
              {shipping?.phone && (
                <p className="text-sm text-gray-600">Phone: {shipping.phone}</p>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-700">Items</h2>
              <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
                {items.length > 0 ? (
                  items.map((item, idx) => (
                    <li key={idx}>
                      <span className="font-medium">{item.title}</span> — Qty {item.quantity}
                      {item.size && <span> (Size: {item.size})</span>}
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500">No line items were returned for this order.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function updateQueryParam(orderId: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("orderID", orderId);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function enrichItems(
  rawItems: PublicOrderDetails["items"],
  products: PrintifyProduct[]
): EnrichedItem[] {
  return (rawItems || []).map((item) => {
    const product = products.find((p) => String(p.id) === String(item.productId));
    return {
      title: product?.title ?? item.productId,
      quantity: item.quantity || 1,
      size: findSize(product, item.variantId),
    };
  });
}

function findSize(product: PrintifyProduct | undefined, variantId?: string | number): string | undefined {
  if (!product || variantId == null) return undefined;
  const variant = product.variants.find((v) => String(v.id) === String(variantId));
  if (!variant) return undefined;
  const sizeIndex = product.options.findIndex((option) => option.type.toLowerCase() === "size");
  if (sizeIndex === -1) return undefined;
  const sizeOption = product.options[sizeIndex];
  const sizeId = variant.options[sizeIndex];
  if (sizeId == null) return undefined;
  return sizeOption.values.find((value) => String(value.id) === String(sizeId))?.title;
}
