import { useEffect, useReducer } from "react";

import { useAuth } from "../../../../Global/Context/AuthContext";
import { apiRequest } from "../../../../Services/API";
import { auth } from "../../../../Services/firebaseConfig";



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
      await apiRequest(`/api/users/${currentUser.uid}`, {
        method: "PUT",
        json: { displayName },
      });
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
      await apiRequest("/api/onboard/forgot-password", {
        method: "POST",
        json: { email: currentUser.email },
      });
      dispatch({ type: "SET_MESSAGE", payload: "Password reset email sent!" });
    } catch (err){
      console.error("Error sending reset email:", err);
      dispatch({ type: "SET_MESSAGE", payload: "Failed to send password reset email." });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white overflow-hidden">
        <div className="max-w-lg mx-auto text-left px-6 py-14">
          <div className="inline-flex items-center gap-3 text-white/70 text-xs font-semibold uppercase tracking-[0.2em] mb-3">
            <span className="h-px w-6 bg-white/40" />
            Account
            <span className="h-px w-6 bg-white/40" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold">
            Settings
          </h1>
          <p className="text-white/80 text-sm mt-2 capitalize">{program} Program</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 mt-8 pb-16">
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 text-left">
          {message && (
            <p className="mb-5 text-sm text-gray-700 font-medium">{message}</p>
          )}

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) =>
                dispatch({ type: "SET_DISPLAY_NAME", payload: e.target.value })
              }
              className="bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
            <input
              type="text"
              value={auth.currentUser?.email || ""}
              disabled
              className="bg-gray-100 border border-gray-200 text-gray-500 rounded-xl px-4 py-2.5 w-full cursor-not-allowed"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role</label>
            <input
              type="text"
              value={programRole}
              disabled
              className="bg-gray-100 border border-gray-200 text-gray-500 rounded-xl px-4 py-2.5 w-full cursor-not-allowed capitalize"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-5 py-2.5 rounded-full font-semibold text-white transition ${
                saving
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[#5E0009] hover:bg-[#7a0012]"
              }`}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            <button
              onClick={handleResetPassword}
              className="px-5 py-2.5 rounded-full font-semibold border border-[#5E0009] text-[#5E0009] hover:bg-[#5E0009]/5 transition"
            >
              Reset Password
            </button>

            <button
              onClick={signOut}
              className="px-5 py-2.5 rounded-full font-semibold border border-gray-300 text-gray-600 hover:bg-gray-100 transition ml-auto"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

