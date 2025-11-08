// audioPlayer.js
let audioCtx;

// iOS audio unlock helper — plays a silent buffer once on first touch
export function unlockAudioForiOS() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);

  if (ctx.state === "suspended") ctx.resume();
  try { source.start(0); } catch {}
}


let sharedCtx = null;

export function getAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    alert("Web Audio not supported on this device");
    return null;
  }
  if (!sharedCtx) {
    sharedCtx = new AudioCtx();
    if (sharedCtx.state === "suspended") {
      const resume = () => {
        sharedCtx.resume();
        document.removeEventListener("touchstart", resume);
      };
      document.addEventListener("touchstart", resume);
    }
  }
  return sharedCtx;
}


export function playRaga(pattern, baseFreq = 261.63) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  // Carnatic → Western semitone map
  const map = {
    S: 0,
    R1: 1, R2: 2, R3: 3,
    G2: 3, G3: 4,
    M1: 5, M2: 6,
    P: 7,
    D1: 8, D2: 9, D3: 10,
    N2: 10, N3: 11,
  };

  const swaras = pattern.trim().split(/\s+/);
  const dur = 0.4; // seconds per note
  let t = ctx.currentTime;

  // ✅ Build full ārohaṇa–avarōhaṇa sequence with repeated top S
  const totalNotes = [
    ...swaras,
    ...swaras.slice().reverse() // repeat top S for descent
  ];

  totalNotes.forEach((s, i) => {
    const semi = map[s];
    if (semi === undefined) return;

    const isLastOfAsc = (i === swaras.length - 1);
    const isDescending = (i >= swaras.length);
    let octaveOffset = 0;

    if (isLastOfAsc && s === "S") octaveOffset = 12; // top S ↑
    if (isDescending && s === "S") octaveOffset = 12; // start of descent stays high
    if (isDescending && i === totalNotes.length - 1) octaveOffset = 0; // final S base octave

    const freq = baseFreq * Math.pow(2, (semi + octaveOffset) / 12);

    // 🕒 Each note gets its own oscillator and gain
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
    gain.gain.linearRampToValueAtTime(0.12, t + dur - 0.05);
    gain.gain.linearRampToValueAtTime(0, t + dur);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);

    t += dur;
  });
}

