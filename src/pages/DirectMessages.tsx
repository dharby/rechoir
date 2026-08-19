import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessagesSquare, Trash2, AtSign, X, Paperclip, ArrowLeft, Pin, PinOff, Star, StarOff, Smile, Reply, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { UserAvatar } from "@/components/UserAvatar";
import { notifyUsers } from "@/lib/notifications";
import { sendTeamPush, sendUserPush } from "@/lib/notify";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/EmojiPicker";
import { uploadChatFile, type ChatAttachment, linkifyText } from "@/lib/chat-attachments";
import { MessageAttachments } from "@/components/MessageAttachments";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { useFileDrop } from "@/hooks/useFileDrop";

const EMOJIS = ["👍","❤️","🙌","🔥","🙏","😂","😮","😢","🎉","✝️","🎵","✨"];

/**
 * One-to-one direct messages.
 * Members can DM the team lead. Team lead can DM any member.
 * Member-to-member is blocked at the DB level.
 */
export default function DirectMessages() {
  const { team, profile } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const isLead = profile?.role === "team_lead";
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Members (filtered to allowed DM peers). Self is included for self-DM.
  const { data: peers = [] } = useQuery({
    queryKey: ["dm-peers", team?.id, profile?.id, isLead],
    enabled: !!team?.id && !!profile?.id,
    queryFn: async () => {
      const q = supabase
        .from("profiles")
        .select("id, full_name, email, role, avatar_url")
        .eq("team_id", team!.id);
      // Members can only DM the team lead (or themselves). Leads see everyone.
      const { data } = await q.order("full_name", { ascending: true });
      const all = data ?? [];
      if (isLead) return all;
      return all.filter((p: any) => p.role === "team_lead" || p.id === profile!.id);
    },
  });

  // On mobile, never auto-select a peer — show the list first so the back arrow works.
  const peerId = params.get("with") || (isMobile ? "" : ((peers[0] as any)?.id || ""));
  const peer = useMemo(() => (peers as any[]).find((p) => p.id === peerId), [peers, peerId]);

  // Conversation
  const { data: messages = [] } = useQuery({
    queryKey: ["dm-thread", profile?.id, peerId],
    enabled: !!profile?.id && !!peerId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const me = profile!.id;
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${me},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${me})`
        )
        .order("created_at", { ascending: true })
        .limit(300);
      return data ?? [];
    },
  });


  const [showStarred, setShowStarred] = useState(false);

  // Reactions on visible thread
  const { data: dmReactions = [] } = useQuery({
    queryKey: ["dm-reactions", profile?.id, peerId, messages.length],
    enabled: !!profile?.id && !!peerId && messages.length > 0,
    queryFn: async () => {
      const ids = (messages as any[]).map((m) => m.id);
      if (!ids.length) return [] as any[];
      return (await supabase.from("dm_message_reactions").select("*").in("message_id", ids)).data ?? [];
    },
  });

  // My starred DM messages
  const { data: dmStars = [] } = useQuery({
    queryKey: ["dm-stars", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => (await supabase.from("dm_message_stars").select("*").eq("user_id", profile!.id)).data ?? [],
  });
  const starredIds = new Set((dmStars as any[]).map((s) => s.message_id));

  // Peer's read marker (hidden if they disabled read receipts)
  const { data: peerReadAt = null } = useQuery({
    queryKey: ["dm-peer-read", profile?.id, peerId],
    enabled: !!profile?.id && !!peerId,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("dm_read_state")
        .select("last_read_at")
        .eq("user_id", peerId)
        .eq("peer_id", profile!.id)
        .maybeSingle();
      return (data as any)?.last_read_at ?? null;
    },
  });
  const isReadByPeer = (m: any) =>
    !!peerReadAt && m.sender_id === profile?.id && new Date(peerReadAt) >= new Date(m.created_at);

  // Realtime
  useEffect(() => {
    if (!profile?.id || !team?.id) return;
    const me = profile.id;
    const key = ["dm-thread", me, peerId];
    const inThread = (row: any) =>
      !!row && ((row.sender_id === me && row.recipient_id === peerId) || (row.sender_id === peerId && row.recipient_id === me));
    const ch = supabase
      .channel(`dm:${me}:${peerId || "none"}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "direct_messages", filter: `team_id=eq.${team.id}` },
        (payload: any) => {
          const row = payload.new ?? payload.old;
          if (peerId && inThread(row)) {
            // Patch the open thread in place instead of refetching it.
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
          } else if (payload.eventType === "INSERT") {
            qc.invalidateQueries({ queryKey: ["dm-thread"] });
          }
          if (payload.eventType === "INSERT") qc.invalidateQueries({ queryKey: ["dm-unread"] });
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "dm_message_reactions" },
        () => qc.invalidateQueries({ queryKey: ["dm-reactions"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id, team?.id, peerId, qc]);


  // Scroll + mark read
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    if (profile?.id && peerId && team?.id && messages.length) {
      supabase
        .from("dm_read_state")
        .upsert(
          { user_id: profile.id, peer_id: peerId, team_id: team.id, last_read_at: new Date().toISOString() } as any,
          { onConflict: "user_id,peer_id" }
        )
        .then(() => qc.invalidateQueries({ queryKey: ["dm-unread"] }));
    }
  }, [messages, profile?.id, peerId, team?.id, qc]);

  // Unread per-peer for sidebar list
  const { data: unreadMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["dm-unread", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const me = profile!.id;
      const { data: states } = await supabase
        .from("dm_read_state")
        .select("peer_id, last_read_at")
        .eq("user_id", me);
      const stateMap: Record<string, string> = {};
      (states ?? []).forEach((s: any) => (stateMap[s.peer_id] = s.last_read_at));
      const { data: incoming } = await supabase
        .from("direct_messages")
        .select("sender_id, created_at")
        .eq("recipient_id", me)
        .order("created_at", { ascending: false })
        .limit(500);
      const map: Record<string, number> = {};
      (incoming ?? []).forEach((m: any) => {
        const last = stateMap[m.sender_id];
        if (!last || new Date(m.created_at) > new Date(last)) {
          map[m.sender_id] = (map[m.sender_id] ?? 0) + 1;
        }
      });
      return map;
    },
  });

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content || !team || !profile || !peerId || !peer) return;
    setText("");
    const replyId = replyTo?.id ?? null;
    setReplyTo(null);
    // mention parsing within DM (only the peer can be mentioned by @firstname)
    const mentions: string[] = [];
    const peerTag = `@${(peer.full_name || peer.email).split(" ")[0].toLowerCase()}`;
    if (content.toLowerCase().includes(peerTag)) mentions.push(peer.id);

    // Optimistic insert with a client-generated id (realtime echo dedupes on id)
    const row = {
      id: crypto.randomUUID(),
      team_id: team.id,
      sender_id: profile.id,
      recipient_id: peerId,
      content,
      mentions,
      reply_to_id: replyId,
      attachments: [] as any,
      is_pinned: false,
      is_deleted: false,
      created_at: new Date().toISOString(),
    };
    qc.setQueryData(["dm-thread", profile.id, peerId], (old: any[] | undefined) => [...(old ?? []), row]);

    const { error } = await supabase.from("direct_messages").insert(row as any);
    if (error) {
      qc.setQueryData(["dm-thread", profile.id, peerId], (old: any[] | undefined) =>
        (old ?? []).filter((m) => m.id !== row.id));
      toast.error(error.message);
      setText(content);
      return;
    }
    if (peer.id !== profile.id) {
      const senderName = profile.full_name || profile.email;
      const isMention = mentions.includes(peer.id);
      await notifyUsers({
        userIds: [peer.id],
        title: isMention ? `💬 ${senderName} mentioned you` : `💬 ${senderName}`,
        body: content.slice(0, 200),
        link: `/dm?with=${profile.id}`,
        category: "chat",
      });
      sendUserPush({
        userIds: [peer.id],
        title: isMention ? `💬 ${senderName} mentioned you` : `💬 ${senderName}`,
        body: content.slice(0, 140),
        url: `/dm?with=${profile.id}`,
        tag: `dm:${profile.id}`,
      });
    }
  };

  const onPickFiles = async (files: FileList | File[] | null) => {
    if (!files || !files.length || !profile || !team || !peerId) return;
    setUploading(true);
    try {
      const uploaded: ChatAttachment[] = [];
      for (const f of Array.from(files)) {
        try { uploaded.push(await uploadChatFile(profile.id, f)); }
        catch (err: any) { toast.error(err?.message || `Failed: ${f.name}`); }
      }
      if (uploaded.length) {
        await supabase.from("direct_messages").insert({
          team_id: team.id, sender_id: profile.id, recipient_id: peerId,
          content: "", mentions: [], attachments: uploaded as any,
        } as any);
      }
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const { dragging, dropProps, onPaste } = useFileDrop((files) => onPickFiles(files));



  const insertEmoji = (em: string) => setText((t) => t + em);

  const deleteMessage = async (m: any) => {
    if (m.sender_id === profile?.id) {
      await supabase.from("direct_messages").update({ is_deleted: true, content: "" }).eq("id", m.id);
    } else if (isLead) {
      await supabase.from("direct_messages").delete().eq("id", m.id);
    }
    qc.invalidateQueries({ queryKey: ["dm-thread"] });
  };

  const insertMention = () => {
    if (!peer) return;
    const tag = `@${(peer.full_name || peer.email).split(" ")[0].toLowerCase()} `;
    setText((t) => t + tag);
    setMentionOpen(false);
  };

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

  const togglePin = async (m: any) => {
    await supabase.from("direct_messages").update({ is_pinned: !m.is_pinned }).eq("id", m.id);
    qc.invalidateQueries({ queryKey: ["dm-thread"] });
  };

  const toggleStar = async (m: any) => {
    if (!profile) return;
    if (starredIds.has(m.id)) {
      await supabase.from("dm_message_stars").delete().eq("message_id", m.id).eq("user_id", profile.id);
    } else {
      await supabase.from("dm_message_stars").insert({ message_id: m.id, user_id: profile.id } as any);
    }
    qc.invalidateQueries({ queryKey: ["dm-stars", profile.id] });
  };

  const toggleReaction = async (m: any, emoji: string) => {
    if (!profile) return;
    const existing = (dmReactions as any[]).find((r) => r.message_id === m.id && r.user_id === profile.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("dm_message_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("dm_message_reactions").insert({ message_id: m.id, user_id: profile.id, emoji } as any);
    }
  };

  const reactionsFor = (mid: string) => {
    const grouped: Record<string, { count: number; mine: boolean }> = {};
    (dmReactions as any[]).filter((r) => r.message_id === mid).forEach((r) => {
      if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
      grouped[r.emoji].count++;
      if (r.user_id === profile?.id) grouped[r.emoji].mine = true;
    });
    return grouped;
  };

  const pinnedMsgs = (messages as any[]).filter((m) => m.is_pinned && !m.is_deleted);
  const visibleMsgs = showStarred ? (messages as any[]).filter((m) => starredIds.has(m.id)) : (messages as any[]);
  const msgById = (mid: string) => (messages as any[]).find((m) => m.id === mid);
  const authorName = (senderId: string) =>
    senderId === profile?.id ? "You" : (peer?.full_name || peer?.email || "them");


  // Mobile: full-page chat — show list when no peer selected, thread otherwise
  const showList = !isMobile || !peerId;
  const showThread = !isMobile || !!peerId;

  if (!peers.length) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center gap-3">
          <MessagesSquare className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-extrabold">Direct messages</h1>
            <p className="text-muted-foreground">Private chats with your team lead</p>
          </div>
        </div>
        <Card className="glass p-6 text-center text-muted-foreground">
          {isLead
            ? "No team members yet — invite someone to start a private conversation."
            : "Your team lead hasn't joined yet."}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center gap-3">
        <MessagesSquare className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-extrabold">Direct messages</h1>
          <p className="text-muted-foreground">
            {isLead ? "Private chats with each member" : "Private chat with your team lead"}
          </p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 overflow-hidden">
        {/* Peer list */}
        {showList && (
        <Card className="glass p-2 overflow-y-auto">
          {(peers as any[]).map((p) => {
            const unread = unreadMap[p.id] ?? 0;
            const isSelf = p.id === profile?.id;
            return (
              <button
                key={p.id}
                onClick={() => setParams({ with: p.id })}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-smooth hover:bg-muted/60",
                  p.id === peerId && "bg-muted"
                )}
              >
                <UserAvatar user={p} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.full_name || p.email}{isSelf && " (You)"}</div>
                  <div className="text-xs text-muted-foreground capitalize">{isSelf ? "Personal notes" : p.role?.replace("_", " ")}</div>
                </div>
                {unread > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
            );
          })}
        </Card>
        )}

        {/* Thread */}
        {showThread && (
        <Card {...dropProps} className={cn("glass flex-1 flex flex-col overflow-hidden relative", dragging && "ring-2 ring-primary")}>
          {dragging && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm pointer-events-none">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Paperclip className="h-5 w-5" /> Drop files to send
              </div>
            </div>
          )}
          {peer && (
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              {isMobile && (
                <Button variant="ghost" size="icon" onClick={() => setParams({})} aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <UserAvatar user={peer} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{peer.full_name || peer.email}{peer.id === profile?.id && " (You)"}</div>
                <div className="text-xs text-muted-foreground capitalize">{peer.id === profile?.id ? "Personal notes" : peer.role?.replace("_", " ")}</div>
              </div>
              <Button size="sm" variant={showStarred ? "default" : "outline"} onClick={() => setShowStarred((s) => !s)}>
                <Star className="h-3.5 w-3.5 mr-1" /> {showStarred ? "All" : "Starred"}
              </Button>
            </div>
          )}
          {pinnedMsgs.length > 0 && !showStarred && (
            <div className="px-4 py-2 border-b border-border bg-secondary/5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Pin className="h-3 w-3" /> Pinned</div>
              {pinnedMsgs.slice(0, 3).map((m) => (
                <div key={m.id} className="text-xs truncate">
                  <strong>{m.sender_id === profile?.id ? "You" : peer?.full_name?.split(" ")[0] || "peer"}:</strong> {m.content}
                </div>
              ))}
            </div>
          )}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {visibleMsgs.length === 0 && (
              <p className="text-center text-muted-foreground py-12">{showStarred ? "No starred messages." : "No messages yet. Say hello! 👋"}</p>
            )}
            {visibleMsgs.map((m: any) => {
              const mine = m.sender_id === profile?.id;
              const reacts = reactionsFor(m.id);
              const starred = starredIds.has(m.id);
              return (
                <div key={m.id} className={cn("flex gap-2 group", mine ? "justify-end" : "justify-start")}>
                  {!mine && <UserAvatar user={peer} className="h-7 w-7" />}
                  <div className={cn("max-w-[75%] flex flex-col", mine ? "items-end" : "items-start")}>
                    {(m.is_pinned || starred) && (
                      <div className="flex items-center gap-1 mb-0.5 text-[10px] text-muted-foreground">
                        {m.is_pinned && <Pin className="h-3 w-3 text-secondary" />}
                        {starred && <Star className="h-3 w-3 text-secondary fill-secondary" />}
                      </div>
                    )}
                    <div
                      className={cn(
                        "px-3 py-2 rounded-2xl text-sm relative",
                        mine
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm",
                        m.is_pinned && "shadow-glow ring-1 ring-secondary/40"
                      )}
                    >
                      {m.reply_to_id && (() => {
                        const parent = msgById(m.reply_to_id);
                        return (
                          <div className={cn(
                            "mb-1.5 px-2 py-1 rounded-lg border-l-2 text-xs",
                            mine ? "border-primary-foreground/60 bg-primary-foreground/10" : "border-primary/60 bg-background/50"
                          )}>
                            <div className="font-semibold opacity-80">{parent ? authorName(parent.sender_id) : "Message"}</div>
                            <div className="truncate opacity-80">
                              {parent ? (parent.is_deleted ? "message deleted" : parent.content || "attachment") : "unavailable"}
                            </div>
                          </div>
                        );
                      })()}
                      {renderContent(m)}
                      {m.attachments?.length > 0 && <MessageAttachments items={m.attachments} />}
                    </div>


                    {Object.keys(reacts).length > 0 && (
                      <div className={cn("flex flex-wrap gap-1 mt-1", mine && "justify-end")}>
                        {Object.entries(reacts).map(([em, info]) => (
                          <button key={em} onClick={() => toggleReaction(m, em)}
                            className={cn("px-1.5 py-0.5 rounded-full text-xs border transition-smooth",
                              info.mine ? "border-primary bg-primary/20" : "border-border bg-card hover:bg-card/80")}>
                            {em} {info.count}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{format(new Date(m.created_at), "p")}</span>
                      {mine && !m.is_deleted && (
                        <CheckCheck className={cn("h-3.5 w-3.5", isReadByPeer(m) ? "text-accent" : "opacity-40")} />
                      )}
                      {!m.is_deleted && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                          <button title="Reply" onClick={() => setReplyTo(m)} className="hover:text-foreground">
                            <Reply className="h-3.5 w-3.5" />
                          </button>
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
                          <button title={starred ? "Unstar" : "Star"} onClick={() => toggleStar(m)} className="hover:text-foreground">
                            {starred ? <StarOff className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
                          </button>
                          <button title={m.is_pinned ? "Unpin" : "Pin"} onClick={() => togglePin(m)} className="hover:text-foreground">
                            {m.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                          </button>
                          {(mine || isLead) && (
                            <button onClick={() => deleteMessage(m)} className="hover:text-destructive" aria-label="Delete message">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {replyTo && (
            <div className="px-3 pt-2 flex items-center gap-2 border-t border-border">
              <div className="flex-1 min-w-0 px-2 py-1 rounded-lg border-l-2 border-primary bg-muted/50">
                <div className="text-[10px] font-semibold text-muted-foreground">
                  Replying to {authorName(replyTo.sender_id)}
                </div>
                <div className="text-xs truncate">{replyTo.is_deleted ? "message deleted" : replyTo.content || "attachment"}</div>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <form onSubmit={send} className="border-t border-border p-3 flex items-center gap-2">

            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
            <Button type="button" size="icon" variant="ghost" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Attach file">
              <Paperclip className="h-4 w-4" />
            </Button>
            <EmojiPicker onPick={insertEmoji} />
            {peer && peer.id !== profile?.id && (
              <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" aria-label="Mention">
                    <AtSign className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2">
                  <button
                    type="button"
                    onClick={insertMention}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-muted text-left text-sm"
                  >
                    <UserAvatar user={peer} className="h-6 w-6" />
                    <span className="truncate">{peer?.full_name || peer?.email}</span>
                  </button>
                </PopoverContent>
              </Popover>
            )}
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={onPaste}
              placeholder="Type or paste a file…"
              className="flex-1"
            />
            <Button type="submit" className="gradient-primary text-primary-foreground" disabled={!text.trim() || !peerId}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
        )}
      </div>
    </div>
  );
}
