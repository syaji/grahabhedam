import { playRaga } from './audioPlayer.js';
import { RagaStore } from "./RagaData.js";
import { GrahabhedamEngine } from "./GrahabhedamEngine.js";

document.addEventListener("DOMContentLoaded", () => {
  // 🎵 iOS Safari audio unlock
  document.addEventListener(
    "touchstart",
    () => {
      const ctx = window.AudioContext ? new AudioContext() : new webkitAudioContext();
      if (ctx.state === "suspended") ctx.resume();
    },
    { once: true }
  );

  const searchInput = document.getElementById("ragaSearch");
  const dropdown = document.getElementById("dropdown");
  const selectedInfo = document.getElementById("selectedInfo");
  const generateBtn = document.getElementById("generateBtn");
  const resultsContainer = document.getElementById("results");

  let selectedRaga = null;

  // Convert raga lookup map to array
  const allRagas = Object.entries(RagaStore.canonicalRagaLookup).map(([notes, name]) => ({
    name,
    notes
  }));

  // Handle search input
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
      item.className = "dropdown-item";
      item.textContent = `${r.name} — ${r.notes}`;
      item.addEventListener("click", () => {
        selectedRaga = r;
        searchInput.value = r.name;
        dropdown.style.display = "none";

        // Clear and show selected raga info
        selectedInfo.innerHTML = "";

        const infoDiv = document.createElement("div");
        infoDiv.innerHTML = `<strong>${r.name}</strong><br>${r.notes}`;
        infoDiv.style.marginTop = "10px";

        // 🎵 Play button for input raga
        const playBtn = document.createElement("button");
        playBtn.textContent = "▶️";
        playBtn.className = "play-btn";
        playBtn.style.marginLeft = "10px";
        playBtn.onclick = () => playRaga(r.notes);

        infoDiv.appendChild(playBtn);
        selectedInfo.appendChild(infoDiv);

        generateBtn.disabled = false;
      });

      dropdown.appendChild(item);
    });

    dropdown.style.display = "block";
  });

  searchInput.addEventListener("blur", () =>
    setTimeout(() => (dropdown.style.display = "none"), 150)
  );

  // Handle Grahabhedam generation
  generateBtn.addEventListener("click", () => {
    if (!selectedRaga) return;

    const results = GrahabhedamEngine.generate(selectedRaga.notes, RagaStore);
    resultsContainer.innerHTML = "";

    results.forEach(r => {
      const card = document.createElement("div");
      card.className = "result-card";

      const name = document.createElement("div");
      name.innerHTML = `<strong>${r.name}</strong><br>${r.notes}`;

      // 🎵 Play button for result raga
      const playBtn = document.createElement("button");
      playBtn.textContent = "▶️";
      playBtn.className = "play-btn";
      playBtn.onclick = () => playRaga(r.notes);

      card.appendChild(name);
      card.appendChild(playBtn);
      resultsContainer.appendChild(card);
    });

    // Play All button
    if (results.length > 0) {
      const playAll = document.createElement("button");
      playAll.textContent = "🎧 Play All Grahabhedams";
      playAll.className = "play-btn";
      playAll.style.display = "block";
      playAll.style.margin = "12px auto";
      playAll.onclick = async () => {
        for (const r of results) {
          await new Promise(resolve => {
            playRaga(r.notes);
            setTimeout(resolve, 3500);
          });
        }
      };
      resultsContainer.appendChild(playAll);
    }
  });

  // Optional: skip SW for localhost
  if (location.hostname !== "localhost" && "serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => console.log("✅ Service worker registered"))
      .catch(err => console.error("Service worker failed:", err));
  }
});

