/* ========================================================
   ASTRA — Astronaut Vision (3-file edition)
   Camera + HUD + ECG waveform + demo mode + controls
   ======================================================== */
(function () {
  'use strict';

  /* ------- DOM ------- */
  const $ = (id) => document.getElementById(id);
  const startScreen  = $('start');
  const visionScreen = $('vision');
  const video        = $('cam');
  const demoCanvas   = $('demoCanvas');
  const enterBtn     = $('enterBtn');

  /* ------- State ------- */
  let stream = null;
  let facing = 'environment';
  let isDemo = false;
  let isOn = true;
  let demoTimer = null;
  let clockTimer = null;
  let ecgTimer = null;

  /* ================= CAMERA ================= */
  async function startCamera(facingMode = 'environment') {
    stopCamera();
    facing = facingMode;
    isOn = true;
    isDemo = false;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
      video.classList.remove('hidden');
      demoCanvas.classList.add('hidden');
      toast('CAMERA ONLINE');
      return true;
    } catch (err) {
      console.warn('Camera failed:', err.name, err.message);
      toast('CAMERA DENIED — DEMO MODE');
      startDemo();
      return false;
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (video) video.srcObject = null;
    if (demoTimer) { clearInterval(demoTimer); demoTimer = null; }
  }

  async function switchCamera() {
    if (isDemo) { toast('DEMO MODE — NO CAMERA'); return; }
    const next = facing === 'environment' ? 'user' : 'environment';
    try {
      await startCamera(next);
      toast(next === 'user' ? 'FRONT CAMERA' : 'REAR CAMERA');
    } catch {
      toast('SWITCH FAILED');
    }
  }

  function toggleCamera() {
    isOn = !isOn;
    if (isOn) {
      if (isDemo) { startDemo(); }
      else startCamera(facing);
      toast('CAMERA ON');
    } else {
      stopCamera();
      video.classList.add('hidden');
      toast('CAMERA OFF');
    }
  }

  /* ================= DEMO MODE (starfield + nebula) ================= */
  function startDemo() {
    isDemo = true;
    isOn = true;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    video.classList.add('hidden');
    demoCanvas.classList.remove('hidden');
    renderDemo();
  }

  function renderDemo() {
    const ctx = demoCanvas.getContext('2d');
    const resize = () => {
      demoCanvas.width = window.innerWidth;
      demoCanvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => demoCanvas.width;
    const H = () => demoCanvas.height;
    const stars = Array.from({ length: 220 }, () => ({
      x: Math.random() * W(),
      y: Math.random() * H(),
      r: Math.random() * 1.6 + 0.2,
      v: Math.random() * 0.3 + 0.05
    }));
    let t = 0;
    if (demoTimer) clearInterval(demoTimer);
    demoTimer = setInterval(() => {
      const w = W(), h = H();
      ctx.fillStyle = '#000814';
      ctx.fillRect(0, 0, w, h);
      // nebula
      const nebulas = [
        { x: w * 0.3, y: h * 0.4, r: 240, c: 'rgba(0,229,255,0.10)' },
        { x: w * 0.7, y: h * 0.6, r: 280, c: 'rgba(120,80,255,0.10)' },
        { x: w * 0.5, y: h * 0.3, r: 200, c: 'rgba(255,120,180,0.07)' }
      ];
      nebulas.forEach((n) => {
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        g.addColorStop(0, n.c);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });
      // stars
      stars.forEach((s) => {
        ctx.beginPath();
        ctx.arc(s.x % w, s.y % h, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,240,255,${0.4 + Math.sin(t * s.v) * 0.3})`;
        ctx.fill();
      });
      t += 0.05;
    }, 66);
  }

  /* ================= CLOCKS ================= */
  function startClocks() {
    updateUTC();
    clockTimer = setInterval(updateUTC, 1000);
  }
  function updateUTC() {
    const d = new Date();
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    $('utcClock').textContent = `${hh}:${mm}:${ss}`;
  }

  /* ================= ECG WAVEFORM ================= */
  function startECG() {
    const c = $('ecg');
    if (!c) return;
    const ctx = c.getContext('2d');
    const wave = new Array(30).fill(0);
    let idx = 0;
    ecgTimer = setInterval(() => {
      const W = c.width, H = c.height;
      idx++;
      const phase = (idx % 20) / 20;
      let v = 0;
      if (phase < 0.06) v = 1;
      else if (phase < 0.12) v = -0.35;
      else if (phase < 0.2) v = 0.55;
      else if (phase < 0.5) v = 0.08 * Math.sin(phase * 40);
      wave.shift();
      wave.push(v);

      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = '#ff4b6b';
      ctx.lineWidth = 1.4;
      ctx.shadowColor = '#ff4b6b';
      ctx.shadowBlur = 5;
      ctx.beginPath();
      const step = W / (wave.length - 1);
      wave.forEach((val, i) => {
        const x = i * step;
        const y = H / 2 - val * (H / 2 - 2);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    }, 60);
  }

  /* ================= UI HELPERS ================= */
  function toast(msg, ms = 2000) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), ms);
  }

  function showScreen(id) {
    document.querySelectorAll('.start-screen, .vision-screen').forEach((s) => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  /* ================= ENTER ================= */
  async function enterVision() {
    startScreen.classList.remove('active');
    visionScreen.classList.add('active');
    // Small delay to let layout settle, then request camera
    setTimeout(async () => {
      await startCamera('environment');
      startClocks();
      startECG();
    }, 200);
  }

  enterBtn.addEventListener('click', enterVision);

  /* ================= CONTROLS ================= */
  $('switchBtn').addEventListener('click', switchCamera);
  $('toggleBtn').addEventListener('click', toggleCamera);

  $('fsBtn').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        toast('FULLSCREEN ON');
      } else {
        await document.exitFullscreen();
        toast('FULLSCREEN OFF');
      }
    } catch {
      toast('FULLSCREEN UNAVAILABLE');
    }
  });

  $('exitBtn').addEventListener('click', () => {
    stopCamera();
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
    if (ecgTimer)   { clearInterval(ecgTimer);   ecgTimer = null; }
    visionScreen.classList.remove('active');
    startScreen.classList.add('active');
    toast('CAMERA STOPPED');
  });

  /* ================= LIFECYCLE CLEANUP ================= */
  window.addEventListener('pagehide', stopCamera);
  window.addEventListener('beforeunload', stopCamera);

})();
