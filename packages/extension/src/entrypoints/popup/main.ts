import { configStore } from '@/config/store';
import { DEFAULT_MODEL_ID, DEEPSEEK_MODEL_ID, GEMINI_MODEL_ID } from '@rin/shared';
import type { ActorMode } from '@/actors/types';

const enabledToggle = document.getElementById('enabled-toggle') as HTMLInputElement;
const btnAssisted = document.getElementById('mode-assisted') as HTMLButtonElement;
const btnAuto = document.getElementById('mode-auto') as HTMLButtonElement;
const modeDesc = document.getElementById('mode-desc') as HTMLParagraphElement;

const devSection = document.getElementById('dev-model-section');
const btnDeepseek = document.getElementById('model-deepseek') as HTMLButtonElement | null;
const btnGemini = document.getElementById('model-gemini') as HTMLButtonElement | null;
const customModelInput = document.getElementById('custom-model-input') as HTMLInputElement | null;

const DESCS: Record<ActorMode, string> = {
  assisted: 'Softly tints the recommended choice in light purple (#e8d5f5). You verify and submit.',
  auto: 'Clicks the recommended choice after solving. Submission depends on Scaler; acceptance is not confirmed.',
};

async function init() {
  const config = await configStore.load();
  enabledToggle.checked = config.enabled;
  updateModeUI(config.actorMode);

  enabledToggle.addEventListener('change', async () => {
    config.enabled = enabledToggle.checked;
    await configStore.save(config);
  });

  btnAssisted.addEventListener('click', async () => {
    config.actorMode = 'assisted';
    updateModeUI('assisted');
    await configStore.save(config);
  });

  btnAuto.addEventListener('click', async () => {
    config.actorMode = 'auto';
    updateModeUI('auto');
    await configStore.save(config);
  });

  // Dev-only model selection
  if (!import.meta.env.DEV) {
    devSection?.remove();
  } else if (btnDeepseek && btnGemini && customModelInput) {
    const currentModel = config.model || DEFAULT_MODEL_ID;
    updateModelUI(currentModel);

    btnDeepseek.addEventListener('click', async () => {
      config.model = DEEPSEEK_MODEL_ID;
      updateModelUI(DEEPSEEK_MODEL_ID);
      await configStore.save(config);
    });

    btnGemini.addEventListener('click', async () => {
      config.model = GEMINI_MODEL_ID;
      updateModelUI(GEMINI_MODEL_ID);
      await configStore.save(config);
    });

    customModelInput.addEventListener('change', async () => {
      const val = customModelInput.value.trim();
      config.model = val || DEFAULT_MODEL_ID;
      updateModelUI(config.model);
      await configStore.save(config);
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
  const isDeepseek = model === DEEPSEEK_MODEL_ID;
  const isGemini = model === GEMINI_MODEL_ID;
  btnDeepseek.classList.toggle('active', isDeepseek);
  btnGemini.classList.toggle('active', isGemini);
  customModelInput.value = model;
}

init();
