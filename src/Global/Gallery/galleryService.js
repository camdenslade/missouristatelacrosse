import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  getDocs
} from "firebase/firestore";
import { storage, db } from "./Services/firebaseConfig.js";


function getActiveProgram(){
  if (typeof window !== "undefined"){
    return window.location.pathname.toLowerCase().includes("/women") ? "women" : "men";
  }
  return "men";
}

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

    const program = getActiveProgram();
    const collectionName = program === "women" ? "galleryw" : "gallery";
    const basePath = program === "women" ? "women/gallery" : "gallery";

    try{
        const uploadedUrls = await Promise.all(
            files.map(async (file) => {
                const filePath = `${basePath}/${folderName}/${file.name}`;
                const fileRef = ref(storage, filePath);

                await uploadBytes(fileRef, file);
                const url = await getDownloadURL(fileRef);
                return url;
            })
        );

        const docRef = doc(db, collectionName, folderName);
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
    if (!folderName) throw new Error("Missing foler name");

    const program = getActiveProgram();
    const collectionName = program === "women" ? "galleryw" : "gallery";
    const basePath = program === "women" ? "women/gallery" : "gallery";
    const folderPath = `${basePath}/${folderName}`;
    const folderRef = ref(storage, folderPath);
    const docRef = doc(db, collectionName, folderName);

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
  const program = getActiveProgram();
  const collectionName = program === "women" ? "galleryWomen" : "gallery";

  if (folderName){
    const docRef = doc(db, collectionName, folderName);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  } else{
    const colRef = collection(db, collectionName);
    const snap = await getDocs(colRef);
    const data = {};
    snap.forEach((doc) => {
      data[doc.id] = doc.data();
    });
    return data;
  }
}
