/**
 * [data-vplayer] 영상 플레이어 (목업 화면 안에서 재생)
 *
 * - 자동재생 없음: 재생/일시정지 버튼(또는 화면 클릭)으로만 제어한다.
 * - 한 번 끝까지 재생되면 멈춘다(자동 반복 없음). 다시 보려면 재생 버튼을 누른다.
 * - 화면 밖으로 나가거나 탭이 비활성화되면 일시정지하고, 돌아오면 이어서 재생한다.
 * - 한 번에 하나만 재생: 한쪽을 재생하면 다른 쪽은 그 자리에서 일시정지한다(다시 누르면 이어서 재생).
 * - 소리 포함 재생. (브라우저 정책으로 소리 있는 재생이 거부되면 재생 버튼 상태로 돌아간다)
 * - 영상 저장/복사 억제:
 *     · <video> 는 pointer-events:none, 입력은 투명 shield 가 받는다 → 영상에 우클릭 메뉴(동영상 저장·주소 복사)가 뜨지 않는다.
 *     · 컨테이너 전체 contextmenu / dragstart / selectstart 차단.
 *     · controls·다운로드·PiP·원격재생 비활성(controlslist, disablepictureinpicture, disableremoteplayback).
 *     · 영상 파일을 fetch → Blob URL 로 재생해 DOM(video.src)에 파일 주소가 노출되지 않게 한다.
 *   ※ 브라우저로 전달되는 영상은 개발자도구 Network 탭 등으로 완전히 막을 수는 없다(억제 수준).
 */
