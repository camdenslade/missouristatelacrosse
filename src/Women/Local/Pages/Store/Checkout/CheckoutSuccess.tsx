// src/Women/Local/Pages/Store/Checkout/CheckoutSuccess.jsx
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
        const data = await apiRequest<PayPalOrder>(`/api/paypal/capture?orderID=${orderID}`, {
          method: "POST",
        });
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
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-700">Loading order details...</p>
      </div>
    );

  if (error)
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => navigate("/store")}
          className="mt-6 px-4 py-2 bg-[#5E0009] text-white rounded hover:bg-red-800"
        >
          Back to Store
        </button>
      </div>
    );

  if (!order) {
    return null;
  }

  const { id, status, payer, purchase_units } = order;

  return (
    <div className="p-8 max-w-xl mx-auto bg-white rounded shadow">
      <h1 className="text-3xl font-bold mb-6 text-center text-[#5E0009]">
        Thank You!
      </h1>
      <p className="mb-2 text-center">
        Your payment <span className="font-semibold">{status}</span>
      </p>

      <div className="border p-4 rounded mb-4 bg-gray-50">
        <p><strong>Order ID:</strong> {id}</p>
        <p>
          <strong>Name:</strong> {payer?.name?.given_name} {payer?.name?.surname}
        </p>
        <p><strong>Email:</strong> {payer?.email_address}</p>
      </div>

      <div className="border p-4 rounded bg-gray-50">
        <h2 className="font-semibold mb-2">Items</h2>
        {purchase_units?.[0]?.items?.length ? (
          <ul className="list-disc pl-5 space-y-1">
            {purchase_units[0].items.map((item, i) => (
              <li key={i}>
                {item.name} x {item.quantity} - ${item.unit_amount?.value}
              </li>
            ))}
          </ul>
        ) : (
          <p>No item details available.</p>
        )}
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
