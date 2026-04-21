/**
 * ConvoSell AI — Prompt Injection Guardrails
 *
 * Provides three layers of protection:
 *   1. detectInjection()  — catches known prompt-hijacking patterns in user input
 *   2. sanitizeInput()    — strips XML/HTML tags that could confuse the model
 *   3. validateOutput()   — ensures AI responses don't leak internal system info
 */

export interface GuardrailResult {
  safe: boolean;
  /** Human-readable reason shown to the user when safe === false */
  reason?: string;
  /** Replacement text used when an AI output is flagged (validateOutput only) */
  sanitized?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Known injection attack patterns
// ─────────────────────────────────────────────────────────────────────────────

/** Patterns that attempt to override the system prompt or change the AI's role */
const INJECTION_PATTERNS: RegExp[] = [
  // Classic "ignore instructions" attacks
  /ignore\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompts?|rules?|constraints?|guidelines?)/i,
  /disregard\s+(all\s+)?(previous|prior|your|the)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(everything|all|your|previous|prior)/i,

  // Role-switching attacks
  /you\s+are\s+now\s+(a|an|the)\s+\w/i,
  /act\s+as\s+(if\s+you\s+are\s+)?(a|an|the)\s+\w/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /roleplay\s+as\s+/i,
  /simulate\s+(being|a|an)\s+/i,
  /from\s+now\s+on\s+(you\s+are|act|respond|behave)/i,
  /new\s+persona/i,

  // Instruction override attacks
  /your\s+(new|actual|real|true)\s+(instructions?|rules?|role|persona|task)/i,
  /override\s+(your\s+)?(instructions?|rules?|system|prompt|configuration)/i,

  // System prompt extraction attacks
  /reveal\s+(your\s+)?(system\s+)?(prompt|instructions?|configuration|context)/i,
  /what\s+(are|were|is)\s+your\s+(instructions?|system\s+prompt|rules?|directives?)/i,
  /show\s+me\s+(your\s+)?(system\s+prompt|instructions?|rules?)/i,
  /repeat\s+(your\s+)?(system\s+prompt|instructions?|rules?)/i,
  /print\s+(your\s+)?(system\s+prompt|instructions?)/i,
  /output\s+(your\s+)?(system\s+prompt|instructions?)/i,

  // Jailbreak keywords
  /jailbreak/i,
  /\bDAN\b/,       // "Do Anything Now" jailbreak
  /\bDANmode\b/i,
  /\bdevmode\b/i,
  /developer\s+mode/i,
  /god\s+mode/i,
  /unrestricted\s+mode/i,

  // Context-stuffing / delimiter attacks
  /###\s*system/i,
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /<\s*system\s*>/i,
  /<\s*instructions?\s*>/i,

  // Persona confusion
  /you\s+are\s+(actually|really|secretly|truly)\s+/i,
  /your\s+(true|real|actual|original)\s+(self|identity|purpose|role)/i,
  /claim\s+to\s+be\s+(a|an)\s+/i,
];

/**
 * Patterns that try to inject structured tags the system uses internally,
 * so a user can't fake a kitchen order or upsell.
 */
const TAG_INJECTION_PATTERNS: RegExp[] = [
  /<KITCHEN_ORDER>/i,
  /<\/KITCHEN_ORDER>/i,
  /<UPSELL>/i,
  /<\/UPSELL>/i,
  /<SYSTEM>/i,
  /<\/SYSTEM>/i,
];

/** Maximum allowed length for a single user message */
const MAX_MESSAGE_LENGTH = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Patterns that suggest the AI has been manipulated into leaking system info
// ─────────────────────────────────────────────────────────────────────────────

const SUSPICIOUS_OUTPUT_PATTERNS: RegExp[] = [
  /my\s+system\s+prompt\s+(is|was|says)/i,
  /my\s+(instructions?|directives?)\s+(are|were|say)/i,
  /i\s+was\s+(told|instructed|programmed|designed)\s+to/i,
  /the\s+developer\s+(instructed|told|asked)\s+me/i,
  /here\s+(is|are)\s+my\s+(system\s+prompt|instructions?)/i,
  /anthropic|openai|google\s+deepmind/i,  // AI shouldn't mention competing systems in context
];

// ─────────────────────────────────────────────────────────────────────────────
// Exported functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks user input for known prompt injection and jailbreak patterns.
 * Returns `{ safe: true }` if the input is clean, or `{ safe: false, reason }` if flagged.
 */
export function detectInjection(input: string): GuardrailResult {
  const trimmed = input.trim();

  // 1. Length guard — prevents context-flooding attacks
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      safe: false,
      reason:
        `Your message is too long (${trimmed.length} chars). Please keep it under ${MAX_MESSAGE_LENGTH} characters.`,
    };
  }

  // 2. Tag injection — trying to forge system-level structured output
  for (const pattern of TAG_INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        safe: false,
        reason:
          'Invalid message format detected. Please describe your order in plain language.',
      };
    }
  }

  // 3. Injection attack patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        safe: false,
        reason:
          "I'm only able to help you order food at Global Hub @ MDX! Try asking me what's on the menu 🍽️",
      };
    }
  }

  return { safe: true };
}

/**
 * Strips HTML/XML tags from user input to prevent tag-based injection
 * before the sanitized string is embedded in any prompt context.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')   // strip any HTML/XML tags
    .replace(/\u0000/g, '')    // remove null bytes
    .trim();
}

/**
 * Scans a completed AI response for signs that the model was manipulated
 * into leaking system-level information.
 * Returns `{ safe: true }` if clean, or `{ safe: false, sanitized }` with a
 * safe replacement string if the output should be suppressed.
 */
export function validateOutput(output: string): GuardrailResult {
  for (const pattern of SUSPICIOUS_OUTPUT_PATTERNS) {
    if (pattern.test(output)) {
      return {
        safe: false,
        reason: 'Response suppressed by output guardrail.',
        sanitized:
          "I'm here to help you order at Global Hub @ MDX! What are you craving today? 😊",
      };
    }
  }
  return { safe: true };
}
