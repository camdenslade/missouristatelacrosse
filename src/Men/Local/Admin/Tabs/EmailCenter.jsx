// src/Men/Local/Admin/Tabs/EmailCenter.jsx
import { useEffect, useReducer } from "react";
import { db } from "../../Services/firebaseConfig.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import API_BASE from "../../Services/API.js";

const initialState = {
  groups: [],
  selectedGroup: "",
  subject: "",
  body: "",
  newGroupName: "",
  newEmail: "",
  sending: false,
  message: "",
  searchTerm: "",
  selectedEmails: [],
};

function reducer(state, action){
  switch (action.type){
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_GROUPS":
      return { ...state, groups: action.groups };
    case "ADD_GROUP":
      return { ...state, groups: [...state.groups, action.group] };
    case "UPDATE_GROUP":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.id ? { ...g, ...action.updates } : g
        ),
      };
    case "DELETE_GROUP":
      return {
        ...state,
        groups: state.groups.filter((g) => g.id !== action.id),
        selectedGroup:
          state.selectedGroup === action.id ? "" : state.selectedGroup,
      };
    case "SET_MESSAGE":
      return { ...state, message: action.message };
    case "CLEAR_MESSAGE":
      return { ...state, message: "" };
    default:
      return state;
  }
}

export default function EmailCenter(){
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    groups,
    selectedGroup,
    subject,
    body,
    newGroupName,
    newEmail,
    sending,
    message,
    searchTerm,
    selectedEmails,
  } = state;

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => dispatch({ type: "CLEAR_MESSAGE" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const snap = await getDocs(collection(db, "groups"));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        dispatch({ type: "SET_GROUPS", groups: list });
      } catch (err) {
        console.error("Error loading groups:", err);
        dispatch({ type: "SET_MESSAGE", message: "Failed to load groups" });
      }
    };
    fetchGroups();
  }, []);

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    try{
      const docRef = await addDoc(collection(db, "groups"), {
        name: newGroupName,
        members: [],
        createdAt: new Date(),
      });
      dispatch({
        type: "ADD_GROUP",
        group: { id: docRef.id, name: newGroupName, members: [] },
      });
      dispatch({ type: "SET_FIELD", field: "newGroupName", value: "" });
      dispatch({
        type: "SET_MESSAGE",
        message: `Group "${newGroupName}" created`,
      });
    } catch (err){
      console.error("Add group failed:", err);
      dispatch({ type: "SET_MESSAGE", message: "❌ Failed to create group" });
    }
  };

  const handleAddEmail = async () => {
    if (!selectedGroup || !newEmail.trim()) return;
    const group = groups.find((g) => g.id === selectedGroup);
    const updated = [...(group.members || []), newEmail.trim()];
    await updateDoc(doc(db, "groups", selectedGroup), { members: updated });
    dispatch({
      type: "UPDATE_GROUP",
      id: selectedGroup,
      updates: { members: updated },
    });
    dispatch({ type: "SET_FIELD", field: "newEmail", value: "" });
    dispatch({ type: "SET_MESSAGE", message: "Email added to group" });
  };

  const handleDeleteGroup = async (id) => {
    await deleteDoc(doc(db, "groups", id));
    dispatch({ type: "DELETE_GROUP", id });
    dispatch({ type: "SET_MESSAGE", message: "Group deleted" });
  };

  const getFilteredMembers = () => {
    const group = groups.find((g) => g.id === selectedGroup);
    if (!group || !Array.isArray(group.members)) return [];
    return group.members.filter((email) =>
      (email || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleDeleteSelected = async () => {
    const group = groups.find((g) => g.id === selectedGroup);
    const updated = group.members.filter((m) => !selectedEmails.includes(m));
    await updateDoc(doc(db, "groups", selectedGroup), { members: updated });
    dispatch({
      type: "UPDATE_GROUP",
      id: selectedGroup,
      updates: { members: updated },
    });
    dispatch({ type: "SET_FIELD", field: "selectedEmails", value: [] });
    dispatch({
      type: "SET_MESSAGE",
      message: `Removed ${selectedEmails.length} email(s)`,
    });
  };

 
  const handleSend = async () => {
    if (!selectedGroup)
      return dispatch({
        type: "SET_MESSAGE",
        message: "Select a group first.",
      });
    const group = groups.find((g) => g.id === selectedGroup);
    if (!group || !group.members.length)
      return dispatch({
        type: "SET_MESSAGE",
        message: "This group has no members.",
      });

    dispatch({ type: "SET_FIELD", field: "sending", value: true });
    try{
      const res = await fetch(`${API_BASE}/admin/send-email/group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program: "men",
          recipients: group.members,
          subject,
          body,
        }),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || "Failed to send email");
      dispatch({
        type: "SET_MESSAGE",
        message: `Email sent to "${group.name}" (${group.members.length} recipients).`,
      });
      dispatch({ type: "SET_FIELD", field: "subject", value: "" });
      dispatch({ type: "SET_FIELD", field: "body", value: "" });
    } catch (err){
      dispatch({ type: "SET_MESSAGE", message: `❌ ${err.message}` });
    } finally{
      dispatch({ type: "SET_FIELD", field: "sending", value: false });
    }
  };

  
  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded shadow animate-fadeIn">
      <h2 className="text-2xl font-bold mb-4">Email Center — Men’s Program</h2>

      {message && (
        <p className="mb-4 text-center text-sm font-medium text-gray-700">
          {message}
        </p>
      )}

      {/* Group Selection */}
      <div className="mb-4">
        <label className="font-semibold block mb-1">Select Group</label>
        <select
          value={selectedGroup}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "selectedGroup", value: e.target.value })
          }
          className="border rounded px-3 py-2 w-full"
        >
          <option value="">-- Select Group --</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.members?.length || 0})
            </option>
          ))}
        </select>
      </div>

      {/* Add Group */}
      <div className="flex mb-4 gap-2">
        <input
          type="text"
          placeholder="New group name"
          value={newGroupName}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "newGroupName", value: e.target.value })
          }
          className="border rounded px-3 py-2 flex-1"
        />
        <button
          onClick={handleAddGroup}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Add
        </button>
      </div>

      {/* Add Emails */}
      {selectedGroup && (
        <>
          <div className="flex mb-4 gap-2">
            <input
              type="email"
              placeholder="Add email to group"
              value={newEmail}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "newEmail", value: e.target.value })
              }
              className="border rounded px-3 py-2 flex-1"
            />
            <button
              onClick={handleAddEmail}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Add Email
            </button>
          </div>

          {/* Search & Members */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search emails..."
              value={searchTerm}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "searchTerm", value: e.target.value })
              }
              className="border rounded px-3 py-2 w-full mb-2"
            />

            <ul className="border rounded p-3 max-h-40 overflow-y-auto">
              {getFilteredMembers().length > 0 ? (
                getFilteredMembers().map((email, idx) => (
                  <li key={idx} className="flex justify-between items-center py-1 text-sm text-gray-700">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedEmails.includes(email)}
                        onChange={() =>
                          dispatch({
                            type: "SET_FIELD",
                            field: "selectedEmails",
                            value: selectedEmails.includes(email)
                              ? selectedEmails.filter((e) => e !== email)
                              : [...selectedEmails, email],
                          })
                        }
                      />
                      {email}
                    </label>
                  </li>
                ))
              ) : (
                <p className="text-sm text-gray-500">No matching members</p>
              )}
            </ul>

            {selectedEmails.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="mt-2 bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
              >
                Delete Selected
              </button>
            )}
          </div>
        </>
      )}

      {/* Email Form */}
      <div className="mb-4">
        <label className="font-semibold block mb-1">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "subject", value: e.target.value })
          }
          className="border rounded px-3 py-2 w-full"
        />
      </div>
      <div className="mb-4">
        <label className="font-semibold block mb-1">Body</label>
        <textarea
          rows="6"
          value={body}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "body", value: e.target.value })
          }
          className="border rounded px-3 py-2 w-full"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSend}
          disabled={sending}
          className={`px-6 py-2 rounded text-white ${
            sending ? "bg-gray-400" : "bg-[#5E0009] hover:bg-[#7a0010]"
          }`}
        >
          {sending ? "Sending..." : "Send Email"}
        </button>
        {selectedGroup && (
          <button
            onClick={() => handleDeleteGroup(selectedGroup)}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white"
          >
            Delete Group
          </button>
        )}
      </div>
    </div>
  );
}
