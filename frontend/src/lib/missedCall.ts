/** Stored in messages.message — rendered as a centered call log row in chat. */
export const MISSED_CALL_MESSAGE = '[missed_call]';

export const MISSED_CALL_PREVIEW = 'Missed video call';

export function isMissedCallMessage(msg: { message?: string | null }): boolean {
  return msg.message === MISSED_CALL_MESSAGE;
}
