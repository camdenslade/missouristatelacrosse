import { useEffect, useReducer, useRef } from "react";
import { FaBars, FaTimes, FaUserCircle } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";

import { getProgramInfo } from "../../Services/programHelper";
import { useAuth } from "../Context/AuthContext";
import MobileMenu from "./Mobile";

const initialState = {
  showUserMenu: false,
  mobileMenuOpen: false,
};

type HeaderState = typeof initialState;

type HeaderAction =
  | { type: "TOGGLE_USER_MENU" }
  | { type: "CLOSE_USER_MENU" }
  | { type: "TOGGLE_MOBILE_MENU" }
  | { type: "CLOSE_MOBILE_MENU" };

function reducer(state: HeaderState, action: HeaderAction) {
  switch (action.type) {
    case "TOGGLE_USER_MENU":
      return { ...state, showUserMenu: !state.showUserMenu };
    case "CLOSE_USER_MENU":
      return { ...state, showUserMenu: false };
    case "TOGGLE_MOBILE_MENU":
      return { ...state, mobileMenuOpen: !state.mobileMenuOpen };
    case "CLOSE_MOBILE_MENU":
      return { ...state, mobileMenuOpen: false };
    default:
      return state;
  }
}

type HeaderProps = {
  onManageArticles?: () => void;
  onManageArticlesWomen?: () => void;
  onAuthOpen?: () => void;
};

