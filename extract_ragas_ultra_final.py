#!/usr/bin/env python3
import sys
import json
import re
from collections import OrderedDict, defaultdict

import pdfplumber

def normalize_name(name: str) -> str:
    """Uppercase and strip spaces for reliable name comparison."""
    return re.sub(r"\s+", "", name).upper()


# ----------  MELAKARTA DEFINITIONS (canonicalRagaLookup in strict 1–72 order) ----------

CANONICAL_RAGA_LOOKUP = OrderedDict([
    # 1–36: M1 (Suddha Madhyamam)
    ("S R1 G1 M1 P D1 N1", "Kanakangi"),
    ("S R1 G1 M1 P D1 N2", "Ratnangi"),
    ("S R1 G1 M1 P D1 N3", "Ganamurti"),
    ("S R1 G1 M1 P D2 N2", "Vanaspati"),
    ("S R1 G1 M1 P D2 N3", "Manavati"),
    ("S R1 G1 M1 P D3 N3", "Tanarupi"),

    ("S R1 G2 M1 P D1 N1", "Senavati"),
    ("S R1 G2 M1 P D1 N2", "Hanumatodi"),
    ("S R1 G2 M1 P D1 N3", "Dhenuka"),
    ("S R1 G2 M1 P D2 N2", "Natakapriya"),
    ("S R1 G2 M1 P D2 N3", "Kokilapriya"),
    ("S R1 G2 M1 P D3 N3", "Rupavati"),

    ("S R1 G3 M1 P D1 N1", "Gayakapriya"),
    ("S R1 G3 M1 P D1 N2", "Vakulabharanam"),
    ("S R1 G3 M1 P D1 N3", "Mayamalavagowla"),
    ("S R1 G3 M1 P D2 N2", "Chakravakam"),
    ("S R1 G3 M1 P D2 N3", "Suryakantam"),
    ("S R1 G3 M1 P D3 N3", "Hatakambari"),

    ("S R2 G2 M1 P D1 N1", "Jhankaradhwani"),
    ("S R2 G2 M1 P D1 N2", "Natabhairavi"),
    ("S R2 G2 M1 P D1 N3", "Kiravani"),
    ("S R2 G2 M1 P D2 N2", "Kharaharapriya"),
    ("S R2 G2 M1 P D2 N3", "Gowrimanohari"),
    ("S R2 G2 M1 P D3 N3", "Varunapriya"),

    ("S R2 G3 M1 P D1 N1", "Mararanjani"),
    ("S R2 G3 M1 P D1 N2", "Charukesi"),
    ("S R2 G3 M1 P D1 N3", "Sarasangi"),
    ("S R2 G3 M1 P D2 N2", "Harikambhoji"),
    ("S R2 G3 M1 P D2 N3", "Dheerasankarabharanam"),
    ("S R2 G3 M1 P D3 N3", "Naganandini"),

    ("S R3 G3 M1 P D1 N1", "Yagapriya"),
    ("S R3 G3 M1 P D1 N2", "Ragavardhini"),
    ("S R3 G3 M1 P D1 N3", "Gangeyabhushani"),
    ("S R3 G3 M1 P D2 N2", "Vagadeeshwari"),
    ("S R3 G3 M1 P D2 N3", "Shulini"),
    ("S R3 G3 M1 P D3 N3", "Chalanata"),

    # 37–72: M2 (Prati Madhyamam)
    ("S R1 G1 M2 P D1 N1", "Salagam"),
    ("S R1 G1 M2 P D1 N2", "Jalarnavam"),
    ("S R1 G1 M2 P D1 N3", "Jhalavarali"),
    ("S R1 G1 M2 P D2 N2", "Navaneetam"),
    ("S R1 G1 M2 P D2 N3", "Pavani"),
    ("S R1 G1 M2 P D3 N3", "Raghupriya"),

    ("S R1 G2 M2 P D1 N1", "Gavambodhi"),
    ("S R1 G2 M2 P D1 N2", "Bhavapriya"),
    ("S R1 G2 M2 P D1 N3", "Shubhapantuvarali"),
    ("S R1 G2 M2 P D2 N2", "Shadvidhamargini"),
    ("S R1 G2 M2 P D2 N3", "Suvarnangi"),
    ("S R1 G2 M2 P D3 N3", "Divyamani"),

    ("S R1 G3 M2 P D1 N1", "Dhavalambari"),
    ("S R1 G3 M2 P D1 N2", "Namanarayani"),
    ("S R1 G3 M2 P D1 N3", "Kamavardhini"),
    ("S R1 G3 M2 P D2 N2", "Ramapriya"),
    ("S R1 G3 M2 P D2 N3", "Gamanashrama"),
    ("S R1 G3 M2 P D3 N3", "Vishwambhari"),

    ("S R2 G2 M2 P D1 N1", "Shyamalaangi"),
    ("S R2 G2 M2 P D1 N2", "Shanmukhapriya"),
    ("S R2 G2 M2 P D1 N3", "Simhendramadhyamam"),
    ("S R2 G2 M2 P D2 N2", "Hemavati"),
    ("S R2 G2 M2 P D2 N3", "Dharmavati"),
    ("S R2 G2 M2 P D3 N3", "Neetimati"),

    ("S R2 G3 M2 P D1 N1", "Kantamani"),
    ("S R2 G3 M2 P D1 N2", "Rishabhapriya"),
    ("S R2 G3 M2 P D1 N3", "Latangi"),
    ("S R2 G3 M2 P D2 N2", "Vachaspati"),
    ("S R2 G3 M2 P D2 N3", "Mechakalyani"),
    ("S R2 G3 M2 P D3 N3", "Chitrambari"),

    ("S R3 G3 M2 P D1 N1", "Sucharitra"),
    ("S R3 G3 M2 P D1 N2", "Jyotiswarupini"),
    ("S R3 G3 M2 P D1 N3", "Dhatuvardani"),
    ("S R3 G3 M2 P D2 N2", "Nasikabhushani"),
    ("S R3 G3 M2 P D2 N3", "Kosalam"),
    ("S R3 G3 M2 P D3 N3", "Rasikapriya"),
])


