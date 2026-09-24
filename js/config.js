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

const RR_TEAM_COUNTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const OLY_TEAM_COUNTS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
/** Только 18 команд: победитель 1-го тура с наиб. разницей пропускает 2-й тур */
const SKIP_BEST_WINNER_COUNTS = [18];

/** Системы смешанного турнира */
const MIXED_SYSTEMS = [
  { id: '1table-4', label: 'Турнирная таблица (4 команды)', desc: 'Одна группа 4 команды, выход 4 лучших в плей-офф (олимпийская система)' },
  { id: '2tables-2eac', label: 'Две таблицы (выход 4 из каждой)', desc: 'Две группы, выход 4 лучших из каждой в плей-офф (олимпийская система)' },
  { id: '2tables-4eac', label: 'Две таблицы (выход 4 из каждой)', desc: 'Две группы, выход 4 лучших из каждой в плей-офф (олимпийская система)' },
  { id: '4tables-2eac', label: 'Четыре таблицы (выход 2 из каждой)', desc: '4 группы по 2 команды, выход 2 лучших из каждой в плей-офф (олимпийская система)' },
  { id: '2tables-rr', label: 'Турнирная таблица (выход 4х лучших в финальную таблицу)', desc: 'Одна группа 5-15 команд, круговой турнир, 4 лучших выходят в финальный круговой раунд' }
];

/**
 * Детальная конфигурация каждой системы смешанного турнира.
 * Используется MixedEngine для валидации, посева и формирования плей-офф.
 */
const MIXED_SYSTEM_CONFIGS = {
  /**
   * Система 1table-4: одна группа, все играют со всеми,
   * топ-N выходят в плей-офф (олимпийская система).
   */
'1table-4': {
    title: 'Турнирная таблица (выход 4 лучших)',
    desc: 'Все команды играют круговой турнир, 4 лучших выходят в полуфинал',
    minTeams: 4,
    maxTeams: 20,
    maxTeamsPerGroup: 20,
    advanceCount: 4,
    seedingRule: '1v4_2v3',
    hasThirdPlace: true,
    playoffType: 'olympic'
  },

  /**
   * Система 2tables-2eac: 2 группы (A и B), по 4 лучших из каждой выходят в плей-офф.
   * Четыре четвертьфинала: A1-B4, A2-B3, A3-B2, A4-B1.
   */
  '2tables-2eac': {
    title: 'Две таблицы (выход 4 из каждой)',
    desc: 'Группы A и B, по 4 лучших из каждой, кросс-четвертьфиналы A1-B4, A2-B3, A3-B2, A4-B1',
    minTeams: 8,
    maxTeams: 20,
    minTeamsPerGroup: 4,
    maxTeamsPerGroup: 10,
    advanceCount: 4,           // По 4 из каждой группы
    seedingRule: '1v4_2v3',    // Кросс: A1-B4, A2-B3, A3-B2, A4-B1
    hasThirdPlace: true,
    playoffType: 'olympic',
    groups: 2                  // Количество групп
  },

  /**
   * Система 2tables-4eac: 2 группы (A и B), по 4 лучших из каждой выходят в плей-офф.
   * Четыре четвертьфинала.
   */
  '2tables-4eac': {
    title: 'Две таблицы (выход 4 из каждой)',
    desc: 'Группы A и B, по 4 лучших из каждой, кросс-четвертьфиналы',
    minTeams: 8,
    maxTeams: 16,
    minTeamsPerGroup: 4,
    maxTeamsPerGroup: 8,
    advanceCount: 4,
    seedingRule: '1v4_2v3',    // Каждый четвертьфинал: A1-B4, A2-B3, A3-B2, A4-B1
    hasThirdPlace: true,
    playoffType: 'olympic',
    groups: 2
  },

  /**
   * Система 4tables-2eac: 4 группы (A, B, C, D), по 2 лучших из каждой выходят в плей-офф.
   * Четыре четвертьфинала.
   */
  '4tables-2eac': {
    title: 'Четыре таблицы (выход 2 из каждой)',
    desc: '4 группы, по 2 лучших из каждой, кросс-четвертьфиналы A1-B2, A2-B1, C1-D2, C2-D1',
    minTeams: 12,
    maxTeams: 32,
    minTeamsPerGroup: 3,
    maxTeamsPerGroup: 8,
    advanceCount: 2,
    seedingRule: '4group-cross',
    hasThirdPlace: true,
    playoffType: 'olympic',
    groups: 4
  },

  /**
   * Система 2tables-rr: одна группа, 5-15 команд, круговой турнир.
   * Топ-4 выходят в финальную таблицу (тоже круговая).
   */
  '2tables-rr': {
    title: 'Турнирная таблица (выход 4х лучших в финальную таблицу)',
    desc: 'Одна группа 5-20 команд, круговой турнир, 4 лучших выходят в финальный круговой раунд',
    minTeams: 5,
    maxTeams: 20,
    maxTeamsPerGroup: 20,
    advanceCount: 4,
    seedingRule: '1v4_2v3',
    hasThirdPlace: false,
    playoffType: 'round-robin',
    groups: 1
  }
};

/**
 * Доступные количества команд для каждой системы смешанного турнира.
 * Используется TournamentStorage.create() для выбора значений по умолчанию.
 */
const MIXED_TEAM_COUNTS = {
  '1table-4': [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  '2tables-2eac': [8, 10, 12, 14, 16, 18, 20],
  '2tables-4eac': [8, 10, 12, 14, 16],
  '4tables-2eac': [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32],
  '2tables-rr': [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
};

// Задания для кросс-таблиц будут добавлены позже:
// '2tables-2eac': { ... },
// '2tables-4eac': { ... },
// '4tables-2eac': { ... },

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
  title: 'Менеджер спортивных турниров',
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

window.SPORTS = SPORTS;
window.VENUES = VENUES;
window.RR_TEAM_COUNTS = RR_TEAM_COUNTS;
window.OLY_TEAM_COUNTS = OLY_TEAM_COUNTS;
window.SKIP_BEST_WINNER_COUNTS = SKIP_BEST_WINNER_COUNTS;
window.MIXED_SYSTEMS = MIXED_SYSTEMS;
window.MIXED_SYSTEM_CONFIGS = MIXED_SYSTEM_CONFIGS;
window.MIXED_TEAM_COUNTS = MIXED_TEAM_COUNTS;
window.shuffleArray = shuffleArray;
window.formatSport = formatSport;
window.formatDateRu = formatDateRu;
window.uid = uid;
window.AppBrand = AppBrand;

