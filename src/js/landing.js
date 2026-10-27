const nodes = [...document.querySelectorAll(".reveal")];

if (!nodes.length) {
  /* nothing to animate */
} else if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  nodes.forEach((node) => node.classList.add("is-in"));
} else if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-in");
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
  nodes.forEach((node) => observer.observe(node));
} else {
  nodes.forEach((node) => node.classList.add("is-in"));
}

requestAnimationFrame(() => {
  document.querySelectorAll(".hero .reveal").forEach((node) => node.classList.add("is-in"));
});
