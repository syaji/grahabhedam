// app.js — works with ids: ragaSearch, ragaSuggestions, generateBtn, findRelationsBtn, results, selectedInfo

import RagaDB from "./RagaDB_12.js";
import GEngine from "./GrahabhedamEngine.js";
import { playRaga, unlockAudio } from "./audioPlayer.js";

/* -------------------- tiny helpers -------------------- */
const $ = (sel) => document.querySelector(sel);
const norm = (s) => (s || "").trim().replace(/\s+/g, " ");

// Make a valid avarohanam from an arohanam string.
// Guarantees: begins with "S" and ends with "S".
function reverseAro(aro) {
  const toks = (aro || "").trim().split(/\s+/).filter(Boolean);
  if (toks.length === 0) return "S";

  if (toks[0] !== "S") toks.unshift("S");
  if (toks[toks.length - 1] !== "S") toks.push("S");

  const rev = toks.slice().reverse();

  if (rev[0] !== "S") rev.unshift("S");
  while (rev.length > 1 && rev[0] === "S" && rev[1] === "S") rev.splice(0, 1);

  if (rev[rev.length - 1] !== "S") rev.push("S");
  return rev.join(" ");
}

// Ensure an arohanam is bounded by S on both ends.
function ensureAroEndsWithS(aro) {
  const toks = (aro || "").trim().split(/\s+/).filter(Boolean);
  if (toks.length === 0) return "S";
  if (toks[0] !== "S") toks.unshift("S");
  if (toks[toks.length - 1] !== "S") toks.push("S");
  return toks.join(" ");
}

// Prefer melakarta when multiple names share the same aro/ava
function pickBestName(candidates, store) {
  if (!candidates || candidates.length === 0) return null;
  const mela = candidates.find(n => store.byName[n]?.type === "melakarta");
  if (mela) return mela;
  return candidates.slice().sort((a,b) => a.localeCompare(b))[0];
}

// Build exact (aro, ava) -> raga name map without any normalization.
// We include melakarta and all janya variations exactly as stored in RagaDB_12.
function buildExactAroAvaIndex(rdb) {
  const idx = new Map();

  // helper to store if both strings exist
  const putIfValid = (name, aro, ava) => {
    if (!aro || !ava) return;
    const key = `${aro.trim()}||${ava.trim()}`;
    if (!idx.has(key)) idx.set(key, name);
  };

  for (const [name, data] of Object.entries(rdb)) {
    if (data.type === "melakarta") {
      // use exactly what's in the DB (you already fixed ends-with-S elsewhere)
      putIfValid(name, data.arohanam, data.avarohanam);

      // some melakarta also carry janyas; we do NOT index those here
      // because the actual janya definitions live in the global object
      // (i.e., at top-level keys) — which we index below.
    } else if (data.type === "janya" && data.variations) {
      for (const [variantName, v] of Object.entries(data.variations)) {
        putIfValid(name, v.arohanam, v.avarohanam);
      }
    }
  }
  return idx;
}

function lookupByExactAroAva(aro, ava) {
  const key = `${aro.trim()}||${ava.trim()}`;
  return ExactAroAvaIndex.get(key) || "Unknown";
}

const hasAllFamilies = (aroStr) => {
  const fams = new Set(
    aroStr.trim().split(/\s+/).map(n => n[0])
  );
  return ["S","R","G","M","P","D","N"].every(f => fams.has(f));
};

function resetUI() {
  const ids = ["selectedInfo", "results", "janakaRaga", "janyaRagas", "dropdown"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  }
}
/* -------------------- fuzzy search helpers -------------------- */

// Canonical normalization for fuzzy comparison
function normalizeName(str) {
  return (str || "")
    .toLowerCase()
    .replace(/\s+/g, "")     // remove spaces
    .replace(/sh/g, "s")     // sh → s
    .replace(/th/g, "t")     // th → t
    .replace(/kh/g, "k")
    .replace(/gh/g, "g")
    .replace(/dh/g, "d")
    .replace(/[āâáà]/g, "a")
    .replace(/[īîíì]/g, "i")
    .replace(/[ūûúù]/g, "u");
}

