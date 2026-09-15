import { useState } from "react";

import { useConfirm } from "../../../../../Global/Common/components/ConfirmModal";

type UserEntry = {
  id: string;
  displayName?: string | null;
  email?: string | null;
  role: string;
};

type UserListProps = {
  users: UserEntry[];
  handleRoleChange: (userId: string, role: string) => void;
  handleDisplayNameChange?: (userId: string, displayName: string) => Promise<void> | void;
  handleEmailChange?: (userId: string, email: string) => Promise<void> | void;
  handleDelete?: (userId: string) => void;
  handleResendInvite?: (userId: string) => Promise<void> | void;
};

export default function UserList({ users, handleRoleChange, handleDisplayNameChange, handleEmailChange, handleDelete, handleResendInvite }: UserListProps) {
  const confirm = useConfirm();
  const [resendState, setResendState] = useState<Record<string, "sending" | "sent" | "error">>({});
  const [editingNameFor, setEditingNameFor] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [editingEmailFor, setEditingEmailFor] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");

  const onResend = async (userId: string) => {
    if (!handleResendInvite) return;
    setResendState((prev) => ({ ...prev, [userId]: "sending" }));
    try {
      await handleResendInvite(userId);
      setResendState((prev) => ({ ...prev, [userId]: "sent" }));
    } catch {
      setResendState((prev) => ({ ...prev, [userId]: "error" }));
    }
  };

  const startNameEdit = (user: UserEntry) => {
    setEditingNameFor(user.id);
    setNameDraft(user.displayName || "");
    setNameError("");
  };

  const saveName = async (userId: string) => {
    const displayName = nameDraft.trim();
    if (!displayName || !handleDisplayNameChange) return;
    setSavingName(true);
    setNameError("");
    try {
      await handleDisplayNameChange(userId, displayName);
      setEditingNameFor(null);
    } catch {
      setNameError("Could not save this name. Please try again.");
    } finally {
      setSavingName(false);
    }
  };

  const startEmailEdit = (user: UserEntry) => {
    setEditingEmailFor(user.id);
    setEmailDraft(user.email || "");
    setEmailError("");
  };

  const saveEmail = async (userId: string) => {
    const email = emailDraft.trim();
    if (!email || !handleEmailChange) return;
    setSavingEmail(true);
    setEmailError("");
    try {
      await handleEmailChange(userId, email);
      setEditingEmailFor(null);
    } catch {
      setEmailError("Could not save this email. Please try again.");
    } finally {
      setSavingEmail(false);
    }
  };

  return (
    <ul className="divide-y divide-gray-100">
      {users.map(user => (
        <li
          key={user.id}
          className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-gray-50 rounded-lg px-2 transition"
        >
          <div className="min-w-0">
            {editingNameFor === user.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  aria-label="User display name"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => saveName(user.id)}
                  disabled={savingName || !nameDraft.trim()}
                  className="text-sm text-[#5E0009] hover:underline disabled:opacity-50"
                >
                  {savingName ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingNameFor(null)}
                  disabled={savingName}
                  className="text-sm text-gray-500 hover:underline disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900">{user.displayName || user.email || user.id}</span>
                {handleDisplayNameChange && (
                  <button
                    type="button"
                    onClick={() => startNameEdit(user)}
                    className="text-xs text-[#5E0009] hover:underline"
                  >
                    Edit name
                  </button>
                )}
              </div>
            )}
            {editingNameFor === user.id && nameError && (
              <p className="text-xs text-red-600 mt-1">{nameError}</p>
            )}
            {editingEmailFor === user.id ? (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <input
                  aria-label="User email"
                  type="email"
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => saveEmail(user.id)}
                  disabled={savingEmail || !emailDraft.trim()}
                  className="text-sm text-[#5E0009] hover:underline disabled:opacity-50"
                >
                  {savingEmail ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingEmailFor(null)}
                  disabled={savingEmail}
                  className="text-sm text-gray-500 hover:underline disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              (user.displayName || handleEmailChange) && (
                <div className="flex items-center gap-2">
                  {user.email && <p className="text-gray-500 text-sm truncate">{user.email}</p>}
                  {handleEmailChange && (
                    <button
                      type="button"
                      onClick={() => startEmailEdit(user)}
                      className="text-xs text-[#5E0009] hover:underline shrink-0"
                    >
                      {user.email ? "Edit email" : "Add email"}
                    </button>
                  )}
                </div>
              )
            )}
            {editingEmailFor === user.id && emailError && (
              <p className="text-xs text-red-600 mt-1">{emailError}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {handleResendInvite && (
              <button
                type="button"
                onClick={() => onResend(user.id)}
                disabled={resendState[user.id] === "sending"}
                title="Send this user a new 'set your password' link"
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm transition disabled:opacity-50"
              >
                {resendState[user.id] === "sending"
                  ? "Sending..."
                  : resendState[user.id] === "sent"
                  ? "Sent!"
                  : resendState[user.id] === "error"
                  ? "Failed - retry"
                  : "Resend Link"}
              </button>
            )}
            <select
              value={user.role}
              onChange={(e) => handleRoleChange(user.id, e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
            >
              <option value="user">User</option>
              <option value="player">Player</option>
              <option value="parent">Parent</option>
              <option value="coach">Coach</option>
              <option value="alumni">Alumni</option>
              <option value="admin">Admin</option>
            </select>
            {handleDelete && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm(`Delete ${user.displayName || user.email || "this user"}?`);
                  if (ok) {
                    handleDelete(user.id);
                  }
                }}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm transition"
              >
                Delete
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