SWARA_RE = re.compile(r"^[SRGMPDN]+$")  # tokens made only of these letters are treated as swaras


# ----------  MELAKARTA BASE  ----------

def build_melakarta_base():
    """Create base RagaDB with all 72 melakartas and empty janyas."""
    db = {}
    for notes, name in CANONICAL_RAGA_LOOKUP.items():
        note_tokens = notes.split()
        # Canonical melakarta aro/ava from swara notes
        aro = notes + " S"
        rev = note_tokens[::-1]
        if len(rev) > 1:
            ava = "S " + " ".join(rev[1:])
        else:
            ava = "S"
        db[name] = {
            "type": "melakarta",
            "notes": notes,
            "arohanam": aro,
            "avarohanam": ava,
            "janyas": {}
        }
    return db


# ----------  PDF PARSING HELPERS  ----------

def extract_all_lines(pdf_path, start_page_guess=50):
    """Flatten text from pages into a single list of non-empty lines."""
    lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            if i < start_page_guess:
                continue
            text = page.extract_text() or ""
            for raw in text.splitlines():
                s = raw.strip()
                if s:
                    lines.append(s)
    return lines


def find_janya_header_indices(lines):
    """
    Find indices of janya table headers.

    In the actual PDF, the header line looks like:
      'Name ofRaga Arohanam Avarohanam Ref.'

    So we just look for any line that contains both
    'Arohanam' and 'Avarohanam'.
    """
    header_indices = []
    for i, line in enumerate(lines):
        if "Arohanam" in line and "Avarohanam" in line:
            header_indices.append(i)
    return header_indices


def split_into_melakarta_blocks(lines, header_indices):
    """
    Given the full text lines from the PDF and the indices where
    'Name of Raga  Arohanam  Avarohanam  Ref.' occurs (one per melakarta
    janya table), carve the text into one block per melakarta.

    Fixes:
      • Stop at next table header.
      • Stop before CHAKRA/CHAKRAM headings.
      • Stop before new PAGE markers.
      • Stop at '* * *' for the LAST melakarta (Rasikapriya only).
    """
    blocks = []
    n = len(lines)

    for idx, header_idx in enumerate(header_indices):
        start = header_idx + 1
        end = header_indices[idx + 1] if idx + 1 < len(header_indices) else n

        cut = end


        for i in range(start, end):
            line = lines[i]
            stripped = line.strip()

            # New page marker -> next melakarta context starts
            if stripped.startswith("===== PAGE"):
                cut = i
                break

            # ✅ Only treat a CHAKRA/CHAKRAM line as a section header if the
            # WHOLE line is already ALL CAPS. This prevents matches on
            # mixed-case janya names that contain the word "Chakra".
            # We also keep the word-boundary to avoid "CHAKRAVAKAM".
            if stripped == stripped.upper() and re.search(r"\bCHAKRA(M)?\b", stripped):
                cut = i
                break

        block_lines = lines[start:cut]
        blocks.append(block_lines)
        
    return blocks




