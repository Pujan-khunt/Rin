import { configStore } from '@/config/store';
import type { ActorMode } from '@/actors/types';
import type { SolverMode } from '@rin/shared';

const enabledToggle = document.getElementById('enabled-toggle') as HTMLInputElement;
const btnAssisted = document.getElementById('mode-assisted') as HTMLButtonElement;
const btnAuto = document.getElementById('mode-auto') as HTMLButtonElement;
const modeDesc = document.getElementById('mode-desc') as HTMLParagraphElement;

const btnFast = document.getElementById('solver-fast') as HTMLButtonElement;
const btnReasoning = document.getElementById('solver-reasoning') as HTMLButtonElement;
const solverDesc = document.getElementById('solver-desc') as HTMLParagraphElement;

const DESCS: Record<ActorMode, string> = {
  assisted: 'Softly tints the recommended choice in light purple. You verify and submit.',
  auto: 'Automatically clicks the recommended choice after solving.',
};

const SOLVER_DESCS: Record<SolverMode, string> = {
  fast: 'Direct, instant answer generation without chain-of-thought (~200ms).',
  reasoning: 'Deep chain-of-thought reasoning before answering (~2–4s). Best for complex logic.',
};

async function init() {
  const config = await configStore.load();
  enabledToggle.checked = config.enabled;
  updateModeUI(config.actorMode);
  updateSolverModeUI(config.solverMode);

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

  btnFast.addEventListener('click', async () => {
    config.solverMode = 'fast';
    updateSolverModeUI('fast');
    await configStore.save(config);
  });

  btnReasoning.addEventListener('click', async () => {
    config.solverMode = 'reasoning';
    updateSolverModeUI('reasoning');
    await configStore.save(config);
  });
}

function updateModeUI(mode: ActorMode) {
  btnAssisted.classList.toggle('active', mode === 'assisted');
  btnAuto.classList.toggle('active', mode === 'auto');
  modeDesc.textContent = DESCS[mode];
}

function updateSolverModeUI(mode: SolverMode) {
  btnFast.classList.toggle('active', mode === 'fast');
  btnReasoning.classList.toggle('active', mode === 'reasoning');
  solverDesc.textContent = SOLVER_DESCS[mode];
}

init();
