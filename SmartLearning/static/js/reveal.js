/* SmartLearning — scroll reveals + small app wiring. No deps. */
(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.body.classList.remove("is-loading");
  document.body.classList.add("is-ready");

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

  // WAAPI: animated home preview. Native, finite, paused-safe enough for normal site UI.
  var film = document.querySelector("[data-home-film]");
  if (film && !reduced && "animate" in Element.prototype) {
    var note = film.querySelector(".film-note");
    var task = film.querySelector(".film-task");
    var focus = film.querySelector(".film-focus");
    var days = film.querySelectorAll(".film-calendar span");
    var floatTargets = [note, task, focus].filter(Boolean);

    floatTargets.forEach(function (el, i) {
      el.animate(
        [
          { transform: "translate3d(0, 0, 0)" },
          { transform: "translate3d(0, " + (i === 1 ? -10 : 10) + "px, 0)" },
          { transform: "translate3d(0, 0, 0)" }
        ],
        {
          duration: 3600 + (i * 460),
          delay: i * 140,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "both",
          iterations: 3
        }
      );
    });

    Array.prototype.forEach.call(days, function (day, i) {
      day.animate(
        [
          { transform: "scale(0.86)", opacity: 0.58 },
          { transform: "scale(1.08)", opacity: 1 },
          { transform: "scale(1)", opacity: 0.9 }
        ],
        {
          duration: 1200,
          delay: 520 + (i * 95),
          easing: "cubic-bezier(0.34, 1.4, 0.64, 1)",
          fill: "both",
          iterations: 2
        }
      );
    });

    if (focus) {
      focus.animate(
        [
          { boxShadow: "0 20px 42px -26px rgba(19,78,74,0.42)" },
          { boxShadow: "0 22px 52px -18px rgba(234,88,12,0.38)" },
          { boxShadow: "0 20px 42px -26px rgba(19,78,74,0.42)" }
        ],
        { duration: 2600, delay: 420, easing: "ease-in-out", fill: "both", iterations: 3 }
      );
    }
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
    // 3D tilt on the hero preview (follows the cursor, eases back on leave)
    var tiltEl = document.querySelector("[data-home-film]");
    if (tiltEl) {
      var MAX_TILT = 6;
      tiltEl.addEventListener("pointermove", function (e) {
        var r = tiltEl.getBoundingClientRect();
        var rx = ((e.clientY - r.top) / r.height - 0.5) * -MAX_TILT;
        var ry = ((e.clientX - r.left) / r.width - 0.5) * MAX_TILT;
        tiltEl.style.transition = "transform 90ms ease-out";
        tiltEl.style.transform = "perspective(1000px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
      });
      tiltEl.addEventListener("pointerleave", function () {
        tiltEl.style.transition = "transform 440ms cubic-bezier(0.22, 1, 0.36, 1)";
        tiltEl.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
      });
    }

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
