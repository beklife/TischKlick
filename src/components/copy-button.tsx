'use client';

import {useState} from 'react';

export function CopyButton({text, label, copiedLabel}: {text: string; label: string; copiedLabel: string}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
