import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, avatarGradient } from "@/lib/utils-rechoir";
import { cn } from "@/lib/utils";

type UserLike = {
  id?: string | null;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

export function UserAvatar({
  user,
  className,
}: {
  user?: UserLike | null;
  className?: string;
}) {
  const name = user?.full_name || user?.email || "?";
  const seed = user?.id || name;
  return (
    <Avatar className={cn("h-8 w-8", className)}>
      {user?.avatar_url ? <AvatarImage src={user.avatar_url} alt={name} /> : null}
      <AvatarFallback style={{ background: avatarGradient(seed), color: "white" }}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
