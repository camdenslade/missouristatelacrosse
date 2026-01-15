// src/Women/Local/Admin/Tabs/Users/UserSearch.jsx
export default function UserSearch({ searchTerm, setSearchTerm }) {
  return (
    <input
      type="text"
      placeholder="Search by name"
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
      className="border px-3 py-2 rounded mb-4 w-full"
    />
  );
}
