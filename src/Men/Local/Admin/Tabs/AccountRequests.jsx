// src/Men/Local/Admin/Tabs/AccountRequests.jsx
import { useEffect, useReducer } from "react";

import API_BASE from "../../../../Services/API.js";

const initialState = {
  requests: [],
  loading: true,
  message: { text: "", type: "" },
};

function reducer(state, action){
  switch (action.type){
    case "SET_REQUESTS":
      return { ...state, requests: action.requests, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.value };
    case "SET_MESSAGE":
      return { ...state, message: action.message };
    case "CLEAR_MESSAGE":
      return { ...state, message: { text: "", type: "" } };
    case "REMOVE_REQUEST":
      return {
        ...state,
        requests: state.requests.filter((r) => r.id !== action.id),
      };
    default:
      return state;
  }
}

export default function ManageAccountRequests(){
  const [state, dispatch] = useReducer(reducer, initialState);
  const { requests, loading, message } = state;
  const program = "men";

  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(
        () => dispatch({ type: "CLEAR_MESSAGE" }),
        5000
      );
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchRequests = async () => {
    try{
      dispatch({ type: "SET_LOADING", value: true });
      const res = await fetch(`${API_BASE}/api/account-requests?program=${program}`);
      if (!res.ok) throw new Error("Failed to load requests");
      const data = await res.json();
      const filtered = data.filter((req) => req.program === program);
      dispatch({ type: "SET_REQUESTS", requests: filtered });
    } catch (err){
      dispatch({
        type: "SET_MESSAGE",
        message: { text: err.message, type: "error" },
      });
    } finally{
      dispatch({ type: "SET_LOADING", value: false });
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const approveRequest = async (id) => {
    const original = [...requests];
    dispatch({ type: "REMOVE_REQUEST", id });
    try{
      const res = await fetch(`${API_BASE}/api/account-requests/${id}/approve?program=${program}`, {
        method: "POST",
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || "Failed to approve request");
      dispatch({
        type: "SET_MESSAGE",
        message: {
          text: text || "Request approved successfully",
          type: "success",
        },
      });
    } catch (err){
      dispatch({
        type: "SET_MESSAGE",
        message: { text: err.message, type: "error" },
      });
      dispatch({ type: "SET_REQUESTS", requests: original });
    }
  };

  const rejectRequest = async (id) => {
    const original = [...requests];
    dispatch({ type: "REMOVE_REQUEST", id });
    try{
      const res = await fetch(`${API_BASE}/api/account-requests/${id}?program=${program}`, {
        method: "DELETE",
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || "Failed to delete request");
      dispatch({
        type: "SET_MESSAGE",
        message: {
          text: text || "Request deleted successfully",
          type: "success",
        },
      });
    } catch (err){
      dispatch({
        type: "SET_MESSAGE",
        message: { text: err.message, type: "error" },
      });
      dispatch({ type: "SET_REQUESTS", requests: original });
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white shadow rounded animate-fadeIn">
      <h1 className="text-2xl font-bold mb-4">
        Pending Account Requests — <span className="text-[#5E0009]">Men</span> Program
      </h1>

      {message.text && (
        <div
          className={`mb-4 p-3 rounded text-center font-medium transition-all duration-500 ${
            message.type === "success"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {loading && (
        <p className="text-gray-600 animate-pulse">Loading requests...</p>
      )}

      {!loading && requests.length === 0 && (
        <p className="text-gray-500 text-center">No pending requests</p>
      )}

      <ul className="divide-y divide-gray-200">
        {requests.map((req) => (
          <li
            key={req.id}
            className="py-4 flex items-center justify-between transition-all hover:bg-gray-50"
          >
            <div>
              <p className="font-semibold">{req.displayName}</p>
              <p className="text-gray-600 text-sm">{req.email}</p>
              {req.program && (
                <p className="text-xs text-gray-500">
                  Program: {req.program.toUpperCase()}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => approveRequest(req.id)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
              >
                Approve
              </button>
              <button
                onClick={() => rejectRequest(req.id)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