// Classic Levenshtein distance
function lev(a, b) {
  const dp = Array(a.length + 1).fill(null).map(() =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}


// Option D ranking: exact normalized > prefix > contains > edit distance
function fuzzyBestMatch(query) {
  const q = normalizeName(query);
  if (!q) return null;

  let best = null;

  // 1. exact normalized match
  let exacts = FUZZY_INDEX.filter(r => r.norm === q);
  if (exacts.length) return exacts[0].name;

  // 2. prefix match
  let prefs = FUZZY_INDEX.filter(r => r.norm.startsWith(q));
  if (prefs.length) return prefs[0].name;

  // 3. substring match
  let subs = FUZZY_INDEX.filter(r => r.norm.includes(q));
  if (subs.length) return subs[0].name;

  // 4. Levenshtein distance ≤ 2
  let bestDist = Infinity;
  for (const r of FUZZY_INDEX) {
    const d = lev(q, r.norm);
    if (d < bestDist) {
      bestDist = d;
      best = r.name;
    }
  }
  return bestDist <= 2 ? best : null;
}

/* -------------------- build store + indices -------------------- */
/* IMPORTANT: exact-match index — NO alias substitutions.
   Keys are `${ARO}|${AVA}` using the raw DB strings (only trimmed and S-bounded). */
   function buildStore(rdb) {
    const store = {
      byName: {},                    // canonical name -> node
      names: [],                     // sorted canonical names (for <datalist>)
      nameLut: {},                   // lowercase name -> canonical name
      janakaToJanya: {},             // melakarta -> [janya names]
      janyaToJanaka: {},             // janya -> parent  (FIRST melakarta wins)
      byAroAva: Object.create(null), // "ARO|AVA" -> [candidate names] (exact)
    };
  
    // ----- Melakartas (first pass) -----
    for (const [name, data] of Object.entries(rdb)) {
      if (data.type !== "melakarta") continue;
  
      store.byName[name] = data;
  
      const aro = ensureAroEndsWithS(norm(data.arohanam));
      const ava = norm(
        data.avarohanam && data.avarohanam.trim()
          ? data.avarohanam
          : reverseAro(aro)
      );
      const key = `${aro}|${ava}`;
      (store.byAroAva[key] ||= []).push(name);
  
      const janyas = Object.keys(data.janyas || {});
      store.janakaToJanya[name] = janyas;
  
      // FIRST melakarta wins: only set if not set yet
      for (const janyaName of janyas) {
        if (!store.janyaToJanaka[janyaName]) {
          store.janyaToJanaka[janyaName] = name;
        }
      }
    }
  
    // ----- Janyas (+ variations) (second pass) -----
    for (const [name, data] of Object.entries(rdb)) {
      if (data.type !== "janya") continue;
  
      store.byName[name] = data;
  
      // Do NOT overwrite if a melakarta already claimed this janya
      if (data.parent && !store.janyaToJanaka[name]) {
        store.janyaToJanaka[name] = data.parent;
      }
  
      const vars = data.variations || {};
      for (const v of Object.values(vars)) {
        const aro = ensureAroEndsWithS(norm(v.arohanam));
        const ava = norm(
          v.avarohanam && v.avarohanam.trim()
            ? v.avarohanam
            : reverseAro(aro)
        );
        const key = `${aro}|${ava}`;
        (store.byAroAva[key] ||= []).push(name);
      }
    }
  
    store.names = Object.keys(store.byName).sort((a, b) => a.localeCompare(b));
    for (const n of store.names) store.nameLut[n.toLowerCase()] = n;
  
    return store;
  }
  
  const RagaStore = buildStore(RagaDB);
  
// Build a fuzzy index of canonical names
const FUZZY_INDEX = RagaStore.names.map(name => ({
  name,
  norm: normalizeName(name)
}));


// after RagaDB_12 / RagaStore exists:
const ExactAroAvaIndex = buildExactAroAvaIndex(RagaDB); // or RagaDB_12, whatever you import

/* -------------------- renderers -------------------- */
function renderSelectedInfo(name) {
  const box = $("#selectedInfo");
  if (!box) return;

  const canon = RagaStore.nameLut[name.toLowerCase()] || name;
  const node = RagaStore.byName[canon];
  if (!node) {
    box.innerHTML = `<div class="muted">❌ No matching raga found. Try a different spelling.</div>`;
    return;
  }

  let title = canon;
  let aroForPlay = "";
  const lines = [];

  if (node.type === "janya") {
    title += " (Janya)";
    if (node.parent) lines.push(`<div><b>Parent:</b> ${node.parent}</div>`);
    const firstVar = Object.values(node.variations || {})[0];
    if (firstVar) {
      const aro = ensureAroEndsWithS(norm(firstVar.arohanam));
      const ava = norm(firstVar.avarohanam && firstVar.avarohanam.trim() ? firstVar.avarohanam : reverseAro(aro));
      aroForPlay = aro;
      lines.push(`<div><b>Arohanam:</b> ${aro}</div>`);
      lines.push(`<div><b>Avarohanam:</b> ${ava}</div>`);
    }
  } else {
    title += " (Janaka)";
    const notes = norm(node.notes || "");
    const aro = ensureAroEndsWithS(norm(node.arohanam));
    const ava = norm(node.avarohanam && node.avarohanam.trim() ? node.avarohanam : reverseAro(aro));
    aroForPlay = aro;
    if (notes) lines.push(`<div><b>Notes:</b> ${notes}</div>`);
    lines.push(`<div><b>Arohanam:</b> ${aro}</div>`);
    lines.push(`<div><b>Avarohanam:</b> ${ava}</div>`);
  }

  box.innerHTML = `
    <div class="card">
      <div class="card-title">${title}</div>
      <div class="card-body">${lines.join("")}</div>
      <button id="playSelected" class="playBtn">▶ Play</button>
    </div>
  `;

  const btn = $("#playSelected");
  if (btn && aroForPlay) btn.onclick = () => playRaga(aroForPlay);
}

function grahaResultCard(data) {
  const name = data.name || data.title || "Unknown";
  const aro  = data.aro || data.arohanam || data.notes || "—";
  const ava  = data.ava || data.avarohanam || "—";

  const el = document.createElement("div");
  el.className = "card";
  el.innerHTML = `
    <div class="card-title">${name}</div>
    <div class="card-body">
      <div><b>Arohanam:</b> ${aro}</div>
      <div><b>Avarohanam:</b> ${ava}</div>
    </div>
    <button class="playBtn">▶ Play</button>
  `;
  el.querySelector(".playBtn").onclick = () => playRaga(aro);
  return el;
}


function renderGrahabhedams(all) {
  const results = $("#results");
  if (!results) return;
  results.innerHTML = "";

  if (!all || all.length === 0) {
    results.innerHTML = `<div class="muted">❌ No valid Grahabhedam results.</div>`;
    return;
  }

  // helper: pull "R2" from "Name (S → R2)"
  const extractShift = (name) => {
    const m = /\(S\s*→\s*([^)]+)\)/.exec(name || "");
    return m ? m[1].trim() : null;
  };

  // NEW: only melakarta-like scales (all seven families) get a trailing S when missing
  const hasAllFamilies = (aroStr) => {
    const fams = new Set(aroStr.trim().split(/\s+/).map(n => n[0]));
    return ["S","R","G","M","P","D","N"].every(f => fams.has(f));
  };

  // Build display rows with exact aro/ava and clean label
  const enhanced = all.map((res) => {
    // 1) Arohanam exactly as engine produced it (normalized spaces)
    const aroRaw = (res.notes || "").trim().replace(/\s+/g, " ");

    // If the aro has ALL seven families (melakarta-like) and doesn't end with S, append S.
    let aro = aroRaw;
    if (hasAllFamilies(aroRaw)) {
      const toks = aroRaw.split(" ").filter(Boolean);
      if (toks[toks.length - 1] !== "S") {
        toks.push("S");
        aro = toks.join(" ");
      }
    }

    // 2) Avarohanam = reverse inside, keep S … S bookends
    const parts = aro.split(" ").filter(Boolean);
    let ava;
    if (parts.length >= 2 && parts[0] === "S" && parts[parts.length - 1] === "S") {
      const middle = parts.slice(1, -1).reverse();
      ava = ["S", ...middle, "S"].join(" ");
    } else {
      const rev = [...parts].reverse();
      if (rev[0] !== "S") rev.unshift("S");
      if (rev[rev.length - 1] !== "S") rev.push("S");
      ava = rev.join(" ");
    }

    // 3) Exact DB lookup (no alias swaps)
    const exactName = (typeof lookupByExactAroAva === "function")
      ? (lookupByExactAroAva(aro, ava) || "Unknown")
      : (res.name || "Unknown");

    // 4) Clean mapping label: remove leading "S → " if present
    const shiftRaw = res.shiftLabel
      ? res.shiftLabel.replace(/^S\s*→\s*/,'').trim()
      : (extractShift(res.name) || "");

    const displayName =
      (exactName && exactName !== "Unknown")
        ? (shiftRaw ? `${exactName} (S → ${shiftRaw})` : exactName)
        : (res.name || "Unknown");

    return {
      ...res,
      name: displayName,
      aro,
      ava,
      arohanam: aro,
      avarohanam: ava
    };
  });

  const firstTwo = enhanced.slice(0, 2);
  const rest = enhanced.slice(2);

  for (const r of firstTwo) results.appendChild(grahaResultCard(r));

  if (rest.length > 0) {
    const moreWrap = document.createElement("div");
    moreWrap.style.display = "none";
    for (const r of rest) moreWrap.appendChild(grahaResultCard(r));

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.style.marginTop = "8px";
    toggle.textContent = `▾ Show ${rest.length} more`;

    toggle.addEventListener("click", () => {
      const isOpen = moreWrap.style.display !== "none";
      moreWrap.style.display = isOpen ? "none" : "block";
      toggle.textContent = isOpen ? `▾ Show ${rest.length} more` : "▴ Show less";
      toggle.setAttribute("aria-expanded", String(!isOpen));
    });

    results.appendChild(toggle);
    results.appendChild(moreWrap);
  }
}




