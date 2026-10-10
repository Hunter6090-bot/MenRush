export interface MentionActiveMatch {
  /** The @ mention query (e.g. "Trop" from "@Trop") */
  query: string;
  /** Index where '@' begins in text */
  startIndex: number;
  /** Index where cursor or mention text ends */
  endIndex: number;
}

/**
 * Inspect text and cursor position to determine if the user is currently
 * typing an '@' mention.
 * Returns null if not in an active mention sequence.
 */
export function getActiveMention(text: string, cursorPosition: number): MentionActiveMatch | null {
  if (cursorPosition < 0 || cursorPosition > text.length) {
    return null;
  }

  // Look backwards from cursorPosition for '@'
  const textBeforeCursor = text.slice(0, cursorPosition);
  const atIndex = textBeforeCursor.lastIndexOf('@');

  if (atIndex === -1) {
    return null;
  }

  // Character before '@' must be start of string or whitespace
  if (atIndex > 0) {
    const prevChar = textBeforeCursor[atIndex - 1];
    if (!/\s/.test(prevChar)) {
      return null;
    }
  }

  const queryCandidate = textBeforeCursor.slice(atIndex + 1);

  // If there is whitespace in queryCandidate or newlines, mention query has ended
  // (We allow typing partial name without spaces or with max 1 space? Standard is no spaces or only letters/numbers/spaces up to 25 chars without newline)
  // To allow typing e.g. "@Tropics Day", let's check:
  // If there's a newline, definitely not a mention.
  if (/[\r\n]/.test(queryCandidate)) {
    return null;
  }

  // Limit query length to reasonable mention search (e.g. 30 chars)
  if (queryCandidate.length > 30) {
    return null;
  }

  return {
    query: queryCandidate,
    startIndex: atIndex,
    endIndex: cursorPosition,
  };
}

/**
 * Replace active '@query' with '@MentionName ' ensuring MAX_CHARS is not exceeded.
 */
export function applyMentionReplacement(
  text: string,
  startIndex: number,
  endIndex: number,
  mentionName: string,
  maxChars = 280,
): { newText: string; newCursorPos: number } {
  // Format mention name cleanly (remove leading @ if present)
  const cleanName = mentionName.replace(/^@+/, '').trim();
  const insertText = `@${cleanName} `;

  const before = text.slice(0, startIndex);
  const after = text.slice(endIndex);

  let newText = before + insertText + after;
  if (newText.length > maxChars) {
    newText = newText.slice(0, maxChars);
  }

  const newCursorPos = Math.min(before.length + insertText.length, newText.length);
  return { newText, newCursorPos };
}
