// src/Men/Local/Admin/Tabs/Users/UserList.jsx
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
  handleDelete?: (userId: string) => void;
};

export default function UserList({ users, handleRoleChange, handleDelete }: UserListProps) {
  const confirm = useConfirm();
  return (
    <div className="flex flex-col gap-2">
      {users.map(user => (
        <div key={user.id} className="flex justify-between items-center border p-2 rounded">
          <span>{user.displayName || user.email || user.id}</span>
          <div className="flex items-center gap-2">
            <select
              value={user.role}
              onChange={(e) => handleRoleChange(user.id, e.target.value)}
              className="border rounded px-2 py-1"
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
                className="px-2 py-1 border border-red-600 text-red-600 rounded hover:bg-red-50"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