function renderJanyasForJanaka(janakaName) {
  const resultsRoot = document.getElementById("results");
  if (!resultsRoot) return;

  resultsRoot.innerHTML = "";

  const node = RagaStore.byName[janakaName];
  if (!node || node.type !== "melakarta") {
    resultsRoot.innerHTML = `
      <div class="card">
        <div class="card-title">Janaka not found</div>
        <div class="card-body">“${janakaName}” is not a melakarta in the database.</div>
      </div>
    `;
    return;
  }

  const janyaNames = RagaStore.janakaToJanya[janakaName] || [];

  // Build two-cards-first + toggle UI, with play buttons and clean wrapping
  const list = document.createElement("div");
  const shown = 2;

  const makeJanyaCard = (name) => {
    const jNode = RagaStore.byName[name];
    const v = Object.values(jNode?.variations || {})[0] || {};
    const aro = ensureAroEndsWithS(norm(v.arohanam || jNode?.arohanam || ""));
    const ava = norm(v.avarohanam && v.avarohanam.trim() ? v.avarohanam : reverseAro(aro));

    const card = document.createElement("div");
    card.className = "card janya-card";

    const title = document.createElement("div");
    title.className = "card-title janya-title";
    const nameEl = document.createElement("div");
    nameEl.className = "janya-name";
    nameEl.textContent = name;
    title.appendChild(nameEl);
    card.appendChild(title);

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = `
      <div><strong>Arohanam:</strong> ${aro || "—"}</div>
      <div><strong>Avarohanam:</strong> ${ava || "—"}</div>
    `;

    const playWrap = document.createElement("div");
    playWrap.className = "play-wrap";
    const btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.textContent = "▶ Play";
    btn.addEventListener("click", () => playRaga(aro));
    playWrap.appendChild(btn);

    body.appendChild(playWrap);
    card.appendChild(body);
    return card;
  };

  const addRange = (arr) => {
    for (const n of arr) {
      if (!RagaStore.byName[n]) continue;
      list.appendChild(makeJanyaCard(n));
    }
  };

  addRange(janyaNames.slice(0, shown));
  resultsRoot.appendChild(list);

  if (janyaNames.length > shown) {
    // Hidden container for the rest
    const restWrap = document.createElement("div");
    restWrap.id = "janya-more";
    restWrap.style.display = "none";
    resultsRoot.appendChild(restWrap);

    // Top toggle button
    const toggle = document.createElement("button");
    toggle.className = "btn btn-link show-more";
    toggle.textContent = `▾ Show ${janyaNames.length - shown} more`;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "janya-more");
    let expanded = false;

    // ★ Floating collapse button (one per page; reuse if it already exists)
    let fab = document.getElementById("janyaCollapseFab");
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "janyaCollapseFab";
      fab.className = "fab-collapse";
      fab.textContent = "▴ Collapse";
      fab.hidden = true; // hidden until expanded
      document.body.appendChild(fab);
    }

    const setExpanded = (wantExpanded) => {
      expanded = !!wantExpanded;
      if (expanded) {
        // fill and show
        restWrap.replaceChildren();
        addRange(janyaNames.slice(shown));
        restWrap.style.display = "block";
        toggle.textContent = "▴ Show less";
        toggle.setAttribute("aria-expanded", "true");
        fab.hidden = false; // show FAB
      } else {
        // collapse to first two
        restWrap.style.display = "none";
        restWrap.replaceChildren();
        list.replaceChildren();
        addRange(janyaNames.slice(0, shown));
        toggle.textContent = `▾ Show ${janyaNames.length - shown} more`;
        toggle.setAttribute("aria-expanded", "false");
        fab.hidden = true; // hide FAB
        // optional: snap back near the top of the section
        resultsRoot.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    };

    toggle.addEventListener("click", () => setExpanded(!expanded));
    fab.addEventListener("click", () => setExpanded(false)); // collapse from anywhere

    resultsRoot.appendChild(toggle);
    resultsRoot.appendChild(restWrap);
  }
}


