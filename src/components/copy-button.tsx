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
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
        copied
          ? 'border-zest/40 bg-zest/10 text-zest'
          : 'border-hair bg-shell-2 text-ash hover:border-hair-2 hover:text-chalk'
      }`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
