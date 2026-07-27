const TournamentStorage = {
  KEY: 'sport_tournaments_v2',

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

  create(type) {
    const t = {
      id: uid(),
      type,
      meta: {
        eventName: '',
        venue: VENUES[0],
        sport: SPORTS[0],
        eventDate: new Date().toISOString().slice(0, 10),
        numTeams: type === 'round-robin' ? 4 : 8
      },
      state: type === 'round-robin'
        ? { teams: [], matches: [], generated: false }
        : { teams: [], bracket: { rounds: [], thirdPlaceMatch: null, finalMatch: null }, matchHistory: [], generated: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return this.save(t);
  }
};
