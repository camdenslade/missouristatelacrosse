// src/Global/Gallery/galleryService.js
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  getDocs
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";

import { storage, db } from "../../Services/firebaseConfig.js";

/**
 * @param {string} folderName
 * @param {File[]} files
 * @returns {Promise<string[]>}
 */

export async function uploadGallery(folderName, files){
    if (!folderName || !files?.length){
        console.warn("Called without folder or files.");
        return [];
    }

    try{
        const uploadedUrls = await Promise.all(
            files.map(async (file) => {
                const filePath = `gallery/${folderName}/${file.name}`;
                const fileRef = ref(storage, filePath);

                await uploadBytes(fileRef, file);
                const url = await getDownloadURL(fileRef);
                return url;
            })
        );

        const docRef = doc(db, "gallery", folderName);
        const snap = await getDoc(docRef);
        const oldUrls = snap.exists() ? snap.data().urls || [] : [];

        await setDoc(
            docRef, {
                folder: folderName,
                urls: Array.from(new Set([...oldUrls, ...uploadedUrls])),
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );

        return uploadedUrls;
    } catch (err){
        console.log("Error uploading: ", err);
        throw err;
    }
}

/**
 * @param {string} folderName
 * @param {string=} fileName
 * @returns {Promise<void>}
 */

export async function deleteGallery(folderName, fileName){
    if (!folderName) throw new Error("Missing folder name");

    const folderPath = `gallery/${folderName}`;
    const folderRef = ref(storage, folderPath);
    const docRef = doc(db, "gallery", folderName);

    try{
    if (fileName){
      const fileRef = ref(storage, `${folderPath}/${fileName}`);
      await deleteObject(fileRef);

      const snapshot = await getDoc(docRef);
      if (snapshot.exists()){
        const urls = (snapshot.data().urls || []).filter(
          (u) => !u.includes(fileName)
        );
        await setDoc(docRef, { ...snapshot.data(), urls }, { merge: true });
      }

      console.log(`Deleted file "${fileName}" from ${folderName}`);
    } else{
      const list = await listAll(folderRef);
      await Promise.all(list.items.map((item) => deleteObject(item)));

      await deleteDoc(docRef);
      console.log(`Deleted entire folder "${folderName}"`);
    }
  } catch (error){
    console.error("Error deleting gallery:", error);
    throw error;
  }
}

export async function getGallery(folderName){
  if (folderName){
    const docRef = doc(db, "gallery", folderName);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  } else{
    const colRef = collection(db, "gallery");
    const snap = await getDocs(colRef);
    const data = {};
    snap.forEach((doc) => {
      data[doc.id] = doc.data();
    });
    return data;
  }
}
