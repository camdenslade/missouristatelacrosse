// src/Men/Local/Pages/Store/Checkout/Checkout.jsx
import { useState, useEffect } from "react";

import CheckoutSummary from "./CheckoutSummary.jsx";
import useStore from "../hooks/useStore.js";

export default function Checkout({ cart }){
  const [donation, setDonation] = useState("");
  const [cartWithDonation, setCartWithDonation] = useState(cart);

  useEffect(() => {
    const parsed = parseFloat(donation);
    if (isNaN(parsed) || parsed <= 0) {
      setCartWithDonation(cart);
    } else {
      setCartWithDonation([
        ...cart,
        {
          id: "donation",
          title: "Custom Donation",
          price: parsed,
          quantity: 1,
          variantId: "donation",
        },
      ]);
    }
  }, [donation, cart]);

  useStore(cartWithDonation, "paypal-buttons-container");

  const total = cartWithDonation.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0
  );

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow animate-fadeIn">
      <h1 className="text-3xl font-bold mb-6 text-[#5E0009]">Checkout</h1>

      <CheckoutSummary cart={cartWithDonation} />

      <div className="my-4">
        <label className="block font-medium mb-1">Add a Donation (Optional)</label>
        <input
          type="number"
          min="0"
          step="1"
          placeholder="Enter amount"
          value={donation}
          onChange={(e) => setDonation(e.target.value)}
          className="border rounded px-3 py-2 w-full focus:ring-2 focus:ring-[#5E0009] outline-none"
        />
      </div>

      <div className="mt-6 border-t pt-4">
        <p className="text-right font-semibold text-lg mb-4">
          Total: ${total.toFixed(2)}
        </p>
        <div id="paypal-buttons-container" />
      </div>
    </div>
  );
}
