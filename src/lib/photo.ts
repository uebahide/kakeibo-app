/** Longest side of a saved receipt photo: small enough to store (about 300 KB), large enough to read the print. */
export const PHOTO_MAX_SIDE = 1600;

/**
 * Shrinks a picked photo to a JPEG for upload. Drawing it on a canvas also drops the location and
 * other details the camera stored in the file.
 */
export async function shrinkPhoto(file: Blob, maxSide = PHOTO_MAX_SIDE, quality = 0.8): Promise<Blob> {
  const image = await decode(file);
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  if ("close" in image) image.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality));
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Some browsers only decode some formats (such as HEIC on Safari) through <img>.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
