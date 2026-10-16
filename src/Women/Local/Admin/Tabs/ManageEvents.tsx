import { ChevronUp, ChevronDown, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
} from "react";
import toast from "react-hot-toast";

import EventPosItemsModal from "./EventPosItemsModal";
import { useConfirm } from "../../../../Global/Common/components/ConfirmModal";
import { uploadCompressedImage } from "../../../../Global/Common/hooks/uploadHelper";
import {
  createEvent,
  deleteEvent,
  fetchAdminEvents,
  fetchRegistrations,
  pairEventTeam,
  updateEvent,
  sendTeamReminder,
} from "../../../../Global/Common/hooks/useEvents";
import { safeImageSrc } from "../../../../Global/Common/utils/safeUrl";
import {
  extractTeamNameLabel,
  getRegistrationTeamName,
} from "../../../../Global/Common/utils/teamNameHelpers";
import { apiRequest } from "../../../../Services/API";
import type {
  ApiEvent,
  ApiEventField,
  ApiEventRegistration,
  EventFieldType,
  Program,
} from "../../../../types/api";

// Field builder helpers

function makeField(): ApiEventField {
  return { id: crypto.randomUUID(), label: "", type: "text", required: false };
}

// State

type View = "list" | "form" | "submissions";

type FormState = {
  name: string;
  address: string;
  startTime: string;
  endTime: string;
  description: string;
  price: string;
  acceptsCash: boolean;
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
    acceptsCash: false,
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
    acceptsCash: e.acceptsCash ?? false,
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

// Component

export default function ManageEvents() {
  const confirm = useConfirm();
  const program: Program = "women";
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
  const [posItemsEvent, setPosItemsEvent] = useState<ApiEvent | null>(null);
  const [qrEvent, setQrEvent] = useState<ApiEvent | null>(null);

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
      acceptsCash: f.acceptsCash,
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
    if (!await confirm("Delete this event and all its registrations?")) return;
    try {
      await deleteEvent(id);
      dispatch({ type: "DELETE_DONE", id });
    } catch {
      toast.error("Failed to delete event.");
    }
  }, [confirm]);

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
          program={program}
          dispatch={dispatch}
        />
    );
  }

  // List view
  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-bold text-gray-900">Events</h2>
        <button
          onClick={() => {
            imageFileRef.current = null;
            setImagePreview(null);
            dispatch({ type: "OPEN_CREATE" });
          }}
          className="px-4 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0012] text-sm font-semibold"
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
                      : " - "}
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
                          ? "bg-gray-100 text-gray-700"
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
                        className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 font-medium"
                      >
                        Submissions
                      </button>
                      <button
                        onClick={() => setPosItemsEvent(event)}
                        className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
                      >
                        POS Items
                      </button>
                      <button
                        onClick={() => setQrEvent(event)}
                        className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
                      >
                        QR Code
                      </button>
                      <button
                        onClick={() => {
                          imageFileRef.current = null;
                          setImagePreview(event.image || null);
                          dispatch({ type: "OPEN_EDIT", event });
                        }}
                        className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
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
      {posItemsEvent && (
        <EventPosItemsModal
          eventId={posItemsEvent.id}
          eventName={posItemsEvent.name}
          onClose={() => setPosItemsEvent(null)}
        />
      )}
      {qrEvent && (
        <QrCodeModal event={qrEvent} program={program} onClose={() => setQrEvent(null)} />
      )}
    </div>
  );
}

function QrCodeModal({ event, program, onClose }: { event: ApiEvent; program: Program; onClose: () => void }) {
  const base = program === "women" ? `${window.location.origin}/women` : window.location.origin;
  const url = `${base}/checkin/${event.id}`;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
        <h3 className="text-base font-semibold text-gray-900 mb-1">{event.name}</h3>
        <p className="text-xs text-gray-400 mb-4">Scan to check in and pay</p>
        <div className="flex justify-center mb-4">
          <QRCodeSVG value={url} size={220} />
        </div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600 bg-gray-50"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(url);
              toast.success("Link copied");
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
          >
            Copy
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}

type UnmatchedCandidate = {
  name: string;
  mentionedBy: string[];
  suggestedEmail?: string;
  suggestedPhone?: string;
  matchedFrom?: string;
};

