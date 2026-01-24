// src/Men/Local/Pages/Store/Checkout/CheckoutSuccess.jsx
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
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin mb-4" />
        <p>Loading order…</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600">{state.error}</p>
        <button
          onClick={() => navigate("/store")}
          className="mt-6 px-4 py-2 bg-[#5E0009] text-white rounded"
        >
          Back to Store
        </button>
      </div>
    );
  }

  if (!state.shipping) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600">Unable to load shipping details for this order.</p>
        <button
          onClick={() => navigate("/store")}
          className="mt-6 px-4 py-2 bg-[#5E0009] text-white rounded"
        >
          Back to Store
        </button>
      </div>
    );
  }

  const s = state.shipping;

  return (
    <div className="max-w-xl mx-auto p-8 bg-white rounded shadow">
      <h1 className="text-3xl font-bold text-center text-[#5E0009] mb-6">
        Order Confirmed
      </h1>

      <div className="bg-gray-50 border rounded p-4 mb-6">
        <p><strong>Order ID:</strong> {state.orderId}</p>
        <p><strong>Name:</strong> {s.first_name} {s.last_name}</p>
        <p><strong>Email:</strong> {s.email}</p>
        <p className="mt-2">
          <strong>Shipping:</strong><br />
          {s.address1}<br />
          {s.city}, {s.region} {s.zip}<br />
          {s.country}
        </p>
      </div>

      <div className="bg-gray-50 border rounded p-4">
        <h2 className="font-semibold mb-2">Items</h2>
        <ul className="space-y-1">
          {state.items.map((i, idx) => (
            <li key={idx}>
              {i.title} — Qty {i.quantity}
              {i.size && ` (Size: ${i.size})`}
            </li>
          ))}
        </ul>
      </div>

      <div className="text-center mt-6">
        <button
          onClick={() => navigate("/store")}
          className="px-6 py-2 bg-[#5E0009] text-white rounded hover:bg-red-800"
        >
          Back to Store
        </button>
      </div>
    </div>
  );
}
