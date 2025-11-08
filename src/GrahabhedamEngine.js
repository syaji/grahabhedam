// GrahabhedamEngine.js
// Exact port of your working Google Apps Script logic, adapted for the web UI.

export const GrahabhedamEngine = (() => {
  // Canonical swara map (index -> label)
  const swaras = ["S", "R1", "R2", "G2", "G3", "M1", "M2", "P", "D1", "D2", "N2", "N3"];

  // Alias → semitone mapping (label -> index)
  const aliasToSwaraMap = {
    "S": 0,
    "R1": 1,
    "G1": 2, "R2": 2,
    "R3": 3, "G2": 3,
    "G3": 4,
    "M1": 5,
    "M2": 6,
    "P": 7,
    "D1": 8,
    "N1": 9, "D2": 9,
    "D3": 10, "N2": 10,
    "N3": 11
  };

  // Canonical cycle for “next note” resolution
  const canonicalOrder = ["S", "R", "G", "M", "P", "D", "N"];

  // Only the truly ambiguous semitones (others are fixed)
  const ambiguousMap = {
    2: ["R", "G"],   // R2 / G1
    3: ["R", "G"],   // R3 / G2
    9: ["D", "N"],   // D2 / N1
    10:["D", "N"]    // D3 / N2
  };

  function getSubscript(semi, letter) {
    if (semi === 2)  return letter === "R" ? "2" : "1";
    if (semi === 3)  return letter === "R" ? "3" : "2";
    if (semi === 9)  return letter === "D" ? "2" : "1";
    if (semi === 10) return letter === "D" ? "3" : "2";
    // Fallback: use whatever is in canonical table
    return swaras[semi].replace(/[SRGMPDN]/, "");
  }

  function resolveScale(unique) {
    let prev = "S";
    let out = [];

    for (const s of unique) {
      if (s === 0) { out.push("S"); prev = "S"; continue; }
      if (s === 7) { out.push("P"); prev = "P"; continue; }

      const opts = ambiguousMap[s];
      if (!opts) {
        const note = swaras[s];
        out.push(note);
        prev = note[0];
        continue;
      }

      // Next-note rule in S R G M P D N order
      let idx = canonicalOrder.indexOf(prev);
      for (let i = 0; i < canonicalOrder.length; i++) {
        idx = (idx + 1) % canonicalOrder.length;
        const cand = canonicalOrder[idx];
        if (opts.includes(cand)) {
          const sub = getSubscript(s, cand);
          out.push(cand + sub);
          prev = cand;
          break;
        }
      }
    }
    return out.join(" ");
  }

  // Public API: generate results from an input pattern string and a store
  // store must have: ragaLookup (exact strings), canonicalRagaLookup (normalized)
  function generate(inputPattern, store) {
    // Parse input
    const inputRow = inputPattern.trim().split(/\s+/);
    const semitoneSequence = [];

    for (const sw of inputRow) {
      const val = aliasToSwaraMap[sw];
      if (val === undefined) {
        // Return a single error-like row so UI can show it
        return [{
          name: "Error",
          notes: `❌ Invalid swara: ${sw}`
        }];
      }
      semitoneSequence.push(val);
    }

    // Ensure ending S
    if (semitoneSequence[semitoneSequence.length - 1] !== 0) {
      semitoneSequence.push(0);
    }

    // Janaka if it has 7 unique swaras (by semitone)
    const inputIsJanaka = (new Set(semitoneSequence)).size >= 7;

    // Original tonic
    const originalTonic = semitoneSequence[0];
    const results = [];

    // Compute all shifts
    for (let shift = 1; shift < semitoneSequence.length; shift++) {
      const newTonic = semitoneSequence[shift];
      if (newTonic === originalTonic) continue;

      const rotated = [];
      for (let i = 0; i < semitoneSequence.length; i++) {
        const idx = (shift + i) % semitoneSequence.length;
        const rel = (semitoneSequence[idx] - newTonic + 12) % 12;
        rotated.push(rel);
      }

      let uniqueRotated = [...new Set(rotated)];

      // If janya-like (less than 7), ensure we end with S
      if (uniqueRotated.length < 7 && uniqueRotated[uniqueRotated.length - 1] !== 0) {
        uniqueRotated.push(0);
      }

      const display = resolveScale(uniqueRotated);

      // Janaka input rule: only keep results that have all 7 families S R G M P D N
      if (inputIsJanaka) {
        const fams = new Set(display.split(/\s+/).map(n => n[0]));
        if (fams.size !== 7) continue;
      }

      // Canonical lookup key (normalize alias pairs)
      let canonicalKey = uniqueRotated.map(s => swaras[s]).join(" ")
        .replace(/G1/g, "R2").replace(/R3/g, "G2")
        .replace(/N1/g, "D2").replace(/D3/g, "N2")
        .trim().replace(/\s+/g, " ");

      if (uniqueRotated.length < 7 && !canonicalKey.endsWith("S")) {
        canonicalKey += " S";
      }


      const name =
        (store?.canonicalRagaLookup && store.canonicalRagaLookup[canonicalKey]) ||
        "Unknown";

let finalNotes = display;
if (name !== "Unknown" && store.reverseLookup && store.reverseLookup[name]) {
  finalNotes = store.reverseLookup[name];
}

results.push({
  name,
  notes: finalNotes
});


    }

    return results;
  }

  return { generate };
})();

