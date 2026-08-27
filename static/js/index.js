document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {
  const revealItems = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -36px' },
    );

    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  const demoVideos = document.querySelectorAll('[data-demo-video]');

  demoVideos.forEach((video) => {
    if (!(video instanceof HTMLVideoElement)) return;

    const requestedRate = Number.parseFloat(video.dataset.playbackRate || '1');
    const playbackRate = Number.isFinite(requestedRate) && requestedRate > 0 ? requestedRate : 1;
    video.defaultPlaybackRate = playbackRate;
    video.playbackRate = playbackRate;
  });

  const syncReplayGroups = document.querySelectorAll('[data-sync-replay]');

  syncReplayGroups.forEach((group) => {
    const videos = [...group.querySelectorAll('video[data-demo-video]')].filter(
      (video) => video instanceof HTMLVideoElement,
    );

    if (videos.length < 2) return;

    const finishedVideos = new Set();

    videos.forEach((video) => {
      video.loop = false;

      video.addEventListener('play', () => {
        if (video.currentTime < 0.25) finishedVideos.delete(video);
      });

      video.addEventListener('ended', () => {
        finishedVideos.add(video);

        if (finishedVideos.size !== videos.length) return;

        videos.forEach((groupVideo) => {
          groupVideo.pause();
          groupVideo.currentTime = 0;
        });
        finishedVideos.clear();

        window.requestAnimationFrame(() => {
          videos.forEach((groupVideo) => groupVideo.play().catch(() => {}));
        });
      });
    });
  });

  if ('IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          if (!(video instanceof HTMLVideoElement)) return;

          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.35 },
    );

    demoVideos.forEach((video) => videoObserver.observe(video));
  }

  const asyncFlow = document.querySelector('[data-async-flow]');
  const flowToggle = document.querySelector('[data-flow-toggle]');
  const flowToggleLabel = document.querySelector('[data-flow-toggle-label]');
  const currentCellsRoot = document.querySelector('[data-current-cells]');
  const nextCellsRoot = document.querySelector('[data-next-cells]');
  const localCellsRoot = document.querySelector('[data-local-cells]');
  const overlapRegion = document.querySelector('[data-overlap-region]');
  const overlapLink = document.querySelector('[data-overlap-link]');
  const overlapBadge = document.querySelector('[data-overlap-badge]');
  const skipBadge = document.querySelector('[data-skip-badge]');
  const refreshProgress = document.querySelector('[data-refresh-progress]');
  const refreshBoundary = document.querySelector('[data-refresh-boundary]');
  const refreshConnector = document.querySelector('[data-refresh-connector]');
  const bridgeCard = document.querySelector('[data-bridge-card]');
  const bridgeSummary = document.querySelector('[data-bridge-summary]');
  const currentCaptions = [...document.querySelectorAll('[data-current-caption]')];
  const nextCaptions = [...document.querySelectorAll('[data-next-caption]')];
  const currentCaptionMasks = [...document.querySelectorAll('[data-current-caption-mask]')];
  const nextCaptionMasks = [...document.querySelectorAll('[data-next-caption-mask]')];
  const currentRoutes = [...document.querySelectorAll('[data-current-route]')];
  const currentRouteDots = [...document.querySelectorAll('[data-current-route-dot]')];
  const nextRoutes = [...document.querySelectorAll('[data-next-route]')];
  const nextRouteDots = [...document.querySelectorAll('[data-next-route-dot]')];
  const outputRoute = document.querySelector('[data-output-route]');
  const outputRouteDot = document.querySelector('[data-output-route-dot]');
  const localPlanLabel = document.querySelector('[data-local-plan-label]');
  const localExecutionDetail = document.querySelector('[data-local-execution-detail]');
  const sourceDots = {
    language: document.querySelector('[data-source-dot="language"]'),
    global: document.querySelector('[data-source-dot="global"]'),
    local: document.querySelector('[data-source-dot="local"]'),
    output: document.querySelector('[data-source-dot="output"]'),
  };

  if (
    asyncFlow
    && flowToggle
    && flowToggleLabel
    && currentCellsRoot
    && nextCellsRoot
    && localCellsRoot
  ) {
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cycleMs = 20000;
    const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

    const createTimelineCells = (root, count, startX, y, className) => {
      const cells = [];

      for (let cellIndex = 0; cellIndex < count; cellIndex += 1) {
        const cell = document.createElementNS(svgNamespace, 'rect');
        cell.setAttribute('x', String(startX + cellIndex * 18));
        cell.setAttribute('y', String(y));
        cell.setAttribute('width', '14');
        cell.setAttribute('height', '24');
        cell.setAttribute('rx', '4');
        cell.classList.add('flow-timeline-cell', className);
        root.appendChild(cell);
        cells.push(cell);
      }

      return cells;
    };

    const currentCells = createTimelineCells(
      currentCellsRoot,
      32,
      120,
      160,
      'flow-current-cell',
    );
    const nextCells = createTimelineCells(
      nextCellsRoot,
      32,
      552,
      250,
      'flow-next-cell',
    );
    const localCells = createTimelineCells(
      localCellsRoot,
      8,
      840,
      570,
      'flow-local-cell',
    );

    let manuallyPaused = reduceMotion;
    let inViewport = true;
    let pageVisible = !document.hidden;
    let isRunning = false;
    let elapsedBeforeRun = reduceMotion ? cycleMs * 0.72 : 0;
    let runStartedAt = performance.now();
    let animationFrame = 0;

    const elapsedTime = (now) => elapsedBeforeRun + (isRunning ? now - runStartedAt : 0);

    const setSourceDot = (dot, active, x) => {
      if (!dot) return;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('cx', String(x));
    };

    const syncCaption = (caption, mask, text, active, complete) => {
      const needsLayout = caption.textContent !== text
        || caption.classList.contains('is-source-active') !== active
        || caption.classList.contains('is-complete') !== complete
        || mask?.dataset.sized !== 'true';

      caption.textContent = text;
      caption.classList.toggle('is-source-active', active);
      caption.classList.toggle('is-complete', complete);

      if (!mask || !needsLayout) return;

      const bounds = caption.getBBox();
      mask.setAttribute('x', String(bounds.x - 7));
      mask.setAttribute('y', String(bounds.y - 2.5));
      mask.setAttribute('width', String(bounds.width + 14));
      mask.setAttribute('height', String(bounds.height + 5));
      mask.dataset.sized = 'true';
    };

    const renderFlow = (now) => {
      const elapsed = elapsedTime(now);
      const phase = (elapsed % cycleMs) / cycleMs;
      const currentExecutionIndex = phase < 0.12 ? 0 : phase < 0.24 ? 1 : phase < 0.64 ? 2 : -1;
      const currentChunk = currentExecutionIndex >= 0 ? currentExecutionIndex + 1 : -1;
      const refreshPhase = clamp((phase - 0.24) / 0.2);
      const refreshing = phase >= 0.24 && phase < 0.44;
      const nextPublished = phase >= 0.36;
      const overlapVisible = phase >= 0.44;
      const skipped = phase >= 0.53;
      const handoff = phase >= 0.64;
      const nextLocalPhase = handoff ? clamp((phase - 0.64) / 0.36) : 0;
      const nextLocalChunk = handoff ? Math.min(2, Math.floor(nextLocalPhase * 3)) : -1;
      const nextLocalChunkProgress = handoff
        ? Math.min(1, nextLocalPhase * 3 - nextLocalChunk)
        : 0;
      const localChunk = handoff ? nextLocalChunk : currentExecutionIndex;
      const cycleElapsed = elapsed % cycleMs;
      const currentChunkStart = currentExecutionIndex >= 0
        ? [0, 2400, 4800][currentExecutionIndex]
        : 0;
      const currentTransferProgress = currentExecutionIndex >= 0
        ? clamp((cycleElapsed - currentChunkStart) / 2400)
        : 0;
      const currentTransferActive = currentExecutionIndex >= 0 && currentTransferProgress < 1;
      const globalInputProgress = refreshing ? refreshPhase : 0;

      currentCells.forEach((cell, cellIndex) => {
        const chunk = Math.floor(cellIndex / 8);
        const isSkipped = chunk === 0;
        cell.classList.toggle('is-skipped', isSkipped);
        cell.classList.toggle('is-refined', !isSkipped && (currentChunk === -1 || chunk < currentChunk));
        cell.classList.toggle('is-active', !isSkipped && chunk === currentChunk);
      });

      currentCaptions.forEach((caption, captionIndex) => {
        if (captionIndex === 0) {
          syncCaption(
            caption,
            currentCaptionMasks[captionIndex],
            'Chunk 1 · skipped',
            false,
            true,
          );
          return;
        }

        const active = captionIndex === currentChunk;
        const complete = currentChunk === -1 || captionIndex < currentChunk;
        const text = active
          ? `Chunk ${captionIndex + 1} · sent to System 1`
          : complete
            ? `Chunk ${captionIndex + 1} · executed`
            : `Chunk ${captionIndex + 1}`;
        syncCaption(caption, currentCaptionMasks[captionIndex], text, active, complete);
      });

      currentRoutes.forEach((route, routeIndex) => {
        route.classList.toggle('is-active', !handoff && routeIndex === currentExecutionIndex);
      });

      currentRouteDots.forEach((dot, dotIndex) => {
        const active = !handoff
          && currentTransferActive
          && dotIndex === currentExecutionIndex;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('cy', String(active ? 190 + currentTransferProgress * 184 : 190));
      });

      nextCells.forEach((cell, cellIndex) => {
        const chunk = Math.floor(cellIndex / 8);
        const executableIndex = chunk - 1;
        cell.classList.toggle('is-generated', nextPublished);
        cell.classList.toggle('is-skipped', skipped && cellIndex < 8);
        cell.classList.toggle('is-consumed', handoff && chunk > 0 && executableIndex < nextLocalChunk);
        cell.classList.toggle('is-source-active', handoff && executableIndex === nextLocalChunk);
      });

      nextCaptions.forEach((caption, captionIndex) => {
        if (captionIndex === 0) {
          syncCaption(
            caption,
            nextCaptionMasks[captionIndex],
            skipped ? 'Chunk 1 · skipped' : 'Chunk 1',
            false,
            skipped,
          );
          return;
        }

        const executableIndex = captionIndex - 1;
        const active = handoff && executableIndex === nextLocalChunk;
        const complete = handoff && executableIndex < nextLocalChunk;
        const text = active
          ? `Chunk ${captionIndex + 1} · sent to System 1`
          : complete
            ? `Chunk ${captionIndex + 1} · executed`
            : `Chunk ${captionIndex + 1}`;
        syncCaption(caption, nextCaptionMasks[captionIndex], text, active, complete);
      });

      overlapRegion?.classList.toggle('is-visible', overlapVisible && !handoff);
      overlapLink?.classList.toggle('is-visible', overlapVisible && !handoff);
      overlapBadge?.classList.toggle('is-visible', overlapVisible && !skipped);
      skipBadge?.classList.toggle('is-visible', skipped);
      refreshProgress?.setAttribute('width', String(refreshPhase * 282));
      refreshBoundary?.classList.toggle('is-visible', refreshing);
      refreshConnector?.classList.toggle('is-visible', refreshing);

      nextRoutes.forEach((route, routeIndex) => {
        route.classList.toggle('is-visible', nextPublished);
        route.classList.toggle('is-active', handoff && routeIndex === nextLocalChunk);
      });

      nextRouteDots.forEach((dot, dotIndex) => {
        const active = handoff && dotIndex === nextLocalChunk;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('cy', String(active ? 292 + nextLocalChunkProgress * 82 : 292));
      });

      bridgeCard?.classList.toggle('is-active', currentExecutionIndex >= 0 || overlapVisible);

      if (bridgeSummary) {
        bridgeSummary.textContent = handoff
          ? `NEXT PLAN · CHUNK ${nextLocalChunk + 2} ALIGNED`
          : skipped
            ? 'SKIP 8 OVERLAPPED · FORWARD 24 VALID'
            : overlapVisible
              ? 'ALIGN WITH EXECUTED-ACTION INDEX'
              : `CURRENT PLAN · CHUNK ${currentChunk + 1} ALIGNED`;
      }

      localCells.forEach((cell) => {
        cell.classList.toggle('is-active', localChunk >= 0);
      });

      outputRoute?.classList.toggle('is-active', localChunk >= 0);
      const outputRouteDotActive = handoff
        ? localChunk >= 0
        : currentTransferActive;
      outputRouteDot?.classList.toggle('is-active', outputRouteDotActive);
      outputRouteDot?.setAttribute(
        'cy',
        String(
          outputRouteDotActive
            ? 474 + (handoff ? nextLocalChunkProgress : currentTransferProgress) * 34
            : 474,
        ),
      );

      if (localPlanLabel) {
        localPlanLabel.textContent = handoff
          ? `NEXT PLAN · CHUNK ${nextLocalChunk + 2}`
          : `CURRENT PLAN · CHUNK ${currentChunk + 1}`;
      }

      if (localExecutionDetail) {
        localExecutionDetail.textContent = handoff
          ? `next-plan Chunk ${nextLocalChunk + 2} executes in System 1`
          : `current-plan Chunk ${currentChunk + 1} executes in System 1`;
      }

      setSourceDot(sourceDots.language, refreshing, 262 + globalInputProgress * 32);
      setSourceDot(sourceDots.global, refreshing, 262 + globalInputProgress * 32);
      const system1DataActive = handoff ? localChunk >= 0 : currentTransferActive;
      const system1DataProgress = handoff ? nextLocalChunkProgress : currentTransferProgress;
      setSourceDot(
        sourceDots.local,
        system1DataActive,
        262 + system1DataProgress * 32,
      );
      setSourceDot(
        sourceDots.output,
        system1DataActive,
        1193 + system1DataProgress * 20,
      );
    };

    const renderFrame = (now) => {
      renderFlow(now);
      if (isRunning) animationFrame = window.requestAnimationFrame(renderFrame);
    };

    const updateToggle = () => {
      flowToggle.classList.toggle('is-paused', manuallyPaused);
      flowToggle.setAttribute('aria-pressed', String(manuallyPaused));
      flowToggleLabel.textContent = reduceMotion
        ? 'Motion reduced'
        : manuallyPaused
          ? 'Play animation'
          : 'Pause animation';
    };

    const syncPlayback = () => {
      const shouldRun = !manuallyPaused && inViewport && pageVisible && !reduceMotion;

      if (shouldRun === isRunning) {
        renderFlow(performance.now());
        return;
      }

      const now = performance.now();

      if (shouldRun) {
        runStartedAt = now;
        isRunning = true;
        window.cancelAnimationFrame(animationFrame);
        animationFrame = window.requestAnimationFrame(renderFrame);
      } else {
        if (isRunning) elapsedBeforeRun += now - runStartedAt;
        isRunning = false;
        window.cancelAnimationFrame(animationFrame);
        renderFlow(now);
      }
    };

    if (reduceMotion) {
      flowToggle.disabled = true;
      flowToggle.classList.add('is-paused');
      flowToggle.setAttribute('aria-pressed', 'true');
    } else {
      flowToggle.addEventListener('click', () => {
        manuallyPaused = !manuallyPaused;
        updateToggle();
        syncPlayback();
      });
    }

    if ('IntersectionObserver' in window) {
      const flowObserver = new IntersectionObserver(
        ([entry]) => {
          inViewport = entry.isIntersecting;
          syncPlayback();
        },
        { threshold: 0.15 },
      );
      flowObserver.observe(asyncFlow);
    }

    document.addEventListener('visibilitychange', () => {
      pageVisible = !document.hidden;
      syncPlayback();
    });

    updateToggle();
    renderFlow(performance.now());
    syncPlayback();

    document.fonts?.ready.then(() => {
      [...currentCaptionMasks, ...nextCaptionMasks].forEach((mask) => {
        delete mask.dataset.sized;
      });
      renderFlow(performance.now());
    });

    window.addEventListener('pagehide', () => {
      isRunning = false;
      window.cancelAnimationFrame(animationFrame);
    }, { once: true });
  }

  const copyButton = document.querySelector('[data-copy-bibtex]');
  const bibtexCode = document.getElementById('bibtex-code');

  if (copyButton && bibtexCode) {
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(bibtexCode.textContent.trim());
        copyButton.classList.add('has-copied');
        window.setTimeout(() => copyButton.classList.remove('has-copied'), 1800);
      } catch (error) {
        console.warn('Unable to copy the BibTeX citation.', error);
      }
    });
  }
});
