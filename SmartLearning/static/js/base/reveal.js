/* SmartLearning — reveals por scroll + ajustes da interface. Sem dependências. */
(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.body.classList.remove("is-loading");
  document.body.classList.add("is-ready");

  const heroVideo = document.querySelector(".video-hero-media");
  if (heroVideo) {
    const playHero = () => {
      if (!heroVideo.paused) return;
      const p = heroVideo.play();
      if (p?.catch) p.catch(() => {});
    };
    playHero();
    heroVideo.addEventListener("canplay", playHero, { once: true });
    window.addEventListener("pointerdown", playHero, { once: true, passive: true });
    window.addEventListener("touchstart", playHero, { once: true, passive: true });
  }

  document.querySelectorAll("[data-stagger]").forEach((c) => {
    const step = parseInt(c.getAttribute("data-stagger"), 10) || 70;
    c.querySelectorAll(".reveal").forEach((el, i) => {
      el.style.transitionDelay = `${i * step}ms`;
    });
  });

  const els = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
  }

  if (!reduced && "animate" in Element.prototype) {
    const appBar = document.querySelector(".app-bar");
    if (appBar) {
      appBar.animate(
        [
          { transform: "translateY(-10px)", opacity: 0 },
          { transform: "translateY(0)", opacity: 1 }
        ],
        { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both", iterations: 1 }
      );
    }

    document.querySelectorAll(".card, .ac-card, .course-card, .empty-state, .auth-card, .ac-page, .form-narrow, .ac-form-wrap, .subject-card, .subject-note-card, .profile-card, .subject-create-panel, .subject-hero").forEach((el, i) => {
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

    document.querySelectorAll(".btn, .icon-btn").forEach((el) => {
      el.addEventListener("pointerdown", () => {
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

  if (!reduced && window.matchMedia?.("(pointer: fine)").matches) {
    document.querySelectorAll(".benefit").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
        card.style.setProperty("--my", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      });
    });
  }

  (() => {
    const steps = document.querySelectorAll(".scrolly-step");
    const screens = document.querySelectorAll(".scrolly-screen");
    if (!steps.length || !screens.length) return;

    const timerEl = document.querySelector('.scrolly-screen[data-screen="2"] .sc-timer b');
    let countRAF = null;

    const fmt = (totalSec) => {
      const m = Math.floor(totalSec / 60);
      const s = Math.floor(totalSec % 60);
      return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
    };

    const countTo = (target, dur) => {
      if (!timerEl) return;
      if (countRAF) {
        cancelAnimationFrame(countRAF);
        countRAF = null;
      }
      if (reduced) {
        timerEl.textContent = fmt(target);
        return;
      }
      let start = null;
      const tick = (ts) => {
        if (start === null) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        timerEl.textContent = fmt(target * eased);
        countRAF = p < 1 ? requestAnimationFrame(tick) : null;
      };
      countRAF = requestAnimationFrame(tick);
    };

    let current = -1;
    const activate = (i) => {
      if (i === current) return;
      current = i;
      steps.forEach((s, j) => s.classList.toggle("is-active", j === i));
      screens.forEach((s, j) => s.classList.toggle("is-active", j === i));
      if (i === 2) countTo(1500, 1200);
    };

    if (!("IntersectionObserver" in window)) {
      activate(0);
      return;
    }

    const sio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          activate(parseInt(e.target.getAttribute("data-step"), 10) || 0);
        }
      });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    
    steps.forEach((s) => sio.observe(s));
    activate(0);
  })();

  const toggle = document.querySelector("[data-pomo-toggle]");
  const pomo = document.getElementById("pomodoro");
  if (toggle && pomo) {
    toggle.addEventListener("click", () => {
      pomo.classList.remove("collapsed");
      pomo.classList.toggle("hidden");
    });
  }

  const bar = document.querySelector(".app-bar");
  if (bar) {
    const onScroll = () => bar.classList.toggle("is-scrolled", window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
})();
