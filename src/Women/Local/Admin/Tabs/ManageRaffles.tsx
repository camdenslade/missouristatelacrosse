import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { uploadCompressedImage } from "../../../../Global/Common/hooks/uploadHelper";
import {
  addAdminEntry,
  closeRaffle,
  createRaffle,
  deleteRaffle,
  drawRaffleWinner,
  fetchAdminRaffles,
  fetchRaffleEntries,
  reopenRaffle,
  updateRaffle,
} from "../../../../Global/Common/hooks/useRaffles";
import type { ApiRaffle, ApiRaffleEntry } from "../../../../types/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISO(local: string): string | undefined {
  if (!local) return undefined;
  return new Date(local).toISOString();
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── State ────────────────────────────────────────────────────────────────────

type View = "list" | "form" | "entries";

type FormState = {
  name: string;
  description: string;
  ticketPrice: string;
  maxTicketsPerPerson: string;
  allowBids: boolean;
  published: boolean;
  endTime: string;
  image: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    ticketPrice: "",
    maxTicketsPerPerson: "",
    allowBids: false,
    published: false,
    endTime: "",
    image: "",
  };
}

function raffleToForm(r: ApiRaffle): FormState {
  return {
    name: r.name ?? "",
    description: r.description ?? "",
    ticketPrice: r.ticketPrice != null ? String(r.ticketPrice) : "",
    maxTicketsPerPerson: r.maxTicketsPerPerson != null ? String(r.maxTicketsPerPerson) : "",
    allowBids: r.allowBids ?? false,
    published: r.published ?? false,
    endTime: r.endTime ? toLocalInput(r.endTime) : "",
    image: r.image ?? "",
  };
}

type AddEntryForm = {
  name: string;
  email: string;
  phone: string;
  tickets: string;
  bid: string;
};

type State = {
  view: View;
  raffles: ApiRaffle[];
  loading: boolean;
  saving: boolean;
  errorMsg: string;
  editingId: string | null;
  form: FormState;
  selectedRaffle: ApiRaffle | null;
  entries: ApiRaffleEntry[];
  entriesLoading: boolean;
  addEntryOpen: boolean;
  addEntryForm: AddEntryForm;
  addEntrySubmitting: boolean;
  addEntryError: string;
};

