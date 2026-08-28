'use client';

import {useState} from 'react';
import {fitWithin, MAX_IMAGE_EDGE} from '@/lib/resize';

// `name` is the form field name the server action reads and is the same for
// every row; `id` is per-item so each label points at its own input.
type Props = {name: string; id: string; label: string; hint: string; buttonLabel: string};

// A menu of unscaled phone photos is tens of megabytes, so the browser shrinks
// each file before it is submitted. Progressive enhancement holds: without JS
// the original file is sent and the server still enforces type, magic bytes
// and the 3 MB cap.
export function ImageUploadField({name, id, label, hint, buttonLabel}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      // Dimensions must be captured before close() -- a detached ImageBitmap
      // reports 0x0, which would make the "already small enough" guard below
      // never fire.
      const sourceWidth = bitmap.width;
      const sourceHeight = bitmap.height;
      const {width, height} = fitWithin(sourceWidth, sourceHeight, MAX_IMAGE_EDGE);
      if (width === sourceWidth && height === sourceHeight && file.size <= 400_000) {
        bitmap.close();
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        bitmap.close();
        return;
      }
      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();

      // Preserve the source format: flattening a PNG's alpha channel onto a
      // JPEG canvas silently turns transparent pixels black.
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const outputName = outputType === 'image/png' ? 'foto.png' : 'foto.jpg';
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outputType, 0.82)
      );
      if (!blob) return;

      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], outputName, {type: outputType}));
      input.files = transfer.files;
    } catch {
      // Downscaling is an optimisation. If the browser cannot do it, send the
      // original and let the server decide.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-muted">{label}</label>
      <input
        id={id}
        name={name}
        type="file"
        accept="image/png,image/jpeg"
        required
        onChange={handleChange}
        className="w-full rounded-xl border border-line bg-card p-2 text-sm"
      />
      <p className="text-xs text-muted">{hint}</p>
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl border border-line px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
