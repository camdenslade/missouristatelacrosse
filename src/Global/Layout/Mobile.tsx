import type { User as FirebaseUser } from "firebase/auth";
import { Link } from "react-router-dom";
import type { Program, Role } from "../../types/api";

import { getProgramInfo } from "../../Services/programHelper";

type MobileMenuProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  user: FirebaseUser | null;
  roles?: Partial<Record<Program, Role>>;
  userName: string;
  signOut: () => Promise<void> | void;
  onManageArticles?: () => void;
  onManageArticlesWomen?: () => void;
  onAuthOpen?: () => void;
};

export default function MobileMenu({
  open,
  setOpen,
  user,
  roles,
  userName,
  signOut,
  onManageArticles,
  onManageArticlesWomen,
  onAuthOpen,
}: MobileMenuProps) {
  if (!open) return null;

  const { program, base } = getProgramInfo();

  const linkHover = "text-sm font-semibold uppercase tracking-wider py-1.5 hover:text-white/70 transition-colors";
  const programLink = (path) =>
    `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const programRole = roles?.[program];
  const isAdmin = programRole === "admin";
  const isPlayer = programRole === "player";
  const isParent = programRole === "parent";
  const canSeePayments = user && (isAdmin || isPlayer || isParent);
  const isGlobalAdmin = roles?.men === "admin" || roles?.women === "admin";

  return (
    <div className="md:hidden bg-[#5E0009] text-white px-6 pb-5 pt-1 flex flex-col gap-1 border-t border-white/10">
      {/* Public links */}
      <Link to={programLink("")} className={linkHover} onClick={() => setOpen(false)}>
        Home
      </Link>
      <Link to={programLink("/schedule")} className={linkHover} onClick={() => setOpen(false)}>
        Schedule
      </Link>
      <Link to={programLink("/stats")} className={`${linkHover} pl-3 text-white/70`} onClick={() => setOpen(false)}>
        Stats
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
      <Link to={programLink("/event-signup")} className={linkHover} onClick={() => setOpen(false)}>
        Events
      </Link>
      <Link to={programLink("/donate")} className={linkHover} onClick={() => setOpen(false)}>
        Donate
      </Link>
      <Link to={programLink("/raffles")} className={`${linkHover} pl-3 text-white/70`} onClick={() => setOpen(false)}>
        Raffles
      </Link>
      <Link to={programLink("/sponsorships")} className={`${linkHover} pl-3 text-white/70`} onClick={() => setOpen(false)}>
        Sponsorships
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
          <div className="border-t border-white/20 my-3"></div>
          <div className="font-bold text-sm px-1 opacity-80">{userName}</div>

          {/* Admin Panel */}
          {isGlobalAdmin && (
            <Link
              to={programLink("/admin")}
              className="text-left px-2 py-1 hover:text-white/70 transition-colors"
              onClick={() => setOpen(false)}
            >
              Admin Panel
            </Link>
          )}

          {/* Manage Articles */}
          {(isAdmin || isPlayer) && (
            <button
              className="text-left px-2 py-1 hover:text-white/70 transition-colors"
              onClick={() => {
                (program === "women" ? onManageArticlesWomen : onManageArticles)?.();
                setOpen(false);
              }}
            >
              Manage Articles
            </button>
          )}

          <Link
            to={programLink("/settings")}
            className="text-left px-2 py-1 hover:text-white/70 transition-colors"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>

          <button
            className="text-left px-2 py-1 hover:text-white/70 transition-colors"
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
          className="text-left px-2 py-1 hover:text-white/70 transition-colors"
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

