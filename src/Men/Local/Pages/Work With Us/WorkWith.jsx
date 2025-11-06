// src/Men/Local/Pages/Work With Us/WorkWith.jsx
export default function WorkWith() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 text-gray-800">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-bold text-[#5E0009] mb-4"
      >
        Missouri State University Men’s Lacrosse
      </motion.h1>

      <h2 className="text-xl font-semibold mb-2">Advertising Opportunities</h2>
      <h3 className="text-lg font-semibold text-gray-700 mb-4">
        Subject: Sponsorship Opportunities
      </h3>

      <p className="mb-4">
        We are excited to introduce the <strong>Missouri State Men’s Lacrosse team</strong>, a
        local 501(c)(3) organization in search of opportunities to engage with our community. We are
        reaching out to local businesses to explore potential sponsorship opportunities for our
        team’s upcoming season.
      </p>

      <p className="mb-4">
        As a local business that values community engagement and growth, we believe that a
        partnership with our organization is a mutually beneficial opportunity. Your sponsorship
        helps us maintain and improve our team’s facilities, equipment, and travel expenses while
        also providing your business with valuable (and tax-free) exposure.
      </p>

      <h4 className="text-lg font-semibold mb-3">
        Here are some ways your business can get involved:
      </h4>

      <ul className="list-decimal pl-6 space-y-4">
        <li>
          <strong>Team Sponsor:</strong> Become an official sponsor of Missouri State Lacrosse. Your
          logo will be prominently displayed on our team jerseys, travel gear, banners at games, in
          social media posts, and on our website. This level of sponsorship offers extremely high
          visibility among our supporters and the lacrosse community.
          <span className="block text-sm text-gray-600 mt-1">
            (Contact us to discuss details)
          </span>
        </li>

        <li>
          <strong>Advertisement Sponsor:</strong> Your business name and logo will be featured on
          our promotional materials and banners displayed at our facility. We’ll also give your
          business shoutouts during home events — a great way to engage directly with fans and
          potential customers.
          <span className="block text-sm text-gray-600 mt-1">
            ($500 – 4x8 banner, $250 – 4x4 banner)
          </span>
        </li>

        <li>
          <strong>Travel Sponsor:</strong> Your business name and logo will appear on our team
          travel gear as we compete across the country. This is a great opportunity to get new eyes
          on your business while supporting student-athletes.
          <span className="block text-sm text-gray-600 mt-1">($100)</span>
        </li>
      </ul>

      <p className="mt-6 mb-4">
        We would be more than happy to discuss sponsorship levels in detail and tailor a package
        that aligns with your business goals and budget.
      </p>

      <p className="mb-4">
        Your support not only helps us promote sportsmanship, teamwork, and skill development among
        young athletes — it also positions your business as a valuable contributor to the local
        community.
      </p>

      <p className="mb-6">
        Thank you for considering our proposal. We look forward to collaborating with you!
      </p>

      <div className="border-t pt-4">
        <p className="font-semibold">Bryan Cole</p>
        <p>Head Coach, Missouri State Men’s Lacrosse</p>
        <p>
          <a
            href="mailto:17bcole@gmail.com"
            className="text-[#5E0009] hover:underline font-medium"
          >
            17bcole@gmail.com
          </a>
        </p>
        <p className="text-gray-700">417-224-9327</p>
      </div>
    </div>
  );
}
