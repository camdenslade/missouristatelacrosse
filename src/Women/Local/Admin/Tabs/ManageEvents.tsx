import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { uploadCompressedImage } from "../../../../Global/Common/hooks/uploadHelper";
import {
  createEvent,
  deleteEvent,
  fetchAdminEvents,
  fetchRegistrations,
  updateEvent,
} from "../../../../Global/Common/hooks/useEvents";
import type {
  ApiEvent,
  ApiEventField,
  ApiEventRegistration,
  EventFieldType,
} from "../../../../types/api";

// ─── Field builder helpers ────────────────────────────────────────────────────

function makeField(): ApiEventField {
  return { id: crypto.randomUUID(), label: "", type: "text", required: false };
}

// ─── State ────────────────────────────────────────────────────────────────────

type View = "list" | "form" | "submissions";

type FormState = {
  name: string;
  address: string;
  startTime: string;
  endTime: string;
  description: string;
  price: string;
  teamSize: string;
  published: boolean;
  image: string;
  fields: ApiEventField[];
};

function emptyForm(): FormState {
  return {
    name: "",
    address: "",
    startTime: "",
    endTime: "",
    description: "",
    price: "",
    teamSize: "1",
    published: false,
    image: "",
    fields: [],
  };
}

function eventToForm(e: ApiEvent): FormState {
  return {
    name: e.name ?? "",
    address: e.address ?? "",
    startTime: e.startTime ? toLocalInput(e.startTime) : "",
    endTime: e.endTime ? toLocalInput(e.endTime) : "",
    description: e.description ?? "",
    price: e.price != null ? String(e.price) : "",
    teamSize: String(e.teamSize ?? 1),
    published: e.published ?? false,
    image: e.image ?? "",
    fields: e.fields ?? [],
  };
}

// Convert ISO to datetime-local input value
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert datetime-local value to ISO string
function toISO(local: string): string | undefined {
  if (!local) return undefined;
  return new Date(local).toISOString();
}

type State = {
  view: View;
  events: ApiEvent[];
  loading: boolean;
  saving: boolean;
  errorMsg: string;
  editingId: string | null;
  form: FormState;
  selectedEvent: ApiEvent | null;
  registrations: ApiEventRegistration[];
  regsLoading: boolean;
  // Field builder option editing (for select fields)
  optionInputs: Record<string, string>;
};

