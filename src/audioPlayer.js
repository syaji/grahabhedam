// audioPlayer.js
// Clean, patched, no-overlap version

// -------------------------------
// GLOBALS
// -------------------------------
let audioCtx = null;
let activeOscs = [];

// Unlock audio for iOS
export function unlockAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// Stop all currently playing oscillators
function stopAllOscillators() {
  activeOscs.forEach(o => {
    try { o.stop(0); } catch (_) {}
  });
  activeOscs = [];
}

// Frequency map for Carnatic swaras
const SWARA_SEMITONES = {
  S: 0,
  R1: 1, R2: 2, R3: 3,
  G1: 2, G2: 3, G3: 4,
  M1: 5, M2: 6,
  P: 7,
  D1: 8, D2: 9, D3: 10,
  N1: 9, N2: 10, N3: 11
};

// Convert swara → frequency
function swaraToFreq(swara, baseFreq, isTopSa) {
  if (isTopSa) return baseFreq * 2;
  let semi = SWARA_SEMITONES[swara];
  if (semi === undefined) return null;
  return baseFreq * Math.pow(2, semi / 12);
}

// -------------------------------
// MAIN: PLAY RĀGA PROGRAMMATICALLY
// -------------------------------
export function playRaga(scaleString) {
  return new Promise(resolve => {

    // Global audio context
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();

    // Prevent overlap
    stopAllOscillators();

    const notes = scaleString.trim().split(/\s+/);
    const baseFreq = 261.63;   // Middle Sa ~ C
    const noteDur = 0.45;      // seconds per note
    let t = audioCtx.currentTime;

    // Is this a full 7-swara Janaka?
    const isJanaka = new Set(notes).size === 7;

    // Helper: schedule one note
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

    // -------------------------
    // Ascending
    // -------------------------
    notes.forEach((s, i) => {
      const isTopSa = (i > 0 && s === "S");
      const f = swaraToFreq(s, baseFreq, isTopSa);
      if (f) {
        schedule(f, t);
        t += noteDur * 1.05;
      }
    });


    // -------------------------
    // Descending
    // -------------------------
    const rev = [...notes].reverse();


    rev.forEach((s, idx) => {
      const isTopSa = (idx === 0 && s === "S");
      const f = swaraToFreq(s, baseFreq, isTopSa);
      if (f) {
        schedule(f, t);
        t += noteDur * 1.05;
      }
    });

    // Resolve when playback finishes
    const totalMs = (t - audioCtx.currentTime) * 1000;
    setTimeout(resolve, totalMs);
  });
}

