// src/Women/Local/Pages/Store/components/ProductCard.jsx
import { useState } from "react";

export default function ProductCard({ product, onAddToCart }) {
  const sizeOrder = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

  const sizes = Array.from(
    new Set(
      (product.variants || [])
        .map((v) => v.options?.[1])
        .filter((opt) => opt && opt.trim() !== "")
    )
  ).sort((a, b) => {
    const i1 = sizeOrder.indexOf(a.toUpperCase());
    const i2 = sizeOrder.indexOf(b.toUpperCase());
    if (i1 === -1 && i2 === -1) return a.localeCompare(b);
    if (i1 === -1) return 1;
    if (i2 === -1) return -1;
    return i1 - i2;
  });

  const [selectedSize, setSelectedSize] = useState("");
  const selectedVariant =
    product.variants?.find((v) => v.options?.[1] === selectedSize) || null;

  const handleAdd = () => {
    if (!selectedSize) return alert("Please select a size.");
    if (!selectedVariant) return alert("Invalid selection.");

    onAddToCart({
      id: product.id,
      title: product.title,
      variantId: selectedVariant.id,
      size: selectedSize,
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
      {sizes.length > 0 && (
        <select
          value={selectedSize}
          onChange={(e) => setSelectedSize(e.target.value)}
          className="border w-full p-2 mb-3"
        >
          <option value="">Select Size</option>
          {sizes.map((size) => (
            <option key={size} value={size}>
              {size}
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

