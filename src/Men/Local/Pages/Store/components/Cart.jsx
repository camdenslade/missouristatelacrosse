// src/Men/Local/Pages/Store/Cart.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  const [donation, setDonation] = useState("");
  const [confirmedDonation, setConfirmedDonation] = useState(0);

  const safeCart = Array.isArray(cart) ? cart : [];

  const subtotal = safeCart.reduce(
    (sum, item) => sum + item.price * (item.quantity || 1),
    0
  );

  const finalTotal = Math.ceil(subtotal + (confirmedDonation || 0));

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
      className={`fixed top-0 h-full w-[360px] bg-white shadow-2xl z-[9999] transition-all duration-300 ${
        showCart ? "right-0" : "-right-[360px]"
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 flex justify-between items-center border-b">
          <h2 className="text-lg font-bold">Men’s Team Cart</h2>
          <button
            onClick={() => {
              setShowCart(false);
            }}
            className="text-gray-500 hover:text-black px-3 py-1 border rounded"
          >
            Close
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
          <div className="flex flex-col gap-4">
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
                    {item.size && (
                      <p className="text-sm text-gray-600">Size: {item.size}</p>
                    )}
                    {item.color && (
                      <p className="text-sm text-gray-600">Color: {item.color}</p>
                    )}

                    <div className="flex items-center gap-2 mt-1">
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
                        ${item.price.toFixed(2)}
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

          {/* Donation + Checkout */}
          {safeCart.length > 0 && (
            <div className="flex flex-col gap-3 border-t pt-4">
              {/* Donation */}
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

              {/* Total */}
              <p className="font-bold text-right text-lg">
                Total: ${finalTotal.toFixed(2)}
              </p>

              {/* Checkout */}
              <button
                onClick={() => {
                  setShowCart(false);
                  navigate("/checkout", {
                    state: {
                      cart: safeCart,
                      donation: confirmedDonation > 0 ? confirmedDonation : 0,
                    },
                  });
                }}
                className="bg-[#5E0009] text-white py-2 rounded font-semibold hover:bg-red-800 transition"
              >
                Proceed to Checkout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
