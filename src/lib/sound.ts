// Simple notification ping. Default ON. Synthesized iPhone-like "tri-tone" ping.
const SOUND_KEY = "rechoir.notif.sound";

export function soundEnabled(): boolean {
  const v = localStorage.getItem(SOUND_KEY);
  return v === null ? true : v === "1";
}

export function setSoundEnabled(on: boolean) {
  localStorage.setItem(SOUND_KEY, on ? "1" : "0");
}

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = ctx || new Ctor();
    return ctx;
  } catch { return null; }
}

/** Plays a short "ding-ding-ding" reminiscent of the iPhone Tri-tone alert. */
export function playPing() {
  if (!soundEnabled()) return;
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});
  const now = ac.currentTime;
  // Three quick rising tones — short attack, exponential decay.
  const notes: Array<[number, number]> = [
    [880, 0.0],   // A5
    [1175, 0.12], // D6
    [1568, 0.24], // G6
  ];
  const master = ac.createGain();
  master.gain.value = 0.18;
  master.connect(ac.destination);
  for (const [freq, t] of notes) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.exponentialRampToValueAtTime(0.9, now + t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.18);
    osc.connect(g).connect(master);
    osc.start(now + t);
    osc.stop(now + t + 0.22);
  }
}
