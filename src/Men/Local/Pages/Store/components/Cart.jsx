// src/Men/Local/Pages/Store/Cart.jsx
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
  const totalPrice = Math.ceil(
    cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0)
  );

  useStore(cart, "paypal-buttons-container");

  const removeFromCart = (id, variantId) =>
    setCart((prev) =>
      prev.filter((item) => !(item.id === id && item.variantId === variantId))
    );

  const updateQuantity = (id, variantId, qty) => {
    if (qty < 1) return;
    setCart((prev) =>
      prev.map((item) =>
        item.id === id && item.variantId === variantId
          ? { ...item, quantity: qty }
          : item
      )
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
          <h2 className="text-lg font-bold">Men’s Team Cart</h2>
          <button
            onClick={() => setShowCart(false)}
            className="text-gray-500 hover:text-black px-3 py-1 border rounded"
          >
            Close
          </button>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
          {cart.length === 0 ? (
            <p className="text-gray-600">Your cart is empty.</p>
          ) : (
            cart.map((item) => (
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

        {cart.length > 0 && (
          <div className="p-4 border-t flex flex-col gap-2">
            <p className="font-bold text-right text-lg">Total: ${totalPrice}</p>
            <div id="paypal-buttons-container" />
          </div>
        )}
      </div>
    </div>
  );
}
