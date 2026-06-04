import type { Variants, Transition } from "motion/react";

/** Smooth, slightly-overshooting easing used across the app. */
export const easeOutExpo = [0.22, 1, 0.36, 1] as const;

export const springSmooth: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 32,
};

/** Fade + rise, for individual items. */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: easeOutExpo },
  },
};

/** Fade + scale, for cards/panels. */
export const fadeInScale: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: easeOutExpo },
  },
};

/** Parent that staggers its children's entrance. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};
