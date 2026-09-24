const TournamentStorage = {
  KEY: 'sport_tournaments_v2',
  _cache: null,
  _loaded: false,

  async _ensureLoaded() {
    if (this._loaded) return;
    await IdbStorage.ready();
    this._cache = IdbStorage.get(this.KEY, []);
    this._loaded = true;
  },

  _read() {
    if (this._cache) return this._cache;
    if (this._loaded) return [];
    if (typeof IdbStorage !== 'undefined') {
      this._cache = IdbStorage.get(this.KEY, []);
      this._loaded = true;
      return this._cache;
    }
    return [];
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
    return this._read().find((t) => t.id === id) || null;
  },

  save(tournament) {
    const list = this._read();
    const idx = list.findIndex((t) => t.id === tournament.id);
    tournament.updatedAt = new Date().toISOString();
    if (idx >= 0) list[idx] = tournament;
    else list.push(tournament);
    this._write(list);
    return tournament;
  },

  remove(id) {
    this._write(this._read().filter((t) => t.id !== id));
  },

  create(type, systemId) {
    const teamCounts = type === 'round-robin' ? RR_TEAM_COUNTS : (type === 'olympic' ? OLY_TEAM_COUNTS : (MIXED_TEAM_COUNTS[systemId] || [4]));
    const defaultTeams = teamCounts[0] || 4;

    let state;
    if (type === 'round-robin') {
      state = { phase: 'roundRobin', teams: [], roundRobin: { teams: [], matches: [], generated: false }, playoff: { bracket: null, seededFrom: null } };
    } else if (type === 'olympic') {
      state = { phase: 'olympic', teams: [], roundRobin: null, playoff: { teams: [], bracket: { rounds: [], thirdPlaceMatch: null, finalMatch: null }, matchHistory: [], generated: false } };
    } else if (type === 'mixed') {
      const config = MIXED_SYSTEM_CONFIGS[systemId] || {};
      const groupCount = config.groups || 1;
      const groups = groupCount > 1 ? {} : undefined;
      state = { phase: 'group', teams: [], roundRobin: { teams: [], matches: [], generated: false }, playoff: { bracket: null, seededFrom: null }, groups };
    }

    const t = {
      id: uid(),
      type,
      meta: {
        systemId: systemId || null,
        eventName: '',
        venue: VENUES[0],
        sport: SPORTS[0],
        eventDate: new Date().toISOString().slice(0, 10),
        numTeams: defaultTeams
      },
      state,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return this.save(t);
  },

  isAllMatchesFinished(tournament) {
    if (!tournament || !tournament.state || !tournament.state.roundRobin) return false;
    const matches = tournament.state.roundRobin.matches;
    if (!matches || matches.length === 0) return false;
    return matches.every(m => m.isPlayed === true);
  },

  hasPlayoffResults(tournament) {
    if (!tournament || !tournament.state || !tournament.state.playoff) return false;
    const bracket = tournament.state.playoff.bracket;
    if (!bracket) return false;
    if (bracket.rounds && bracket.rounds.length > 0) {
      for (const round of bracket.rounds) {
        if (round.matches && round.matches.some(m => m.isFinished)) return true;
      }
    }
    if (bracket.finalMatch && bracket.finalMatch.isFinished) return true;
    if (bracket.thirdPlaceMatch && bracket.thirdPlaceMatch.isFinished) return true;
    return false;
  }
};

window.TournamentStorage = TournamentStorage;

