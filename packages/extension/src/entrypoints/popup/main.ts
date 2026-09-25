import { loadConfig, saveConfig } from '../../config/config';
import type { ActorMode } from '../../interfaces/actor';

const enabledToggle = document.getElementById('enabled-toggle') as HTMLInputElement;
const btnAssisted = document.getElementById('mode-assisted') as HTMLButtonElement;
const btnAuto = document.getElementById('mode-auto') as HTMLButtonElement;
const modeDesc = document.getElementById('mode-desc') as HTMLParagraphElement;

const DESCS: Record<ActorMode, string> = {
  assisted: 'Softly tints the recommended choice in light purple (#e8d5f5). You verify and submit.',
  auto: 'Automatically clicks and submits the recommended choice instantly on detection.',
};

async function init() {
  const config = await loadConfig();
  enabledToggle.checked = config.enabled;
  updateModeUI(config.actorMode);

  enabledToggle.addEventListener('change', async () => {
    config.enabled = enabledToggle.checked;
    await saveConfig(config);
  });

  btnAssisted.addEventListener('click', async () => {
    config.actorMode = 'assisted';
    updateModeUI('assisted');
    await saveConfig(config);
  });

  btnAuto.addEventListener('click', async () => {
    config.actorMode = 'auto';
    updateModeUI('auto');
    await saveConfig(config);
  });
}

function updateModeUI(mode: ActorMode) {
  btnAssisted.classList.toggle('active', mode === 'assisted');
  btnAuto.classList.toggle('active', mode === 'auto');
  modeDesc.textContent = DESCS[mode];
}

init();
