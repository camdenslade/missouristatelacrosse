import { X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const SHIPPING_FEE = 5;

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

  const subtotal = Math.ceil(
    safeCart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0)
  );

  const totalWithShipping = subtotal + (confirmedDonation || 0) + SHIPPING_FEE;

  const handleConfirmDonation = () => {
    const val = parseFloat(donation);
    if (!isNaN(val) && val > 0) {
      setConfirmedDonation(val);
      toast.success(`Donation confirmed: $${val.toFixed(2)}`);
    } else {
      toast.error("Please enter a valid donation amount.");
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
      className={`fixed top-0 h-full w-[360px] max-w-[90vw] bg-white shadow-2xl rounded-l-2xl z-9999 transition-all duration-300 ${
        showCart ? "right-0" : "-right-[360px]"
      }`}
    >
      <div className="flex flex-col h-full">
        <div className="px-5 py-4 flex justify-between items-center border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Women's Team Cart</h2>
          <button
            onClick={() => setShowCart(false)}
            className="text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Close cart"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            {safeCart.length === 0 ? (
              <p className="text-gray-400 text-center py-10">Your cart is empty.</p>
            ) : (
              safeCart.map((item) => (
                <div
                  key={`${item.id}-${item.variantId}`}
                  className="flex gap-4 items-center bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-16 h-16 object-contain rounded-lg bg-white shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 leading-snug">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
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
                        className="w-14 border border-gray-200 rounded-lg px-1.5 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
                      />
                      <span className="text-[#5E0009] font-bold">
                        ${item.price}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id, item.variantId)}
                    className="text-gray-400 hover:text-red-600 transition-colors shrink-0"
                    aria-label="Remove item"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          {safeCart.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Optional Donation
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="Enter amount"
                    value={donation}
                    onChange={(e) => setDonation(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
                  />
                  <button
                    onClick={handleConfirmDonation}
                    className="bg-[#5E0009] text-white text-sm font-semibold px-4 rounded-full hover:bg-[#7a0012] transition"
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

              <div className="text-right space-y-0.5">
                <p className="text-sm text-gray-500">
                  Shipping: ${SHIPPING_FEE.toFixed(2)}
                </p>
                <p className="font-bold text-lg text-gray-900">
                  Total: ${totalWithShipping.toFixed(2)}
                </p>
              </div>

              <button
                onClick={() => {
                  setShowCart(false);

                  navigate("/women/checkout", {
                    state: {
                      cart: safeCart,
                      donation: confirmedDonation > 0 ? confirmedDonation : 0,
                    }
                  });
                }}
                className="bg-[#5E0009] text-white py-2.5 rounded-full font-semibold hover:bg-[#7a0012] transition"
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

