import { supabase } from "./supabase";

export const VEHICLE_PHOTO_BUCKET = "vehicle-photos";
export const MAX_VEHICLE_PHOTO_SIZE = 10 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function uploadVehiclePhoto(userId: string, file: File): Promise<string> {
  if (file.size > MAX_VEHICLE_PHOTO_SIZE) {
    throw new Error("Choose a photo smaller than 10 MB.");
  }

  const extension = EXTENSION_BY_MIME[file.type];
  if (!extension) {
    throw new Error("Choose a JPEG, PNG, WebP, or AVIF photo.");
  }

  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(VEHICLE_PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function createVehiclePhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(VEHICLE_PHOTO_BUCKET)
    .createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}
