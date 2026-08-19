import { Paperclip, Download, FileText, Image as ImgIcon } from "lucide-react";
import { formatBytes, type ChatAttachment } from "@/lib/chat-attachments";

export function MessageAttachments({ items }: { items: ChatAttachment[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {items.map((a, i) => {
        if (a.kind === "image") {
          return (
            <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block">
              <img
                src={a.url}
                alt={a.name}
                className="rounded-lg max-h-72 object-cover border border-border"
                loading="lazy"
              />
            </a>
          );
        }
        return (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            download={a.name}
            className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card/40 hover:bg-card/80 transition-smooth max-w-[280px]"
          >
            <div className="h-9 w-9 rounded-md bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">{a.name}</div>
              <div className="text-[10px] text-muted-foreground">{formatBytes(a.size)}</div>
            </div>
            <Download className="h-4 w-4 text-muted-foreground" />
          </a>
        );
      })}
    </div>
  );
}

export function AttachmentIcon() {
  return <Paperclip className="h-4 w-4" />;
}
