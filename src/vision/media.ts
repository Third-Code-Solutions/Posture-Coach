export type LocalMediaKind = "video" | "image";

const IMAGE_EXTENSIONS = /\.(avif|bmp|gif|jpe?g|png|webp)$/i;
const VIDEO_EXTENSIONS = /\.(m4v|mov|mp4|ogv|webm)$/i;

export function getLocalMediaKind(file: Pick<File, "name" | "type">): LocalMediaKind | null {
  const mimeType = file.type.trim().toLowerCase();
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  if (IMAGE_EXTENSIONS.test(file.name)) return "image";
  if (VIDEO_EXTENSIONS.test(file.name)) return "video";
  return null;
}
