/**
 * ==========================================================================
 * GRESK // SCROLL-DRIVEN 3D CINEMATIC ENGINE
 * High-Performance Canvas Sequencer with Intelligent Streaming Buffer
 * Precise Frame-by-Frame Storytelling Timing & Interactive Navigation
 * ==========================================================================
 */

(() => {
  'use strict';

  // --- CONFIGURATION & CHAPTER DEFINITIONS ---
  const CHAPTERS = [
    { id: 1, key: '01 ENTRADA', name: '01 Entrada', prefix: '01_frame', count: 48, folder: '01 ENTRADA' },
    { id: 2, key: '02 INFOGRAFIA', name: '02 Infografía', prefix: '02_frame', count: 48, folder: '02 INFOGRAFIA' },
    { id: 3, key: '03 IA AUTO', name: '03 IA Autónoma', prefix: '03_frame', count: 48, folder: '03 IA AUTO' },
    { id: 4, key: '04 WEB', name: '04 Web Engine', prefix: '04_frame', count: 48, folder: '04 WEB' },
    { id: 5, key: '05 DESIGN', name: '05 Diseño 3D', prefix: '05_frame', count: 48, folder: '05 DESIGN' },
    { id: 6, key: '06 FIN CONTACTO', name: '06 Contacto', prefix: '06_frame', count: 48, folder: '06 FIN CONTACTO' }
  ];

  const TOTAL_FRAMES = 271; // Website sequence ends exactly at frame 271
  const INITIAL_BUFFER_COUNT = 24; // Fast startup
  const LOOKAHEAD_WINDOW = 35; // Frames to lookahead in streaming

  // Generate sequence URLs (up to frame 271)
  const RAW_URLS = [];
  CHAPTERS.forEach((ch) => {
    for (let i = 1; i <= ch.count; i++) {
      const pad = String(i).padStart(2, '0');
      RAW_URLS.push(`videos/${ch.folder}/${ch.prefix}${pad}.webp`);
    }
  });
  const FRAME_URLS = RAW_URLS.slice(0, TOTAL_FRAMES);

  // --- PRECISE CARD TIMINGS (Based on exact user instructions) ---
  // Frame indexing: 1-based matching user request (frame 1 to 288)
  const CARD_TIMINGS = [
    {
      id: 'card-bio',
      // Disappears by frame 17
      fadeInStart: 0,
      peakStart: 0,
      peakEnd: 11,
      fadeOutEnd: 17
    },
    {
      id: 'card-ia',
      // Appears before 95, fully visible at 95, disappeared by 123
      fadeInStart: 76,
      peakStart: 95,
      peakEnd: 114,
      fadeOutEnd: 123,
      menuFrame: 95
    },
    {
      id: 'card-web',
      // Starts at 124, fully visible at 147, disappeared by 155
      fadeInStart: 124,
      peakStart: 144,
      peakEnd: 148,
      fadeOutEnd: 155,
      menuFrame: 147
    },
    {
      id: 'card-design',
      // Starts at 156, fully visible at 183, disappeared by 210
      fadeInStart: 156,
      peakStart: 180,
      peakEnd: 196,
      fadeOutEnd: 210,
      menuFrame: 183
    },
    {
      id: 'card-ti',
      // Starts at 211, fully visible at 220, disappeared by 250
      fadeInStart: 211,
      peakStart: 220,
      peakEnd: 238,
      fadeOutEnd: 250,
      menuFrame: 220
    },
    {
      id: 'card-contacto',
      // Starts at 251, fully visible at 265, stays until the end (271)
      fadeInStart: 251,
      peakStart: 265,
      peakEnd: 271,
      fadeOutEnd: 271,
      menuFrame: 265
    }
  ];

  // --- DOM ELEMENTS ---
  const canvas = document.getElementById('scroll-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const preloader = document.getElementById('preloader');
  const loaderProgress = document.getElementById('loader-progress');
  const loaderPercent = document.getElementById('loader-percent');
  const loaderStatus = document.getElementById('loader-status');

  const frameCounterEl = document.getElementById('frame-counter');
  const scrubberFill = document.getElementById('scrubber-fill');
  const scrubberThumb = document.getElementById('scrubber-thumb');
  const scrubberTrackWrap = document.getElementById('scrubber-track-wrap');

  const navItemBtns = document.querySelectorAll('.nav-item-btn');
  const railNodes = document.querySelectorAll('.rail-node');
  const brandLogoBtn = document.getElementById('brand-logo-btn');
  const fullscreenBtn = document.getElementById('btn-fullscreen');
  const soundBtn = document.getElementById('btn-sound');
  const mobileMenuBtn = document.getElementById('btn-mobile-menu');
  const closeDrawerBtn = document.getElementById('btn-close-drawer');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const drawerItemBtns = document.querySelectorAll('.drawer-item-btn');

  // Cache card DOM references
  const cardElements = {};
  CARD_TIMINGS.forEach(timing => {
    cardElements[timing.id] = document.getElementById(timing.id);
  });

  // --- ENGINE STATE ---
  const framesCache = new Array(TOTAL_FRAMES).fill(null);
  const loadingStatus = new Array(TOTAL_FRAMES).fill(false);
  let loadedInitialCount = 0;
  let isExperienceReady = false;

  let targetProgress = 0; // 0.0 to 1.0
  let currentProgress = 0;
  let currentRenderedFrame = -1;
  let lastActiveService = null;
  let soundEnabled = false;

  // Web Audio feedback
  let audioCtx = null;
  function playHapticTone(freq = 440, duration = 0.04) {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  // --- CANVAS RESIZING (RETINA READY) ---
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    if (currentRenderedFrame >= 0 && framesCache[currentRenderedFrame]) {
      drawFrame(framesCache[currentRenderedFrame]);
    }
  }

  // --- FRAME RENDERING (RESPONSIVE ADAPTIVE) ---
  function drawFrame(img) {
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    const isMobilePortrait = (canvasWidth / canvasHeight) < 1.05;

    if (isMobilePortrait) {
      // 1. Fill base dark stage
      ctx.fillStyle = '#050608';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // 2. Ambient background pass: zoomed to cover, softened and darkened to provide dynamic glow
      const bgRatio = Math.max(canvasWidth / imgWidth, canvasHeight / imgHeight);
      const bgW = imgWidth * bgRatio;
      const bgH = imgHeight * bgRatio;
      const bgX = (canvasWidth - bgW) / 2;
      const bgY = (canvasHeight - bgH) / 2;

      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.drawImage(img, 0, 0, imgWidth, imgHeight, bgX, bgY, bgW, bgH);
      ctx.restore();

      // 3. Foreground video pass: full width 16:9, centered in upper viewing zone
      // 100% of the video content is visible without cutting off any details!
      const fitWidth = canvasWidth;
      const fitHeight = canvasWidth * (imgHeight / imgWidth);
      const fitX = 0;
      // Positioned below header (approx 70px) and leaving space for cards below
      const fitY = Math.max(68, Math.min(canvasHeight * 0.16, canvasHeight - fitHeight - 200));

      ctx.drawImage(img, 0, 0, imgWidth, imgHeight, fitX, fitY, fitWidth, fitHeight);
    } else {
      // Desktop: Edge-to-edge cinematic cover
      const hRatio = canvasWidth / imgWidth;
      const vRatio = canvasHeight / imgHeight;
      const ratio = Math.max(hRatio, vRatio);

      const destWidth = imgWidth * ratio;
      const destHeight = imgHeight * ratio;
      const destX = (canvasWidth - destWidth) / 2;
      const destY = (canvasHeight - destHeight) / 2;

      ctx.drawImage(img, 0, 0, imgWidth, imgHeight, destX, destY, destWidth, destHeight);
    }
  }

  // --- STREAMING BUFFER & SMART PRELOADER ---
  function loadSingleFrame(index, priority = false) {
    if (index < 0 || index >= TOTAL_FRAMES || framesCache[index] || loadingStatus[index]) {
      return;
    }

    loadingStatus[index] = true;
    const img = new Image();
    img.src = FRAME_URLS[index];

    img.onload = () => {
      framesCache[index] = img;
      loadingStatus[index] = false;

      if (!isExperienceReady) {
        loadedInitialCount++;
        const percent = Math.min(Math.round((loadedInitialCount / INITIAL_BUFFER_COUNT) * 100), 100);
        if (loaderProgress) loaderProgress.style.width = `${percent}%`;
        if (loaderPercent) loaderPercent.textContent = `${percent}%`;

        if (loadedInitialCount >= INITIAL_BUFFER_COUNT) {
          launchExperience();
        }
      } else {
        const desiredIndex = Math.min(Math.round(currentProgress * (TOTAL_FRAMES - 1)), TOTAL_FRAMES - 1);
        if (desiredIndex === index && currentRenderedFrame !== index) {
          drawFrame(img);
          currentRenderedFrame = index;
        }
      }
    };

    img.onerror = () => {
      loadingStatus[index] = false;
      console.warn(`Error loading frame ${index}: ${FRAME_URLS[index]}`);
    };
  }

  function updateStreamingBuffer(centerIndex) {
    for (let i = centerIndex; i <= Math.min(centerIndex + LOOKAHEAD_WINDOW, TOTAL_FRAMES - 1); i++) {
      if (!framesCache[i] && !loadingStatus[i]) {
        loadSingleFrame(i, true);
      }
    }
    for (let i = centerIndex - 1; i >= Math.max(centerIndex - 10, 0); i--) {
      if (!framesCache[i] && !loadingStatus[i]) {
        loadSingleFrame(i, false);
      }
    }
  }

  function idleBackgroundPreload() {
    let nextIndex = 0;
    const interval = setInterval(() => {
      if (nextIndex >= TOTAL_FRAMES) {
        clearInterval(interval);
        return;
      }
      if (!framesCache[nextIndex] && !loadingStatus[nextIndex]) {
        loadSingleFrame(nextIndex, false);
      }
      nextIndex++;
    }, 40);
  }

  function launchExperience() {
    isExperienceReady = true;
    if (loaderStatus) loaderStatus.textContent = 'Gresk Studio listo.';
    if (preloader) preloader.classList.add('loaded');

    if (framesCache[0]) {
      drawFrame(framesCache[0]);
      currentRenderedFrame = 0;
    }

    updateStreamingBuffer(0);
    setTimeout(idleBackgroundPreload, 1000);
  }

  // --- RENDER LOOP (60FPS SMOOTH LERP) ---
  function renderLoop() {
    if (isExperienceReady) {
      if (!isNavigating) {
        // Damped smooth spring for manual scrolling
        const diff = targetProgress - currentProgress;
        currentProgress += diff * 0.085;
      }

      const frameFloat = currentProgress * (TOTAL_FRAMES - 1);
      const targetIndex = Math.max(0, Math.min(Math.round(frameFloat), TOTAL_FRAMES - 1));

      // Draw canvas frame
      if (targetIndex !== currentRenderedFrame) {
        let frameToDraw = framesCache[targetIndex];
        if (!frameToDraw) {
          for (let offset = 1; offset <= 20; offset++) {
            if (framesCache[targetIndex - offset]) {
              frameToDraw = framesCache[targetIndex - offset];
              break;
            }
            if (framesCache[targetIndex + offset]) {
              frameToDraw = framesCache[targetIndex + offset];
              break;
            }
          }
        }

        if (frameToDraw) {
          drawFrame(frameToDraw);
          currentRenderedFrame = targetIndex;
        }

        updateStreamingBuffer(targetIndex);
      }

      // Update UI & Card transitions
      updateUIAndCards(currentProgress, frameFloat + 1); // 1-based frame for timing calculations
    }

    requestAnimationFrame(renderLoop);
  }

  // --- SMOOTH CARD TRANSITIONS & HUD UPDATE ---
  function updateUIAndCards(progress, currentFrameNumber) {
    // 1. Scrubber
    const pct = Math.max(0, Math.min(progress * 100, 100));
    if (scrubberFill) scrubberFill.style.width = `${pct}%`;
    if (scrubberThumb) scrubberThumb.style.left = `${pct}%`;

    // 2. Header Frame Counter
    if (frameCounterEl) {
      const displayFrame = Math.max(1, Math.min(Math.round(currentFrameNumber), TOTAL_FRAMES));
      frameCounterEl.textContent = `FRAME ${String(displayFrame).padStart(3, '0')} / ${TOTAL_FRAMES}`;
    }

    // 3. Precise Card Opacity & Transform Interpolation
    let activeServiceId = null;

    CARD_TIMINGS.forEach(timing => {
      const el = cardElements[timing.id];
      if (!el) return;

      let opacity = 0;
      let translateY = 30;

      if (currentFrameNumber >= timing.fadeInStart && currentFrameNumber <= timing.fadeOutEnd) {
        if (currentFrameNumber < timing.peakStart) {
          // Fade in
          const range = timing.peakStart - timing.fadeInStart;
          const t = range > 0 ? (currentFrameNumber - timing.fadeInStart) / range : 1;
          opacity = t;
          translateY = (1 - t) * 30;
        } else if (currentFrameNumber <= timing.peakEnd) {
          // Fully visible (Peak)
          opacity = 1;
          translateY = 0;
          if (timing.menuFrame) activeServiceId = timing.menuFrame;
        } else {
          // Fade out
          const range = timing.fadeOutEnd - timing.peakEnd;
          const t = range > 0 ? (currentFrameNumber - timing.peakEnd) / range : 1;
          opacity = 1 - t;
          translateY = -t * 20; // gentle float upward as it vanishes
        }
      }

      // Apply styles
      if (opacity > 0.01) {
        el.style.opacity = opacity.toFixed(3);
        el.style.transform = `translateY(${translateY.toFixed(1)}px) scale(${0.97 + opacity * 0.03})`;
        el.style.visibility = 'visible';
        el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
        el.classList.add('active');
      } else {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px) scale(0.97)';
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
        el.classList.remove('active');
      }
    });

    // 4. Update Active Menu & Timeline Dots
    if (activeServiceId !== lastActiveService) {
      lastActiveService = activeServiceId;
      if (activeServiceId) playHapticTone(520, 0.04);

      // Top Menu buttons active state
      navItemBtns.forEach(btn => {
        const frameTarget = parseInt(btn.getAttribute('data-target-frame'), 10);
        if (frameTarget === activeServiceId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Drawer buttons active state
      drawerItemBtns.forEach(btn => {
        const frameTarget = parseInt(btn.getAttribute('data-target-frame'), 10);
        if (frameTarget === activeServiceId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Timeline Rail dots active state
      railNodes.forEach(node => {
        const frameTarget = parseInt(node.getAttribute('data-target-frame'), 10);
        if (frameTarget === activeServiceId || (activeServiceId === null && frameTarget === 0)) {
          node.classList.add('active');
        } else {
          node.classList.remove('active');
        }
      });
    }
  }

  // --- CINEMATIC PROGRAMMATIC NAVIGATION ---
  let navAnim = null;
  let isNavigating = false;

  function stopAutoNav() {
    if (isNavigating) {
      isNavigating = false;
      if (navAnim) {
        cancelAnimationFrame(navAnim);
        navAnim = null;
      }
    }
  }

  // Smooth cinematic ease: gentle start, stable cruise, graceful settling
  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  function scrollToFrame(frameNumber) {
    stopAutoNav();

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const startProgress = currentProgress;
    const targetRatio = Math.max(0, Math.min(frameNumber / (TOTAL_FRAMES - 1), 1));
    const endProgress = targetRatio;

    const frameDiff = Math.abs(endProgress - startProgress) * (TOTAL_FRAMES - 1);
    if (frameDiff < 0.2) return;

    // Human-speed cinematic pacing (relaxed & clear):
    // ~50ms per frame (~20 fps playback rate).
    // Traverses full sequence (0 to 265) in ~13 seconds, giving the user ample time
    // to appreciate the 3D animation, lighting, text and models without overwhelming blur.
    // Transitions between adjacent sections take ~1.8s to ~2.6s.
    const msPerFrame = 50;
    const duration = Math.min(Math.max(frameDiff * msPerFrame, 1100), 13500);

    const startTime = performance.now();
    isNavigating = true;

    // Proactively preload frames ahead in the travel direction
    const currentIdx = Math.round(startProgress * (TOTAL_FRAMES - 1));
    const targetIdx = Math.round(endProgress * (TOTAL_FRAMES - 1));
    const stepDir = targetIdx > currentIdx ? 1 : -1;
    for (let k = 0; k < Math.min(45, Math.abs(targetIdx - currentIdx)); k++) {
      const idxToLoad = currentIdx + (k * stepDir);
      if (idxToLoad >= 0 && idxToLoad < TOTAL_FRAMES) {
        loadSingleFrame(idxToLoad, true);
      }
    }

    playHapticTone(660, 0.06);

    function navStep(now) {
      if (!isNavigating) return;

      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easedT = easeInOutSine(t);

      const progress = startProgress + (endProgress - startProgress) * easedT;
      targetProgress = progress;
      currentProgress = progress;

      // Synchronize native window scroll position so scrubber and page match
      if (maxScroll > 0) {
        window.scrollTo(0, progress * maxScroll);
      }

      if (t < 1) {
        navAnim = requestAnimationFrame(navStep);
      } else {
        isNavigating = false;
        navAnim = null;
        targetProgress = endProgress;
        currentProgress = endProgress;
        if (maxScroll > 0) {
          window.scrollTo(0, endProgress * maxScroll);
        }
      }
    }

    navAnim = requestAnimationFrame(navStep);
  }

  // --- EVENT LISTENERS ---

  // User interruption handlers (stops auto-flight if user manually scrolls, touches or drags)
  window.addEventListener('wheel', stopAutoNav, { passive: true });
  window.addEventListener('touchstart', (e) => {
    if (!e.target.closest('.nav-item-btn, .drawer-item-btn, .rail-node, #brand-logo-btn, .mobile-menu-btn')) {
      stopAutoNav();
    }
  }, { passive: true });
  window.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.nav-item-btn, .drawer-item-btn, .rail-node, #brand-logo-btn, .mobile-menu-btn')) {
      stopAutoNav();
    }
  });

  // 1. Top Menu button clicks
  navItemBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetFrame = parseInt(btn.getAttribute('data-target-frame'), 10);
      scrollToFrame(targetFrame);
    });
  });

  // Mobile drawer controls
  if (mobileMenuBtn && mobileDrawer) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileDrawer.classList.add('open');
      playHapticTone(520, 0.04);
    });
  }

  if (closeDrawerBtn && mobileDrawer) {
    closeDrawerBtn.addEventListener('click', () => {
      mobileDrawer.classList.remove('open');
    });
  }

  drawerItemBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetFrame = parseInt(btn.getAttribute('data-target-frame'), 10);
      if (mobileDrawer) mobileDrawer.classList.remove('open');
      scrollToFrame(targetFrame);
    });
  });

  // 2. Timeline rail clicks
  railNodes.forEach(node => {
    node.addEventListener('click', (e) => {
      e.preventDefault();
      const targetFrame = parseInt(node.getAttribute('data-target-frame'), 10);
      scrollToFrame(targetFrame);
    });
  });

  // 3. Logo click (scroll to top)
  if (brandLogoBtn) {
    brandLogoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToFrame(0);
    });
  }

  // 4. Native window scroll
  window.addEventListener('scroll', () => {
    if (isNavigating) return; // Prevent scroll event from fighting cinematic nav loop
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;
    targetProgress = Math.max(0, Math.min(window.scrollY / maxScroll, 1));
  }, { passive: true });

  // 5. Scrubber interaction
  let isDraggingScrubber = false;
  function handleScrubber(e) {
    const rect = scrubberTrackWrap.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({
      top: ratio * maxScroll,
      behavior: 'auto'
    });
    targetProgress = ratio;
  }

  if (scrubberTrackWrap) {
    scrubberTrackWrap.addEventListener('mousedown', (e) => {
      isDraggingScrubber = true;
      handleScrubber(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (isDraggingScrubber) handleScrubber(e);
    });
    window.addEventListener('mouseup', () => {
      isDraggingScrubber = false;
    });

    scrubberTrackWrap.addEventListener('touchstart', (e) => {
      isDraggingScrubber = true;
      handleScrubber(e);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (isDraggingScrubber) handleScrubber(e);
    }, { passive: true });
    window.addEventListener('touchend', () => {
      isDraggingScrubber = false;
    });
  }

  // 6. Keyboard navigation
  window.addEventListener('keydown', (e) => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const step = maxScroll / (TOTAL_FRAMES / 4);

    switch (e.key) {
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
        e.preventDefault();
        window.scrollBy({ top: step, behavior: 'smooth' });
        break;
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault();
        window.scrollBy({ top: -step, behavior: 'smooth' });
        break;
      case 'Home':
        e.preventDefault();
        scrollToFrame(0);
        break;
      case 'End':
        e.preventDefault();
        scrollToFrame(TOTAL_FRAMES - 1);
        break;
    }
  });

  // 7. Fullscreen & Sound
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundBtn.style.opacity = soundEnabled ? '1' : '0.5';
      soundBtn.style.borderColor = soundEnabled ? 'var(--accent-cyan)' : 'var(--surface-glass-border)';
      if (soundEnabled) playHapticTone(600, 0.08);
    });
  }

  // --- INITIALIZATION ---
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  for (let i = 0; i < INITIAL_BUFFER_COUNT; i++) {
    loadSingleFrame(i, true);
  }

  renderLoop();

})();
