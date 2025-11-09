// 🎵 audioPlayer.js — works on iOS, Android, desktop

let globalCtx = null;

// iOS audio unlock helper
export function unlockAudioForiOS() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    ctx.close();
    console.log("✅ iOS audio unlocked");
  } catch (e) {
    console.warn("Audio unlock failed:", e);
  }
}

// Main playback
export async function playRaga(scaleString) {
  // lazily unlock context for Safari
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!globalCtx || globalCtx.state === "closed") {
    globalCtx = new AudioContextClass();
  }

  const ctx = globalCtx;

  // Map Carnatic notes → semitone offsets
  const map = {
    S: 0,
    R1: 1, R2: 2, R3: 3, G2: 3, G3: 4,
    M1: 5, M2: 6,
    P: 7,
    D1: 8, D2: 9, D3: 10, N2: 10, N3: 11
  };

  const notes = scaleString.trim().split(/\s+/);
  const baseFreq = 261.63; // Sa = Middle C
  const duration = 0.5;
  let current = ctx.currentTime;

  // Create & start tones *synchronously* within click gesture
  for (const swara of notes) {
    const semi = map[swara];
    if (semi === undefined) continue;

    // higher Sa (wrap-around) for ending S
    const freq = (swara === "S" && current !== ctx.currentTime)
      ? baseFreq * 2
      : baseFreq * Math.pow(2, semi / 12);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    gain.gain.setValueAtTime(0.9, current);
    gain.gain.exponentialRampToValueAtTime(0.001, current + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.frequency.setValueAtTime(freq, current);

    osc.start(current);
    osc.stop(current + duration);
    current += duration * 1.05;
  }

  // Avarohana — play reverse with top S repeated
  const reversed = [...notes].reverse();
  for (const swara of reversed) {
    const semi = map[swara];
    if (semi === undefined) continue;

    const freq = (swara === "S" && current !== ctx.currentTime)
      ? baseFreq * 2
      : baseFreq * Math.pow(2, semi / 12);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    gain.gain.setValueAtTime(0.9, current);
    gain.gain.exponentialRampToValueAtTime(0.001, current + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.frequency.setValueAtTime(freq, current);

    osc.start(current);
    osc.stop(current + duration);
    current += duration * 1.05;
  }

  // let the audio finish naturally — don’t close context
  console.log("🎶 Played:", scaleString);
}

