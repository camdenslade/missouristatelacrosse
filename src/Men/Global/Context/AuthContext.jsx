// src/Men/Global/Context/AuthContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useMemo,
  useCallback,
} from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "../../../Services/firebaseConfig";


const initialState = {
  user: null,
  role: null,
  roles: {},
  userName: "",
  loading: true,
};

function authReducer(state, action) {
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


const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  
  const getCachedAuth = useCallback(() => {
    try {
      const cached = JSON.parse(localStorage.getItem("authCache"));
      if (!cached) return null;
      const expired = Date.now() - cached.ts > 60 * 60 * 1000; // 1 hr
      if (expired) {
        localStorage.removeItem("authCache");
        return null;
      }
      return cached;
    } catch {
      return null;
    }
  }, []);

  const getProgramProp = useCallback( () => window.location.pathname.toLowerCase().includes("/women") ? "women" : "men", []);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        dispatch({ type: "RESET" });
        localStorage.removeItem("authCache");
        return;
      }

      dispatch({ type: "SET_USER", payload: currentUser });
      dispatch({ type: "SET_LOADING", payload: true });

      const cached = getCachedAuth();
      if (cached && auth.currentUser) {
        dispatch({ type: "SET_USER", payload: auth.currentUser });
        dispatch({ type: "SET_ROLE", payload: cached.role });
        dispatch({ type: "SET_ROLES", payload: cached.roles || {} });
        dispatch({ type: "SET_USERNAME", payload: cached.name });
        dispatch({ type: "SET_LOADING", payload: false });
      }

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);
        const program = getProgramProp();

        let data = {};
        if (snap.exists()) {
          data = snap.data();
        } else {
          data = {
            email: currentUser.email,
            displayName:
              currentUser.displayName || currentUser.email.split("@")[0],
            roles: { [program]: "player" },
          };
          await setDoc(userRef, data, { merge: true });
        }

        const userRoles = data.roles || {};
        const currentRole =
          userRoles[program]?.toLowerCase() || data.role || "player";
        const displayName =
          data.displayName ||
          currentUser.displayName ||
          currentUser.email ||
          "";

        const programs = Object.keys(userRoles || {});
        let dataProgramSort = JSON.stringify(data.programs.sort());
        let programSort = JSON.stringify(programs.sort());
        if (!data.programs || dataProgramSort !== programSort) {
          await updateDoc(userRef, { programs });
        }

        dispatch({ type: "SET_USER", payload: currentUser });
        dispatch({ type: "SET_ROLE", payload: currentRole });
        dispatch({ type: "SET_ROLES", payload: userRoles });
        dispatch({ type: "SET_USERNAME", payload: displayName });
        dispatch({ type: "SET_LOADING", payload: false });

        localStorage.setItem(
          "authCache",
          JSON.stringify({
            role: currentRole,
            roles: userRoles,
            name: displayName,
            ts: Date.now(),
          })
        );

        if (!data.playerId && currentRole === "player" && displayName) {
          await tryAutoLinkPlayer(currentUser, userRef, displayName, program);
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
      localStorage.removeItem("authCache");
    }
  }, []);

  const isAdmin = useMemo(() => state.role === "admin", [state.role]);
  const isAuthenticated = useMemo(() => !!state.user, [state.user]);

  const value = useMemo(
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

async function tryAutoLinkPlayer(firebaseUser, userRef, displayName, program) {
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const start = m >= 8 ? y : y - 1;
    const currentSeason = `${String(start).slice(-2)}-${String(
      start + 1
    ).slice(-2)}`;

    const playersRef = collection(
      db,
      program === "women" ? "playersw" : "players"
    );
    const q = query(
      playersRef,
      where("name", "==", displayName),
      where("season", "==", currentSeason)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const playerDoc = snap.docs[0];
      const playerId = playerDoc.id;

      await updateDoc(userRef, { playerId });
      await updateDoc(playerDoc.ref, { userID: firebaseUser.uid });

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
