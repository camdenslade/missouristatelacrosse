// src/Men/Local/Pages/Store/Checkout/Checkout.jsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useStore from "../hooks/useStore";
import CheckoutSummary from "./CheckoutSummary";
import { useMenCart } from "../context/MenCartContext";

const SHIPPING_FEE = 5;

export default function Checkout() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { cart: persistedCart, setCart } = useMenCart();

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
    (sum, item) => sum + item.price * (item.quantity || 1),
    0
  );

  const totalBeforeShipping = cartTotal + donation;
  const total = totalBeforeShipping + SHIPPING_FEE;

  // PayPal only activates when shipping is valid
  useStore(
    isShippingValid ? totalBeforeShipping : 0,
    "paypal-buttons-container",
    setCart,
    navigate,
    cart,
    shipping,
    donation
  );

  const update = (k: string, v: string) =>
    setShipping((s) => ({ ...s, [k]: v }));

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-3xl font-bold mb-6 text-[#5E0009]">Checkout</h1>

      <CheckoutSummary cart={cart} />

      {/* SHIPPING */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <input placeholder="First Name" className="border p-2" onChange={e => update("firstName", e.target.value)} />
        <input placeholder="Last Name" className="border p-2" onChange={e => update("lastName", e.target.value)} />
        <input placeholder="Email" className="border p-2 col-span-2" onChange={e => update("email", e.target.value)} />
        <input placeholder="Phone" className="border p-2 col-span-2" onChange={e => update("phone", e.target.value)} />
        <input placeholder="Address Line 1" className="border p-2 col-span-2" onChange={e => update("address1", e.target.value)} />
        <input placeholder="Address Line 2" className="border p-2 col-span-2" onChange={e => update("address2", e.target.value)} />
        <input placeholder="City" className="border p-2" onChange={e => update("city", e.target.value)} />
        <input placeholder="State" className="border p-2" onChange={e => update("region", e.target.value)} />
        <input placeholder="ZIP" className="border p-2" onChange={e => update("zip", e.target.value)} />
        <input placeholder="Country" className="border p-2" value="US" disabled />
      </div>

      {/* TOTAL */}
      <div className="mt-6 border-t pt-4 text-right">
        <p className="font-semibold text-lg">Subtotal: ${cartTotal.toFixed(2)}</p>

        {donation > 0 && (
          <p className="text-green-700 font-semibold text-lg">
            Donation: +${donation.toFixed(2)}
          </p>
        )}

        <p className="font-semibold text-lg">
          Shipping: +${SHIPPING_FEE.toFixed(2)}
        </p>

        <p className="font-bold text-xl mt-2">
          Total: ${total.toFixed(2)}
        </p>

        {!isShippingValid && (
          <p className="text-sm text-red-600 mt-2">
            Complete shipping information to continue.
          </p>
        )}

        <div id="paypal-buttons-container" className="mt-4" />
      </div>
    </div>
  );
}
