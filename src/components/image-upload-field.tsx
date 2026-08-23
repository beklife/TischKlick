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
      const {width, height} = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_EDGE);
      bitmap.close();
      if (width === bitmap.width && height === bitmap.height && file.size <= 400_000) return;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return;
      const redraw = await createImageBitmap(file);
      context.drawImage(redraw, 0, 0, width, height);
      redraw.close();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.82)
      );
      if (!blob) return;

      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], 'foto.jpg', {type: 'image/jpeg'}));
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
