function applyMobileMode() {
  if (window.innerWidth <= 768) {
    document.body.classList.add("is-mobile");
  } else {
    document.body.classList.remove("is-mobile");
  }
}

window.addEventListener("load", applyMobileMode);
window.addEventListener("resize", applyMobileMode);
