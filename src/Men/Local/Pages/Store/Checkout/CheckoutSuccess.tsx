import { useEffect, useReducer } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { apiRequest } from "../../../../../Services/API";
import type {
  PrintifyProduct,
  PublicOrderDetails,
} from "../../../../../types/api";

type EnrichedItem = {
  title: string;
  quantity: number;
  size?: string;
};

type Shipping = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  region?: string | null;
  zip?: string | null;
  country?: string | null;
};

type State = {
  loading: boolean;
  error: string;
  orderId?: string;
  shipping?: Shipping;
  items: EnrichedItem[];
};

type Action =
  | { type: "START" }
  | { type: "SUCCESS"; payload: Omit<State, "loading" | "error"> }
  | { type: "ERROR"; payload: string };

const initialState: State = {
  loading: true,
  error: "",
  items: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START":
      return { ...state, loading: true, error: "" };
    case "SUCCESS":
      return { loading: false, error: "", ...action.payload };
    case "ERROR":
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
}

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const run = async () => {
      dispatch({ type: "START" });

      const orderID =
        location.state?.order?.id ||
        new URLSearchParams(window.location.search).get("orderID");

      if (!orderID) {
        dispatch({ type: "ERROR", payload: "Missing order ID" });
        return;
      }

      try {
        const orderDetails = await apiRequest<PublicOrderDetails>(
          `/api/printify/orders/${orderID}`
        );

        if (!orderDetails?.items?.length) {
          throw new Error("Order not found");
        }

        const products = await apiRequest<PrintifyProduct[]>(
          "/api/printify/products"
        );

        // Enrich items
        const items: EnrichedItem[] = orderDetails.items.map((li) => {
          const product = products.find(
            (p) => String(p.id) === String(li.productId)
          );

          let size;
          if (product) {
            const variant = product.variants.find(
              (v) => String(v.id) === String(li.variantId)
            );
            const sizeIndex = product.options.findIndex(
              (o) => o.type === "size"
            );
            if (variant && sizeIndex >= 0) {
              const sizeId = variant.options[sizeIndex];
              size = product.options[sizeIndex].values.find(
                (v) => String(v.id) === String(sizeId)
              )?.title;
            }
          }

          return {
            title: product?.title || li.productId,
            quantity: li.quantity || 1,
            size,
          };
        });

        dispatch({
          type: "SUCCESS",
          payload: {
            orderId: orderID,
            shipping: orderDetails.shipping || undefined,
            items,
          },
        });
      } catch (e) {
        dispatch({
          type: "ERROR",
          payload: e instanceof Error ? e.message : "Failed to load order",
        });
      }
    };

    run();
  }, [location.state]);

  if (state.loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-12 h-12 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500">Loading order…</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md w-full">
          <p className="text-red-600">{state.error}</p>
          <button
            onClick={() => navigate("/store")}
            className="mt-6 px-6 py-2.5 bg-[#5E0009] text-white rounded-full font-semibold hover:bg-[#7a0012] transition-colors"
          >
            Back to Store
          </button>
        </div>
      </div>
    );
  }

  if (!state.shipping) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md w-full">
          <p className="text-red-600">Unable to load shipping details for this order.</p>
          <button
            onClick={() => navigate("/store")}
            className="mt-6 px-6 py-2.5 bg-[#5E0009] text-white rounded-full font-semibold hover:bg-[#7a0012] transition-colors"
          >
            Back to Store
          </button>
        </div>
      </div>
    );
  }

  const s = state.shipping;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white px-6 py-14 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 mb-3">
          <span className="h-px w-6 bg-white/50" />
          Team Store
          <span className="h-px w-6 bg-white/50" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold">Order Confirmed</h1>
      </div>

      <div className="max-w-xl mx-auto px-4 sm:px-6 -mt-8 pb-16">
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-5">
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1 wrap-break-word">
            <p><strong>Order ID:</strong> {state.orderId}</p>
            <p><strong>Name:</strong> {s.first_name} {s.last_name}</p>
            <p><strong>Email:</strong> {s.email}</p>
            <p className="pt-2">
              <strong>Shipping:</strong><br />
              {s.address1}<br />
              {s.city}, {s.region} {s.zip}<br />
              {s.country}
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <h2 className="font-semibold text-gray-900 mb-2">Items</h2>
            <ul className="space-y-1 text-sm text-gray-700">
              {state.items.map((i, idx) => (
                <li key={idx}>
                  {i.title} - Qty {i.quantity}
                  {i.size && ` (Size: ${i.size})`}
                </li>
              ))}
            </ul>
          </div>

          <div className="text-center">
            <button
              onClick={() => navigate("/store")}
              className="px-6 py-2.5 bg-[#5E0009] text-white rounded-full font-semibold hover:bg-[#7a0012] transition-colors"
            >
              Back to Store
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
