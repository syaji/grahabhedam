// GrahabhedamEngine.js (canonical-labeling version)
// Default export: object with generate(inputAro, { requireSevenFamilies? })
// - Ambiguous semitones (R2/G1, R3/G2, D2/N1, D3/N2) are labeled by
//   the “next-family wins” rule in S→R→G→M→P→D→N order.
// - No alias swapping or reverse-lookup is performed here.
// - Output `notes` is ascending only (Arohanam); callers can derive Avarohanam.

const SWARAS = ["S","R1","R2","G2","G3","M1","M2","P","D1","D2","N2","N3"];
// === Add near the top of your engine file ===
const FIXED_LABEL = ["S","R1","R2","G2","G3","M1","M2","P","D1","D2","N2","N3"]; // fallback

function notesToSet(notesStr) {
  // notesStr like "S R2 G3 M1 P D2 N2"
  const set = new Set();
  if (!notesStr) return set;
  for (const t of notesStr.trim().split(/\s+/)) set.add(t);
  return set;
}

function chooseLabelWithParent(semi, parentSet) {
  // parentSet is a Set of labels present in the parent melakarta "notes"
  switch (semi) {
    case 2:  // R2 or G1
      if (parentSet.has("R2")) return "R2";
      if (parentSet.has("G1")) return "G1";
      return "R2"; // fallback
    case 3:  // R3 or G2
      if (parentSet.has("G2")) return "G2";
      if (parentSet.has("R3")) return "R3";
      return "G2";
    case 9:  // D2 or N1
      if (parentSet.has("D2")) return "D2";
      if (parentSet.has("N1")) return "N1";
      return "D2";
    case 10: // D3 or N2
      if (parentSet.has("N2")) return "N2";
      if (parentSet.has("D3")) return "D3";
      return "N2";
    default:
      return FIXED_LABEL[semi];
  }
}

function mapSemisToLabels(semiArray, parentNotes) {
  const pset = notesToSet(parentNotes);
  return semiArray.map(s => chooseLabelWithParent(s, pset)).join(" ");
}

// alias -> semitone index (12-note circle)
const aliasToSemi = {
  S:0,
  R1:1,
  G1:2, R2:2,           // ambiguous family @ 2
  R3:3, G2:3,           // ambiguous family @ 3
  G3:4,
  M1:5,
  M2:6,
  P:7,
  D1:8,
  N1:9, D2:9,           // ambiguous family @ 9
  D3:10, N2:10,         // ambiguous family @ 10
  N3:11
};

// Canonical family order for resolving ambiguous families
const FAMILY_ORDER = ["S","R","G","M","P","D","N"];
// Semitone -> which families are possible (only where ambiguous)
const ambiguousFamilies = {
  2: ["R","G"],   // R2 / G1
  3: ["R","G"],   // R3 / G2
  9: ["D","N"],   // D2 / N1
  10:["D","N"]    // D3 / N2
};

function nextSubscript(semi, familyLetter) {
  // Determine the correct subscript for the chosen family
  if (semi === 2)  return familyLetter === "R" ? "2" : "1"; // R2 or G1
  if (semi === 3)  return familyLetter === "R" ? "3" : "2"; // R3 or G2
  if (semi === 9)  return familyLetter === "D" ? "2" : "1"; // D2 or N1
  if (semi === 10) return familyLetter === "D" ? "3" : "2"; // D3 or N2
  // Non-ambiguous: use canonical label from SWARAS table
  return SWARAS[semi].replace(/[SRGMPDN]/, "");
}

function resolveDisplay(uniqueSemis) {
  // Label a unique ascending semitone list using canonical next-family rule
  let prevFamily = "S";
  const out = [];

  for (const s of uniqueSemis) {
    if (s === 0) { out.push("S"); prevFamily = "S"; continue; }
    if (s === 7) { out.push("P"); prevFamily = "P"; continue; }

    const opts = ambiguousFamilies[s];
    if (!opts) {
      const note = SWARAS[s];
      out.push(note);
      prevFamily = note[0];
      continue;
    }

    // Choose the next family after the previous one in S→R→G→M→P→D→N
    let idx = FAMILY_ORDER.indexOf(prevFamily);
    for (let i = 0; i < FAMILY_ORDER.length; i++) {
      idx = (idx + 1) % FAMILY_ORDER.length;
      const cand = FAMILY_ORDER[idx];
      if (opts.includes(cand)) {
        out.push(cand + nextSubscript(s, cand));
        prevFamily = cand;
        break;
      }
    }
  }

  return out.join(" ");
}

function parseAroToSemis(aro) {
  const toks = aro.trim().split(/\s+/);
  const arr = [];
  for (const t of toks) {
    const v = aliasToSemi[t];
    if (v === undefined) throw new Error(`Invalid swara: ${t}`);
    arr.push(v);
  }
  // Ensure trailing S so rotations are well-defined
  if (arr[arr.length - 1] !== 0) arr.push(0);
  return arr;
}

function uniqueOrdered(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    if (!seen.has(x)) { seen.add(x); out.push(x); }
  }
  return out;
}

const Engine = {
  /**
   * @param {string} inputAro - e.g. "S R2 G3 P D2 S"
   * @param {{requireSevenFamilies?: boolean}} opts
   * @returns {Array<{notes: string, shiftLabel: string}>}
   */
  generate(inputAro, opts = {}) {
    const requireSeven = !!opts.requireSevenFamilies;
    const base = parseAroToSemis(inputAro);
    const origTonic = base[0];
    const results = [];

    for (let shift = 1; shift < base.length; shift++) {
      const newTonic = base[shift];
      if (newTonic === origTonic) continue;

      // Rotate relative to new tonic
      const rotated = [];
      for (let i = 0; i < base.length; i++) {
        const idx = (shift + i) % base.length;
        rotated.push((base[idx] - newTonic + 12) % 12);
      }

      let uniq = uniqueOrdered(rotated);
      // If fewer than 7 families, keep S at end for a clean arohanam form
      if (uniq.length < 7 && uniq[uniq.length - 1] !== 0) uniq.push(0);

      const display = mapSemisToLabels(uniq, opts.parentNotes || "");


      if (requireSeven) {
        const fams = new Set(display.split(/\s+/).map(n => n[0]));
        if (fams.size !== 7) continue;
      }

      const originalSwara = inputAro.trim().split(/\s+/)[shift];
      const shiftLabel = originalSwara ? `S → ${originalSwara}` : "";

      results.push({
        notes: display,  // ascending only
        shiftLabel
      });
    }

    return results;
  }
};

export default Engine;



