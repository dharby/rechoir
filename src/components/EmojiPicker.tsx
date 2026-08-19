import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";
import { EMOJI_GROUPS } from "@/lib/emojis";
import { cn } from "@/lib/utils";

type Props = {
  onPick: (emoji: string) => void;
  trigger?: React.ReactNode;
};

export function EmojiPicker({ onPick, trigger }: Props) {
  const [tab, setTab] = useState(0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button type="button" size="icon" variant="ghost" aria-label="Insert emoji">
            <Smile className="h-5 w-5" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2 glass">
        <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
          {EMOJI_GROUPS.map((g, i) => (
            <button
              key={g.name}
              type="button"
              onClick={() => setTab(i)}
              className={cn(
                "px-2 py-1 text-[11px] rounded-md whitespace-nowrap",
                i === tab ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto">
          {EMOJI_GROUPS[tab].items.map((em, i) => (
            <button
              key={em + i}
              type="button"
              onClick={() => onPick(em)}
              className="text-xl hover:scale-125 transition-transform p-1"
            >
              {em}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
