/* SmartLearning — scroll reveals + small app wiring. No deps. */
(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.body.classList.remove("is-loading");
  document.body.classList.add("is-ready");

  // The hero video is muted ambient brand texture and is requested to always
  // play. Most browsers autoplay muted video, but some (strict mobile policies,
  // automation) hold the first frame. Nudge it on load and once more when it is
  // ready; as a last resort, start it on the first user interaction. On total
  // failure the poster frame stays as a graceful fallback.
  var heroVideo = document.querySelector(".video-hero-media");
  if (heroVideo) {
    var playHero = function () {
      if (!heroVideo.paused) return;
      var p = heroVideo.play();
      if (p && typeof p.catch === "function") { p.catch(function () {}); }
    };
    playHero();
    heroVideo.addEventListener("canplay", playHero, { once: true });
    window.addEventListener("pointerdown", playHero, { once: true, passive: true });
    window.addEventListener("touchstart", playHero, { once: true, passive: true });
  }

  // staggered delays inside [data-stagger] containers
  document.querySelectorAll("[data-stagger]").forEach(function (c) {
    var step = parseInt(c.getAttribute("data-stagger"), 10) || 70;
    Array.prototype.forEach.call(c.querySelectorAll(".reveal"), function (el, i) {
      el.style.transitionDelay = (i * step) + "ms";
    });
  });

  var els = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    els.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  // App/list entrance polish for pages that already render content server-side.
  if (!reduced && "animate" in Element.prototype) {
    var appBar = document.querySelector(".app-bar");
    if (appBar) {
      appBar.animate(
        [
          { transform: "translateY(-10px)", opacity: 0 },
          { transform: "translateY(0)", opacity: 1 }
        ],
        { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both", iterations: 1 }
      );
    }

    document.querySelectorAll(".card, .ac-card, .course-card, .empty-state, .auth-card, .ac-page, .form-narrow, .ac-form-wrap, .subject-card, .subject-note-card, .profile-card, .subject-create-panel, .subject-hero").forEach(function (el, i) {
      el.animate(
        [
          { transform: "translateY(14px) scale(0.985)", opacity: 0 },
          { transform: "translateY(0) scale(1)", opacity: 1 }
        ],
        {
          duration: 460,
          delay: Math.min(i * 45, 360),
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "both",
          iterations: 1
        }
      );
    });

    document.querySelectorAll(".btn, .icon-btn").forEach(function (el) {
      el.addEventListener("pointerdown", function () {
        el.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(0.96)" },
            { transform: "scale(1)" }
          ],
          { duration: 180, easing: "cubic-bezier(0.34, 1.4, 0.64, 1)", fill: "both", iterations: 1 }
        );
      });
    });
  }

  // Interactive enhancements — pointer-driven, skipped under reduced motion / touch
  if (!reduced && window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
    // Cursor spotlight on benefit cards (CSS reads --mx / --my)
    document.querySelectorAll(".benefit").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
      });
    });
  }

  // Scrollytelling: sync the sticky visual with the step crossing viewport center
  (function () {
    var steps = document.querySelectorAll(".scrolly-step");
    var screens = document.querySelectorAll(".scrolly-screen");
    if (!steps.length || !screens.length) return;

    var timerEl = document.querySelector('.scrolly-screen[data-screen="2"] .sc-timer b');
    var countRAF = null;
    function fmt(totalSec) {
      var m = Math.floor(totalSec / 60), s = Math.floor(totalSec % 60);
      return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
    }
    function countTo(target, dur) {
      if (!timerEl) return;
      if (countRAF) { cancelAnimationFrame(countRAF); countRAF = null; }
      if (reduced) { timerEl.textContent = fmt(target); return; }
      var start = null;
      function tick(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        timerEl.textContent = fmt(target * eased);
        countRAF = p < 1 ? requestAnimationFrame(tick) : null;
      }
      countRAF = requestAnimationFrame(tick);
    }

    var current = -1;
    function activate(i) {
      if (i === current) return;            // guard: não re-dispara a cena já ativa
      current = i;
      Array.prototype.forEach.call(steps, function (s, j) { s.classList.toggle("is-active", j === i); });
      Array.prototype.forEach.call(screens, function (s, j) { s.classList.toggle("is-active", j === i); });
      if (i === 2) { countTo(1500, 1200); } // 00:00 -> 25:00 ao entrar
    }

    if (!("IntersectionObserver" in window)) { activate(0); return; }
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          activate(parseInt(e.target.getAttribute("data-step"), 10) || 0);
        }
      });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    Array.prototype.forEach.call(steps, function (s) { sio.observe(s); });
    activate(0);
  })();

  // app-bar: toggle the floating Pomodoro panel
  var toggle = document.querySelector("[data-pomo-toggle]");
  var pomo = document.getElementById("pomodoro");
  if (toggle && pomo) {
    toggle.addEventListener("click", function () {
      pomo.classList.remove("collapsed");
      pomo.classList.toggle("hidden");
    });
  }

  // app-bar shadow once scrolled
  var bar = document.querySelector(".app-bar");
  if (bar) {
    var onScroll = function () { bar.classList.toggle("is-scrolled", window.scrollY > 4); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
})();
