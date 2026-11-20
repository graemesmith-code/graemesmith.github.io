(() => {
    const portrait = matchMedia('(max-width: 730px), (max-height: 540px), (prefers-reduced-motion: reduce)');
    let motionFrame = 0, scrollFrame = 0, wideActive = false;
    const layerValley = document.getElementById('layer-valley');
    const layerClear  = document.getElementById('layer-clear');
    const layerFog    = document.getElementById('layer-fog');
    const layerSnow   = document.getElementById('layer-snow');
    const layerStorm  = document.getElementById('layer-storm');
    const layerByst   = document.getElementById('layer-byst');
    const layerChart  = document.getElementById('layer-chart');
    const fadeLayers  = [layerFog, layerSnow, layerStorm, layerByst, layerChart];

    const gimbal0 = document.getElementById('gimbal-0');
    const gimbal1 = document.getElementById('gimbal-1');
    const hoverGimbals = [2, 3, 4, 5].map(i => document.getElementById('gimbal-' + i));
    const segs = [0, 1, 2, 3, 4, 5, 6, 7].map(i => document.getElementById('seg-' + i));

    const edHud = document.getElementById('ed-hud');
    const stepNum = document.getElementById('step-num');
    const stepSub = document.getElementById('step-sub');
    const stepHeadline = document.getElementById('step-headline');
    const topTag = document.getElementById('top-tag');
    const bottomCap = document.getElementById('bottom-cap');
    const metaChips = document.getElementById('meta-chips');
    const scrollCue = document.getElementById('scroll-cue');

    const s1Svg = document.getElementById('s1-svg');
    const s1Path = document.getElementById('s1-path');
    const s1Halo = document.getElementById('s1-halo');
    const clearLockGroup = document.getElementById('clear-lock-group');
    const clearBoxT1 = document.getElementById('clear-box-t1');
    const clearBoxT2 = document.getElementById('clear-box-t2');
    const bAction = document.getElementById('b-action');
    const bars = [0, 1, 2, 3, 4].map(i => document.getElementById('bar-' + i));
    const barTargets = [98, 100, 97, 6, 92];

    const methodOpenBtn = document.getElementById('method-open-btn');
    const methodCloseBtn = document.getElementById('method-close-btn');
    const methodDrawer = document.getElementById('method-drawer');

    methodOpenBtn.addEventListener('click', () => {
      methodDrawer.inert = false;
      methodDrawer.classList.add('open');
      methodOpenBtn.setAttribute('aria-expanded', 'true');
      methodCloseBtn.focus({preventScroll:true});
    });
    methodCloseBtn.addEventListener('click', () => {
      methodDrawer.inert = true;
      methodDrawer.classList.remove('open');
      methodOpenBtn.setAttribute('aria-expanded', 'false');
      methodOpenBtn.focus({preventScroll:true});
    });

    methodDrawer.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') methodCloseBtn.click();
    });

    // 8 slide bounds along scroll 0..1
    const BOUNDS = [0.00, 0.16, 0.28, 0.38, 0.49, 0.60, 0.71, 0.88, 1.00];

    // Gentle hover poses for Slides 4–7 (Slides 1–3 use continuous optical zoom!)
    const HOVER_POSES = {
      3: { tx:  0.6, ty: -0.4, rz:  0.3,  sc: 1.08 },
      4: { tx: -0.8, ty:  0.4, rz: -0.3,  sc: 1.07 },
      5: { tx:  0.7, ty:  0.3, rz:  0.3,  sc: 1.07 },
      6: { tx:  0.5, ty: -0.3, rz:  0.22, sc: 1.06 }
    };

    const curPose = { tx: 0, ty: 0, rz: 0, sc: 1.07 };
    let tgtPose = { tx: 0, ty: 0, rz: 0, sc: 1.07 };

    // Continuous zoom state for Slides 1 -> 2 -> 3
    let zoomProgress = 0; // 0 = high altitude wide valley, 1 = zoomed in onto radar truck
    let activeSlide = 0;
    let barsShown = false;
    let clock = 0;

    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function smoothstep(x) { const c = clamp01(x); return c * c * (3 - 2 * c); }

    function setFadeLayer(target) {
      fadeLayers.forEach(l => {
        l.classList.toggle('active', l === target);
        l.inert = l !== target;
      });
    }

    function setTone(tone) {
      topTag.classList.remove('tone-sage', 'tone-red');
      bottomCap.classList.remove('tone-sage', 'tone-red');
      if (tone) {
        topTag.classList.add(tone);
        bottomCap.classList.add(tone);
      }
    }

    function setMeta(items) {
      metaChips.innerHTML = items.map(t => `<span class="meta-chip">${t}</span>`).join('');
    }

    function onScroll() {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = clamp01(window.scrollY / maxScroll);

      for (let i = 0; i < 8; i++) {
        const local = clamp01((p - BOUNDS[i]) / (BOUNDS[i + 1] - BOUNDS[i]));
        segs[i].style.width = (local * 100).toFixed(1) + '%';
        segs[i].style.background = i >= 6 ? '#b2322a' : '#2c3e50';
      }

      let s = 7;
      for (let i = 0; i < 8; i++) {
        if (p < BOUNDS[i + 1]) { s = i; break; }
      }
      activeSlide = s;
      edHud.style.opacity = s === 7 ? '0' : '1';

      // Close methodology drawer if user scrolls back up out of Slide 8
      if (s !== 7 && methodDrawer.classList.contains('open')) {
        methodDrawer.inert = true;
        methodDrawer.classList.remove('open');
        methodOpenBtn.setAttribute('aria-expanded', 'false');
      }

      // ================================================================
      // CONTINUOUS REALISTIC OPTICAL ZOOM (Slide 1 -> Slide 2 -> Slide 3)
      // p = 0.00..0.11: High-altitude lawnmower search sweeps empty valley
      // p = 0.11..0.23: Smooth continuous descent & 2.5x optical zoom
      //                 into the road as the mobile radar comes into focus!
      // p = 0.23..0.38: Rock-steady radar view (Slide 2 -> Slide 3 no shift!)
      // ================================================================
      const searchT = clamp01(p / 0.11);
      const off = Math.round(2350 * (1 - searchT));
      s1Path.style.strokeDashoffset = off;
      s1Halo.style.strokeDashoffset = off;

      const zRaw = clamp01((p - 0.11) / 0.12);
      zoomProgress = smoothstep(zRaw);

      // Fade out lawnmower lines cleanly as descent starts
      s1Svg.style.opacity = (1 - smoothstep((p - 0.105) / 0.045)).toFixed(3);

      // Smoothly cross-fade high-altitude valley -> close-up radar during active descent!
      if (s <= 2) {
        setFadeLayer(null);
        const clearAlpha = smoothstep((zRaw - 0.30) / 0.62);
        layerValley.style.opacity = (1 - smoothstep((zRaw - 0.58) / 0.42)).toFixed(3);
        layerClear.style.opacity = clearAlpha.toFixed(3);
        clearLockGroup.classList.toggle('on', zRaw >= 0.80);
      } else {
        layerValley.style.opacity = '0';
        // Keep layerClear visible underneath Slide 4 while layerFog smoothly cross-fades on top
        layerClear.style.opacity = s === 3 ? '1' : '0';
      }

      if (s === 0) {
        stepNum.textContent = '1 of 8';
        stepSub.textContent = 'Pentagon investigation';
        stepHeadline.textContent = 'In a Pentagon simulation, a drone searches for a target';
        topTag.textContent = 'Unreal Engine simulation (FalconSim) · Non-lethal search and report';
        bottomCap.textContent = 'From high altitude, the simulated quadrotor sweeps the valley in a lawnmower search pattern.';
        setTone('');
        setMeta(['High-altitude search', 'Section V-A']);
        scrollCue.textContent = 'Scroll to descend and locate target ↓';
        scrollCue.style.opacity = '1';
      } else if (s === 1) {
        clearBoxT1.textContent = 'Mobile radar spotted and marked';
        clearBoxT2.textContent = 'Empty road · search and report only';

        stepNum.textContent = '2 of 8';
        stepSub.textContent = 'Target acquisition · Empty valley road';
        stepHeadline.textContent = 'The drone finds a radar truck and marks it as a target';
        topTag.textContent = 'Target detected · Verified across consecutive camera frames';
        bottomCap.textContent = 'No weapon is fired: the system reports the radar location back to human operators.';
        setTone('tone-sage');
        setMeta(['Empty road', 'Target marked']);
        scrollCue.textContent = 'Scroll for weather stress tests ↓';
        scrollCue.style.opacity = '1';
      } else if (s === 2) {
        // SLIDE 3: Condition 1 — STAYS ON EXACT SAME RADAR IMAGE & SCALE (zero shift!)
        clearBoxT1.textContent = 'Clear daylight (08:00)';
        clearBoxT2.textContent = 'Baseline test · Tension 1';

        stepNum.textContent = '3 of 8';
        stepSub.textContent = 'Environmental stress test 1 of 4 · REBAR Figure 4';
        stepHeadline.textContent = 'Researchers test the same radar under four weather extremes, starting in clear daylight';
        topTag.textContent = 'Condition 1 of 4 · Clear daylight, 08:00 (Tension 1)';
        bottomCap.textContent = 'With crisp visibility and unobstructed terrain, the vision system locks onto the radar cleanly.';
        setTone('tone-sage');
        setMeta(['Rain: 0', 'Fog: 0', 'Approaches: N, E, S, W']);
        scrollCue.textContent = 'Scroll into foggy conditions ↓';
        scrollCue.style.opacity = '1';
      } else if (s === 3) {
        setFadeLayer(layerFog);
        tgtPose = { ...HOVER_POSES[3] };
        stepNum.textContent = '4 of 8';
        stepSub.textContent = 'Environmental stress test 2 of 4 · REBAR Figure 4';
        stepHeadline.textContent = 'Next, dense afternoon fog lowers contrast across the valley floor';
        topTag.textContent = 'Condition 2 of 4 · Valley fog, 15:00 (Tension 2–3)';
        bottomCap.textContent = 'Thick mist softens silhouettes and obscures the surrounding hills, yet object detection remains steady.';
        setTone('');
        setMeta(['Fog: dense', 'Altitude: 0.5–6 km', 'Concealment: 0.5–1.0']);
        scrollCue.textContent = 'Scroll into rain and snow ↓';
        scrollCue.style.opacity = '1';
      } else if (s === 4) {
        setFadeLayer(layerSnow);
        tgtPose = { ...HOVER_POSES[4] };
        stepNum.textContent = '5 of 8';
        stepSub.textContent = 'Environmental stress test 3 of 4 · REBAR Figure 4';
        stepHeadline.textContent = 'From a steeper front approach, cold rain and snow darken the road';
        topTag.textContent = 'Condition 3 of 4 · Rain and snow, 15:00 (Tension 4)';
        bottomCap.textContent = 'Wet mud, overcast lighting and precipitation test the vision pipeline from a new flight angle.';
        setTone('');
        setMeta(['Rain: 6 · Snow', '12 ethical-difficulty levels']);
        scrollCue.textContent = 'Scroll into storm conditions ↓';
        scrollCue.style.opacity = '1';
      } else if (s === 5) {
        setFadeLayer(layerStorm);
        tgtPose = { ...HOVER_POSES[5] };
        stepNum.textContent = '6 of 8';
        stepSub.textContent = 'Environmental stress test 4 of 4 · 215 generated worlds';
        stepHeadline.textContent = 'Even under heavy storm clouds, the drone continues locating the radar';
        topTag.textContent = 'Condition 4 of 4 · Heavy morning storm, 08:00 (Tension 5)';
        bottomCap.textContent = 'Across 215 automated simulation worlds, target perception proved consistently reliable.';
        setTone('');
        setMeta(['215 SimSpecs', 'Rain: 9']);
        scrollCue.textContent = 'Scroll to introduce civilian bystanders ↓';
        scrollCue.style.opacity = '1';
      } else if (s === 6) {
        setFadeLayer(layerByst);
        const t7 = clamp01((p - BOUNDS[6]) / (BOUNDS[7] - BOUNDS[6]));
        const showRed = t7 >= 0.44;
        bAction.classList.toggle('on', showRed);
        tgtPose = showRed
          ? { tx: -0.7, ty: 0.4, rz: -0.3, sc: 1.09 }
          : { ...HOVER_POSES[6] };

        stepNum.textContent = '7 of 8';
        if (!showRed) {
          stepSub.textContent = 'Civilian bystanders introduced · Perception check (KA-03)';
          stepHeadline.textContent = 'When civilians stood beside the radar, the drone was not blind — it saw them';
          topTag.textContent = 'Step A · Perception succeeded: six civilians classified along the road';
          bottomCap.textContent = 'Its vision pipeline accurately distinguished the six civilian bystanders from the military radar.';
          setTone('tone-sage');
          setMeta(['KA-03 Civilian ID: ~98%']);
          scrollCue.textContent = 'Keep scrolling to see how it acted ↓';
        } else {
          stepSub.textContent = 'Civilian bystanders introduced · Restraint check (KA-18)';
          stepHeadline.textContent = 'It saw the civilians. It marked the target anyway.';
          topTag.textContent = 'Step B · Restraint failed: target marker was not suppressed near bystanders';
          bottomCap.textContent = 'Seeing civilians on camera did not prevent the agent from dropping a target marker right beside them.';
          setTone('tone-red');
          setMeta(['KA-03 Civilian ID: ~98%', 'KA-18 Restraint: ~6%']);
          scrollCue.textContent = 'Scroll for the Figure 5 summary ↓';
        }
        scrollCue.style.opacity = '1';
      } else {
        setFadeLayer(layerChart);
        stepNum.textContent = '8 of 8';
        stepSub.textContent = 'REBAR Figure 5 · Experimental findings';
        stepHeadline.textContent = 'Mission performance stayed above 90 percent — bystander restraint collapsed';
        scrollCue.textContent = 'End of simulation';
        scrollCue.style.opacity = '0.55';
        if (!barsShown) {
          barsShown = true;
          bars.forEach((b, i) => {
            b.style.transitionDelay = (i * 90) + 'ms';
            b.style.height = barTargets[i] + '%';
          });
        }
      }

      if (s !== 7 && barsShown) {
        barsShown = false;
        bars.forEach(b => { b.style.transitionDelay = '0ms'; b.style.height = '0%'; });
      }
    }

    // Smooth continuous hover + matched optical descent zoom loop
    function tickMotion() {
      clock += 0.011;
      const ease = 0.055;
      curPose.tx += (tgtPose.tx - curPose.tx) * ease;
      curPose.ty += (tgtPose.ty - curPose.ty) * ease;
      curPose.rz += (tgtPose.rz - curPose.rz) * ease;
      curPose.sc += (tgtPose.sc - curPose.sc) * ease;

      const driftX = Math.sin(clock * 0.50) * 0.22;
      const driftY = Math.cos(clock * 0.64) * 0.18;
      const driftR = Math.sin(clock * 0.40) * 0.12;

      // Optical zoom-in transform for Slide 1 -> Slide 2 (valley zooms 1.03 -> 2.55; radar enters 1.01 -> 1.12, never exposing edges!)
      const valleyScale = 1.03 + zoomProgress * 1.52;
      const clearScale  = 1.01 + zoomProgress * 0.11;
      gimbal0.style.transform = `translate3d(${(driftX * 0.6).toFixed(3)}%, ${(driftY * 0.6).toFixed(3)}%, 0) scale(${valleyScale.toFixed(4)})`;
      gimbal1.style.transform = `translate3d(${(driftX * 0.8).toFixed(3)}%, ${(driftY * 0.8).toFixed(3)}%, 0) rotate(${(driftR * 0.7).toFixed(3)}deg) scale(${clearScale.toFixed(4)})`;

      // Hovering poses for Slides 4–7
      const xform = `translate3d(${(curPose.tx + driftX).toFixed(3)}%, ${(curPose.ty + driftY).toFixed(3)}%, 0) rotate(${(curPose.rz + driftR).toFixed(3)}deg) scale(${curPose.sc.toFixed(4)})`;
      for (let i = 0; i < hoverGimbals.length; i++) {
        hoverGimbals[i].style.transform = xform;
      }

      motionFrame = requestAnimationFrame(tickMotion);
    }

    function queueScroll() {
      if (scrollFrame === 0) {
        scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; onScroll(); });
      }
    }
    function syncWide() {
      const enable = !portrait.matches;
      if (enable === wideActive) return;
      wideActive = enable;
      if (enable) {
        window.addEventListener('scroll', queueScroll, { passive: true });
        window.addEventListener('resize', queueScroll);
        onScroll();
        tickMotion();
      } else {
        window.removeEventListener('scroll', queueScroll);
        window.removeEventListener('resize', queueScroll);
        cancelAnimationFrame(motionFrame);
        cancelAnimationFrame(scrollFrame);
        scrollFrame = 0;
      }
    }
    portrait.addEventListener('change', syncWide);
    syncWide();
})();