type Action =
  | { type: "LOADED"; raffles: ApiRaffle[] }
  | { type: "SET_VIEW"; view: View }
  | { type: "OPEN_CREATE" }
  | { type: "OPEN_EDIT"; raffle: ApiRaffle }
  | { type: "OPEN_ENTRIES"; raffle: ApiRaffle }
  | { type: "ENTRIES_LOADED"; entries: ApiRaffleEntry[] }
  | { type: "SET_FORM"; key: keyof FormState; value: string | boolean }
  | { type: "SAVE_START" }
  | { type: "SAVE_DONE"; raffle: ApiRaffle }
  | { type: "UPDATE_RAFFLE"; raffle: ApiRaffle }
  | { type: "DELETE_DONE"; id: string }
  | { type: "SET_ERROR"; msg: string }
  | { type: "TOGGLE_ADD_ENTRY" }
  | { type: "SET_ENTRY_FIELD"; key: keyof AddEntryForm; value: string }
  | { type: "ENTRY_ADD_START" }
  | { type: "ENTRY_ADD_DONE"; entry: ApiRaffleEntry }
  | { type: "ENTRY_ADD_ERROR"; msg: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOADED":
      return { ...state, loading: false, raffles: action.raffles };
    case "SET_VIEW":
      return { ...state, view: action.view };
    case "OPEN_CREATE":
      return { ...state, view: "form", editingId: null, form: emptyForm(), errorMsg: "" };
    case "OPEN_EDIT":
      return { ...state, view: "form", editingId: action.raffle.id, form: raffleToForm(action.raffle), errorMsg: "" };
    case "OPEN_ENTRIES":
      return { ...state, view: "entries", selectedRaffle: action.raffle, entries: [], entriesLoading: true };
    case "ENTRIES_LOADED":
      return { ...state, entries: action.entries, entriesLoading: false };
    case "SET_FORM":
      return { ...state, form: { ...state.form, [action.key]: action.value } };
    case "SAVE_START":
      return { ...state, saving: true, errorMsg: "" };
    case "SAVE_DONE": {
      const exists = state.raffles.find((r) => r.id === action.raffle.id);
      const raffles = exists
        ? state.raffles.map((r) => (r.id === action.raffle.id ? action.raffle : r))
        : [...state.raffles, action.raffle];
      return { ...state, saving: false, raffles, view: "list" };
    }
    case "UPDATE_RAFFLE":
      return {
        ...state,
        raffles: state.raffles.map((r) => (r.id === action.raffle.id ? action.raffle : r)),
        selectedRaffle: state.selectedRaffle?.id === action.raffle.id ? action.raffle : state.selectedRaffle,
      };
    case "DELETE_DONE":
      return { ...state, raffles: state.raffles.filter((r) => r.id !== action.id) };
    case "SET_ERROR":
      return { ...state, saving: false, errorMsg: action.msg };
    case "TOGGLE_ADD_ENTRY":
      return { ...state, addEntryOpen: !state.addEntryOpen, addEntryError: "", addEntryForm: { name: "", email: "", phone: "", tickets: "1", bid: "" } };
    case "SET_ENTRY_FIELD":
      return { ...state, addEntryForm: { ...state.addEntryForm, [action.key]: action.value } };
    case "ENTRY_ADD_START":
      return { ...state, addEntrySubmitting: true, addEntryError: "" };
    case "ENTRY_ADD_DONE":
      return { ...state, addEntrySubmitting: false, addEntryOpen: false, entries: [action.entry, ...state.entries], addEntryForm: { name: "", email: "", phone: "", tickets: "1", bid: "" } };
    case "ENTRY_ADD_ERROR":
      return { ...state, addEntrySubmitting: false, addEntryError: action.msg };
    default:
      return state;
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ManageRaffles() {
  const [state, dispatch] = useReducer(reducer, {
    view: "list",
    raffles: [],
    loading: true,
    saving: false,
    errorMsg: "",
    editingId: null,
    form: emptyForm(),
    selectedRaffle: null,
    entries: [],
    entriesLoading: false,
    addEntryOpen: false,
    addEntryForm: { name: "", email: "", phone: "", tickets: "1", bid: "" },
    addEntrySubmitting: false,
    addEntryError: "",
  });

  const imageFileRef = useRef<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminRaffles()
      .then((r) => dispatch({ type: "LOADED", raffles: r }))
      .catch(() => dispatch({ type: "LOADED", raffles: [] }));
  }, []);

  useEffect(() => {
    if (state.view !== "entries" || !state.selectedRaffle) return;
    fetchRaffleEntries(state.selectedRaffle.id)
      .then((e) => dispatch({ type: "ENTRIES_LOADED", entries: e }))
      .catch(() => dispatch({ type: "ENTRIES_LOADED", entries: [] }));
  }, [state.view, state.selectedRaffle]);

  const handleSave = useCallback(async () => {
    const f = state.form;
    if (!f.name.trim()) {
      dispatch({ type: "SET_ERROR", msg: "Raffle name is required." });
      return;
    }
    dispatch({ type: "SAVE_START" });
    const imageUrl = imageFileRef.current
      ? await uploadCompressedImage(imageFileRef.current, "raffles")
      : f.image || undefined;
    const payload = {
      name: f.name.trim(),
      description: f.description.trim() || undefined,
      image: imageUrl || undefined,
      ticketPrice: f.ticketPrice ? parseFloat(f.ticketPrice) : null,
      maxTicketsPerPerson: f.maxTicketsPerPerson ? parseInt(f.maxTicketsPerPerson, 10) : null,
      allowBids: f.allowBids,
      published: f.published,
      endTime: toISO(f.endTime),
      clearEndTime: !f.endTime ? true : undefined,
    };
    try {
      const saved = state.editingId
        ? await updateRaffle(state.editingId, payload)
        : await createRaffle(payload);
      imageFileRef.current = null;
      dispatch({ type: "SAVE_DONE", raffle: saved });
    } catch {
      dispatch({ type: "SET_ERROR", msg: "Failed to save raffle. Please try again." });
    }
  }, [state.form, state.editingId]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this raffle and all its entries?")) return;
    try {
      await deleteRaffle(id);
      dispatch({ type: "DELETE_DONE", id });
    } catch {
      alert("Failed to delete raffle.");
    }
  }, []);

  const handleDraw = useCallback(async (raffle: ApiRaffle) => {
    if (!confirm(`Draw a winner for "${raffle.name}"? This will pick randomly from paid entries.`)) return;
    try {
      const updated = await drawRaffleWinner(raffle.id);
      dispatch({ type: "UPDATE_RAFFLE", raffle: updated });
      alert(`Winner: ${updated.winnerName} (${updated.winnerEmail})`);
    } catch {
      alert("No paid entries found, or draw failed.");
    }
  }, []);

  const handleClose = useCallback(async (raffle: ApiRaffle) => {
    try {
      const updated = await closeRaffle(raffle.id);
      dispatch({ type: "UPDATE_RAFFLE", raffle: updated });
    } catch {
      alert("Failed to close raffle.");
    }
  }, []);

  const handleReopen = useCallback(async (raffle: ApiRaffle) => {
    try {
      const updated = await reopenRaffle(raffle.id);
      dispatch({ type: "UPDATE_RAFFLE", raffle: updated });
    } catch {
      alert("Failed to reopen raffle.");
    }
  }, []);

  const handleAddEntry = useCallback(async () => {
    if (!state.selectedRaffle) return;
    const f = state.addEntryForm;
    if (!f.name.trim()) {
      dispatch({ type: "ENTRY_ADD_ERROR", msg: "Name is required." });
      return;
    }
    dispatch({ type: "ENTRY_ADD_START" });
    try {
      const isBid = state.selectedRaffle.allowBids;
      const entry = await addAdminEntry(state.selectedRaffle.id, {
        payerName: f.name.trim(),
        payerEmail: f.email.trim() || undefined,
        payerPhone: f.phone.trim() || undefined,
        ticketCount: !isBid ? (parseInt(f.tickets, 10) || 1) : undefined,
        bidAmount: isBid && f.bid ? parseFloat(f.bid) : undefined,
      });
      dispatch({ type: "ENTRY_ADD_DONE", entry });
    } catch {
      dispatch({ type: "ENTRY_ADD_ERROR", msg: "Failed to add entry. Please try again." });
    }
  }, [state.selectedRaffle, state.addEntryForm]);

  if (state.view === "form") {
    return (
      <RaffleForm
        state={state}
        dispatch={dispatch}
        onSave={handleSave}
        onCancel={() => {
          imageFileRef.current = null;
          setImagePreview(null);
          dispatch({ type: "SET_VIEW", view: "list" });
        }}
        imagePreview={imagePreview}
        onImageChange={(file, preview) => {
          imageFileRef.current = file;
          setImagePreview(preview);
        }}
      />
    );
  }

  if (state.view === "entries") {
    return (
      <EntriesView
        raffle={state.selectedRaffle!}
        entries={state.entries}
        loading={state.entriesLoading}
        onBack={() => dispatch({ type: "SET_VIEW", view: "list" })}
        onDraw={handleDraw}
        onClose={handleClose}
        onReopen={handleReopen}
        addEntryOpen={state.addEntryOpen}
        addEntryForm={state.addEntryForm}
        addEntrySubmitting={state.addEntrySubmitting}
        addEntryError={state.addEntryError}
        onToggleAddEntry={() => dispatch({ type: "TOGGLE_ADD_ENTRY" })}
        onSetEntryField={(key, value) => dispatch({ type: "SET_ENTRY_FIELD", key, value })}
        onAddEntry={handleAddEntry}
      />
    );
  }

  // List view
  const statusBadge = (r: ApiRaffle) => {
    if (!r.published) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Draft</span>;
    if (r.status === "drawn") return <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Drawn</span>;
    if (r.status === "closed") return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">Closed</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Active</span>;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold">Raffles</h2>
        <button
          onClick={() => {
            imageFileRef.current = null;
            setImagePreview(null);
            dispatch({ type: "OPEN_CREATE" });
          }}
          className="px-4 py-2 bg-[#5E0009] text-white rounded hover:bg-[#7a0010] text-sm font-semibold"
        >
          + New Raffle
        </button>
      </div>

      {state.loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : state.raffles.length === 0 ? (
        <p className="text-gray-400 text-center py-10">No raffles yet. Create one above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Mode</th>
                <th className="py-2 pr-4 font-medium">Price</th>
                <th className="py-2 pr-4 font-medium">Ends</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Entries</th>
                <th className="py-2 pr-4 font-medium">Winner</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {state.raffles.map((raffle) => (
                <tr key={raffle.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">{raffle.name}</td>
                  <td className="py-2 pr-4 text-gray-600">{raffle.allowBids ? "Bid" : "Ticket"}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {raffle.ticketPrice ? `$${Number(raffle.ticketPrice).toFixed(2)}` : "Free"}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{fmtDate(raffle.endTime)}</td>
                  <td className="py-2 pr-4">{statusBadge(raffle)}</td>
                  <td className="py-2 pr-4 text-gray-600">{raffle.entryCount ?? 0}</td>
                  <td className="py-2 pr-4 text-gray-600 text-xs">
                    {raffle.winnerName ? (
                      <span title={raffle.winnerEmail ?? ""}>{raffle.winnerName}</span>
                    ) : "—"}
                  </td>
                  <td className="py-2">
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => dispatch({ type: "OPEN_ENTRIES", raffle })}
                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 font-medium"
                      >
                        Entries
                      </button>
                      {raffle.status === "active" && raffle.published && (
                        <>
                          <button
                            onClick={() => handleDraw(raffle)}
                            className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium"
                          >
                            Draw
                          </button>
                          <button
                            onClick={() => handleClose(raffle)}
                            className="text-xs px-2 py-1 rounded bg-yellow-50 text-yellow-700 hover:bg-yellow-100 font-medium"
                          >
                            Close
                          </button>
                        </>
                      )}
                      {(raffle.status === "closed" || raffle.status === "drawn") && (
                        <button
                          onClick={() => handleReopen(raffle)}
                          className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 font-medium"
                        >
                          Reopen
                        </button>
                      )}
                      <button
                        onClick={() => {
                          imageFileRef.current = null;
                          setImagePreview(raffle.image || null);
                          dispatch({ type: "OPEN_EDIT", raffle });
                        }}
                        className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(raffle.id)}
                        className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 font-medium"
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

// ─── Raffle form ──────────────────────────────────────────────────────────────

function RaffleForm({
  state,
  dispatch,
  onSave,
  onCancel,
  imagePreview,
  onImageChange,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
  onSave: () => void;
  onCancel: () => void;
  imagePreview: string | null;
  onImageChange: (file: File | null, preview: string | null) => void;
}) {
  const f = state.form;
  const input = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]";

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">Back</button>
        <h2 className="text-xl font-bold">{state.editingId ? "Edit Raffle" : "New Raffle"}</h2>
      </div>

      <div className="space-y-4 max-w-2xl">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Raffle Name *</label>
          <input
            className={input}
            value={f.name}
            onChange={(e) => dispatch({ type: "SET_FORM", key: "name", value: e.target.value })}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={3}
            className={input}
            value={f.description}
            onChange={(e) => dispatch({ type: "SET_FORM", key: "description", value: e.target.value })}
          />
        </div>

        {/* Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
          <input
            type="file"
            accept="image/*"
            className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              const preview = file ? URL.createObjectURL(file) : (f.image || null);
              onImageChange(file, preview);
            }}
          />
          {imagePreview && (
            <div className="mt-2 flex items-center gap-3">
              <img src={imagePreview} alt="Preview" className="h-20 w-32 object-cover rounded border border-gray-200" />
              <button
                type="button"
                onClick={() => {
                  onImageChange(null, null);
                  dispatch({ type: "SET_FORM", key: "image", value: "" });
                }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Mode toggle */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Entry Mode</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={f.allowBids}
              onChange={(e) => dispatch({ type: "SET_FORM", key: "allowBids", value: e.target.checked })}
              className="w-4 h-4 accent-[#5E0009]"
            />
            <span className="text-sm text-gray-700">
              Bid mode — highest bidder wins (instead of random ticket draw)
            </span>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {f.allowBids ? "Minimum Bid ($)" : "Ticket Price ($)"}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={input}
                placeholder="Leave blank for free"
                value={f.ticketPrice}
                onChange={(e) => dispatch({ type: "SET_FORM", key: "ticketPrice", value: e.target.value })}
              />
            </div>
            {!f.allowBids && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Tickets per Person</label>
                <input
                  type="number"
                  min="1"
                  className={input}
                  placeholder="Unlimited"
                  value={f.maxTicketsPerPerson}
                  onChange={(e) => dispatch({ type: "SET_FORM", key: "maxTicketsPerPerson", value: e.target.value })}
                />
              </div>
            )}
          </div>
        </div>

        {/* End time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
          <input
            type="datetime-local"
            className={input}
            value={f.endTime}
            onChange={(e) => dispatch({ type: "SET_FORM", key: "endTime", value: e.target.value })}
          />
          <p className="text-xs text-gray-400 mt-0.5">Optional — for display only. Use Close/Draw buttons to control status.</p>
        </div>

        {/* Published */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={f.published}
            onChange={(e) => dispatch({ type: "SET_FORM", key: "published", value: e.target.checked })}
            className="w-4 h-4 accent-[#5E0009]"
          />
          <span className="text-sm font-medium text-gray-700">Published (visible to public)</span>
        </label>

        {/* Error */}
        {state.errorMsg && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
            {state.errorMsg}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onSave}
            disabled={state.saving}
            className="px-5 py-2 bg-[#5E0009] text-white rounded hover:bg-[#7a0010] text-sm font-semibold disabled:opacity-50"
          >
            {state.saving ? "Saving..." : "Save Raffle"}
          </button>
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Entries view ─────────────────────────────────────────────────────────────

function EntriesView({
  raffle,
  entries,
  loading,
  onBack,
  onDraw,
  onClose,
  onReopen,
  addEntryOpen,
  addEntryForm,
  addEntrySubmitting,
  addEntryError,
  onToggleAddEntry,
  onSetEntryField,
  onAddEntry,
}: {
  raffle: ApiRaffle;
  entries: ApiRaffleEntry[];
  loading: boolean;
  onBack: () => void;
  onDraw: (r: ApiRaffle) => void;
  onClose: (r: ApiRaffle) => void;
  onReopen: (r: ApiRaffle) => void;
  addEntryOpen: boolean;
  addEntryForm: AddEntryForm;
  addEntrySubmitting: boolean;
  addEntryError: string;
  onToggleAddEntry: () => void;
  onSetEntryField: (key: keyof AddEntryForm, value: string) => void;
  onAddEntry: () => void;
}) {
  const isBid = raffle.allowBids;
  const paid = entries.filter((e) => e.paid);
  const totalRevenue = paid.reduce((sum, e) => sum + (Number(e.amountPaid) || 0), 0);
  const input = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]";

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">Back to raffles</button>
        <div>
          <h2 className="text-xl font-bold">{raffle.name}</h2>
          <p className="text-sm text-gray-400">
            {paid.length} paid {isBid ? "bids" : "entries"} · ${totalRevenue.toFixed(2)} collected
          </p>
        </div>
      </div>

      {/* Winner banner */}
      {raffle.winnerName && (
        <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-sm text-purple-800">
          🏆 <strong>Winner:</strong> {raffle.winnerName} ({raffle.winnerEmail})
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {raffle.status === "active" && raffle.published && (
          <>
            <button
              onClick={() => onDraw(raffle)}
              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 font-medium"
            >
              Draw Winner
            </button>
            <button
              onClick={() => onClose(raffle)}
              className="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 font-medium"
            >
              Close Raffle
            </button>
          </>
        )}
        {(raffle.status === "closed" || raffle.status === "drawn") && (
          <button
            onClick={() => onReopen(raffle)}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 font-medium"
          >
            Reopen
          </button>
        )}
        <button
          onClick={onToggleAddEntry}
          className="px-3 py-1.5 text-sm bg-[#5E0009] text-white rounded hover:bg-[#7a0010] font-medium ml-auto"
        >
          {addEntryOpen ? "Cancel" : "+ Add Entry"}
        </button>
      </div>

      {/* Manual add entry form */}
      {addEntryOpen && (
        <div className="mb-5 border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Add Entry Manually</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                className={input}
                placeholder="Full name"
                value={addEntryForm.name}
                onChange={(e) => onSetEntryField("name", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                className={input}
                placeholder="email@example.com"
                value={addEntryForm.email}
                onChange={(e) => onSetEntryField("email", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input
                type="tel"
                className={input}
                placeholder="(555) 000-0000"
                value={addEntryForm.phone}
                onChange={(e) => onSetEntryField("phone", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {isBid ? "Bid Amount ($)" : "Ticket Count"}
              </label>
              {isBid ? (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={input}
                  placeholder="0.00"
                  value={addEntryForm.bid}
                  onChange={(e) => onSetEntryField("bid", e.target.value)}
                />
              ) : (
                <input
                  type="number"
                  min="1"
                  className={input}
                  value={addEntryForm.tickets}
                  onChange={(e) => onSetEntryField("tickets", e.target.value)}
                />
              )}
            </div>
          </div>
          {addEntryError && (
            <p className="text-red-600 text-xs">{addEntryError}</p>
          )}
          <button
            onClick={onAddEntry}
            disabled={addEntrySubmitting}
            className="px-4 py-2 bg-[#5E0009] text-white rounded text-sm font-semibold hover:bg-[#7a0010] disabled:opacity-50"
          >
            {addEntrySubmitting ? "Adding..." : "Add Entry"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-400 text-center py-10">No entries yet.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                {isBid ? (
                  <th className="px-4 py-2 font-medium">Bid</th>
                ) : (
                  <th className="px-4 py-2 font-medium">Tickets</th>
                )}
                <th className="px-4 py-2 font-medium">Paid</th>
                <th className="px-4 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2">{e.payerName || "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{e.payerEmail || "—"}</td>
                  {isBid ? (
                    <td className="px-4 py-2 font-semibold">
                      ${Number(e.bidAmount ?? 0).toFixed(2)}
                    </td>
                  ) : (
                    <td className="px-4 py-2">{e.ticketCount}</td>
                  )}
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.paid ? "bg-green-100 text-green-700" : "bg-red-50 text-red-500"}`}>
                      {e.paid ? `$${Number(e.amountPaid ?? 0).toFixed(2)}` : "Unpaid"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {e.createdAt ? new Date(e.createdAt).toLocaleDateString() : "—"}
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
