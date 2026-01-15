// src/Men/Local/Admin/Tabs/ManagePlayers.jsx
import { useEffect, useReducer } from "react";

import UserList from "./Users/UserList";
import UserSearch from "./Users/UserSearch";
import { apiRequest } from "../../../../Services/API";
import type { ApiUser, Program, Role } from "../../../../types/api";

type UserRecord = ApiUser & { id: string };

type ManagePlayersState = {
  users: UserRecord[];
  searchTerm: string;
  loading: boolean;
};

type ManagePlayersAction =
  | { type: "SET_USERS"; users: UserRecord[] }
  | { type: "SET_SEARCH"; value: string }
  | { type: "SET_LOADING"; value: boolean };

const initialState: ManagePlayersState = {
  users: [],
  searchTerm: "",
  loading: true,
};

function reducer(state: ManagePlayersState, action: ManagePlayersAction): ManagePlayersState {
  switch (action.type){
    case "SET_USERS":
      return { ...state, users: action.users, loading: false };
    case "SET_SEARCH":
      return { ...state, searchTerm: action.value };
    case "SET_LOADING":
      return { ...state, loading: action.value };
    default:
      return state;
  }
}

export default function ManagePlayers(){
  const [state, dispatch] = useReducer(reducer, initialState);
  const { users, searchTerm, loading } = state;

  const program: Program = "men";

  useEffect(() => {
    let active = true;
    const fetchUsers = async () => {
      dispatch({ type: "SET_LOADING", value: true });
      const rolePriority: Partial<Record<Role, number>> = { admin: 1, player: 2, user: 3 };
      try {
        const data = await apiRequest<ApiUser[]>(`/api/users?program=${program}`);
        if (!active) return;
        const usersData: UserRecord[] = data
          .map((u) => ({ ...u, id: u.uid || u.id || "" }))
          .sort((a, b) => {
            const aRole = a.roles?.[program]?.toLowerCase() || "user";
            const bRole = b.roles?.[program]?.toLowerCase() || "user";
            const aPriority = rolePriority[aRole as Role] || 99;
            const bPriority = rolePriority[bRole as Role] || 99;
            return aPriority === bPriority
              ? (a.displayName || "").localeCompare(b.displayName || "")
              : aPriority - bPriority;
          });

        dispatch({ type: "SET_USERS", users: usersData });
      } catch (err){
        console.error("Failed to load users:", err);
        dispatch({ type: "SET_USERS", users: [] });
      }
    };

    fetchUsers();
    return () => {
      active = false;
    };
  }, []);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      const roleValue = newRole.toLowerCase() as Role;
      await apiRequest(`/api/users/${userId}`, {
        method: "PUT",
        json: { roles: { [program]: roleValue } },
      });

      const updated = users.map((u) =>
        u.id === userId
          ? { ...u, roles: { ...(u.roles || {}), [program]: roleValue } }
          : u
      );
      dispatch({ type: "SET_USERS", users: updated });
    } catch (err) {
      console.error("Failed to update role:", err);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await apiRequest(`/api/users/${userId}`, { method: "DELETE" });
      dispatch({ type: "SET_USERS", users: users.filter((u) => u.id !== userId) });
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded shadow animate-fadeIn">
      <h2 className="text-2xl font-bold mb-4">Manage Users - Men&#39;s Program</h2>

      <UserSearch
        searchTerm={searchTerm}
        setSearchTerm={(value) => dispatch({ type: "SET_SEARCH", value })}
      />

      {loading && (
        <p className="text-gray-600 mt-4 animate-pulse">Loading users...</p>
      )}

      {!loading && filteredUsers.length === 0 && (
        <p className="text-gray-500 mt-4 text-center">No users found.</p>
      )}

      <UserList
        users={filteredUsers.map((u) => ({
          ...u,
          role: u.roles?.[program] || "user",
        }))}
        handleRoleChange={handleRoleChange}
        handleDelete={handleDelete}
      />
    </div>
  );
}

