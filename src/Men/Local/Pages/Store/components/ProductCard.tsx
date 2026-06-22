import { useState, useMemo } from "react";
import toast from "react-hot-toast";

export default function ProductCard({ product, onAddToCart, isAdmin = false }) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const options = Array.isArray(product.options) ? product.options : [];

  // Build selectable options from whatever Printify gives us (color, size, style, etc.)
  const selectableOptions = useMemo(() => {
    return options
      .filter(opt => opt.values && opt.values.length > 1)
      .map(opt => ({
        name: opt.name || opt.type || "Option",
        type: opt.type,
        values: opt.values,
      }));
  }, [options]);

  // State: one selection per option
  const [selections, setSelections] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const opt of options) {
      if (opt.values?.length) {
        init[opt.type || opt.name] = opt.values[0].id;
      }
    }
    return init;
  });

  // Resolve variant by matching all selected option IDs
  const selectedVariant = useMemo(() => {
    if (variants.length === 1) return variants[0];
    if (variants.length === 0) return null;

    const selectedIds = Object.values(selections);
    if (selectedIds.length === 0) return variants[0];

    return variants.find(v => {
      const vOpts = v.options || [];
      return selectedIds.every(id => vOpts.includes(id));
    }) || null;
  }, [variants, selections]);

  // Filter each option's values to only those that have at least one variant
  const getAvailableValues = (optKey: string, optValues: any[]) => {
    const otherSelections = Object.entries(selections)
      .filter(([key]) => key !== optKey)
      .map(([, id]) => id);

    if (otherSelections.length === 0) return optValues;

    return optValues.filter(val =>
      variants.some(v => {
        const vOpts = v.options || [];
        return vOpts.includes(val.id) && otherSelections.every(id => vOpts.includes(id));
      })
    );
  };

  const price = selectedVariant ? selectedVariant.our_price / 100 : null;
  const imageSrc = (product.images || []).find((img) => img?.src)?.src || "";

  const handleSelect = (optKey: string, valueId: number) => {
    setSelections(prev => ({ ...prev, [optKey]: valueId }));
  };

  const isOutOfStock = selectedVariant && (selectedVariant as any)._stock === 0;

  const onAdd = () => {
    if (!selectedVariant) {
      toast.error("Please select valid options.");
      return;
    }
    if (isOutOfStock) {
      toast.error("This option is out of stock.");
      return;
    }

    // Build labels for selected options
    const optionLabels: Record<string, string> = {};
    for (const opt of options) {
      const key = opt.type || opt.name;
      const selectedId = selections[key];
      const val = opt.values?.find(v => v.id === selectedId);
      if (val) optionLabels[key] = val.title;
    }

    const sv = selectedVariant as any;
    onAddToCart({
      id: product.id,
      title: product.title,
      variantId: selectedVariant.id,
      price: selectedVariant.our_price / 100,
      quantity: 1,
      color: optionLabels["color"] || "",
      size: optionLabels["size"] || "One size",
      image: imageSrc,
      sku: selectedVariant.sku,
      isCustom: !!(product as any).isCustom,
      variantLabel: sv._customVariantLabel || optionLabels["size"] || "",
      _customVariantId: sv._customVariantId,
    });
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
          {price !== null ? `$${price.toFixed(2)}` : "Select options"}
        </p>

        {/* Non-size options (color, finish, etc.) */}
        {selectableOptions.filter(opt => (opt.type || opt.name) !== "size").map(opt => {
          const key = opt.type || opt.name;
          const available = getAvailableValues(key, opt.values);
          return (
            <div key={key} className="mb-3">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                {opt.name}
              </label>
              <select
                value={selections[key] ?? ""}
                onChange={e => handleSelect(key, Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5E0009] focus:border-transparent transition"
              >
                {available.map(v => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
            </div>
          );
        })}

        {/* Size + Add to Cart pinned to bottom */}
        <div className="mt-auto pt-3">
          {selectableOptions.filter(opt => (opt.type || opt.name) === "size").map(opt => {
            const key = opt.type || opt.name;
            const available = getAvailableValues(key, opt.values);
            return (
              <div key={key} className="mb-3">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  {opt.name}
                </label>
                <select
                  value={selections[key] ?? ""}
                  onChange={e => handleSelect(key, Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5E0009] focus:border-transparent transition"
                >
                  {available.map(v => (
                    <option key={v.id} value={v.id}>{v.title}</option>
                  ))}
                </select>
              </div>
            );
          })}
          <button
            onClick={onAdd}
            disabled={!selectedVariant || !!isOutOfStock}
            className="w-full bg-[#5E0009] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-red-800 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isOutOfStock ? "Out of Stock" : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
