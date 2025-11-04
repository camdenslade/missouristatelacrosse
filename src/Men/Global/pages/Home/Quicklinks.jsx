// src/Men/Global/pages/Home/Quicklinks.jsx
export default function Quicklinks() {
  return (
    <section className="bg-gray-100 py-12">
      <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
        <a href="/roster" className="bg-white p-8 rounded-lg shadow hover:shadow-lg transition">
          <h3 className="text-2xl font-semibold mb-4">Roster</h3>
          <p>Meet the players who make up the Bears Lacrosse team.</p>
        </a>
        <a href="/schedule" className="bg-white p-8 rounded-lg shadow hover:shadow-lg transition">
          <h3 className="text-2xl font-semibold mb-4">Schedule</h3>
          <p>See upcoming games, results, and locations.</p>
        </a>
        <a href="/teamstore" className="bg-white p-8 rounded-lg shadow hover:shadow-lg transition">
          <h3 className="text-2xl font-semibold mb-4">Team Store</h3>
          <p>Shop official Missouri State Lacrosse merchandise.</p>
        </a>
        <a
          href="https://mcla.us/teams/missouri-state/2025/schedule"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white p-8 rounded-lg shadow hover:shadow-lg transition"
        >
          <h3 className="text-2xl font-semibold mb-4">MCLA Page</h3>
          <p>Visit the Bears MCLA page.</p>
        </a>
      </div>
    </section>
  );
}