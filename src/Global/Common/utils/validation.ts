const htmlPattern = /<[^>]*>/;
const controlPattern = /[\u0000-\u001F\u007F]/;

export const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

export const validateText = (value, label, { required = false, min = 0, max = 200 } = {}) => {
  const trimmed = normalizeText(value);
  if (!trimmed) {
    return required ? `${label} is required.` : "";
  }
  if (htmlPattern.test(trimmed) || trimmed.includes("<") || trimmed.includes(">")) {
    return `${label} cannot include HTML.`;
  }
  if (controlPattern.test(trimmed)) {
    return `${label} contains invalid characters.`;
  }
  if (min && trimmed.length < min) {
    return `${label} must be at least ${min} characters.`;
  }
  if (max && trimmed.length > max) {
    return `${label} must be ${max} characters or fewer.`;
  }
  return "";
};

export const validateEmail = (value, { required = true } = {}) => {
  const base = validateText(value, "Email", { required, max: 254 });
  if (base) return base;
  const trimmed = normalizeText(value);
  if (!trimmed) return "";
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(trimmed) ? "" : "Enter a valid email address.";
};

export const validatePhone = (value, { required = false } = {}) => {
  const base = validateText(value, "Phone", { required, max: 30 });
  if (base) return base;
  const trimmed = normalizeText(value);
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15
    ? ""
    : "Enter a valid phone number.";
};

export const validateUrl = (value, label = "Link", { required = false } = {}) => {
  const base = validateText(value, label, { required, max: 2048 });
  if (base) return base;
  const trimmed = normalizeText(value);
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) {
      return `${label} must start with http or https.`;
    }
    return "";
  } catch {
    return `${label} must be a valid URL.`;
  }
};

export const validateFolderName = (value, label = "Folder") => {
  const base = validateText(value, label, { required: true, max: 80 });
  if (base) return base;
  const trimmed = normalizeText(value);
  return /^[a-zA-Z0-9 _-]+$/.test(trimmed)
    ? ""
    : `${label} can only include letters, numbers, spaces, dashes, and underscores.`;
};

export const validateNumber = (value, label, { required = false, min = 0, max = 999 } = {}) => {
  if (value === "" || value === null || value === undefined) {
    return required ? `${label} is required.` : "";
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return `${label} must be a number.`;
  }
  if (min != null && num < min) {
    return `${label} must be at least ${min}.`;
  }
  if (max != null && num > max) {
    return `${label} must be ${max} or less.`;
  }
  return "";
};
