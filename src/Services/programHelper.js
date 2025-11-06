// src/Services/programHelper.js
export function getActiveProgram() {
  if (typeof window === "undefined") return "men";
  return window.location.pathname.toLowerCase().includes("/women")
    ? "women"
    : "men";
}


export function getCollectionName(base) {
  const program = getActiveProgram();
  return program === "women" ? `${base}w` : base;
}


export function getStoragePath(base) {
  const program = getActiveProgram();
  return program === "women" ? `women/${base}` : base;
}


export function getProgramConfig(base) {
  const program = getActiveProgram();
  return {
    program,
    collection: getCollectionName(base),
    storagePath: getStoragePath(base),
  };
}

export function getProgramInfo() {
  const path = window.location.pathname.toLowerCase();
  const isWomen = path.includes("/women");
  const program = isWomen ? "women" : "men";
  const base = isWomen ? "/women" : ""; 
  return { isWomen, program, base };
}


export default function useProgramLock() {
  const isWomen = window.location.pathname.toLowerCase().includes("/women");
  const stored = localStorage.getItem("program");
  const current = isWomen ? "women" : "men";

  if (!stored || stored !== current) {
    localStorage.setItem("program", current);
  }
}