export default function Header({ onManageArticles, onManageArticlesWomen, onAuthOpen }: HeaderProps) {
  const { user, roles, userName, signOut } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { showUserMenu, mobileMenuOpen } = state;

  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const { isWomen, program, base } = getProgramInfo();

  const programRole = roles?.[program];
  const isAdmin = programRole === "admin";
  const isPlayer = programRole === "player";
  const isParent = programRole === "parent";
  const isAlumni = programRole === "alumni";
  const canSeePayments = user && (isAdmin || isPlayer || isParent);
  const canSeeAlumni = user && (isAdmin || isAlumni);
  const isGlobalAdmin = roles?.men === "admin" || roles?.women === "admin";
  

  const linkHover =
    "text-xs font-semibold uppercase tracking-widest hover:text-white/70 transition-colors duration-200";
  const programLink = (path) =>
    `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const handleSwitchProgram = () => {
    navigate(isWomen ? "/" : "/women", { replace: true });
    dispatch({ type: "CLOSE_USER_MENU" });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && e.target instanceof Node && !userMenuRef.current.contains(e.target)) {
        dispatch({ type: "CLOSE_USER_MENU" });
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <header className="bg-[#5E0009] text-white w-full shadow-lg sticky top-0 z-50 border-b border-white/10">
      <div className="w-full px-6 py-3 flex items-center">
        <Link
          to={programLink("")}
          className="inline-flex items-center"
          onClick={() => dispatch({ type: "CLOSE_USER_MENU" })}
        >
          <img
            src="/assets/msu.png"
            alt="Missouri State Lacrosse"
            className="h-9 sm:h-10 md:h-11 object-contain"
          />
        </Link>

        <div className="ml-auto flex items-center gap-5">
          <nav className="hidden md:flex items-center gap-5">
            <Link to={programLink("")} className={linkHover}>Home</Link>
            <div className="relative group flex items-center">
              <Link to={programLink("/schedule")} className={linkHover}>Schedule</Link>
              <div className="absolute left-0 top-full pt-2 hidden group-hover:block z-50 min-w-[140px]">
                <div className="bg-white text-gray-800 shadow-xl rounded-md overflow-hidden border border-gray-100 text-xs font-semibold uppercase tracking-widest">
                  <Link to={programLink("/schedule")} className="block px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    Schedule
                  </Link>
                  <Link to={programLink("/stats")} className="block px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    Stats
                  </Link>
                </div>
              </div>
            </div>
            <Link to={programLink("/roster")} className={linkHover}>Roster</Link>
            <Link to={programLink("/store")} className={linkHover}>Store</Link>
            <Link to={programLink("/recruitment")} className={linkHover}>Recruitment</Link>
            <Link to={programLink("/event-signup")} className={linkHover}>Events</Link>
            <div className="relative group flex items-center">
              <Link to={programLink("/donate")} className={linkHover}>Donate</Link>
              <div className="absolute left-0 top-full pt-2 hidden group-hover:block z-50 min-w-[140px]">
                <div className="bg-white text-gray-800 shadow-xl rounded-md overflow-hidden border border-gray-100 text-xs font-semibold uppercase tracking-widest">
                  <Link to={programLink("/donate")} className="block px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    Donate
                  </Link>
                  <Link to={programLink("/raffles")} className="block px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    Raffles
                  </Link>
                  <Link to={programLink("/sponsorships")} className="block px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    Sponsorships
                  </Link>
                </div>
              </div>
            </div>
            <Link to={programLink("/gallery")} className={linkHover}>Gallery</Link>
            {canSeePayments && (
              <Link to={programLink("/payments")} className={linkHover}>Payments</Link>
            )}
            {canSeeAlumni && (
              <div className="relative group flex items-center">
                <span className={`${linkHover} cursor-default`}>Alumni</span>
                <div className="absolute left-0 top-full pt-2 hidden group-hover:block z-50 min-w-40">
                  <div className="bg-white text-gray-800 shadow-xl rounded-md overflow-hidden border border-gray-100 text-xs font-semibold uppercase tracking-widest">
                    <Link to={programLink("/alumni-budget")} className="block px-4 py-2.5 hover:bg-gray-50 transition-colors">
                      Program Budget
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </nav>

          <div className="relative hidden md:block" ref={userMenuRef}>
            <FaUserCircle
              className="h-7 w-7 cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
              aria-label="User menu"
              onClick={() =>
                user
                  ? dispatch({ type: "TOGGLE_USER_MENU" })
                  : onAuthOpen?.()
              }
            />

            {user && showUserMenu && (
              <div className="absolute right-0 mt-3 w-56 bg-white text-gray-800 shadow-xl rounded-md overflow-hidden z-50 border border-gray-100">
                <div className="px-4 py-3 font-bold text-sm border-b border-gray-100 bg-gray-50">
                  {userName || "User"}
                </div>
                <button
                  onClick={handleSwitchProgram}
                  className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors"
                >
                  {isWomen ? "Switch to Men's Site" : "Switch to Women's Site"}
                </button>
                {isGlobalAdmin && (
                  <Link
                    to={programLink("/admin")}
                    className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors"
                    onClick={() => dispatch({ type: "CLOSE_USER_MENU" })}
                  >
                    Admin Panel
                  </Link>
                )}
                {(isAdmin || isPlayer) && (
                  <button
                    className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      (isWomen ? onManageArticlesWomen : onManageArticles)?.();
                      dispatch({ type: "CLOSE_USER_MENU" });
                    }}
                  >
                    Manage Articles
                  </button>
                )}
                <Link
                  to={programLink("/settings")}
                  className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors"
                  onClick={() => dispatch({ type: "CLOSE_USER_MENU" })}
                >
                  Settings
                </Link>
                <div className="border-t border-gray-100">
                  <button
                    className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors text-red-600"
                    onClick={() => {
                      signOut();
                      dispatch({ type: "CLOSE_USER_MENU" });
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <button
              aria-label="Toggle mobile menu"
              onClick={() => dispatch({ type: "TOGGLE_MOBILE_MENU" })}
            >
              {mobileMenuOpen ? (
                <FaTimes className="h-6 w-6" />
              ) : (
                <FaBars className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      <MobileMenu
        open={mobileMenuOpen}
        setOpen={(val) =>
          dispatch({ type: val ? "TOGGLE_MOBILE_MENU" : "CLOSE_MOBILE_MENU" })
        }
        user={user}
        roles={roles}
        userName={userName}
        signOut={signOut}
        onManageArticles={onManageArticles}
        onManageArticlesWomen={onManageArticlesWomen}
        onAuthOpen={onAuthOpen}
      />
    </header>
  );
}

