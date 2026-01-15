// src/Women/Local/Pages/Store/Checkout/CheckoutSummary.jsx
export default function CheckoutSummary({ cart }) {
  if (!cart || cart.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded border text-gray-600">
        Your cart is empty.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {cart.map((item) => {
        const size =
          item.size ||
          item.options?.[1] ||
          item.variantOptions?.size ||
          "N/A";

        return (
          <div
            key={`${item.id}-${item.variantId}`}
            className="flex gap-4 items-center bg-gray-50 p-3 rounded border"
          >
            <img
              src={item.image}
              alt={item.title}
              className="w-20 h-20 object-contain rounded border"
            />

            <div className="flex flex-col flex-1">
              <span className="font-semibold text-lg">{item.title}</span>

              <div className="text-sm text-gray-700">
                {size !== "N/A" && (
                  <p>
                    <span className="font-medium">Size:</span> {size}
                  </p>
                )}

                <p>
                  <span className="font-medium">Quantity:</span>{" "}
                  {item.quantity || 1}
                </p>
              </div>
            </div>

            <div className="font-semibold text-[#5E0009] text-lg">
              ${item.price}
            </div>
          </div>
        );
      })}
    </div>
  );
}
