/**
 * Tuning constants shared across Page modules.
 *
 * Kept as a zero-dependency leaf module so it can sit at the root of the
 * dependency graph and prevent import cycles between context/header/footer.
 */

/** Scroll event throttle (ms) — matches the default RN frame budget. */
export const DEFAULT_SCROLL_EVENT_THROTTLE = 16;

/** Pixels scrolled before the header blur reaches full opacity. */
export const DEFAULT_HEADER_BLUR_DISTANCE = 64;

/** Pixels remaining to the scroll end before the footer blur reaches full opacity. */
export const DEFAULT_FOOTER_BLUR_DISTANCE = 64;

/** Duration (ms) of the blur fade when restoring after an app background/foreground transition. */
export const BLUR_RESTORE_FADE_DURATION = 140;
