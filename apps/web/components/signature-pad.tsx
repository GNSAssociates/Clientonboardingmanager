'use client';

/**
 * Three ways to sign, the way Adobe does it: TYPE it, DRAW it, or bring an
 * IMAGE of a wet signature across from the desktop.
 *
 * The typed full legal name is captured in every case and is never optional —
 * it is the name that appears on the letter, in the audit certificate and in
 * the Companies House record. Drawing or uploading adds a picture of the
 * client's own hand above the rule; it does not replace the name.
 *
 * Everything happens in the browser. The drawing is rasterised to a PNG data
 * URL and an uploaded file is re-drawn through a canvas before it is sent,
 * which both shrinks it and strips any metadata (EXIF, GPS) the client's phone
 * may have attached to the photo.
 */
import { useEffect, useRef, useState } from 'react';
import { PenLine, Type as TypeIcon, Upload, RotateCcw } from 'lucide-react';

export type SignatureMode = 'type' | 'draw' | 'upload';

/** Longest edge of the stored signature image. Big enough to stay crisp on a
 *  printed letter, small enough that the data URL doesn't bloat the request. */
const MAX_EDGE = 900;
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

export interface SignaturePadProps {
  name: string;
  onNameChange: (v: string) => void;
  mode: SignatureMode;
  onModeChange: (m: SignatureMode) => void;
  /** PNG data URL, or '' when the client is typing their signature. */
  image: string;
  onImageChange: (v: string) => void;
  error: string;
  onError: (v: string) => void;
  accentColor: string;
  today: string;
  companyName: string;
  label: string;
}

export function SignaturePad({
  name, onNameChange, mode, onModeChange, image, onImageChange,
  error, onError, accentColor, today, companyName, label,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  /* The canvas is sized in DEVICE pixels and scaled back down in CSS, or the
     line looks like it was drawn with a crayon on a phone. */
  useEffect(() => {
    if (mode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a3fa0';
  }, [mode]);

  const pointAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = pointAt(e);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A single tap should still leave a mark.
    ctx.lineTo(x + 0.01, y);
    ctx.stroke();
    setHasInk(true);
  };

  const moveStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointAt(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  /* Trim the empty margin before storing, so the signature sits on the letter's
     rule at a sensible size instead of floating in a wide transparent box. */
  const endStroke = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onImageChange(trimTransparent(canvas));
    onError('');
  };

  const clearDrawing = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onImageChange('');
  };

  const onFile = async (file: File | undefined) => {
    onError('');
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type)) {
      onError('Please choose an image of your signature (PNG or JPG).');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      onError('That image is too large — please use one under 6MB.');
      return;
    }
    try {
      onImageChange(await fileToTrimmedPng(file));
    } catch {
      onError('That image could not be read. Try a PNG or JPG.');
    }
  };

  const tabs: Array<{ id: SignatureMode; label: string; icon: React.ReactNode }> = [
    { id: 'type', label: 'Type', icon: <TypeIcon size={15} /> },
    { id: 'draw', label: 'Draw', icon: <PenLine size={15} /> },
    { id: 'upload', label: 'Upload', icon: <Upload size={15} /> },
  ];

  return (
    <div className="bg-white rounded-xl p-5 border border-purple-200">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <label className="block text-sm font-semibold text-gray-700">{label}</label>
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onModeChange(t.id); onError(''); if (t.id === 'type') onImageChange(''); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === t.id ? 'text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
              style={mode === t.id ? { background: accentColor } : undefined}
              aria-pressed={mode === t.id}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* The full legal name is required whichever way they sign — it is what
          goes on the letter and in the audit certificate. */}
      <input
        data-field="signatureName"
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Type your full legal name"
        aria-label="Type your full legal name to sign"
        className={`w-full px-1 py-2 border-0 border-b-2 border-gray-400 focus:border-purple-600 focus:outline-none text-gray-900 bg-transparent leading-tight ${
          mode === 'type' ? 'text-3xl' : 'text-lg'
        }`}
        style={mode === 'type'
          ? { fontFamily: '"Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive' }
          : undefined}
        required
      />
      {mode !== 'type' && (
        <p className="text-[11px] text-gray-500 mt-1">Your full legal name, typed — printed beneath your signature.</p>
      )}

      {mode === 'draw' && (
        <div className="mt-4" data-field="signatureImage">
          <div className="relative rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/40">
            <canvas
              ref={canvasRef}
              onPointerDown={startStroke}
              onPointerMove={moveStroke}
              onPointerUp={endStroke}
              onPointerLeave={endStroke}
              onPointerCancel={endStroke}
              className="block w-full h-[170px] touch-none cursor-crosshair"
            />
            {!hasInk && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-purple-400">
                Draw your signature here with your finger, stylus or mouse
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={clearDrawing}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900"
          >
            <RotateCcw size={13} /> Clear and draw again
          </button>
        </div>
      )}

      {mode === 'upload' && (
        <div className="mt-4" data-field="signatureImage">
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/40 px-4 py-8 cursor-pointer hover:bg-purple-50">
            <Upload size={22} className="text-purple-500" />
            <span className="text-sm font-semibold text-purple-800">Choose a signature image from this device</span>
            <span className="text-xs text-gray-500">
              PNG or JPG — a photo or scan of your signature on white paper works well
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }}
            />
          </label>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {/* What it will look like on the letter. */}
      <div className="mt-4 border-t border-gray-200 pt-3">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="Your signature" className="h-16 object-contain object-left" />
        ) : (
          <p
            className="text-2xl text-[#1a3fa0] leading-tight min-h-[2.2rem]"
            style={{ fontFamily: '"Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive' }}
          >
            {name.trim() || <span className="text-gray-300 text-base font-sans">Your signature will appear here</span>}
          </p>
        )}
        <div className="w-64 border-t border-gray-400 mt-1 mb-1.5" />
        <p className="text-xs text-gray-500">
          {name.trim() || '—'} · for and on behalf of <strong>{companyName}</strong> · {today}
        </p>
      </div>
    </div>
  );
}

