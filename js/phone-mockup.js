/**
 * <phone-mockup> — 폰 베젤 목업 마크업 생성 후 figure로 치환
 * 구조는 components/phone-mockup.html 참고
 */
(function () {
  "use strict";

  function buildFigure(host) {
    var scrollSrc = host.getAttribute("scroll-src") || "";
    var scrollAlt = host.getAttribute("scroll-alt") || "";
    var scrollW = host.getAttribute("scroll-width") || "375";
    var scrollH = host.getAttribute("scroll-height") || "812";
    var loading = host.getAttribute("loading") || "lazy";
    var chromeSrc = host.getAttribute("chrome-src");
    var chromeW = host.getAttribute("chrome-width") || "375";
    var chromeH = host.getAttribute("chrome-height") || "812";
    var figExtra = host.getAttribute("figure-class") || "";
    var ariaLabel = host.getAttribute("aria-label");

    var fig = document.createElement("figure");
    fig.className = "phone-mockup" + (figExtra ? " " + figExtra.trim() : "");
    if (ariaLabel) fig.setAttribute("aria-label", ariaLabel);

    var bezel = document.createElement("div");
    bezel.className = "phone-mockup__bezel";
    var screen = document.createElement("div");
    screen.className = "phone-mockup__screen";
    var body = document.createElement("div");
    body.className = "phone-mockup__body";

    var scrollImg = document.createElement("img");
    scrollImg.className = "phone-mockup__scroll";
    scrollImg.src = scrollSrc;
    scrollImg.width = parseInt(scrollW, 10) || 375;
    scrollImg.height = parseInt(scrollH, 10) || 812;
    scrollImg.alt = scrollAlt;
    scrollImg.decoding = "async";
    scrollImg.loading = loading === "eager" ? "eager" : "lazy";

    body.appendChild(scrollImg);

    if (chromeSrc) {
      var chromeImg = document.createElement("img");
      chromeImg.className = "phone-mockup__chrome";
      chromeImg.src = chromeSrc;
      chromeImg.width = parseInt(chromeW, 10) || 375;
      chromeImg.height = parseInt(chromeH, 10) || 812;
      chromeImg.alt = "";
      chromeImg.decoding = "async";
      chromeImg.loading = loading === "eager" ? "eager" : "lazy";
      chromeImg.setAttribute("aria-hidden", "true");
      body.appendChild(chromeImg);
    }

    screen.appendChild(body);
    bezel.appendChild(screen);
    fig.appendChild(bezel);
    return fig;
  }

  class PhoneMockup extends HTMLElement {
    connectedCallback() {
      if (this.hasAttribute("data-phone-mockup-hydrated")) return;
      this.setAttribute("data-phone-mockup-hydrated", "");
      var fig = buildFigure(this);
      this.replaceWith(fig);
    }
  }

  customElements.define("phone-mockup", PhoneMockup);
})();
