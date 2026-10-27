import { initDemo } from "./demo.js";
import { applyLandingI18n, initLang, t, toggleLang } from "./i18n.js";

initLang();
applyLandingI18n();
initDemo();

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

const nodes = [...document.querySelectorAll(".reveal")];

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
