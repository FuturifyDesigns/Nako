import { initDemo } from "./demo.js";
import { applyLandingI18n, initLang, t, toggleLang } from "./i18n.js";

initLang();
applyLandingI18n();
initDemo();
initRoadTree();

const langBtn = document.querySelector("#lang-toggle");
if (langBtn) {
  langBtn.textContent = t("otherLang");
  langBtn.addEventListener("click", () => {
    toggleLang();
    applyLandingI18n();
    langBtn.textContent = t("otherLang");
    document.dispatchEvent(new CustomEvent("nako-lang"));
  });
}

const nodes = [...document.querySelectorAll(".reveal")].filter(
  (node) => !node.closest(".road-node")
);

if (!nodes.length) {
  /* nothing to animate */
} else if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  nodes.forEach((node) => {
    node.style.opacity = "1";
    node.style.transform = "none";
  });
} else if (window.gsap && window.ScrollTrigger) {
  window.gsap.registerPlugin(window.ScrollTrigger);
  window.gsap.set(nodes, { opacity: 0, y: 28 });

  const heroNodes = nodes.filter((node) => node.closest(".hero"));
  const rest = nodes.filter((node) => !node.closest(".hero"));

  if (heroNodes.length) {
    window.gsap.to(heroNodes, {
      opacity: 1,
      y: 0,
      duration: 0.85,
      ease: "power2.out",
      stagger: 0.12,
      delay: 0.08
    });
  }

  rest.forEach((node) => {
    window.gsap.to(node, {
      opacity: 1,
      y: 0,
      duration: 0.75,
      ease: "power2.out",
      scrollTrigger: {
        trigger: node,
        start: "top 86%",
        toggleActions: "play none none none"
      }
    });
  });
} else if ("IntersectionObserver" in window) {
  nodes.forEach((node) => {
    node.style.opacity = "0";
    node.style.transform = "translateY(22px)";
    node.style.transition = "opacity 700ms ease, transform 700ms ease";
  });
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.style.opacity = "1";
      entry.target.style.transform = "none";
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
  nodes.forEach((node) => observer.observe(node));
  requestAnimationFrame(() => {
    document.querySelectorAll(".hero .reveal").forEach((node) => {
      node.style.opacity = "1";
      node.style.transform = "none";
    });
  });
}

function initRoadTree() {
  const tree = document.querySelector("#road-tree");
  const trunkFill = document.querySelector("#road-trunk-fill");
  const items = [...document.querySelectorAll(".road-node")];
  if (!tree || !items.length) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    items.forEach((item) => item.classList.add("is-on"));
    if (trunkFill) trunkFill.style.height = "100%";
    return;
  }

  items.forEach((item) => {
    item.style.transition =
      "opacity 520ms ease, transform 620ms cubic-bezier(.2,.8,.2,1)";
  });
  document.querySelectorAll(".road-branch").forEach((branch) => {
    branch.style.transition = "transform 480ms ease";
  });

  if (window.gsap && window.ScrollTrigger) {
    window.gsap.registerPlugin(window.ScrollTrigger);
    if (trunkFill) window.gsap.set(trunkFill, { height: "0%" });

    const tl = window.gsap.timeline({
      scrollTrigger: {
        trigger: tree,
        start: "top 72%",
        end: "bottom 28%",
        scrub: 0.65
      }
    });

    if (trunkFill) {
      tl.to(trunkFill, { height: "100%", ease: "none", duration: items.length }, 0);
    }

    items.forEach((item, i) => {
      const fromX = item.classList.contains("side-right") ? 56 : -56;
      window.gsap.set(item, { opacity: 0, x: fromX });
      tl.to(
        item,
        {
          opacity: 1,
          x: 0,
          duration: 1,
          ease: "power2.out",
          onUpdate() {
            item.classList.toggle("is-on", this.progress() > 0.35);
          }
        },
        i * 0.9
      );
    });
    return;
  }

  // Fallback: progressive left→right reveal while scrolling the tree
  const sync = () => {
    const rect = tree.getBoundingClientRect();
    const view = window.innerHeight || 1;
    const start = view * 0.78;
    const end = view * 0.22;
    const raw = (start - rect.top) / (start - end + rect.height);
    const progress = Math.max(0, Math.min(1, raw));
    if (trunkFill) trunkFill.style.height = `${progress * 100}%`;
    const count = items.length;
    items.forEach((item, i) => {
      const threshold = (i + 0.15) / count;
      item.classList.toggle("is-on", progress >= threshold);
    });
  };
  sync();
  window.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);
}
