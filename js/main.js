import { Theme } from './theme.js';

window.Theme = Theme;

const modules = [
  () => import('./config.js'),
  () => import('./system-icons.js'),
  () => import('./idb-storage.js'),
  () => import('./storage.js'),
  () => import('./download-xlsx.js'),
  () => import('./score-storage.js'),
  () => import('./score-timer.js'),
  () => import('./score-export.js'),
  () => import('./scoreboard-core.js'),
  () => import('./scoreboard-basketball.js'),
  () => import('./scoreboard-volleyball.js'),
  () => import('./scoreboard-football.js'),
  () => import('./scoreboard-hockey.js'),
  () => import('./scoreboard-tennis.js'),
  () => import('./scoreboard-streetball.js'),
  () => import('./scoreboard-oneperiod.js'),
  () => import('./scoreboard.js'),
  () => import('./round-robin-schedules.js'),
  () => import('./round-robin.js'),
  () => import('./olympic.js'),
  () => import('./mixed-engine.js'),
  () => import('./mixed-ui.js'),
  () => import('./meta-form.js'),
  () => import('./score-sync.js'),
  () => import('./round-robin-ui.js'),
  () => import('./olympic-ui.js'),
  () => import('./mixed-ui-controller.js'),
  () => import('./app.js'),
];

async function bootstrap() {
  for (const load of modules) {
    try { await load(); } catch (e) { console.error('Module load error:', e); }
  }

  if (typeof IdbStorage !== 'undefined') {
    await IdbStorage.init();
  }

  if (typeof TournamentStorage !== 'undefined') {
    await TournamentStorage._ensureLoaded();
  }
  if (typeof ScoreStorage !== 'undefined') {
    await ScoreStorage._ensureLoaded();
  }

  if (typeof App !== 'undefined') {
    Object.assign(App, MetaForm, ScoreSync, RoundRobinUI, OlympicUI, MixedUIController);
    Object.assign(ScoreboardApp, ScoreboardCore, ScoreboardBasketball, ScoreboardVolleyball, ScoreboardFootball, ScoreboardHockey, ScoreboardTennis, ScoreboardStreetball, ScoreboardOnePeriod);
  }

  if (typeof App !== 'undefined') App.init();
  Theme.init();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
