/**
 * ==========================================================================
 * GRESK // SCROLL-DRIVEN 3D CINEMATIC ENGINE
 * High-Performance Canvas Sequencer with Intelligent Streaming Buffer
 * Precise Frame-by-Frame Storytelling Timing & Interactive Navigation
 * Optimized for Mobile (Memory Bounded, Solid 60FPS & Unified Full Bleed)
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
  const INITIAL_BUFFER_COUNT = 20; // Fast initial startup
  const LOOKAHEAD_WINDOW = 32; // Frames to lookahead in streaming (desktop)
  const CHAPTER_MILESTONES = [0, 95, 147, 183, 220, 265];

  // Speed calibration (5% faster than previous base: 47.6ms per frame = ~21 frames/sec)
  const MS_PER_FRAME = 47.6;
  const MAX_PROGRESS_PER_SEC = (1000 / MS_PER_FRAME) / (TOTAL_FRAMES - 1); // ~0.0778 / sec
  const MAX_SCROLL_LEAD = 42 / (TOTAL_FRAMES - 1); // Max ~42 frames advance on a violent swipe/flick

  // Mobile detection helper
  const isMobile = () => window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth <= 1024);

  // Generate sequence URLs (up to frame 271)
  const RAW_URLS = [];
  CHAPTERS.forEach((ch) => {
    for (let i = 1; i <= ch.count; i++) {
      const pad = String(i).padStart(2, '0');
      RAW_URLS.push(`videos/${ch.folder}/${ch.prefix}${pad}.webp`);
    }
  });
  const FRAME_URLS = RAW_URLS.slice(0, TOTAL_FRAMES);

  // --- PRECISE CARD TIMINGS ---
  // Frame indexing: 1-based matching user request (frame 1 to 271)
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

  // Mobile Gh0ulos-Style Navigation Controls
  const mobileBtnPrev = document.getElementById('mobile-btn-prev');
  const mobileBtnNext = document.getElementById('mobile-btn-next');
  const mobileCurrentChapter = document.getElementById('mobile-current-chapter');

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

  // --- CANVAS RESIZING (RETINA & MOBILE BALANCED) ---
  function resizeCanvas() {
    const mobile = isMobile();
    // Use 1.5 dpr on mobile to preserve 60fps fill-rate and keep memory lightweight
    const dpr = mobile
      ? Math.min(window.devicePixelRatio || 1, 1.5)
      : Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    if (currentRenderedFrame >= 0 && framesCache[currentRenderedFrame]) {
      drawFrame(framesCache[currentRenderedFrame]);
    }
  }

  // --- FRAME RENDERING (UNIFIED FULL-BLEED COVER ON ALL DEVICES) ---
  function drawFrame(img) {
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    // Center-crop Cover mode: fills the entire screen seamlessly on all devices (gh0ulos aesthetic)
    // No duplicate passes, no split views, 100% immersive 3D background
    const ratio = Math.max(canvasWidth / imgWidth, canvasHeight / imgHeight);
    const destWidth = imgWidth * ratio;
    const destHeight = imgHeight * ratio;
    const destX = (canvasWidth - destWidth) / 2;
    const destY = (canvasHeight - destHeight) / 2;

    ctx.drawImage(img, 0, 0, imgWidth, imgHeight, destX, destY, destWidth, destHeight);
  }

  // --- STREAMING BUFFER & SMART PRELOADER (WITH MOBILE MEMORY PRUNING) ---
  function loadSingleFrame(index, priority = false) {
    if (index < 0 || index >= TOTAL_FRAMES || framesCache[index] || loadingStatus[index]) {
      return;
    }

    loadingStatus[index] = true;
    const img = new Image();
    img.decoding = 'async'; // Offload decoding to background thread to eliminate main-thread stutter
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
    const mobile = isMobile();
    const lookahead = mobile ? 22 : LOOKAHEAD_WINDOW;
    const behind = mobile ? 8 : 12;

    // 1. Proactively stream forward frames
    for (let i = centerIndex; i <= Math.min(centerIndex + lookahead, TOTAL_FRAMES - 1); i++) {
      if (!framesCache[i] && !loadingStatus[i]) {
        loadSingleFrame(i, true);
      }
    }
    // 2. Proactively stream backward frames
    for (let i = centerIndex - 1; i >= Math.max(centerIndex - behind, 0); i--) {
      if (!framesCache[i] && !loadingStatus[i]) {
        loadSingleFrame(i, false);
      }
    }

    // 3. Mobile Memory Safeguard: Release unneeded textures outside current sliding window
    // Keeps mobile RAM consumption lean (<250MB) and completely prevents browser tab crashes or stutters
    if (mobile) {
      const purgeMarginBefore = 12;
      const purgeMarginAfter = 34;
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        if ((i < centerIndex - purgeMarginBefore || i > centerIndex + purgeMarginAfter) && framesCache[i]) {
          framesCache[i].src = '';
          framesCache[i] = null;
          loadingStatus[i] = false;
        }
      }
    }
  }

  function idleBackgroundPreload() {
    // On mobile touch devices, keep sliding window to avoid blowing up texture memory
    if (isMobile()) return;

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

  // --- RENDER LOOP (SPEED GOVERNED & CAPPED PLAYBACK) ---
  let lastRenderTime = performance.now();

  function renderLoop(now) {
    if (!now) now = performance.now();
    const deltaSeconds = Math.min(Math.max((now - lastRenderTime) / 1000, 0.001), 0.1);
    lastRenderTime = now;

    if (isExperienceReady) {
      if (!isNavigating) {
        const diff = targetProgress - currentProgress;
        if (Math.abs(diff) > 0.00002) {
          // Speed Governor: maximum playback speed cannot exceed 5% faster rate (~21 frames/sec)
          // Even with a sudden violent scroll, animation glides at the readable calibrated speed!
          const maxStep = MAX_PROGRESS_PER_SEC * deltaSeconds;
          let step = diff * 0.12;
          if (Math.abs(step) > maxStep) {
            step = Math.sign(step) * maxStep;
          }
          currentProgress += step;
        } else {
          currentProgress = targetProgress;
        }
      }

      const frameFloat = currentProgress * (TOTAL_FRAMES - 1);
      const targetIndex = Math.max(0, Math.min(Math.round(frameFloat), TOTAL_FRAMES - 1));

      // Draw canvas frame
      if (targetIndex !== currentRenderedFrame) {
        let frameToDraw = framesCache[targetIndex];
        if (!frameToDraw) {
          // Nearest cached fallback to maintain uninterrupted visuals
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

  // --- CHAPTER DETECTION HELPER ---
  function getChapterIndexFromFrame(frameNum) {
    if (frameNum < 55) return 0;   // Bio (Milestone 0)
    if (frameNum < 125) return 1;  // IA & Auto (Milestone 95)
    if (frameNum < 165) return 2;  // Web (Milestone 147)
    if (frameNum < 205) return 3;  // Design (Milestone 183)
    if (frameNum < 245) return 4;  // TI (Milestone 220)
    return 5;                      // Contacto (Milestone 265)
  }

  // --- SMOOTH CARD TRANSITIONS & HUD UPDATE ---
  function updateUIAndCards(progress, currentFrameNumber) {
    // 1. Scrubber (Desktop)
    const pct = Math.max(0, Math.min(progress * 100, 100));
    if (scrubberFill) scrubberFill.style.width = `${pct}%`;
    if (scrubberThumb) scrubberThumb.style.left = `${pct}%`;

    // 2. Header Frame Counter
    if (frameCounterEl) {
      const displayFrame = Math.max(1, Math.min(Math.round(currentFrameNumber), TOTAL_FRAMES));
      frameCounterEl.textContent = `FRAME ${String(displayFrame).padStart(3, '0')} / ${TOTAL_FRAMES}`;
    }

    // 3. Mobile Arrow Navigation Indicator & States
    const chIdx = getChapterIndexFromFrame(currentFrameNumber);
    if (mobileCurrentChapter) {
      mobileCurrentChapter.textContent = String(chIdx + 1).padStart(2, '0');
    }
    if (mobileBtnPrev) {
      mobileBtnPrev.classList.toggle('disabled', chIdx === 0);
    }
    if (mobileBtnNext) {
      mobileBtnNext.classList.toggle('disabled', chIdx === CHAPTER_MILESTONES.length - 1);
    }

    // 4. Precise Card Opacity & Transform Interpolation
    let activeServiceId = null;

    CARD_TIMINGS.forEach(timing => {
      const el = cardElements[timing.id];
      if (!el) return;

      let opacity = 0;
      let translateY = 24;

      if (currentFrameNumber >= timing.fadeInStart && currentFrameNumber <= timing.fadeOutEnd) {
        if (currentFrameNumber < timing.peakStart) {
          // Fade in
          const range = timing.peakStart - timing.fadeInStart;
          const t = range > 0 ? (currentFrameNumber - timing.fadeInStart) / range : 1;
          opacity = t;
          translateY = (1 - t) * 24;
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
          translateY = -t * 18; // gentle float upward as it vanishes
        }
      }

      // Apply styles
      if (opacity > 0.01) {
        el.style.opacity = opacity.toFixed(3);
        el.style.transform = `translateY(${translateY.toFixed(1)}px) scale(${0.98 + opacity * 0.02})`;
        el.style.visibility = 'visible';
        el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
        el.classList.add('active');
      } else {
        el.style.opacity = '0';
        el.style.transform = 'translateY(24px) scale(0.98)';
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
        el.classList.remove('active');
      }
    });

    // 5. Update Active Menu & Timeline Dots
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

    // Calibrated cinematic pacing: 5% faster (47.6ms per frame vs 50ms)
    const msPerFrame = MS_PER_FRAME;
    const duration = Math.min(Math.max(frameDiff * msPerFrame, 1050), 12800);

    const startTime = performance.now();
    isNavigating = true;

    // Proactively preload frames around target destination
    const currentIdx = Math.round(startProgress * (TOTAL_FRAMES - 1));
    const targetIdx = Math.round(endProgress * (TOTAL_FRAMES - 1));
    const stepDir = targetIdx > currentIdx ? 1 : -1;
    for (let k = 0; k < Math.min(45, Math.abs(targetIdx - currentIdx)); k++) {
      const idxToLoad = currentIdx + (k * stepDir);
      if (idxToLoad >= 0 && idxToLoad < TOTAL_FRAMES) {
        loadSingleFrame(idxToLoad, true);
      }
    }
    // Also preload destination landing window
    for (let j = Math.max(0, targetIdx - 6); j <= Math.min(TOTAL_FRAMES - 1, targetIdx + 12); j++) {
      loadSingleFrame(j, true);
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
    if (!e.target.closest('.nav-item-btn, .drawer-item-btn, .rail-node, #brand-logo-btn, .mobile-menu-btn, .mobile-nav-arrow-btn')) {
      stopAutoNav();
    }
  }, { passive: true });
  window.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.nav-item-btn, .drawer-item-btn, .rail-node, #brand-logo-btn, .mobile-menu-btn, .mobile-nav-arrow-btn')) {
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

  // 2. Mobile Gh0ulos-Style Arrow Navigation Buttons
  if (mobileBtnPrev) {
    mobileBtnPrev.addEventListener('click', (e) => {
      e.preventDefault();
      const currentFrame = currentProgress * (TOTAL_FRAMES - 1);
      const chIdx = getChapterIndexFromFrame(currentFrame);
      const targetIdx = Math.max(0, chIdx - 1);
      scrollToFrame(CHAPTER_MILESTONES[targetIdx]);
    });
  }

  if (mobileBtnNext) {
    mobileBtnNext.addEventListener('click', (e) => {
      e.preventDefault();
      const currentFrame = currentProgress * (TOTAL_FRAMES - 1);
      const chIdx = getChapterIndexFromFrame(currentFrame);
      const targetIdx = Math.min(CHAPTER_MILESTONES.length - 1, chIdx + 1);
      scrollToFrame(CHAPTER_MILESTONES[targetIdx]);
    });
  }

  // 3. Horizontal Touch Swipe Gestures for Mobile
  let touchStartX = 0;
  let touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 0) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;

    // Detect intentional horizontal swipe (distance > 50px, mostly horizontal)
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      const currentFrame = currentProgress * (TOTAL_FRAMES - 1);
      const chIdx = getChapterIndexFromFrame(currentFrame);
      if (deltaX < 0) {
        // Swipe left -> Next chapter
        const targetIdx = Math.min(CHAPTER_MILESTONES.length - 1, chIdx + 1);
        scrollToFrame(CHAPTER_MILESTONES[targetIdx]);
      } else {
        // Swipe right -> Previous chapter
        const targetIdx = Math.max(0, chIdx - 1);
        scrollToFrame(CHAPTER_MILESTONES[targetIdx]);
      }
    }
  }, { passive: true });

  // 4. Timeline rail clicks (Desktop)
  railNodes.forEach(node => {
    node.addEventListener('click', (e) => {
      e.preventDefault();
      const targetFrame = parseInt(node.getAttribute('data-target-frame'), 10);
      scrollToFrame(targetFrame);
    });
  });

  // 5. Logo click (scroll to top)
  if (brandLogoBtn) {
    brandLogoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToFrame(0);
    });
  }

  // 6. Native window scroll with Violent Scroll Brake / Speed Governor
  let isSyncingScroll = false;
  window.addEventListener('scroll', () => {
    if (isNavigating || isSyncingScroll) return; // Prevent fighting during auto flight or governor sync
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;

    const rawProgress = Math.max(0, Math.min(window.scrollY / maxScroll, 1));
    const lead = rawProgress - currentProgress;

    // Rule: Do not permit an abrupt/violent scroll flick to rush all the way to the end "de un solo golpe"
    if (Math.abs(lead) > MAX_SCROLL_LEAD) {
      targetProgress = currentProgress + Math.sign(lead) * MAX_SCROLL_LEAD;
      isSyncingScroll = true;
      window.scrollTo(0, targetProgress * maxScroll);
      setTimeout(() => { isSyncingScroll = false; }, 25);
    } else {
      targetProgress = rawProgress;
    }
  }, { passive: false });

  // 7. Scrubber interaction (Desktop)
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

  // 8. Keyboard navigation
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

  // 9. Fullscreen & Sound
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
