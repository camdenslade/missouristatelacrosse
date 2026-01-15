// src/Global/Common/hooks/uploadHelper.js
import imageCompression from "browser-image-compression";
import type { Options as CompressionOptions } from "browser-image-compression";
import { apiRequest } from "../../../Services/API";

/**
 * @param {File|string|null} file
 * @param {string|{type: string, season?: string, title?: string}} folder
 * @param {Function} [setProgress]
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
type UploadFolder =
  | string
  | {
      type: "logos" | "players" | "coaches" | "galleries" | "articles";
      season?: string | null;
      title?: string | null;
    };

type UploadOptions = {
  compress?: boolean;
  compressionOptions?: CompressionOptions;
};

type PresignResponse = {
  uploadUrl: string;
  key: string;
};

export async function uploadCompressedImage(
  file: File | string | null,
  folder: UploadFolder = "misc",
  setProgress?: (value: string | null) => void,
  options: UploadOptions = {}
) {
  try{
    if (!file) return "";
    if (typeof file === "string") return file;

    const { compress = true, compressionOptions = {} } = options;

    let uploadFile = file;

    if (compress){
      const defaultCompression = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        initialQuality: 0.8,
      };
      uploadFile = await imageCompression(file, {
        ...defaultCompression,
        ...compressionOptions,
      });
    }

    const fileName = `${crypto.randomUUID()}-${Date.now()}-${file.name}`;
    const resolvedFolder = resolveFolder(folder);
    const presign = await apiRequest<PresignResponse>("/api/uploads/presign", {
      method: "POST",
      json: {
        folder: resolvedFolder,
        filename: fileName,
        contentType: uploadFile.type || "application/octet-stream",
      },
    });

    await uploadWithProgress(presign.uploadUrl, uploadFile, setProgress);
    if (setProgress) setProgress(null);
    return presign.key;
  } catch (err){
    console.error("Error in uploadCompressedImage:", err);
    return "";
  }
}

function resolveFolder(folder: UploadFolder) {
  if (typeof folder === "string") return folder;
  if (!folder || typeof folder !== "object") return "misc";

  switch (folder.type) {
    case "logos":
      return "logos";
    case "players":
      return `players/${slugify(folder.season, "season")}`;
    case "coaches":
      return `players/${slugify(folder.season, "season")}/coaches`;
    case "galleries":
      return `galleries/${slugify(folder.title, "gallery")}`;
    case "articles":
      return `articles/${slugify(folder.title, "article")}`;
    default:
      return "misc";
  }
}

function slugify(value: string | null | undefined, fallback: string) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  const slug = raw
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function uploadWithProgress(
  url: string,
  file: File,
  setProgress?: (value: string | null) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (!setProgress || !event.lengthComputable) return;
      const pct = (event.loaded / event.total) * 100;
      setProgress(pct.toFixed(0));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

