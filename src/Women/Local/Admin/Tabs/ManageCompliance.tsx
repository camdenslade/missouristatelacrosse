import { useEffect, useReducer } from "react";
import toast from "react-hot-toast";

import { useConfirm } from "../../../../Global/Common/components/ConfirmModal";
import { apiRequest } from "../../../../Services/API";

const TYPES = [
  { value: "MO_ANNUAL", label: "Missouri Annual Filing" },
  { value: "IRS", label: "IRS Yearly Filing" },
  { value: "GRANT", label: "Grant Renewal" },
];

const STATUSES = ["pending", "filed", "overdue"];

const blankForm = { type: "MO_ANNUAL", name: "", dueDate: "", lastFiled: "", status: "pending", notes: "" };

const initialState = { filings: [], loading: true, form: blankForm, saving: false };

function reducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_FILINGS":
      return { ...state, filings: action.payload, loading: false };
    case "SET_FIELD":
      return { ...state, form: { ...state.form, [action.field]: action.value } };
    case "RESET_FORM":
      return { ...state, form: blankForm };
    case "SET_SAVING":
      return { ...state, saving: action.payload };
    case "REMOVE":
      return { ...state, filings: state.filings.filter((f) => f.id !== action.id) };
    default:
      return state;
  }
}

export default function ManageCompliance() {
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = () => {
    dispatch({ type: "SET_LOADING", payload: true });
    apiRequest("/api/compliance-filings")
      .then((data) => dispatch({ type: "SET_FILINGS", payload: data }))
      .catch(() => dispatch({ type: "SET_LOADING", payload: false }));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!state.form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    dispatch({ type: "SET_SAVING", payload: true });
    try {
      await apiRequest("/api/compliance-filings", {
        method: "POST",
        json: {
          ...state.form,
          dueDate: state.form.dueDate || null,
          lastFiled: state.form.lastFiled || null,
        },
      });
      dispatch({ type: "RESET_FORM" });
      load();
      toast.success("Filing added.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add filing.");
    } finally {
      dispatch({ type: "SET_SAVING", payload: false });
    }
  };

  const handleStatusChange = async (filing, status) => {
    try {
      await apiRequest(`/api/compliance-filings/${filing.id}`, {
        method: "PUT",
        json: { status, lastFiled: status === "filed" ? new Date().toISOString().slice(0, 10) : filing.lastFiled },
      });
      load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status.");
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Delete this filing?"))) return;
    try {
      await apiRequest(`/api/compliance-filings/${id}`, { method: "DELETE" });
      dispatch({ type: "REMOVE", id });
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete.");
    }
  };

  const input = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30";

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn space-y-6">
      <h2 className="text-lg font-bold text-gray-900">Compliance Filings</h2>
      <p className="text-sm text-gray-500 -mt-4">
        Missouri nonprofit annual filings, IRS yearly filings, and grant renewals that need
        to be tracked each year.
      </p>

      <form onSubmit={handleAdd} className="bg-gray-50 border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3">
          <select
            value={state.form.type}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "type", value: e.target.value })}
            className={`${input} bg-white`}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Filing name"
            value={state.form.name}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "name", value: e.target.value })}
            className={`${input} bg-white flex-1 min-w-[180px]`}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Due date</label>
            <input
              type="date"
              value={state.form.dueDate}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "dueDate", value: e.target.value })}
              className={`${input} bg-white`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Last filed</label>
            <input
              type="date"
              value={state.form.lastFiled}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "lastFiled", value: e.target.value })}
              className={`${input} bg-white`}
            />
          </div>
        </div>
        <textarea
          placeholder="Notes (optional)"
          value={state.form.notes}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "notes", value: e.target.value })}
          className={`${input} bg-white w-full`}
          rows={2}
        />
        <button
          type="submit"
          disabled={state.saving}
          className="px-5 py-2 bg-[#5E0009] text-white rounded-lg text-sm font-medium hover:bg-[#7a0012] transition disabled:opacity-60"
        >
          {state.saving ? "Adding..." : "Add Filing"}
        </button>
      </form>

      {state.loading && <p className="text-sm text-gray-500 animate-pulse">Loading...</p>}
      {!state.loading && state.filings.length === 0 && (
        <p className="text-sm text-gray-400">No filings tracked yet.</p>
      )}

      {!state.loading && state.filings.length > 0 && (
        <div className="divide-y divide-gray-100 bg-white rounded-xl border border-gray-200">
          {state.filings.map((f) => (
            <div key={f.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{f.name}</p>
                <p className="text-xs text-gray-500">
                  {TYPES.find((t) => t.value === f.type)?.label || f.type}
                  {f.dueDate && ` - due ${f.dueDate}`}
                  {f.lastFiled && ` - last filed ${f.lastFiled}`}
                </p>
                {f.notes && <p className="text-xs text-gray-400 mt-1">{f.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={f.status}
                  onChange={(e) => handleStatusChange(f, e.target.value)}
                  className={`${input} bg-white text-xs`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleDelete(f.id)}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
