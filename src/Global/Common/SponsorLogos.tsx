import type { ApiSponsor } from "../../types/api";

type Props = {
  sponsors: ApiSponsor[];
  layout?: "grid" | "row";
  maxHeight?: number;
};

function getScaledSize(count: number, maxHeight: number) {
  const scale =
    count <= 1 ? 1 : count <= 3 ? 0.85 : count <= 6 ? 0.65 : count <= 10 ? 0.5 : 0.38;
  const h = Math.round(maxHeight * scale);
  const w = Math.round(h * 2.8);
  return { height: h, maxWidth: w };
}

export default function SponsorLogos({
  sponsors,
  layout = "row",
  maxHeight = 80,
}: Props) {
  if (!sponsors.length) return null;

  const { height, maxWidth } = getScaledSize(sponsors.length, maxHeight);

  const wrapperClass =
    layout === "grid"
      ? "flex flex-wrap items-center justify-center gap-8"
      : "flex flex-wrap items-center justify-center gap-6";

  return (
    <div className={wrapperClass}>
      {sponsors.map((s) =>
        s.logo ? (
          <a
            key={s.id}
            href={s.link || undefined}
            target={s.link ? "_blank" : undefined}
            rel={s.link ? "noopener noreferrer" : undefined}
            className="transition-opacity hover:opacity-80"
            title={s.name || undefined}
          >
            <img
              src={s.logo}
              alt={s.name || "Sponsor"}
              className="object-contain"
              style={{ height, maxWidth }}
            />
          </a>
        ) : null
      )}
    </div>
  );
}
