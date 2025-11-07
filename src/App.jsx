import React, { useState } from "react";
import { allRagas } from "./RagaData";
import { generateGrahabhedam } from "./GrahabhedamEngine";

export default function App() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);

  const filtered = allRagas.filter(r =>
    r.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 16, fontFamily: "sans-serif" }}>
      <h2>Grahabhedam</h2>

      <input
        placeholder="Search or choose a raga..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 8 }}
      />

      <select
        style={{ width: "100%", padding: 8 }}
        value={selected?.name || ""}
        onChange={e =>
          setSelected(allRagas.find(r => r.name === e.target.value))
        }
      >
        <option value="">Select a Raga</option>
        {filtered.map(r => (
          <option key={r.name} value={r.name}>{r.name}</option>
        ))}
      </select>

      <button
        onClick={() => selected && setResults(generateGrahabhedam(selected.pattern))}
        style={{
          width: "100%",
          marginTop: 12,
          padding: 10,
          backgroundColor: selected ? "#007bff" : "gray",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: selected ? "pointer" : "not-allowed"
        }}
        disabled={!selected}
      >
        Generate Grahabhedams
      </button>

      {results.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {results.map((res, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <strong>{res.name}</strong><br />
              <span style={{ color: "gray" }}>{res.notes}</span>
              <hr />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