(function () {
  "use strict";

  var players = document.querySelectorAll("[data-vplayer]");
  if (!players.length) return;

  var UI_FLASH_MS = 1600;

  /* 우클릭·드래그·선택 차단: 영상 비교 영역 전체 */
  Array.prototype.forEach.call(document.querySelectorAll(".case-vcompare"), function (root) {
    ["contextmenu", "dragstart", "selectstart"].forEach(function (type) {
      root.addEventListener(
        type,
        function (e) {
          e.preventDefault();
        },
        true
      );
    });
  });

  var registry = []; /* { video, stop } — 한 번에 하나만 재생하도록 서로를 멈추는 데 사용 */

  /* 지금 재생을 시작하는 쪽 외의 플레이어를 모두 멈춘다 */
  function stopOthers(except) {
    registry.forEach(function (item) {
      if (item.video !== except) item.stop();
    });
  }

  function giveAudioTo(video) {
    registry.forEach(function (item) {
      item.video.muted = item.video !== video;
    });
  }

  var blobUrls = [];
  window.addEventListener("pagehide", function () {
    blobUrls.forEach(function (u) {
      try {
        URL.revokeObjectURL(u);
      } catch (err) {
        /* noop */
      }
    });
  });

  function init(root) {
    var video = root.querySelector("video");
    var btn = root.querySelector(".vplayer__btn");
    var shield = root.querySelector(".vplayer__shield");
    var src = root.getAttribute("data-video-src");
    var label = root.getAttribute("data-label") || "영상";
    if (!video || !btn || !src) return;
    registry.push({ video: video, stop: stopByOther });

    var sourcePromise = null;
    var wantPlay = false; /* 사용자가 재생을 원하는 상태 */
    var inView = false;
    var viewPaused = false; /* 화면 밖/탭 비활성으로 인해 우리가 멈춘 상태 */
    var uiTimer = null;

    /* 영상 파일을 Blob URL 로 연결 (실패 시 일반 src 로 폴백) */
    function ensureSource() {
      if (sourcePromise) return sourcePromise;
      root.classList.add("is-loading");
      sourcePromise = fetch(src, { credentials: "same-origin" })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.blob();
        })
        .then(function (blob) {
          var type = blob.type && blob.type.indexOf("video/") === 0 ? blob.type : "video/mp4";
          var url = URL.createObjectURL(blob.type === type ? blob : new Blob([blob], { type: type }));
          blobUrls.push(url);
          video.src = url;
        })
        .catch(function () {
          video.src = src;
        })
        .then(function () {
          return new Promise(function (resolve) {
            if (video.readyState >= 2) return resolve();
            var done = function () {
              video.removeEventListener("loadeddata", done);
              video.removeEventListener("error", done);
              resolve();
            };
            video.addEventListener("loadeddata", done);
            video.addEventListener("error", done);
            video.load();
          });
        })
        .then(function () {
          root.classList.remove("is-loading");
        });
      return sourcePromise;
    }

    function flashUi() {
      root.classList.add("is-ui");
      clearTimeout(uiTimer);
      uiTimer = setTimeout(function () {
        root.classList.remove("is-ui");
      }, UI_FLASH_MS);
    }

    function setUi(playing) {
      root.classList.toggle("is-playing", playing);
      btn.setAttribute("aria-pressed", playing ? "true" : "false");
      btn.setAttribute("aria-label", label + (playing ? " 일시정지" : " 재생"));
    }

    function startPlayback(fromStart) {
      return ensureSource().then(function () {
        if (!wantPlay) return;
        if (fromStart || video.ended) video.currentTime = 0;
        giveAudioTo(video);
        var p = video.play();
        if (p && p.catch) {
          p.catch(function (err) {
            /* 소리 있는 재생이 브라우저 정책으로 거부된 경우: 재생 버튼 상태로 되돌린다 */
            if (err && err.name === "NotAllowedError") {
              wantPlay = false;
              setUi(false);
              flashUi();
            }
          });
        }
      });
    }

    function play() {
      /* 다른 영상을 먼저 멈춘다(재생 중·로딩 중·화면 밖 일시정지 상태 모두 의도 해제) */
      stopOthers(video);
      wantPlay = true;
      viewPaused = false;
      startPlayback(false);
      flashUi();
    }

    function pause() {
      wantPlay = false;
      viewPaused = false;
      video.pause();
      flashUi();
    }

    /* 다른 플레이어가 재생을 시작해서 멈춰지는 경우: 위치는 유지하므로 다시 누르면 이어서 재생 */
    function stopByOther() {
      wantPlay = false; /* 로딩 중이던 재생 시작도 취소됨(startPlayback 이 wantPlay 를 확인) */
      viewPaused = false; /* 화면 복귀 시 자동 재개되지 않도록 */
      video.pause();
      root.classList.remove("is-ui");
    }

    /* 실제 재생 여부가 아니라 "재생하려는 의도" 기준: 로딩 중에 다시 누르면 재생이 아니라 취소 */
    function toggle() {
      if (wantPlay) pause();
      else play();
    }

    btn.addEventListener("click", toggle);
    shield.addEventListener("click", toggle);

    video.addEventListener("play", function () {
      setUi(true);
    });
    video.addEventListener("playing", function () {
      setUi(true);
    });
    video.addEventListener("pause", function () {
      if (!video.ended) setUi(false);
    });

    /* 재생 오류: 재생 의도를 해제해 다음 클릭이 다시 재생 시도가 되게 한다 */
    video.addEventListener("error", function () {
      wantPlay = false;
      viewPaused = false;
      setUi(false);
    });

    /* 끝까지 재생되면 멈춘다(자동 반복 없음) */
    video.addEventListener("ended", function () {
      wantPlay = false;
      viewPaused = false;
      setUi(false);
      root.classList.remove("is-ui");
    });

    function syncView() {
      var visible = inView && !document.hidden;
      if (!visible) {
        if (!video.paused && !video.ended) {
          viewPaused = true;
          video.pause();
        }
        return;
      }
      if (viewPaused && wantPlay) {
        viewPaused = false;
        startPlayback(false);
      }
    }

    if ("IntersectionObserver" in window) {
      /* 가까워지면 미리 영상 파일을 받아 두고(재생 대기 최소화), 화면 밖이면 정지 */
      new IntersectionObserver(
        function (entries) {
          if (entries[0].isIntersecting) ensureSource();
        },
        { rootMargin: "700px 0px" }
      ).observe(root);

      new IntersectionObserver(
        function (entries) {
          inView = entries[0].isIntersecting;
          syncView();
        },
        { threshold: 0.25 }
      ).observe(root);
    } else {
      inView = true;
      ensureSource();
    }

    document.addEventListener("visibilitychange", syncView);
    setUi(false);
  }

  Array.prototype.forEach.call(players, init);
})();
