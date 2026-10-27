import { t } from "./i18n.js";

const SLIDE_COUNT = 4;
const INTERVAL_MS = 4200;

export function initDemo() {
  const screen = document.querySelector("#demo-screen");
  const steps = document.querySelector("#demo-steps");
  const dots = document.querySelector("#demo-dots");
  const caption = document.querySelector("#demo-caption");
  const prev = document.querySelector("#demo-prev");
  const next = document.querySelector("#demo-next");
  const playBtn = document.querySelector("#demo-play");
  if (!screen || !steps || !dots) return;

  let index = 0;
  let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timer = 0;

  for (let i = 0; i < SLIDE_COUNT; i += 1) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = `demo-dot${i === 0 ? " is-active" : ""}`;
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-label", `Slide ${i + 1}`);
    dot.addEventListener("click", () => go(i, true));
    dots.append(dot);
  }

  function captionKey(i) {
    return `demoStep${i + 1}Body`;
  }

  function refreshCopy() {
    if (caption) caption.textContent = t(captionKey(index));
    if (playBtn) playBtn.textContent = playing ? t("demoPause") : t("demoPlay");
  }

  function go(nextIndex, user = false) {
    index = (nextIndex + SLIDE_COUNT) % SLIDE_COUNT;
    screen.querySelectorAll(".demo-slide").forEach((slide) => {
      slide.classList.toggle("is-active", Number(slide.dataset.slide) === index);
    });
    steps.querySelectorAll("li").forEach((item) => {
      item.classList.toggle("is-active", Number(item.dataset.step) === index);
    });
    dots.querySelectorAll(".demo-dot").forEach((dot, i) => {
      dot.classList.toggle("is-active", i === index);
    });
    refreshCopy();
    // Re-trigger CSS animations on the active slide
    const active = screen.querySelector(".demo-slide.is-active");
    if (active) {
      active.classList.remove("run");
      void active.offsetWidth;
      active.classList.add("run");
    }
    if (user) restart();
  }

  function tick() {
    go(index + 1);
  }

  function restart() {
    window.clearInterval(timer);
    if (playing) timer = window.setInterval(tick, INTERVAL_MS);
  }

  function setPlaying(on) {
    playing = on;
    refreshCopy();
    if (playBtn) playBtn.setAttribute("aria-pressed", on ? "true" : "false");
    restart();
  }

  steps.querySelectorAll("li").forEach((item) => {
    item.addEventListener("click", () => go(Number(item.dataset.step), true));
  });
  prev?.addEventListener("click", () => go(index - 1, true));
  next?.addEventListener("click", () => go(index + 1, true));
  playBtn?.addEventListener("click", () => setPlaying(!playing));

  document.addEventListener("nako-lang", refreshCopy);

  const stage = document.querySelector(".demo-stage");
  if (stage && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setPlaying(playing || !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        else window.clearInterval(timer);
      }
    }, { threshold: 0.35 });
    io.observe(stage);
  }

  go(0);
  restart();
  refreshCopy();
}
