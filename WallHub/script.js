document.addEventListener("DOMContentLoaded", () => {
  try {
  const container = document.getElementById("wallpapers");
  const searchInput = document.getElementById("search");
  const sortSelect = document.getElementById("sortSelect");
  const categoriesBar = document.getElementById("categoriesBar");
  const deviceToggle = document.getElementById("deviceToggle");
  const menuBtn = document.getElementById("menuBtn");
  const sidePanel = document.getElementById("sidePanel");
  const popup = document.getElementById("popup");
  const popupImg = document.getElementById("popupImg");
  const popupHeart = document.getElementById("popupHeart");
  const popupResolution = document.getElementById("popupResolution");
  const popupCategory = document.getElementById("popupCategory");
  const downloadBtn = document.getElementById("downloadBtn");
  const shareBtn = document.getElementById("shareBtn");
  const shareSheet = document.getElementById("shareSheet");
  const categoryIndicatorWidth = 40;
  const mobileIndicatorMedia = window.matchMedia("(max-width: 768px)");
  let categoryScrollIndicator = null;
  let isCategoryIndicatorBound = false;
  let favoriteIds = new Set();
  let toastHideTimer = null;
  let lockedScrollY = 0;

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
    loadCount: 16,
    activeWallpaper: null,
    favoritesOnly: false,
    isLoadingChunk: false
  };

  const infiniteFooter = document.createElement("div");
  infiniteFooter.className = "infinite-scroll-footer";
  infiniteFooter.id = "infiniteScrollFooter";
  const scrollSentinel = document.createElement("div");
  scrollSentinel.className = "scroll-sentinel";
  scrollSentinel.id = "scrollSentinel";
  const infiniteStatus = document.createElement("div");
  infiniteStatus.className = "infinite-status";
  infiniteStatus.id = "infiniteStatus";
  infiniteStatus.setAttribute("aria-live", "polite");
  infiniteFooter.appendChild(scrollSentinel);
  infiniteFooter.appendChild(infiniteStatus);
  if (container && container.parentNode) {
    container.parentNode.insertBefore(infiniteFooter, container.nextSibling);
  }

  let scrollObserver = null;

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

  function lockBackgroundScroll() {
    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function unlockBackgroundScroll() {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    const htmlEl = document.documentElement;
    const previousScrollBehavior = htmlEl.style.scrollBehavior;
    htmlEl.style.scrollBehavior = "auto";
    window.scrollTo(0, lockedScrollY);
    requestAnimationFrame(() => {
      htmlEl.style.scrollBehavior = previousScrollBehavior;
    });
  }

  function updateInfiniteScrollUI() {
    if (!infiniteStatus || !infiniteFooter) return;

    if (state.favoritesOnly && favoriteIds.size === 0) {
      infiniteFooter.style.display = "none";
      return;
    }
    if (state.favoritesOnly && state.filtered.length === 0) {
      infiniteFooter.style.display = "none";
      return;
    }
    infiniteFooter.style.display = "";

    if (state.filtered.length === 0) {
      infiniteStatus.hidden = true;
      infiniteStatus.textContent = "";
      return;
    }

    const hasMore = state.currentIndex < state.filtered.length;

    if (state.isLoadingChunk) {
      infiniteStatus.hidden = false;
      infiniteStatus.textContent = "Loading more…";
      infiniteStatus.classList.add("infinite-status--loading");
      infiniteStatus.classList.remove("infinite-status--end");
      return;
    }

    if (!hasMore) {
      infiniteStatus.hidden = false;
      infiniteStatus.textContent = "No more wallpapers";
      infiniteStatus.classList.remove("infinite-status--loading");
      infiniteStatus.classList.add("infinite-status--end");
      return;
    }

    infiniteStatus.hidden = true;
    infiniteStatus.textContent = "";
    infiniteStatus.classList.remove("infinite-status--loading", "infinite-status--end");
  }

  function loadNextChunk() {
    if (state.isLoadingChunk) return;
    if (state.currentIndex >= state.filtered.length) return;
    state.isLoadingChunk = true;
    updateInfiniteScrollUI();
    requestAnimationFrame(() => {
      renderChunk(false);
    });
  }

  function setupInfiniteScroll() {
    if (!scrollSentinel || scrollObserver) return;
    scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          loadNextChunk();
        });
      },
      { root: null, rootMargin: "0px 0px 280px 0px", threshold: 0 }
    );
    scrollObserver.observe(scrollSentinel);
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

  function initFavoriteIds() {
    const set = new Set();
    const raw = localStorage.getItem("wallhubFavorites");
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((id) => set.add(String(id)));
        }
      } catch (_) {
        /* ignore */
      }
    }
    if (set.size === 0) {
      const legacy = JSON.parse(localStorage.getItem("likes") || "{}");
      Object.keys(legacy).forEach((img) => {
        const id = wallpaperIdMap.get(img);
        if (id) set.add(id);
      });
      if (set.size > 0) {
        localStorage.setItem("wallhubFavorites", JSON.stringify([...set]));
      }
    }
    return set;
  }

  function persistFavoriteIds() {
    localStorage.setItem("wallhubFavorites", JSON.stringify([...favoriteIds]));
  }

  function isFavorite(wallpaper) {
    const id = getWallpaperId(wallpaper);
    return Boolean(id && favoriteIds.has(id));
  }

  function heartLabel(wallpaper) {
    return isFavorite(wallpaper) ? "❤️" : "♡";
  }

  function hideToast() {
    const el = document.getElementById("wallhub-toast");
    if (el) {
      el.classList.remove("wallhub-toast--visible");
    }
  }

  function showToast(message, options = {}) {
    const { clickable = false, onClick = null } = options;
    let el = document.getElementById("wallhub-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "wallhub-toast";
      document.body.appendChild(el);
    }

    el.className = "wallhub-toast";
    if (clickable) {
      el.classList.add("wallhub-toast--clickable");
    }
    el.textContent = message;
    el.setAttribute("role", clickable ? "button" : "status");
    el.tabIndex = clickable ? 0 : -1;

    if (clickable && typeof onClick === "function") {
      el.onclick = () => {
        clearTimeout(toastHideTimer);
        hideToast();
        onClick();
      };
      el.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          clearTimeout(toastHideTimer);
          hideToast();
          onClick();
        }
      };
    } else {
      el.onclick = null;
      el.onkeydown = null;
    }

    el.classList.add("wallhub-toast--visible");
    clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(() => {
      hideToast();
    }, 2800);
  }

  function syncHeartUI(imgUrl) {
    const wallpaper = wallpapers.find((w) => w.img === imgUrl);
    const label = wallpaper && isFavorite(wallpaper) ? "❤️" : "♡";
    const imgEl = container.querySelector(`.wallpaper img[data-original="${CSS.escape(imgUrl)}"]`);
    const cardHeart = imgEl?.nextElementSibling;
    if (cardHeart) {
      cardHeart.textContent = label;
    }
    if (state.activeWallpaper && state.activeWallpaper.img === imgUrl) {
      popupHeart.textContent = label;
    }
  }

  function toggleFavorite(wallpaper) {
    const id = getWallpaperId(wallpaper);
    if (!id) return;
    const wasFavorite = favoriteIds.has(id);
    if (wasFavorite) {
      favoriteIds.delete(id);
      showToast("Removed from Favorites");
    } else {
      favoriteIds.add(id);
      showToast("Added to Favorites — Click to view", {
        clickable: true,
        onClick: () => {
          if (/favorites\.html$/i.test(window.location.pathname)) {
            return;
          }
          window.location.assign("pages/favorites.html");
        }
      });
    }
    persistFavoriteIds();
    syncHeartUI(wallpaper.img);
    if (wasFavorite && state.favoritesOnly) {
      applyFilters();
    }
  }

  function updateHashFromWallpaper(wallpaper) {
    const wallpaperId = getWallpaperId(wallpaper);
    if (!wallpaperId) return;
    if (window.location.hash !== `#${wallpaperId}`) {
      history.replaceState(null, "", `#${wallpaperId}`);
    }
  }

  function clearUrlHash() {
    if (!window.location.hash) return;
    const url = `${window.location.pathname}${window.location.search}`;
    history.replaceState(null, "", url);
  }

  function getSharePageUrl() {
    if (!state.activeWallpaper) {
      return window.location.href;
    }
    const id = getWallpaperId(state.activeWallpaper);
    const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    return id ? `${base}#${id}` : window.location.href;
  }

  function closeShareSheet() {
    if (!shareSheet) return;
    shareSheet.classList.remove("share-sheet--open");
    shareSheet.setAttribute("aria-hidden", "true");
  }

  function openShareSheet() {
    if (!shareSheet) return;
    shareSheet.classList.add("share-sheet--open");
    shareSheet.setAttribute("aria-hidden", "false");
  }

  async function tryNativeShare() {
    if (!navigator.share) return "fallback";
    const url = getSharePageUrl();
    try {
      await navigator.share({
        title: "WallHub",
        text: "Check out this wallpaper on WallHub",
        url
      });
      return "done";
    } catch (err) {
      if (err && err.name === "AbortError") return "done";
      return "fallback";
    }
  }

  async function copyShareUrl() {
    const url = getSharePageUrl();
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast("Link copied");
      } catch {
        showToast("Could not copy");
      }
    }
    closeShareSheet();
  }

  function openSocialShare(kind) {
    const url = getSharePageUrl();
    const text = "Check out this wallpaper on WallHub";
    let targetUrl = "";
    switch (kind) {
      case "whatsapp":
        targetUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
        break;
      case "telegram":
        targetUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        break;
      case "twitter":
        targetUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        break;
      case "facebook":
        targetUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      default:
        return;
    }
    window.open(targetUrl, "_blank", "noopener,noreferrer");
    closeShareSheet();
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

  function updateCategoryScrollIndicator() {
    if (!categoryScrollIndicator || !categoriesBar) return;
    if (!mobileIndicatorMedia.matches) {
      categoryScrollIndicator.style.opacity = "0";
      categoryScrollIndicator.style.transform = "translateX(0)";
      return;
    }

    const maxScroll = categoriesBar.scrollWidth - categoriesBar.clientWidth;
    if (maxScroll <= 0) {
      categoryScrollIndicator.style.opacity = "0";
      categoryScrollIndicator.style.transform = "translateX(0)";
      return;
    }

    const scrollPercent = categoriesBar.scrollLeft / maxScroll;
    const moveX = scrollPercent * Math.max(0, categoriesBar.clientWidth - categoryIndicatorWidth);
    categoryScrollIndicator.style.opacity = "0.7";
    categoryScrollIndicator.style.transform = `translateX(${moveX}px)`;
  }

  function handleCategoryIndicatorViewportChange() {
    if (!categoriesBar) return;
    if (!mobileIndicatorMedia.matches && categoryScrollIndicator) {
      categoryScrollIndicator.style.opacity = "0";
      categoryScrollIndicator.style.transform = "translateX(0)";
    }
    requestAnimationFrame(updateCategoryScrollIndicator);
  }

  function setupCategoryScrollIndicator() {
    if (!categoriesBar) return;
    categoryScrollIndicator = categoriesBar.querySelector(".scroll-indicator");
    if (!categoryScrollIndicator) {
      categoryScrollIndicator = document.createElement("div");
      categoryScrollIndicator.className = "scroll-indicator";
      categoriesBar.appendChild(categoryScrollIndicator);
    }

    if (!isCategoryIndicatorBound) {
      categoriesBar.addEventListener("scroll", updateCategoryScrollIndicator, { passive: true });
      window.addEventListener("resize", handleCategoryIndicatorViewportChange, { passive: true });
      window.addEventListener("orientationchange", handleCategoryIndicatorViewportChange, { passive: true });
      window.addEventListener("load", handleCategoryIndicatorViewportChange, { once: true });

      if (typeof mobileIndicatorMedia.addEventListener === "function") {
        mobileIndicatorMedia.addEventListener("change", handleCategoryIndicatorViewportChange);
      } else if (typeof mobileIndicatorMedia.addListener === "function") {
        mobileIndicatorMedia.addListener(handleCategoryIndicatorViewportChange);
      }

      isCategoryIndicatorBound = true;
    }

    requestAnimationFrame(updateCategoryScrollIndicator);
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
      heart.textContent = heartLabel(wallpaper);
      heart.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleFavorite(wallpaper);
      });

      card.appendChild(img);
      card.appendChild(heart);
      container.appendChild(card);
    });

    state.currentIndex += nextItems.length;
    state.isLoadingChunk = false;
    updateInfiniteScrollUI();
  }

  function applyFilters() {
    let filtered = wallpapers;
    if (state.favoritesOnly) {
      filtered = filtered.filter((w) => {
        const id = getWallpaperId(w);
        return id && favoriteIds.has(id);
      });
    }
    filtered = filtered
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
    updateFavoritesEmptyState();
  }

  function updateFavoritesEmptyState() {
    const emptyEl = document.getElementById("favoritesEmptyState");
    if (!emptyEl || !state.favoritesOnly) {
      if (emptyEl) {
        emptyEl.hidden = true;
      }
      container.style.display = "";
      if (infiniteFooter) infiniteFooter.style.display = "";
      updateInfiniteScrollUI();
      return;
    }

    const titleEl = emptyEl.querySelector(".favorites-empty-title");
    const subEl = emptyEl.querySelector(".favorites-empty-sub");
    const linkEl = emptyEl.querySelector(".favorites-empty-link");

    if (favoriteIds.size === 0) {
      emptyEl.hidden = false;
      if (titleEl) titleEl.textContent = "No favorites yet";
      if (subEl) subEl.textContent = "Start liking wallpapers ❤️";
      if (linkEl) linkEl.hidden = false;
      container.style.display = "none";
      if (infiniteFooter) infiniteFooter.style.display = "none";
      return;
    }

    if (state.filtered.length === 0) {
      emptyEl.hidden = false;
      if (titleEl) titleEl.textContent = "No matches";
      if (subEl) subEl.textContent = "Try another category or search";
      if (linkEl) linkEl.hidden = true;
      container.style.display = "none";
      if (infiniteFooter) infiniteFooter.style.display = "none";
      return;
    }

    emptyEl.hidden = true;
    container.style.display = "";
    if (infiniteFooter) infiniteFooter.style.display = "";
    updateInfiniteScrollUI();
  }

  function openPopup(wallpaper) {
    const originalImg = wallpaper.img;
    const popupHighQualityImg = originalImg.split("?")[0];
    state.activeWallpaper = wallpaper;
    popup.style.display = "flex";
    document.body.classList.add("popup-open");
    lockBackgroundScroll();
    popupImg.style.filter = "blur(10px)";
    popupImg.onload = () => {
      popupImg.style.filter = "blur(0)";
    };
    popupImg.src = popupHighQualityImg + "?w=1200";
    popupHeart.textContent = heartLabel(wallpaper);
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
    closeShareSheet();
    clearUrlHash();
    popup.style.display = "none";
    document.body.classList.remove("popup-open");
    unlockBackgroundScroll();
    state.activeWallpaper = null;
  };

  popup.addEventListener("click", (event) => {
    if (shareSheet && shareSheet.classList.contains("share-sheet--open")) {
      return;
    }
    if (event.target === popup) {
      window.closePopup();
    }
  });

  shareBtn?.addEventListener("click", async (event) => {
    event.stopPropagation();
    const result = await tryNativeShare();
    if (result === "fallback") {
      openShareSheet();
    }
  });

  shareSheet?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.target.closest("[data-share-close]")) {
      closeShareSheet();
      return;
    }
    const opt = event.target.closest("[data-share]");
    if (!opt) return;
    const kind = opt.dataset.share;
    if (kind === "copy") {
      copyShareUrl();
      return;
    }
    openSocialShare(kind);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (shareSheet?.classList.contains("share-sheet--open")) {
      closeShareSheet();
    }
  });

  popupHeart.addEventListener("click", () => {
    if (!state.activeWallpaper) return;
    toggleFavorite(state.activeWallpaper);
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

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  buildWallpaperIdMaps();
  favoriteIds = initFavoriteIds();
  state.favoritesOnly = document.body.classList.contains("favorites-page");

  setupCategoryScrollIndicator();
  setupInfiniteScroll();
  applyFilters();
  openFromHash();
  } finally {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.remove("loading");
      });
    });
  }
});