function UnmatchedTeammatesModal({
  eventId,
  program,
  onClose,
  onCreated,
}: {
  eventId: string;
  program: Program;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<UnmatchedCandidate[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiRequest<UnmatchedCandidate[]>(`/api/events/${eventId}/unmatched-teammates?program=${program}`)
      .then((list) => {
        setCandidates(list);
        setChecked(Object.fromEntries(list.map((c) => [c.name, true])));
        setEmails(Object.fromEntries(list.map((c) => [c.name, c.suggestedEmail ?? ""])));
      })
      .catch(() => toast.error("Failed to scan for unregistered teammates."))
      .finally(() => setLoading(false));
  }, [eventId, program]);

  const handleCreate = async () => {
    const entries = candidates
      .filter((c) => checked[c.name])
      .map((c) => ({ name: c.name, email: emails[c.name]?.trim() || undefined }));
    if (entries.length === 0) {
      toast.error("Select at least one person first.");
      return;
    }
    setCreating(true);
    try {
      await apiRequest(`/api/events/${eventId}/unmatched-teammates?program=${program}`, {
        method: "POST",
        json: { entries },
      });
      toast.success(`Added ${entries.length} unpaid registration${entries.length === 1 ? "" : "s"}.`);
      onCreated();
      onClose();
    } catch {
      toast.error("Failed to add registrations.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Unregistered Teammates</h3>
        <p className="text-xs text-gray-400 mb-4">
          People named as teammates who never submitted their own registration. Checked people will get
          an unpaid registration created for them, so they show up in the Tap to Pay app and QR check-in.
        </p>

        {loading ? (
          <p className="text-sm text-gray-400 py-6 text-center">Scanning...</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No unregistered teammates found.</p>
        ) : (
          <div className="space-y-3 mb-4">
            {candidates.map((c) => (
              <div key={c.name} className="flex items-start gap-3 border border-gray-100 rounded-lg p-3">
                <input
                  type="checkbox"
                  checked={checked[c.name] ?? false}
                  onChange={(e) => setChecked((prev) => ({ ...prev, [c.name]: e.target.checked }))}
                  className="w-4 h-4 accent-[#5E0009] mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                  <p className="text-xs text-gray-400">Mentioned by: {c.mentionedBy.join(", ")}</p>
                  {c.matchedFrom && (
                    <p className="text-xs text-gray-400">
                      Found contact info from {c.matchedFrom}{c.suggestedPhone ? ` (${c.suggestedPhone})` : ""}
                    </p>
                  )}
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={emails[c.name] ?? ""}
                    onChange={(e) => setEmails((prev) => ({ ...prev, [c.name]: e.target.value }))}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          {candidates.length > 0 && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 bg-[#5E0009] text-white rounded-lg text-sm font-semibold hover:bg-[#7a0012] transition disabled:opacity-60"
            >
              {creating ? "Adding..." : "Add Selected"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Event form

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

  const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]";

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
          Back
        </button>
        <h2 className="text-lg font-bold text-gray-900">{state.editingId ? "Edit Event" : "New Event"}</h2>
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
              Preview on Google Maps -&gt;
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
            className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              const preview = file ? URL.createObjectURL(file) : (state.form.image || null);
              onImageChange(file, preview);
            }}
          />
          {imagePreview && (
            <div className="mt-2 flex items-center gap-3">
              <img src={safeImageSrc(imagePreview)} alt="Preview" className="h-20 w-32 object-cover rounded-lg border border-gray-200" />
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

        {/* Accept Cash */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={f.acceptsCash}
            onChange={(e) => dispatch({ type: "SET_FORM_FIELD", key: "acceptsCash", value: e.target.checked })}
            className="w-4 h-4 accent-[#5E0009]"
          />
          <span className="text-sm font-medium text-gray-700">Accept Cash (Tap to Pay app)</span>
        </label>
        <p className="text-xs text-gray-400 -mt-2 ml-6">
          Lets the register app offer "Paid in Cash" as an option for this event, alongside
          card payment.
        </p>

        {/* Field Builder */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Form Fields
            </label>
            <button
              onClick={() => dispatch({ type: "ADD_FIELD" })}
              className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
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
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {state.errorMsg}
          </div>
        )}

        {/* Save */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onSave}
            disabled={state.saving}
            className="px-5 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0012] text-sm font-semibold disabled:opacity-50"
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

// Field editor row

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
  const smallInput = "border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#5E0009]";

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
            <ChevronUp size={12} />
          </button>
          <button
            disabled={index === total - 1}
            onClick={() => dispatch({ type: "MOVE_FIELD", index, dir: 1 })}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none"
            title="Move down"
          >
            <ChevronDown size={12} />
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
          <X size={16} />
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
                className="flex items-center gap-1 text-xs bg-white border border-gray-300 rounded-lg px-2 py-0.5"
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
              className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Submissions view

function SubmissionsView({
  event,
  registrations,
  loading,
  onBack,
  program,
  dispatch,
}: {
  event: ApiEvent;
  registrations: ApiEventRegistration[];
  loading: boolean;
  onBack: () => void;
  program: Program;
  dispatch: Dispatch<Action>;
}) {
  const isTeam = event.teamSize > 1;
  const confirm = useConfirm();
  const [sendingReminders, setSendingReminders] = useState<Record<string, boolean>>({});
  const [pairingTeams, setPairingTeams] = useState<Record<string, boolean>>({});
  const [pairNameInputs, setPairNameInputs] = useState<Record<string, string>>({});

  const handleReminder = useCallback(
    async (teamId: string) => {
      setSendingReminders((prev) => ({ ...prev, [teamId]: true }));
      try {
        const { sentEmails } = await sendTeamReminder(event.id, teamId, program);
        toast.success(
          `Reminder sent to ${sentEmails} teammate${sentEmails === 1 ? "" : "s"}.`
        );
      } catch {
        toast.error("Failed to send reminder to teammates.");
      } finally {
        setSendingReminders((prev) => ({ ...prev, [teamId]: false }));
      }
    },
    [event.id, program]
  );
  const reloadRegistrations = useCallback(() => {
    fetchRegistrations(event.id)
      .then((regs) => dispatch({ type: "REGS_LOADED", regs }))
      .catch(() => dispatch({ type: "REGS_LOADED", regs: [] }));
  }, [dispatch, event.id]);

  const handlePairTeam = useCallback(
    async (teamId: string, members: ApiEventRegistration[]) => {
      const name = (pairNameInputs[teamId] ?? "").trim();
      if (!name) {
        toast.error("Enter a team name before pairing.");
        return;
      }
      setPairingTeams((prev) => ({ ...prev, [teamId]: true }));
      try {
        await pairEventTeam(
          event.id,
          members.map((r) => r.id),
          name
        );
        setPairNameInputs((prev) => ({ ...prev, [teamId]: name }));
        toast.success("Team paired successfully.");
        reloadRegistrations();
      } catch {
        toast.error("Failed to pair the team.");
      } finally {
        setPairingTeams((prev) => ({ ...prev, [teamId]: false }));
      }
    },
    [event.id, pairNameInputs, reloadRegistrations]
  );
  const teamNameFieldId = useMemo(() => {
    const match = event.fields.find((field) =>
      field.label?.toLowerCase().includes("team name")
    );
    return match?.id ?? null;
  }, [event.fields]);

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
    const nameToKey = new Map<string, string>();
    for (const r of parsed) {
      const teamNameKey = getRegistrationTeamName(r, teamNameFieldId);
      let bucketKey: string | null = null;

      if (teamNameKey && nameToKey.has(teamNameKey)) {
        bucketKey = nameToKey.get(teamNameKey)!;
      } else if (r.teamId) {
        bucketKey = r.teamId;
      } else if (teamNameKey) {
        bucketKey = `name:${teamNameKey}`;
      }

      if (bucketKey && teamNameKey && !nameToKey.has(teamNameKey)) {
        nameToKey.set(teamNameKey, bucketKey);
      }

      if (bucketKey) {
        const list = map.get(bucketKey) ?? [];
        list.push(r);
        map.set(bucketKey, list);
      } else {
        solo.push(r);
      }
    }
    return { map, solo };
  }, [parsed, isTeam, teamNameFieldId]);

  const [creatingGroup, setCreatingGroup] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const unpaidCount = registrations.filter((r) => !r.paid && r.payerEmail).length;

  const handleCreateEmailGroup = async () => {
    const emails = Array.from(
      new Set(registrations.map((r) => r.payerEmail).filter(Boolean).map((e) => e!.trim().toLowerCase()))
    );
    if (emails.length === 0) {
      toast.error("No registrant emails to add.");
      return;
    }
    setCreatingGroup(true);
    try {
      const group = await apiRequest<{ name: string }>("/api/groups", {
        method: "POST",
        json: { name: `Event: ${event.name}`, members: emails },
      });
      toast.success(`Created group "${group.name}" with ${emails.length} emails - find it in Email Center.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create group.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleInvoiceUnpaid = async () => {
    if (!(await confirm(`Send a Stripe invoice to all ${unpaidCount} unpaid registrant(s)?`))) return;
    setInvoicing(true);
    try {
      const result = await apiRequest<{ invoicesSent: number; failures: string[] }>(
        `/api/events/${event.id}/invoice-unpaid`,
        { method: "POST" }
      );
      toast.success(`Sent ${result.invoicesSent} invoice(s).${result.failures.length ? ` ${result.failures.length} failed.` : ""}`);
      if (result.failures.length) console.error("Invoice failures:", result.failures);
    } catch (err) {
      console.error(err);
      toast.error("Failed to send invoices.");
    } finally {
      setInvoicing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
          Back to events
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{event.name}</h2>
          <p className="text-sm text-gray-400">Submission audit - {registrations.length} registrations</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleCreateEmailGroup}
            disabled={creatingGroup}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 font-medium disabled:opacity-50"
          >
            {creatingGroup ? "Creating..." : "Create Email Group"}
          </button>
          <button
            onClick={handleInvoiceUnpaid}
            disabled={invoicing || unpaidCount === 0}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium disabled:opacity-50"
          >
            {invoicing ? "Sending..." : `Invoice Unpaid (${unpaidCount})`}
          </button>
          <button
            onClick={() => setShowUnmatched(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
          >
            Find Unregistered Teammates
          </button>
        </div>
      </div>

      {showUnmatched && (
        <UnmatchedTeammatesModal
          eventId={event.id}
          program={program}
          onClose={() => setShowUnmatched(false)}
          onCreated={reloadRegistrations}
        />
      )}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : registrations.length === 0 ? (
        <p className="text-gray-400 text-center py-10">No registrations yet.</p>
      ) : isTeam && grouped ? (
        // Team grouped view
        <div className="space-y-4">
          {Array.from(grouped.map.entries()).map(([teamId, members]) => {
            const completeFromApi = members[0]?.teamComplete === true;
            const completeByCount =
              members.length >= event.teamSize && members.every((m) => m.paid);
            const complete = completeFromApi || completeByCount;
            const displayTeamId = teamId.startsWith("name:") ? null : teamId;
            const registered = new Set<string>();
            const pending = new Set<string>();
            for (const member of members) {
              if (member.payerEmail) {
                registered.add(member.payerEmail.trim().toLowerCase());
              }
              (member.teammateEmails ?? []).forEach((email) => {
                if (!email) return;
                const trimmed = email.trim();
                if (!trimmed) return;
                pending.add(trimmed);
              });
            }
            const teamLabel = extractTeamNameLabel(members, teamNameFieldId);
            const primaryRegistrant =
              members[0]?.payerName?.trim() ||
              members[0]?.payerEmail?.trim() ||
              null;
            const toRemind = Array.from(pending).filter(
              (email) => !registered.has(email.toLowerCase())
            );
            const pendingCount = toRemind.length;
            const pendingText =
              pendingCount > 0
                ? `${pendingCount} teammate${pendingCount > 1 ? "s" : ""} pending`
                : !complete && members.length < event.teamSize
                  ? "Team incomplete (no teammate emails)"
                  : "All teammates registered";
            const isSending = sendingReminders[teamId] ?? false;
            return (
              <div key={teamId} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className={`flex items-center gap-3 px-4 py-2 text-sm font-medium ${complete ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                  <div className="flex flex-col gap-0.5">
                    <span>{complete ? "Team Complete" : "Incomplete"}</span>
                    {teamLabel && (
                      <span className="text-xs font-normal text-gray-500">Team: {teamLabel}</span>
                    )}
                    {primaryRegistrant && (
                      <span className="text-xs font-normal text-gray-500">Lead: {primaryRegistrant}</span>
                    )}
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        className="text-xs px-2 py-1 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#5E0009]"
                        placeholder="Pair team name"
                        value={pairNameInputs[teamId] ?? teamLabel ?? ""}
                        onChange={(e) =>
                          setPairNameInputs((prev) => ({ ...prev, [teamId]: e.target.value }))
                        }
                      />
                      <button
                        onClick={() => handlePairTeam(teamId, members)}
                        disabled={pairingTeams[teamId]}
                        className="text-xs px-2 py-1 rounded-lg border border-[#5E0009] text-[#5E0009] font-medium disabled:opacity-50"
                      >
                        {pairingTeams[teamId] ? "Pairing…" : "Pair team"}
                      </button>
                    </div>
                  </div>
                {displayTeamId && (
                  <div className="ml-auto flex items-center gap-3">
                      <span className="text-xs font-normal text-gray-400">
                        Team ID: {displayTeamId.slice(0, 8)}…
                      </span>
                      <span className="text-xs text-gray-500">{pendingText}</span>
                      <button
                        onClick={() => handleReminder(teamId)}
                        disabled={pendingCount === 0 || isSending}
                        className="text-xs px-2 py-1 rounded-lg border border-[#5E0009] text-[#5E0009] font-medium disabled:opacity-50"
                      >
                        {isSending ? "Sending…" : "Remind teammates"}
                      </button>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-gray-100">
                  {members.map((r) => (
                    <RegistrationRow key={r.id} reg={r} fields={event.fields} eventId={event.id} program={program} onChanged={reloadRegistrations} />
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
                  <RegistrationRow key={r.id} reg={r} fields={event.fields} eventId={event.id} program={program} onChanged={reloadRegistrations} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // Individual view
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {parsed.map((r) => (
            <RegistrationRow key={r.id} reg={r} fields={event.fields} eventId={event.id} program={program} onChanged={reloadRegistrations} />
          ))}
        </div>
      )}
    </div>
  );
}

// Single registration row

function RegistrationRow({
  reg,
  fields,
  eventId,
  program,
  onChanged,
}: {
  reg: ApiEventRegistration;
  fields: ApiEventField[];
  eventId?: string;
  program?: Program;
  onChanged?: () => void;
}) {
  const [marking, setMarking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState(false);
  const confirm = useConfirm();
  const formData = (typeof reg.formData === "string"
    ? (() => { try { return JSON.parse(reg.formData as unknown as string); } catch { return {}; } })()
    : reg.formData) as Record<string, unknown>;

  const handleMarkPaid = async () => {
    if (!eventId) return;
    setMarking(true);
    try {
      await apiRequest(`/api/events/${eventId}/registrations/${reg.id}/mark-paid?program=${program ?? "men"}`, {
        method: "PUT",
      });
      toast.success("Marked as paid.");
      onChanged?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to mark as paid.");
    } finally {
      setMarking(false);
    }
  };

  const handleRemove = async () => {
    if (!eventId) return;
    if (!(await confirm(`Remove ${reg.payerName || reg.payerEmail || "this registrant"} from this event?`))) return;
    setRemoving(true);
    try {
      await apiRequest(`/api/events/${eventId}/registrations/${reg.id}?program=${program ?? "men"}`, {
        method: "DELETE",
      });
      toast.success("Removed.");
      onChanged?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove registrant.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap justify-between items-start gap-2">
        <div>
          <p className="font-medium text-sm">{reg.payerName || " - "}</p>
          <p className="text-xs text-gray-500">{reg.payerEmail || " - "}</p>
          {reg.teammateEmails && reg.teammateEmails.length > 0 && (
            <p className="text-xs text-gray-400">
              Teammate{reg.teammateEmails.length > 1 ? "s" : ""}: {reg.teammateEmails.join(", ")}
            </p>
          )}
        </div>
        <div className="text-right text-xs text-gray-500">
          <span
            className={`px-2 py-0.5 rounded-full font-medium ${
              reg.paid ? "bg-gray-100 text-gray-700" : "bg-gray-50 text-gray-500"
            }`}
          >
            {reg.paid ? `Paid $${Number(reg.amountPaid ?? 0).toFixed(2)}` : "Unpaid"}
          </span>
          {!reg.paid && eventId && (
            <button
              onClick={handleMarkPaid}
              disabled={marking}
              className="block mt-1 ml-auto text-xs text-gray-600 hover:text-gray-900 hover:underline disabled:opacity-50"
            >
              {marking ? "Marking..." : "Mark Paid"}
            </button>
          )}
          {eventId && (
            <button
              onClick={() => setEditing(true)}
              className="block mt-1 ml-auto text-xs text-gray-600 hover:text-gray-900 hover:underline"
            >
              Edit
            </button>
          )}
          {eventId && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="block mt-1 ml-auto text-xs text-gray-500 hover:text-gray-800 hover:underline disabled:opacity-50"
            >
              {removing ? "Removing..." : "Remove"}
            </button>
          )}
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
      {editing && eventId && (
        <EditRegistrationModal
          reg={reg}
          fields={fields}
          eventId={eventId}
          program={program}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onChanged?.(); }}
        />
      )}
    </div>
  );
}

function EditRegistrationModal({
  reg,
  fields,
  eventId,
  program,
  onClose,
  onSaved,
}: {
  reg: ApiEventRegistration;
  fields: ApiEventField[];
  eventId: string;
  program?: Program;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialFormData = (typeof reg.formData === "string"
    ? (() => { try { return JSON.parse(reg.formData as unknown as string); } catch { return {}; } })()
    : reg.formData) as Record<string, unknown>;

  const [name, setName] = useState(reg.payerName ?? "");
  const [email, setEmail] = useState(reg.payerEmail ?? "");
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>(
    Object.fromEntries(fields.map((f) => [f.id, (initialFormData[f.id] as string | boolean) ?? (f.type === "checkbox" ? false : "")]))
  );
  const [saving, setSaving] = useState(false);

  const [suggestions, setSuggestions] = useState<UnmatchedCandidate[] | null>(null);
  const [addingTeammates, setAddingTeammates] = useState(false);

  useEffect(() => {
    apiRequest<UnmatchedCandidate[]>(`/api/events/${eventId}/unmatched-teammates?program=${program ?? "men"}`)
      .then((all) => setSuggestions(all.filter((c) => reg.payerName && c.mentionedBy.includes(reg.payerName))))
      .catch(() => setSuggestions([]));
  }, [eventId, program, reg.payerName]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest(`/api/events/${eventId}/registrations/${reg.id}?program=${program ?? "men"}`, {
        method: "PUT",
        json: { payerName: name, payerEmail: email, formData: fieldValues },
      });
      toast.success("Saved.");
      onSaved();
    } catch {
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTeammates = async () => {
    if (!suggestions || suggestions.length === 0) return;
    setAddingTeammates(true);
    try {
      await apiRequest(`/api/events/${eventId}/unmatched-teammates?program=${program ?? "men"}`, {
        method: "POST",
        json: { entries: suggestions.map((c) => ({ name: c.name, email: c.suggestedEmail })) },
      });
      toast.success(`Added ${suggestions.length} teammate${suggestions.length === 1 ? "" : "s"}.`);
      setSuggestions([]);
    } catch {
      toast.error("Failed to add teammates.");
    } finally {
      setAddingTeammates(false);
    }
  };

  const input = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Edit Registrant</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </div>
          {fields.map((f) => (
            <div key={f.id}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
              {f.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={!!fieldValues[f.id]}
                  onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.id]: e.target.checked }))}
                  className="w-4 h-4 accent-[#5E0009]"
                />
              ) : (
                <input
                  value={String(fieldValues[f.id] ?? "")}
                  onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                  className={input}
                />
              )}
            </div>
          ))}
        </div>

        {suggestions && suggestions.length > 0 && (
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-700 mb-1">
              Teammates named by this person who haven't registered:
            </p>
            <p className="text-xs text-gray-500 mb-2">{suggestions.map((s) => s.name).join(", ")}</p>
            <button
              onClick={handleAddTeammates}
              disabled={addingTeammates}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 font-medium disabled:opacity-50"
            >
              {addingTeammates ? "Adding..." : `Add ${suggestions.length} as Unpaid Registrants`}
            </button>
          </div>
        )}

        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#5E0009] text-white rounded-lg text-sm font-semibold hover:bg-[#7a0012] transition disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
