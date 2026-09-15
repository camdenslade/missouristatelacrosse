import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import CheckoutSummary from "./CheckoutSummary";
import { useWomenCart } from "../context/WomenCartContext";
import useStore from "../hooks/useStore";

const SHIPPING_FEE = 5;

export default function Checkout() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { cart: persistedCart, setCart } = useWomenCart();

  const cart = Array.isArray(state?.cart) ? state.cart : persistedCart;
  const donation = state?.donation || 0;

  const [shipping, setShipping] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address1: "",
    address2: "",
    city: "",
    region: "",
    zip: "",
    country: "US",
  });

  const isShippingValid =
    shipping.firstName &&
    shipping.lastName &&
    shipping.email &&
    shipping.address1 &&
    shipping.city &&
    shipping.region &&
    shipping.zip &&
    shipping.country;

  const cartTotal = cart.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0
  );

  const totalBeforeShipping = cartTotal + donation;
  const total = totalBeforeShipping + SHIPPING_FEE;

  // PayPal only activates when shipping is valid
  useStore(
    isShippingValid ? total : 0,
    "paypal-buttons-container",
    setCart,
    navigate,
    cart,
    shipping,
    donation
  );

  const update = (k: string, v: string) =>
    setShipping((s) => ({ ...s, [k]: v }));

  const inputCls =
    "border border-gray-200 rounded-xl px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition disabled:bg-gray-50 disabled:text-gray-400";

  return (
    <div className="min-h-screen bg-gray-50 animate-fadeIn">
      <div className="bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white px-6 py-14 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 mb-3">
          <span className="h-px w-6 bg-white/50" />
          Team Store
          <span className="h-px w-6 bg-white/50" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold">Checkout</h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-8 pb-16">
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <CheckoutSummary cart={cart} />

          {/* SHIPPING */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            <input placeholder="First Name" className={inputCls} onChange={e => update("firstName", e.target.value)} />
            <input placeholder="Last Name" className={inputCls} onChange={e => update("lastName", e.target.value)} />
            <input placeholder="Email" className={`${inputCls} col-span-2`} onChange={e => update("email", e.target.value)} />
            <input placeholder="Phone" className={`${inputCls} col-span-2`} onChange={e => update("phone", e.target.value)} />
            <input placeholder="Address Line 1" className={`${inputCls} col-span-2`} onChange={e => update("address1", e.target.value)} />
            <input placeholder="Address Line 2" className={`${inputCls} col-span-2`} onChange={e => update("address2", e.target.value)} />
            <input placeholder="City" className={inputCls} onChange={e => update("city", e.target.value)} />
            <input placeholder="State" className={inputCls} onChange={e => update("region", e.target.value)} />
            <input placeholder="ZIP" className={inputCls} onChange={e => update("zip", e.target.value)} />
            <input placeholder="Country" className={inputCls} value="US" disabled />
          </div>

          {/* TOTAL */}
          <div className="mt-8 border-t border-gray-100 pt-5 text-right space-y-1">
            <p className="text-gray-500">Subtotal: ${cartTotal.toFixed(2)}</p>

            {donation > 0 && (
              <p className="text-green-700 font-medium">
                Donation: +${donation.toFixed(2)}
              </p>
            )}

            <p className="text-gray-500">
              Shipping: +${SHIPPING_FEE.toFixed(2)}
            </p>

            <p className="font-bold text-xl text-gray-900 pt-1">Total: ${total.toFixed(2)}</p>

            {!isShippingValid && (
              <p className="text-sm text-red-600 pt-1">
                Complete shipping information to continue.
              </p>
            )}

            <div id="paypal-buttons-container" className="mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
