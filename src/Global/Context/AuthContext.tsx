// src/Global/Context/AuthContext.jsx
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { ReactNode } from "react";
import type { User as FirebaseUser } from "firebase/auth";

import { apiRequest } from "../../Services/API";
import { auth } from "../../Services/firebaseConfig";
import { getActiveProgram } from "../../Services/programHelper";

type ProgramKey = "men" | "women" | string;
type UserRole = "admin" | "player" | "user" | "parent" | string;
type RolesByProgram = Record<ProgramKey, UserRole | undefined>;

type AuthState = {
  user: FirebaseUser | null;
  role: UserRole | null;
  roles: RolesByProgram;
  userName: string;
  loading: boolean;
};

type AuthAction =
  | { type: "SET_USER"; payload: FirebaseUser | null }
  | { type: "SET_ROLE"; payload: UserRole | null }
  | { type: "SET_ROLES"; payload: RolesByProgram }
  | { type: "SET_USERNAME"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "RESET" };

type AuthContextValue = AuthState & {
  isAdmin: boolean;
  isAuthenticated: boolean;
  dispatch: React.Dispatch<AuthAction>;
  signOut: () => Promise<void>;
};

type ApiUserProfile = {
  displayName?: string;
  email?: string | null;
  roles?: RolesByProgram;
  programs?: string[];
  playerId?: string | null;
};

const initialState: AuthState = {
  user: null,
  role: null,
  roles: {},
  userName: "",
  loading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_ROLE":
      return { ...state, role: action.payload };
    case "SET_ROLES":
      return { ...state, roles: action.payload };
    case "SET_USERNAME":
      return { ...state, userName: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const getProgramProp = useCallback(() => getActiveProgram(), []);

  const getCachedAuth = useCallback((program: string | null) => {
    try {
      const raw = localStorage.getItem(`authCache_${program}`);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached) return null;
      const expired = Date.now() - cached.ts > 60 * 60 * 1000;
      if (expired) {
        localStorage.removeItem(`authCache_${program}`);
        return null;
      }
      return cached;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const program = getProgramProp();

      if (!currentUser) {
        dispatch({ type: "RESET" });
        localStorage.removeItem(`authCache_${program}`);
        return;
      }

      dispatch({ type: "SET_USER", payload: currentUser });
      dispatch({ type: "SET_LOADING", payload: true });
      const emailFallback = currentUser.email
        ? currentUser.email.split("@")[0]
        : "";
      const fallbackName = currentUser.displayName || emailFallback;
      if (fallbackName) {
        dispatch({ type: "SET_USERNAME", payload: fallbackName });
      }

      const cached = getCachedAuth(program);
      if (cached && auth.currentUser) {
        dispatch({ type: "SET_USER", payload: auth.currentUser });
        dispatch({ type: "SET_ROLE", payload: cached.role });
        dispatch({ type: "SET_ROLES", payload: cached.roles || {} });
        dispatch({ type: "SET_USERNAME", payload: cached.name });
        dispatch({ type: "SET_LOADING", payload: false });
      }

      try {
        let data = await apiRequest<ApiUserProfile>(
          `/api/users/${currentUser.uid}`
        ).catch(() => null);
        if (!data) {
          data = await apiRequest<ApiUserProfile>(`/api/users/${currentUser.uid}`, {
            method: "PUT",
            json: {
              email: currentUser.email,
              displayName:
                currentUser.displayName || emailFallback,
              roles: { [program]: "player" },
              programs: [program],
            },
          });
        }

        const userRoles = data.roles || {};
        const currentRole =
          userRoles[program]?.toLowerCase() || null;
        const displayName =
          data.displayName ||
          currentUser.displayName ||
          currentUser.email ||
          "";

        const programs = Object.keys(userRoles || {});
        const dataProgramSort = JSON.stringify((data.programs || []).sort());
        const programSort = JSON.stringify(programs.sort());
        if (!data.programs || dataProgramSort !== programSort) {
          await apiRequest<ApiUserProfile>(`/api/users/${currentUser.uid}`, {
            method: "PUT",
            json: { programs },
          });
        }

        dispatch({ type: "SET_USER", payload: currentUser });
        dispatch({ type: "SET_ROLE", payload: currentRole });
        dispatch({ type: "SET_ROLES", payload: userRoles });
        dispatch({ type: "SET_USERNAME", payload: displayName });
        dispatch({ type: "SET_LOADING", payload: false });

        localStorage.setItem(
          `authCache_${program}`,
          JSON.stringify({
            role: currentRole,
            roles: userRoles,
            name: displayName,
            ts: Date.now(),
          })
        );

        if (!data.playerId && currentRole && ["player", "admin"].includes(currentRole) && displayName) {
          await tryAutoLinkPlayer(currentUser, displayName, program);
        }
      } catch (err) {
        console.error("Auth revalidation error:", err);
        dispatch({ type: "SET_LOADING", payload: false });
      }
    });

    return () => unsubscribe();
  }, [getCachedAuth, getProgramProp]);

  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
    } finally {
      dispatch({ type: "RESET" });
      const program = getProgramProp();
      localStorage.removeItem(`authCache_${program}`);
    }
  }, [getProgramProp]);

  const isAdmin = useMemo(() => state.role === "admin", [state.role]);
  const isAuthenticated = useMemo(() => !!state.user, [state.user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAdmin,
      isAuthenticated,
      dispatch,
      signOut: signOutUser,
    }),
    [state, isAdmin, isAuthenticated, signOutUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function tryAutoLinkPlayer(
  firebaseUser: FirebaseUser,
  displayName: string,
  program: string | null
) {
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const start = m >= 8 ? y : y - 1;
    const currentSeason = `${String(start).slice(-2)}-${String(
      start + 1
    ).slice(-2)}`;

    let player = await apiRequest<{ id?: string; email?: string }>(
      `/api/players/search?name=${encodeURIComponent(displayName)}&season=${encodeURIComponent(currentSeason)}`
    ).catch(() => null);

    if (!player?.id && firebaseUser.email) {
      const allPlayers = await apiRequest<{ id?: string; email?: string }[]>(
        `/api/players?season=${encodeURIComponent(currentSeason)}`
      ).catch(() => []);
      const emailLower = firebaseUser.email.toLowerCase();
      player = allPlayers.find(
        (p) => p.email && p.email.toLowerCase() === emailLower
      ) || null;
    }

    if (player?.id) {
      const playerId = player.id;

      await apiRequest(`/api/users/${firebaseUser.uid}`, {
        method: "PUT",
        json: { playerId },
      });
      await apiRequest(`/api/players/${playerId}`, {
        method: "PUT",
        json: { userUid: firebaseUser.uid },
      });

      console.log(
        `Linked ${displayName} to ${program} player ${playerId} (${currentSeason})`
      );
    } else {
      console.log(
        `No ${program} player found for ${displayName} in ${currentSeason}`
      );
    }
  } catch (err) {
    console.error("Error auto-linking player:", err);
  }
}

