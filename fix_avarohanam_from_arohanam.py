import re
import sys

NOTE_RE = re.compile(r'\b[SRGMPDN](?:[123])?\b')

def parse_notes(s: str):
    # Pull clean tokens like S, R1, G2, M2, P, D3, N1...
    return NOTE_RE.findall(s)

def canon_join(tokens):
    return " ".join(tokens)

def main(src, dst):
    with open(src, "r", encoding="utf-8") as f:
        lines = f.readlines()

    out = []
    inside_mela = False
    have_aro = False
    aro_tokens = None

    for i, line in enumerate(lines):
        stripped = line.strip()

        # Enter melakarta block when we see type: "melakarta"
        if '"type"' in stripped and '"melakarta"' in stripped:
            inside_mela = True
            have_aro = False
            aro_tokens = None

        # Capture arohanam inside melakarta
        if inside_mela and '"arohanam"' in stripped:
            m = re.search(r'"arohanam"\s*:\s*"([^"]+)"', line)
            if m:
                aro = m.group(1)
                aro_tokens = parse_notes(aro)
                have_aro = len(aro_tokens) >= 2  # usually "S ... S"

        # Rewrite avarohanam = reversed(arohanam) inside melakarta
        if inside_mela and '"avarohanam"' in stripped and have_aro and aro_tokens:
            rev = list(reversed(aro_tokens))
            new_val = canon_join(rev)
            # Replace the quoted value only
            line = re.sub(r'("avarohanam"\s*:\s*")([^"]*)(")',
                          r'\1' + new_val + r'\3',
                          line)

        # Heuristic: leave melakarta block once the object likely ends (first closing brace at base indent)
        # Safer: we exit when we hit a line that starts a sibling top-level key (e.g., "},\n  "NextRaga": {")
        # But simplest workable approach: when we see a line that closes the current object and the next
        # non-empty line starts with a quoted name, we’re out of this melakarta. We’ll keep it simple:
        if inside_mela and stripped.startswith('},'):
            # keep state until next melakarta/type or reset here (both are fine)
            inside_mela = False
            have_aro = False
            aro_tokens = None

        out.append(line)

    with open(dst, "w", encoding="utf-8") as f:
        f.writelines(out)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 fix_avarohanam_from_arohanam.py RagaDB_12.js RagaDB_12_fixed.js")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])

