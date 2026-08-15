"use client";

import { useEffect } from "react";

/**
 * Keeps the app sized to the *visual* viewport.
 *
 * On mobile — iOS Safari especially — the on-screen keyboard overlays the page
 * instead of shrinking the layout viewport, so a bottom-anchored composer ends
 * up hidden behind it. Mirroring `visualViewport.height` into `--app-height`
 * (which the shell uses for its height) makes the app contract when the
 * keyboard opens, keeping the input in view. Falls back to `100dvh` before this
 * runs and on browsers without the API.
 */
export default function ViewportSync() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty("--app-height", `${Math.round(vv.height)}px`);
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      root.style.removeProperty("--app-height");
    };
  }, []);

  return null;
}
