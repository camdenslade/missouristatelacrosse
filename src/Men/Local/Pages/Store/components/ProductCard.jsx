// src/Men/Local/Pages/Store/components/ProductCard.jsx
import { useState } from "react";

export default function ProductCard({ product, onAddToCart }) {
  const [selectedVariant, setSelectedVariant] = useState(product.variants?.[0] || null);

  const handleAdd = () => {
    if (!selectedVariant) return alert("Please select a size.");
    onAddToCart({
      id: product.id,
      title: product.title,
      variantId: selectedVariant.id,
      size: selectedVariant.options?.[0] || "",
      price: selectedVariant.price / 100,
      image: product.images?.[0]?.src || "",
    });
  };

  return (
    <div className="border p-4 shadow hover:shadow-lg transition">
      <img
        src={product.images?.[0]?.src}
        alt={product.title}
        className="w-full h-64 object-contain mb-4"
      />
      <h2 className="text-xl font-semibold mb-2">{product.title}</h2>
      {product.variants?.length > 1 && (
        <select
          value={selectedVariant?.id || ""}
          onChange={(e) =>
            setSelectedVariant(
              product.variants.find((v) => v.id.toString() === e.target.value)
            )
          }
          className="border w-full p-2 mb-3"
        >
          <option value="">Select Size</option>
          {product.variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.options?.[0]}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={handleAdd}
        className="bg-[#5E0009] text-white w-full py-2 font-semibold hover:bg-red-800 transition"
      >
        Add to Cart
      </button>
    </div>
  );
}
