// src/Women/Local/Pages/Schedule/hooks/recordUtils.js
export function calculateRecord(games){
  const record = {
    overall: { w: 0, l: 0 },
    conf: { w: 0, l: 0 },
    div: { w: 0, l: 0 },
    home: { w: 0, l: 0 },
    away: { w: 0, l: 0 },
    neutral: { w: 0, l: 0 },
    streak: "-",
  };

  const add = (key, result) => {
    if (!record[key]) return;
    if (result === "W") record[key].w++;
    else if (result === "L") record[key].l++;
  };

  for (const g of games){
    if (!g?.result) continue;
    const r = g.result;
    add("overall", r);
    if (g.type) add(g.type, r);
    if (g.isConference) add("conf", r);
    if (g.isDivision) add("div", r);
  }

  const sorted = games
    .filter((g) => g?.result)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  if (sorted.length){
    let streak = 1;
    let last = sorted[0].result;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].result === last) streak++;
      else break;
    }
    record.streak = `${last}${streak}`;
  }

  const pct = (w, l) => (w + l > 0 ? (w / (w + l)).toFixed(3) : ".000");

  return {
    overall: `${record.overall.w}-${record.overall.l}`,
    pct: pct(record.overall.w, record.overall.l),
    conf: `${record.conf.w}-${record.conf.l}`,
    confPct: pct(record.conf.w, record.conf.l),
    div: `${record.div.w}-${record.div.l}`,
    home: `${record.home.w}-${record.home.l}`,
    away: `${record.away.w}-${record.away.l}`,
    neutral: `${record.neutral.w}-${record.neutral.l}`,
    streak: record.streak,
  };
}