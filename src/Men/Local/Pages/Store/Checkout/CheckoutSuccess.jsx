// src/Men/Local/Pages/Store/Checkout/CheckoutSuccess.jsx
import { useEffect, useReducer } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API_BASE from "../../../../../Services/API.js";

const initialState = {
  order: null,
  loading: true,
  error: "",
};

function reducer(state, action) {
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
      const localOrder = location.state?.order;

      if (localOrder) {
        dispatch({ type: "FETCH_SUCCESS", payload: localOrder });

        const payer = localOrder.payer || {};
        const email = payer.email_address || "";
        const name = `${payer.name?.given_name || ""} ${payer.name?.surname || ""}`.trim();
        const amount =
          localOrder.purchase_units?.[0]?.amount?.value ||
          localOrder.amount ||
          "0.00";

        if (email) {
          try {
            await fetch(`${API_BASE}/api/email/receipt`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email,
                name,
                orderId: localOrder.id,
                amount,
              }),
            });
          } catch (err) {
            console.error("Failed to send order receipt:", err);
          }
        }

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
        const res = await fetch(`${API_BASE}/api/paypal/capture?orderID=${orderID}`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to fetch order");

        const data = await res.json();
        dispatch({ type: "FETCH_SUCCESS", payload: data });

        const payer = data.payer || {};
        const email = payer.email_address || "";
        const name = `${payer.name?.given_name || ""} ${payer.name?.surname || ""}`.trim();
        const amount =
          data.purchase_units?.[0]?.amount?.value || data.amount || "0.00";

        if (email) {
          await fetch(`${API_BASE}/api/email/receipt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              name,
              orderId: data.id,
              amount,
            }),
          });
        }
      } catch (err) {
        dispatch({ type: "FETCH_ERROR", payload: err.message });
      }
    };

    processOrder();
  }, [location.state]);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-700">Loading order details…</p>
      </div>
    );

  if (error)
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => navigate("/teamstore")}
          className="mt-6 px-4 py-2 bg-[#5E0009] text-white rounded hover:bg-red-800"
        >
          Back to Store
        </button>
      </div>
    );

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
                {item.name} — {item.quantity} × ${item.unit_amount.value}
              </li>
            ))}
          </ul>
        ) : (
          <p>No item details available.</p>
        )}
      </div>

      <div className="text-center mt-6">
        <button
          onClick={() => navigate("/teamstore")}
          className="px-6 py-2 bg-[#5E0009] text-white rounded hover:bg-red-800"
        >
          Back to Store
        </button>
      </div>
    </div>
  );
}
