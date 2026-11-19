/**
 * [data-lottie-src] 요소에 Lottie(SVG 렌더러)를 붙인다.
 * - SVG + viewBox: 컨테이너 크기(뷰포트·브라우저 확대/축소)에 맞춰 벡터로 함께 스케일된다.
 * - 모든 에셋 디코드 + 첫 프레임 렌더가 끝나면 data-lottie-ready="true" 와 "lottie:ready" 이벤트로 알린다(main.js 가 히어로를 한 번에 띄우는 데 사용).
 * - 히어로가 화면에 나타난 뒤 재생 시작 · 끝나면 data-lottie-loop-delay(ms, 기본 3000) 만큼 멈췄다가 처음부터 다시 재생.
 * - 화면 밖/탭 비활성 시 일시정지, prefers-reduced-motion 이면 정지 프레임만 표시한다.
 */
(function () {
  "use strict";

  var hosts = document.querySelectorAll("[data-lottie-src]");
  if (!hosts.length || !window.lottie) return;

  var motionQuery = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

  function reduced() {
    return !!(motionQuery && motionQuery.matches);
  }

  /** SVG 안의 <image>(내장 PNG)를 모두 디코드해 첫 페인트에서 비어 보이지 않게 한다 */
  function decodeSvgImages(host) {
    var list = host.querySelectorAll("image");
    return Promise.all(
      Array.prototype.map.call(list, function (node) {
        var href = node.getAttribute("href") || node.getAttribute("xlink:href");
        if (!href) return Promise.resolve();
        var img = new Image();
        img.src = href;
        return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
      })
    );
  }

  Array.prototype.forEach.call(hosts, function (host) {
    var poster = parseInt(host.getAttribute("data-lottie-poster"), 10) || 0;
    var loopDelayAttr = parseInt(host.getAttribute("data-lottie-loop-delay"), 10);
    var loopDelay = isNaN(loopDelayAttr) ? 3000 : loopDelayAttr;
    var hero = host.closest(".case-hero");

    var visible = false;
    var ready = false;
    var finished = false; /* 한 사이클 재생 완료(대기 중) */
    var restartPending = false; /* 대기가 끝났지만 화면 밖/숨김이라 재시작 보류 */
    var timer = null;

    var anim = window.lottie.loadAnimation({
      container: host,
      renderer: "svg",
      loop: false,
      autoplay: false,
      path: host.getAttribute("data-lottie-src"),
      rendererSettings: {
        preserveAspectRatio: "xMidYMid slice",
        className: "lottie-svg",
      },
    });

    /** 히어로가 실제로 표시되기 시작한 뒤에만 재생(보이기 전에 모션이 소모되지 않게) */
    function shown() {
      return !hero || hero.classList.contains("is-visible");
    }

    function canPlay() {
      return ready && visible && shown() && !document.hidden && !reduced();
    }

    function restart() {
      timer = null;
      if (!canPlay()) {
        restartPending = true;
        return;
      }
      restartPending = false;
      finished = false;
      anim.goToAndPlay(0, true);
    }

    function sync() {
      if (!ready) return;
      if (reduced()) {
        clearTimeout(timer);
        timer = null;
        finished = false;
        restartPending = false;
        anim.goToAndStop(poster, true);
        return;
      }
      if (canPlay()) {
        if (restartPending) restart();
        else if (!finished) anim.play();
      } else if (!finished) {
        anim.pause();
      }
    }

    anim.addEventListener("complete", function () {
      finished = true;
      clearTimeout(timer);
      timer = setTimeout(restart, loopDelay);
    });

    anim.addEventListener("DOMLoaded", function () {
      decodeSvgImages(host).then(function () {
        ready = true;
        host.classList.add("is-ready");
        host.setAttribute("data-lottie-ready", "true");
        host.dispatchEvent(new CustomEvent("lottie:ready", { bubbles: true }));
        sync();
      });
    });

    anim.addEventListener("data_failed", function () {
      host.dispatchEvent(new CustomEvent("lottie:error", { bubbles: true }));
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        function (entries) {
          visible = entries[0].isIntersecting;
          sync();
        },
        { threshold: 0.1 }
      ).observe(host);
    } else {
      visible = true;
    }

    if (hero && "MutationObserver" in window) {
      new MutationObserver(sync).observe(hero, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    document.addEventListener("visibilitychange", sync);
    if (motionQuery && motionQuery.addEventListener) {
      motionQuery.addEventListener("change", sync);
    }
  });
})();
