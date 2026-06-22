// src/Men/Local/Gallery/hooks/galleryService.js
import { apiRequest } from "../../../../../Services/API";
import { uploadCompressedImage } from "../../../../../Global/Common/hooks/uploadHelper";

type GalleryFolder = {
  urls: string[];
};

/**
 * @param {string} folderName
 * @param {File[]} files
 * @returns {Promise<string[]>}
 */

export async function uploadGallery(folderName: string, files: File[]): Promise<string[]>{
    if (!folderName || !files?.length){
        console.warn("Called without folder or files.");
        return [];
    }

    try{
        const uploadedUrls = await Promise.all(
            files.map((file) =>
              uploadCompressedImage(
                file,
                { type: "galleries", title: folderName },
                undefined,
                { compress: false }
              )
            )
        );

        const existing = await apiRequest<GalleryFolder>(`/api/gallery/${folderName}`).catch(() => null);
        const oldUrls = existing?.urls || [];

        await apiRequest(`/api/gallery/${folderName}`, {
          method: "PUT",
          json: {
            urls: Array.from(new Set([...oldUrls, ...uploadedUrls])),
          },
        });

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

export async function deleteGallery(folderName: string, s3Key?: string): Promise<void>{
    if (!folderName) throw new Error("Missing folder name");

    try{
      if (s3Key){
        await apiRequest(`/api/gallery/${folderName}/photo?key=${encodeURIComponent(s3Key)}`, {
          method: "DELETE",
        });
        console.log(`Deleted photo "${s3Key}" from ${folderName}`);
      } else{
        await apiRequest(`/api/gallery/${folderName}`, { method: "DELETE" });
        console.log(`Deleted entire folder "${folderName}"`);
      }
  } catch (error){
    console.error("Error deleting gallery:", error);
    throw error;
  }
}

export async function getGallery(folderName: string): Promise<GalleryFolder>;
export async function getGallery(): Promise<Record<string, GalleryFolder>>;
export async function getGallery(folderName?: string){
  if (folderName){
    return await apiRequest<GalleryFolder>(`/api/gallery/${folderName}`);
  }
  return await apiRequest<Record<string, GalleryFolder>>("/api/gallery");
}

export async function reorderGallery(folderName: string, urls: string[]): Promise<void> {
  if (!folderName) throw new Error("Missing folder name");
  await apiRequest(`/api/gallery/${folderName}`, {
    method: "PUT",
    json: { urls },
  });
}

