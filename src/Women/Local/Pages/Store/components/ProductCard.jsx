// src/Women/Local/Pages/Store/components/ProductCard.jsx
export default function ProductCard({ product, onAddToCart }) {
  return (
    <div className="border rounded-lg p-4 shadow hover:shadow-lg transition">
      <img
        src={product.image}
        alt={product.title}
        className="w-full h-64 object-contain mb-4"
      />
      <h2 className="text-xl font-semibold">{product.title}</h2>
      <p className="text-lg text-gray-700 mb-3">${product.price}</p>
      <button
        onClick={() => onAddToCart(product)}
        className="bg-[#5E0009] text-white px-4 py-2 rounded hover:bg-red-800"
      >
        Add to Cart
      </button>
    </div>
  );
}