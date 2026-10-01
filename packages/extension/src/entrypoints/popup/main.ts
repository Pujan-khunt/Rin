import { loadConfig, saveConfig, DEFAULT_MODEL } from '../../config/config';
import type { ActorMode } from '../../interfaces/actor';

const enabledToggle = document.getElementById('enabled-toggle') as HTMLInputElement;
const btnAssisted = document.getElementById('mode-assisted') as HTMLButtonElement;
const btnAuto = document.getElementById('mode-auto') as HTMLButtonElement;
const modeDesc = document.getElementById('mode-desc') as HTMLParagraphElement;

const devSection = document.getElementById('dev-model-section');
const btnDeepseek = document.getElementById('model-deepseek') as HTMLButtonElement | null;
const btnGemini = document.getElementById('model-gemini') as HTMLButtonElement | null;
const customModelInput = document.getElementById('custom-model-input') as HTMLInputElement | null;

export const DEEPSEEK_MODEL = 'deepseek/deepseek-v4-flash';
export const GEMINI_MODEL = 'google/gemini-2.5-flash';

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

  // Dev-only model selection
  if (!import.meta.env.DEV) {
    devSection?.remove();
  } else if (btnDeepseek && btnGemini && customModelInput) {
    const currentModel = config.model || DEFAULT_MODEL;
    updateModelUI(currentModel);

    btnDeepseek.addEventListener('click', async () => {
      config.model = DEEPSEEK_MODEL;
      updateModelUI(DEEPSEEK_MODEL);
      await saveConfig(config);
    });

    btnGemini.addEventListener('click', async () => {
      config.model = GEMINI_MODEL;
      updateModelUI(GEMINI_MODEL);
      await saveConfig(config);
    });

    customModelInput.addEventListener('change', async () => {
      const val = customModelInput.value.trim();
      config.model = val || DEEPSEEK_MODEL;
      updateModelUI(config.model);
      await saveConfig(config);
    });
  }
}

function updateModeUI(mode: ActorMode) {
  btnAssisted.classList.toggle('active', mode === 'assisted');
  btnAuto.classList.toggle('active', mode === 'auto');
  modeDesc.textContent = DESCS[mode];
}

function updateModelUI(model: string) {
  if (!btnDeepseek || !btnGemini || !customModelInput) return;
  const isDeepseek = model === DEEPSEEK_MODEL;
  const isGemini = model === GEMINI_MODEL;
  btnDeepseek.classList.toggle('active', isDeepseek);
  btnGemini.classList.toggle('active', isGemini);
  customModelInput.value = model;
}

init();