def is_swara_token(tok: str) -> bool:
    return bool(SWARA_RE.fullmatch(tok))


def normalize_entry_lines(block_lines):
    """
    Merge wrapped lines so that each numbered entry (main or variant)
    becomes one string.

    FIXES:
      • Allow leading whitespace: Rasikapriya entries are indented.
      • Correctly detect both '1.' and '1 ' forms.
    """
    entry_lines = []
    current = ""

    for line in block_lines:
        stripped = line.rstrip()

        # NEW ENTRY if line starts (after optional spaces) with:
        #   "N."  OR  "N "
        if re.match(r"^\s*\d+\.", stripped) or re.match(r"^\s*\d+\s", stripped):
            # save previous entry
            if current:
                entry_lines.append(current.strip())

            # start new entry
            current = stripped
        else:
            # continuation line
            if current:
                current += " " + stripped

    # flush last entry
    if current:
        entry_lines.append(current.strip())

    return entry_lines



def is_swara_token(tok):
    """
    Accept any token that is a sequence of S/R/G/M/P/D/N in any combination.
    Works for: S, SR, GM, DN, SPM, PGR, SGM, etc.
    """
    tok = tok.strip()
    return bool(re.fullmatch(r"[SRGMPDN]+", tok))


def find_boundary_S_index(tokens):
    """
    Find the LAST swara token that is either:
      - exactly "S"
      - ends with "S"
    That marks the end of AROHANAM in the PDF format.
    """
    for i in reversed(range(len(tokens))):
        t = tokens[i]
        if t == "S" or t.endswith("S"):
            return i
    return None


def parse_janyas_from_block(block_lines):
    """
    Parse one melakarta's janya section into:
      { janya_name: [ (variant_index, arohanam_str, avarohanam_str), ... ] }

    Splitting rule:
      1. Flatten swara clusters (SR, GM, SPM, etc.) into individual notes
         like [S, R, G, M, P, S, ...].
      2. Find the 2nd 'S' in that flat note list.
      3. Arohanam = from start through that 2nd 'S' (inclusive).
         Avarohanam = everything AFTER that 2nd 'S'.
      4. If fewer than 2 S's are found, fall back to using the full sequence
         for both arohanam and avarohanam.
    """
    entry_lines = normalize_entry_lines(block_lines)
    janyas = defaultdict(list)
    last_main_name = None

    for entry in entry_lines:
        entry = entry.strip()
        if not entry:
            continue

        # Main entry: "1. Bhanupriya SR GM PS SPM GR S AE"
        # Accept "1. Bhanupriya ..." AND "1 Bhanupriya ..."
        m_main = re.match(r"^(\d+)[\.\s]+\s*(.+)$", entry)
        # Alt entry: "2 SR PM PDN S SDPM GR S P"
        m_alt = None if m_main else re.match(r"^(\d+)\s+(.+)$", entry)

        if m_main:
            serial = int(m_main.group(1))
            rest = m_main.group(2).strip()
            tokens = rest.split()

            # Extract name (tokens until the first swara token)
            name_tokens = []
            i = 0
            while i < len(tokens) and not is_swara_token(tokens[i]):
                name_tokens.append(tokens[i])
                i += 1
            if not name_tokens:
                continue

            name = " ".join(name_tokens)
            last_main_name = name
            variant_index = 1

            # swara tokens (clusters like SR, GM, PS, SPM, etc.)
            swara_tokens = [t for t in tokens[i:] if is_swara_token(t)]

        elif m_alt and last_main_name is not None:
            serial = int(m_alt.group(1))
            rest = m_alt.group(2).strip()
            tokens = rest.split()

            name = last_main_name
            variant_index = serial
            swara_tokens = [t for t in tokens if is_swara_token(t)]

        else:
            # malformed or alt without a main
            continue

        if not swara_tokens:
            continue

        # 1) Flatten clusters into individual notes: "SR" -> "S","R"
        notes = []
        for grp in swara_tokens:
            for ch in grp:
                if ch in "SRGMPDN":
                    notes.append(ch)

        if not notes:
            continue

        # 2) Find positions of 'S'
        s_positions = [idx for idx, n in enumerate(notes) if n == "S"]

        if len(s_positions) >= 2:
            # 3) Split after the 2nd S (index s_positions[1])
            split_idx = s_positions[1]
            aro_notes = notes[:split_idx + 1]      # include 2nd S
            ava_notes = notes[split_idx + 1:]      # start AFTER 2nd S

            if not ava_notes:
                # edge case fallback: if somehow empty
                ava_notes = notes
        else:
            # fewer than 2 'S' notes: fallback to full as both
            aro_notes = notes
            ava_notes = notes

        # 4) Join with single spaces
        aro = " ".join(aro_notes)
        ava = " ".join(ava_notes)

        janyas[name].append((variant_index, aro, ava))

    return janyas







