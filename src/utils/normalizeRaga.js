// utils/normalizeRaga.js
export function stripDiacritics(s) {
  if (!s) return s;
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function squashWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

export function canonicalizeShTh(s) {
  // Normalize common Carnatic transliteration variants
  return s
    .replace(/\bSh/g, 'Sh')
    .replace(/\bS\h/g, 'Sh') // defensive
    .replace(/\bTh/g, 'T')
    .replace(/\bDh/g, 'D')
    .replace(/\bN\u0323/g, 'N'); // dotted N; noop for now
}

export function normalizeName(raw) {
  let s = raw || '';
  s = squashWhitespace(stripDiacritics(s));
  // Keep both S/Sh and T/Th friendly search by returning variants
  return s;
}

export function makeAliasMap() {
  return {
    'Shankarabharanam': 'Dheerasankarabharanam',
    'Sankarabharanam': 'Dheerasankarabharanam',
    'Shri': 'Sri',
    'Reethigowla': 'Reetigowla',
    'Sudha Dhanyasi': 'Suddha Dhanyasi',
  };
}

export function resolveAlias(name, aliases = makeAliasMap()) {
  const key = normalizeName(name);
  return aliases[key] || key;
}