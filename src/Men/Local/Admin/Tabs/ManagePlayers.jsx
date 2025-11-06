// src/Men/Local/Admin/Tabs/ManagePlayers.jsx
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { useEffect, useReducer } from "react";

import UserList from "./Users/UserList.jsx";
import UserSearch from "./Users/UserSearch.jsx";
import { db } from "../../../../Services/firebaseConfig.js";

const initialState = {
  users: [],
  searchTerm: "",
  loading: true,
};

function reducer(state, action){
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

  const program = "men";

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("displayName"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rolePriority = { admin: 1, player: 2, user: 3 };

      const usersData = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(
          (u) => Array.isArray(u.programs) && u.programs.includes(program)
        )
        .sort((a, b) => {
          const aRole = a.roles?.[program]?.toLowerCase() || "user";
          const bRole = b.roles?.[program]?.toLowerCase() || "user";
          const aPriority = rolePriority[aRole] || 99;
          const bPriority = rolePriority[bRole] || 99;
          return aPriority === bPriority
            ? a.displayName.localeCompare(b.displayName)
            : aPriority - bPriority;
        });

      dispatch({ type: "SET_USERS", users: usersData });
    });

    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    const docRef = doc(db, "users", userId);
    await updateDoc(docRef, {
      [`roles.${program}`]: newRole.toLowerCase(),
    });
  };

  const filteredUsers = users.filter((u) =>
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded shadow animate-fadeIn">
      <h2 className="text-2xl font-bold mb-4">Manage Users — Men’s Program</h2>

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
      />
    </div>
  );
}