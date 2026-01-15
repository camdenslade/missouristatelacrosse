// src/Women/Local/Admin/Tabs/Users/UserList.jsx
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
              <option value="admin">Admin</option>
            </select>
            {handleDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete ${user.displayName || user.email || "this user"}?`)) {
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
