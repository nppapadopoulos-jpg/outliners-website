/* OutLiners — site behaviour (no dependencies, no trackers) */
(function () {
  "use strict";

  var html = document.documentElement;
  var KEY = "outliners-lang";

  /* ---------- Language toggle (EN default, EL stored locally) ---------- */
  function currentLang() {
    return html.classList.contains("el") ? "el" : "en";
  }

  function applyLang(lang) {
    var greek = lang === "el";
    html.classList.toggle("el", greek);
    html.setAttribute("lang", greek ? "el" : "en");

    // Swap the document title if the page declares both variants.
    var body = document.body;
    if (body) {
      var t = greek ? body.getAttribute("data-title-el") : body.getAttribute("data-title-en");
      if (t) document.title = t;
    }

    document.querySelectorAll(".lang-toggle").forEach(function (btn) {
      btn.textContent = greek ? "EN" : "ΕΛ";
      btn.setAttribute(
        "aria-label",
        greek ? "Switch to English" : "Αλλαγή γλώσσας στα Ελληνικά"
      );
    });

    try {
      localStorage.setItem(KEY, greek ? "el" : "en");
    } catch (e) {
      /* storage unavailable — preference simply won't persist */
    }
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".lang-toggle");
    if (!btn) return;
    applyLang(currentLang() === "el" ? "en" : "el");
  });

  // The head snippet may have set html.el before paint; sync UI labels now.
  applyLang(currentLang());

  /* ---------- Mobile navigation ---------- */
  var toggle = document.querySelector(".menu-toggle");
  var links = document.getElementById("nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && links.classList.contains("open")) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* ---------- Current year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Reveal on scroll (skipped for reduced motion) ---------- */
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var items = document.querySelectorAll(".reveal");
  if (!reduced && "IntersectionObserver" in window && items.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("is-visible"); });
  }
})();
