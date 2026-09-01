const ROLE_OPTIONS = ["admin", "player", "parent", "coach", "alumni", "user"];

export default function UserSearch({ searchTerm, setSearchTerm, roleFilter, setRoleFilter }) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <input
        type="text"
        placeholder="Search by name"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
      />
      {setRoleFilter && (
        <select
          value={roleFilter || ""}
          onChange={e => setRoleFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30"
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
