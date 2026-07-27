const SCORE_SPORTS = {
  basketball: { id: 'basketball', label: 'Баскетбол' },
  volleyball: { id: 'volleyball', label: 'Волейбол' },
  football: { id: 'football', label: 'Футбол, хоккей' }
};

function scoreUid() {
  return 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function createTimerState() {
  return { elapsedMs: 0, running: false, lastTick: null };
}

const ScoreStorage = {
  KEY: 'sport_scoreboards_v1',

  _read() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    } catch {
      return [];
    }
  },

  _write(list) {
    localStorage.setItem(this.KEY, JSON.stringify(list));
  },

  list() {
    return this._read().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  get(id) {
    return this._read().find((s) => s.id === id) || null;
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

    if (sport === 'basketball') {
      base.state = {
        timer: createTimerState(),
        scoreA: 0,
        scoreB: 0,
        currentPeriod: 1,
        matchFinished: false,
        periods: []
      };
    } else if (sport === 'volleyball') {
      base.state = {
        timer: createTimerState(),
        setNumber: 1,
        setsWonA: 0,
        setsWonB: 0,
        current: { pointsA: 0, pointsB: 0, matchBall: false },
        sets: []
      };
    } else {
      base.state = {
        timer: createTimerState(),
        phase: 'half1',
        scoreA: 0,
        scoreB: 0,
        halves: [],
        regularTotalA: 0,
        regularTotalB: 0,
        extra: { scoreA: 0, scoreB: 0, active: false, recorded: false },
        penalties: { shotsA: [], shotsB: [] },
        penaltiesFinished: false,
        winner: null
      };
    }

    return this.save(base);
  }
};
