// src/Women/Local/Pages/Store/components/ProductCard.jsx
import { useState } from "react";
import toast from "react-hot-toast";

type ProductVariant = {
  id: string;
  price: number;
  our_price: number;
  options?: string[];
  sku?: string;
};

type ProductImage = {
  src: string;
};

type Product = {
  id: string;
  title: string;
  variants: ProductVariant[];
  images?: ProductImage[];
};

type CartItem = {
  id: string;
  title: string;
  variantId: string;
  size: string;
  price: number;
  image: string;
  sku?: string;
};

export default function ProductCard({
  product,
  onAddToCart,
  isAdmin = false,
}: {
  product: Product;
  onAddToCart: (item: CartItem) => void;
  isAdmin?: boolean;
}) {
  const sizeOrder = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
  const variants = Array.isArray(product.variants) ? product.variants : [];

  // Detect if this is a one-size accessory (hat, beanie, etc.)
  const allOneSize =
    variants.length > 0 &&
    variants.every((v) =>
      (v.options || []).map((o) => o?.toUpperCase()).includes("ONE SIZE")
    );

  const [selectedSize, setSelectedSize] = useState("");

  let sizes: string[] = [];
  let sizeIndex = -1;

  if (!allOneSize) {
    const detectSizeIndex = () => {
      const count0 = variants.filter((v) =>
        sizeOrder.includes(v.options?.[0]?.toUpperCase() || "")
      ).length;

      const count1 = variants.filter((v) =>
        sizeOrder.includes(v.options?.[1]?.toUpperCase() || "")
      ).length;

      if (count0 > count1) return 0;
      if (count1 > count0) return 1;
      return -1;
    };

    sizeIndex = detectSizeIndex();

    if (sizeIndex !== -1) {
      sizes = Array.from(
        new Set(
          variants
            .map((v) => v.options?.[sizeIndex])
            .filter((s): s is string => Boolean(s && s.trim() !== ""))
        )
      ).sort((a, b) => {
        const i1 = sizeOrder.indexOf(a.toUpperCase());
        const i2 = sizeOrder.indexOf(b.toUpperCase());
        if (i1 === -1 && i2 === -1) return a.localeCompare(b);
        if (i1 === -1) return 1;
        if (i2 === -1) return -1;
        return i1 - i2;
      });
    }
  }


  // Custom products use numeric option IDs; handle them separately
  const isCustomProduct = !!(product as any).isCustom;
  const [selectedCustomVariantId, setSelectedCustomVariantId] = useState<string>(() =>
    isCustomProduct && variants.length > 0 ? String(variants[0].id) : ""
  );

  const selectedVariant = isCustomProduct
    ? variants.find(v => String(v.id) === selectedCustomVariantId) || variants[0] || null
    : allOneSize
    ? variants[0] || null
    : sizes.length > 0
    ? variants.find((v) => v.options?.[sizeIndex] === selectedSize) || null
    : null;

  const basePrice = selectedVariant
    ? selectedVariant.our_price / 100
    : variants.length
    ? Math.min(...variants.map((v) => v.our_price)) / 100
    : 0;
  const imageSrc = (product.images || []).find((img) => img?.src)?.src || "";

  const isOutOfStock = selectedVariant && (selectedVariant as any)._stock === 0;

  const handleAdd = () => {
    if (!selectedVariant) {
      toast.error("No available variant for this product.");
      return;
    }

    if (!allOneSize && !selectedSize) {
      toast.error("Please select a size.");
      return;
    }

    if (isOutOfStock) {
      toast.error("This option is out of stock.");
      return;
    }

    const sv = selectedVariant as any;
    onAddToCart({
      id: product.id,
      title: product.title,
      variantId: selectedVariant.id,
      size: allOneSize ? "One size" : selectedSize,
      price: selectedVariant.our_price / 100,
      image: imageSrc,
      sku: selectedVariant.sku,
      isCustom: !!(product as any).isCustom,
      variantLabel: sv._customVariantLabel || selectedSize || "",
      _customVariantId: sv._customVariantId,
    } as any);
  };

  return (
    <div className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-200 flex flex-col h-full">
      {/* Product image */}
      <div className="bg-gray-50 p-6 relative">
        <img
          src={imageSrc}
          alt={product.title}
          className="w-full h-56 object-contain group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Product details */}
      <div className="p-5 flex flex-col flex-1">
        <h2 className="font-semibold text-gray-900 leading-snug mb-2 line-clamp-2">
          {product.title}
        </h2>

        <p className="text-xl font-bold text-[#5E0009] mb-4">
          ${basePrice.toFixed(2)}
        </p>

        <div className="mt-auto pt-3">
          {isCustomProduct && variants.length > 1 && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Option
              </label>
              <select
                value={selectedCustomVariantId}
                onChange={e => setSelectedCustomVariantId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5E0009] focus:border-transparent transition"
              >
                {variants.map(v => (
                  <option key={v.id} value={String(v.id)}>
                    {(v as any)._customVariantLabel || v.id}
                    {(v as any)._stock === 0 ? " – Out of Stock" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!isCustomProduct && !allOneSize && sizes.length > 0 && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Size
              </label>
              <select
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5E0009] focus:border-transparent transition"
              >
                <option value="">Select Size</option>
                {sizes.map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handleAdd}
            disabled={!!isOutOfStock}
            className="w-full bg-[#5E0009] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-red-800 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isOutOfStock ? "Out of Stock" : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
