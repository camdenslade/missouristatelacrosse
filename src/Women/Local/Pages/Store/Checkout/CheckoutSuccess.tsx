import { useEffect, useReducer } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { apiRequest } from "../../../../../Services/API";

type PayPalOrderItem = {
  name?: string;
  quantity?: string;
  unit_amount?: { value?: string };
};

type PayPalOrderUnit = {
  amount?: { value?: string };
  items?: PayPalOrderItem[];
};

type PayPalOrder = {
  id: string;
  status?: string;
  payer?: {
    email_address?: string;
    name?: { given_name?: string; surname?: string };
  };
  purchase_units?: PayPalOrderUnit[];
  amount?: string;
};

type State = {
  order: PayPalOrder | null;
  loading: boolean;
  error: string;
};

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: PayPalOrder }
  | { type: "FETCH_ERROR"; payload: string };

const initialState: State = {
  order: null,
  loading: true,
  error: "",
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: "" };
    case "FETCH_SUCCESS":
      return { ...state, loading: false, order: action.payload };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
}

export default function CheckoutSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { order, loading, error } = state;

  useEffect(() => {
    const processOrder = async () => {
      const localOrder = (location.state as { order?: PayPalOrder } | null)?.order;

      if (localOrder) {
        dispatch({ type: "FETCH_SUCCESS", payload: localOrder });
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const orderID = params.get("orderID");
      if (!orderID) {
        dispatch({ type: "FETCH_ERROR", payload: "No order ID found." });
        return;
      }

      try {
        dispatch({ type: "FETCH_START" });
        // Read-only: re-displaying an already-captured order (refresh/back/shared link)
        // should never re-invoke capture, even though /capture is itself idempotent.
        const data = await apiRequest<PayPalOrder>(`/api/paypal/receipt?orderID=${orderID}`);
        dispatch({ type: "FETCH_SUCCESS", payload: data });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch order";
        dispatch({ type: "FETCH_ERROR", payload: message });
      }
    };

    processOrder();
  }, [location.state]);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-12 h-12 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500">Loading order details...</p>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4 text-gray-900">Error</h1>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => navigate("/store")}
            className="mt-6 px-6 py-2.5 bg-[#5E0009] text-white rounded-full font-semibold hover:bg-[#7a0012] transition-colors"
          >
            Back to Store
          </button>
        </div>
      </div>
    );

  if (!order) {
    return null;
  }

  const { id, status, payer, purchase_units } = order;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white px-6 py-14 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 mb-3">
          <span className="h-px w-6 bg-white/50" />
          Team Store
          <span className="h-px w-6 bg-white/50" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold">Thank You!</h1>
        <p className="text-white/80 mt-3">
          Your payment <span className="font-semibold text-white">{status}</span>
        </p>
      </div>

      <div className="max-w-xl mx-auto px-4 sm:px-6 -mt-8 pb-16">
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-5">
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1 wrap-break-word">
            <p><strong>Order ID:</strong> {id}</p>
            <p>
              <strong>Name:</strong> {payer?.name?.given_name} {payer?.name?.surname}
            </p>
            <p><strong>Email:</strong> {payer?.email_address}</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <h2 className="font-semibold text-gray-900 mb-2">Items</h2>
            {purchase_units?.[0]?.items?.length ? (
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                {purchase_units[0].items.map((item, i) => (
                  <li key={i}>
                    {item.name} x {item.quantity} - ${item.unit_amount?.value}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No item details available.</p>
            )}
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
