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

  const input = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30";

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn space-y-6">
      <h2 className="text-lg font-bold text-gray-900">Order Forms</h2>
      <p className="text-sm text-gray-500 -mt-4">
        Build order forms (gear, apparel, etc) players pick from in their portal. Submitting
        posts the total straight to their dues balance.
      </p>

      <form onSubmit={handleCreateForm} className="bg-gray-50 border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-gray-700">New Form</h3>
        <input
          type="text"
          placeholder="Title (e.g. Spring Gear Order)"
          value={state.formDraft.title}
          onChange={(e) => dispatch({ type: "SET_FORM_DRAFT_FIELD", field: "title", value: e.target.value })}
          className={`${input} bg-white w-full`}
        />
        <textarea
          placeholder="Description (optional)"
          value={state.formDraft.description}
          onChange={(e) => dispatch({ type: "SET_FORM_DRAFT_FIELD", field: "description", value: e.target.value })}
          className={`${input} bg-white w-full`}
          rows={2}
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={state.formDraft.notifyPlayers}
            onChange={(e) => dispatch({ type: "SET_FORM_DRAFT_FIELD", field: "notifyPlayers", value: e.target.checked })}
            className="w-4 h-4 accent-[#5E0009]"
          />
          <span className="text-sm font-medium text-gray-700">Email current-season players about this form</span>
        </label>
        <button
          type="submit"
          disabled={state.savingForm}
          className="px-5 py-2 bg-[#5E0009] text-white rounded-lg text-sm font-medium hover:bg-[#7a0012] transition disabled:opacity-60"
        >
          {state.savingForm ? "Creating..." : "Create Form"}
        </button>
      </form>

      {!state.loading && state.forms.length === 0 && (
        <p className="text-sm text-gray-400">No order forms yet.</p>
      )}

      <div className="space-y-4">
        {state.forms.map((form) => {
          const expanded = state.expandedFormId === form.id;
          return (
            <div key={form.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold text-gray-900">
                    {form.title}{" "}
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${form.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {form.active ? "Active" : "Inactive"}
                    </span>
                  </p>
                  {form.description && <p className="text-xs text-gray-500 mt-1">{form.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">{form.items.length} item{form.items.length === 1 ? "" : "s"}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleToggleActive(form)} className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 font-medium">
                    {form.active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => handleRemind(form.id)} className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium">
                    Remind
                  </button>
                  <button onClick={() => handleCopyLink(form.id)} className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium">
                    Copy Link
                  </button>
                  <button
                    onClick={() => {
                      dispatch({ type: "TOGGLE_EXPANDED", id: form.id });
                      if (state.expandedFormId !== form.id) loadSubmissions(form.id);
                    }}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
                  >
                    {expanded ? "Hide" : "Manage"}
                  </button>
                  <button onClick={() => handleDeleteForm(form.id)} className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium">
                    Delete
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
                  <ul className="divide-y divide-gray-100 bg-white rounded-lg border border-gray-200">
                    {form.items.map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          {item.image && <img src={item.image} alt="" className="h-8 w-8 rounded object-cover" />}
                          <div className="min-w-0 flex-1">
                            <span className="text-sm text-gray-800">
                              {item.name}{item.price != null ? ` - $${Number(item.price).toFixed(2)}` : ""}
                              {item.options?.length > 0 ? ` (${item.options.join(", ")})` : ""}
                            </span>
                            {item.firstYearComp && (
                              <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                                First Year Comp
                              </span>
                            )}
                            {editingNote?.itemId === item.id ? (
                              <div className="mt-1 flex flex-wrap gap-2">
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingNote?.text ?? ""}
                                  placeholder="First-year players get this free"
                                  onChange={(e) => setEditingNote({ itemId: item.id, text: e.target.value })}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveNote(); }}
                                  className={`${input} bg-white flex-1 min-w-[12rem] py-1 text-xs`}
                                />
                                <button onClick={handleSaveNote} className="text-xs text-[#5E0009] font-medium hover:underline">Save</button>
                                <button onClick={() => setEditingNote(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                              </div>
                            ) : (
                              item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-3 shrink-0">
                          <button
                            onClick={() => handleToggleFirstYearComp(item)}
                            title="First-year players get one of this item free"
                            className="text-xs text-gray-500 hover:underline"
                          >
                            {item.firstYearComp ? "Turn off First Year Comp" : "First Year Comp"}
                          </button>
                          {editingNote?.itemId !== item.id && (
                            <button
                              onClick={() => setEditingNote({ itemId: item.id, text: item.description || "" })}
                              className="text-xs text-gray-500 hover:underline"
                            >
                              {item.description ? "Edit note" : "Add note"}
                            </button>
                          )}
                          <button onClick={() => handleDeleteItem(item.id)} className="text-xs text-red-500 hover:underline">
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                    {form.items.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">No items yet.</li>}
                  </ul>

                  <form onSubmit={(e) => handleAddItem(e, form.id)} className="flex flex-wrap gap-2 items-end">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Item name</label>
                      <input
                        type="text"
                        value={state.itemDraft.name}
                        onChange={(e) => dispatch({ type: "SET_ITEM_DRAFT_FIELD", field: "name", value: e.target.value })}
                        className={`${input} bg-white w-32`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
                      <input
                        type="text"
                        placeholder="First-year players get this free"
                        value={state.itemDraft.description}
                        onChange={(e) => dispatch({ type: "SET_ITEM_DRAFT_FIELD", field: "description", value: e.target.value })}
                        className={`${input} bg-white w-56`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Price ($, optional)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={state.itemDraft.price}
                        onChange={(e) => dispatch({ type: "SET_ITEM_DRAFT_FIELD", field: "price", value: e.target.value })}
                        className={`${input} bg-white w-24`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Options (comma-separated)</label>
                      <input
                        type="text"
                        placeholder="S, M, L, XL"
                        value={state.itemDraft.options}
                        onChange={(e) => dispatch({ type: "SET_ITEM_DRAFT_FIELD", field: "options", value: e.target.value })}
                        className={`${input} bg-white w-36`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Image (optional)</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => dispatch({ type: "SET_ITEM_DRAFT_FIELD", field: "imageFile", value: e.target.files?.[0] || null })}
                        className="text-xs"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 pb-2" title="First-year players get one of this item free">
                      <input
                        type="checkbox"
                        checked={state.itemDraft.firstYearComp}
                        onChange={(e) => dispatch({ type: "SET_ITEM_DRAFT_FIELD", field: "firstYearComp", value: e.target.checked })}
                      />
                      First Year Comp
                    </label>
                    <button
                      type="submit"
                      disabled={state.savingItem}
                      className="px-4 py-2 bg-[#5E0009] text-white rounded-lg text-sm font-medium hover:bg-[#7a0012] transition disabled:opacity-60"
                    >
                      {state.savingItem ? (uploadProgress ? `${uploadProgress}%` : "Adding...") : "Add Item"}
                    </button>
                  </form>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2">
                        Submitted ({(state.submissionsByForm[form.id] || []).length})
                      </h4>
                      {(state.submissionsByForm[form.id] || []).length === 0 ? (
                        <p className="text-xs text-gray-400">No submissions yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {(state.submissionsByForm[form.id] || []).map((s) => (
                            <li key={s.id} className="border border-gray-200 rounded-lg px-3 py-2 bg-white">
                              <div className="flex justify-between gap-2 text-sm">
                                <span className="font-medium text-gray-800">{s.playerName}</span>
                                <span className="font-mono text-gray-700">
                                  ${Number(s.owed ?? s.total).toFixed(2)}
                                  {Number(s.waivedTotal) > 0 && (
                                    <span className="ml-1 text-xs text-gray-400">
                                      (${Number(s.waivedTotal).toFixed(2)} waived)
                                    </span>
                                  )}
                                </span>
                              </div>
                              <ul className="mt-1 text-xs text-gray-600 space-y-1">
                                {(s.selections || []).map((line, i) => (
                                  <li key={i} className="flex items-center justify-between gap-2">
                                    <span>
                                      <span className={line.waived ? "line-through text-gray-400" : ""}>
                                        {line.quantity} x {line.name}
                                        {line.option ? ` (${line.option})` : ""}
                                        {Number(line.lineTotal) > 0 && ` - $${Number(line.lineTotal).toFixed(2)}`}
                                      </span>
                                      {line.waived && line.waivedReason && (
                                        <span className="ml-1 text-green-700">{line.waivedReason}</span>
                                      )}
                                    </span>
                                    {Number(line.lineTotal) > 0 && (
                                      <button
                                        onClick={() => handleToggleWaived(form.id, s, i, !line.waived)}
                                        className={`shrink-0 px-2 py-0.5 rounded-md font-medium ${
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
                              <p className="mt-1 text-[11px] text-gray-400">
                                {new Date(s.createdAt).toLocaleDateString()}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2">
                        Not submitted yet ({(state.notSubmittedByForm[form.id] || []).length})
                      </h4>
                      {(state.notSubmittedByForm[form.id] || []).length === 0 ? (
                        <p className="text-xs text-gray-400">Everyone on this season's roster has submitted.</p>
                      ) : (
                        <ul className="text-sm text-gray-700 space-y-1">
                          {(state.notSubmittedByForm[form.id] || []).map((p) => (
                            <li key={p.playerId}>
                              {p.name}
                              {!p.hasEmail && <span className="ml-2 text-xs text-gray-400">(no email, Remind can't reach them)</span>}
                            </li>
                          ))}
                        </ul>
                      )}
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
