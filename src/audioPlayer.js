// ------------------------------------------------------------
// ORIGINAL AUDIO PLAYER (Minimal patch: no clipping + correct S')
// ------------------------------------------------------------

let audioCtx = null;
let activeOscs = [];

export function unlockAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function stopAllOscillators() {
  activeOscs.forEach(o => {
    try { o.stop(0); } catch (_) {}
  });
  activeOscs = [];
}

const SWARA_SEMITONES = {
  S: 0,
  R1: 1, R2: 2, R3: 3,
  G1: 2, G2: 3, G3: 4,
  M1: 5, M2: 6,
  P: 7,
  D1: 8, D2: 9, D3: 10,
  N1: 9, N2: 10, N3: 11
};

function swaraToFreq(swara, baseFreq, isTopSa) {
  if (isTopSa) return baseFreq * 2;

  const semi = SWARA_SEMITONES[swara];
  if (semi == null) return null;

  return baseFreq * Math.pow(2, semi / 12);
}

export function playRaga(scaleString, mode = "aro") {
  return new Promise(resolve => {

    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();

    stopAllOscillators();

    // Keep ALL tokens (unlimited notes)
    const notes = scaleString.trim().split(/\s+/);

    const baseFreq = 261.63;
    const noteDur = 0.45;
    let t = audioCtx.currentTime;

    function schedule(freq, time) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      gain.gain.setValueAtTime(0.7, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + noteDur);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);

      osc.connect(gain).connect(audioCtx.destination);
      osc.start(time);
      osc.stop(time + noteDur);

      activeOscs.push(osc);
    }

    // ------------------------------------------------------------
    // NEW: Determine which note should get S'
    // ------------------------------------------------------------

    notes.forEach((s, i) => {

      let isTopSa = false;

      if (mode === "aro") {
        // Arohanam: last S is high S'
        isTopSa = (s === "S" && i === notes.length - 1);
      }

      if (mode === "ava") {
        // Avarohanam: first S is high S'
        isTopSa = (s === "S" && i === 0);
      }

      const f = swaraToFreq(s, baseFreq, isTopSa);
      if (f) {
        schedule(f, t);
        t += noteDur * 1.05;
      }
    });

    setTimeout(resolve, (t - audioCtx.currentTime) * 1000);
  });
}




