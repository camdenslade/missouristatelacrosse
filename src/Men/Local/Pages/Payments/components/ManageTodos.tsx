import { useCallback, useEffect, useReducer, useState } from "react";
import toast from "react-hot-toast";

import { useConfirm } from "../../../../../Global/Common/components/ConfirmModal";
import { uploadCompressedImage } from "../../../../../Global/Common/hooks/uploadHelper";
import { faviconUrl } from "../../../../../Global/Common/utils/linkImage";
import type { ApiTodo, ApiTodoCompletion } from "../../../../../types/api";
import {
  createTodo,
  deleteTodo,
  fetchTodoCompletions,
  fetchTodos,
  setPlayerTodoStatus,
  updateTodo,
} from "../hooks/useTodos";

type View = "list" | "form";

type FormState = {
  title: string;
  description: string;
  link: string;
  active: boolean;
};

function emptyForm(): FormState {
  return { title: "", description: "", link: "", active: true };
}

function todoToForm(t: ApiTodo): FormState {
  return {
    title: t.title ?? "",
    description: t.description ?? "",
    link: t.link ?? "",
    active: t.active,
  };
}

type ImageItem = { preview: string; file: File | null; url: string | null };

function todoToImage(t: ApiTodo): ImageItem[] {
  return t.image ? [{ preview: t.image, file: null, url: t.image }] : [];
}

function cardThumb(t: ApiTodo): string | null {
  return t.image || faviconUrl(t.link);
}

type State = {
  view: View;
  todos: ApiTodo[];
  loading: boolean;
  saving: boolean;
  errorMsg: string;
  editingId: string | null;
  form: FormState;
};

type Action =
  | { type: "LOADED"; todos: ApiTodo[] }
  | { type: "SET_VIEW"; view: View }
  | { type: "OPEN_CREATE" }
  | { type: "OPEN_EDIT"; todo: ApiTodo }
  | { type: "SET_FORM"; key: keyof FormState; value: string | boolean }
  | { type: "SAVE_START" }
  | { type: "SAVE_DONE"; todo: ApiTodo }
  | { type: "DELETE_DONE"; id: string }
  | { type: "SET_ERROR"; msg: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOADED":
      return { ...state, loading: false, todos: action.todos };
    case "SET_VIEW":
      return { ...state, view: action.view };
    case "OPEN_CREATE":
      return { ...state, view: "form", editingId: null, form: emptyForm(), errorMsg: "" };
    case "OPEN_EDIT":
      return { ...state, view: "form", editingId: action.todo.id, form: todoToForm(action.todo), errorMsg: "" };
    case "SET_FORM":
      return { ...state, form: { ...state.form, [action.key]: action.value } };
    case "SAVE_START":
      return { ...state, saving: true, errorMsg: "" };
    case "SAVE_DONE": {
      const exists = state.todos.find((t) => t.id === action.todo.id);
      const todos = exists
        ? state.todos.map((t) => (t.id === action.todo.id ? action.todo : t))
        : [...state.todos, action.todo];
      return { ...state, saving: false, todos, view: "list" };
    }
    case "DELETE_DONE":
      return { ...state, todos: state.todos.filter((t) => t.id !== action.id) };
    case "SET_ERROR":
      return { ...state, saving: false, errorMsg: action.msg };
    default:
      return state;
  }
}

type ManageTodosProps = {
  season: string;
  availableSeasons?: string[];
};

