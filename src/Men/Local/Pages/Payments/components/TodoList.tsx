import { CheckCircle2, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { fetchPlayerTodoStatuses, fetchTodos, setPlayerTodoStatus } from "../hooks/useTodos";
import type { ApiTodo, ApiTodoStatus } from "../../../../../types/api";

type TodoListProps = {
  playerId: string;
  season: string;
};

export default function TodoList({ playerId, season }: TodoListProps) {
  const [todos, setTodos] = useState<ApiTodo[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ApiTodoStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId || !season) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchTodos(season), fetchPlayerTodoStatuses(playerId)])
      .then(([todoList, statusList]) => {
        if (cancelled) return;
        setTodos(todoList.filter((t) => t.active));
        setStatuses(
          statusList.reduce<Record<string, ApiTodoStatus>>((acc, s) => {
            acc[s.todoId] = s;
            return acc;
          }, {})
        );
      })
      .catch(() => {
        if (!cancelled) {
          setTodos([]);
          setStatuses({});
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId, season]);

  if (loading || todos.length === 0) return null;

  const handleToggle = async (todo: ApiTodo, done: boolean) => {
    setSaving(todo.id);
    try {
      const updated = await setPlayerTodoStatus(todo.id, playerId, done);
      setStatuses((prev) => ({ ...prev, [todo.id]: updated }));
      if (done) toast.success(`${todo.title} marked as done!`);
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <h3 className="font-medium text-sm mb-2 text-gray-800">To-Dos</h3>
      <div className="space-y-3">
        {todos.map((todo) => {
          const done = statuses[todo.id]?.done ?? false;
          return (
            <div
              key={todo.id}
              className={`bg-white border rounded-2xl shadow-sm p-4 transition ${
                done ? "border-green-200" : "border-gray-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-gray-900">{todo.title}</h4>
                  {todo.description && (
                    <p className="text-sm text-gray-600 mt-1">{todo.description}</p>
                  )}
                  {todo.link && (
                    <a
                      href={todo.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-[#5E0009] font-semibold mt-2 hover:underline"
                    >
                      Go to site <ExternalLink size={13} />
                    </a>
                  )}
                </div>
                <button
                  onClick={() => handleToggle(todo, !done)}
                  disabled={saving === todo.id}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                    done
                      ? "bg-green-50 text-green-700 hover:bg-green-100"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  } disabled:opacity-50`}
                >
                  <CheckCircle2 size={15} />
                  {done ? "Done" : "Mark as Done"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
