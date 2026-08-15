import type { Transition, Variants } from "framer-motion";

/**
 * One motion vocabulary for the whole app, so nothing feels borrowed from a
 * different product. Curves are expo-out (decisive start, soft landing).
 */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const spring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.7,
};

export const snappy: Transition = { duration: 0.22, ease: EASE_OUT };
export const swift: Transition = { duration: 0.14, ease: EASE_OUT };

/** Message entry: rises and sharpens into place. */
export const messageIn: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.34, ease: EASE_OUT },
  },
};

/** Parent that releases its children one after another. */
export const stagger = (delay = 0.03): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: 0.02 } },
});

/** Overlay panels (palette, dialogs). */
export const panelIn: Variants = {
  hidden: { opacity: 0, y: -14, scale: 0.97, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.24, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.985,
    transition: { duration: 0.13, ease: "easeIn" },
  },
};

export const listItemIn: Variants = {
  hidden: { opacity: 0, x: -6 },
  show: { opacity: 1, x: 0, transition: { duration: 0.2, ease: EASE_OUT } },
};
