(() => {
  const tg = window.Telegram?.WebApp;
  tg?.ready(); tg?.expand();
  const $ = id => document.getElementById(id);
  const playBtn = $("play"), collectBtn = $("collect"), stage = $("stage");
  const BET = 300;
  const BALANCE_KEY = "karschiki_balance";
  const REDEEMED_KEY = "karschiki_redeemed_promos_v1";
  const MAX_PROFILE_URL = "https://max.ru/u/f9LHodD0cOLneOcaWjEmFgBMwk43kHjgXIXkgV5Iri4Pyzd-kON9N1Y9ptg";

  // Звуки создаются через Web Audio API — отдельные аудиофайлы и сервер не нужны.
  const SOUND_KEY = "karschiki_sound_enabled_v1";
  let soundEnabled = (() => {
    try { return localStorage.getItem(SOUND_KEY) !== "0"; } catch (_) { return true; }
  })();
  let audioContext = null, masterGain = null, engineNodes = null;

  function initAudio() {
    if (!soundEnabled) return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioContext) {
      audioContext = new AudioCtx();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.82;
      masterGain.connect(audioContext.destination);
    }
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  }
  function tone(frequency, duration, type = "sine", volume = 0.12, endFrequency = null, delay = 0) {
    const ctx = initAudio();
    if (!ctx || !masterGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(start); osc.stop(start + duration + 0.03);
  }
  function playUiSound() {
    tone(720, 0.055, "sine", 0.045);
  }
  function playStartSound() {
    tone(95, 0.22, "sawtooth", 0.075, 175);
    tone(145, 0.28, "triangle", 0.045, 230, 0.08);
  }
  function startEngineSound() {
    const ctx = initAudio();
    if (!ctx || engineNodes) return;
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const wobble = ctx.createOscillator();
    const wobbleGain = ctx.createGain();
    // Более выразительный, но мягкий звук мотора погрузчика с небольшими «подгазовками».
    osc.type = "sawtooth"; osc.frequency.setValueAtTime(68, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(92, ctx.currentTime + 0.7);
    overtone.type = "triangle"; overtone.frequency.setValueAtTime(136, ctx.currentTime);
    overtone.frequency.linearRampToValueAtTime(184, ctx.currentTime + 0.7);
    filter.type = "lowpass"; filter.frequency.value = 360;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.065, ctx.currentTime + 0.28);
    wobble.type = "sine"; wobble.frequency.value = 4.1; wobbleGain.gain.value = 9;
    wobble.connect(wobbleGain); wobbleGain.connect(osc.frequency);
    osc.connect(filter); overtone.connect(filter); filter.connect(gain); gain.connect(masterGain);
    osc.start(); overtone.start(); wobble.start();
    engineNodes = { osc, overtone, wobble, gain };
  }
  function stopEngineSound() {
    if (!engineNodes || !audioContext) return;
    const nodes = engineNodes; engineNodes = null;
    const now = audioContext.currentTime;
    nodes.gain.gain.cancelScheduledValues(now);
    nodes.gain.gain.setTargetAtTime(0.0001, now, 0.09);
    [nodes.osc, nodes.overtone, nodes.wobble].forEach(node => {
      try { node.stop(now + 0.35); } catch (_) {}
    });
  }
  // Звук получения очков декодируется в AudioBuffer и воспроизводится
  // через общий Web Audio микшер игры, а не отдельным HTMLAudio-плеером.
  let collectBuffer = null;
  let collectBufferLoading = false;
  function loadCollectSound() {
    const ctx = initAudio();
    if (!ctx || collectBuffer || collectBufferLoading) return;
    collectBufferLoading = true;
    fetch("./payment_succes.mp3", { cache: "force-cache" })
      .then(response => {
        if (!response.ok) throw new Error("Collect sound could not be loaded");
        return response.arrayBuffer();
      })
      .then(data => ctx.decodeAudioData(data.slice(0)))
      .then(buffer => { collectBuffer = buffer; })
      .catch(() => { collectBuffer = null; })
      .finally(() => { collectBufferLoading = false; });
  }
  function playCollectSound() {
    stopEngineSound();
    const ctx = initAudio();
    if (!ctx || !soundEnabled) return;
    if (collectBuffer) {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = collectBuffer;
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      source.connect(gain);
      gain.connect(masterGain);
      source.start(0);
    } else {
      // Резервный встроенный звук на случай, если файл ещё не успел декодироваться.
      tone(520, 0.045, "triangle", 0.035, 390);
      tone(740, 0.09, "sine", 0.065, 820, 0.045);
      tone(990, 0.11, "sine", 0.075, 1120, 0.13);
      tone(1480, 0.075, "sine", 0.035, 1320, 0.22);
      loadCollectSound();
    }
  }
  function playCrashSound() {
    stopEngineSound();
    tone(190, 0.42, "sawtooth", 0.11, 48);
    tone(620, 0.32, "triangle", 0.055, 115, 0.04);
  }
  function updateSoundButton() {
    const button = document.getElementById("soundToggle");
    if (!button) return;
    button.innerHTML = soundEnabled
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M16 9a5 5 0 0 1 0 6M18.5 6.5a8.5 8.5 0 0 1 0 11"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="m17 9 5 6m0-6-5 6"/></svg>';
    button.setAttribute("aria-label", soundEnabled ? "Выключить звук" : "Включить звук");
    button.setAttribute("aria-pressed", String(soundEnabled));
    button.title = soundEnabled ? "Выключить звуки" : "Включить звуки";
  }
  function setupSoundControl() {
    const button = document.getElementById("soundToggle");
    if (!button) return;
    button.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      try { localStorage.setItem(SOUND_KEY, soundEnabled ? "1" : "0"); } catch (_) {}
      if (!soundEnabled) stopEngineSound();
      updateSoundButton();
      if (soundEnabled) { initAudio(); playUiSound(); }
    });
    updateSoundButton();
  }
  setupSoundControl();
  // Кнопка вывода открывает только информационное окно: денежных операций нет.
  const withdrawModal = document.getElementById("withdrawModal");
  const closeWithdraw = () => { withdrawModal?.classList.remove("is-open"); withdrawModal?.setAttribute("aria-hidden", "true"); };
  document.getElementById("withdrawOpen")?.addEventListener("click", () => { withdrawModal?.classList.add("is-open"); withdrawModal?.setAttribute("aria-hidden", "false"); });
  document.getElementById("withdrawClose")?.addEventListener("click", closeWithdraw);
  document.getElementById("withdrawOk")?.addEventListener("click", closeWithdraw);
  withdrawModal?.addEventListener("click", event => { if (event.target === withdrawModal) closeWithdraw(); });
  // Первый пользовательский жест разблокирует аудио в мобильных браузерах.
  document.addEventListener("pointerdown", () => {
    if (soundEnabled) { initAudio(); loadCollectSound(); }
  }, { once: true, passive: true });
  document.addEventListener("click", event => {
    const clickedButton = event.target.closest("button");
    // Для «Забрать деньги» играет только загруженный MP3 — общий короткий
    // WebAudio-сигнал здесь раньше накладывался на него и звучал как второй звук.
    if (clickedButton && !["soundToggle", "collect"].includes(clickedButton.id)) playUiSound();
  }, true);

  // Промокоды для начисления виртуальных очков. Каждый код действует один раз в этом браузере.
  const PROMO_CODES = {
    "START5000": 5000,
    "BONUS10000": 10000,
    "KARSH25000": 25000,
    "KARSH50000": 50000,
    "KARSH100000": 100000,
    "SHIFT5000": 5000,
    "PALLET10000": 10000,
    "FORKLIFT25000": 25000,
    "TEAM50000": 50000,
    "DRIVER100000": 100000,
    "WORK5000": 5000,
    "VILOCHNIK10000": 10000,
    "KARSHIK25000": 25000,
    "SMENA50000": 50000,
    "ZAPUSK100000": 100000,
    "PODDON5000": 5000,
    "SPEED10000": 10000,
    "SKLAD25000": 25000,
    "BANDA50000": 50000,
    "MASTER100000": 100000
  };

  let balance = (() => {
    try {
      const saved = localStorage.getItem(BALANCE_KEY);
      return saved === null ? 68000 : Math.max(0, Number(saved) || 0);
    } catch (_) { return 68000; }
  })();
  let redeemed = (() => {
    try {
      const value = JSON.parse(localStorage.getItem(REDEEMED_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  })();
  let best = 0, active = false;
  let multiplier = 1, crashAt = 0, startTime = 0, raf = null, history = [];

  const fmt = n => Math.floor(n).toLocaleString("ru-RU");
  function render() {
    try {
      localStorage.setItem(BALANCE_KEY, String(balance));
      localStorage.setItem(REDEEMED_KEY, JSON.stringify(redeemed));
    } catch (_) {
      $("hint").textContent = "Не удалось сохранить данные браузера.";
    }
    $("balance").textContent = fmt(balance);
    $("best").textContent = best ? best.toFixed(2) + "x" : "—";
  }

  function applyPromo() {
    const input = $("promoInput");
    const message = $("promoMessage");
    const code = input.value.trim().toUpperCase();
    if (!code) { message.textContent = "Введи промокод."; return; }
    const amount = PROMO_CODES[code];
    if (!amount) { message.textContent = "Такого промокода нет."; return; }
    if (redeemed.includes(code)) { message.textContent = "Этот промокод уже активирован в этом браузере."; return; }
    balance += amount;
    redeemed.push(code);
    render();
    message.textContent = `Успешно! Начислено ${fmt(amount)} виртуальных очков.`;
    input.value = "";
  }

  $("promoApply").addEventListener("click", applyPromo);
  $("promoInput").addEventListener("keydown", event => {
    if (event.key === "Enter") applyPromo();
  });

  function addHistory(value) {
    history.unshift(value); history = history.slice(0, 7);
    $("historyList").innerHTML = history.map(v =>
      `<span class="history-chip" style="color:${v >= 2 ? '#65d6a5' : '#ff8797'}">${v.toFixed(2)}x</span>`
    ).join("");
  }
  function resetPlane() {
    $("plane").classList.remove("crash-flyaway", "bump");
    $("plane").style.left = "16%";
    $("plane").style.top = "55%";
    $("plane").style.opacity = "";
    $("plane").style.transform = "";
    $("trail").style.width = "0";
    stage.classList.remove("flying");
  }

  // При аварийном завершении погрузчик резко вылетает за край игрового поля.
  const crashStyle = document.createElement("style");
  crashStyle.textContent = `
    #plane.crash-flyaway {
      animation: karshik-flyaway 650ms cubic-bezier(.35,.02,.85,.35) forwards !important;
      pointer-events: none;
      transform-origin: center center;
      z-index: 20;
    }
    @keyframes karshik-flyaway {
      0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
      18% { transform: translate(-5px, 8px) rotate(-8deg) scale(1.04); opacity: 1; }
      100% { transform: translate(125vw, -115vh) rotate(38deg) scale(.55); opacity: 0; }
    }
  `;
  document.head.appendChild(crashStyle);

  function finish(collected) {
    active = false;
    cancelAnimationFrame(raf);
    collectBtn.disabled = true;
    playBtn.disabled = false;
    stage.classList.remove("flying");
    if (collected) {
      playCollectSound();
      // Ставка уже списана при старте. Начисляем только чистый выигрыш:
      // при 2.00x это ровно одна ставка, без повторного возврата самой ставки.
      // Используем тот же коэффициент с двумя знаками, который видит игрок.
      const settledMultiplier = Number(multiplier.toFixed(2));
      const earned = Math.max(0, Math.floor(BET * (settledMultiplier - 1) * (5 / 6) + 1e-9));
      balance += earned;
      best = Math.max(best, settledMultiplier);
      $("status").textContent = `ЗАЧИСЛЕНО: +${fmt(earned)} РУБЛЕЙ`;
      $("hint").textContent = `Выигрыш ${fmt(earned)} рублей зачислен на баланс.`;
    } else {
      $("status").textContent = `ПОЕЗДКА ЗАВЕРШЕНА — ${multiplier.toFixed(2)}x`;
      $("hint").textContent = `Проёбано ${fmt(BET)} рублей. Попробуй ещё раз!`;
      $("plane").classList.remove("crash-flyaway");
    }
    addHistory(multiplier);
    render();
    // Отдельное событие для общего рейтинга; игровая логика и баланс не меняются.
    window.dispatchEvent(new CustomEvent("karshiki:round-finished", {
      detail: { multiplier, collected: !!collected }
    }));
  }
  function tick(now) {
    if (!active) return;
    const elapsed = (now - startTime) / 1000;
    multiplier = Math.exp(elapsed * 0.19);
    if (multiplier >= crashAt) {
      multiplier = crashAt;
      $("multiplier").textContent = multiplier.toFixed(2) + "x";
      // Сразу блокируем управление, затем проигрываем вылет и завершаем поездку.
      active = false;
      cancelAnimationFrame(raf);
      collectBtn.disabled = true;
      playBtn.disabled = true;
      stage.classList.remove("flying");
      $("status").textContent = "ПОГРУЗЧИК СЪЕБАЛСЯ!";
      $("hint").textContent = "Поездка завершается...";
      const plane = $("plane");
      plane.classList.remove("bump");
      void plane.offsetWidth;
      plane.classList.add("crash-flyaway");
      playCrashSound();
      const complete = () => {
        plane.removeEventListener("animationend", onFlyawayEnd);
        finish(false);
      };
      const onFlyawayEnd = event => {
        if (event.animationName === "karshik-flyaway") complete();
      };
      plane.addEventListener("animationend", onFlyawayEnd);
      // Запасной вариант на случай, если браузер не отправит animationend.
      window.setTimeout(() => {
        if (playBtn.disabled) complete();
      }, 750);
      return;
    }
    $("multiplier").textContent = multiplier.toFixed(2) + "x";
    const x = Math.min(78, 16 + elapsed * 5.2);
    const y = Math.max(18, 55 - elapsed * 3.1);
    $("plane").style.left = x + "%";
    $("plane").style.top = y + "%";
    $("trail").style.width = Math.max(0, (x - 12) * 1.05) + "%";
    raf = requestAnimationFrame(tick);
  }

  playBtn.addEventListener("click", () => {
    if (active || balance < BET) {
      if (balance < BET) $("hint").textContent = "Всё проёбано. Пополни счёт через кнопку ниже.";
      return;
    }
    balance -= BET;
    render();
    multiplier = 1;
    crashAt = 1.15 + Math.random() * (7 - 1.15);
    startTime = performance.now();
    active = true;
    playBtn.disabled = true;
    collectBtn.disabled = false;
    stage.classList.add("flying");
    playStartSound();
    startEngineSound();
    $("status").textContent = "ПОГРУЗЧИК ПОЛЕТЕЛ";
    $("hint").textContent = "Нажми «Забрать деньги» до завершения поездки.";
    resetPlane();
    stage.classList.add("flying");
    $("multiplier").textContent = "1.00x";
    raf = requestAnimationFrame(tick);
  });
  collectBtn.addEventListener("click", () => {
    if (active) finish(true);
  });

  render();
})();
