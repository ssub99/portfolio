/**
 * 임시 프로젝트 잠금: 카드 클릭 시 현재 화면 위에 모달을 띄워 4자리 비밀번호를 확인한다.
 * 비밀번호는 소스에 평문으로 두지 않고 SHA-256 해시만 비교한다.
 */
(function () {
  var STORAGE_KEY = "portfolio:unlocked:v3";
  var PASSWORD_HASH =
    "e525bad0944520046d0b20a6707c17285b27afc38a53c3096e613023fbd08b0d";
  var DIGITS = 4;
  var CARD_LINK_SELECTOR = "a.project-card__link, a.project-card__hit-area";

  var overlay = null;
  var pendingHref = null;
  var lastFocus = null;
  var frozenScrollY = 0;
  var closeTimer = null;
  var isClosing = false;
  var heldCard = null;

  function pageFile() {
    var parts = (window.location.pathname || "").split("/");
    return (parts[parts.length - 1] || "").toLowerCase();
  }

  function isLockedProjectPage() {
    return /^project-.+\.html$/.test(pageFile());
  }

  function isUnlocked() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch (err) {
      return false;
    }
  }

  function setUnlocked() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch (err) {}
  }

  function holdCard(link) {
    releaseCard();
    if (!link || !link.classList.contains("project-card__link")) return;
    heldCard = link;
    link.classList.add("is-lock-held");
  }

  function releaseCard() {
    if (!heldCard) return;
    heldCard.classList.remove("is-lock-held");
    heldCard = null;
  }

  function preventScroll(event) {
    event.preventDefault();
  }

  function focusNoScroll(el) {
    if (!el || typeof el.focus !== "function") return;
    try {
      el.focus({ preventScroll: true });
    } catch (err) {
      el.focus();
    }
  }

  function preventScrollKeys(event) {
    var keys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
    if (keys.indexOf(event.key) === -1) return;
    if (event.target && event.target.closest && event.target.closest("input, textarea")) return;
    event.preventDefault();
  }

  function visualScrollY() {
    var lenis = window.portfolioLenis;
    if (lenis && typeof lenis.scroll === "number") return lenis.scroll;
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  function snapLenisTo(y) {
    var lenis = window.portfolioLenis;
    if (!lenis) return;
    if (typeof lenis.scrollTo === "function") {
      lenis.scrollTo(y, { immediate: true, force: true });
      return;
    }
    if ("animatedScroll" in lenis) lenis.animatedScroll = y;
    if ("targetScroll" in lenis) lenis.targetScroll = y;
    if ("velocity" in lenis) lenis.velocity = 0;
    if ("lastVelocity" in lenis) lenis.lastVelocity = 0;
    if (lenis.animate && typeof lenis.animate.stop === "function") {
      lenis.animate.stop();
    }
  }

  function freezeMotion() {
    frozenScrollY = visualScrollY();
    snapLenisTo(frozenScrollY);
    var lenis = window.portfolioLenis;
    if (lenis && typeof lenis.stop === "function") lenis.stop();
    snapLenisTo(frozenScrollY);
  }

  function resumeMotion() {
    snapLenisTo(frozenScrollY);
    var lenis = window.portfolioLenis;
    if (lenis && typeof lenis.start === "function") lenis.start();
    snapLenisTo(frozenScrollY);
  }

  function freezeHeaderStyles(on) {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var inner = header.querySelector(".site-header__inner");

    if (!on) {
      header.style.transition = "none";
      header.style.height = "";
      header.style.padding = "";
      header.style.backgroundColor = "";
      header.style.borderBottomColor = "";
      header.style.backdropFilter = "";
      header.style.webkitBackdropFilter = "";
      if (inner) {
        inner.style.transition = "none";
        inner.style.borderRadius = "";
        inner.style.backgroundColor = "";
        inner.style.boxShadow = "";
        inner.style.borderColor = "";
        inner.style.backdropFilter = "";
        inner.style.webkitBackdropFilter = "";
      }
      window.requestAnimationFrame(function () {
        header.style.transition = "";
        if (inner) inner.style.transition = "";
      });
      return;
    }

    var cs = window.getComputedStyle(header);
    var height = cs.height;
    var padding = cs.padding;
    var backgroundColor = cs.backgroundColor;
    var borderBottomColor = cs.borderBottomColor;
    var backdropFilter = cs.backdropFilter;
    var webkitBackdropFilter = cs.webkitBackdropFilter;
    header.style.transition = "none";
    header.style.height = height;
    header.style.padding = padding;
    header.style.backgroundColor = backgroundColor;
    header.style.borderBottomColor = borderBottomColor;
    header.style.backdropFilter = backdropFilter;
    header.style.webkitBackdropFilter = webkitBackdropFilter;
    if (!inner) return;
    var ics = window.getComputedStyle(inner);
    var borderRadius = ics.borderRadius;
    var innerBg = ics.backgroundColor;
    var boxShadow = ics.boxShadow;
    var borderColor = ics.borderColor;
    var innerBackdrop = ics.backdropFilter;
    var innerWebkitBackdrop = ics.webkitBackdropFilter;
    inner.style.transition = "none";
    inner.style.borderRadius = borderRadius;
    inner.style.backgroundColor = innerBg;
    inner.style.boxShadow = boxShadow;
    inner.style.borderColor = borderColor;
    inner.style.backdropFilter = innerBackdrop;
    inner.style.webkitBackdropFilter = innerWebkitBackdrop;
  }

  function setScrollLock(on) {
    var opts = { passive: false, capture: true };
    if (on) {
      freezeMotion();
      freezeHeaderStyles(true);
      document.documentElement.classList.add("project-lock-open");
      document.body.classList.add("project-lock-open");
      window.addEventListener("wheel", preventScroll, opts);
      window.addEventListener("touchmove", preventScroll, opts);
      window.addEventListener("keydown", preventScrollKeys, true);
      return;
    }

    window.removeEventListener("wheel", preventScroll, opts);
    window.removeEventListener("touchmove", preventScroll, opts);
    window.removeEventListener("keydown", preventScrollKeys, true);
    document.documentElement.classList.remove("project-lock-open");
    document.body.classList.remove("project-lock-open");
    freezeHeaderStyles(false);
    resumeMotion();
  }

  function sha256hex(value) {
    if (!window.crypto || !crypto.subtle) {
      return Promise.reject(new Error("crypto"));
    }
    var bytes = new TextEncoder().encode(value);
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      return Array.prototype.map
        .call(new Uint8Array(buf), function (b) {
          return ("0" + b.toString(16)).slice(-2);
        })
        .join("");
    });
  }

  function getDigit(input) {
    return (input.getAttribute("data-digit") || "").replace(/\D/g, "").slice(0, 1);
  }

  function setDigit(input, digit) {
    var value = String(digit || "").replace(/\D/g, "").slice(0, 1);
    if (value) {
      input.setAttribute("data-digit", value);
      input.value = "*";
      return;
    }
    input.removeAttribute("data-digit");
    input.value = "";
  }

  function currentCode(inputs) {
    return Array.prototype.map
      .call(inputs, function (input) {
        return getDigit(input);
      })
      .join("");
  }

  function clearInputs(inputs) {
    Array.prototype.forEach.call(inputs, function (input) {
      setDigit(input, "");
    });
    focusNoScroll(inputs[0]);
  }

  function fillFromString(inputs, raw) {
    var digits = String(raw || "")
      .replace(/\D/g, "")
      .slice(0, DIGITS)
      .split("");
    Array.prototype.forEach.call(inputs, function (input, i) {
      setDigit(input, digits[i] || "");
    });
    return digits.join("");
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function finishClose() {
    if (!overlay) return;
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }
    isClosing = false;
    overlay.hidden = true;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    setScrollLock(false);
    document.documentElement.classList.remove("project-lock-pending");
    pendingHref = null;
    lastFocus = null;
    releaseCard();

    if (isLockedProjectPage() && !isUnlocked()) {
      window.location.href = "project.html";
    }
  }

  function closeModal() {
    if (!overlay || overlay.hidden || isClosing) return;
    overlay.setAttribute("aria-hidden", "true");

    if (prefersReducedMotion() || !overlay.classList.contains("is-open")) {
      overlay.classList.remove("is-open");
      finishClose();
      return;
    }

    isClosing = true;
    overlay.classList.remove("is-open");
    function onEnd(event) {
      if (event.target !== overlay) return;
      overlay.removeEventListener("transitionend", onEnd);
      finishClose();
    }
    overlay.addEventListener("transitionend", onEnd);
    closeTimer = window.setTimeout(finishClose, 220);
  }

  function succeed() {
    setUnlocked();
    document.documentElement.classList.remove("project-lock-pending");
    setScrollLock(false);
    var href = pendingHref;
    pendingHref = null;
    if (href) {
      window.location.href = href;
      return;
    }
    if (overlay) {
      overlay.hidden = true;
      overlay.setAttribute("aria-hidden", "true");
    }
  }

  function setBusy(form, busy) {
    form.setAttribute("aria-busy", busy ? "true" : "false");
    var inputs = form.querySelectorAll(".project-lock__digit");
    Array.prototype.forEach.call(inputs, function (input) {
      input.disabled = busy;
    });
  }

  function showError(form, on) {
    var error = form.querySelector(".project-lock__error");
    var field = form.querySelector(".project-lock__digits");
    form.classList.toggle("is-error", on);
    if (field) field.classList.toggle("is-error", on);
    if (error) error.hidden = !on;
  }

  function submitCode(form, inputs) {
    var code = currentCode(inputs);
    if (code.length < DIGITS) return;

    showError(form, false);
    setBusy(form, true);

    sha256hex(code)
      .then(function (hash) {
        if (hash === PASSWORD_HASH) {
          succeed();
          return;
        }
        setBusy(form, false);
        showError(form, true);
        clearInputs(inputs);
      })
      .catch(function () {
        setBusy(form, false);
        showError(form, true);
        clearInputs(inputs);
      });
  }

  function bindModal(root) {
    var form = root.querySelector(".project-lock__form");
    var inputs = root.querySelectorAll(".project-lock__digit");
    var closeBtn = root.querySelector(".project-lock__close");

    function trySubmit() {
      if (form.getAttribute("aria-busy") === "true") return;
      if (currentCode(inputs).length < DIGITS) return;
      submitCode(form, inputs);
    }

    function firstEmptyIndex() {
      for (var i = 0; i < inputs.length; i += 1) {
        if (!getDigit(inputs[i])) return i;
      }
      return -1;
    }

    function focusFillTarget() {
      var i = firstEmptyIndex();
      if (i < 0) return;
      focusNoScroll(inputs[i]);
    }

    Array.prototype.forEach.call(inputs, function (input, index) {
      input.addEventListener("focus", function () {
        var i = firstEmptyIndex();
        if (i >= 0 && i !== index) focusNoScroll(inputs[i]);
      });

      input.addEventListener("input", function () {
        showError(form, false);
        var digit = input.value.replace(/\D/g, "").slice(-1);
        var fillAt = firstEmptyIndex();
        if (fillAt < 0) fillAt = index;
        if (fillAt !== index) setDigit(input, "");
        setDigit(inputs[fillAt], digit);
        if (digit && inputs[fillAt + 1]) focusNoScroll(inputs[fillAt + 1]);
        else focusFillTarget();
        trySubmit();
      });

      input.addEventListener("keydown", function (event) {
        if (event.key !== "Backspace") return;
        event.preventDefault();
        var fillAt = firstEmptyIndex();
        var clearAt = fillAt < 0 ? inputs.length - 1 : Math.max(0, fillAt - 1);
        if (getDigit(input) && fillAt !== index) setDigit(input, "");
        setDigit(inputs[clearAt], "");
        focusNoScroll(inputs[clearAt]);
      });

      input.addEventListener("paste", function (event) {
        event.preventDefault();
        var pasted = "";
        if (event.clipboardData) pasted = event.clipboardData.getData("text");
        fillFromString(inputs, pasted);
        trySubmit();
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      trySubmit();
    });

    closeBtn.addEventListener("click", function () {
      closeModal();
    });

    root.addEventListener("click", function (event) {
      if (event.target === root) closeModal();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && overlay && overlay.classList.contains("is-open")) {
        event.preventDefault();
        closeModal();
      }
    });
  }

  function ensureModal() {
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "project-lock";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "project-lock-title");
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="project-lock__panel">' +
      '<button class="project-lock__close" type="button" aria-label="닫기">' +
      "<span aria-hidden=\"true\">×</span>" +
      "</button>" +
      '<p class="project-lock__eyebrow">Enter Password</p>' +
      '<h2 class="project-lock__title" id="project-lock-title">비밀번호를 입력해 주세요.</h2>' +
      '<form class="project-lock__form" action="#" novalidate>' +
      '<div class="project-lock__digits" role="group" aria-label="비밀번호 4자리">' +
      '<input class="project-lock__digit" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="1" aria-label="비밀번호 1번째 자리">' +
      '<input class="project-lock__digit" type="text" inputmode="numeric" autocomplete="off" maxlength="1" aria-label="비밀번호 2번째 자리">' +
      '<input class="project-lock__digit" type="text" inputmode="numeric" autocomplete="off" maxlength="1" aria-label="비밀번호 3번째 자리">' +
      '<input class="project-lock__digit" type="text" inputmode="numeric" autocomplete="off" maxlength="1" aria-label="비밀번호 4번째 자리">' +
      "</div>" +
      '<p class="project-lock__error" hidden>비밀번호가 올바르지 않습니다.</p>' +
      "</form>" +
      "</div>";

    document.body.appendChild(overlay);
    bindModal(overlay);
    return overlay;
  }

  function openModal(href) {
    lastFocus = document.activeElement;
    pendingHref = href || null;
    var root = ensureModal();
    var form = root.querySelector(".project-lock__form");
    var inputs = root.querySelectorAll(".project-lock__digit");
    setBusy(form, false);
    showError(form, false);
    clearInputs(inputs);
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    root.classList.remove("is-open");
    setScrollLock(true);
    focusNoScroll(inputs[0]);
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        root.classList.add("is-open");
        focusNoScroll(inputs[0]);
      });
    });
  }

  function isCardLink(node) {
    if (!node || !node.closest) return null;
    return node.closest(CARD_LINK_SELECTOR);
  }

  function onCardClick(event) {
    if (event.defaultPrevented) return;
    if (event.button && event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (isUnlocked()) return;

    var link = isCardLink(event.target);
    if (!link) return;

    var href = link.getAttribute("href");
    if (!href) return;

    event.preventDefault();
    holdCard(link);
    openModal(href);
  }

  function init() {
    document.addEventListener("click", onCardClick, true);

    if (isLockedProjectPage() && !isUnlocked()) {
      openModal(null);
      return;
    }

    document.documentElement.classList.remove("project-lock-pending");
  }

  if (isLockedProjectPage() && !isUnlocked()) {
    document.documentElement.classList.add("project-lock-pending");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
