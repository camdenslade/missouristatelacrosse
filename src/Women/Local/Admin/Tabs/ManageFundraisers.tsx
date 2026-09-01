import { useCallback, useEffect, useReducer, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

import { useConfirm } from "../../../../Global/Common/components/ConfirmModal";
import { uploadCompressedImage } from "../../../../Global/Common/hooks/uploadHelper";
import {
  createFundraiser,
  deleteFundraiser,
  fetchAdminFundraisers,
  updateFundraiser,
} from "../../../../Global/Common/hooks/useFundraisers";
import { apiRequest } from "../../../../Services/API";
import { getProgramInfo } from "../../../../Services/programHelper";
import type { ApiFundraiser, ApiFundraiserExpense } from "../../../../types/api";

// State

type View = "list" | "form";

type ExpenseRow = ApiFundraiserExpense & { key: string };

type FormState = {
  title: string;
  description: string;
  goalAmount: string;
  link: string;
  published: boolean;
  active: boolean;
  expenses: ExpenseRow[];
};

function emptyForm(): FormState {
  return {
    title: "",
    description: "",
    goalAmount: "",
    link: "",
    published: false,
    active: false,
    expenses: [],
  };
}

function newRowKey() {
  return Math.random().toString(36).slice(2);
}

function fundraiserToForm(f: ApiFundraiser): FormState {
  return {
    title: f.title ?? "",
    description: f.description ?? "",
    goalAmount: f.goalAmount != null ? String(f.goalAmount) : "",
    link: f.link ?? "",
    published: f.published ?? false,
    active: f.active ?? false,
    expenses: (f.expenses ?? []).map((e) => ({ ...e, key: newRowKey() })),
  };
}

type ImageItem = { preview: string; file: File | null; url: string | null };

function fundraiserToImage(f: ApiFundraiser): ImageItem[] {
  return f.image ? [{ preview: f.image, file: null, url: f.image }] : [];
}

type State = {
  view: View;
  fundraisers: ApiFundraiser[];
  loading: boolean;
  saving: boolean;
  errorMsg: string;
  editingId: string | null;
  form: FormState;
};

type Action =
  | { type: "LOADED"; fundraisers: ApiFundraiser[] }
  | { type: "SET_VIEW"; view: View }
  | { type: "OPEN_CREATE" }
  | { type: "OPEN_EDIT"; fundraiser: ApiFundraiser }
  | { type: "SET_FORM"; key: keyof FormState; value: string | boolean }
  | { type: "ADD_EXPENSE" }
  | { type: "SET_EXPENSE"; key: string; field: "label" | "amount" | "detail"; value: string }
  | { type: "REMOVE_EXPENSE"; key: string }
  | { type: "SAVE_START" }
  | { type: "SAVE_DONE"; fundraiser: ApiFundraiser }
  | { type: "DELETE_DONE"; id: string }
  | { type: "SET_ERROR"; msg: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOADED":
      return { ...state, loading: false, fundraisers: action.fundraisers };
    case "SET_VIEW":
      return { ...state, view: action.view };
    case "OPEN_CREATE":
      return { ...state, view: "form", editingId: null, form: emptyForm(), errorMsg: "" };
    case "OPEN_EDIT":
      return { ...state, view: "form", editingId: action.fundraiser.id, form: fundraiserToForm(action.fundraiser), errorMsg: "" };
    case "SET_FORM":
      return { ...state, form: { ...state.form, [action.key]: action.value } };
    case "ADD_EXPENSE":
      return { ...state, form: { ...state.form, expenses: [...state.form.expenses, { key: newRowKey(), label: "", amount: 0, detail: "" }] } };
    case "SET_EXPENSE":
      return {
        ...state,
        form: {
          ...state.form,
          expenses: state.form.expenses.map((e) =>
            e.key === action.key
              ? { ...e, [action.field]: action.field === "amount" ? Number(action.value) || 0 : action.value }
              : e
          ),
        },
      };
    case "REMOVE_EXPENSE":
      return { ...state, form: { ...state.form, expenses: state.form.expenses.filter((e) => e.key !== action.key) } };
    case "SAVE_START":
      return { ...state, saving: true, errorMsg: "" };
    case "SAVE_DONE": {
      const exists = state.fundraisers.find((f) => f.id === action.fundraiser.id);
      const fundraisers = exists
        ? state.fundraisers.map((f) => (f.id === action.fundraiser.id ? action.fundraiser : f))
        : [...state.fundraisers, action.fundraiser];
      return { ...state, saving: false, fundraisers, view: "list" };
    }
    case "DELETE_DONE":
      return { ...state, fundraisers: state.fundraisers.filter((f) => f.id !== action.id) };
    case "SET_ERROR":
      return { ...state, saving: false, errorMsg: action.msg };
    default:
      return state;
  }
}

// Component

