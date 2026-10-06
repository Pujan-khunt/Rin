import { describe, it, expect, vi, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { configStore } from '@/config/store';

describe('Popup UI Interaction', () => {
  let dom: JSDOM;
  let document: Document;
  let saveConfigSpy: any;
  let loadConfigSpy: any;

  const POPUP_HTML = `
    <div class="rin-popup">
      <header class="rin-header">
        <div class="rin-title">rin</div>
        <label class="switch">
          <input type="checkbox" id="enabled-toggle">
          <span class="slider round"></span>
        </label>
      </header>
      <div class="mode-section">
        <label class="section-label">Execution Mode</label>
        <div class="mode-buttons">
          <button id="mode-assisted" class="mode-btn active">Assisted (HUD)</button>
          <button id="mode-auto" class="mode-btn">Auto-Click</button>
        </div>
        <p id="mode-desc" class="mode-desc">Softly tints the recommended choice in light purple (#e8d5f5). You verify and submit.</p>
      </div>
    </div>
  `;

  beforeAll(async () => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>${POPUP_HTML}</body></html>`);
    document = dom.window.document;
    (global as any).document = document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).HTMLInputElement = dom.window.HTMLInputElement;
    (global as any).HTMLButtonElement = dom.window.HTMLButtonElement;
    (global as any).HTMLParagraphElement = dom.window.HTMLParagraphElement;

    loadConfigSpy = vi.spyOn(configStore, 'load').mockResolvedValue({
      actorMode: 'assisted',
      enabled: true,
    });
    saveConfigSpy = vi.spyOn(configStore, 'save').mockResolvedValue();

    await import('../src/entrypoints/popup/main');
    await Promise.resolve();
    await Promise.resolve();
  });

  it('initializes with loaded config and updates UI accordingly', () => {
    const enabledToggle = document.getElementById('enabled-toggle') as HTMLInputElement;
    const btnAssisted = document.getElementById('mode-assisted') as HTMLButtonElement;
    const btnAuto = document.getElementById('mode-auto') as HTMLButtonElement;
    const modeDesc = document.getElementById('mode-desc') as HTMLParagraphElement;

    expect(loadConfigSpy).toHaveBeenCalled();
    expect(enabledToggle.checked).toBe(true);
    expect(btnAssisted.classList.contains('active')).toBe(true);
    expect(btnAuto.classList.contains('active')).toBe(false);
    expect(modeDesc.textContent).toContain('Softly tints');
  });

  it('updates state and calls saveConfig on toggle change', async () => {
    const enabledToggle = document.getElementById('enabled-toggle') as HTMLInputElement;
    enabledToggle.checked = false;
    enabledToggle.dispatchEvent(new dom.window.Event('change'));

    await Promise.resolve();

    expect(saveConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  it('switches to auto mode and updates description and active class on button click', async () => {
    const btnAssisted = document.getElementById('mode-assisted') as HTMLButtonElement;
    const btnAuto = document.getElementById('mode-auto') as HTMLButtonElement;
    const modeDesc = document.getElementById('mode-desc') as HTMLParagraphElement;

    btnAuto.click();
    await Promise.resolve();

    expect(btnAuto.classList.contains('active')).toBe(true);
    expect(btnAssisted.classList.contains('active')).toBe(false);
    expect(modeDesc.textContent).toContain('Clicks the recommended choice after solving');
    expect(saveConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorMode: 'auto',
      })
    );

    // Switch back to assisted
    btnAssisted.click();
    await Promise.resolve();

    expect(btnAssisted.classList.contains('active')).toBe(true);
    expect(btnAuto.classList.contains('active')).toBe(false);
    expect(modeDesc.textContent).toContain('Softly tints');
    expect(saveConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorMode: 'assisted',
      })
    );
  });
});
