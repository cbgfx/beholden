/**
 * Copies text to the clipboard, resolving to whether it worked.
 *
 * `navigator.clipboard` only exists on secure pages (https, or localhost). Friends reaching the
 * server by its LAN address over plain http have none, so the older selection-based copy is the
 * fallback there. Never throws: a copy button should say it failed, not break.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission refused or not focused: try the fallback below.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}