export default function ManageFundraisers() {
  const confirm = useConfirm();
  const { base } = getProgramInfo();
  const [state, dispatch] = useReducer(reducer, {
    view: "list",
    fundraisers: [],
    loading: true,
    saving: false,
    errorMsg: "",
    editingId: null,
    form: emptyForm(),
  });

  const [imageItem, setImageItem] = useState<ImageItem | null>(null);
  const [raisedByFundraiser, setRaisedByFundraiser] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchAdminFundraisers()
      .then((f) => dispatch({ type: "LOADED", fundraisers: f }))
      .catch(() => dispatch({ type: "LOADED", fundraisers: [] }));
  }, []);

  useEffect(() => {
    state.fundraisers.forEach((f) => {
      if (raisedByFundraiser[f.id] !== undefined) return;
      apiRequest<{ total: number }>(`/api/paypal/total?source=fundraiser-${f.slug}`)
        .then((data) => setRaisedByFundraiser((prev) => ({ ...prev, [f.id]: Number(data.total) })))
        .catch(() => setRaisedByFundraiser((prev) => ({ ...prev, [f.id]: 0 })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fundraisers]);

  const handleSave = useCallback(async () => {
    const f = state.form;
    if (!f.title.trim()) {
      dispatch({ type: "SET_ERROR", msg: "Campaign title is required." });
      return;
    }
    dispatch({ type: "SAVE_START" });
    try {
      const image = imageItem
        ? imageItem.file
          ? await uploadCompressedImage(imageItem.file, "fundraisers")
          : imageItem.url ?? undefined
        : "";
      const payload = {
        title: f.title.trim(),
        description: f.description.trim() || undefined,
        image,
        link: f.link.trim() || "",
        goalAmount: f.goalAmount ? parseFloat(f.goalAmount) : null,
        expenses: f.expenses
          .filter((e) => e.label.trim())
          .map(({ label, amount, detail }) => ({ label: label.trim(), amount, detail: detail?.trim() || undefined })),
        published: f.published,
        active: f.active,
      };
      const saved = state.editingId
        ? await updateFundraiser(state.editingId, payload)
        : await createFundraiser(payload);
      setImageItem(null);
      dispatch({ type: "SAVE_DONE", fundraiser: saved });
    } catch {
      dispatch({ type: "SET_ERROR", msg: "Failed to save campaign. Please try again." });
    }
  }, [state.form, state.editingId, imageItem]);

  const handleDelete = useCallback(async (id: string) => {
    if (!await confirm("Delete this fundraiser campaign?")) return;
    try {
      await deleteFundraiser(id);
      dispatch({ type: "DELETE_DONE", id });
    } catch {
      toast.error("Failed to delete campaign.");
    }
  }, [confirm]);

  const handleToggleActive = useCallback(async (f: ApiFundraiser) => {
    try {
      const updated = await updateFundraiser(f.id, { active: !f.active });
      // Re-fetch full list since activating one deactivates all others server-side.
      const refreshed = await fetchAdminFundraisers();
      dispatch({ type: "LOADED", fundraisers: refreshed });
      void updated;
    } catch {
      toast.error("Failed to update active campaign.");
    }
  }, []);

  const handleTogglePublished = useCallback(async (f: ApiFundraiser) => {
    try {
      const updated = await updateFundraiser(f.id, { published: !f.published });
      dispatch({ type: "SAVE_DONE", fundraiser: updated });
      dispatch({ type: "SET_VIEW", view: "list" });
    } catch {
      toast.error("Failed to update campaign.");
    }
  }, []);

  if (state.view === "form") {
    return (
      <FundraiserForm
        state={state}
        dispatch={dispatch}
        onSave={handleSave}
        onCancel={() => {
          setImageItem(null);
          dispatch({ type: "SET_VIEW", view: "list" });
        }}
        imageItem={imageItem}
        onSetImage={(file) => {
          const preview = URL.createObjectURL(file);
          setImageItem({ preview, file, url: null });
        }}
        onRemoveImage={() => setImageItem(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-bold text-gray-900">Fundraiser Campaigns</h2>
        <button
          onClick={() => {
            setImageItem(null);
            dispatch({ type: "OPEN_CREATE" });
          }}
          className="px-4 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0012] text-sm font-semibold"
        >
          + New Campaign
        </button>
      </div>

      {state.loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : state.fundraisers.length === 0 ? (
        <p className="text-gray-400 text-center py-10">No fundraiser campaigns yet. Create one above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Title</th>
                <th className="py-2 pr-4 font-medium">Raised / Goal</th>
                <th className="py-2 pr-4 font-medium">Active</th>
                <th className="py-2 pr-4 font-medium">Published</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {state.fundraisers.map((f) => (
                <tr key={f.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">
                    <Link to={`${base}/fundraiser/${f.slug}`} target="_blank" className="hover:underline">
                      {f.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-gray-600">
                    ${(raisedByFundraiser[f.id] ?? 0).toLocaleString()}
                    {f.goalAmount ? ` / $${Number(f.goalAmount).toLocaleString()}` : ""}
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      onClick={() => handleToggleActive(f)}
                      className={`text-xs px-2 py-1 rounded-full font-semibold uppercase tracking-wide ${
                        f.active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {f.active ? "Active" : "Activate"}
                    </button>
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      onClick={() => handleTogglePublished(f)}
                      className={`text-xs px-2 py-1 rounded-full font-semibold uppercase tracking-wide ${
                        f.published ? "bg-blue-50 text-blue-700 hover:bg-blue-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {f.published ? "Published" : "Draft"}
                    </button>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => {
                          setImageItem(fundraiserToImage(f)[0] ?? null);
                          dispatch({ type: "OPEN_EDIT", fundraiser: f });
                        }}
                        className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Form

function FundraiserForm({
  state,
  dispatch,
  onSave,
  onCancel,
  imageItem,
  onSetImage,
  onRemoveImage,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
  onSave: () => void;
  onCancel: () => void;
  imageItem: ImageItem | null;
  onSetImage: (file: File) => void;
  onRemoveImage: () => void;
}) {
  const f = state.form;
  const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]";

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">Back</button>
        <h2 className="text-lg font-bold text-gray-900">{state.editingId ? "Edit Campaign" : "New Campaign"}</h2>
      </div>

      <div className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Title *</label>
          <input
            className={input}
            value={f.title}
            onChange={(e) => dispatch({ type: "SET_FORM", key: "title", value: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={4}
            className={input}
            value={f.description}
            onChange={(e) => dispatch({ type: "SET_FORM", key: "description", value: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Image</label>
          {imageItem ? (
            <div className="relative w-40">
              <img src={imageItem.preview} alt="" className="h-24 w-40 object-cover rounded-lg border border-gray-200" />
              <button
                type="button"
                onClick={onRemoveImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 leading-none"
              >
                x
              </button>
            </div>
          ) : (
            <label className="h-24 w-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 text-gray-400 text-xs text-center gap-1">
              <span className="text-lg leading-none">+</span>
              <span>Add Image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onSetImage(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Goal Amount ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={input}
              placeholder="e.g. 3000"
              value={f.goalAmount}
              onChange={(e) => dispatch({ type: "SET_FORM", key: "goalAmount", value: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">External Link Override</label>
            <input
              type="text"
              className={input}
              placeholder="Optional - overrides homepage banner link"
              value={f.link}
              onChange={(e) => dispatch({ type: "SET_FORM", key: "link", value: e.target.value })}
            />
          </div>
        </div>

        {/* Expense breakdown */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Expense Breakdown</p>
            <button
              type="button"
              onClick={() => dispatch({ type: "ADD_EXPENSE" })}
              className="text-xs px-2 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 font-medium"
            >
              + Add Line Item
            </button>
          </div>
          {f.expenses.length === 0 ? (
            <p className="text-xs text-gray-400">No expense line items. This section will be hidden on the campaign page.</p>
          ) : (
            <div className="space-y-2">
              {f.expenses.map((row) => (
                <div key={row.key} className="flex gap-2 items-start">
                  <input
                    placeholder="Label"
                    className={`${input} flex-[2]`}
                    value={row.label}
                    onChange={(e) => dispatch({ type: "SET_EXPENSE", key: row.key, field: "label", value: e.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount"
                    className={`${input} flex-1`}
                    value={row.amount || ""}
                    onChange={(e) => dispatch({ type: "SET_EXPENSE", key: row.key, field: "amount", value: e.target.value })}
                  />
                  <input
                    placeholder="Detail (optional)"
                    className={`${input} flex-[2]`}
                    value={row.detail ?? ""}
                    onChange={(e) => dispatch({ type: "SET_EXPENSE", key: row.key, field: "detail", value: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "REMOVE_EXPENSE", key: row.key })}
                    className="px-2 py-2 text-red-500 hover:text-red-700"
                    aria-label="Remove line item"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => dispatch({ type: "SET_FORM", key: "active", value: e.target.checked })}
            className="w-4 h-4 accent-[#5E0009]"
          />
          <span className="text-sm text-gray-700">
            Active - featured in the homepage banner (deactivates any other active campaign)
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={f.published}
            onChange={(e) => dispatch({ type: "SET_FORM", key: "published", value: e.target.checked })}
            className="w-4 h-4 accent-[#5E0009]"
          />
          <span className="text-sm font-medium text-gray-700">Published (campaign page visible to public)</span>
        </label>

        {state.errorMsg && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {state.errorMsg}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onSave}
            disabled={state.saving}
            className="px-5 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0012] text-sm font-semibold disabled:opacity-50"
          >
            {state.saving ? "Saving..." : "Save Campaign"}
          </button>
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
