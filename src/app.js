import { RagaStore } from "./RagaData.js";
import { GrahabhedamEngine } from "./GrahabhedamEngine.js";

const searchInput = document.getElementById("ragaSearch");
const dropdown = document.getElementById("dropdown");
const selectedInfo = document.getElementById("selectedInfo");
const generateBtn = document.getElementById("generateBtn");
const resultsDiv = document.getElementById("results");

let selectedRaga = null;

// Convert lookup map to array for searching
const allRagas = Object.entries(RagaStore.canonicalRagaLookup).map(([notes, name]) => ({
  name,
  notes
}));

// Update dropdown as user types
searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  dropdown.innerHTML = "";
  if (!query) {
    dropdown.style.display = "none";
    return;
  }

  const matches = allRagas.filter(r => 
    r.name.toLowerCase().includes(query) || r.notes.toLowerCase().includes(query)
  );

  if (matches.length === 0) {
    dropdown.style.display = "none";
    return;
  }

  matches.forEach(r => {
    const item = document.createElement("div");
    item.textContent = `${r.name} — ${r.notes}`;
    item.addEventListener("click", () => {
      selectedRaga = r;
      searchInput.value = r.name;
      dropdown.style.display = "none";
      selectedInfo.textContent = `Selected: ${r.name} (${r.notes})`;
      generateBtn.disabled = false;
    });
    dropdown.appendChild(item);
  });

  dropdown.style.display = "block";
});

// Hide dropdown on blur
searchInput.addEventListener("blur", () => setTimeout(() => dropdown.style.display = "none", 150));

// Generate Grahabhedams
generateBtn.addEventListener("click", () => {
  if (!selectedRaga) return;
  const results = GrahabhedamEngine.generate(selectedRaga.notes, RagaStore);
  resultsDiv.innerHTML = "";
  results.forEach(r => {
    const div = document.createElement("div");
    div.className = "result";
    div.innerHTML = `<strong>${r.name}</strong><br>${r.notes}`;
    resultsDiv.appendChild(div);
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js')
    .then(() => console.log("✅ Service worker registered"))
    .catch(err => console.error("Service worker failed:", err));
}