/* ── image helpers ──────────────────────────────────────────────────────── */

/** Crop a canvas down to its inked area and return a PNG data URL. */
function trimTransparent(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');
  const { width, height } = canvas;
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, width, height).data;
  } catch {
    return canvas.toDataURL('image/png');
  }
  let top = height, left = width, right = 0, bottom = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) > 8) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (right <= left || bottom <= top) return '';
  const pad = 8;
  left = Math.max(0, left - pad); top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad); bottom = Math.min(height - 1, bottom + pad);
  const out = document.createElement('canvas');
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  out.getContext('2d')?.drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

/**
 * Read an uploaded image, scale it to a sane size and return a PNG data URL.
 * A photo of a signature on paper arrives as a white rectangle, so near-white
 * pixels are made transparent — otherwise it lands on the letter as a grey
 * block sitting over the text.
 */
function fileToTrimmedPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) return reject(new Error('no canvas'));
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const id = ctx.getImageData(0, 0, w, h);
          const d = id.data;
          for (let i = 0; i < d.length; i += 4) {
            // Paper, and anything close to it, becomes transparent; the ink is
            // darkened so a faint pencil scan still reads on the letter.
            const lum = 0.299 * (d[i] ?? 0) + 0.587 * (d[i + 1] ?? 0) + 0.114 * (d[i + 2] ?? 0);
            if (lum > 200) d[i + 3] = 0;
            else if (lum > 120) d[i + 3] = Math.round((d[i + 3] ?? 0) * ((200 - lum) / 80));
          }
          ctx.putImageData(id, 0, 0);
        } catch { /* tainted canvas can't happen for a local file; ignore */ }
        resolve(trimTransparent(c));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
