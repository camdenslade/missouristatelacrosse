export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white px-6 py-14 text-center">
        <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 mb-3">
          <span className="h-px w-6 bg-white/40" />
          Legal
          <span className="h-px w-6 bg-white/40" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold">Privacy Policy</h1>
        <p className="text-white/80 mt-2">Last updated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" })}</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14 text-gray-700 leading-relaxed space-y-8">
        <p>
          Missouri State Lacrosse ("we," "us," "our") operates this website to run our men's
          and women's club lacrosse programs. This policy explains what information we
          collect, why, and how it's handled.
        </p>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account information: name, email, and password (via Firebase Authentication) when you create an account.</li>
            <li>Player and roster information: contact details, emergency/parent-guardian information, and other details you or a coach submit for roster, recruitment, or dues purposes.</li>
            <li>Event and store activity: registrations, ticket/raffle entries, and order history.</li>
            <li>Payment information: donations, dues, and store purchases are processed by PayPal (and, where enabled, Stripe). We do not store your card or bank details ourselves; that's handled entirely by the payment processor.</li>
            <li>Basic usage data collected automatically by our hosting and analytics tools (e.g. IP address, browser type) for security and site reliability.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">How We Use It</h2>
          <p>We use this information to run the team: manage rosters and dues, process donations and orders, communicate about events and games, and administer accounts. We don't sell your information, and we don't share it outside the organization except with the service providers that make the site work (payment processors, email delivery, hosting).</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Who Can See It</h2>
          <p>Roster, dues, and registration data is visible to team officers and admins who need it to run the program. Public pages (roster listings, articles, schedule) only show information intended to be public.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Your Choices</h2>
          <p>You can update your account information in Settings at any time. To request that we delete your account or personal data, contact an officer or admin directly.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Contact</h2>
          <p>Questions about this policy? Reach out through our <a href="/sponsorships" className="text-[#5E0009] font-semibold hover:underline">contact options</a> or an officer of the organization.</p>
        </section>

        <p className="text-sm text-gray-400">
          This policy is provided for transparency and is not a substitute for legal advice.
        </p>
      </div>
    </div>
  );
}
