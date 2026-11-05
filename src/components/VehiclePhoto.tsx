import { useEffect, useState, type ReactNode } from "react";
import { createVehiclePhotoUrl } from "../lib/vehiclePhotos";

export function useVehiclePhotoUrl(path?: string, fallback?: string): string | undefined {
  const [url, setUrl] = useState<string | undefined>(fallback);

  useEffect(() => {
    let active = true;
    let interval: number | undefined;

    const refresh = async () => {
      if (!path) {
        setUrl(fallback);
        return;
      }
      const signedUrl = await createVehiclePhotoUrl(path);
      if (active) setUrl(signedUrl ?? fallback);
    };

    void refresh();
    if (path) interval = window.setInterval(() => void refresh(), 50 * 60 * 1000);

    return () => {
      active = false;
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [path, fallback]);

  return url;
}

export function VehiclePhoto({
  path,
  src,
  alt,
  className,
  fallback,
}: {
  path?: string;
  src?: string;
  alt: string;
  className: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const resolvedUrl = useVehiclePhotoUrl(path, src);

  useEffect(() => setFailed(false), [resolvedUrl]);

  if (!resolvedUrl || failed) return <>{fallback}</>;
  return (
    <img
      src={resolvedUrl}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
