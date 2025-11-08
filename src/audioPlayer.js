// audioPlayer.js
let audioCtx;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // iOS Safari fix — resume if it’s suspended
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playRaga(pattern, baseFreq = 261.63) {
  const ctx = getAudioContext();  // 👈 use the resumed context
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  osc.connect(gain);
  gain.connect(ctx.destination);

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
    ...swaras.slice().reverse()  // full reverse, repeats top S
  ];

  totalNotes.forEach((s, i) => {
    const semi = map[s];
    if (semi === undefined) return;

    // Ascending part: last S goes up an octave
    const isLastOfAsc = (i === swaras.length - 1);
    const isDescending = (i >= swaras.length);
    let octaveOffset = 0;

    if (isLastOfAsc && s === "S") octaveOffset = 12; // top S ↑
    if (isDescending && s === "S") octaveOffset = 12; // start of descent stays high S
    if (isDescending && i === totalNotes.length - 1) octaveOffset = 0; // final S is base octave

    const freq = baseFreq * Math.pow(2, (semi + octaveOffset) / 12);

    // smooth fade in/out
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.linearRampToValueAtTime(0.8, t + 0.05);
    gain.gain.linearRampToValueAtTime(0.0001, t + dur - 0.05);

    t += dur;
  });

  osc.start();
  osc.stop(t);
}

