// src/Global/Authentication/AuthModal.jsx
import { signInWithEmailAndPassword } from "firebase/auth";
import { useReducer } from "react";
import type { FormEvent } from "react";

import { apiRequest } from "../../Services/API";
import { auth } from "../../Services/firebaseConfig";
import { getActiveProgram } from "../../Services/programHelper";
import { validateEmail, validateText } from "../Common/utils/validation";
import type { ApiUser, Program } from "../../types/api";

const initialState = {
  isSignUp: false,
  email: "",
  displayName: "",
  password: "",
  error: "",
  submitted: false,
  submitting: false,
};

type AuthState = typeof initialState;

type AuthAction =
  | { type: "SET_FIELD"; field: keyof AuthState; value: AuthState[keyof AuthState] }
  | { type: "TOGGLE_SIGNUP" }
  | { type: "SUBMITTING" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "ERROR"; error: string }
  | { type: "RESET" };

function reducer(state: AuthState, action: AuthAction) {
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

type AuthModalProps = {
  onClose: () => void;
};

export default function AuthModal({ onClose }: AuthModalProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { isSignUp, email, displayName, password, error, submitted, submitting } = state;

  const handleRequestSignup = async (e: FormEvent) => {
    e.preventDefault();
    const validationError =
      validateText(displayName, "Name", { required: true, max: 80 }) ||
      validateEmail(email);
    if (validationError) {
      dispatch({ type: "ERROR", error: validationError });
      return;
    }
    dispatch({ type: "SUBMITTING" });

    try {
      const program = getActiveProgram() as Program;
      await apiRequest("/api/account-requests", {
        method: "POST",
        json: { email, displayName, program },
      });
      dispatch({ type: "SUBMIT_SUCCESS" });
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      dispatch({ type: "ERROR", error: "Failed to submit request: " + message });
    }
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    const validationError =
      validateEmail(email) ||
      validateText(password, "Password", { required: true, min: 6, max: 128 });
    if (validationError) {
      dispatch({ type: "ERROR", error: validationError });
      return;
    }
    dispatch({ type: "SUBMITTING" });

    try {
      const program = getActiveProgram() as Program;
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCred.user;

      const userId = firebaseUser.uid;
      let userData = await apiRequest<ApiUser>(`/api/users/${userId}`).catch(() => null);

      if (!userData) {
        const newDisplayName = firebaseUser.displayName || email.split("@")[0];
        userData = await apiRequest<ApiUser>(`/api/users/${userId}`, {
          method: "PUT",
          json: {
            email: firebaseUser.email,
            displayName: newDisplayName,
            roles: { [program]: "player" },
            programs: [program],
          },
        });
        console.log(`Created new ${program} user: ${newDisplayName}`);
      } else {
        const roles = userData.roles || {};
        const updates: Partial<ApiUser> = {};
        if (!roles[program]) {
          updates.roles = { [program]: "player" };
          console.log(`Added ${program} role to existing user`);
        }
        const programs = Array.isArray(userData.programs) ? userData.programs : [];
        if (!programs.includes(program)) {
          updates.programs = [...programs, program];
        }
        if (Object.keys(updates).length > 0) {
          await apiRequest<ApiUser>(`/api/users/${userId}`, {
            method: "PUT",
            json: updates,
          });
        }
      }

      onClose();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string }).code;
      let msg = "Failed to sign in: " + message;
      if (code === "auth/user-not-found") msg = "No account found with this email.";
      else if (code === "auth/wrong-password") msg = "Incorrect password. Please try again.";
      else if (code === "auth/too-many-requests") msg = "Too many attempts. Please wait a moment.";
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
          X
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
              <>
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
                <div className="text-right -mt-1">
                  <a
                    href="/reset-password"
                    className="text-xs text-[#5E0009] hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
              </>
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
                Don&#39;t have an account?{" "}
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

