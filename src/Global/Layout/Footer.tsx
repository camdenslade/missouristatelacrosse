import { FaInstagram, FaFacebook } from "react-icons/fa";
import { Link } from "react-router-dom";

import { getProgramInfo } from "../../Services/programHelper";
import { useSponsors } from "../Common/hooks/useSponsors";
import SponsorLogos from "../Common/SponsorLogos";

export default function Footer() {
  const { program } = getProgramInfo();

  const { sponsors } = useSponsors();
  const isWomen = program === "women";
  const teamName = isWomen
    ? "Missouri State Women’s Lacrosse"
    : "Missouri State Men’s Lacrosse";

  const instagramURL = isWomen
    ? "https://www.instagram.com/mostatewlax/"
    : "https://www.instagram.com/msu.lacrosse/";

  const facebookURL = isWomen
    ? "https://www.facebook.com/Missouri-State-Womens-Lacrosse/"
    : "https://www.facebook.com/MoStateLax/";

  return (
    <footer className="no-print bg-[#5E0009] text-white/80 w-full border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/assets/msu.png"
            alt={teamName}
            className="h-8 opacity-80"
          />
          <div className="flex gap-6 text-2xl">
            <a
              href={instagramURL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
              aria-label="Instagram"
            >
              <FaInstagram />
            </a>

            <a
              href={facebookURL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
              aria-label="Facebook"
            >
              <FaFacebook />
            </a>
          </div>
        </div>

        {sponsors.length > 0 && (
          <div className="w-full flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 text-white/50 text-xs font-semibold uppercase tracking-[0.2em]">
              <span className="h-px w-8 bg-white/20" />
              Our Sponsors
              <span className="h-px w-8 bg-white/20" />
            </div>
            <SponsorLogos sponsors={sponsors} layout="grid" maxHeight={56} card />
          </div>
        )}

        <div className="w-full pt-6 border-t border-white/10 flex flex-col items-center gap-3 text-center text-xs tracking-wide uppercase text-white/50">
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <span className="text-white/20">|</span>
            <Link to="/terms-of-service" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
          <div>&copy; {new Date().getFullYear()} {teamName}</div>
        </div>
      </div>
    </footer>
  );
}

