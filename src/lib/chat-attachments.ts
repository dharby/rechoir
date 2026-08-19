import { supabase } from "@/integrations/supabase/client";

export type ChatAttachment = {
  url: string;
  name: string;
  size: number;
  type: string; // MIME
  kind: "image" | "file";
};

const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const IMAGE_TYPES = /^image\/(png|jpe?g|webp|gif|avif|heic|heif)$/i;
const BLOCKED = /(x-msdownload|x-msdos-program|x-sh|x-executable)/i;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** XHR upload — more reliable than fetch on flaky mobile networks, and it
 * surfaces real HTTP status codes instead of an opaque "Failed to fetch". */
function xhrUpload(path: string, file: File, token: string, contentType: string) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/chat-attachments/${path}`, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("cache-control", "3600");
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.timeout = 120000;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 413) reject(new Error("File is too large for the server"));
      else {
        let msg = `Upload failed (${xhr.status})`;
        try { const j = JSON.parse(xhr.responseText); msg = j.message || j.error || msg; } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(file);
  });
}

export async function uploadChatFile(userId: string, file: File): Promise<ChatAttachment> {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 20MB`);
  if (BLOCKED.test(file.type)) throw new Error(`${file.name}: this file type isn't allowed`);
  if (!navigator.onLine) throw new Error("You're offline — check your connection and try again");

  const safe = file.name.replace(/[^a-z0-9._-]+/gi, "_").slice(-80) || "file";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const contentType = file.type || "application/octet-stream";

  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error("Your session expired — please sign in again");

  let lastErr: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await xhrUpload(path, file, token, contentType);
      lastErr = null;
      break;
    } catch (err: any) {
      lastErr = err;
      // Don't retry permanent failures
      if (/too large|not allowed|403|401/i.test(err?.message || "")) break;
      await sleep(600 * (attempt + 1));
    }
  }
  if (lastErr) throw new Error(`${file.name}: ${lastErr.message || "upload failed"}`);

  const { data } = supabase.storage.from("chat-attachments").getPublicUrl(path);
  return {
    url: data.publicUrl,
    name: file.name,
    size: file.size,
    type: file.type,
    kind: IMAGE_TYPES.test(file.type) ? "image" : "file",
  };
}


export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function linkifyText(s: string): Array<{ type: "text" | "url"; value: string }> {
  if (!s) return [];
  const re = /\b(https?:\/\/[^\s<]+)/gi;
  const parts: Array<{ type: "text" | "url"; value: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push({ type: "text", value: s.slice(last, m.index) });
    parts.push({ type: "url", value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ type: "text", value: s.slice(last) });
  return parts;
}
