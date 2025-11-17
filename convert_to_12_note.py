import json
import re
import sys

# -------------------------------------------------------
# LOAD JS-AS-JSON (strip the "export const RagaDB =" part)
# -------------------------------------------------------
def load_raga_db(path):
    text = open(path, "r", encoding="utf8").read()

    # Remove prefix: export const RagaDB =
    text = re.sub(r"^.*?RagaDB\s*=\s*", "", text, flags=re.S)

    # Remove trailing semicolon if present
    text = text.strip()
    if text.endswith(";"):
        text = text[:-1]

    return json.loads(text)


# -------------------------------------------------------
# BUILD NOTE MAP FOR EACH MELAKARTA
# -------------------------------------------------------
def build_mela_map(mela):
    """
    Takes melakarta entry:
      notes: "S R1 G1 M1 P D1 N1"
    Returns:
      { "S": "S", "R": "R1", "G": "G1", ... }
    """
    mapping = {}
    parts = mela["notes"].split()
    for p in parts:
        if p[0] in "SRGMPDN":
            mapping[p[0]] = p  # e.g. R -> R1
    return mapping


# -------------------------------------------------------
# APPLY 12-NOTE SUBSTITUTION
# -------------------------------------------------------
def substitute(sequence, mapping):
    """
    sequence like "S R G M P S"
    mapping like { "S": "S", "R": "R1", ... }
    """
    out = []
    for ch in sequence.split():
        base = ch[0]  # S or R or G etc.
        if base in mapping:
            out.append(mapping[base])
        else:
            out.append(ch)
    return " ".join(out)


# -------------------------------------------------------
# MAIN CONVERSION LOGIC
# -------------------------------------------------------
def convert(rdb):
    # Build melakarta note maps
    mela_maps = {}
    for raga, data in rdb.items():
        if data["type"] == "melakarta":
            mela_maps[raga] = build_mela_map(data)

    # Process janyas
    for raga, data in rdb.items():
        if data["type"] != "janya":
            continue

        parent = data["parent"]
        if parent not in mela_maps:
            print(f"[WARN] Parent not found for {raga}: {parent}")
            continue

        mp = mela_maps[parent]

        # Variations
        for varname, varstruct in data["variations"].items():
            if "arohanam" in varstruct:
                varstruct["arohanam"] = substitute(varstruct["arohanam"], mp)

            if "avarohanam" in varstruct:
                varstruct["avarohanam"] = substitute(varstruct["avarohanam"], mp)

    return rdb


# -------------------------------------------------------
# WRITE OUTPUT AS JS FILE
# -------------------------------------------------------
def write_js(obj, path):
    with open(path, "w", encoding="utf8") as f:
        f.write("export const RagaDB_12 = ")
        json.dump(obj, f, indent=2)
        f.write(";\n")


# -------------------------------------------------------
# ENTRY POINT
# -------------------------------------------------------
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 convert_to_12_note.py RagaDB.js RagaDB_12.js")
        sys.exit(1)

    src = sys.argv[1]
    dst = sys.argv[2]

    rdb = load_raga_db(src)
    out = convert(rdb)
    write_js(out, dst)

    print(f"12-note RagaDB written to {dst}")

