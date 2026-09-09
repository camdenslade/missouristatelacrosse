import { useCallback, useEffect, useReducer, useState } from "react";
import toast from "react-hot-toast";

import { useConfirm } from "../../../../../Global/Common/components/ConfirmModal";
import {
  createPaymentCard,
  deletePaymentCard,
  fetchCardCompletions,
  fetchPaymentCards,
  setPlayerCardStatus,
  updatePaymentCard,
} from "../hooks/usePaymentCards";
import type { ApiPaymentCard, ApiPaymentCardCompletion } from "../../../../../types/api";

type View = "list" | "form";

type FormState = {
  title: string;
  description: string;
  link: string;
  amount: string;
  active: boolean;
};

function emptyForm(): FormState {
  return { title: "", description: "", link: "", amount: "", active: true };
}

function cardToForm(c: ApiPaymentCard): FormState {
  return {
    title: c.title ?? "",
    description: c.description ?? "",
    link: c.link ?? "",
    amount: c.amount != null ? String(c.amount) : "",
    active: c.active,
  };
}

type State = {
  view: View;
  cards: ApiPaymentCard[];
  loading: boolean;
  saving: boolean;
  errorMsg: string;
  editingId: string | null;
  form: FormState;
};

type Action =
  | { type: "LOADED"; cards: ApiPaymentCard[] }
  | { type: "SET_VIEW"; view: View }
  | { type: "OPEN_CREATE" }
  | { type: "OPEN_EDIT"; card: ApiPaymentCard }
  | { type: "SET_FORM"; key: keyof FormState; value: string | boolean }
  | { type: "SAVE_START" }
  | { type: "SAVE_DONE"; card: ApiPaymentCard }
  | { type: "DELETE_DONE"; id: string }
  | { type: "SET_ERROR"; msg: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOADED":
      return { ...state, loading: false, cards: action.cards };
    case "SET_VIEW":
      return { ...state, view: action.view };
    case "OPEN_CREATE":
      return { ...state, view: "form", editingId: null, form: emptyForm(), errorMsg: "" };
    case "OPEN_EDIT":
      return { ...state, view: "form", editingId: action.card.id, form: cardToForm(action.card), errorMsg: "" };
    case "SET_FORM":
      return { ...state, form: { ...state.form, [action.key]: action.value } };
    case "SAVE_START":
      return { ...state, saving: true, errorMsg: "" };
    case "SAVE_DONE": {
      const exists = state.cards.find((c) => c.id === action.card.id);
      const cards = exists
        ? state.cards.map((c) => (c.id === action.card.id ? action.card : c))
        : [...state.cards, action.card];
      return { ...state, saving: false, cards, view: "list" };
    }
    case "DELETE_DONE":
      return { ...state, cards: state.cards.filter((c) => c.id !== action.id) };
    case "SET_ERROR":
      return { ...state, saving: false, errorMsg: action.msg };
    default:
      return state;
  }
}

type ManagePaymentCardsProps = {
  season: string;
  availableSeasons?: string[];
};

