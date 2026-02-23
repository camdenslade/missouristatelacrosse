import { FaInstagram, FaFacebook } from "react-icons/fa";

import SponsorLogos from "../Common/SponsorLogos";
import { useSponsors } from "../Common/hooks/useSponsors";
import { getProgramInfo } from "../../Services/programHelper";

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
    <footer className="no-print bg-[#5E0009] text-white/80 py-8 w-full border-t border-white/10">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/assets/msu.png"
          alt={teamName}
          className="h-8 opacity-70"
        />

        {/* Social icons (centered) + Sponsor logos (positioned to the right) */}
        <div className="relative w-full flex justify-center items-center">
          <div className="flex gap-5 text-xl">
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

          {sponsors.length > 0 && (
            <div className="absolute left-1/2 top-1/2 -translate-y-1/2 ml-20">
              <SponsorLogos sponsors={sponsors} layout="row" maxHeight={64} />
            </div>
          )}
        </div>

        {/* Copyright */}
        <div className="text-center text-xs tracking-wide uppercase text-white/50">
          &copy; {new Date().getFullYear()} {teamName}
        </div>
      </div>
    </footer>
  );
}