export default function ManageTodos({ season, availableSeasons = [] }: ManageTodosProps) {
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(reducer, {
    view: "list",
    todos: [],
    loading: true,
    saving: false,
    errorMsg: "",
    editingId: null,
    form: emptyForm(),
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completions, setCompletions] = useState<ApiTodoCompletion[]>([]);
  const [completionsLoading, setCompletionsLoading] = useState(false);
  const [copySource, setCopySource] = useState("");
  const [copying, setCopying] = useState(false);
  const [imageItem, setImageItem] = useState<ImageItem | null>(null);

  const otherSeasons = availableSeasons.filter((s) => s !== season);

  useEffect(() => {
    dispatch({ type: "LOADED", todos: [] });
    fetchTodos(season)
      .then((todos) => dispatch({ type: "LOADED", todos }))
      .catch(() => dispatch({ type: "LOADED", todos: [] }));
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
      const image = imageItem
        ? imageItem.file
          ? await uploadCompressedImage(imageItem.file, "todos")
          : imageItem.url ?? undefined
        : "";
      const payload = {
        season,
        title: f.title.trim(),
        description: f.description.trim() || undefined,
        link: f.link.trim() || undefined,
        image,
        active: f.active,
      };
      const saved = state.editingId
        ? await updateTodo(state.editingId, payload)
        : await createTodo(payload);
      setImageItem(null);
      dispatch({ type: "SAVE_DONE", todo: saved });
    } catch {
      dispatch({ type: "SET_ERROR", msg: "Failed to save to-do. Please try again." });
    }
  }, [state.form, state.editingId, season, imageItem]);

  const handleDelete = useCallback(async (id: string) => {
    if (!(await confirm("Delete this to-do? Players' completion status for it will be removed too."))) return;
    try {
      await deleteTodo(id);
      dispatch({ type: "DELETE_DONE", id });
      if (expandedId === id) setExpandedId(null);
    } catch {
      toast.error("Failed to delete to-do.");
    }
  }, [confirm, expandedId]);

  const handleToggleActive = useCallback(async (todo: ApiTodo) => {
    try {
      const updated = await updateTodo(todo.id, { active: !todo.active });
      dispatch({ type: "SAVE_DONE", todo: updated });
    } catch {
      toast.error("Failed to update to-do.");
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
      const data = await fetchTodoCompletions(id);
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
      const sourceTodos = await fetchTodos(copySource);
      const created = await Promise.all(
        sourceTodos.map((t) =>
          createTodo({
            season,
            title: t.title,
            description: t.description ?? undefined,
            link: t.link ?? undefined,
            image: t.image ?? undefined,
            active: t.active,
          })
        )
      );
      dispatch({ type: "LOADED", todos: [...state.todos, ...created] });
      toast.success(`Copied ${created.length} to-do${created.length === 1 ? "" : "s"} from ${copySource}.`);
      setCopySource("");
    } catch {
      toast.error("Failed to copy to-dos.");
    } finally {
      setCopying(false);
    }
  }, [copySource, season, state.todos]);

  const handleToggleCompletion = useCallback(async (todoId: string, playerId: string, done: boolean) => {
    try {
      await setPlayerTodoStatus(todoId, playerId, done);
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
          <button
            onClick={() => { setImageItem(null); dispatch({ type: "SET_VIEW", view: "list" }); }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Back
          </button>
          <h3 className="text-lg font-bold text-gray-900">{state.editingId ? "Edit To-Do" : "New To-Do"}</h3>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
            <p className="text-xs text-gray-400 mb-2">Optional. Without one, the card shows the link's favicon.</p>
            {imageItem ? (
              <div className="relative w-16">
                <img src={imageItem.preview} alt="" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                <button
                  type="button"
                  onClick={() => setImageItem(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full text-xs flex items-center justify-center hover:bg-gray-900 leading-none"
                >
                  x
                </button>
              </div>
            ) : (
              <label className="h-16 w-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 text-gray-400 text-xs text-center">
                <span className="text-lg leading-none">+</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setImageItem({ preview: URL.createObjectURL(file), file, url: null });
                    e.target.value = "";
                  }}
                />
              </label>
            )}
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
              {state.saving ? "Saving..." : "Save To-Do"}
            </button>
            <button
              onClick={() => { setImageItem(null); dispatch({ type: "SET_VIEW", view: "list" }); }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
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
        <h3 className="text-lg font-bold text-gray-900">To-Dos</h3>
        <div className="flex flex-wrap items-center gap-2">
          {otherSeasons.length > 0 && (
            <>
              <select
                value={copySource}
                onChange={(e) => setCopySource(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
              >
                <option value="">Copy to-dos from...</option>
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
            onClick={() => { setImageItem(null); dispatch({ type: "OPEN_CREATE" }); }}
            className="px-4 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0012] text-sm font-semibold"
          >
            + New To-Do
          </button>
        </div>
      </div>

      {state.loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : state.todos.length === 0 ? (
        <p className="text-gray-400 text-center py-10">No to-dos for this season yet.</p>
      ) : (
        <div className="space-y-2">
          {state.todos.map((todo) => (
            <div key={todo.id} className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  {cardThumb(todo) && (
                    <img
                      src={cardThumb(todo) as string}
                      alt=""
                      className="h-8 w-8 rounded object-cover border border-gray-200 grayscale shrink-0"
                    />
                  )}
                  <p className="font-semibold text-gray-900 truncate">{todo.title}</p>
                </div>
                <div className="flex gap-1.5 flex-wrap items-center">
                  <button
                    onClick={() => handleToggleActive(todo)}
                    className={`text-xs px-2 py-1 rounded-full font-semibold uppercase tracking-wide ${
                      todo.active ? "bg-gray-700 text-white hover:bg-gray-800" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {todo.active ? "Active" : "Inactive"}
                  </button>
                  <button
                    onClick={() => handleViewCompletions(todo.id)}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
                  >
                    {expandedId === todo.id ? "Hide Statuses" : "View Statuses"}
                  </button>
                  <button
                    onClick={() => { setImageItem(todoToImage(todo)[0] ?? null); dispatch({ type: "OPEN_EDIT", todo }); }}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(todo.id)}
                    className="text-xs px-2 py-1 rounded-lg bg-gray-300 text-gray-900 hover:bg-gray-400 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedId === todo.id && (
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
                            onClick={() => handleToggleCompletion(todo.id, c.playerId, !c.done)}
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
