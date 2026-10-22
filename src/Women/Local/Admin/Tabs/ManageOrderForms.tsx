import { useEffect, useReducer, useState } from "react";
import toast from "react-hot-toast";

import { useConfirm } from "../../../../Global/Common/components/ConfirmModal";
import { uploadCompressedImage } from "../../../../Global/Common/hooks/uploadHelper";
import { apiRequest } from "../../../../Services/API";

const blankFormDraft = { title: "", description: "", notifyPlayers: false };
const blankItemDraft = { name: "", description: "", price: "", options: "", firstYearComp: false };

const initialState = {
  forms: [],
  loading: true,
  expandedFormId: null,
  submissionsByForm: {},
  notSubmittedByForm: {},
  formDraft: blankFormDraft,
  itemDraft: blankItemDraft,
  savingForm: false,
  savingItem: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FORMS":
      return { ...state, forms: action.forms, loading: false };
    case "SET_FORM_DRAFT_FIELD":
      return { ...state, formDraft: { ...state.formDraft, [action.field]: action.value } };
    case "RESET_FORM_DRAFT":
      return { ...state, formDraft: blankFormDraft };
    case "SET_ITEM_DRAFT_FIELD":
      return { ...state, itemDraft: { ...state.itemDraft, [action.field]: action.value } };
    case "RESET_ITEM_DRAFT":
      return { ...state, itemDraft: blankItemDraft };
    case "SET_SAVING_FORM":
      return { ...state, savingForm: action.payload };
    case "SET_SAVING_ITEM":
      return { ...state, savingItem: action.payload };
    case "TOGGLE_EXPANDED":
      return { ...state, expandedFormId: state.expandedFormId === action.id ? null : action.id };
    case "SET_SUBMISSIONS":
      return { ...state, submissionsByForm: { ...state.submissionsByForm, [action.formId]: action.submissions } };
    case "REPLACE_SUBMISSION":
      return {
        ...state,
        submissionsByForm: {
          ...state.submissionsByForm,
          [action.formId]: (state.submissionsByForm[action.formId] || []).map((s) =>
            s.id === action.submission.id ? action.submission : s
          ),
        },
      };
    case "SET_NOT_SUBMITTED":
      return { ...state, notSubmittedByForm: { ...state.notSubmittedByForm, [action.formId]: action.players } };
    default:
      return state;
  }
}

