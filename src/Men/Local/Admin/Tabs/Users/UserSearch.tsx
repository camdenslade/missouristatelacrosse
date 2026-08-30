const ROLE_OPTIONS = ["admin", "player", "parent", "coach", "alumni", "user"];

export default function UserSearch({ searchTerm, setSearchTerm, roleFilter, setRoleFilter }) {
  return (
    <div className="flex gap-2 mb-4">
      <input
        type="text"
        placeholder="Search by name"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="border px-3 py-2 rounded w-full"
      />
      {setRoleFilter && (
        <select
          value={roleFilter || ""}
          onChange={e => setRoleFilter(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          <option value="">All Roles</option>
          {ROLE_OPTIONS.map(r => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
      )}
    </div>
  );
}
