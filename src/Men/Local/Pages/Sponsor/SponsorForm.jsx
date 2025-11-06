import emailjs from "emailjs-com";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

export default function SponsorForm() {
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    const templateParams = {
      business_name: form.businessName,
      contact_info: form.contactInfo,
      message: form.request,
      to_email: "17bcole@gmail.com", // target email
    };

    emailjs
      .send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,  // store these in your .env
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        templateParams,
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      )
      .then(() => {
        alert("Thank you for your interest! Your message has been sent.");
        setForm({ businessName: "", contactInfo: "", request: "" });
        setOpen(false);
      })
      .catch((err) => {
        console.error("EmailJS Error:", err);
        alert("There was an issue sending your message. Please try again later.");
      })
      .finally(() => setLoading(false));
  };

  return (
    <section className="bg-white py-20 text-center px-6 relative">
      <h2 className="text-3xl md:text-4xl font-bold text-[#5E0009] mb-4">
        Work With Us
      </h2>
      <p className="max-w-2xl mx-auto text-gray-700 mb-8 text-lg">
        Partner with Missouri State Lacrosse through sponsorships and community collaborations.
        Your business can help support student-athletes, enhance facilities, and grow the game we love.
        <br />
        <button
          onClick={() => setOpen(true)}
          className="text-[#5E0009] font-semibold underline hover:text-red-800 transition"
        >
          Contact us for more details
        </button>
        .
      </p>

      <a
        href="/work-with-us"
        className="inline-block bg-[#5E0009] text-white px-8 py-3 rounded-md font-semibold hover:bg-red-800 transition"
      >
        Become a Sponsor
      </a>

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
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-4 text-gray-500 hover:text-gray-800 text-2xl"
              >
                &times;
              </button>

              <h3 className="text-2xl font-semibold text-[#5E0009] mb-4">
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
                  {loading ? "Sending..." : "Submit"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
