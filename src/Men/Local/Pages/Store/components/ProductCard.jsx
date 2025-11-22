import { useState } from "react";

function resolveVariant(product, colorTitle, sizeTitle) {
  const colorOpt = product.options.find(o => o.type === "color");
  const sizeOpt  = product.options.find(o => o.type === "size");

  const colorVal = colorOpt?.values.find(v => v.title === colorTitle);
  const sizeVal  = sizeOpt?.values.find(v => v.title === sizeTitle);

  if (!colorVal || !sizeVal) return null;

  const match = product.variants.find(
    v => v.options.includes(colorVal.id) && v.options.includes(sizeVal.id)
  );

  return match || null;
}

export default function ProductCard({ product, onAddToCart }) {
  const colorOpt = product.options.find(o => o.type === "color");
  const sizeOpt  = product.options.find(o => o.type === "size");

  const colors = colorOpt ? colorOpt.values.map(v => v.title) : [];
  const sizes  = sizeOpt ? sizeOpt.values.map(v => v.title) : [];

  const [selectedColor, setSelectedColor] = useState(colors[0] || "");
  const [selectedSize,  setSelectedSize]  = useState(sizes[0]  || "");

  const variant = resolveVariant(product, selectedColor, selectedSize);

  const price = variant ? variant.our_price / 100 : 0;

  const onAdd = () => {
    if (!variant) {
      alert("Please select valid options.");
      return;
    }

    onAddToCart({
      id: product.id,
      title: product.title,
      variantId: variant.id,
      price: variant.our_price / 100,
      quantity: 1,
      color: selectedColor,
      size: selectedSize,
      image: product.images?.[0]?.src || ""
    });
  };

  return (
    <div className="border p-4 shadow hover:shadow-lg transition">
      <img
        src={product.images?.[0]?.src}
        alt={product.title}
        className="w-full h-64 object-contain mb-4"
      />

      <h2 className="text-xl font-semibold mb-1">{product.title}</h2>

      <p className="font-bold mb-3">${price.toFixed(2)}</p>

      {/* COLOR */}
      {colors.length > 1 && (
        <div className="mb-3">
          <label className="block text-sm">Color:</label>
          <select
            value={selectedColor}
            onChange={e => setSelectedColor(e.target.value)}
            className="border w-full p-2"
          >
            {colors.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}

      {/* SIZE */}
      {sizes.length > 1 && (
        <div className="mb-3">
          <label className="block text-sm">Size:</label>
          <select
            value={selectedSize}
            onChange={e => setSelectedSize(e.target.value)}
            className="border w-full p-2"
          >
            {sizes.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      <button
        onClick={onAdd}
        className="bg-[#5E0009] text-white w-full py-2 font-semibold hover:bg-red-800 transition"
      >
        Add to Cart
      </button>
    </div>
  );
}
