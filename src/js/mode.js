(function () {
  var standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  var localPreview = (location.hostname === "localhost" || location.hostname === "127.0.0.1") && new URLSearchParams(location.search).has("preview");
  document.documentElement.dataset.mode = standalone || localPreview ? "app" : "gate";
})();
