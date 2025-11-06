import { Link } from "react-router-dom";

import { getProgramInfo } from "../../Services/programHelper.js";

export default function MobileMenu({
  open,
  setOpen,
  user,
  roles,
  userName,
  signOut,
  onManageArticles,
  onAuthOpen,
}) {
  if (!open) return null;

  const { program, base } = getProgramInfo();

  const linkHover = "hover:text-[#D3D3D3] transition-colors";
  const programLink = (path) =>
    `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const programRole = roles?.[program];
  const isAdmin = programRole === "admin";
  const isPlayer = programRole === "player";
  const isParent = programRole === "parent";
  const canSeePayments = user && (isAdmin || isPlayer || isParent);
  const isGlobalAdmin = roles?.men === "admin" || roles?.women === "admin";

  return (
    <div className="md:hidden bg-[#5E0009] text-white px-4 pb-4 flex flex-col gap-2">
      {/* Public links */}
      <Link to={programLink("")} className={linkHover} onClick={() => setOpen(false)}>
        Home
      </Link>
      <Link to={programLink("/schedule")} className={linkHover} onClick={() => setOpen(false)}>
        Schedule
      </Link>
      <Link to={programLink("/roster")} className={linkHover} onClick={() => setOpen(false)}>
        Roster
      </Link>
      <Link to={programLink("/store")} className={linkHover} onClick={() => setOpen(false)}>
        Team Store
      </Link>
      <Link to={programLink("/recruitment")} className={linkHover} onClick={() => setOpen(false)}>
        Recruitment
      </Link>
      <Link to={programLink("/donate")} className={linkHover} onClick={() => setOpen(false)}>
        Donate
      </Link>
      <Link to={programLink("/gallery")} className={linkHover} onClick={() => setOpen(false)}>
        Gallery
      </Link>

      {/* Payments */}
      {canSeePayments && (
        <Link
          to={programLink("/payments")}
          className={linkHover}
          onClick={() => setOpen(false)}
        >
          Payments
        </Link>
      )}

      {/* Authenticated user options */}
      {user ? (
        <>
          <div className="border-t border-gray-400 my-2"></div>
          <div className="font-bold px-2">{userName}</div>

          {/* Admin Panel */}
          {isGlobalAdmin && (
            <Link
              to={programLink("/admin")}
              className="text-left px-2 py-1 hover:text-[#D3D3D3]"
              onClick={() => setOpen(false)}
            >
              Admin Panel
            </Link>
          )}

          {/* Manage Articles */}
          {(isAdmin || isPlayer) && (
            <button
              className="text-left px-2 py-1 hover:text-[#D3D3D3]"
              onClick={() => {
                onManageArticles?.();
                setOpen(false);
              }}
            >
              Manage Articles
            </button>
          )}

          <Link
            to={programLink("/settings")}
            className="text-left px-2 py-1 hover:text-[#D3D3D3]"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>

          <button
            className="text-left px-2 py-1 hover:text-[#D3D3D3]"
            onClick={() => {
              signOut();
              setOpen(false);
            }}
          >
            Sign Out
          </button>
        </>
      ) : (
        <button
          className="text-left px-2 py-1 hover:text-[#D3D3D3]"
          onClick={() => {
            onAuthOpen?.();
            setOpen(false);
          }}
        >
          Sign In
        </button>
      )}
    </div>
  );
}
