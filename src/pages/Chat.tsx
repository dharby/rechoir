import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, avatarGradient } from "@/lib/utils-rechoir";
import { Send, MessageSquare, Smile, Pin, Star, Trash2, Reply, AtSign, X, PinOff, StarOff, Paperclip, Forward, CheckCheck, Info } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { markChatRead } from "@/hooks/useChatUnread";
import { EmojiPicker } from "@/components/EmojiPicker";
import { uploadChatFile, type ChatAttachment, linkifyText } from "@/lib/chat-attachments";
import { MessageAttachments } from "@/components/MessageAttachments";
import { toast } from "sonner";
import { sendTeamPush, sendUserPush } from "@/lib/notify";
import { useFileDrop } from "@/hooks/useFileDrop";

const EMOJIS = ["👍","❤️","🙌","🔥","🙏","😂","😮","😢","🎉","✝️","🎵","✨"];

export default function Chat() {
  const { team, profile } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [showStarred, setShowStarred] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<any>(null);
  const [infoMsg, setInfoMsg] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["chat", team?.id],
    enabled: !!team?.id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase.from("chat_messages").select("*").eq("team_id", team!.id).order("created_at").limit(300);
      return data ?? [];
    },
  });


  const { data: members } = useQuery({
    queryKey: ["members", team?.id],
    enabled: !!team?.id,
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email").eq("team_id", team!.id)).data ?? [],
  });
  const memberMap = useMemo(() => Object.fromEntries((members ?? []).map((m: any) => [m.id, m])), [members]);

  const { data: reactions } = useQuery({
    queryKey: ["reactions", team?.id],
    enabled: !!team?.id && (messages?.length ?? 0) > 0,
    queryFn: async () => {
      const ids = (messages ?? []).map((m: any) => m.id);
      if (!ids.length) return [];
      return (await supabase.from("chat_message_reactions").select("*").in("message_id", ids)).data ?? [];
    },
  });

  const { data: stars } = useQuery({
    queryKey: ["stars", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => (await supabase.from("chat_message_stars").select("*").eq("user_id", profile!.id)).data ?? [],
  });
  const starredIds = new Set((stars ?? []).map((s: any) => s.message_id));

  // Read receipts — who has read up to when (only members with receipts enabled are visible)
  const { data: readStates = [] } = useQuery({
    queryKey: ["chat-read-states", team?.id],
    enabled: !!team?.id,
    refetchInterval: 15_000,
    queryFn: async () =>
      (await supabase.from("chat_read_state").select("user_id, last_read_at").eq("team_id", team!.id)).data ?? [],
  });

  const readersOf = (m: any) =>
    (readStates as any[])
      .filter((s) => s.user_id !== m.sender_id && new Date(s.last_read_at) >= new Date(m.created_at))
      .map((s) => memberMap[s.user_id])
      .filter(Boolean);

  useEffect(() => {
    if (!team?.id) return;
    const key = ["chat", team.id];
    const channel = supabase.channel(`chat:${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `team_id=eq.${team.id}` },
        (payload: any) => {
          // Patch the cache directly instead of refetching the whole thread.
          qc.setQueryData(key, (old: any[] | undefined) => {
            const list = old ?? [];
            if (payload.eventType === "INSERT") {
              if (list.some((m) => m.id === payload.new.id)) return list;
              return [...list, payload.new];
            }
            if (payload.eventType === "UPDATE") return list.map((m) => (m.id === payload.new.id ? payload.new : m));
            if (payload.eventType === "DELETE") return list.filter((m) => m.id !== payload.old.id);
            return list;
          });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_message_reactions" },
        () => qc.invalidateQueries({ queryKey: ["reactions", team.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [team?.id, qc]);


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    // While viewing chat, keep read marker up to date
    if (profile?.id && team?.id && (messages?.length ?? 0) > 0) {
      markChatRead(profile.id, team.id).then(() => {
        qc.invalidateQueries({ queryKey: ["chat-unread", profile.id, team.id] });
      });
    }
  }, [messages, profile?.id, team?.id, qc]);

  const parseMentions = (s: string): string[] => {
    const out = new Set<string>();
    if (s.includes("@all")) out.add("@all");
    (members ?? []).forEach((m: any) => {
      const tag = `@${(m.full_name || m.email).split(" ")[0].toLowerCase()}`;
      if (s.toLowerCase().includes(tag)) out.add(m.id);
    });
    return Array.from(out);
  };

  const send = async (e?: React.FormEvent, attachments: ChatAttachment[] = []) => {
    e?.preventDefault();
    const content = text.trim();
    if ((!content && attachments.length === 0) || !team || !profile) return;
    const mentions = parseMentions(content);
    const replyId = replyTo?.id ?? null;
    setText(""); setReplyTo(null);
    // Optimistic: client-generated id so the realtime echo dedupes cleanly.
    const row = {
      id: crypto.randomUUID(),
      team_id: team.id, sender_id: profile.id, content,
      reply_to_id: replyId,
      mentions,
      attachments: attachments as any,
      created_at: new Date().toISOString(),
      is_pinned: false, is_deleted: false, edited_at: null,
    };
    qc.setQueryData(["chat", team.id], (old: any[] | undefined) => [...(old ?? []), row]);
    const { error } = await supabase.from("chat_messages").insert(row as any);
    if (error) {
      qc.setQueryData(["chat", team.id], (old: any[] | undefined) => (old ?? []).filter((m) => m.id !== row.id));
      toast.error(error.message);
      setText(content);
      return;
    }
    // Fire OS push to all teammates (excluding sender). Mentioned users get a
    // targeted, higher-signal push.
    const senderName = profile.full_name || profile.email || "Someone";
    const preview = content ? content.slice(0, 140) : (attachments.length ? `📎 ${attachments.length} attachment${attachments.length>1?"s":""}` : "");
    sendTeamPush({
      teamId: team.id,
      excludeUserId: profile.id,
      title: `💬 ${senderName}`,
      body: preview,
      url: "/chat",
      tag: `chat:${profile.id}`,
    });
    const mentionedIds = mentions.filter((m) => m !== "@all" && m !== profile.id);
    if (mentionedIds.length) {
      sendUserPush({
        userIds: mentionedIds,
        title: `💬 ${senderName} mentioned you`,
        body: preview,
        url: "/chat",
        tag: `chat-mention:${profile.id}`,
      });
    }
  };

  const onPickFiles = async (files: FileList | File[] | null) => {
    if (!files || !("length" in files) || !files.length || !profile) return;
    setUploading(true);
    try {
      const uploaded: ChatAttachment[] = [];
      for (const f of Array.from(files)) {
        try { uploaded.push(await uploadChatFile(profile.id, f)); }
        catch (err: any) { toast.error(err?.message || `Failed: ${f.name}`); }
      }
      if (uploaded.length) await send(undefined, uploaded);
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const { dragging, dropProps, onPaste } = useFileDrop((files) => onPickFiles(files));



  const forwardTo = async (msg: any) => {
    if (!team || !profile) return;
    await supabase.from("chat_messages").insert({
      team_id: team.id, sender_id: profile.id,
      content: `↪ Forwarded: ${msg.content || ""}`,
      attachments: msg.attachments ?? [],
      mentions: [],
    } as any);
    setForwardMsg(null);
    toast.success("Forwarded to team chat");
  };

  const togglePin = async (m: any) => {
    await supabase.from("chat_messages").update({ is_pinned: !m.is_pinned }).eq("id", m.id);
  };

  const softDelete = async (m: any) => {
    await supabase.from("chat_messages").update({ is_deleted: true, content: "" }).eq("id", m.id);
  };

  const toggleStar = async (m: any) => {
    if (!profile) return;
    if (starredIds.has(m.id)) {
      await supabase.from("chat_message_stars").delete().eq("message_id", m.id).eq("user_id", profile.id);
    } else {
      await supabase.from("chat_message_stars").insert({ message_id: m.id, user_id: profile.id });
    }
    qc.invalidateQueries({ queryKey: ["stars", profile.id] });
  };

  const toggleReaction = async (m: any, emoji: string) => {
    if (!profile) return;
    const existing = (reactions ?? []).find((r: any) => r.message_id === m.id && r.user_id === profile.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("chat_message_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("chat_message_reactions").insert({ message_id: m.id, user_id: profile.id, emoji });
    }
  };

  const insertMention = (m: any) => {
    const tag = m === "all" ? "@all " : `@${(memberMap[m]?.full_name || memberMap[m]?.email || "").split(" ")[0].toLowerCase()} `;
    setText((t) => t + tag);
    setMentionOpen(false);
    inputRef.current?.focus();
  };

  const insertEmoji = (em: string) => { setText((t) => t + em); inputRef.current?.focus(); };

  const renderContent = (m: any) => {
    if (m.is_deleted) return <em className="text-muted-foreground">message deleted</em>;
    const parts = m.content.split(/(@\w+)/g);
    return parts.map((p: string, i: number) => {
      if (p.startsWith("@")) return <span key={i} className="text-secondary font-bold bg-secondary/10 px-1 rounded">{p}</span>;
      return linkifyText(p).map((seg, j) => seg.type === "url"
        ? <a key={`${i}-${j}`} href={seg.value} target="_blank" rel="noreferrer" className="underline">{seg.value}</a>
        : <span key={`${i}-${j}`}>{seg.value}</span>);
    });
  };

  const pinned = (messages ?? []).filter((m: any) => m.is_pinned && !m.is_deleted);
  const visible = showStarred ? (messages ?? []).filter((m: any) => starredIds.has(m.id)) : (messages ?? []);

  const reactionsFor = (mid: string) => {
    const list = (reactions ?? []).filter((r: any) => r.message_id === mid);
    const grouped: Record<string, { count: number; mine: boolean }> = {};
    list.forEach((r: any) => {
      if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
      grouped[r.emoji].count++;
      if (r.user_id === profile?.id) grouped[r.emoji].mine = true;
    });
    return grouped;
  };

  return (
    <div className="space-y-4 max-w-4xl h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-extrabold">Team chat</h1>
            <p className="text-muted-foreground">Mention with @, react, pin, star and reply</p>
          </div>
        </div>
        <Button size="sm" variant={showStarred ? "default" : "outline"} onClick={() => setShowStarred((s) => !s)}>
          <Star className="h-4 w-4 mr-1" /> {showStarred ? "All messages" : "Starred"}
        </Button>
      </div>

      {pinned.length > 0 && !showStarred && (
        <Card className="glass p-3 border-l-4 border-l-secondary">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Pin className="h-3 w-3" /> Pinned</div>
          {pinned.slice(0, 3).map((m: any) => (
            <div key={m.id} className="text-sm py-0.5 truncate">
              <strong>{memberMap[m.sender_id]?.full_name || "Unknown"}:</strong> {m.content}
            </div>
          ))}
        </Card>
      )}

      <Card {...dropProps} className={cn("glass flex-1 flex flex-col overflow-hidden relative", dragging && "ring-2 ring-primary")}>
        {dragging && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm pointer-events-none">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Paperclip className="h-5 w-5" /> Drop files to send
            </div>
          </div>
        )}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {visible.length === 0 && <p className="text-center text-muted-foreground py-12">{showStarred ? "No starred messages." : "No messages yet. Say hello! 👋"}</p>}
          {visible.map((m: any) => {
            const sender = memberMap[m.sender_id];
            const mine = m.sender_id === profile?.id;
            const isMentioned = (m.mentions || []).includes("@all") || (m.mentions || []).includes(profile?.id);
            const replied = m.reply_to_id ? (messages ?? []).find((x: any) => x.id === m.reply_to_id) : null;
            const reacts = reactionsFor(m.id);
            const starred = starredIds.has(m.id);

            return (
              <div key={m.id} className={`flex gap-2 group ${mine ? "flex-row-reverse" : ""}`}>
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback style={{ background: avatarGradient(m.sender_id), color: "white" }} className="text-xs">
                    {initials(sender?.full_name || sender?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                    {sender?.full_name || sender?.email || "Unknown"}
                    {m.is_pinned && <Pin className="h-3 w-3 text-secondary" />}
                    {starred && <Star className="h-3 w-3 text-secondary fill-secondary" />}
                  </div>
                  <div className={cn(
                    "rounded-2xl px-4 py-2 text-sm relative",
                    mine ? "gradient-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm",
                    isMentioned && !mine && "ring-2 ring-secondary",
                    m.is_pinned && "shadow-glow"
                  )}>
                    {replied && (
                      <div className="text-[11px] opacity-80 border-l-2 border-current pl-2 mb-1 italic truncate max-w-[260px]">
                        ↱ {memberMap[replied.sender_id]?.full_name?.split(" ")[0] || "msg"}: {replied.content?.slice(0, 60)}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words">{renderContent(m)}</div>
                    {m.attachments?.length > 0 && <MessageAttachments items={m.attachments} />}
                  </div>

                  {/* Reactions */}
                  {Object.keys(reacts).length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : ""}`}>
                      {Object.entries(reacts).map(([em, info]) => (
                        <button key={em} onClick={() => toggleReaction(m, em)}
                          className={cn("px-1.5 py-0.5 rounded-full text-xs border transition-smooth",
                            info.mine ? "border-primary bg-primary/20" : "border-border bg-card hover:bg-card/80")}>
                          {em} {info.count}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>{format(new Date(m.created_at), "HH:mm")}</span>
                    {mine && !m.is_deleted && (
                      <button onClick={() => setInfoMsg(m)} className="flex items-center gap-0.5 hover:text-foreground" title="Message info">
                        <CheckCheck className={cn("h-3.5 w-3.5", readersOf(m).length > 0 && "text-accent")} />
                        {readersOf(m).length > 0 && readersOf(m).length}
                      </button>
                    )}
                    {/* Quick actions */}
                    {!m.is_deleted && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button title="React" className="hover:text-foreground"><Smile className="h-3.5 w-3.5" /></button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2 glass">
                            <div className="grid grid-cols-6 gap-1">
                              {EMOJIS.map((em) => (
                                <button key={em} onClick={() => toggleReaction(m, em)} className="text-xl hover:scale-125 transition-transform">{em}</button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <button title="Reply" onClick={() => setReplyTo(m)} className="hover:text-foreground"><Reply className="h-3.5 w-3.5" /></button>
                        <button title={starred ? "Unstar" : "Star"} onClick={() => toggleStar(m)} className="hover:text-foreground">
                          {starred ? <StarOff className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button title="More" className="hover:text-foreground">⋯</button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => togglePin(m)}>
                              {m.is_pinned ? <><PinOff className="h-4 w-4 mr-2" />Unpin</> : <><Pin className="h-4 w-4 mr-2" />Pin</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setInfoMsg(m)}>
                              <Info className="h-4 w-4 mr-2" /> Message info
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => softDelete(m)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Unsend / delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {replyTo && (
          <div className="px-3 py-2 border-t border-border bg-card/40 flex items-center justify-between text-xs">
            <div className="truncate">
              <strong>Replying to {memberMap[replyTo.sender_id]?.full_name?.split(" ")[0] || "user"}:</strong> {replyTo.content?.slice(0, 80)}
            </div>
            <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        )}

        <form onSubmit={(e) => send(e)} className="border-t border-border p-3 flex gap-2 items-center">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
          <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={uploading} title="Attach file">
            <Paperclip className="h-5 w-5" />
          </Button>
          <EmojiPicker onPick={insertEmoji} />
          <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon"><AtSign className="h-5 w-5" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1 glass">
              <button onClick={() => insertMention("all")} className="w-full text-left px-2 py-1.5 rounded hover:bg-card text-sm font-bold text-secondary">@all (everyone)</button>
              <div className="max-h-60 overflow-auto">
                {(members ?? []).map((m: any) => (
                  <button key={m.id} onClick={() => insertMention(m.id)} className="w-full text-left px-2 py-1.5 rounded hover:bg-card text-sm flex items-center gap-2">
                    <Avatar className="h-6 w-6"><AvatarFallback style={{ background: avatarGradient(m.id), color: "white" }} className="text-[10px]">{initials(m.full_name || m.email)}</AvatarFallback></Avatar>
                    {m.full_name || m.email}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onPaste={onPaste} placeholder="Type or paste a file... use @name or @all" />
          <Button type="submit" className="gradient-primary text-primary-foreground"><Send className="h-4 w-4" /></Button>
        </form>
      </Card>

      {/* Message info — read receipts */}
      <Dialog open={!!infoMsg} onOpenChange={(o) => !o && setInfoMsg(null)}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Message info</DialogTitle></DialogHeader>
          {infoMsg && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sent {format(new Date(infoMsg.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Read by {readersOf(infoMsg).length}
                </div>
                {readersOf(infoMsg).length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No one has read this yet.</p>
                )}
                <div className="space-y-1.5 max-h-64 overflow-auto">
                  {readersOf(infoMsg).map((u: any) => (
                    <div key={u.id} className="flex items-center gap-2 text-sm">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback style={{ background: avatarGradient(u.id), color: "white" }} className="text-[10px]">
                          {initials(u.full_name || u.email)}
                        </AvatarFallback>
                      </Avatar>
                      {u.full_name || u.email}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Members who turned read receipts off in Settings aren't shown here.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
