import type { ApiSponsor } from "../../types/api";

type Props = {
  sponsors: ApiSponsor[];
  layout?: "grid" | "row";
  maxHeight?: number;
  /** Render each logo on its own white card so dark/transparent logos stay visible on a dark background. */
  card?: boolean;
};

export default function SponsorLogos({
  sponsors,
  layout = "row",
  maxHeight = 80,
  card = false,
}: Props) {
  if (!sponsors.length) return null;

  const wrapperClass =
    layout === "grid"
      ? "flex flex-wrap items-center justify-center gap-6"
      : "flex flex-wrap items-center justify-center gap-4";

  return (
    <div className={wrapperClass}>
      {sponsors.map((s) =>
        s.logo ? (
          <a
            key={s.id}
            href={s.link || undefined}
            target={s.link ? "_blank" : undefined}
            rel={s.link ? "noopener noreferrer" : undefined}
            title={s.name || undefined}
            className={
              card
                ? "flex items-center justify-center bg-white rounded-xl shadow-sm px-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
                : "transition-opacity hover:opacity-80"
            }
            style={card ? { height: maxHeight, width: maxHeight * 1.8 } : undefined}
          >
            <img
              src={s.logo}
              alt={s.name || "Sponsor"}
              className="object-contain max-h-full max-w-full"
              style={card ? { maxHeight: maxHeight * 0.7 } : { height: maxHeight }}
            />
          </a>
        ) : null
      )}
    </div>
  );
}
