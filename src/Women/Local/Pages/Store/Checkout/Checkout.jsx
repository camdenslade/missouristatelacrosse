// src/Women/Local/Pages/Store/Checkout/Checkout.jsx
import { useLocation, useNavigate } from "react-router-dom";
import useStore from "../hooks/useStore.js";
import CheckoutSummary from "./CheckoutSummary.jsx";

export default function Checkout() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const cart = state?.cart || [];
  const donation = state?.donation || 0;
  const setCart = state?.setCart || null;

  const cartTotal = cart.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0
  );

  const total = cartTotal + donation;

  useStore(total, "paypal-buttons-container", setCart, navigate);

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow animate-fadeIn">
      <h1 className="text-3xl font-bold mb-6 text-[#5E0009]">Checkout</h1>

      <CheckoutSummary cart={cart} />

      <div className="mt-6 border-t pt-4 text-right">
        <p className="font-semibold text-lg">Subtotal: ${cartTotal.toFixed(2)}</p>

        {donation > 0 && (
          <p className="text-green-700 font-semibold text-lg">
            Donation: +${donation.toFixed(2)}
          </p>
        )}

        <p className="font-bold text-xl mt-2">Total: ${total.toFixed(2)}</p>

        <div id="paypal-buttons-container" className="mt-4" />
      </div>
    </div>
  );
}
