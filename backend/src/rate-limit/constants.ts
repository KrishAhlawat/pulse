// ============================================
// Rate Limiting Configuration Constants
// Phase 7: Rate Limiting & Abuse Protection
// ============================================

// --- Message Rate Limiting ---
/** Maximum messages a user can send per window */
export const MESSAGE_RATE_LIMIT = 20;

/** Message rate limit window in seconds (1 minute) */
export const MESSAGE_RATE_WINDOW = 60;

// --- Typing Event Throttling ---
/** Maximum typing events a user can emit per window */
export const TYPING_RATE_LIMIT = 5;

/** Typing rate limit window in seconds (1 second) */
export const TYPING_RATE_WINDOW = 1;

// --- Temporary Mute System ---
/** Duration of a temporary mute in seconds */
export const MUTE_DURATION = 30;

/** Number of rate limit violations before auto-mute */
export const VIOLATION_THRESHOLD = 3;

/** Window in seconds for tracking violations (5 minutes) */
export const VIOLATION_WINDOW = 300;

// --- Redis Key Prefixes ---
export const REDIS_KEYS = {
  /** rate:msg:{userId} — message rate counter */
  MESSAGE_RATE: 'rate:msg',

  /** rate:typing:{userId} — typing event counter */
  TYPING_RATE: 'rate:typing',

  /** mute:user:{userId} — mute flag */
  USER_MUTE: 'mute:user',

  /** rate:violations:{userId} — violation counter */
  VIOLATIONS: 'rate:violations',
} as const;
