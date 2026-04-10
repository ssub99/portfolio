(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var typeText = document.querySelector(".hero-type__text");
  if (typeText) {
    var full = "빌드업과 디테일에 강한";
    if (reduceMotion) {
      typeText.textContent = full;
    } else {
      var i = 0;
      var deleting = false;
      var typeMs = 90;
      var deleteMs = 55;
      var pauseTyped = 2200;
      var pauseEmpty = 450;
      var t = null;

      function schedule(fn, ms) {
        if (t) clearTimeout(t);
        t = setTimeout(fn, ms);
      }

      function step() {
        if (!deleting) {
          if (i < full.length) {
            i += 1;
            typeText.textContent = full.slice(0, i);
            schedule(step, typeMs);
          } else {
            schedule(function () {
              deleting = true;
              step();
            }, pauseTyped);
          }
        } else if (i > 0) {
          i -= 1;
          typeText.textContent = full.slice(0, i);
          schedule(step, deleteMs);
        } else {
          deleting = false;
          schedule(step, pauseEmpty);
        }
      }

      step();
    }
  }

  if (!reduceMotion) {
    var nodes = document.querySelectorAll("[data-reveal]");
    if (nodes.length && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          });
        },
        { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      );
      nodes.forEach(function (el) {
        io.observe(el);
      });
    } else {
      nodes.forEach(function (el) {
        el.classList.add("is-visible");
      });
    }
  } else {
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }
})();

(function () {
  var header = document.querySelector(".site-header");
  if (!header) return;

  var threshold = 32;
  var ticking = false;

  function syncCompact() {
    ticking = false;
    var y = window.scrollY || document.documentElement.scrollTop;
    header.classList.toggle("site-header--compact", y > threshold);
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(syncCompact);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  syncCompact();
})();

/** 프로젝트 카드 스택: 마지막 카드만 sticky가 문서 끝에서 풀리는 브라우저 동작 보완(스크립트는 패딩 픽셀만 산출) */
(function () {
  var list = document.querySelector(".project-page .project-list");
  if (!list) return;

  var mqWide = window.matchMedia("(min-width: 961px)");
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  function mqOn(mq, fn) {
    if (mq.addEventListener) mq.addEventListener("change", fn);
    else mq.addListener(fn);
  }

  function syncProjectStackTailPad() {
    if (!mqWide.matches || mqReduce.matches) {
      list.style.removeProperty("--project-stack-tail-pad");
      return;
    }

    var cards = list.querySelectorAll(".project-card");
    if (cards.length < 2) {
      list.style.removeProperty("--project-stack-tail-pad");
      return;
    }

    var first = cards[0];
    if (getComputedStyle(first).position !== "sticky") {
      list.style.removeProperty("--project-stack-tail-pad");
      return;
    }

    var topPx = parseFloat(getComputedStyle(first).top, 10);
    if (Number.isNaN(topPx)) topPx = 152;

    /* 배율(줌) 75% 등일 때 innerHeight와 실제 보이는 뷰포트가 달라지는 경우 보정 */
    var vv = window.visualViewport;
    var vh =
      (vv && vv.height) ||
      window.innerHeight ||
      document.documentElement.clientHeight ||
      0;
    var last = cards[cards.length - 1];
    var lastH = last.offsetHeight || 0;
    var slack = vh - topPx;

    /* sticky 보조 스크롤 + 줌·반올림 여유(ceiling·소량 buffer) */
    var pad = Math.ceil(
      Math.min(88, Math.max(24, slack * 0.14 + lastH * 0.02 + 8))
    );

    list.style.setProperty("--project-stack-tail-pad", pad + "px");
  }

  var raf = null;
  function scheduleSync() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      raf = null;
      syncProjectStackTailPad();
    });
  }

  mqOn(mqWide, scheduleSync);
  mqOn(mqReduce, scheduleSync);
  window.addEventListener("resize", scheduleSync, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleSync, { passive: true });
    window.visualViewport.addEventListener("scroll", scheduleSync, { passive: true });
  }
  if ("ResizeObserver" in window) {
    new ResizeObserver(scheduleSync).observe(list);
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleSync);
  scheduleSync();
  requestAnimationFrame(scheduleSync);
})();

/** 프로젝트 상세: 이전/다음 순환(project.html 카드 순서와 동일). HTML href가 누락·캐시되어도 동작 보장 */
(function () {
  var order = [
    "project-awallet.html",
    "project-selflive.html",
    "project-payment.html",
    "project-liveclass.html",
    "project-rallyzDesignsystem.html",
    "project-salesManagement.html"
  ];
  var nav = document.querySelector("nav.project-pager");
  if (!nav) return;

  var file = (window.location.pathname || "").split("/").pop() || "";
  if (!file) return;
  var i = order.indexOf(file);
  if (i === -1) return;

  var prevHref = order[(i - 1 + order.length) % order.length];
  var nextHref = order[(i + 1) % order.length];
  var prevBtn = nav.querySelector("a.project-pager__btn--prev");
  var nextBtn = nav.querySelector("a.project-pager__btn--next");
  if (prevBtn) prevBtn.setAttribute("href", prevHref);
  if (nextBtn) nextBtn.setAttribute("href", nextHref);
})();

/** 모바일(≤799px): 피그마 Mobile 758:1282·758:1323·758:1325 — 헤더·본문·푸터 대신 게이트만 표시 */
(function () {
  var mq = window.matchMedia("(max-width: 799px)");
  var gateId = "mobile-gate";
  var cls = "mobile-gate--open";

  function buildGate() {
    var root = document.createElement("div");
    root.id = gateId;
    root.className = "mobile-gate";
    root.setAttribute("lang", "ko");
    root.innerHTML =
      '<header class="mobile-gate__bar">' +
      '<p class="mobile-gate__brand font-logo">SONG HYO SUB</p>' +
      "</header>" +
      '<div class="mobile-gate__card" role="region" aria-labelledby="mobile-gate-heading">' +
      '<div class="mobile-gate__card-inner">' +
      '<p class="mobile-gate__wave" aria-hidden="true">👋🏻</p>' +
      '<h1 id="mobile-gate-heading" class="mobile-gate__title">포트폴리오 접근 안내</h1>' +
      '<p class="mobile-gate__copy">PC에 최적화 되어있습니다.<br>브라우저를 통해 접근해 주세요.</p>' +
      "</div></div>";
    return root;
  }

  function sync() {
    var root = document.body;
    if (!root) return;
    var want = mq.matches;
    var gate = document.getElementById(gateId);
    if (want) {
      if (!gate) root.insertBefore(buildGate(), root.firstChild);
      root.classList.add(cls);
      document.documentElement.classList.add(cls);
    } else {
      if (gate) gate.remove();
      root.classList.remove(cls);
      document.documentElement.classList.remove(cls);
    }
  }

  sync();
  if (mq.addEventListener) mq.addEventListener("change", sync);
  else mq.addListener(sync);
})();
