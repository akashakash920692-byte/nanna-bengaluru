import { cafes } from "./data.js";

const state = {
  searchQuery: "",
  neighborhood: "All",
  selectedTags: new Set(),
  onlyOpenNow: false,
  onlySaved: false,
  sortBy: "rating",
  savedIds: new Set(JSON.parse(localStorage.getItem("nannaBengaluruSavedCafes") || "[]"))
};

// DOM Elements
const searchInput = document.getElementById("searchInput");
const openNowCheckbox = document.getElementById("openNowCheckbox");
const sortSelect = document.getElementById("sortSelect");
const neighborhoodPills = document.getElementById("neighborhoodPills");
const tagPills = document.getElementById("tagPills");
const cafeGrid = document.getElementById("cafeGrid");
const resultsCount = document.getElementById("resultsCount");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const savedToggleBtn = document.getElementById("savedToggleBtn");
const savedCount = document.getElementById("savedCount");
const cafeModal = document.getElementById("cafeModal");
const modalBody = document.getElementById("modalBody");
const closeModalBtn = document.getElementById("closeModalBtn");

// Initialize Leaflet Map centered on Bengaluru
const map = L.map("map").setView([12.9616, 77.6146], 12);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);
const markersLayer = L.layerGroup().addTo(map);

function isOpenNow(cafe) {
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const hour = nowIST.getHours();
  return hour >= cafe.openHour && hour < cafe.closeHour;
}

function formatHours(openHour, closeHour) {
  const fmt = (h) => {
    if (h === 24) return "12:00 AM";
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:00 ${suffix}`;
  };
  return `${fmt(openHour)} – ${fmt(closeHour)}`;
}

function toggleSave(id, event) {
  if (event) event.stopPropagation();
  if (state.savedIds.has(id)) {
    state.savedIds.delete(id);
  } else {
    state.savedIds.add(id);
  }
  localStorage.setItem("nannaBengaluruSavedCafes", JSON.stringify([...state.savedIds]));
  render();
}

function initFilterPills() {
  const areas = ["All", ...new Set(cafes.map((c) => c.neighborhood))];
  neighborhoodPills.innerHTML = areas
    .map(
      (area) =>
        `<button class="pill ${state.neighborhood === area ? "active" : ""}" data-area="${area}">${area}</button>`
    )
    .join("");

  const allTags = [...new Set(cafes.flatMap((c) => c.tags))];
  tagPills.innerHTML = allTags
    .map(
      (tag) =>
        `<button class="pill ${state.selectedTags.has(tag) ? "active" : ""}" data-tag="${tag}">${tag}</button>`
    )
    .join("");
}

function getFilteredCafes() {
  const q = state.searchQuery.trim().toLowerCase();

  return cafes
    .filter((cafe) => {
      const matchesSearch =
        !q ||
        cafe.name.toLowerCase().includes(q) ||
        cafe.neighborhood.toLowerCase().includes(q) ||
        cafe.description.toLowerCase().includes(q) ||
        cafe.mustTry.some((m) => m.item.toLowerCase().includes(q));

      const matchesArea =
        state.neighborhood === "All" || cafe.neighborhood === state.neighborhood;

      const matchesTags = [...state.selectedTags].every((tag) =>
        cafe.tags.includes(tag)
      );

      const matchesOpen = !state.onlyOpenNow || isOpenNow(cafe);
      const matchesSaved = !state.onlySaved || state.savedIds.has(cafe.id);

      return matchesSearch && matchesArea && matchesTags && matchesOpen && matchesSaved;
    })
    .sort((a, b) => {
      if (state.sortBy === "priceAsc") return a.priceForTwo - b.priceForTwo;
      if (state.sortBy === "priceDesc") return b.priceForTwo - a.priceForTwo;
      return b.rating - a.rating;
    });
}

function openModal(cafe) {
  const open = isOpenNow(cafe);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${cafe.name} ${cafe.address}`
  )}`;

  modalBody.innerHTML = `
    <span class="rating-badge">★ ${cafe.rating} • ${cafe.neighborhood}</span>
    <h2 style="font-family: 'Fraunces', serif; font-size: 1.6rem; margin: 10px 0 4px;">${cafe.name}</h2>
    <p style="color: var(--muted); font-size: 0.9rem; margin-bottom: 12px;">${cafe.address}</p>
    <p style="margin-bottom: 14px;">${cafe.description}</p>
    <div style="display: flex; gap: 16px; font-size: 0.88rem; margin-bottom: 16px; flex-wrap: wrap;">
      <span class="${open ? "status-open" : "status-closed"}">${open ? "● Open Now" : "● Closed"} (${formatHours(cafe.openHour, cafe.closeHour)})</span>
      <span><strong>₹${cafe.priceForTwo}</strong> for two</span>
      <span>Wi-Fi: <strong>${cafe.wifiSpeed}</strong></span>
    </div>
    <h4 style="font-size: 0.95rem;">Must-Try Menu Highlights</h4>
    <ul class="menu-list">
      ${cafe.mustTry
        .map((m) => `<li><span>${m.item}</span><strong>₹${m.price}</strong></li>`)
        .join("")}
    </ul>
    <a class="primary-btn" href="${mapsUrl}" target="_blank" rel="noopener">Open in Google Maps ↗</a>
  `;

  cafeModal.classList.remove("hidden");
}

function renderMapMarkers(filtered) {
  markersLayer.clearLayers();
  filtered.forEach((cafe) => {
    const marker = L.marker([cafe.coords.lat, cafe.coords.lng]).addTo(markersLayer);
    marker.bindPopup(`
      <strong>${cafe.name}</strong><br/>
      ${cafe.neighborhood} • ★ ${cafe.rating}<br/>
      <small>₹${cafe.priceForTwo} for two</small>
    `);
    marker.on("mouseover", () => marker.openPopup());
    marker.on("click", () => openModal(cafe));
  });
}

function render() {
  const filtered = getFilteredCafes();
  savedCount.textContent = state.savedIds.size;
  savedToggleBtn.classList.toggle("active", state.onlySaved);

  const hasFilters =
    state.searchQuery ||
    state.neighborhood !== "All" ||
    state.selectedTags.size > 0 ||
    state.onlyOpenNow ||
    state.onlySaved;
  resetFiltersBtn.classList.toggle("hidden", !hasFilters);

  resultsCount.textContent = `Showing ${filtered.length} ${
    filtered.length === 1 ? "cafe" : "cafes"
  }`;

  if (filtered.length === 0) {
    cafeGrid.innerHTML = `<p style="color: var(--muted); padding: 20px 0;">No cafes match those filters. Try clearing a tag or neighborhood.</p>`;
  } else {
    cafeGrid.innerHTML = filtered
      .map((cafe) => {
        const open = isOpenNow(cafe);
        const isSaved = state.savedIds.has(cafe.id);
        return `
          <article class="cafe-card" data-id="${cafe.id}">
            <div>
              <div class="card-top">
                <div>
                  <h3 class="card-title">${cafe.name}</h3>
                  <p class="card-area">${cafe.neighborhood} • ₹${cafe.priceForTwo} for two</p>
                </div>
                <span class="rating-badge">★ ${cafe.rating}</span>
              </div>
              <p class="card-desc" style="margin-top: 10px;">${cafe.description}</p>
            </div>
            <div>
              <div class="tag-list" style="margin-bottom: 12px;">
                ${cafe.tags.map((t) => `<span class="tag">${t}</span>`).join("")}
              </div>
              <div class="card-footer">
                <span class="${open ? "status-open" : "status-closed"}">
                  ${open ? "● Open Now" : "● Closed"}
                </span>
                <button class="bookmark-btn ${isSaved ? "saved" : ""}" data-save-id="${cafe.id}">
                  ${isSaved ? "♥ Saved" : "♡ Save"}
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  renderMapMarkers(filtered);
}

