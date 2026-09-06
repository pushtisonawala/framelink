import sharp from "sharp";

export interface ProcessedImage {
  thumbnail: Buffer;
  thumbnailContentType: "image/webp";
  width: number | null;
  height: number | null;
}

/**
 * Generate a web-friendly thumbnail (max 600px on the long edge, WebP) and read
 * the intrinsic dimensions of the original. Failures here are non-fatal — the
 * caller stores the original regardless.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const image = sharp(input, { failOn: "none" });
  const meta = await image.metadata();

  const thumbnail = await sharp(input, { failOn: "none" })
    .rotate() // honour EXIF orientation
    .resize(600, 600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  return {
    thumbnail,
    thumbnailContentType: "image/webp",
    width: meta.width ?? null,
    height: meta.height ?? null,
  };
}
