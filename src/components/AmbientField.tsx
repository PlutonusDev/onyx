"use client";

import { useStore } from "@/lib/store";

/**
 * A full-viewport ambient layer behind the whole app that reacts to what the
 * model is doing. Colour lives in CSS variables keyed off `data-phase`, so
 * phase changes morph the entire field (a slow indigo→amber shift as thinking
 * gives way to the answer). The blobs drift and breathe like a lava lamp,
 * concentrated toward the bottom so the light reads as rising from below.
 *
 * All motion is CSS transforms/opacity (GPU-cheap) and collapses under
 * `prefers-reduced-motion`.
 */
export default function AmbientField() {
  const { phase } = useStore();

  return (
    <div className="ambient" data-phase={phase} aria-hidden>
      {/* A slowly swirling conic aurora — mixes the phase colours behind the
          blobs so the light never looks flat. */}
      <div className="ambient-aurora" />

      {/* The rising glow from the bottom edge. */}
      <div className="ambient-glow" />

      {/* Lava-lamp blobs — each drifts on its own slow cycle. */}
      <div className="ambient-blobs">
        <span className="ambient-blob ambient-blob-1" />
        <span className="ambient-blob ambient-blob-2" />
        <span className="ambient-blob ambient-blob-3" />
        <span className="ambient-blob ambient-blob-4" />
        <span className="ambient-blob ambient-blob-5" />
        <span className="ambient-blob ambient-blob-6" />
      </div>

      {/* Fine film grain for texture, so the gradients read as a surface
          rather than a flat wash. */}
      <div className="ambient-grain" />

      {/* A faint vignette keeps the content legible over the field. */}
      <div className="ambient-vignette" />
    </div>
  );
}
