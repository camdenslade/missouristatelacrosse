import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { ReactNode } from "react";

import { apiRequest } from "../../Services/API";
import {
  getSession,
  setCurrentUid,
  signIn as cognitoSignIn,
  signOut as cognitoSignOut,
} from "../../Services/cognitoAuth";
import type { AuthUser } from "../../Services/cognitoAuth";
import { getActiveProgram } from "../../Services/programHelper";
import { fetchActiveSeasonCode } from "../Common/utils/seasonUtils";

type ProgramKey = "men" | "women" | string;
type UserRole = "admin" | "player" | "user" | "parent" | string;
type RolesByProgram = Record<ProgramKey, UserRole | undefined>;

type AuthState = {
  user: AuthUser | null;
  role: UserRole | null;
  roles: RolesByProgram;
  userName: string;
  playerId: string | null;
  loading: boolean;
};

type AuthAction =
  | { type: "SET_USER"; payload: AuthUser | null }
  | { type: "SET_ROLE"; payload: UserRole | null }
  | { type: "SET_ROLES"; payload: RolesByProgram }
  | { type: "SET_USERNAME"; payload: string }
  | { type: "SET_PLAYER_ID"; payload: string | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "RESET" };

type AuthContextValue = AuthState & {
  isAdmin: boolean;
  isAuthenticated: boolean;
  dispatch: React.Dispatch<AuthAction>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

type ApiUserProfile = {
  uid?: string;
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
  playerId: null,
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
    case "SET_PLAYER_ID":
      return { ...state, playerId: action.payload };
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

  const signOutUser = useCallback(async () => {
    try {
      cognitoSignOut();
    } finally {
      setCurrentUid(null);
      dispatch({ type: "RESET" });
      const program = getProgramProp();
      localStorage.removeItem(`authCache_${program}`);
    }
  }, [getProgramProp]);

  // Loads who the stored Cognito session belongs to. With strict set (an explicit sign-in),
  // a person Cognito accepts but who has no account here is signed out again and an error is
  // thrown so the form can say so, instead of leaving a half signed-in state.
  const hydrate = useCallback(
    async (strict: boolean) => {
      const program = getProgramProp();
      const session = await getSession();

      if (!session) {
        setCurrentUid(null);
        dispatch({ type: "RESET" });
        localStorage.removeItem(`authCache_${program}`);
        return;
      }

      const claims = session.getIdToken().payload as { email?: string; name?: string };
      const email = claims.email ?? null;
      const emailFallback = email ? email.split("@")[0] : "";
      dispatch({ type: "SET_LOADING", payload: true });

      const cached = getCachedAuth(program);
      if (cached?.uid) {
        setCurrentUid(cached.uid);
        dispatch({
          type: "SET_USER",
          payload: { uid: cached.uid, email, displayName: cached.name || claims.name || emailFallback },
        });
        dispatch({ type: "SET_ROLE", payload: cached.role });
        dispatch({ type: "SET_ROLES", payload: cached.roles || {} });
        dispatch({ type: "SET_USERNAME", payload: cached.name });
        dispatch({ type: "SET_PLAYER_ID", payload: cached.playerId || null });
        dispatch({ type: "SET_LOADING", payload: false });
      }

      let data: ApiUserProfile;
      try {
        data = await apiRequest<ApiUserProfile>("/api/users/me");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/^API (401|403|404)/.test(message)) {
          await signOutUser();
          if (strict) {
            throw new Error(
              "This account is not set up for this site. Ask an admin to add you, or request an account."
            );
          }
        } else {
          console.error("Auth revalidation error:", err);
          dispatch({ type: "SET_LOADING", payload: false });
          if (strict) throw err;
        }
        return;
      }

      try {
        const uid = data.uid as string;
        const currentUser: AuthUser = {
          uid,
          email: data.email ?? email,
          displayName: data.displayName || claims.name || emailFallback,
        };
        setCurrentUid(uid);

        const userRoles = data.roles || {};
        const currentRole = userRoles[program]?.toLowerCase() || null;
        const displayName = data.displayName || claims.name || email || "";

        const programs = Object.keys(userRoles || {});
        const dataProgramSort = JSON.stringify((data.programs || []).sort());
        const programSort = JSON.stringify(programs.sort());
        if (!data.programs || dataProgramSort !== programSort) {
          await apiRequest<ApiUserProfile>(`/api/users/${uid}`, {
            method: "PUT",
            json: { programs },
          });
        }

        dispatch({ type: "SET_USER", payload: currentUser });
        dispatch({ type: "SET_ROLE", payload: currentRole });
        dispatch({ type: "SET_ROLES", payload: userRoles });
        dispatch({ type: "SET_USERNAME", payload: displayName });
        dispatch({ type: "SET_PLAYER_ID", payload: data.playerId || null });
        dispatch({ type: "SET_LOADING", payload: false });

        localStorage.setItem(
          `authCache_${program}`,
          JSON.stringify({
            uid,
            role: currentRole,
            roles: userRoles,
            name: displayName,
            playerId: data.playerId || null,
            ts: Date.now(),
          })
        );

        if (!data.playerId && currentRole && ["player", "admin"].includes(currentRole) && displayName) {
          await tryAutoLinkPlayer(currentUser, displayName);
        }
      } catch (err) {
        console.error("Auth revalidation error:", err);
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [getCachedAuth, getProgramProp, signOutUser]
  );

  useEffect(() => {
    hydrate(false).catch((err) => {
      console.error("Auth startup error:", err);
      dispatch({ type: "SET_LOADING", payload: false });
    });
  }, [hydrate]);

  const signInUser = useCallback(
    async (email: string, password: string) => {
      await cognitoSignIn(email, password);
      await hydrate(true);
    },
    [hydrate]
  );

  const isAdmin = useMemo(() => state.role === "admin", [state.role]);
  const isAuthenticated = useMemo(() => !!state.user, [state.user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAdmin,
      isAuthenticated,
      dispatch,
      signIn: signInUser,
      signOut: signOutUser,
    }),
    [state, isAdmin, isAuthenticated, signInUser, signOutUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function tryAutoLinkPlayer(
  authUser: AuthUser,
  displayName: string
) {
  try {
    const currentSeason = await fetchActiveSeasonCode();

    let player = await apiRequest<{ id?: string; email?: string }>(
      `/api/players/search?name=${encodeURIComponent(displayName)}&season=${encodeURIComponent(currentSeason)}`
    ).catch(() => null);

    if (!player?.id && authUser.email) {
      const allPlayers = await apiRequest<{ id?: string; email?: string }[]>(
        `/api/players?season=${encodeURIComponent(currentSeason)}`
      ).catch(() => []);
      const emailLower = authUser.email.toLowerCase();
      player = allPlayers.find(
        (p) => p.email && p.email.toLowerCase() === emailLower
      ) || null;
    }

    if (player?.id) {
      const playerId = player.id;

      await apiRequest(`/api/users/${authUser.uid}`, {
        method: "PUT",
        json: { playerId },
      });
      await apiRequest(`/api/players/${playerId}`, {
        method: "PUT",
        json: { userUid: authUser.uid },
      });
    }
  } catch (err) {
    console.error("Error auto-linking player:", err);
  }
}

