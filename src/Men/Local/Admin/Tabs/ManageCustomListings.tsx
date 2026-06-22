// src/Men/Local/Admin/Tabs/ManageCustomListings.tsx
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../../../Services/API";
import { getProgramInfo } from "../../../../Services/programHelper";
import type { ApiCustomProduct, CustomProductVariant } from "../../../../types/api";

type ProductForm = {
  title: string;
  price: string;
  description: string;
  picture: File | null;
  pictureKey: string;
};

type VariantForm = { label: string; price: string; stock: string };

const emptyProduct = (): ProductForm => ({ title: "", price: "", description: "", picture: null, pictureKey: "" });
const emptyVariant = (): VariantForm => ({ label: "", price: "", stock: "0" });

// Small inline components

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">Out of stock</span>;
  if (stock <= 5) return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">{stock} left</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">{stock} in stock</span>;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${active ? "bg-gray-100 text-gray-700" : "bg-gray-100 text-gray-400"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// Main component

export default function ManageCustomListings() {
  const [listings, setListings] = useState<ApiCustomProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // product modal
  const [productModal, setProductModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct());
  const [saving, setSaving] = useState(false);

  // which product's variant section is expanded
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // variant state per expanded product
  const [variantMap, setVariantMap] = useState<Record<number, CustomProductVariant[]>>({});
  const [variantLoading, setVariantLoading] = useState<Record<number, boolean>>({});
  const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
  const [variantForm, setVariantForm] = useState<VariantForm>(emptyVariant());
  const [variantSaving, setVariantSaving] = useState(false);
  const variantLabelRef = useRef<HTMLInputElement>(null);

  const { program } = getProgramInfo();

  useEffect(() => { fetchListings(); }, []);

  // Data fetching

  const fetchListings = async () => {
    setLoading(true);
    const data = await apiRequest<ApiCustomProduct[]>(`/api/admin/custom-products?program=${program}`);
    setListings(data || []);
    setLoading(false);
  };

  const fetchVariants = async (productId: number) => {
    setVariantLoading(prev => ({ ...prev, [productId]: true }));
    const data = await apiRequest<CustomProductVariant[]>(
      `/api/admin/custom-products/${productId}/variants?program=${program}`
    );
    setVariantMap(prev => ({ ...prev, [productId]: data || [] }));
    setVariantLoading(prev => ({ ...prev, [productId]: false }));
  };

  // Product actions

  const openAdd = () => {
    setEditingId(null);
    setProductForm(emptyProduct());
    setProductModal("add");
  };

  const openEdit = (listing: ApiCustomProduct) => {
    setEditingId(listing.id);
    setProductForm({ title: listing.title, price: String(listing.price), description: listing.description || "", picture: null, pictureKey: listing.pictureUrl });
    setProductModal("edit");
  };

  const closeModal = () => { setProductModal(null); setEditingId(null); setProductForm(emptyProduct()); };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let pictureKey = productForm.pictureKey;

      // 1. Handle S3 Upload if a new file is selected
      if (productForm.picture) {
        const presign = await apiRequest<{ uploadUrl: string; key: string }>("/api/uploads/presign", {
          method: "POST",
          body: JSON.stringify({ 
            folder: "custom-products", 
            filename: productForm.picture.name, 
            contentType: productForm.picture.type 
          }),
          headers: { "Content-Type": "application/json" },
        });
        
        await fetch(presign.uploadUrl, { 
          method: "PUT", 
          body: productForm.picture, 
          headers: { "Content-Type": productForm.picture.type } 
        });
        pictureKey = presign.key;
      }

      // 2. Prepare the JSON payload
      const payload = {
        title: productForm.title,
        price: parseFloat(productForm.price) || 0,
        description: productForm.description,
        pictureUrl: pictureKey // Ensure this matches the DTO field name 'pictureUrl'
      };

      // 3. Send as JSON for BOTH Post and Put
      if (productModal === "edit" && editingId) {
        await apiRequest(`/api/admin/custom-products/${editingId}?program=${program}`, {
          method: "PUT",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        });
      } else {
        // FIX: Changed from FormData to JSON
        await apiRequest(`/api/admin/custom-products?program=${program}`, { 
          method: "POST", 
          body: JSON.stringify(payload), 
          headers: { "Content-Type": "application/json" } 
        });
      }

      closeModal();
      fetchListings();
    } catch (error) {
      console.error("Failed to save product:", error);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: number, active: boolean) => {
    await apiRequest(`/api/admin/custom-products/${id}?program=${program}`, {
      method: "PUT",
      body: JSON.stringify({ active: !active }),
      headers: { "Content-Type": "application/json" },
    });
    fetchListings();
  };

  const deleteListing = async (id: number) => {
    if (!confirm("Delete this listing and all its variants?")) return;
    await apiRequest(`/api/admin/custom-products/${id}?program=${program}`, { method: "DELETE" });
    if (expandedId === id) setExpandedId(null);
    fetchListings();
  };

  // Variant expand/collapse

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setEditingVariantId(null);
      setVariantForm(emptyVariant());
      return;
    }
    setExpandedId(id);
    setEditingVariantId(null);
    setVariantForm(emptyVariant());
    if (!variantMap[id]) await fetchVariants(id);
    setTimeout(() => variantLabelRef.current?.focus(), 50);
  };

  // Variant actions

  const startEditVariant = (v: CustomProductVariant) => {
    setEditingVariantId(v.id);
    setVariantForm({ label: v.label, price: String(v.price), stock: String(v.stock) });
    setTimeout(() => variantLabelRef.current?.focus(), 50);
  };

  const cancelVariantEdit = () => { setEditingVariantId(null); setVariantForm(emptyVariant()); };

  const saveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedId) return;
    setVariantSaving(true);
    const payload = {
      label: variantForm.label.trim(),
      price: parseFloat(variantForm.price) || 0,
      stock: parseInt(variantForm.stock, 10) || 0,
    };
    try {
      if (editingVariantId) {
        await apiRequest(`/api/admin/custom-products/${expandedId}/variants/${editingVariantId}?program=${program}`, {
          method: "PUT", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" },
        });
      } else {
        await apiRequest(`/api/admin/custom-products/${expandedId}/variants?program=${program}`, {
          method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" },
        });
      }
      setEditingVariantId(null);
      setVariantForm(emptyVariant());
      await fetchVariants(expandedId);
      fetchListings();
    } finally {
      setVariantSaving(false);
    }
  };

  const deleteVariant = async (productId: number, variantId: number) => {
    if (!confirm("Delete this variant?")) return;
    await apiRequest(`/api/admin/custom-products/${productId}/variants/${variantId}?program=${program}`, { method: "DELETE" });
    setVariantMap(prev => ({ ...prev, [productId]: (prev[productId] || []).filter(v => v.id !== variantId) }));
    fetchListings();
  };

  // Render

  if (loading) return (
    <div className="flex items-center gap-2 text-gray-400 text-sm py-8">
      <div className="w-4 h-4 border-2 border-gray-300 border-t-[#5E0009] rounded-full animate-spin" />
      Loading...
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Custom Listings</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage products and their variants / stock</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0010] text-sm font-semibold transition"
        >
          <span className="text-lg leading-none">+</span> New Listing
        </button>
      </div>

      {/* Empty state */}
      {listings.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400 mb-3">No custom listings yet</p>
          <button onClick={openAdd} className="text-[#5E0009] text-sm font-semibold hover:underline">
            + Add your first listing
          </button>
        </div>
      )}

      {/* Listing cards */}
      <div className="space-y-3">
        {listings.map(listing => {
          const isExpanded = expandedId === listing.id;
          const variants = variantMap[listing.id] || listing.variants || [];
          const totalStock = variants.reduce((s, v) => s + v.stock, 0);

          return (
            <div key={listing.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">

              {/* Product row */}
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Thumbnail */}
                {listing.pictureUrl && (
                  <img
                    src={listing.pictureUrl}
                    alt={listing.title}
                    className="w-12 h-12 rounded-lg object-cover shrink-0 border border-gray-100"
                  />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{listing.title}</span>
                    <StatusBadge active={listing.active} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span>${Number(listing.price).toFixed(2)} base</span>
                    {variants.length > 0 && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span>{variants.length} variant{variants.length !== 1 ? "s" : ""}</span>
                        <span className="text-gray-300">·</span>
                        <StockBadge stock={totalStock} />
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleExpand(listing.id)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition border ${
                      isExpanded
                        ? "bg-[#5E0009] text-white border-[#5E0009]"
                        : "bg-white text-[#5E0009] border-[#5E0009] hover:bg-red-50"
                    }`}
                  >
                    <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                    {isExpanded ? "Close" : `Variants${variants.length > 0 ? ` (${variants.length})` : ""}`}
                  </button>
                  <button onClick={() => openEdit(listing)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 font-medium transition">Edit</button>
                  <button onClick={() => toggleActive(listing.id, listing.active)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 font-medium transition">
                    {listing.active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => deleteListing(listing.id)} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition">Delete</button>
                </div>
              </div>

              {/* Variants panel (expanded) */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Variants</p>

                  {/* Add / Edit form */}
                  <form onSubmit={saveVariant} className="flex flex-wrap gap-3 items-end mb-5 p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="flex-1 min-w-40">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
                      <input
                        ref={variantLabelRef}
                        type="text"
                        placeholder='e.g. "#12 – Large"'
                        value={variantForm.label}
                        onChange={e => setVariantForm(f => ({ ...f, label: e.target.value }))}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Price ($)</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={variantForm.price}
                        onChange={e => setVariantForm(f => ({ ...f, price: e.target.value }))}
                        required
                        min="0"
                        step="0.01"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Stock</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={variantForm.stock}
                        onChange={e => setVariantForm(f => ({ ...f, stock: e.target.value }))}
                        required
                        min="0"
                        step="1"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={variantSaving}
                        className="px-4 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0010] text-sm font-semibold transition disabled:opacity-50"
                      >
                        {variantSaving ? "Saving…" : editingVariantId ? "Update" : "Add Variant"}
                      </button>
                      {editingVariantId && (
                        <button type="button" onClick={cancelVariantEdit} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition">
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>

                  {/* Variant list */}
                  {variantLoading[listing.id] ? (
                    <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                      <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-[#5E0009] rounded-full animate-spin" />
                      Loading variants…
                    </div>
                  ) : variants.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No variants yet — add one above.</p>
                  ) : (
                    <div className="space-y-2">
                      {variants.map(v => (
                        <div
                          key={v.id}
                          className={`flex items-center gap-4 px-4 py-3 rounded-lg border transition ${
                            editingVariantId === v.id ? "border-[#5E0009] bg-red-50/30" : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm text-gray-900">{v.label}</span>
                          </div>
                          <span className="text-sm text-gray-600 w-16 text-right">${Number(v.price).toFixed(2)}</span>
                          <div className="w-28 text-right">
                            <StockBadge stock={v.stock} />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => editingVariantId === v.id ? cancelVariantEdit() : startEditVariant(v)}
                              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                                editingVariantId === v.id
                                  ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                              }`}
                            >
                              {editingVariantId === v.id ? "Cancel" : "Edit"}
                            </button>
                            <button
                              onClick={() => deleteVariant(listing.id, v.id)}
                              className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Product modal */}
      {productModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-900">{productModal === "edit" ? "Edit Listing" : "New Listing"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  placeholder="Product title"
                  value={productForm.title}
                  onChange={e => setProductForm(f => ({ ...f, title: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Price ($)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={productForm.price}
                  onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))}
                  required
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
                />
                <p className="text-xs text-gray-400 mt-1">Fallback price if no variants are set up.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  placeholder="Product description (optional)"
                  value={productForm.description}
                  onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Image{productModal === "edit" && <span className="text-gray-400 font-normal"> (leave blank to keep current)</span>}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setProductForm(f => ({ ...f, picture: e.target.files?.[0] || null }))}
                  required={productModal === "add"}
                  className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0010] text-sm font-semibold transition disabled:opacity-50"
                >
                  {saving ? "Saving…" : productModal === "edit" ? "Save Changes" : "Create Listing"}
                </button>
                <button type="button" onClick={closeModal} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
