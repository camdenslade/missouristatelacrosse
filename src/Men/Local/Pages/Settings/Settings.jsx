// src/Men/Local/Pages/Settings/Settings.jsx
import { sendPasswordResetEmail } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useEffect, useReducer } from "react";

import { auth, db } from "../../../../Services/firebaseConfig.js";
import { useAuth } from "../../../../Global/Context/AuthContext.jsx";



function settingsReducer(state, action){
  switch (action.type){
    case "SET_DISPLAY_NAME":
      return { ...state, displayName: action.payload };
    case "SET_MESSAGE":
      return { ...state, message: action.payload };
    case "SET_SAVING":
      return { ...state, saving: action.payload };
    case "RESET_MESSAGE":
      return { ...state, message: "" };
    default:
      return state;
  }
}

export default function Settings(){
  const { roles, userName, signOut } = useAuth();

  const [state, dispatch] = useReducer(settingsReducer, {
    displayName: userName || "",
    saving: false,
    message: "",
  });

  const { displayName, saving, message } = state;

  const isWomen = window.location.pathname.toLowerCase().includes("/women");
  const program = isWomen ? "women" : "men";
  const programRole = roles?.[program] || "player";

  useEffect(() => {
    dispatch({ type: "SET_DISPLAY_NAME", payload: userName || "" });
  }, [userName]);

  const handleSave = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try{
      dispatch({ type: "SET_SAVING", payload: true });
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { displayName });
      dispatch({ type: "SET_MESSAGE", payload: "Profile updated!" });
    } catch (err){
      console.error("Error updating display name:", err);
      dispatch({ type: "SET_MESSAGE", payload: "Failed to update profile." });
    } finally{
      dispatch({ type: "SET_SAVING", payload: false });
    }
  };

  const handleResetPassword = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser?.email) return;

    try{
      await sendPasswordResetEmail(auth, currentUser.email);
      dispatch({ type: "SET_MESSAGE", payload: "Password reset email sent!" });
    } catch (err){
      console.error("Error sending reset email:", err);
      dispatch({ type: "SET_MESSAGE", payload: "Failed to send password reset email." });
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto bg-white rounded shadow animate-fadeIn text-left">
      <h1 className="text-2xl font-bold mb-6">
        Settings — <span className="text-[#5E0009] capitalize">{program}</span> Program
      </h1>

      {message && (
        <p className="mb-4 text-sm text-gray-700 font-medium">{message}</p>
      )}

      {/* Display Name */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) =>
            dispatch({ type: "SET_DISPLAY_NAME", payload: e.target.value })
          }
          className="border px-3 py-2 rounded w-full focus:outline-none focus:ring-2 focus:ring-[#5E0009]"
        />
      </div>

      {/* Email */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Email</label>
        <input
          type="text"
          value={auth.currentUser?.email || ""}
          disabled
          className="border px-3 py-2 rounded w-full bg-gray-100 cursor-not-allowed"
        />
      </div>

      {/* Role */}
      <div className="mb-6">
        <label className="block font-medium mb-1">Role</label>
        <input
          type="text"
          value={programRole}
          disabled
          className="border px-3 py-2 rounded w-full bg-gray-100 cursor-not-allowed capitalize"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-2 rounded text-white ${
            saving
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#5E0009] hover:bg-[#7a0012]"
          }`}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        <button
          onClick={handleResetPassword}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Reset Password
        </button>

        <button
          onClick={signOut}
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 ml-auto"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
