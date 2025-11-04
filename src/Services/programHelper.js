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