export default function ManageOrderForms() {
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<{ itemId: string; text: string } | null>(null);

  const load = () => {
    apiRequest("/api/order-forms")
      .then((forms) => dispatch({ type: "SET_FORMS", forms }))
      .catch(() => dispatch({ type: "SET_FORMS", forms: [] }));
  };

  useEffect(() => { load(); }, []);

  const handleCreateForm = async (e) => {
    e.preventDefault();
    if (!state.formDraft.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    dispatch({ type: "SET_SAVING_FORM", payload: true });
    try {
      await apiRequest("/api/order-forms", { method: "POST", json: state.formDraft });
      dispatch({ type: "RESET_FORM_DRAFT" });
      load();
      toast.success(state.formDraft.notifyPlayers ? "Form created and players notified!" : "Form created.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create form.");
    } finally {
      dispatch({ type: "SET_SAVING_FORM", payload: false });
    }
  };

  const handleToggleActive = async (form) => {
    try {
      await apiRequest(`/api/order-forms/${form.id}`, { method: "PUT", json: { active: !form.active } });
      load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update.");
    }
  };

  // Waiving a line (gear included in a player's first year, a comped item) takes its price
  // off that player's balance; un-waiving charges it again.
  const handleToggleWaived = async (formId, submission, index, waived) => {
    try {
      const updated = await apiRequest(
        `/api/order-forms/submissions/${submission.id}/lines/${index}/waived?value=${waived}`,
        { method: "PUT" }
      );
      dispatch({ type: "REPLACE_SUBMISSION", formId, submission: updated });
      toast.success(waived ? "Waived, taken off their balance." : "Waiver removed, charged again.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update.");
    }
  };

  // Players open order forms in their Portal (orders go on their dues balance), so the link
  // points there and the Portal scrolls to this form.
  const handleCopyLink = async (formId) => {
    const portalPath = window.location.pathname.toLowerCase().startsWith("/women") ? "/women/portal" : "/portal";
    const link = `${window.location.origin}${portalPath}?form=${formId}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied.");
    } catch {
      window.prompt("Copy this link:", link);
    }
  };

  const handleRemind = async (formId) => {
    try {
      const { remindedCount } = await apiRequest<{ remindedCount: number }>(`/api/order-forms/${formId}/remind`, { method: "POST" });
      toast.success(`Reminded ${remindedCount} player${remindedCount === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to send reminders.");
    }
  };

  const handleDeleteForm = async (id) => {
    if (!(await confirm("Delete this form and all its items? Past submissions stay on record."))) return;
    try {
      await apiRequest(`/api/order-forms/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete.");
    }
  };

  const handleAddItem = async (e, formId) => {
    e.preventDefault();
    const price = state.itemDraft.price ? parseFloat(state.itemDraft.price) : null;
    if (!state.itemDraft.name.trim()) {
      toast.error("Item name is required.");
      return;
    }
    dispatch({ type: "SET_SAVING_ITEM", payload: true });
    try {
      let imageUrl = "";
      if (state.itemDraft.imageFile) {
        imageUrl = await uploadCompressedImage(state.itemDraft.imageFile, "order-forms", setUploadProgress);
      }
      const options = state.itemDraft.options
        ? state.itemDraft.options.split(",").map((o) => o.trim()).filter(Boolean)
        : [];
      await apiRequest(`/api/order-forms/${formId}/items`, {
        method: "POST",
        json: {
          name: state.itemDraft.name.trim(),
          description: state.itemDraft.description.trim() || undefined,
          firstYearComp: state.itemDraft.firstYearComp,
          price,
          image: imageUrl || undefined,
          options,
        },
      });
      dispatch({ type: "RESET_ITEM_DRAFT" });
      load();
      toast.success("Item added.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add item.");
    } finally {
      dispatch({ type: "SET_SAVING_ITEM", payload: false });
      setUploadProgress(null);
    }
  };

  const handleSaveNote = async () => {
    if (!editingNote) return;
    try {
      await apiRequest(`/api/order-forms/items/${editingNote.itemId}`, {
        method: "PUT",
        json: { description: editingNote.text },
      });
      setEditingNote(null);
      load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save note.");
    }
  };

  const handleToggleFirstYearComp = async (item) => {
    try {
      await apiRequest(`/api/order-forms/items/${item.id}`, {
        method: "PUT",
        json: { firstYearComp: !item.firstYearComp },
      });
      load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update.");
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!(await confirm("Remove this item?"))) return;
    try {
      await apiRequest(`/api/order-forms/items/${itemId}`, { method: "DELETE" });
      load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove.");
    }
  };

  const loadSubmissions = (formId) => {
    apiRequest(`/api/order-forms/${formId}/submissions`)
      .then((submissions) => dispatch({ type: "SET_SUBMISSIONS", formId, submissions }))
      .catch(() => dispatch({ type: "SET_SUBMISSIONS", formId, submissions: [] }));
    apiRequest(`/api/order-forms/${formId}/not-submitted`)
      .then((players) => dispatch({ type: "SET_NOT_SUBMITTED", formId, players }))
      .catch(() => dispatch({ type: "SET_NOT_SUBMITTED", formId, players: [] }));
  };

  const input =
    "w-full bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition";
  const pill = "inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold transition";
  const pillSecondary = `${pill} bg-white border border-gray-200 text-gray-700 hover:border-[#5E0009]/40 hover:text-[#5E0009]`;
  const sectionLabel = (text) => (
    <div className="inline-flex items-center gap-3 text-[#5E0009] text-[11px] font-semibold uppercase tracking-[0.2em] mb-3">
      <span className="h-px w-5 bg-[#5E0009]/40" />
      {text}
      <span className="h-px w-5 bg-[#5E0009]/40" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn space-y-8">
      <div>
        <div className="inline-flex items-center gap-3 text-[#5E0009] text-xs font-semibold uppercase tracking-[0.2em] mb-2">
          <span className="h-px w-6 bg-[#5E0009]/40" />
          Team Gear
          <span className="h-px w-6 bg-[#5E0009]/40" />
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold uppercase text-gray-900">Order Forms</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-2xl">
          Build order forms (gear, apparel, etc) players pick from in their portal. Submitting
          posts the total straight to their dues balance.
        </p>
      </div>

      <form onSubmit={handleCreateForm} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] px-5 py-4 flex items-center gap-3">
          <img src="/missouri-state-white.png" alt="" className="h-10 w-10 object-contain" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">New</p>
            <h3 className="text-lg font-extrabold uppercase text-white leading-tight">Create a Form</h3>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <input
            type="text"
            placeholder="Title (e.g. Spring Gear Order)"
            value={state.formDraft.title}
            onChange={(e) => dispatch({ type: "SET_FORM_DRAFT_FIELD", field: "title", value: e.target.value })}
            className={input}
          />
          <textarea
            placeholder="Description (optional)"
            value={state.formDraft.description}
            onChange={(e) => dispatch({ type: "SET_FORM_DRAFT_FIELD", field: "description", value: e.target.value })}
            className={input}
            rows={2}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.formDraft.notifyPlayers}
                onChange={(e) => dispatch({ type: "SET_FORM_DRAFT_FIELD", field: "notifyPlayers", value: e.target.checked })}
                className="w-4 h-4 accent-[#5E0009]"
              />
              <span className="text-sm text-gray-700">Email current-season players about this form</span>
            </label>
            <button
              type="submit"
              disabled={state.savingForm}
              className="inline-flex items-center justify-center bg-[#5E0009] text-white rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-[#7a0012] transition shadow-sm disabled:opacity-60"
            >
              {state.savingForm ? "Creating..." : "Create Form"}
            </button>
          </div>
        </div>
      </form>

      {!state.loading && state.forms.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No order forms yet. Create one above.</p>
      )}

      <div className="space-y-5">
        {state.forms.map((form) => {
          const expanded = state.expandedFormId === form.id;
          const submitted = state.submissionsByForm[form.id] || [];
          const notSubmitted = state.notSubmittedByForm[form.id] || [];
          return (
            <div key={form.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-extrabold uppercase text-gray-900 leading-tight break-words">{form.title}</h3>
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${
                        form.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {form.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {form.description && <p className="text-sm text-gray-500 mt-1">{form.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {form.items.length} item{form.items.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end md:shrink-0">
                  <button
                    onClick={() => {
                      dispatch({ type: "TOGGLE_EXPANDED", id: form.id });
                      if (state.expandedFormId !== form.id) loadSubmissions(form.id);
                    }}
                    className={`${pill} ${expanded ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-[#5E0009] text-white hover:bg-[#7a0012]"}`}
                  >
                    {expanded ? "Close" : "Manage"}
                  </button>
                  <button onClick={() => handleCopyLink(form.id)} className={pillSecondary}>Copy Link</button>
                  <button onClick={() => handleRemind(form.id)} className={pillSecondary}>Remind</button>
                  <button onClick={() => handleToggleActive(form)} className={pillSecondary}>
                    {form.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDeleteForm(form.id)}
                    className={`${pill} text-red-600 hover:bg-red-50`}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="border-t border-gray-100 bg-gray-50/70 p-5 space-y-8">
                  <div>
                    {sectionLabel("Items")}
                    {form.items.length === 0 ? (
                      <p className="text-sm text-gray-400">No items yet. Add one below.</p>
                    ) : (
                      <ul className="space-y-2">
                        {form.items.map((item) => (
                          <li key={item.id} className="bg-white rounded-xl border border-gray-100 p-3 flex gap-3">
                            <div className="h-14 w-14 shrink-0 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center">
                              {item.image ? (
                                <img src={item.image} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <img src="/missouri-state.png" alt="" className="h-9 w-9 object-contain opacity-30" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="font-bold text-gray-900">{item.name}</p>
                                {item.price != null && (
                                  <p className="font-semibold text-gray-900 tabular-nums">${Number(item.price).toFixed(2)}</p>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {item.firstYearComp && (
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                                    First Year Comp
                                  </span>
                                )}
                                {(item.options || []).map((opt) => (
                                  <span key={opt} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    {opt}
                                  </span>
                                ))}
                              </div>
                              {editingNote?.itemId === item.id ? (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editingNote?.text ?? ""}
                                    placeholder="First-year players get this free"
                                    onChange={(e) => setEditingNote({ itemId: item.id, text: e.target.value })}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveNote(); }}
                                    className={`${input} flex-1 min-w-[12rem] py-1.5 text-xs`}
                                  />
                                  <button onClick={handleSaveNote} className="text-xs font-semibold text-[#5E0009] hover:underline">Save</button>
                                  <button onClick={() => setEditingNote(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                                </div>
                              ) : (
                                item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                <button
                                  onClick={() => handleToggleFirstYearComp(item)}
                                  title="First-year players get one of this item free"
                                  className="text-gray-500 hover:text-[#5E0009]"
                                >
                                  {item.firstYearComp ? "Turn off First Year Comp" : "Make First Year Comp"}
                                </button>
                                {editingNote?.itemId !== item.id && (
                                  <button
                                    onClick={() => setEditingNote({ itemId: item.id, text: item.description || "" })}
                                    className="text-gray-500 hover:text-[#5E0009]"
                                  >
                                    {item.description ? "Edit note" : "Add note"}
                                  </button>
                                )}
                                <button onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:text-red-700">
                                  Remove
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <form onSubmit={(e) => handleAddItem(e, form.id)} className="bg-white rounded-xl border border-gray-100 p-4">
                    {sectionLabel("Add an Item")}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="block text-xs font-semibold text-gray-500 mb-1">Item name</span>
                        <input
                          type="text"
                          placeholder="Custom gloves"
                          value={state.itemDraft.name}
                          onChange={(e) => dispatch({ type: "SET_ITEM_DRAFT_FIELD", field: "name", value: e.target.value })}
                          className={input}
                        />
                      </label>
                      <label className="block">
                        <span className="block text-xs font-semibold text-gray-500 mb-1">Price ($, optional)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="135.00"
                          value={state.itemDraft.price}
                          onChange={(e) => dispatch({ type: "SET_ITEM_DRAFT_FIELD", field: "price", value: e.target.value })}
                          className={input}
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="block text-xs font-semibold text-gray-500 mb-1">Description (optional)</span>
                        <input
                          type="text"
                          placeholder="First-year players get this free"
                          value={state.itemDraft.description}
                          onChange={(e) => dispatch({ type: "SET_ITEM_DRAFT_FIELD", field: "description", value: e.target.value })}
                          className={input}
                        />
                      </label>
                      <label className="block">
                        <span className="block text-xs font-semibold text-gray-500 mb-1">Sizes or options (comma-separated)</span>
                        <input
                          type="text"
                          placeholder="S, M, L, XL"
                          value={state.itemDraft.options}
                          onChange={(e) => dispatch({ type: "SET_ITEM_DRAFT_FIELD", field: "options", value: e.target.value })}
                          className={input}
                        />
                      </label>
                      <label className="block">
                        <span className="block text-xs font-semibold text-gray-500 mb-1">Image (optional)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => dispatch({ type: "SET_ITEM_DRAFT_FIELD", field: "imageFile", value: e.target.files?.[0] || null })}
                          className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-full file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 cursor-pointer" title="First-year players get one of this item free">
                        <input
                          type="checkbox"
                          checked={state.itemDraft.firstYearComp}
                          onChange={(e) => dispatch({ type: "SET_ITEM_DRAFT_FIELD", field: "firstYearComp", value: e.target.checked })}
                          className="w-4 h-4 accent-[#5E0009]"
                        />
                        <span className="text-sm text-gray-700">First Year Comp (first-year players get one free)</span>
                      </label>
                      <button
                        type="submit"
                        disabled={state.savingItem}
                        className="inline-flex items-center justify-center bg-[#5E0009] text-white rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-[#7a0012] transition shadow-sm disabled:opacity-60"
                      >
                        {state.savingItem ? (uploadProgress ? `${uploadProgress}%` : "Adding...") : "Add Item"}
                      </button>
                    </div>
                  </form>

                  <div>
                    {sectionLabel("Submissions")}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-bold text-gray-800 mb-2">Submitted ({submitted.length})</p>
                        {submitted.length === 0 ? (
                          <p className="text-xs text-gray-400">No submissions yet.</p>
                        ) : (
                          <ul className="space-y-2">
                            {submitted.map((s) => (
                              <li key={s.id} className="bg-white rounded-xl border border-gray-100 p-3">
                                <div className="flex justify-between gap-2">
                                  <span className="font-bold text-gray-900 text-sm">{s.playerName}</span>
                                  <span className="text-sm font-semibold text-gray-900 tabular-nums">
                                    ${Number(s.owed ?? s.total).toFixed(2)}
                                  </span>
                                </div>
                                {Number(s.waivedTotal) > 0 && (
                                  <p className="text-[11px] text-green-700">${Number(s.waivedTotal).toFixed(2)} waived</p>
                                )}
                                <ul className="mt-2 space-y-1.5 text-xs text-gray-600">
                                  {(s.selections || []).map((line, i) => (
                                    <li key={i} className="flex items-center justify-between gap-2">
                                      <span className="min-w-0">
                                        <span className={line.waived ? "line-through text-gray-400" : ""}>
                                          {line.quantity} x {line.name}
                                          {line.option ? ` (${line.option})` : ""}
                                          {Number(line.lineTotal) > 0 && ` - $${Number(line.lineTotal).toFixed(2)}`}
                                        </span>
                                        {line.waived && line.waivedReason && (
                                          <span className="ml-1 font-semibold text-green-700">{line.waivedReason}</span>
                                        )}
                                      </span>
                                      {Number(line.lineTotal) > 0 && (
                                        <button
                                          onClick={() => handleToggleWaived(form.id, s, i, !line.waived)}
                                          className={`${pill} shrink-0 py-1 ${
                                            line.waived
                                              ? "bg-green-50 text-green-700 hover:bg-green-100"
                                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                          }`}
                                        >
                                          {line.waived ? "Waived, undo" : "Waive"}
                                        </button>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                                <p className="mt-2 text-[11px] text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800 mb-2">Not submitted yet ({notSubmitted.length})</p>
                        {notSubmitted.length === 0 ? (
                          <p className="text-xs text-gray-400">Everyone on this season's roster has submitted.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {notSubmitted.map((p) => (
                              <span
                                key={p.playerId}
                                title={p.hasEmail ? undefined : "No email on file, Remind can't reach them"}
                                className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                                  p.hasEmail ? "bg-white border-gray-200 text-gray-700" : "bg-amber-50 border-amber-200 text-amber-800"
                                }`}
                              >
                                {p.name}
                                {!p.hasEmail && " (no email)"}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
