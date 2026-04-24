document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("wallpapers");
  const searchInput = document.getElementById("search");
  const sortSelect = document.getElementById("sortSelect");
  const categoriesBar = document.getElementById("categoriesBar");
  const deviceToggle = document.getElementById("deviceToggle");
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  const menuBtn = document.getElementById("menuBtn");
  const sidePanel = document.getElementById("sidePanel");
  const popup = document.getElementById("popup");
  const popupImg = document.getElementById("popupImg");
  const popupHeart = document.getElementById("popupHeart");
  const popupResolution = document.getElementById("popupResolution");
  const popupCategory = document.getElementById("popupCategory");
  const downloadBtn = document.getElementById("downloadBtn");

  const likes = JSON.parse(localStorage.getItem("likes")) || {};
  const indexMap = new Map();
  wallpapers.forEach((w, i) => indexMap.set(w.img, i));
  const wallpaperIdMap = new Map();
  const wallpaperByIdMap = new Map();

  const state = {
    category: "all",
    device: "mobile",
    search: "",
    sort: "",
    filtered: [],
    currentIndex: 0,
    loadCount: 24,
    activeWallpaper: null
  };

  function normalizeCategory(value) {
    const raw = String(value || "").toLowerCase();
    return raw === "superheroes" ? "superhero" : raw;
  }

  function getDeviceFromWallpaper(wallpaper) {
    const tags = (wallpaper.tags || []).map((t) => String(t).toLowerCase());
    return tags.includes("mobile") ? "mobile" : "desktop";
  }

  function toCardCategory(wallpaper) {
    const categories = Array.isArray(wallpaper.category) ? wallpaper.category : [];
    const mapped = categories.map((c) => normalizeCategory(c));
    return mapped[0] || "all";
  }

  function wallpaperMatchesDevice(wallpaper) {
    return getDeviceFromWallpaper(wallpaper) === state.device;
  }

  function wallpaperMatchesCategory(wallpaper) {
    if (state.category === "all") return true;
    const categories = Array.isArray(wallpaper.category) ? wallpaper.category : [];
    return categories.some((c) => normalizeCategory(c) === state.category);
  }

  function wallpaperMatchesSearch(wallpaper) {
    if (!state.search) return true;
    const categories = Array.isArray(wallpaper.category) ? wallpaper.category : [];
    const tags = Array.isArray(wallpaper.tags) ? wallpaper.tags : [];
    const haystack = [...categories, ...tags].map((v) => String(v).toLowerCase());
    return haystack.some((v) => v.includes(state.search));
  }

  function shuffleArray(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function getResolutionText() {
    return state.device === "mobile" ? "1080 x 1920 (Mobile)" : "1920 x 1080 (Laptop)";
  }

  function updateLoadMoreVisibility() {
    loadMoreBtn.style.display = state.currentIndex >= state.filtered.length ? "none" : "block";
  }

  function getGridImageUrl(originalImg) {
    return originalImg.includes("?") ? `${originalImg}&w=400` : `${originalImg}?w=400`;
  }

  function sanitizeSlug(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[%\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function getBaseSlugFromImageUrl(imageUrl) {
    const withoutQuery = String(imageUrl || "").split("?")[0];
    const fileName = withoutQuery.split("/").pop() || "wallpaper";
    const withoutExt = fileName.replace(/\.[a-z0-9]+$/i, "");
    return sanitizeSlug(withoutExt) || "wallpaper";
  }

  function buildWallpaperIdMaps() {
    const buckets = new Map();

    wallpapers.forEach((wallpaper) => {
      if (!wallpaper?.img) return;
      const base = `wp-${getBaseSlugFromImageUrl(wallpaper.img)}`;
      if (!buckets.has(base)) {
        buckets.set(base, []);
      }
      buckets.get(base).push(wallpaper);
    });

    buckets.forEach((items, base) => {
      const sortedItems = [...items].sort((a, b) => String(a.img).localeCompare(String(b.img)));
      sortedItems.forEach((wallpaper, index) => {
        const id = index === 0 ? base : `${base}-${index + 1}`;
        wallpaperIdMap.set(wallpaper.img, id);
        wallpaperByIdMap.set(id, wallpaper);
      });
    });
  }

  function getWallpaperId(wallpaper) {
    return wallpaperIdMap.get(wallpaper?.img) || "";
  }

  function updateHashFromWallpaper(wallpaper) {
    const wallpaperId = getWallpaperId(wallpaper);
    if (!wallpaperId) return;
    if (window.location.hash !== `#${wallpaperId}`) {
      history.replaceState(null, "", `#${wallpaperId}`);
    }
  }

  function ensureCardVisibleById(targetId) {
    if (!targetId) return null;
    let targetCard = container.querySelector(`#${CSS.escape(targetId)}`);
    while (!targetCard && state.currentIndex < state.filtered.length) {
      renderChunk(false);
      targetCard = container.querySelector(`#${CSS.escape(targetId)}`);
    }
    return targetCard;
  }

  function applyDeviceFromWallpaper(wallpaper) {
    const wallpaperDevice = getDeviceFromWallpaper(wallpaper);
    state.device = wallpaperDevice;
    document.body.classList.remove("mobile", "desktop");
    document.body.classList.add(wallpaperDevice);
    deviceToggle.querySelectorAll(".device-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.device === wallpaperDevice);
    });
  }

  function openFromHash() {
    const targetId = window.location.hash.replace(/^#/, "");
    if (!targetId) return;

    const targetWallpaper = wallpaperByIdMap.get(targetId);
    if (!targetWallpaper) return;

    applyDeviceFromWallpaper(targetWallpaper);
    applyFilters();

    const targetCard = ensureCardVisibleById(targetId);
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    openPopup(targetWallpaper);
  }

  function renderChunk(reset = true) {
    if (reset) {
      container.innerHTML = "";
      state.currentIndex = 0;
    }

    const nextItems = state.filtered.slice(state.currentIndex, state.currentIndex + state.loadCount);
    nextItems.forEach((wallpaper) => {
      if (!wallpaper.img) return;
      const originalImg = wallpaper.img;

      const card = document.createElement("div");
      card.className = "wallpaper";
      card.dataset.category = toCardCategory(wallpaper);
      card.dataset.device = getDeviceFromWallpaper(wallpaper);
      card.id = getWallpaperId(wallpaper);

      const img = document.createElement("img");
      img.src = getGridImageUrl(originalImg);
      img.dataset.original = originalImg;
      img.alt = `${card.dataset.category} wallpaper`;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("click", () => openPopup(wallpaper));

      const heart = document.createElement("button");
      heart.className = "heart";
      heart.type = "button";
      heart.textContent = likes[wallpaper.img] ? "❤️" : "♡";
      heart.addEventListener("click", (event) => {
        event.stopPropagation();
        if (likes[wallpaper.img]) {
          delete likes[wallpaper.img];
        } else {
          likes[wallpaper.img] = true;
        }
        localStorage.setItem("likes", JSON.stringify(likes));
        heart.textContent = likes[wallpaper.img] ? "❤️" : "♡";
        if (state.activeWallpaper && state.activeWallpaper.img === wallpaper.img) {
          popupHeart.textContent = heart.textContent;
        }
      });

      card.appendChild(img);
      card.appendChild(heart);
      container.appendChild(card);
    });

    state.currentIndex += state.loadCount;
    updateLoadMoreVisibility();
  }

  function applyFilters() {
    let filtered = wallpapers
      .filter((w) => wallpaperMatchesDevice(w))
      .filter((w) => wallpaperMatchesCategory(w))
      .filter((w) => wallpaperMatchesSearch(w));

    if (state.sort === "new") {
      filtered.sort((a, b) => indexMap.get(b.img) - indexMap.get(a.img));
    } else if (state.sort === "old") {
      filtered.sort((a, b) => indexMap.get(a.img) - indexMap.get(b.img));
    } else {
      filtered = shuffleArray(filtered);
    }

    state.filtered = filtered;
    renderChunk(true);
  }

  function openPopup(wallpaper) {
    const originalImg = wallpaper.img;
    const popupHighQualityImg = originalImg.split("?")[0];
    state.activeWallpaper = wallpaper;
    popup.style.display = "flex";
    document.body.classList.add("popup-open");
    popupImg.style.filter = "blur(10px)";
    popupImg.onload = () => {
      popupImg.style.filter = "blur(0)";
    };
    popupImg.src = popupHighQualityImg + "?w=1200";
    popupHeart.textContent = likes[wallpaper.img] ? "❤️" : "♡";
    popupResolution.textContent = `Resolution: ${getResolutionText()}`;

    const categories = (wallpaper.category || []).map((c) => normalizeCategory(c));
    popupCategory.textContent = `Category: ${categories.join(", ") || "all"}`;
    updateHashFromWallpaper(wallpaper);

    downloadBtn.onclick = async (event) => {
      event.preventDefault();
      if (downloadBtn.dataset.downloading === "true") {
        return;
      }

      const originalLabel = downloadBtn.textContent;
      downloadBtn.dataset.downloading = "true";
      downloadBtn.disabled = true;
      downloadBtn.textContent = "Downloading...";

      const cleanUrl = originalImg.split("?")[0];

      try {
        const response = await fetch(cleanUrl);
        if (!response.ok) {
          throw new Error("Image fetch failed");
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `wallhub-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        alert("Download failed");
      } finally {
        downloadBtn.dataset.downloading = "false";
        downloadBtn.disabled = false;
        downloadBtn.textContent = originalLabel;
      }
    };
  }

  window.closePopup = function closePopup() {
    popup.style.display = "none";
    document.body.classList.remove("popup-open");
    state.activeWallpaper = null;
  };

  popup.addEventListener("click", (event) => {
    if (event.target === popup) {
      window.closePopup();
    }
  });

  popupHeart.addEventListener("click", () => {
    if (!state.activeWallpaper) return;
    const key = state.activeWallpaper.img;
    if (likes[key]) {
      delete likes[key];
    } else {
      likes[key] = true;
    }
    localStorage.setItem("likes", JSON.stringify(likes));
    popupHeart.textContent = likes[key] ? "❤️" : "♡";
    const cardHeart = container.querySelector(`.wallpaper img[data-original="${CSS.escape(key)}"]`)?.nextElementSibling;
    if (cardHeart) {
      cardHeart.textContent = popupHeart.textContent;
    }
  });

  function toggleMenu() {
    sidePanel.classList.toggle("active");
    const isOpen = sidePanel.classList.contains("active");
    menuBtn.classList.toggle("open", isOpen);
    menuBtn.setAttribute("aria-expanded", String(isOpen));
  }

  menuBtn.onclick = toggleMenu;
  menuBtn.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleMenu();
    }
  });

  document.addEventListener("click", (event) => {
    const clickedInsidePanel = sidePanel.contains(event.target);
    const clickedMenuButton = menuBtn.contains(event.target);
    if (!clickedInsidePanel && !clickedMenuButton && sidePanel.classList.contains("active")) {
      sidePanel.classList.remove("active");
      menuBtn.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    }
  });

  categoriesBar.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    state.category = normalizeCategory(button.dataset.category);
    categoriesBar.querySelectorAll("button").forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    applyFilters();
    
  });

  deviceToggle.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-device]");
    if (!button) return;
  
    state.device = button.dataset.device;
  
    deviceToggle.querySelectorAll(".device-btn").forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
  
    // 👇 YE NAYA CODE ADD
    document.body.classList.remove("mobile", "desktop");
    document.body.classList.add(state.device);
  
    applyFilters();
  });

  searchInput.addEventListener("input", () => {
    state.search = searchInput.value.trim().toLowerCase();
    applyFilters();
  });

  sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value;
    applyFilters();
  });

  loadMoreBtn.addEventListener("click", () => renderChunk(false));

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  buildWallpaperIdMaps();
  applyFilters();
  openFromHash();
});


