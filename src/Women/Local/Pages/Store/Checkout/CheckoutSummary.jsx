// src/Women/Local/Pages/Store/Checkout/CheckoutSummary.jsx
export default function CheckoutSummary({ cart = [] }){
  if (!Array.isArray(cart) || cart.length === 0){
    return <p>Your cart is empty.</p>;
  }

  const total = cart.reduce(
    (sum, item) => sum + (parseFloat(item.price) || 0) * (item.quantity || 1),
    0
  );

  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2">Order Summary</h2>
      <ul className="space-y-2">
        {cart.map((item, idx) => (
          <li
            key={`${item.id}-${idx}`}
            className="flex justify-between border-b pb-1 text-gray-800"
          >
            <span>
              {item.title || "Product"} × {item.quantity || 1}
            </span>
            <span>${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <div className="font-bold mt-3 text-right text-gray-900">
        Total: ${total.toFixed(2)}
      </div>
    </div>
  );
}
