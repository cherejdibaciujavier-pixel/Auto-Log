import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { ImagePlus, Minus, Plus, X } from "lucide-react";

const CROP_WIDTH = 1200;
const CROP_HEIGHT = 675;
const OUTPUT_WIDTH = 1600;
const OUTPUT_HEIGHT = 900;

type Dimensions = { width: number; height: number };
type Position = { x: number; y: number };
type DragState = {
  pointerId: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
};

function clampPosition(position: Position, width: number, height: number): Position {
  return {
    x: Math.min(0, Math.max(CROP_WIDTH - width, position.x)),
    y: Math.min(0, Math.max(CROP_HEIGHT - height, position.y)),
  };
}

export default function PhotoCropEditor({
  file,
  onCancel,
  onApply,
}: {
  file: File;
  onCancel: () => void;
  onApply: (croppedFile: File) => void;
}) {
  const [imageUrl, setImageUrl] = useState("");
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isCropping, setIsCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = useMemo(() => {
    if (!dimensions) return 1;
    return Math.max(
      CROP_WIDTH / dimensions.width,
      CROP_HEIGHT / dimensions.height,
    );
  }, [dimensions]);
  const imageWidth = (dimensions?.width ?? 0) * baseScale * zoom;
  const imageHeight = (dimensions?.height ?? 0) * baseScale * zoom;

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image) return;
    const nextDimensions = { width: image.naturalWidth, height: image.naturalHeight };
    const scale = Math.max(
      CROP_WIDTH / nextDimensions.width,
      CROP_HEIGHT / nextDimensions.height,
    );
    const width = nextDimensions.width * scale;
    const height = nextDimensions.height * scale;
    setDimensions(nextDimensions);
    setZoom(1);
    setPosition({
      x: (CROP_WIDTH - width) / 2,
      y: (CROP_HEIGHT - height) / 2,
    });
  };

  const changeZoom = (nextZoom: number) => {
    const centerSourceX = (CROP_WIDTH / 2 - position.x) / (baseScale * zoom);
    const centerSourceY = (CROP_HEIGHT / 2 - position.y) / (baseScale * zoom);
    const nextWidth = (dimensions?.width ?? 0) * baseScale * nextZoom;
    const nextHeight = (dimensions?.height ?? 0) * baseScale * nextZoom;
    setPosition(clampPosition({
      x: CROP_WIDTH / 2 - centerSourceX * baseScale * nextZoom,
      y: CROP_HEIGHT / 2 - centerSourceY * baseScale * nextZoom,
    }, nextWidth, nextHeight));
    setZoom(nextZoom);
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dimensions || !stageRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: position.x,
      y: position.y,
    };
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !bounds) return;
    const next = clampPosition({
      x: drag.x + ((event.clientX - drag.clientX) / bounds.width) * CROP_WIDTH,
      y: drag.y + ((event.clientY - drag.clientY) / bounds.height) * CROP_HEIGHT,
    }, imageWidth, imageHeight);
    setPosition(next);
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const applyCrop = async () => {
    const image = imageRef.current;
    if (!image || !dimensions || imageWidth <= 0) return;
    setIsCropping(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Photo editing isn't available in this browser.");

      const scale = baseScale * zoom;
      const sourceX = Math.max(0, -position.x / scale);
      const sourceY = Math.max(0, -position.y / scale);
      const sourceWidth = CROP_WIDTH / scale;
      const sourceHeight = CROP_HEIGHT / scale;
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        OUTPUT_WIDTH,
        OUTPUT_HEIGHT,
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => result ? resolve(result) : reject(new Error("Couldn't prepare this photo. Try another image.")),
          "image/jpeg",
          0.9,
        );
      });
      const name = `${file.name.replace(/\.[^.]+$/, "") || "vehicle"}-crop.jpg`;
      onApply(new File([blob], name, { type: "image/jpeg", lastModified: Date.now() }));
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : "Couldn't crop this photo.");
    } finally {
      setIsCropping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-5 sm:px-6">
      <button
        type="button"
        aria-label="Close photo editor"
        onClick={onCancel}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-crop-title"
        className="relative z-10 max-h-full w-full max-w-xl overflow-y-auto rounded-[26px] bg-white p-5 shadow-2xl sm:p-6"
      >
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id="photo-crop-title" className="text-[18px] font-bold text-neutral-900">Fit your car photo</h2>
            <p className="mt-0.5 text-[13px] text-neutral-500">Drag to move it; use the slider to zoom.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel photo editing"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
          >
            <X size={17} />
          </button>
        </header>

        <div
          ref={stageRef}
          className="relative aspect-video w-full touch-none select-none overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-black/10"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          style={{ cursor: dimensions ? "grab" : "default" }}
        >
          {imageUrl && (
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Photo crop preview"
              draggable={false}
              onLoad={handleImageLoad}
              className="pointer-events-none absolute max-w-none"
              style={{
                left: `${(position.x / CROP_WIDTH) * 100}%`,
                top: `${(position.y / CROP_HEIGHT) * 100}%`,
                width: `${(imageWidth / CROP_WIDTH) * 100}%`,
                height: `${(imageHeight / CROP_HEIGHT) * 100}%`,
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 border border-white/70" />
          {!dimensions && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/75">Preparing photo…</p>}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Minus size={16} className="shrink-0 text-neutral-400" />
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => changeZoom(Number(event.target.value))}
            disabled={!dimensions}
            aria-label="Photo zoom"
            className="w-full accent-[#0071e3]"
          />
          <Plus size={16} className="shrink-0 text-neutral-400" />
        </div>
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-600">{error}</p>}

        <footer className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full bg-neutral-100 py-3 text-[14px] font-semibold text-neutral-700 hover:bg-neutral-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void applyCrop()}
            disabled={!dimensions || isCropping}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#0071e3] py-3 text-[14px] font-semibold text-white hover:bg-[#0077ed] disabled:opacity-50"
          >
            <ImagePlus size={16} /> {isCropping ? "Applying…" : "Use this crop"}
          </button>
        </footer>
      </section>
    </div>
  );
}