type Action =
  | { type: "LOADED"; events: ApiEvent[] }
  | { type: "SET_VIEW"; view: View }
  | { type: "OPEN_CREATE" }
  | { type: "OPEN_EDIT"; event: ApiEvent }
  | { type: "OPEN_SUBMISSIONS"; event: ApiEvent }
  | { type: "REGS_LOADED"; regs: ApiEventRegistration[] }
  | { type: "SET_FORM_FIELD"; key: keyof FormState; value: string | boolean }
  | { type: "ADD_FIELD" }
  | { type: "UPDATE_FIELD"; index: number; key: keyof ApiEventField; value: string | boolean | string[] }
  | { type: "REMOVE_FIELD"; index: number }
  | { type: "MOVE_FIELD"; index: number; dir: -1 | 1 }
  | { type: "SET_OPTION_INPUT"; fieldId: string; value: string }
  | { type: "ADD_OPTION"; fieldId: string }
  | { type: "REMOVE_OPTION"; fieldId: string; opt: string }
  | { type: "SAVE_START" }
  | { type: "SAVE_DONE"; event: ApiEvent }
  | { type: "DELETE_DONE"; id: string }
  | { type: "SET_ERROR"; msg: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOADED":
      return { ...state, loading: false, events: action.events };
    case "SET_VIEW":
      return { ...state, view: action.view };
    case "OPEN_CREATE":
      return { ...state, view: "form", editingId: null, form: emptyForm(), errorMsg: "" };
    case "OPEN_EDIT":
      return { ...state, view: "form", editingId: action.event.id, form: eventToForm(action.event), errorMsg: "" };
    case "OPEN_SUBMISSIONS":
      return { ...state, view: "submissions", selectedEvent: action.event, registrations: [], regsLoading: true };
    case "REGS_LOADED":
      return { ...state, registrations: action.regs, regsLoading: false };
    case "SET_FORM_FIELD":
      return { ...state, form: { ...state.form, [action.key]: action.value } };
    case "ADD_FIELD":
      return { ...state, form: { ...state.form, fields: [...state.form.fields, makeField()] } };
    case "UPDATE_FIELD": {
      const fields = state.form.fields.map((f, i) =>
        i === action.index ? { ...f, [action.key]: action.value } : f
      );
      return { ...state, form: { ...state.form, fields } };
    }
    case "REMOVE_FIELD": {
      const fields = state.form.fields.filter((_, i) => i !== action.index);
      return { ...state, form: { ...state.form, fields } };
    }
    case "MOVE_FIELD": {
      const fields = [...state.form.fields];
      const target = action.index + action.dir;
      if (target < 0 || target >= fields.length) return state;
      [fields[action.index], fields[target]] = [fields[target], fields[action.index]];
      return { ...state, form: { ...state.form, fields } };
    }
    case "SET_OPTION_INPUT":
      return { ...state, optionInputs: { ...state.optionInputs, [action.fieldId]: action.value } };
    case "ADD_OPTION": {
      const val = (state.optionInputs[action.fieldId] ?? "").trim();
      if (!val) return state;
      const fields = state.form.fields.map((f) =>
        f.id === action.fieldId
          ? { ...f, options: [...(f.options ?? []), val] }
          : f
      );
      return {
        ...state,
        form: { ...state.form, fields },
        optionInputs: { ...state.optionInputs, [action.fieldId]: "" },
      };
    }
    case "REMOVE_OPTION": {
      const fields = state.form.fields.map((f) =>
        f.id === action.fieldId
          ? { ...f, options: f.options?.filter((o) => o !== action.opt) }
          : f
      );
      return { ...state, form: { ...state.form, fields } };
    }
    case "SAVE_START":
      return { ...state, saving: true, errorMsg: "" };
    case "SAVE_DONE": {
      const exists = state.events.find((e) => e.id === action.event.id);
      const events = exists
        ? state.events.map((e) => (e.id === action.event.id ? action.event : e))
        : [...state.events, action.event];
      return { ...state, saving: false, events, view: "list" };
    }
    case "DELETE_DONE":
      return { ...state, events: state.events.filter((e) => e.id !== action.id) };
    case "SET_ERROR":
      return { ...state, saving: false, errorMsg: action.msg };
    default:
      return state;
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ManageEvents() {
  const [state, dispatch] = useReducer(reducer, {
    view: "list",
    events: [],
    loading: true,
    saving: false,
    errorMsg: "",
    editingId: null,
    form: emptyForm(),
    selectedEvent: null,
    registrations: [],
    regsLoading: false,
    optionInputs: {},
  });

  const imageFileRef = useRef<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminEvents()
      .then((events) => dispatch({ type: "LOADED", events }))
      .catch(() => dispatch({ type: "LOADED", events: [] }));
  }, []);

  useEffect(() => {
    if (state.view !== "submissions" || !state.selectedEvent) return;
    fetchRegistrations(state.selectedEvent.id)
      .then((regs) => dispatch({ type: "REGS_LOADED", regs }))
      .catch(() => dispatch({ type: "REGS_LOADED", regs: [] }));
  }, [state.view, state.selectedEvent]);

  const handleSave = useCallback(async () => {
    const f = state.form;
    if (!f.name.trim()) {
      dispatch({ type: "SET_ERROR", msg: "Event name is required." });
      return;
    }
    dispatch({ type: "SAVE_START" });
    const imageUrl = imageFileRef.current
      ? await uploadCompressedImage(imageFileRef.current, "events")
      : f.image || undefined;
    const payload = {
      name: f.name.trim(),
      address: f.address.trim() || undefined,
      startTime: toISO(f.startTime),
      endTime: toISO(f.endTime),
      description: f.description.trim() || undefined,
      image: imageUrl || undefined,
      price: f.price ? parseFloat(f.price) : null,
      teamSize: parseInt(f.teamSize, 10) || 1,
      published: f.published,
      fields: f.fields,
    };
    try {
      const saved = state.editingId
        ? await updateEvent(state.editingId, payload)
        : await createEvent(payload);
      imageFileRef.current = null;
      dispatch({ type: "SAVE_DONE", event: saved });
    } catch {
      dispatch({ type: "SET_ERROR", msg: "Failed to save event. Please try again." });
    }
  }, [state.form, state.editingId]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this event and all its registrations?")) return;
    try {
      await deleteEvent(id);
      dispatch({ type: "DELETE_DONE", id });
    } catch {
      alert("Failed to delete event.");
    }
  }, []);

  if (state.view === "form") {
    return (
      <EventForm
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

  if (state.view === "submissions") {
    return (
      <SubmissionsView
        event={state.selectedEvent!}
        registrations={state.registrations}
        loading={state.regsLoading}
        onBack={() => dispatch({ type: "SET_VIEW", view: "list" })}
      />
    );
  }

  // List view
  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold">Events</h2>
        <button
          onClick={() => {
            imageFileRef.current = null;
            setImagePreview(null);
            dispatch({ type: "OPEN_CREATE" });
          }}
          className="px-4 py-2 bg-[#5E0009] text-white rounded hover:bg-[#7a0010] text-sm font-semibold"
        >
          + New Event
        </button>
      </div>

      {state.loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : state.events.length === 0 ? (
        <p className="text-gray-400 text-center py-10">No events yet. Create one above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Start</th>
                <th className="py-2 pr-4 font-medium">Price</th>
                <th className="py-2 pr-4 font-medium">Teams</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Signups</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {state.events.map((event) => (
                <tr key={event.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium">{event.name}</td>
                  <td className="py-2 pr-4 text-gray-600">
                    {event.startTime
                      ? new Date(event.startTime).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">
                    {event.price ? `$${Number(event.price).toFixed(2)}` : "Free"}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">
                    {event.teamSize > 1 ? `${event.teamSize}-person` : "Individual"}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        event.published
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {event.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{event.registrationCount ?? 0}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => dispatch({ type: "OPEN_SUBMISSIONS", event })}
                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 font-medium"
                      >
                        Submissions
                      </button>
                      <button
                        onClick={() => {
                          imageFileRef.current = null;
                          setImagePreview(event.image || null);
                          dispatch({ type: "OPEN_EDIT", event });
                        }}
                        className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
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

// ─── Event form ────────────────────────────────────────────────────────────────

function EventForm({
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
  const mapsPreview = f.address.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address.trim())}`
    : null;

  const input = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]";

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
          Back
        </button>
        <h2 className="text-xl font-bold">{state.editingId ? "Edit Event" : "New Event"}</h2>
      </div>

      <div className="space-y-4 max-w-2xl">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
          <input
            className={input}
            value={f.name}
            onChange={(e) => dispatch({ type: "SET_FORM_FIELD", key: "name", value: e.target.value })}
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address / Location</label>
          <input
            className={input}
            value={f.address}
            placeholder="Missouri State University, Springfield, MO"
            onChange={(e) => dispatch({ type: "SET_FORM_FIELD", key: "address", value: e.target.value })}
          />
          {mapsPreview && (
            <a
              href={mapsPreview}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 underline mt-1 inline-block"
            >
              Preview on Google Maps →
            </a>
          )}
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
            <input
              type="datetime-local"
              className={input}
              value={f.startTime}
              onChange={(e) => dispatch({ type: "SET_FORM_FIELD", key: "startTime", value: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
            <input
              type="datetime-local"
              className={input}
              value={f.endTime}
              onChange={(e) => dispatch({ type: "SET_FORM_FIELD", key: "endTime", value: e.target.value })}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={3}
            className={input}
            value={f.description}
            onChange={(e) => dispatch({ type: "SET_FORM_FIELD", key: "description", value: e.target.value })}
          />
        </div>

        {/* Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event Image</label>
          <input
            type="file"
            accept="image/*"
            className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              const preview = file ? URL.createObjectURL(file) : (state.form.image || null);
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
                  dispatch({ type: "SET_FORM_FIELD", key: "image", value: "" });
                }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Price + Team size */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price ($ per person)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={input}
              placeholder="Leave blank for free"
              value={f.price}
              onChange={(e) => dispatch({ type: "SET_FORM_FIELD", key: "price", value: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Size</label>
            <input
              type="number"
              min="1"
              className={input}
              value={f.teamSize}
              onChange={(e) => dispatch({ type: "SET_FORM_FIELD", key: "teamSize", value: e.target.value })}
            />
            <p className="text-xs text-gray-400 mt-0.5">1 = individual event</p>
          </div>
        </div>

        {/* Published */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={f.published}
            onChange={(e) => dispatch({ type: "SET_FORM_FIELD", key: "published", value: e.target.checked })}
            className="w-4 h-4 accent-[#5E0009]"
          />
          <span className="text-sm font-medium text-gray-700">Published (visible to public)</span>
        </label>

        {/* Field Builder */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Form Fields
            </label>
            <button
              onClick={() => dispatch({ type: "ADD_FIELD" })}
              className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded font-medium"
            >
              + Add Field
            </button>
          </div>

          {f.fields.length === 0 && (
            <p className="text-xs text-gray-400 italic">No custom fields yet.</p>
          )}

          <div className="space-y-3">
            {f.fields.map((field, i) => (
              <FieldEditor
                key={field.id}
                field={field}
                index={i}
                total={f.fields.length}
                optionInput={state.optionInputs[field.id] ?? ""}
                dispatch={dispatch}
              />
            ))}
          </div>
        </div>

        {/* Error */}
        {state.errorMsg && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
            {state.errorMsg}
          </div>
        )}

        {/* Save */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onSave}
            disabled={state.saving}
            className="px-5 py-2 bg-[#5E0009] text-white rounded hover:bg-[#7a0010] text-sm font-semibold disabled:opacity-50"
          >
            {state.saving ? "Saving..." : "Save Event"}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Field editor row ─────────────────────────────────────────────────────────

function FieldEditor({
  field,
  index,
  total,
  optionInput,
  dispatch,
}: {
  field: ApiEventField;
  index: number;
  total: number;
  optionInput: string;
  dispatch: React.Dispatch<Action>;
}) {
  const smallInput = "border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E0009]";

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-2 flex-wrap">
        {/* Move buttons */}
        <div className="flex flex-col gap-0.5 mt-1">
          <button
            disabled={index === 0}
            onClick={() => dispatch({ type: "MOVE_FIELD", index, dir: -1 })}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none"
            title="Move up"
          >
            ▲
          </button>
          <button
            disabled={index === total - 1}
            onClick={() => dispatch({ type: "MOVE_FIELD", index, dir: 1 })}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none"
            title="Move down"
          >
            ▼
          </button>
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <input
            className={`${smallInput} w-full`}
            placeholder="Field label"
            value={field.label}
            onChange={(e) => dispatch({ type: "UPDATE_FIELD", index, key: "label", value: e.target.value })}
          />
        </div>

        {/* Type */}
        <select
          className={smallInput}
          value={field.type}
          onChange={(e) =>
            dispatch({ type: "UPDATE_FIELD", index, key: "type", value: e.target.value as EventFieldType })
          }
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="select">Dropdown</option>
          <option value="checkbox">Checkbox</option>
        </select>

        {/* Required */}
        <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => dispatch({ type: "UPDATE_FIELD", index, key: "required", value: e.target.checked })}
            className="accent-[#5E0009]"
          />
          Required
        </label>

        {/* Delete */}
        <button
          onClick={() => dispatch({ type: "REMOVE_FIELD", index })}
          className="text-red-400 hover:text-red-600 text-xs font-medium"
        >
          ✕
        </button>
      </div>

      {/* Options editor for select fields */}
      {field.type === "select" && (
        <div className="pl-6">
          <p className="text-xs text-gray-500 mb-1">Options:</p>
          <div className="flex flex-wrap gap-1 mb-1">
            {(field.options ?? []).map((opt) => (
              <span
                key={opt}
                className="flex items-center gap-1 text-xs bg-white border border-gray-300 rounded px-2 py-0.5"
              >
                {opt}
                <button
                  onClick={() => dispatch({ type: "REMOVE_OPTION", fieldId: field.id, opt })}
                  className="text-red-400 hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              className={`${smallInput} flex-1`}
              placeholder="Add option..."
              value={optionInput}
              onChange={(e) => dispatch({ type: "SET_OPTION_INPUT", fieldId: field.id, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  dispatch({ type: "ADD_OPTION", fieldId: field.id });
                }
              }}
            />
            <button
              onClick={() => dispatch({ type: "ADD_OPTION", fieldId: field.id })}
              className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Submissions view ─────────────────────────────────────────────────────────

function SubmissionsView({
  event,
  registrations,
  loading,
  onBack,
}: {
  event: ApiEvent;
  registrations: ApiEventRegistration[];
  loading: boolean;
  onBack: () => void;
}) {
  const isTeam = event.teamSize > 1;

  // Parse formData from JSON string if needed
  const parsed = useMemo(
    () =>
      registrations.map((r) => ({
        ...r,
        formData:
          typeof r.formData === "string"
            ? (() => { try { return JSON.parse(r.formData as unknown as string); } catch { return {}; } })()
            : (r.formData ?? {}),
      })),
    [registrations]
  );

  // Group by teamId for team events
  const grouped = useMemo(() => {
    if (!isTeam) return null;
    const map = new Map<string, ApiEventRegistration[]>();
    const solo: ApiEventRegistration[] = [];
    for (const r of parsed) {
      if (r.teamId) {
        const list = map.get(r.teamId) ?? [];
        list.push(r);
        map.set(r.teamId, list);
      } else {
        solo.push(r);
      }
    }
    return { map, solo };
  }, [parsed, isTeam]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
          Back to events
        </button>
        <div>
          <h2 className="text-xl font-bold">{event.name}</h2>
          <p className="text-sm text-gray-400">Submission audit — {registrations.length} registrations</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : registrations.length === 0 ? (
        <p className="text-gray-400 text-center py-10">No registrations yet.</p>
      ) : isTeam && grouped ? (
        // Team grouped view
        <div className="space-y-4">
          {Array.from(grouped.map.entries()).map(([teamId, members]) => {
            const complete = members[0]?.teamComplete === true;
            return (
              <div key={teamId} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className={`flex items-center gap-3 px-4 py-2 text-sm font-medium ${complete ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                  <span>{complete ? "✓ Team Complete" : "⏳ Incomplete"}</span>
                  <span className="text-xs font-normal text-gray-400 ml-auto">Team ID: {teamId.slice(0, 8)}…</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {members.map((r) => (
                    <RegistrationRow key={r.id} reg={r} fields={event.fields} />
                  ))}
                </div>
              </div>
            );
          })}
          {grouped.solo.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Unlinked / solo registrations:</p>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {grouped.solo.map((r) => (
                  <RegistrationRow key={r.id} reg={r} fields={event.fields} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // Individual view
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {parsed.map((r) => (
            <RegistrationRow key={r.id} reg={r} fields={event.fields} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single registration row ──────────────────────────────────────────────────

function RegistrationRow({
  reg,
  fields,
}: {
  reg: ApiEventRegistration;
  fields: ApiEventField[];
}) {
  const formData = (typeof reg.formData === "string"
    ? (() => { try { return JSON.parse(reg.formData as unknown as string); } catch { return {}; } })()
    : reg.formData) as Record<string, unknown>;

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap justify-between items-start gap-2">
        <div>
          <p className="font-medium text-sm">{reg.payerName || "—"}</p>
          <p className="text-xs text-gray-500">{reg.payerEmail || "—"}</p>
          {reg.teammateEmails && reg.teammateEmails.length > 0 && (
            <p className="text-xs text-gray-400">
              Teammate{reg.teammateEmails.length > 1 ? "s" : ""}: {reg.teammateEmails.join(", ")}
            </p>
          )}
        </div>
        <div className="text-right text-xs text-gray-500">
          <span
            className={`px-2 py-0.5 rounded-full font-medium ${
              reg.paid ? "bg-green-100 text-green-700" : "bg-red-50 text-red-500"
            }`}
          >
            {reg.paid ? `Paid $${Number(reg.amountPaid ?? 0).toFixed(2)}` : "Unpaid"}
          </span>
          {reg.createdAt && (
            <p className="mt-1">{new Date(reg.createdAt).toLocaleDateString()}</p>
          )}
        </div>
      </div>

      {/* Form data key-value */}
      {fields.length > 0 && Object.keys(formData).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {fields.map((f) => {
            const val = formData[f.id];
            if (val === undefined || val === null || val === "") return null;
            return (
              <span key={f.id} className="text-xs text-gray-600">
                <span className="font-medium">{f.label}:</span>{" "}
                {f.type === "checkbox" ? (val ? "Yes" : "No") : String(val)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
