export const Theme = {
  STORAGE_KEY: 'sport_tournaments_theme',

  get() {
    return localStorage.getItem(this.STORAGE_KEY) === 'light' ? 'light' : 'dark';
  },

  set(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    localStorage.setItem(this.STORAGE_KEY, next);
    this.apply(next);
    this._syncControls();
  },

  toggle() {
    this.set(this.get() === 'dark' ? 'light' : 'dark');
  },

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === 'light' ? '#f0f4f8' : '#0a0e17';
    const colorScheme = document.querySelector('meta[name="color-scheme"]');
    if (colorScheme) colorScheme.content = theme === 'light' ? 'light' : 'dark';
  },

  init() {
    this.apply(this.get());
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-theme-pick]');
      if (!btn) return;
      e.preventDefault();
      this.set(btn.dataset.themePick);
    });
    this._syncControls();
  },

  controlHtml() {
    const current = this.get();
    return `
      <div class="theme-switch" role="group" aria-label="Цветовая тема">
        <button type="button" class="theme-switch__btn${current === 'dark' ? ' is-active' : ''}" data-theme-pick="dark" title="Ночная тема" aria-pressed="${current === 'dark'}">🌙 <span class="theme-switch__label">Ночь</span></button>
        <button type="button" class="theme-switch__btn${current === 'light' ? ' is-active' : ''}" data-theme-pick="light" title="Дневная тема" aria-pressed="${current === 'light'}">☀️ <span class="theme-switch__label">День</span></button>
      </div>`;
  },

  _syncControls() {
    const current = this.get();
    document.querySelectorAll('[data-theme-pick]').forEach((btn) => {
      const active = btn.dataset.themePick === current;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
};
