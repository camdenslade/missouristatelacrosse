import { useEffect, useReducer } from "react";
import toast from "react-hot-toast";

import { useConfirm } from "../../../../Global/Common/components/ConfirmModal";
import { apiRequest } from "../../../../Services/API";

const blankForm = { title: "", eventDate: "", notes: "" };

const initialState = { events: [], filings: [], loading: true, form: blankForm, saving: false };

function reducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_DATA":
      return { ...state, events: action.events, filings: action.filings, loading: false };
    case "SET_FIELD":
      return { ...state, form: { ...state.form, [action.field]: action.value } };
    case "RESET_FORM":
      return { ...state, form: blankForm };
    case "SET_SAVING":
      return { ...state, saving: action.payload };
    case "REMOVE":
      return { ...state, events: state.events.filter((e) => e.id !== action.id) };
    default:
      return state;
  }
}

export default function BoardCalendar() {
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = () => {
    dispatch({ type: "SET_LOADING", payload: true });
    Promise.all([
      apiRequest("/api/board-calendar").catch(() => []),
      apiRequest("/api/compliance-filings").catch(() => []),
    ]).then(([events, filings]) => dispatch({ type: "SET_DATA", events, filings }));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!state.form.title.trim() || !state.form.eventDate) {
      toast.error("Title and date are required.");
      return;
    }
    dispatch({ type: "SET_SAVING", payload: true });
    try {
      await apiRequest("/api/board-calendar", { method: "POST", json: state.form });
      dispatch({ type: "RESET_FORM" });
      load();
      toast.success("Added to calendar.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add.");
    } finally {
      dispatch({ type: "SET_SAVING", payload: false });
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Remove this calendar entry?"))) return;
    try {
      await apiRequest(`/api/board-calendar/${id}`, { method: "DELETE" });
      dispatch({ type: "REMOVE", id });
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove.");
    }
  };

  const input = "border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition";

  // Merge board entries with upcoming compliance due dates, read-only reminders here -
  // edit those from the Compliance tab, not duplicated into this table.
  const combined = [
    ...state.events.map((e) => ({
      key: `event-${e.id}`,
      date: e.eventDate,
      title: e.title,
      detail: e.notes,
      source: "board",
      raw: e,
    })),
    ...state.filings
      .filter((f) => f.dueDate && f.status !== "filed")
      .map((f) => ({
        key: `filing-${f.id}`,
        date: f.dueDate,
        title: `Due: ${f.name}`,
        detail: "Compliance filing - edit from the Compliance tab",
        source: "compliance",
        raw: f,
      })),
  ].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn space-y-6">
      <h2 className="text-2xl md:text-3xl font-extrabold uppercase text-gray-900">Board Calendar</h2>
      <p className="text-sm text-gray-500 -mt-4">
        Shared with board members and up. Upcoming compliance filing due dates show here
        automatically.
      </p>

      <form onSubmit={handleAdd} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Title (e.g. Board meeting)"
            value={state.form.title}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "title", value: e.target.value })}
            className={`${input} bg-white flex-1 min-w-[180px]`}
          />
          <input
            type="date"
            value={state.form.eventDate}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "eventDate", value: e.target.value })}
            className={`${input} bg-white`}
          />
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
          className="px-5 py-2 bg-[#5E0009] text-white rounded-full text-sm font-medium hover:bg-[#7a0012] transition disabled:opacity-60 shadow-sm"
        >
          {state.saving ? "Adding..." : "Add to Calendar"}
        </button>
      </form>

      {state.loading && <p className="text-sm text-gray-500 animate-pulse">Loading...</p>}
      {!state.loading && combined.length === 0 && (
        <p className="text-sm text-gray-400">Nothing on the calendar yet.</p>
      )}

      {!state.loading && combined.length > 0 && (
        <div className="divide-y divide-gray-100 bg-white rounded-xl border border-gray-200">
          {combined.map((item) => (
            <div key={item.key} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500">
                  {item.date}
                  {item.detail && ` - ${item.detail}`}
                </p>
              </div>
              {item.source === "board" && (
                <button
                  onClick={() => handleDelete(item.raw.id)}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium transition shrink-0"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
