const SCORE_SPORTS = {
  basketball: { id: 'basketball', label: 'Баскетбол' },
  streetball: { id: 'streetball', label: 'Стритбол' },
  volleyball: { id: 'volleyball', label: 'Волейбол' },
  football: { id: 'football', label: 'Футбол' },
  hockey: { id: 'hockey', label: 'Хоккей' },
  one_period: { id: 'one_period', label: 'Один период' },
  tennis: { id: 'tennis', label: 'Теннис' }
};

function scoreUid() {
  return 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function createTimerState() {
  return { elapsedMs: 0, running: false, lastTick: null };
}

const ScoreStorage = {
  KEY: 'sport_scoreboards_v1',
  _cache: null,
  _loaded: false,

  async _ensureLoaded() {
    if (this._loaded) return;
    await IdbStorage.ready();
    this._cache = IdbStorage.get(this.KEY, []);
    this._loaded = true;
  },

  _read() {
    return this._cache || [];
  },

  _write(list) {
    this._cache = list;
    IdbStorage.set(this.KEY, list);
  },

  invalidate() {
    this._cache = null;
    this._loaded = false;
  },

  list() {
    return this._read().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  get(id) {
    return this._read().find((s) => s.id === id) || null;
  },

  getByLinkedId(linkedScoreId) {
    if (!linkedScoreId) return null;
    return this._read().find((s) => s.linkedScoreId === linkedScoreId) || null;
  },

  save(session) {
    const list = this._read();
    const idx = list.findIndex((s) => s.id === session.id);
    session.updatedAt = new Date().toISOString();
    if (idx >= 0) list[idx] = session;
    else list.push(session);
    this._write(list);
    return session;
  },

  remove(id) {
    this._write(this._read().filter((s) => s.id !== id));
  },

  create(sport) {
    const base = {
      id: scoreUid(),
      sport,
      teamA: 'Команда А',
      teamB: 'Команда Б',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (sport === 'tennis') {
      base.teamA = 'Теннисист А';
      base.teamB = 'Теннисист Б';
    }

    if (sport === 'basketball') {
      base.state = {
        timer: createTimerState(),
        scoreA: 0, scoreB: 0,
        penaltyCurrentA: 0, penaltyCurrentB: 0,
        penaltyHistoryA: [], penaltyHistoryB: [],
        playersA: {}, playersB: {},
        currentPeriod: 1, matchFinished: false, periods: []
      };
    } else if (sport === 'streetball') {
      base.state = {
        timer: createTimerState(),
        scoreA: 0, scoreB: 0,
        regularTimeA: 0, regularTimeB: 0,
        overtimeScoreA: 0, overtimeScoreB: 0,
        penaltyA: 0, penaltyB: 0,
        phase: 'active', matchFinished: false,
        overtimeActive: false, timerRunning: false,
        timerElapsedMs: 0, winner: null
      };
    } else if (sport === 'volleyball') {
      base.state = {
        timer: createTimerState(),
        setNumber: 1, setsWonA: 0, setsWonB: 0,
        current: { pointsA: 0, pointsB: 0 }, sets: []
      };
    } else if (sport === 'hockey') {
      base.state = {
        timer: { elapsedMs: 0, running: false, lastTick: null, totalSeconds: 0 },
        phase: 'period1', scoreA: 0, scoreB: 0,
        periods: [], overtimePeriods: [],
        overtime: { scoreA: 0, scoreB: 0, period: 1 },
        penaltyShootouts: { shotsA: [], shotsB: [] },
        penaltyShootoutsFinished: false, winner: null,
        teamA: 'Команда А', teamB: 'Команда Б',
        teamAPenalties: [], teamBPenalties: []
      };
    } else if (sport === 'one_period') {
      base.state = {
        timer: createTimerState(),
        scoreA: 0, scoreB: 0, periods: [], matchFinished: false
      };
    } else if (sport === 'tennis') {
      base.state = {
        timer: createTimerState(), sets: [],
        currentSet: {
          gamesA: 0, gamesB: 0,
          game: { pointA: 0, pointB: 0, advantage: null },
          tiebreak: { pointA: 0, pointB: 0, servingA: true },
          tiebreakActive: false
        },
        matchFinished: false
      };
    } else {
      base.state = {
        timer: createTimerState(),
        phase: 'half1', scoreA: 0, scoreB: 0, halves: [],
        regularTotalA: 0, regularTotalB: 0,
        extra: { scoreA: 0, scoreB: 0, active: false, recorded: false },
        penalties: { shotsA: [], shotsB: [] },
        penaltiesFinished: false, winner: null
      };
    }

    return this.save(base);
  }
};

window.SCORE_SPORTS = SCORE_SPORTS;
window.scoreUid = scoreUid;
window.createTimerState = createTimerState;
window.ScoreStorage = ScoreStorage;

