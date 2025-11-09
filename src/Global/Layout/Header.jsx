import { useEffect, useReducer, useRef } from "react";
import { FaBars, FaTimes, FaUserCircle } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";

import { getProgramInfo } from "../../Services/programHelper.js";
import { useAuth } from "../Context/AuthContext.jsx";
import MobileMenu from "./Mobile.jsx";

const initialState = {
  showUserMenu: false,
  mobileMenuOpen: false,
};

function reducer(state, action) {
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

export default function Header({ onManageArticles, onManageArticlesWomen, onAuthOpen }) {
  const { user, roles, userName, signOut } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { showUserMenu, mobileMenuOpen } = state;

  const userMenuRef = useRef(null);
  const navigate = useNavigate();

  const { isWomen, program, base } = getProgramInfo();

  const programRole = roles?.[program];
  const isAdmin = programRole === "admin";
  const isPlayer = programRole === "player";
  const isParent = programRole === "parent";
  const canSeePayments = user && (isAdmin || isPlayer || isParent);
  const isGlobalAdmin = roles?.men === "admin" || roles?.women === "admin";
  

  const linkHover =
    "hover:text-[#D3D3D3] transition-colors duration-200 ease-in-out";
  const programLink = (path) =>
    `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const handleSwitchProgram = () => {
    navigate(isWomen ? "/" : "/women", { replace: true });
    dispatch({ type: "CLOSE_USER_MENU" });
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        dispatch({ type: "CLOSE_USER_MENU" });
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <header className="bg-[#5E0009] text-white w-full shadow-md sticky top-0 z-50">
      <div className="w-full px-4 py-4 flex items-center">
        <Link
          to={programLink("")}
          className="inline-flex items-center"
          onClick={() => dispatch({ type: "CLOSE_USER_MENU" })}
        >
          <img
            src="/assets/msu.png"
            alt="Missouri State Lacrosse"
            className="h-8 sm:h-10 md:h-12 object-contain"
          />
        </Link>

        <div className="ml-auto flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-6">
            <Link to={programLink("")} className={linkHover}>Home</Link>
            <Link to={programLink("/schedule")} className={linkHover}>Schedule</Link>
            <Link to={programLink("/roster")} className={linkHover}>Roster</Link>
            <Link to={programLink("/store")} className={linkHover}>Team Store</Link>
            <Link to={programLink("/recruitment")} className={linkHover}>Recruitment</Link>
            <Link to={programLink("/donate")} className={linkHover}>Donate</Link>
            <Link to={programLink("/gallery")} className={linkHover}>Gallery</Link>
            {canSeePayments && (
              <Link to={programLink("/payments")} className={linkHover}>Payments</Link>
            )}
          </nav>

          <div className="relative hidden md:block" ref={userMenuRef}>
            <FaUserCircle
              className="h-8 w-8 cursor-pointer"
              aria-label="User menu"
              onClick={() =>
                user
                  ? dispatch({ type: "TOGGLE_USER_MENU" })
                  : onAuthOpen?.()
              }
            />

            {user && showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white text-black shadow-lg rounded z-50">
                <div className="px-4 py-2 font-bold border-b">
                  {userName || "User"}
                </div>
                <button
                  onClick={handleSwitchProgram}
                  className="block w-full px-4 py-2 text-left hover:bg-gray-200"
                >
                  {isWomen ? "Switch to Men’s Site" : "Switch to Women’s Site"}
                </button>
                {isGlobalAdmin && (
                  <Link
                    to={programLink("/admin")}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-200"
                    onClick={() => dispatch({ type: "CLOSE_USER_MENU" })}
                  >
                    Admin Panel
                  </Link>
                )}
                {(isAdmin || isPlayer) && (
                  <button
                    className="block w-full px-4 py-2 text-left hover:bg-gray-200"
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
                  className="block w-full px-4 py-2 text-left hover:bg-gray-200"
                  onClick={() => dispatch({ type: "CLOSE_USER_MENU" })}
                >
                  Settings
                </Link>
                <button
                  className="block w-full px-4 py-2 text-left hover:bg-gray-200"
                  onClick={() => {
                    signOut();
                    dispatch({ type: "CLOSE_USER_MENU" });
                  }}
                >
                  Sign Out
                </button>
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
        userRole={programRole}
        roles={roles}
        userName={userName}
        signOut={signOut}
        onManageArticles={onManageArticles}
        onManageArticlesWomen={onManageArticlesWomen}
        onAuthOpen={onAuthOpen}
        canSeePayments={canSeePayments}
        base={base}
      />
    </header>
  );
}
