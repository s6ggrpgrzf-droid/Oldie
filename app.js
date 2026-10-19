/* OLDIE — a 70s wooden console TV that plays nothing but vintage commercials.
   No names, no listings, no hints. Turn the channel knob and see what the
   past was selling. Reels stream free from the Internet Archive's
   Prelinger Archive (public domain). */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var player = $("player"), tvView = $("tvView"),
      pic = $("tvPicture"), chKnob = $("knobCh"), volKnob = $("knobVol"),
      chPtr = $("chPtr"), volPtr = $("volPtr"), chNum = $("chNum"),
      pow = $("btnPower"), sCan = $("staticCanvas");

  var reels = [];            // archive.org identifiers, from reels.json
  var curReel = null;        // identifier currently playing
  var curCh = 2;             // amber window number 2..13 (flavor only)
  var chAngle = 0;
  var powerOn = true;
  var skipGuard = 0;         // caps consecutive error-skips

  /* ---------- film noise: loud static when idle, faint grain when playing ---------- */
  var sCtx = sCan.getContext("2d");
  var staticTimer = 0, noiseMode = "off";   // off | static | grain
  var reducedMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function drawStatic() {
    var img = sCtx.createImageData(160, 120), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    sCtx.putImageData(img, 0, 0);
  }
  function setNoise(mode) {
    if (mode === noiseMode) return;
    noiseMode = mode;
    if (staticTimer) { clearInterval(staticTimer); staticTimer = 0; }
    if (mode === "off") { sCan.style.display = "none"; return; }
    sCan.style.display = "block";
    sCan.style.opacity = mode === "static" ? "1" : ".07";
    drawStatic();
    if (!reducedMotion) staticTimer = setInterval(drawStatic, mode === "static" ? 90 : 140);
  }

  function reelUrl(id) {
    return "https://archive.org/download/" + id + "/" + id + ".mp4";
  }
  function pickReel() {
    if (!reels.length) return null;
    var id = curReel, guard = 0;
    while ((id === curReel || !id) && guard++ < 12) {
      id = reels[Math.floor(Math.random() * reels.length)];
    }
    return id;
  }

  /* Channel digits roll like a mechanical tuner before settling. */
  function rollChannel(finalNum) {
    var steps = 6, i = 0;
    var iv = setInterval(function () {
      if (++i >= steps) {
        clearInterval(iv);
        chNum.textContent = String(finalNum);
      } else {
        chNum.textContent = String(2 + Math.floor(Math.random() * 12));
      }
    }, 65);
  }

  /* Play a random reel, dropped in at a random point — every channel
     change is a surprise. Runs inside the tap gesture (iOS requirement). */
  function surprise() {
    if (!powerOn || !reels.length) return;
    var id = pickReel();
    if (!id) return;
    curReel = id;
    curCh = 2 + Math.floor(Math.random() * 12);
    rollChannel(curCh);
    setNoise("static");   // snow until the picture locks in
    player.classList.remove("film");
    // the tuning roll: vertical hold wobbles, then catches
    pic.classList.remove("tuning");
    void pic.offsetWidth;
    pic.classList.add("tuning");
    setTimeout(function(){ pic.classList.remove("tuning"); }, 600);
    document.body.classList.remove("watching");   // room lights come up while tuning
    player.src = reelUrl(id);
    try {
      var pr = player.play();
      if (pr && pr.catch) pr.catch(function () {});
    } catch (e) {}
    // Drop into a random spot once we know the length.
    var once = function () {
      player.removeEventListener("loadedmetadata", once);
      try {
        var d = player.duration || 0;
        if (d > 20) player.currentTime = Math.random() * d * 0.85;
      } catch (e) {}
    };
    player.addEventListener("loadedmetadata", once);
  }

  /* A reel that won't load just gets skipped — the show goes on. */
  player.addEventListener("error", function () {
    if (!player.src || !powerOn) return;
    if (skipGuard++ > 6) { skipGuard = 0; return; }  // don't spin forever
    surprise();
  });
  player.addEventListener("playing", function () {
    skipGuard = 0;
    setNoise("grain");   // picture locked in — snow drops to a faint film grain
    player.classList.add("film");   // + the occasional projector flicker
    document.body.classList.add("watching");   // lights down
  });
  player.addEventListener("ended", function () {
    skipGuard = 0;
    surprise();   // commercials never stop
  });

  /* Tapping the screen itself also changes the channel. */
  tvView.addEventListener("click", function () {
    chAngle += 42;
    chPtr.style.transform = "rotate(" + chAngle + "deg)";
    blip(1900, 0.05, "square", 0.05);
    setTimeout(function () { blip(1350, 0.06, "square", 0.04); }, 55);
    surprise();
  });

  /* ---------- tiny speaker: knob detents + power thunk ---------- */
  var AC = null;
  function ac() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (AC && AC.state === "suspended") AC.resume();
    return AC;
  }
  function blip(freq, dur, type, gain) {
    var a = ac(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || "square"; o.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.06, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur + 0.02);
  }
  function thunk() {
    var a = ac(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(120, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(38, a.currentTime + 0.16);
    g.gain.setValueAtTime(0.22, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.2);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + 0.22);
  }

  /* ---------- channel knob ---------- */
  chKnob.addEventListener("click", function () {
    chAngle += 42;
    chPtr.style.transform = "rotate(" + chAngle + "deg)";
    blip(1900, 0.05, "square", 0.05);
    setTimeout(function () { blip(1350, 0.06, "square", 0.04); }, 55);
    surprise();
  });

  /* ---------- volume knob: drag vertically; tap = mute ---------- */
  function paintVol() {
    var v = player.muted ? 0 : player.volume;
    volPtr.style.transform = "rotate(" + (-135 + v * 270) + "deg)";
  }
  paintVol();
  volKnob.addEventListener("pointerdown", function (e) {
    try { volKnob.setPointerCapture(e.pointerId); } catch (err) {}
    var y0 = e.clientY, v0 = player.muted ? 0 : player.volume, moved = 0;
    blip(900, 0.04, "sine", 0.03);
    function mv(ev) {
      moved = Math.max(moved, Math.abs(ev.clientY - y0));
      var v = Math.min(1, Math.max(0, v0 + (y0 - ev.clientY) / 170));
      player.volume = v; player.muted = false; paintVol();
    }
    function up() {
      volKnob.removeEventListener("pointermove", mv);
      volKnob.removeEventListener("pointerup", up);
      volKnob.removeEventListener("pointercancel", up);
      if (moved < 8) {
        player.muted = !player.muted;
        blip(player.muted ? 500 : 1000, 0.06, "sine", 0.05);
        paintVol();
      }
    }
    volKnob.addEventListener("pointermove", mv);
    volKnob.addEventListener("pointerup", up);
    volKnob.addEventListener("pointercancel", up);
  });
  player.addEventListener("volumechange", paintVol);

  /* ---------- power: only the picture collapses; the glass stays ----------
     Off: picture -> bright line -> dot -> dark glass (the set remains).
     On:  dot -> line -> full picture, snow until a channel is chosen. */
  pow.addEventListener("click", function () {
    thunk();
    if (powerOn) {
      player.pause();
      setNoise("off");
      player.classList.remove("film");
      document.body.classList.remove("watching");
      pic.classList.remove("crt-on"); pic.classList.add("crt-off");
      pow.classList.remove("on"); pow.classList.add("off");
      powerOn = false;
    } else {
      pic.classList.remove("crt-off"); pic.classList.add("crt-on");
      pow.classList.add("on"); pow.classList.remove("off");
      powerOn = true;
      setTimeout(function () {
        if (!powerOn) return;
        if (player.src) {
          setNoise("static");
          try { var pr = player.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
        } else {
          setNoise("static");
        }
      }, 400);
    }
  });

  /* ---------- keyboard ---------- */
  document.addEventListener("keydown", function (e) {
    if (/INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || "")) return;
    var k = e.key.toLowerCase();
    if (k === " ") { e.preventDefault(); player.paused ? player.play() : player.pause(); }
    else if (k === "m") player.muted = !player.muted;
    else if (k === "c") chKnob.click();
  });

  /* ---------- init: the set is on, tuned to nothing — snow ---------- */
  setNoise("static");
  fetch("reels.json")
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (d) { reels = d.reels || []; })
    .catch(function () { reels = []; });

  // Expose a sliver for smoke tests.
  window.__oldie = {
    get reels() { return reels; },
    get curReel() { return curReel; },
    surprise: surprise
  };
})();
