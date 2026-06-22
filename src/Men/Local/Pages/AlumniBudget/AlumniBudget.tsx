import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../../../Global/Context/AuthContext";
import { apiRequest } from "../../../../Services/API";

interface BudgetEntry {
  id: string;
  year: string;
  category: string;
  description: string;
  amount: number;
  entryType: "INCOME" | "EXPENSE";
  displayOrder: number;
}

type EntryForm = {
  year: string;
  category: string;
  description: string;
  amount: string;
  entryType: "INCOME" | "EXPENSE";
};

const BLANK_FORM: EntryForm = { year: "", category: "", description: "", amount: "", entryType: "EXPENSE" };

type State = {
  entries: BudgetEntry[];
  loading: boolean;
  editingId: string | null;
  showAdd: boolean;
  form: EntryForm;
};

type Action =
  | { type: "SET_ENTRIES"; entries: BudgetEntry[] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "OPEN_ADD" }
  | { type: "OPEN_EDIT"; entry: BudgetEntry }
  | { type: "CLOSE_FORM" }
  | { type: "SET_FORM"; form: Partial<EntryForm> }
  | { type: "UPSERT"; entry: BudgetEntry }
  | { type: "REMOVE"; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_ENTRIES": return { ...state, entries: action.entries, loading: false };
    case "SET_LOADING": return { ...state, loading: action.loading };
    case "OPEN_ADD": return { ...state, showAdd: true, editingId: null, form: BLANK_FORM };
    case "OPEN_EDIT": return {
      ...state, showAdd: true, editingId: action.entry.id,
      form: {
        year: action.entry.year,
        category: action.entry.category,
        description: action.entry.description,
        amount: String(action.entry.amount),
        entryType: action.entry.entryType,
      },
    };
    case "CLOSE_FORM": return { ...state, showAdd: false, editingId: null, form: BLANK_FORM };
    case "SET_FORM": return { ...state, form: { ...state.form, ...action.form } };
    case "UPSERT": {
      const exists = state.entries.some((e) => e.id === action.entry.id);
      return {
        ...state,
        entries: exists
          ? state.entries.map((e) => (e.id === action.entry.id ? action.entry : e))
          : [...state.entries, action.entry],
        showAdd: false, editingId: null, form: BLANK_FORM,
      };
    }
    case "REMOVE": return { ...state, entries: state.entries.filter((e) => e.id !== action.id) };
    default: return state;
  }
}

const initialState: State = {
  entries: [], loading: true, editingId: null, showAdd: false, form: BLANK_FORM,
};

function groupByYear(entries: BudgetEntry[]) {
  const map = new Map<string, BudgetEntry[]>();
  for (const e of entries) {
    if (!map.has(e.year)) map.set(e.year, []);
    map.get(e.year)!.push(e);
  }
  return Array.from(map.entries()).map(([year, rows]) => {
    const income = rows.filter((r) => r.entryType === "INCOME").reduce((s, r) => s + Number(r.amount), 0);
    const expense = rows.filter((r) => r.entryType === "EXPENSE").reduce((s, r) => s + Number(r.amount), 0);
    return { year, rows, income, expense, net: income - expense };
  });
}

