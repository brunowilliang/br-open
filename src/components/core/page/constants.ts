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
