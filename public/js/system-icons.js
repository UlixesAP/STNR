/** Монохромные SVG-иконки карточек (ночь / день через CSS-переменные) */
const SystemIcons = {
  wrap(id) {
    const svg = this[id];
    if (!svg) return '';
    return `<div class="system-card__icon-wrap" aria-hidden="true">${svg}</div>`;
  },

  rr: `
    <svg class="sys-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle class="i-bg" cx="24" cy="24" r="22"/>
      <rect class="i-light" x="10" y="28" width="6" height="10" rx="1.5"/>
      <rect class="i-secondary" x="21" y="20" width="6" height="18" rx="1.5"/>
      <rect class="i-primary" x="32" y="12" width="6" height="26" rx="1.5"/>
      <path class="i-stroke" d="M8 38h32"/>
    </svg>`,

  oly: `
    <svg class="sys-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle class="i-bg" cx="24" cy="24" r="22"/>
      <path class="i-secondary" d="M14 16h6c0 6 2 10 4 12-2 2-4 6-4 10h-6c0-5 2-9 4-12-2-2-4-6-4-10z"/>
      <path class="i-primary" d="M28 16h6c0 6-2 10-4 12 2 2 4 6 4 10h-6c0-5-2-9-4-12 2-2 4-6 4-10z"/>
      <path class="i-light" d="M18 38h12v3H18z"/>
      <rect class="i-primary" x="14" y="41" width="20" height="3" rx="1"/>
    </svg>`,

  score: `
    <svg class="sys-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle class="i-bg" cx="24" cy="26" r="22"/>
      <circle class="i-stroke" cx="24" cy="26" r="14"/>
      <line class="i-stroke" x1="24" y1="26" x2="24" y2="16"/>
      <line class="i-hand" x1="24" y1="26" x2="31" y2="30"/>
      <rect class="i-secondary" x="20" y="6" width="3" height="6" rx="1"/>
      <rect class="i-secondary" x="25" y="6" width="3" height="6" rx="1"/>
      <circle class="i-light" cx="24" cy="26" r="2"/>
    </svg>`,

  basketball: `
    <svg class="sys-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle class="i-bg" cx="24" cy="24" r="22"/>
      <path class="i-primary" d="M21 16c1-6 7-12 15-10-2 7-7 13-13 15 2-2 3-5-2-5z"/>
      <path class="i-secondary" d="M23 13c4-4 11-6 16-2-3 6-8 11-14 12 3-4 2-7-2-10z"/>
      <path class="i-light" d="M25 14c3-2 7-2 9 1-2 4-6 6-9 5 2-3 1-5-1-6z"/>
      <circle class="i-secondary" cx="18" cy="30" r="11"/>
      <circle class="i-stroke" cx="18" cy="30" r="11"/>
      <path class="i-seam" d="M18 19v22"/>
      <path class="i-seam" d="M7 30h22"/>
      <path class="i-seam" d="M8.5 22.5c4 3.5 4 11.5 0 15"/>
      <path class="i-seam" d="M27.5 22.5c-4 3.5-4 11.5 0 15"/>
    </svg>`,

  volleyball: `
    <svg class="sys-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle class="i-bg" cx="24" cy="24" r="22"/>
      <path class="i-hand" d="M24 11c-9.5 5.5-9.5 20.5 0 26" fill="none"/>
      <path class="i-primary" d="M13 15c9 3.5 11 15.5 5.5 22.5" fill="none"/>
      <path class="i-secondary" d="M35 15c-9 3.5-11 15.5-5.5 22.5" fill="none"/>
      <path class="i-stroke" d="M11.5 24c4.5-7.5 20.5-7.5 25 0" fill="none"/>
    </svg>`,

  football: `
    <svg class="sys-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle class="i-bg" cx="24" cy="24" r="22"/>
      <circle class="i-light" cx="24" cy="24" r="10.5"/>
      <path class="i-primary" d="M24 15l4.2 3.2-1.4 5.2h-5.6l-1.4-5.2z"/>
      <path class="i-secondary" d="M19.5 19.5c1.2-.8 2.8-.8 4 0-.6 1.2-2 1.6-4 .8z"/>
      <path class="i-secondary" d="M27.5 22.5c-.8.8-2 .8-2.8 0 .4-1 1.4-1.4 2.8-.6z"/>
      <path class="i-secondary" d="M21 26.5c.8-.6 2-.6 2.8 0-.4.8-1.4 1-2.8.4z"/>
      <path class="i-stroke" d="M24 15V11M28.2 18.2L31.5 15.5M27.8 23.4L32.5 24M24 23.4V28M20.2 23.4L15.5 24M19.8 18.2L16.5 15.5"/>
      <circle class="i-ring" cx="24" cy="24" r="13"/>
      <path class="i-light" d="M15.5 17.5c2.5-2 6-2.5 8.5-1" fill="none"/>
    </svg>`,

  mixed: `
    <svg class="sys-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle class="i-bg" cx="24" cy="24" r="22"/>
      <!-- Групповой этап: 3 столбца -->
      <rect class="i-secondary" x="10" y="12" width="5" height="22" rx="1"/>
      <rect class="i-primary" x="17" y="16" width="5" height="18" rx="1"/>
      <rect class="i-light" x="24" y="10" width="5" height="24" rx="1"/>
      <!-- Стрелка перехода к плей-офф -->
      <path class="i-stroke" d="M32 22h4l-2-2M36 22h-4" stroke-width="1.5" fill="none"/>
      <!-- Плей-офф: дерево матчей -->
      <path class="i-primary" d="M38 15v8M38 23v8" stroke-width="1.5" fill="none"/>
      <path class="i-secondary" d="M34 19c2 0 2 4 4 4" stroke-width="1.5" fill="none"/>
      <!-- Кубок победителя -->
      <path class="i-light" d="M35 34c0 3 2 5 5 5s5-2 5-5" stroke-width="1.5" fill="none"/>
      <line class="i-stroke" x1="40" y1="39" x2="40" y2="42" stroke-width="1.5"/>
      <line class="i-stroke" x1="36" y1="42" x2="44" y2="42" stroke-width="1.5"/>
    </svg>
  `
};
