export default function CheckoutSummary({ cart }) {
  if (!cart || cart.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-xl text-gray-500 text-center">
        Your cart is empty.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {cart.map((item) => {
        const size =
          item.size ||
          item.options?.[1] ||
          item.variantOptions?.size ||
          "N/A";

        return (
          <div
            key={`${item.id}-${item.variantId}`}
            className="flex gap-4 items-center bg-gray-50 rounded-xl p-3"
          >
            <img
              src={item.image}
              alt={item.title}
              className="w-20 h-20 object-contain rounded-lg bg-white shrink-0"
            />

            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-semibold text-gray-900 leading-snug">{item.title}</span>

              <div className="text-sm text-gray-500 mt-0.5">
                {size !== "N/A" && (
                  <p>
                    <span className="font-medium text-gray-600">Size:</span> {size}
                  </p>
                )}

                <p>
                  <span className="font-medium text-gray-600">Quantity:</span>{" "}
                  {item.quantity || 1}
                </p>
              </div>
            </div>

            <div className="font-bold text-[#5E0009] text-lg shrink-0">
              ${item.price}
            </div>
          </div>
        );
      })}
    </div>
  );
}
