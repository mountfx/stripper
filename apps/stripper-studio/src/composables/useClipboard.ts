import { ref } from 'vue';

export const lastCopied = ref<string | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

export async function copyText(text: string): Promise<boolean> {
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
  lastCopied.value = text;
  clearTimeout(timer);
  timer = setTimeout(() => (lastCopied.value = null), 1200);
  return true;
}
