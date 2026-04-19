// WAIT FOR PAGE LOAD
document.addEventListener("DOMContentLoaded", function () {
  let currentIndex = 0;
  let loadCount = 32;
  let currentData = [];
  let menuBtn = document.getElementById("menuBtn");
  let sidePanel = document.getElementById("sidePanel");
  let currentCategory = "all";
  let liked = JSON.parse(localStorage.getItem("likes")) || {};

 menuBtn.onclick = () => {
  sidePanel.classList.toggle("active");
  document.querySelector(".categories button").classList.add("active");
  // ICON SWITCH
  if (sidePanel.classList.contains("active")) {
    menuBtn.innerText = "✖"; // open → show cross
  } else {
    menuBtn.innerText = "☰"; // close → show menu
  }
};


  let container = document.getElementById("wallpapers");
  let searchInput = document.getElementById("search");
  let deviceSelect = document.getElementById("deviceSelect");
  let sortSelect = document.getElementById("sortSelect");
  let popup = document.getElementById("popup");
  let popupImg = document.getElementById("popupImg");
  let downloadBtn = document.getElementById("downloadBtn");
  let popupHeart = document.getElementById("popupHeart");
  let currentImg = null;
  deviceSelect.addEventListener("change", function () {
  if (this.value === "pc") {
    document.body.classList.add("pc-mode");
  } else {
    document.body.classList.remove("pc-mode");
  }
 });
 
  // ===== SHOW =====
   function showWallpapers(data, reset = true) {

  if (reset) {
    container.innerHTML = "";
    currentIndex = 0;
    currentData = data;
  }

  let nextItems = currentData.slice(currentIndex, currentIndex + loadCount);

  nextItems.forEach(w => {

  if (!w.img) return;

  let wrapper = document.createElement("div");
  wrapper.style.position = "relative";

  let img = document.createElement("img");
  img.src = w.img;
  img.loading = "lazy";

  img.onclick = () => openPopup(w.img);

  let heart = document.createElement("span");
  heart.innerText = liked[w.img] ? "❤️" : "♡";

  heart.style.position = "absolute";
  heart.style.top = "8px";
  heart.style.right = "8px";
  heart.style.fontSize = "18px";
  heart.style.cursor = "pointer";
  heart.style.color = liked[w.img] ? "red" : "white";

  heart.onclick = function (e) {
  e.stopPropagation();

  if (liked[w.img]) {
    delete liked[w.img];
  } else {
    liked[w.img] = true;
  }

  localStorage.setItem("likes", JSON.stringify(liked));

  // refresh UI
  heart.innerText = liked[w.img] ? "❤️" : "♡";
  heart.style.color = liked[w.img] ? "red" : "white";
};

  wrapper.appendChild(img);
  wrapper.appendChild(heart);

  container.appendChild(wrapper);

});
  currentIndex += loadCount;

  if (currentIndex >= currentData.length) {
    document.getElementById("loadMoreBtn").innerText = "No More Wallpapers";
  } else {
    document.getElementById("loadMoreBtn").style.display = "block";
  }
}

  // ===== GET DATA =====
  function getData() {
  return wallpapers.filter(w => {
    let tags = w.tags.map(tag => tag.toLowerCase());

    return deviceSelect.value === "mobile"
      ? tags.includes("mobile")
      : tags.includes("pc");
  });
}

// ===== FILTER =====
function applyFilters() {
  let value = searchInput.value.toLowerCase();
  let sort = sortSelect.value;

  let data = getData();

  let filtered = data.filter(w => {
    let matchCategory =
      currentCategory === "all" || w.category === currentCategory;

    let matchSearch =
      value === "" ||
      w.category.includes(value) ||
      w.tags.some(tag => tag.includes(value));

    return matchCategory && matchSearch;
  });

  if (sort === "new") {
    filtered = [...filtered].reverse();
  }

  showWallpapers(filtered, true);
}

// ===== CATEGORY =====
window.filterCategory = function(cat, event) {
  document.querySelectorAll(".categories button").forEach(btn => {
    btn.classList.remove("active");
  });

  event.target.classList.add("active");

  currentCategory = cat;

  applyFilters();
};

// ===== EVENTS =====
searchInput.addEventListener("input", applyFilters);
sortSelect.addEventListener("change", applyFilters);
deviceSelect.addEventListener("change", applyFilters);

document.getElementById("loadMoreBtn").addEventListener("click", function () {
  showWallpapers(currentData, false);
});

  // POPUP
 function openPopup(img) {
  popup.style.display = "flex";

  currentImg = img;

  let base = img.split("?")[0];
  let fastImg = base + "?w=1200&q=80";
  let fullImg = base;

  popupImg.src = fastImg;

  // ❤️ state set
  if (liked[currentImg]) {
    popupHeart.classList.add("active");
    popupHeart.innerText = "❤️";
  } else {
    popupHeart.classList.remove("active");
    popupHeart.innerText = "♡";
  }

  // download
  downloadBtn.onclick = function (e) {
    e.preventDefault();

    fetch(fullImg)
      .then(res => res.blob())
      .then(blob => {
        let url = window.URL.createObjectURL(blob);

        let a = document.createElement("a");
        a.href = url;
        a.download = "wallpaper.jpg";
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
  };
} 

   popupHeart.onclick = function () {

  if (!currentImg) return;

  if (liked[currentImg]) {
    delete liked[currentImg];
  } else {
    liked[currentImg] = true;
  }

  localStorage.setItem("likes", JSON.stringify(liked));

  popupHeart.innerText = liked[currentImg] ? "❤️" : "♡";
};

// CLOSE POPUP (bahar hona chahiye)
window.closePopup = function () {
  popup.style.display = "none";
};

// INIT (sabse last me)
showWallpapers(getData(), true);
 document.querySelector(".categories button").classList.add("active");
applyFilters();
 }); // DOMContentLoaded close

 function adjustGridTop() {
  const header = document.querySelector(".header");
  const grid = document.querySelector(".grid");

  if (!header || !grid) return;

  if (window.innerWidth <= 768) {
    const height = header.offsetHeight;
    grid.style.marginTop = height + "px";
  } else {
    grid.style.marginTop = "140px"; // 👈 desktop value
  }
}

// run on load
window.addEventListener("load", adjustGridTop);

// run on resize
window.addEventListener("resize", adjustGridTop);

window.addEventListener("load", function () {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// browser auto scroll restore OFF
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function cleanMobileSelect() {
  if (window.innerWidth <= 768) {

    const sort = document.getElementById("sortSelect");
    const device = document.getElementById("deviceSelect");

    if (sort) {
      sort.options[0].text = "New";
      sort.options[1].text = "Old";
    }

    if (device) {
      device.options[0].text = "Mobile";
      device.options[1].text = "Laptop";
    }

  }
}

window.addEventListener("load", cleanMobileSelect);


