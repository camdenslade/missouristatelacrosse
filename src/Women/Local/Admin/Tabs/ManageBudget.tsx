import { useEffect, useReducer } from "react";
import toast from "react-hot-toast";

import { useConfirm } from "../../../../Global/Common/components/ConfirmModal";
import {
  displaySeasonLabel,
  fetchActiveSeasonCode,
  fetchSeasonCodes,
} from "../../../../Global/Common/utils/seasonUtils";
import { apiRequest } from "../../../../Services/API";

const blankForm = { entryType: "expense", amount: "", description: "", entryDate: "" };

const initialState = {
  seasons: [],
  season: "",
  entries: [],
  total: 0,
  loading: true,
  form: blankForm,
  saving: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_SEASONS":
      return { ...state, seasons: action.seasons, season: action.season };
    case "SET_SEASON":
      return { ...state, season: action.season };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_LEDGER":
      return { ...state, entries: action.entries, total: action.total, loading: false };
    case "SET_FIELD":
      return { ...state, form: { ...state.form, [action.field]: action.value } };
    case "RESET_FORM":
      return { ...state, form: blankForm };
    case "SET_SAVING":
      return { ...state, saving: action.payload };
    default:
      return state;
  }
}

export default function ManageBudget() {
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    Promise.all([fetchSeasonCodes(), fetchActiveSeasonCode()]).then(([seasons, active]) => {
      dispatch({ type: "SET_SEASONS", seasons, season: active || seasons[0] || "" });
    });
  }, []);

  const load = (season) => {
    if (!season) return;
    dispatch({ type: "SET_LOADING", payload: true });
    apiRequest<{ entries: any[]; total: number }>(`/api/budget?season=${encodeURIComponent(season)}`)
      .then((data) => dispatch({ type: "SET_LEDGER", entries: data.entries, total: data.total }))
      .catch(() => dispatch({ type: "SET_LOADING", payload: false }));
  };

  useEffect(() => { load(state.season); }, [state.season]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const amount = parseFloat(state.form.amount);
    if (!state.form.description.trim() || isNaN(amount) || amount <= 0 || !state.form.entryDate) {
      toast.error("Description, a positive amount, and date are required.");
      return;
    }
    dispatch({ type: "SET_SAVING", payload: true });
    try {
      await apiRequest("/api/budget/entries", {
        method: "POST",
        json: { ...state.form, amount },
      });
      dispatch({ type: "RESET_FORM" });
      load(state.season);
      toast.success("Entry added.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add entry.");
    } finally {
      dispatch({ type: "SET_SAVING", payload: false });
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Delete this manual entry? Real payment records can't be deleted here."))) return;
    try {
      await apiRequest(`/api/budget/entries/${id}`, { method: "DELETE" });
      load(state.season);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete.");
    }
  };

  const handleVoid = async (receiptId, description) => {
    if (!(await confirm(`Void "${description}"? It'll be excluded from the ledger, but the real payment record stays untouched.`))) return;
    try {
      await apiRequest(`/api/budget/receipts/${receiptId}/void`, { method: "POST" });
      load(state.season);
      toast.success("Voided.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to void.");
    }
  };

  const input = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30";

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">Budget Ledger</h2>
        <select
          value={state.season}
          onChange={(e) => dispatch({ type: "SET_SEASON", season: e.target.value })}
          className={`${input} bg-white`}
        >
          {state.seasons.map((s) => (
            <option key={s} value={s}>{displaySeasonLabel(s)} Season</option>
          ))}
        </select>
      </div>
      <p className="text-sm text-gray-500 -mt-4">
        Every dues payment, raffle, event, fundraiser, and store sale for this season, plus
        any manual entries below, in order. The "Amount" column is what was charged;
        "Net (est.)" and the running total estimate what actually lands in the account after
        Stripe/PayPal's cut (~2.9% + $0.30) - cash/check entries have no cut taken. The
        "Amount" column itself is the legal record, kept exactly as recorded - real payments
        can't be edited here.
      </p>

      <form onSubmit={handleAdd} className="bg-gray-50 border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-gray-700">Add manual entry</h3>
        <p className="text-xs text-gray-500">
          For money that moves outside the normal payment flow - a cash expense, a
          reimbursement, a bank fee. Real payments are already tracked automatically above.
        </p>
        <div className="flex flex-wrap gap-3">
          <select
            value={state.form.entryType}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "entryType", value: e.target.value })}
            className={`${input} bg-white`}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount ($)"
            value={state.form.amount}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "amount", value: e.target.value })}
            className={`${input} bg-white w-32`}
          />
          <input
            type="date"
            value={state.form.entryDate}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "entryDate", value: e.target.value })}
            className={`${input} bg-white`}
          />
        </div>
        <input
          type="text"
          placeholder="Description"
          value={state.form.description}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })}
          className={`${input} bg-white w-full`}
        />
        <button
          type="submit"
          disabled={state.saving}
          className="px-5 py-2 bg-[#5E0009] text-white rounded-lg text-sm font-medium hover:bg-[#7a0012] transition disabled:opacity-60"
        >
          {state.saving ? "Adding..." : "Add Entry"}
        </button>
      </form>

      {state.loading && <p className="text-sm text-gray-500 animate-pulse">Loading...</p>}

      {!state.loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Description</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-right">Net (est.)</th>
                <th className="px-4 py-2.5 text-right">Running Total</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {state.entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    No entries for this season yet.
                  </td>
                </tr>
              )}
              {state.entries.map((row, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 text-gray-600">{row.date}</td>
                  <td className="px-4 py-2.5 text-gray-800">{row.description}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${row.type === "expense" ? "text-red-600" : "text-green-700"}`}>
                    {row.type === "expense" ? "-" : "+"}${Number(row.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-500 text-xs">
                    {row.source === "manual" || row.source === "dues-manual"
                      ? "-"
                      : `${row.type === "expense" ? "-" : "+"}$${Number(row.netAmount).toFixed(2)}`}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                    ${Number(row.runningTotal).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.manualEntryId && (
                      <button
                        onClick={() => handleDelete(row.manualEntryId)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                    {row.receiptId && (
                      <button
                        onClick={() => handleVoid(row.receiptId, row.description)}
                        className="text-xs text-gray-400 hover:text-gray-700 hover:underline"
                      >
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {state.entries.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td colSpan={4} className="px-4 py-3 text-right">Season Total (net, est.)</td>
                  <td className="px-4 py-3 text-right font-mono">${Number(state.total).toFixed(2)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
