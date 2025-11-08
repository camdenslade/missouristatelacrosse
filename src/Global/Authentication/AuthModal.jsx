// src/Global/Authentication/AuthModal.jsx
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useReducer } from "react";

import API_BASE from "../../Services/API.js";
import { auth, db } from "../../Services/firebaseConfig.js";
import { getActiveProgram } from "../../Services/programHelper.js";

const initialState = {
  isSignUp: false,
  email: "",
  displayName: "",
  password: "",
  error: "",
  submitted: false,
  submitting: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "TOGGLE_SIGNUP":
      return { ...state, isSignUp: !state.isSignUp, error: "", submitted: false };
    case "SUBMITTING":
      return { ...state, submitting: true, error: "" };
    case "SUBMIT_SUCCESS":
      return { ...state, submitted: true, submitting: false };
    case "ERROR":
      return { ...state, submitting: false, error: action.error };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

export default function AuthModal({ onClose }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { isSignUp, email, displayName, password, error, submitted, submitting } = state;

  const handleRequestSignup = async (e) => {
    e.preventDefault();
    dispatch({ type: "SUBMITTING" });

    try {
      const program = getActiveProgram();
      const res = await fetch(`${API_BASE}/api/account-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName, program }),
      });

      if (!res.ok) throw new Error(await res.text());
      dispatch({ type: "SUBMIT_SUCCESS" });
    } catch (err) {
      console.error(err);
      dispatch({ type: "ERROR", error: "Failed to submit request: " + err.message });
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    dispatch({ type: "SUBMITTING" });

    try {
      const program = getActiveProgram();
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCred.user;

      const userRef = doc(db, "users", firebaseUser.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        const displayName = firebaseUser.displayName || email.split("@")[0];
        await setDoc(userRef, {
          email: firebaseUser.email,
          displayName,
          roles: { [program]: "player" },
          createdAt: new Date(),
        });
        console.log(`Created new ${program} user: ${displayName}`);
      } else {
        const data = snap.data();
        if (!data.roles || !data.roles[program]) {
          await setDoc(
            userRef,
            {
              roles: { ...(data.roles || {}), [program]: data.roles?.men || "player" },
            },
            { merge: true }
          );
          console.log(`Added ${program} role to existing user`);
        }
      }

      onClose();
    } catch (err) {
      console.error(err);
      let msg = "Failed to sign in: " + err.message;
      if (err.code === "auth/user-not-found") msg = "No account found with this email.";
      else if (err.code === "auth/wrong-password") msg = "Incorrect password. Please try again.";
      else if (err.code === "auth/too-many-requests") msg = "Too many attempts. Please wait a moment.";
      dispatch({ type: "ERROR", error: msg });
    } finally {
      dispatch({ type: "SET_FIELD", field: "submitting", value: false });
    }
  };

  const handleClose = () => {
    dispatch({ type: "RESET" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="relative pointer-events-auto bg-white rounded-lg shadow-2xl w-96 p-6 animate-fadeIn border border-gray-300">
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
          onClick={handleClose}
        >
          ✕
        </button>

        <h2 className="text-xl font-bold mb-4 text-center text-[#5E0009]">
          {isSignUp ? "Request Account" : "Sign In"}
        </h2>

        {submitted ? (
          <div className="text-center text-green-600 font-medium">
            Your request has been submitted. An admin will review it.
          </div>
        ) : (
          <form
            onSubmit={isSignUp ? handleRequestSignup : handleSignIn}
            className="flex flex-col gap-3"
          >
            {isSignUp && (
              <input
                type="text"
                placeholder="Full Name"
                value={displayName}
                onChange={(e) =>
                  dispatch({ type: "SET_FIELD", field: "displayName", value: e.target.value })
                }
                className="border px-3 py-2 rounded"
                required
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "email", value: e.target.value })
              }
              className="border px-3 py-2 rounded"
              required
            />

            {!isSignUp && (
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) =>
                  dispatch({ type: "SET_FIELD", field: "password", value: e.target.value })
                }
                className="border px-3 py-2 rounded"
                required
              />
            )}

            {error && <div className="text-red-500 text-sm text-center">{error}</div>}

            <button
              type="submit"
              disabled={submitting}
              className={`bg-[#5E0009] text-white px-4 py-2 rounded hover:opacity-80 transition ${
                submitting ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {submitting
                ? isSignUp
                  ? "Submitting..."
                  : "Signing In..."
                : isSignUp
                ? "Request Account"
                : "Sign In"}
            </button>
          </form>
        )}

        {!submitted && (
          <div className="mt-3 text-center text-sm text-gray-600">
            {isSignUp ? (
              <span>
                Already have an account?{" "}
                <button
                  className="text-[#5E0009] font-semibold hover:underline"
                  onClick={() => dispatch({ type: "TOGGLE_SIGNUP" })}
                >
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                Don’t have an account?{" "}
                <button
                  className="text-[#5E0009] font-semibold hover:underline"
                  onClick={() => dispatch({ type: "TOGGLE_SIGNUP" })}
                >
                  Request Account
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