// Event Listeners
searchInput.addEventListener("input", (e) => {
  state.searchQuery = e.target.value;
  render();
});

openNowCheckbox.addEventListener("change", (e) => {
  state.onlyOpenNow = e.target.checked;
  render();
});

sortSelect.addEventListener("change", (e) => {
  state.sortBy = e.target.value;
  render();
});

neighborhoodPills.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-area]");
  if (!btn) return;
  state.neighborhood = btn.dataset.area;
  initFilterPills();
  render();
});

tagPills.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tag]");
  if (!btn) return;
  const tag = btn.dataset.tag;
  if (state.selectedTags.has(tag)) {
    state.selectedTags.delete(tag);
  } else {
    state.selectedTags.add(tag);
  }
  initFilterPills();
  render();
});

cafeGrid.addEventListener("click", (e) => {
  const saveBtn = e.target.closest("[data-save-id]");
  if (saveBtn) {
    toggleSave(saveBtn.dataset.saveId, e);
    return;
  }
  const card = e.target.closest(".cafe-card");
  if (card) {
    const cafe = cafes.find((c) => c.id === card.dataset.id);
    if (cafe) openModal(cafe);
  }
});

savedToggleBtn.addEventListener("click", () => {
  state.onlySaved = !state.onlySaved;
  render();
});

resetFiltersBtn.addEventListener("click", () => {
  state.searchQuery = "";
  state.neighborhood = "All";
  state.selectedTags.clear();
  state.onlyOpenNow = false;
  state.onlySaved = false;
  searchInput.value = "";
  openNowCheckbox.checked = false;
  initFilterPills();
  render();
});

closeModalBtn.addEventListener("click", () => cafeModal.classList.add("hidden"));
cafeModal.addEventListener("click", (e) => {
  if (e.target === cafeModal) cafeModal.classList.add("hidden");
});

// Boot
initFilterPills();
render();
