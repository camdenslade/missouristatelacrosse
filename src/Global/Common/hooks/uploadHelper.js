// src/Global/Common/hooks/uploadHelper.js
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import imageCompression from "browser-image-compression";
import { storage } from "../Services/firebaseConfig.js";

/**
 * @param {File|string|null} file
 * @param {string} folder
 * @param {Function} [setProgress]
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
export async function uploadCompressedImage(
  file,
  folder = "misc",
  setProgress,
  options = {}
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

    const uniqueName = `${folder}-${crypto.randomUUID()}-${Date.now()}-${file.name}`;
    const storageRef = ref(storage, `${folder}/${uniqueName}`);

    const uploadTask = uploadBytesResumable(storageRef, uploadFile);

    return await new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          if (setProgress) {
            const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProgress(pct.toFixed(0));
          }
        },
        (error) => {
          console.error("Upload error:", error);
          reject(error);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          if (setProgress) setProgress(null);
          resolve(url);
        }
      );
    });
  } catch (err){
    console.error("Error in uploadCompressedImage:", err);
    return "";
  }
}