/* -------------------- grahabhedam action -------------------- */
// --- PATCH: parent-guided Grahabhedam generation ---
function generateFromSelected() {
  const inputEl = $("#ragaSearch");
  if (!inputEl) return;

  const typed = inputEl.value.trim();

  // ---------- PATCHED: fuzzy-correct the name ----------
  let canon = RagaStore.nameLut[typed.toLowerCase()];

  // If exact match not found, apply fuzzy (your step 2 = YES)
  if (!canon) {
    const fuzzy = fuzzyBestMatch(typed);
    if (fuzzy) {
      canon = fuzzy;
      inputEl.value = fuzzy;   // override typed value (your requirement)
    }
  }

  // If still nothing, fallback to typed
  if (!canon) canon = typed;
  // ------------------------------------------------------

  const node = RagaStore.byName[canon];
  const resultsDiv = $("#results");
  if (resultsDiv) resultsDiv.innerHTML = "";

  if (!node) {
    if (resultsDiv)
      resultsDiv.innerHTML = `<div class="muted">❌ Unknown raga: ${canon}</div>`;
    return;
  }

  // --- Determine the input Arohanam string for the engine ---
  let inputAro = "";
  if (node.type === "melakarta") {
    inputAro = ensureAroEndsWithS(norm(node.arohanam || ""));
  } else if (node.type === "janya") {
    // Prefer the first variation's arohanam
    const vars = node.variations || {};
    const firstKey = Object.keys(vars)[0];
    if (firstKey && vars[firstKey]?.arohanam) {
      inputAro = ensureAroEndsWithS(norm(vars[firstKey].arohanam));
    } else {
      // fallback if arohanam is directly on the node
      inputAro = ensureAroEndsWithS(norm(node.arohanam || ""));
    }
  }

  if (!inputAro) {
    if (resultsDiv)
      resultsDiv.innerHTML = `<div class="muted">❌ No Arohanam found for ${canon}</div>`;
    return;
  }

  // --- Provide parentNotes for ambiguity resolution (first-wins parent) ---
  let parentNotes = "";
  if (node.type === "janya") {
    const parentName = RagaStore.janyaToJanaka[canon] || node.parent;
    if (parentName && RagaStore.byName[parentName]) {
      parentNotes = RagaStore.byName[parentName].notes || "";
    }
  } else if (node.type === "melakarta") {
    parentNotes = node.notes || "";
  }

  // --- Generate and render ---
  const rows = GEngine.generate(inputAro, {
    requireSevenFamilies: false,
    parentNotes
  });

  renderGrahabhedams(rows);
}

