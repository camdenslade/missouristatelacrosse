// src/Men/Local/Admin/Tabs/Users/UserList.jsx
export default function UserList({ users, handleRoleChange }) {
  return (
    <div className="flex flex-col gap-2">
      {users.map(user => (
        <div key={user.id} className="flex justify-between items-center border p-2 rounded">
          <span>{user.displayName}</span>
          <select
            value={user.role}
            onChange={(e) => handleRoleChange(user.id, e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="user">User</option>
            <option value="player">Player</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      ))}
    </div>
  );
}
