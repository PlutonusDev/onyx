"use client";

import { MotionConfig } from "framer-motion";
import { StoreProvider } from "@/lib/store";

/**
 * `reducedMotion="user"` makes every framer-motion animation in the tree
 * collapse to an instant transition when the OS asks for reduced motion.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>{children}</StoreProvider>
    </MotionConfig>
  );
}
