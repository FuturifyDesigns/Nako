import { applyLandingI18n, t } from "./i18n.js";

const SLIDE_COUNT = 4;
const INTERVAL_MS = 3600;

export function initDemo() {
  const root = document.querySelector("#tour");
  const screen = document.querySelector("#demo-screen");
  const steps = document.querySelector("#demo-steps");
  const dots = document.querySelector("#demo-dots");
  const caption = document.querySelector("#demo-caption");
  const prev = document.querySelector("#demo-prev");
  const next = document.querySelector("#demo-next");
  if (!screen || !steps || !dots) return;

  applyLandingI18n(root || document);

  let index = 0;
  let timer = 0;
  let inView = true;

  dots.replaceChildren();
  for (let i = 0; i < SLIDE_COUNT; i += 1) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = `demo-dot${i === 0 ? " is-active" : ""}`;
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-label", `Slide ${i + 1}`);
    dot.addEventListener("click", () => {
      go(i);
      start();
    });
    dots.append(dot);
  }

  function captionKey(i) {
    return `demoStep${i + 1}Body`;
  }

  function refreshCopy() {
    applyLandingI18n(root || document);
    applyLandingI18n(document.querySelector("#process") || document);
    if (caption) caption.textContent = t(captionKey(index));
  }

  function go(nextIndex) {
    index = ((nextIndex % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT;
    screen.querySelectorAll(".demo-slide").forEach((slide) => {
      slide.classList.toggle("is-active", Number(slide.dataset.slide) === index);
    });
    steps.querySelectorAll("li").forEach((item) => {
      item.classList.toggle("is-active", Number(item.dataset.step) === index);
    });
    dots.querySelectorAll(".demo-dot").forEach((dot, i) => {
      dot.classList.toggle("is-active", i === index);
    });
    if (caption) caption.textContent = t(captionKey(index));
    const active = screen.querySelector(".demo-slide.is-active");
    if (active) {
      active.classList.remove("run");
      void active.offsetWidth;
      active.classList.add("run");
    }
  }

  function stop() {
    window.clearInterval(timer);
    timer = 0;
  }

  function start() {
    stop();
    if (!inView) return;
    timer = window.setInterval(() => go(index + 1), INTERVAL_MS);
  }

  steps.querySelectorAll("li").forEach((item) => {
    item.addEventListener("click", () => {
      go(Number(item.dataset.step));
      start();
    });
  });
  prev?.addEventListener("click", () => {
    go(index - 1);
    start();
  });
  next?.addEventListener("click", () => {
    go(index + 1);
    start();
  });

  const stage = document.querySelector(".demo-stage") || root;
  if (stage && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        inView = entry.isIntersecting;
        if (inView) start();
        else stop();
      }
    }, { threshold: 0.15 });
    io.observe(stage);
  }

  document.addEventListener("nako-lang", () => {
    refreshCopy();
    go(index);
  });

  initProcessReel();

  refreshCopy();
  go(0);
  start();
}

function initProcessReel() {
  const reel = document.querySelector("#process-reel");
  if (!reel) return;
  const cards = [...reel.querySelectorAll(".process-card")];
  if (!cards.length) return;

  let i = 0;
  let timer = 0;
  let inView = true;

  const activate = (forceIndex) => {
    if (typeof forceIndex === "number") i = forceIndex;
    cards.forEach((card, idx) => {
      const on = idx === i;
      card.classList.toggle("is-active", on);
      if (on) {
        card.classList.remove("run");
        void card.offsetWidth;
        card.classList.add("run");
      }
    });
    i = (i + 1) % cards.length;
  };

  const start = () => {
    window.clearInterval(timer);
    if (!inView) return;
    timer = window.setInterval(() => activate(), 3400);
  };

  cards.forEach((card, idx) => {
    card.addEventListener("click", () => {
      activate(idx);
      start();
    });
  });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        inView = entry.isIntersecting;
        reel.classList.toggle("is-inview", inView);
        if (inView) start();
        else window.clearInterval(timer);
      }
    }, { threshold: 0.2 });
    io.observe(reel);
  }

  activate(0);
  start();
}