/* -------------------- boot -------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // unlock audio on first gesture
  document.body.addEventListener("pointerdown", () => unlockAudio(), { once: true });

  // 💡 small helper to clear previous output
  function resetUI() {
    const ids = ["selectedInfo", "results", "janakaRaga", "janyaRagas", "dropdown"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
    }
  }

  const input    = $("#ragaSearch");
  const datalist = $("#ragaSuggestions");
  const btnGen   = $("#generateBtn");
  const btnFind  = $("#findRelationsBtn");

  // populate <datalist>
  if (datalist) {
    datalist.innerHTML = "";
    for (const n of RagaStore.names) {
      const opt = document.createElement("option");
      opt.value = n;
      datalist.appendChild(opt);
    }
  }

  // show card as soon as the user selects an exact name (case-insensitive)
  if (input) {
    
    const updateSelection = () => {
      const typed = input.value.trim();
      if (!typed) {
        resetUI();
        return;
      }
      // Exact name match only
      let canon = RagaStore.nameLut[typed.toLowerCase()];
      resetUI();
      if (canon) renderSelectedInfo(canon);
    };

  
    input.addEventListener("input", updateSelection);
    input.addEventListener("change", updateSelection);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") updateSelection();
    });
  }
  

  if (btnGen) {
    btnGen.addEventListener("click", () => {
      resetUI();          // 🔄 clear before generating fresh results
      generateFromSelected();
    });
  }

  // “Find Janaka/Janya Ragams”: if janya is selected, jump to its parent; else show janyas of janaka
// “Find Janaka/Janya Ragams”: if janya is selected, jump to its parent; else show janyas of janaka
if (btnFind) {
  btnFind.addEventListener("click", () => {
    resetUI();          // 🔄 clear before rendering relations
    const typed = input ? input.value.trim() : "";
    if (!typed) return;

    // ---------- PATCHED: fuzzy-correct the name ----------
    let canon = RagaStore.nameLut[typed.toLowerCase()];

    if (!canon) {
      const fuzzy = fuzzyBestMatch(typed);
      if (fuzzy) {
        canon = fuzzy;
        if (input) input.value = fuzzy;   // override user text (your requirement)
      }
    }

    if (!canon) canon = typed;
    // ------------------------------------------------------

    const node = RagaStore.byName[canon];
    if (!node) return;

    const janaka = node.type === "janya" ? (node.parent || "") : canon;
    if (!janaka) return;

    renderJanyasForJanaka(janaka);
  });
}

});













