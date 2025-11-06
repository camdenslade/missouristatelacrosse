// src/Men/Local/Pages/Sponsor/SponsorMain.jsx
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

export default function SponsorMain() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    contactInfo: "",
    request: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/sponsor-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to submit");
      alert("Thank you! Your sponsorship inquiry has been submitted.");
      setForm({ businessName: "", contactInfo: "", request: "" });
      setOpen(false);
    } catch (err) {
      console.error("Error submitting sponsor request:", err);
      alert("There was an issue submitting your request. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 text-gray-800">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-bold text-[#5E0009] mb-4"
      >
        Missouri State University Men’s Lacrosse
      </motion.h1>

      <h3 className="text-xl font-bold text-black mb-4">
        Sponsorship Opportunities
      </h3>

      <p className="mb-4">
        We are excited to introduce to the <strong>Missouri State Men’s Lacrosse team</strong>, a
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
          <span className="block text-sm text-gray-600 mt-1">(Contact us to discuss details)</span>
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

        <li>
          <strong>Website Sponsor:</strong> Your business will be featured on the official Missouri
          State Lacrosse website, including your company name, logo, and a direct link to your
          website. Placement and visibility will be determined following a discussion with our
          coaching staff to identify the most appropriate location for your brand. Once finalized,
          your logo will be embedded with a clickable link, allowing visitors to easily access your
          business page. This placement provides meaningful exposure to our players, families,
          alumni, and supporters while showcasing your commitment to the Missouri State Lacrosse
          program and its continued growth.
          <span className="block text-sm text-gray-600 mt-1">(Contact us to discuss details)</span>
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

      <div className="border-t pt-4 mb-6">
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

      {/* Contact Us Button */}
      <div className="text-center">
        <button
          onClick={() => setOpen(true)}
          className="bg-[#5E0009] text-white px-8 py-3 rounded-md font-semibold hover:bg-red-800 transition"
        >
          Contact Us
        </button>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-xl w-[90%] max-w-md p-6 relative"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-4 text-gray-500 hover:text-gray-800 text-2xl"
              >
                &times;
              </button>

              <h3 className="text-2xl font-semibold text-[#5E0009] mb-4 text-center">
                Sponsor Inquiry Form
              </h3>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    value={form.businessName}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#5E0009] focus:border-[#5E0009] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Information
                  </label>
                  <input
                    type="text"
                    name="contactInfo"
                    value={form.contactInfo}
                    onChange={handleChange}
                    placeholder="Email or phone"
                    required
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#5E0009] focus:border-[#5E0009] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Short Request or Message
                  </label>
                  <textarea
                    name="request"
                    value={form.request}
                    onChange={handleChange}
                    rows="3"
                    required
                    className="w-full border border-gray-300 rounded-md p-2 resize-none focus:ring-[#5E0009] focus:border-[#5E0009] outline-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#5E0009] text-white font-semibold py-2 rounded-md hover:bg-red-800 transition disabled:opacity-70"
                >
                  {loading ? "Submitting..." : "Submit"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