export default function ManagePaymentCards({ season, availableSeasons = [] }: ManagePaymentCardsProps) {
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(reducer, {
    view: "list",
    cards: [],
    loading: true,
    saving: false,
    errorMsg: "",
    editingId: null,
    form: emptyForm(),
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completions, setCompletions] = useState<ApiPaymentCardCompletion[]>([]);
  const [completionsLoading, setCompletionsLoading] = useState(false);
  const [copySource, setCopySource] = useState("");
  const [copying, setCopying] = useState(false);

  const otherSeasons = availableSeasons.filter((s) => s !== season);

  useEffect(() => {
    dispatch({ type: "LOADED", cards: [] });
    fetchPaymentCards(season)
      .then((cards) => dispatch({ type: "LOADED", cards }))
      .catch(() => dispatch({ type: "LOADED", cards: [] }));
    setExpandedId(null);
  }, [season]);

  const handleSave = useCallback(async () => {
    const f = state.form;
    if (!f.title.trim()) {
      dispatch({ type: "SET_ERROR", msg: "Title is required." });
      return;
    }
    dispatch({ type: "SAVE_START" });
    try {
      const payload = {
        season,
        title: f.title.trim(),
        description: f.description.trim() || undefined,
        link: f.link.trim() || undefined,
        amount: f.amount.trim() ? parseFloat(f.amount) : null,
        active: f.active,
      };
      const saved = state.editingId
        ? await updatePaymentCard(state.editingId, payload)
        : await createPaymentCard(payload);
      dispatch({ type: "SAVE_DONE", card: saved });
    } catch {
      dispatch({ type: "SET_ERROR", msg: "Failed to save card. Please try again." });
    }
  }, [state.form, state.editingId, season]);

  const handleDelete = useCallback(async (id: string) => {
    if (!(await confirm("Delete this payment card? Players' completion status for it will be removed too."))) return;
    try {
      await deletePaymentCard(id);
      dispatch({ type: "DELETE_DONE", id });
      if (expandedId === id) setExpandedId(null);
    } catch {
      toast.error("Failed to delete card.");
    }
  }, [confirm, expandedId]);

  const handleToggleActive = useCallback(async (card: ApiPaymentCard) => {
    try {
      const updated = await updatePaymentCard(card.id, { active: !card.active });
      dispatch({ type: "SAVE_DONE", card: updated });
    } catch {
      toast.error("Failed to update card.");
    }
  }, []);

  const handleViewCompletions = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setCompletionsLoading(true);
    try {
      const data = await fetchCardCompletions(id);
      setCompletions(data);
    } catch {
      setCompletions([]);
      toast.error("Failed to load completion status.");
    } finally {
      setCompletionsLoading(false);
    }
  }, [expandedId]);

  const handleCopyFromSeason = useCallback(async () => {
    if (!copySource) return;
    setCopying(true);
    try {
      const sourceCards = await fetchPaymentCards(copySource);
      const created = await Promise.all(
        sourceCards.map((c) =>
          createPaymentCard({
            season,
            title: c.title,
            description: c.description ?? undefined,
            link: c.link ?? undefined,
            amount: c.amount ?? null,
            active: c.active,
          })
        )
      );
      dispatch({ type: "LOADED", cards: [...state.cards, ...created] });
      toast.success(`Copied ${created.length} card${created.length === 1 ? "" : "s"} from ${copySource}.`);
      setCopySource("");
    } catch {
      toast.error("Failed to copy cards.");
    } finally {
      setCopying(false);
    }
  }, [copySource, season, state.cards]);

  const handleToggleCompletion = useCallback(async (cardId: string, playerId: string, done: boolean) => {
    try {
      await setPlayerCardStatus(cardId, playerId, done);
      setCompletions((prev) =>
        prev.map((c) => (c.playerId === playerId ? { ...c, done, doneAt: done ? new Date().toISOString() : null } : c))
      );
    } catch {
      toast.error("Failed to update player's status.");
    }
  }, []);

  if (state.view === "form") {
    const f = state.form;
    const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]";
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => dispatch({ type: "SET_VIEW", view: "list" })} className="text-sm text-gray-500 hover:text-gray-700">
            Back
          </button>
          <h3 className="text-lg font-bold text-gray-900">{state.editingId ? "Edit Card" : "New Payment Card"}</h3>
        </div>

        <div className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              className={input}
              placeholder="e.g. US Lacrosse Membership"
              value={f.title}
              onChange={(e) => dispatch({ type: "SET_FORM", key: "title", value: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={3}
              className={input}
              value={f.description}
              onChange={(e) => dispatch({ type: "SET_FORM", key: "description", value: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link</label>
              <input
                type="text"
                className={input}
                placeholder="https://..."
                value={f.link}
                onChange={(e) => dispatch({ type: "SET_FORM", key: "link", value: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Amount ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={input}
                placeholder="Optional"
                value={f.amount}
                onChange={(e) => dispatch({ type: "SET_FORM", key: "amount", value: e.target.value })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={f.active}
              onChange={(e) => dispatch({ type: "SET_FORM", key: "active", value: e.target.checked })}
              className="w-4 h-4 accent-[#5E0009]"
            />
            <span className="text-sm font-medium text-gray-700">Active (visible to players in the Portal)</span>
          </label>

          {state.errorMsg && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.errorMsg}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={state.saving}
              className="px-5 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0012] text-sm font-semibold disabled:opacity-50"
            >
              {state.saving ? "Saving..." : "Save Card"}
            </button>
            <button onClick={() => dispatch({ type: "SET_VIEW", view: "list" })} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <h3 className="text-lg font-bold text-gray-900">Payment Cards</h3>
        <div className="flex flex-wrap items-center gap-2">
          {otherSeasons.length > 0 && (
            <>
              <select
                value={copySource}
                onChange={(e) => setCopySource(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
              >
                <option value="">Copy cards from...</option>
                {otherSeasons.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={handleCopyFromSeason}
                disabled={!copySource || copying}
                className="px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                {copying ? "Copying..." : "Copy"}
              </button>
            </>
          )}
          <button
            onClick={() => dispatch({ type: "OPEN_CREATE" })}
            className="px-4 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0012] text-sm font-semibold"
          >
            + New Card
          </button>
        </div>
      </div>

      {state.loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : state.cards.length === 0 ? (
        <p className="text-gray-400 text-center py-10">No payment cards for this season yet.</p>
      ) : (
        <div className="space-y-2">
          {state.cards.map((card) => (
            <div key={card.id} className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-semibold text-gray-900">{card.title}</p>
                  {card.amount != null && <p className="text-sm text-gray-500">${Number(card.amount).toFixed(2)}</p>}
                </div>
                <div className="flex gap-1.5 flex-wrap items-center">
                  <button
                    onClick={() => handleToggleActive(card)}
                    className={`text-xs px-2 py-1 rounded-full font-semibold uppercase tracking-wide ${
                      card.active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {card.active ? "Active" : "Inactive"}
                  </button>
                  <button
                    onClick={() => handleViewCompletions(card.id)}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
                  >
                    {expandedId === card.id ? "Hide Statuses" : "View Statuses"}
                  </button>
                  <button
                    onClick={() => dispatch({ type: "OPEN_EDIT", card })}
                    className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(card.id)}
                    className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedId === card.id && (
                <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
                  {completionsLoading ? (
                    <p className="text-sm text-gray-400 py-2">Loading...</p>
                  ) : completions.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">No players in this season.</p>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {completions.map((c) => (
                        <div key={c.playerId} className="flex items-center justify-between py-1.5 text-sm">
                          <span className="text-gray-700">{c.playerName || "Unnamed player"}</span>
                          <button
                            onClick={() => handleToggleCompletion(card.id, c.playerId, !c.done)}
                            className={`text-xs px-2 py-1 rounded-full font-semibold ${
                              c.done ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                            }`}
                          >
                            {c.done ? "Done" : "Not Done"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