export default function AlumniBudget({ adminMode = false }: { adminMode?: boolean }) {
  const { roles } = useAuth();
  const isWomenSite = window.location.pathname.toLowerCase().includes("/women");
  const program = isWomenSite ? "women" : "men";
  const isAdmin = adminMode || roles?.[program] === "admin";

  const [state, dispatch] = useReducer(reducer, initialState);
  const { entries, loading, editingId, showAdd, form } = state;
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    dispatch({ type: "SET_LOADING", loading: true });
    const data = await apiRequest<BudgetEntry[]>("/api/alumni-budget").catch(() => []);
    dispatch({ type: "SET_ENTRIES", entries: data });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const amount = parseFloat(form.amount);
    if (!form.year || !form.category || isNaN(amount) || amount < 0) {
      toast.error("Please fill in year, category, and a valid amount.");
      return;
    }
    const payload = { year: form.year, category: form.category, description: form.description, amount, entryType: form.entryType };
    try {
      const saved = editingId
        ? await apiRequest<BudgetEntry>(`/api/alumni-budget/${editingId}`, { method: "PUT", json: payload })
        : await apiRequest<BudgetEntry>("/api/alumni-budget", { method: "POST", json: payload });
      dispatch({ type: "UPSERT", entry: saved });
      toast.success(editingId ? "Entry updated." : "Entry added.");
    } catch {
      toast.error("Failed to save entry.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/alumni-budget/${id}`, { method: "DELETE" });
      dispatch({ type: "REMOVE", id });
      toast.success("Entry deleted.");
    } catch {
      toast.error("Failed to delete entry.");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const imported = await apiRequest<BudgetEntry[]>("/api/alumni-budget/import", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: text,
      });
      await load();
      toast.success(`Imported ${imported.length} rows.`);
    } catch {
      toast.error("Import failed. Check CSV format.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const groups = groupByYear(entries);

  return (
    <div className="h-full overflow-y-auto">
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isWomenSite ? "Women's" : "Men's"} Program Budget
        </h1>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => dispatch({ type: "OPEN_ADD" })}
              className="px-4 py-2 bg-[#5E0009] text-white rounded-lg text-sm font-medium hover:bg-[#7a0012] transition"
            >
              + Add Entry
            </button>
            <label className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition cursor-pointer">
              {importing ? "Importing…" : "Import CSV"}
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />
            </label>
          </div>
        )}
      </div>

      {/* Add/Edit form */}
      {isAdmin && showAdd && (
        <div className="mb-6 p-5 border border-gray-200 rounded-lg bg-gray-50 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">{editingId ? "Edit Entry" : "New Entry"}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Year (e.g. 25-26)</label>
              <input value={form.year} onChange={(e) => dispatch({ type: "SET_FORM", form: { year: e.target.value } })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="25-26" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <input value={form.category} onChange={(e) => dispatch({ type: "SET_FORM", form: { category: e.target.value } })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="Dues, Equipment…" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
              <input type="number" min="0" step="0.01" value={form.amount}
                onChange={(e) => dispatch({ type: "SET_FORM", form: { amount: e.target.value } })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input value={form.description} onChange={(e) => dispatch({ type: "SET_FORM", form: { description: e.target.value } })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="Optional details" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select value={form.entryType} onChange={(e) => dispatch({ type: "SET_FORM", form: { entryType: e.target.value as EntryForm["entryType"] } })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave}
              className="px-4 py-2 bg-[#5E0009] text-white rounded text-sm font-medium hover:bg-[#7a0012] transition">
              {editingId ? "Save Changes" : "Add Entry"}
            </button>
            <button onClick={() => dispatch({ type: "CLOSE_FORM" })}
              className="px-4 py-2 bg-gray-200 rounded text-sm hover:bg-gray-300 transition">
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            CSV import format: <code>year,category,description,amount,type</code> (type = INCOME or EXPENSE)
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 animate-pulse">Loading budget data…</p>
      ) : groups.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No budget entries yet.</p>
      ) : (
        <div className="space-y-8">
          {groups.map(({ year, rows, income, expense, net }) => (
            <div key={year} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-[#5E0009] text-white px-4 py-3 flex flex-wrap justify-between items-center gap-2">
                <span className="font-bold text-lg">{year} Season</span>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-300">Income: ${income.toFixed(2)}</span>
                  <span className="text-red-300">Expenses: ${expense.toFixed(2)}</span>
                  <span className={`font-semibold ${net >= 0 ? "text-green-200" : "text-red-200"}`}>
                    Net: {net >= 0 ? "+" : ""}${net.toFixed(2)}
                  </span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-left">Description</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-center">Type</th>
                    {isAdmin && <th className="px-4 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{row.category}</td>
                      <td className="px-4 py-2 text-gray-500">{row.description || "—"}</td>
                      <td className="px-4 py-2 text-right font-mono">${Number(row.amount).toFixed(2)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.entryType === "INCOME" ? "bg-gray-100 text-gray-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {row.entryType === "INCOME" ? "Income" : "Expense"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => dispatch({ type: "OPEN_EDIT", entry: row })}
                            className="text-xs text-blue-600 hover:underline mr-3">Edit</button>
                          <button onClick={() => handleDelete(row.id)}
                            className="text-xs text-red-500 hover:underline">Delete</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  );
}
