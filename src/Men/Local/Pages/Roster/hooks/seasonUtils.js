// src/Men/Local/Pages/Roster/hooks/seasonUtils.js
export const getSeasonValue = (date = new Date()) => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const start = m >= 8 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};

export const displaySeasonLabel = (shortCode) => {
  if (!shortCode || !/^\d{2}-\d{2}$/.test(shortCode)) return shortCode;
  const [a, b] = shortCode.split("-");
  return `20${a}-20${b}`;
};

export const normalizeSeasonParam = (s) => {
  if (!s) return "";
  if (/^20\d{2}-20\d{2}$/.test(s)){
    const [start, end] = s.split("-");
    return `${start.slice(-2)}-${end.slice(-2)}`;
  }
  if (/^\d{4}$/.test(s)){
    const y = parseInt(s, 10);
    return `${String(y - 1).slice(-2)}-${String(y).slice(-2)}`;
  }
  return s;
};

export const generateSeasonValues = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const currentStart = m >= 8 ? y : y - 1;
  const arr = [];
  for (let i = 0; i < 4; i++){
    const startYear = currentStart - i;
    arr.push(`${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`);
  }
  return arr;
};
