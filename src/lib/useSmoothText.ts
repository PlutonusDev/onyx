"use client";

import { useEffect, useRef, useState } from "react";

// Reveal pacing (characters per second). The rate is capped and eased so the
// text flows at a calm, near-constant word cadence and never sprints to catch
// the stream — a growing backlog nudges the rate up only gently.
const MIN_CPS = 32;
const MAX_CPS = 82;
const DRAIN_SECONDS = 0.7; // how quickly the backlog *would* empty, if uncapped
const RATE_EASE_SECONDS = 0.3; // time constant for smoothing the rate itself

/**
 * Decouples render cadence from network cadence.
 *
 * Tokens arrive in bursts whose size and spacing are a property of the
 * transport, not of the writing — rendering them directly looks jerky. This
 * releases the buffered text at a smoothed, bounded rate, revealing whole words
 * so the per-word fade always plays on a complete word.
 *
 * When the stream ends the loop keeps draining any remaining backlog at the
 * same eased rate rather than snapping to the full text, so completion is
 * seamless. Messages that never streamed (history) are returned verbatim.
 */
export function useSmoothText(target: string, active: boolean): string {
  const [shown, setShown] = useState("");
  const [animating, setAnimating] = useState(false);
  // Render-visible flag so history (never streamed) is returned verbatim while
  // a message that streamed keeps showing its buffered slice through the drain.
  const [streamed, setStreamed] = useState(false);

  // Fractional count of characters revealed, so sub-frame progress isn't lost
  // to rounding (a common source of stutter).
  const progressRef = useRef(0);
  const rateRef = useRef(MIN_CPS);
  const targetRef = useRef(target);
  const animatingRef = useRef(false);
  // Only messages that have actually streamed animate; history renders instantly.
  const streamedRef = useRef(false);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    if (active) {
      // A fresh stream: reveal from the start.
      streamedRef.current = true;
      progressRef.current = 0;
      rateRef.current = MIN_CPS;
    } else if (!streamedRef.current) {
      // Never streamed through this hook — nothing to animate.
      return;
    }

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); // clamp long gaps
      last = now;

      if (active && !animatingRef.current) {
        animatingRef.current = true;
        setAnimating(true);
        setStreamed(true);
      }

      const full = targetRef.current;

      // A regenerated / shortened target: settle to it rather than show stale tail.
      if (progressRef.current > full.length) {
        progressRef.current = full.length;
        setShown(full);
      }

      const behind = full.length - progressRef.current;

      if (behind > 0.5) {
        // Target rate empties the backlog over DRAIN_SECONDS, clamped so it can
        // never sprint — a huge burst just trails calmly instead.
        const targetRate = Math.min(
          MAX_CPS,
          Math.max(MIN_CPS, behind / DRAIN_SECONDS),
        );
        // Ease the rate toward its target so it shifts gradually, not per-frame.
        rateRef.current +=
          (targetRate - rateRef.current) * Math.min(1, dt / RATE_EASE_SECONDS);

        progressRef.current = Math.min(
          full.length,
          progressRef.current + rateRef.current * dt,
        );

        let end = Math.floor(progressRef.current);
        // Reveal whole words only: if stopped mid-word, extend to the word end
        // so it fades in complete.
        if (end < full.length && !/\s/.test(full[end])) {
          const ws = /\s/.exec(full.slice(end));
          end = ws ? end + ws.index : full.length;
        }
        setShown(full.slice(0, end));
      } else if (!active) {
        // Caught up and the stream is done — settle and stop the loop.
        setShown(full);
        animatingRef.current = false;
        setAnimating(false);
        return;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  // History (never streamed) reads the true target; a message that is live or
  // still draining shows the buffered slice.
  return active || streamed || animating ? shown : target;
}
