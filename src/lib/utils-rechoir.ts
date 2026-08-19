export function generateAccessCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function avatarGradient(seed: string): string {
  const palettes = [
    "linear-gradient(135deg, hsl(224 76% 56%), hsl(263 70% 65%))",
    "linear-gradient(135deg, hsl(35 92% 50%), hsl(28 88% 45%))",
    "linear-gradient(135deg, hsl(158 64% 42%), hsl(180 70% 40%))",
    "linear-gradient(135deg, hsl(0 73% 55%), hsl(20 85% 55%))",
    "linear-gradient(135deg, hsl(280 70% 55%), hsl(320 70% 55%))",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return palettes[Math.abs(h) % palettes.length];
}
