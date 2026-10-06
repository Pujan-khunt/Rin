/**
 * Rin Extension — DOM Quiz Verification Snippet
 *
 * Use this script to verify that the Rin extension is active, healthy, and solving
 * quizzes without needing an active live classroom session.
 *
 * Instructions:
 * 1. Open any page on Scaler (e.g., https://www.scaler.com or mentee dashboard).
 * 2. Open Developer Tools (F12 / Cmd+Option+I) -> Console tab.
 * 3. Paste this entire script into the console and press Enter.
 *
 * Expected behavior:
 * - A floating quiz card appears in the bottom-right corner.
 * - Rin's MeetingWatcher detects the .m-activity container.
 * - Rin's QuizObserver extracts the question and options.
 * - In ~500ms-1000ms, Option B ("Paris") is softly tinted in light purple (#e8d5f5)
 *   with an accent border ring (#a855f7) in Assisted Mode, or clicked in Auto Mode.
 */

(() => {
  // 1. Clean up any previous test fixture
  document.getElementById('rin-test-fixture')?.remove();

  // 2. Build synthetic classroom & quiz container (.m-activity + .m-quiz)
  const box = document.createElement('div');
  box.id = 'rin-test-fixture';
  box.className = 'm-activity';
  box.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    background: #ffffff;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
    border: 2px solid #6366f1;
    max-width: 420px;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  box.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <span style="font-size: 12px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.05em;">
        Rin Verification Fixture
      </span>
      <button onclick="this.closest('#rin-test-fixture').remove()" style="border: none; background: transparent; font-size: 16px; cursor: pointer; color: #64748b;">✕</button>
    </div>
    <div class="m-quiz">
      <div class="m-problem-description__markdown" style="margin-bottom: 14px;">
        <p style="font-weight: 700; font-size: 15px; color: #0f172a; margin: 0;">
          What is the capital of France?
        </p>
      </div>
      <div class="m-problem-choices__list" style="display: flex; flex-direction: column; gap: 10px;">
        <a class="choice" style="display: flex; gap: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; text-decoration: none; color: #0f172a; transition: all 0.2s ease;">
          <span class="choice__name" style="font-weight: bold;">A</span>
          <span class="choice__text">Berlin</span>
        </a>
        <a class="choice" style="display: flex; gap: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; text-decoration: none; color: #0f172a; transition: all 0.2s ease;">
          <span class="choice__name" style="font-weight: bold;">B</span>
          <span class="choice__text">Paris</span>
        </a>
        <a class="choice" style="display: flex; gap: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; text-decoration: none; color: #0f172a; transition: all 0.2s ease;">
          <span class="choice__name" style="font-weight: bold;">C</span>
          <span class="choice__text">Madrid</span>
        </a>
      </div>
    </div>
  `;

  // 3. Attach to #root (or document.body) to trigger Rin's MeetingWatcher
  const root = document.querySelector('#root') || document.body;
  root.appendChild(box);
  console.log('[Rin] Synthetic quiz mounted into DOM. Waiting for solver...');
})();
