import { apiRequest } from "../../../../../Services/API";
import type { ApiTodo, ApiTodoCompletion, ApiTodoStatus } from "../../../../../types/api";

export type TodoPayload = {
  season?: string;
  title?: string;
  description?: string;
  link?: string;
  image?: string;
  active?: boolean;
};

export async function fetchTodos(season: string): Promise<ApiTodo[]> {
  return apiRequest<ApiTodo[]>(`/api/todos?season=${encodeURIComponent(season)}`);
}

export async function createTodo(payload: TodoPayload): Promise<ApiTodo> {
  return apiRequest<ApiTodo>("/api/todos", { method: "POST", json: payload });
}

export async function updateTodo(id: string, payload: TodoPayload): Promise<ApiTodo> {
  return apiRequest<ApiTodo>(`/api/todos/${id}`, { method: "PUT", json: payload });
}

export async function deleteTodo(id: string): Promise<void> {
  await apiRequest(`/api/todos/${id}`, { method: "DELETE" });
}

export async function fetchPlayerTodoStatuses(playerId: string): Promise<ApiTodoStatus[]> {
  return apiRequest<ApiTodoStatus[]>(`/api/todos/status?playerId=${playerId}`);
}

export async function setPlayerTodoStatus(todoId: string, playerId: string, done: boolean): Promise<ApiTodoStatus> {
  return apiRequest<ApiTodoStatus>("/api/todos/status", {
    method: "PUT",
    json: { todoId, playerId, done },
  });
}

export async function fetchTodoCompletions(todoId: string): Promise<ApiTodoCompletion[]> {
  return apiRequest<ApiTodoCompletion[]>(`/api/todos/${todoId}/completions`);
}
