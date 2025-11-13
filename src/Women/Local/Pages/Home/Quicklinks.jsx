// src/Women/Local/Pages/Home/Quicklinks.jsx
export default function Quicklinks() {
  return (
    <section className="bg-gray-100 py-12">
      <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
        <a href="/roster" className="bg-white p-8 rounded-lg shadow hover:shadow-lg transition">
          <h3 className="text-2xl font-semibold mb-4">Roster</h3>
          <p>Meet the players who make up the Women's Lacrosse team.</p>
        </a>
        <a href="/schedule" className="bg-white p-8 rounded-lg shadow hover:shadow-lg transition">
          <h3 className="text-2xl font-semibold mb-4">Schedule</h3>
          <p>See upcoming games, results, and locations.</p>
        </a>
        <a href="/store" className="bg-white p-8 rounded-lg shadow hover:shadow-lg transition">
          <h3 className="text-2xl font-semibold mb-4">Team Store</h3>
          <p>Shop official Missouri State Women's Lacrosse merchandise.</p>
        </a>
        <a
          href="https://www.wcla.club/page/show/9214843-missouri-state"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white p-8 rounded-lg shadow hover:shadow-lg transition"
        >
          <h3 className="text-2xl font-semibold mb-4">WCLA Page</h3>
          <p>Visit the Bears WCLA page.</p>
        </a>
      </div>
    </section>
  );
}