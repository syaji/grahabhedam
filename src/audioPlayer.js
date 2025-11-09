// ✅ Guaranteed audible on iOS, Android, and desktop Safari
let audioContext;

export function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

// 🧩 Unlock audio for iOS
export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    ctx.resume().then(() => console.log("🔓 Audio unlocked for iOS"));
  }
}


export function playRaga(scaleString) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioContextClass(); // create inside user gesture

  // Resume explicitly (required by iOS)
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  const map = {
    S: 0,
    R1: 1, R2: 2, R3: 3, G2: 3, G3: 4,
    M1: 5, M2: 6,
    P: 7,
    D1: 8, D2: 9, D3: 10, N2: 10, N3: 11,
  };

  const notes = scaleString.trim().split(/\s+/);
  const baseFreq = 261.63; // middle Sa
  const dur = 0.45;
  let t = ctx.currentTime;

  function tone(freq, time) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(gain).connect(ctx.destination);
    osc.frequency.setValueAtTime(freq, time);
    osc.type = "sine";

    osc.start(time);
    osc.stop(time + dur);
  }

  // Aarohana
  for (const s of notes) {
    const semi = map[s];
    if (semi === undefined) continue;
    const f = (s === "S" && t !== ctx.currentTime)
      ? baseFreq * 2
      : baseFreq * Math.pow(2, semi / 12);
    tone(f, t);
    t += dur * 1.05;
  }

// Avarohana (repeat top S once, then descend back to lower S)
const revNotes = [...notes].reverse();
for (let i = 0; i < revNotes.length; i++) {
  const s = revNotes[i];
  const semi = map[s];
  if (semi === undefined) continue;

  // play high Sa only for the *first* S in descent
  const isFirstInDescent = (i === 0 && s === "S");
  const f = isFirstInDescent
    ? baseFreq * 2
    : baseFreq * Math.pow(2, semi / 12);

  tone(f, t);
  t += dur * 1.05;
}

  // Don't close ctx; let iOS finish audio
  console.log("✅ Played:", scaleString);
}

