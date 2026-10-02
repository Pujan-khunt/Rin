/**
 * Meeting lifecycle callback contracts for Rin Extension.
 */

export interface MeetingCallbacks {
  /** Invoked when a meeting container (.m-activity or .vp-container) enters the DOM. */
  onEnter: (meetingContainer: HTMLElement) => void;
  /** Invoked when the active meeting container is removed/detached from the DOM. */
  onLeave: () => void;
}
