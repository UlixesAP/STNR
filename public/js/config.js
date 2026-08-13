const SPORTS = [
  'футбол', 'хоккей', 'стритбол', 'баскетбол', 'волейбол', 'лапта', 'регби'
];

const VENUES = [
  'ул. Коллонтай, д. 32, корп. 2',
  'Искровский пр., д. 4, корп. 3',
  'Искровский пр., д. 6, корп. 7',
  'ул. Запорожская, д. 23, корп. 2',
  'ул. Народная, д. 43',
  'ул. Народная, д. 98',
  'ул. Тельмана, д. 43, корп. 3',
  'Октябрьская наб., д. 118, корп. 7',
  'ул. Караваевская, д. 40, корп. 1',
  'ул. Прибрежная, д. 16',
  'пр. Елизарова, д. 20',
  'ул. Седова, д. 28',
  'пр. Обуховской Обороны (Невский Завод)',
  'ул. Полярников, д. 15',
  'ул. Подвойского, д. 46',
  'ул. Подвойского, д. 42',
  'пр. Солидарности, д.21',
  'ул. Крыленко, д. 27',
  'ул. Дыбенко, д. 13, корп. 1',
  'ул. Дыбенко, д. 17, корп. 3',
  'Железнодорожный пр., д. 32 (ФОК)',
  'ул. Бабушкина, д. 30 (Ледовая арена)'
];

const RR_TEAM_COUNTS = [3, 4, 5, 6, 7, 8];
const OLY_TEAM_COUNTS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
/** Только 18 команд: победитель 1-го тура с наиб. разницей пропускает 2-й тур */
const SKIP_BEST_WINNER_COUNTS = [18];

/** Системы смешанного турнира */
const MIXED_SYSTEMS = [
  { id: '1table-4', label: 'Турнирная таблица (4 команды)', desc: 'Одна группа 4 команды, выход 4 лучших в плей-офф (олимпийская система)' },
  { id: '2tables-2eac', label: 'Две таблицы (выход 2 из каждой)', desc: 'Две группы, выход 2 лучших из каждой в плей-офф (олимпийская система)' },
  { id: '2tables-4eac', label: 'Две таблицы (выход 4 из каждой)', desc: 'Две группы, выход 4 лучших из каждой в плей-офф (олимпийская система)' },
  { id: '4tables-2eac', label: 'Четыре таблицы (выход 2 из каждой)', desc: '4 группы по 2 команды, выход 2 лучших из каждой в плей-офф (олимпийская система)' },
  { id: '2tables-rr', label: 'Две таблицы (выход 2 из каждой)', desc: 'Две группы, выход 2 лучших из каждой в плей-офф (круговая система)' }
];

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatSport(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function formatDateRu(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function uid() {
  return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

const AppBrand = {
  title: 'Спортивный менеджер турниров',
  org: 'Центра спорта Невского района',
  logo128: 'images/logo-128.webp',
  logo256: 'images/logo-256.webp',

  html(tagline = '') {
    const tag = tagline
      ? `<p class="subtitle app-brand__tagline">${tagline}</p>`
      : '';
    return `
      <div class="app-brand">
        <picture class="app-brand__logo-wrap">
          <source srcset="${this.logo128} 1x, ${this.logo256} 2x" type="image/webp">
          <img
            class="app-brand__logo"
            src="${this.logo128}"
            alt="Центр физической культуры, спорта и здоровья Невского района"
            width="72"
            height="72"
            loading="eager"
            decoding="async"
          >
        </picture>
        <div class="app-brand__text">
          <h1 class="app-brand__title">${this.title}</h1>
          <p class="app-brand__org">${this.org}</p>
        </div>
      </div>
      ${tag}`;
  }
};
