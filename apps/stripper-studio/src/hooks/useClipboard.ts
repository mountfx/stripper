import { useEffect, useRef, useState } from 'react';

/** Copy text to the clipboard with a `lastCopied` flash cleared after `resetAfterMs`. */
export function useClipboard(resetAfterMs = 1200) {
  const [lastCopied, setLastCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      el.remove();
      if (!ok) return false;
    }
    setLastCopied(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLastCopied(null), resetAfterMs);
    return true;
  }

  return { copyText, lastCopied };
}
