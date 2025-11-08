// src/Women/Local/Pages/Store/Cart.jsx
import { useState } from "react";
import useStore from "../hooks/useStore.js";

export default function Cart({
  cart,
  setCart,
  showCart,
  setShowCart,
  sidebarRef,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
}) {
  const [donation, setDonation] = useState("");
  const [confirmedDonation, setConfirmedDonation] = useState(0);

  const safeCart = Array.isArray(cart) ? cart : [];
  const subtotal = Math.ceil(
    safeCart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0)
  );
  const totalPrice = subtotal + (confirmedDonation || 0);

  useStore(safeCart, "paypal-buttons-container");

  const handleConfirmDonation = () => {
    const val = parseFloat(donation);
    if (!isNaN(val) && val > 0) {
      setConfirmedDonation(val);
      alert(`Donation confirmed: $${val.toFixed(2)}`);
    } else {
      alert("Please enter a valid donation amount.");
    }
  };

  const removeFromCart = (id, variantId) =>
    setCart((prev) =>
      Array.isArray(prev)
        ? prev.filter((item) => !(item.id === id && item.variantId === variantId))
        : []
    );

  const updateQuantity = (id, variantId, qty) => {
    if (qty < 1) return;
    setCart((prev) =>
      Array.isArray(prev)
        ? prev.map((item) =>
            item.id === id && item.variantId === variantId
              ? { ...item, quantity: qty }
              : item
          )
        : []
    );
  };

  return (
    <div
      ref={sidebarRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl transform transition-transform z-50 ${
        showCart ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex flex-col h-full">
        <div className="p-4 flex justify-between items-center border-b">
          <h2 className="text-lg font-bold">Women’s Team Cart</h2>
          <button
            onClick={() => {
              try {
                window.paypal?.Buttons?.().close?.();
              } catch (err){
                console.log("Error:", err)
              }
              setShowCart(false);
            }}
            className="text-gray-500 hover:text-black px-3 py-1 border rounded"
          >
            Close
          </button>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
          {safeCart.length === 0 ? (
            <p className="text-gray-600">Your cart is empty.</p>
          ) : (
            safeCart.map((item) => (
              <div
                key={`${item.id}-${item.variantId}`}
                className="flex gap-4 items-center bg-gray-50 p-2 rounded shadow hover:bg-gray-100 transition"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-16 h-16 object-contain rounded"
                />
                <div className="flex-1">
                  <p className="font-semibold">{item.title}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity || 1}
                      onChange={(e) =>
                        updateQuantity(
                          item.id,
                          item.variantId,
                          parseInt(e.target.value, 10)
                        )
                      }
                      className="w-16 border rounded px-1 py-0.5 text-center"
                    />
                    <span className="text-[#5E0009] font-bold">
                      ${item.price}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => removeFromCart(item.id, item.variantId)}
                  className="text-red-500 hover:text-red-700 font-bold text-lg"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {safeCart.length > 0 && (
          <div className="p-4 border-t flex flex-col gap-3">
            {/* Donation Input */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">
                Optional Donation:
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  placeholder="Enter amount"
                  value={donation}
                  onChange={(e) => setDonation(e.target.value)}
                  className="border rounded px-2 py-1 flex-1"
                />
                <button
                  onClick={handleConfirmDonation}
                  className="bg-[#5E0009] text-white px-3 rounded hover:bg-red-800 transition"
                >
                  {confirmedDonation ? "Update" : "Add"}
                </button>
              </div>
              {confirmedDonation > 0 && (
                <p className="text-sm text-green-700">
                  Added donation: ${confirmedDonation.toFixed(2)}
                </p>
              )}
            </div>

            <p className="font-bold text-right text-lg">
              Total: ${totalPrice}
            </p>

            <div id="paypal-buttons-container" />
          </div>
        )}
      </div>
    </div>
  );
}