# ----------  MAIN BUILD FUNCTION  ----------

def build_raga_db(pdf_path, _janaka_js_ignored, out_path):
    print(f"Reading PDF from: {pdf_path}")
    # Build melakarta skeleton
    db = build_melakarta_base()

    # Extract lines from the back half of the PDF (where the tables live)
    lines = extract_all_lines(pdf_path, start_page_guess=50)
    header_indices = find_janya_header_indices(lines)

    if not header_indices:
        print("[WARN] No janya headers found – RagaDB will contain only melakartas.")
    else:
        print(f"[INFO] Found {len(header_indices)} janya table headers")

    blocks = split_into_melakarta_blocks(lines, header_indices)

    # --- NEW: precompute normalized melakarta names ---
    melakarta_names = list(CANONICAL_RAGA_LOOKUP.values())
    melakarta_norms = {normalize_name(m) for m in melakarta_names}
    # --------------------------------------------------

    # For melakartas that didn't get blocks, we'll just leave janyas empty.
    for mela_index, (notes, mela_name) in enumerate(CANONICAL_RAGA_LOOKUP.items(), start=1):
        try:
            block_lines = blocks[mela_index-1]
        except IndexError:
            print(f"[WARN] No janyas parsed for melakarta {mela_name}")
            block_lines = []


        janyas_for_mela = parse_janyas_from_block(block_lines)

        # --- NEW: drop bogus janya entries that are actually melakarta headings ---
        cleaned_janyas = {}
        for janya_name, variants in janyas_for_mela.items():
            norm = normalize_name(janya_name)

            # Only filter out if:
            #  1) The name matches a known melakarta, AND
            #  2) It "looks like" a heading (all caps or mostly caps)
            if norm in melakarta_norms and janya_name.upper() == janya_name:
                # e.g., "RATNANGI", "GANAMURTHI" – treat as melakarta heading, not janya
                continue

            cleaned_janyas[janya_name] = variants

        janyas_for_mela = cleaned_janyas
        # ------------------------------------------------------------------------

        if not janyas_for_mela:
            print(f"[WARN] Empty janya section for melakarta {mela_name}")
            continue

        # Wire them into db: both under the melakarta and as top-level janya entries
        mela_janyas_map = {}
        for janya_name, variants in janyas_for_mela.items():
            # Variants: list[(variant_index, aro, ava)]
            variations_obj = {}
            variant_ids = []
            for (v_idx, aro, ava) in sorted(variants, key=lambda t: t[0]):
                vid = f"{janya_name}{v_idx}"
                variations_obj[vid] = {
                    "arohanam": aro,
                    "avarohanam": ava,
                }
                variant_ids.append(vid)

            # Top-level janya definition
            db[janya_name] = {
                "type": "janya",
                "parent": mela_name,
                "variations": variations_obj,
            }

            # Record mapping under the melakarta
            mela_janyas_map[janya_name] = variant_ids

        db[mela_name]["janyas"] = mela_janyas_map

    # Write JS file
    js_code = "export const RagaDB = " + json.dumps(db, indent=2, ensure_ascii=False) + ";\n"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(js_code)

    print(f"Wrote RagaDB to: {out_path}")



# ----------  CLI ----------

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python3 extract_ragas_ultra_final.py <pdf_path> <JanakaRaga.js (ignored)> <out_js_path>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    janaka_stub = sys.argv[2]  # kept for CLI compatibility, not used
    out_path = sys.argv[3]

    build_raga_db(pdf_path, janaka_stub, out_path)

