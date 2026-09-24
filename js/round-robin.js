const RoundRobinEngine = {
  /**
   * @param {{ random?: boolean }} options — random: true (по умолчанию) случайный порядок матчей; false — расписание по турам
   */
  generateMatches(teams, options = {}) {
    const random = options.random !== false;
    const n = teams.length;

    if (!random && ROUND_ROBIN_SCHEDULES[n]) {
      return this._matchesFromSchedule(n);
    }

    const matches = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        matches.push({
          teamA: i,
          teamB: j,
          scoreA: null,
          scoreB: null,
          isPlayed: false,
          tour: null,
          matchInTour: null
        });
      }
    }
    return shuffleArray(matches);
  },

  _matchesFromSchedule(n) {
    const spec = ROUND_ROBIN_SCHEDULES[n];
    const matches = [];
    let globalIdx = 0;

    spec.tours.forEach((tour, tourIdx) => {
      const tourNum = tourIdx + 1;
      tour.pairs.forEach((pair, pairIdx) => {
        const [a, b] = pair;
        matches.push({
          teamA: a - 1,
          teamB: b - 1,
          scoreA: null,
          scoreB: null,
          isPlayed: false,
          tour: tourNum,
          matchInTour: pairIdx + 1,
          restTeam: tour.rest != null ? tour.rest - 1 : null
        });
        globalIdx++;
      });
    });

    return matches;
  },

  getTourGroups(matches) {
    const byTour = new Map();
    matches.forEach((m, i) => {
      const key = m.tour != null ? m.tour : 0;
      if (!byTour.has(key)) byTour.set(key, { tour: key, matches: [], restTeam: null });
      const g = byTour.get(key);
      g.matches.push({ match: m, index: i });
      if (m.restTeam != null) g.restTeam = m.restTeam;
    });
    return [...byTour.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, g]) => g);
  },

  initStandings(teams, sport) {
    const base = {
      name: '',
      index: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
      place: 0,
      headToHead: {}
    };
    if (sport === 'хоккей') {
      return teams.map((name, index) => ({
        ...base,
        name,
        index,
        wins: 0,
        winsOT: 0,
        winsSO: 0,
        lossesSO: 0,
        lossesOT: 0,
        losses: 0
      }));
    }
    return teams.map((name, index) => ({
      ...base,
      name,
      index,
      wins: 0,
      draws: 0,
      losses: 0
    }));
  },

calculateStandings(teams, matches, sport) {
    const isHockey = sport === 'хоккей';
    const isVolleyball = sport === 'волейбол';
    const standings = this.initStandings(teams, sport);

    matches.forEach((match) => {
      if (!match.isPlayed || match.scoreA === null || match.scoreB === null) return;
      const teamA = standings[match.teamA];
      const teamB = standings[match.teamB];

      teamA.goalsFor += match.scoreA;
      teamA.goalsAgainst += match.scoreB;
      teamB.goalsFor += match.scoreB;
      teamB.goalsAgainst += match.scoreA;

      if (isHockey) {
        const rt = match.resultType || 'regulation';
        if (match.scoreA > match.scoreB) {
          if (rt === 'overtime') { teamA.winsOT++; teamA.points += 2; teamB.lossesOT++; teamB.points += 1; }
          else if (rt === 'shootout') { teamA.winsSO++; teamA.points += 2; teamB.lossesSO++; teamB.points += 1; }
          else { teamA.wins++; teamA.points += 2; teamB.losses++; }
          teamA.headToHead[match.teamB] = 'win';
          teamB.headToHead[match.teamA] = 'loss';
        } else if (match.scoreB > match.scoreA) {
          if (rt === 'overtime') { teamB.winsOT++; teamB.points += 2; teamA.lossesOT++; teamA.points += 1; }
          else if (rt === 'shootout') { teamB.winsSO++; teamB.points += 2; teamA.lossesSO++; teamA.points += 1; }
          else { teamB.wins++; teamB.points += 2; teamA.losses++; }
          teamA.headToHead[match.teamB] = 'loss';
          teamB.headToHead[match.teamA] = 'win';
        } else {
          teamA.headToHead[match.teamB] = 'draw';
          teamB.headToHead[match.teamA] = 'draw';
        }
      } else if (isVolleyball) {
        if (match.scoreA > match.scoreB) {
          teamA.wins++;
          teamB.losses++;
          if (match.scoreB <= 1) {
            teamA.points += 3;
          } else {
            teamA.points += 2;
            teamB.points += 1;
          }
          teamA.headToHead[match.teamB] = 'win';
          teamB.headToHead[match.teamA] = 'loss';
        } else if (match.scoreA < match.scoreB) {
          teamB.wins++;
          teamA.losses++;
          if (match.scoreA <= 1) {
            teamB.points += 3;
          } else {
            teamB.points += 2;
            teamA.points += 1;
          }
          teamA.headToHead[match.teamB] = 'loss';
          teamB.headToHead[match.teamA] = 'win';
        } else {
          teamA.draws++;
          teamB.draws++;
          teamA.points += 1;
          teamB.points += 1;
          teamA.headToHead[match.teamB] = 'draw';
          teamB.headToHead[match.teamA] = 'draw';
        }
      } else {
        if (match.scoreA > match.scoreB) {
          teamA.wins++;
          teamB.losses++;
          teamA.points += 3;
          teamA.headToHead[match.teamB] = 'win';
          teamB.headToHead[match.teamA] = 'loss';
        } else if (match.scoreA < match.scoreB) {
          teamB.wins++;
          teamA.losses++;
          teamB.points += 3;
          teamA.headToHead[match.teamB] = 'loss';
          teamB.headToHead[match.teamA] = 'win';
        } else {
          teamA.draws++;
          teamB.draws++;
          teamA.points += 1;
          teamB.points += 1;
          teamA.headToHead[match.teamB] = 'draw';
          teamB.headToHead[match.teamA] = 'draw';
        }
      }
    });

    const sorted = [...standings].sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;

      const h2hA = a.headToHead[b.index];
      const h2hB = b.headToHead[a.index];
      if (h2hA === 'win' && h2hB === 'loss') return -1;
      if (h2hA === 'loss' && h2hB === 'win') return 1;

      const diffA = a.goalsFor - a.goalsAgainst;
      const diffB = b.goalsFor - b.goalsAgainst;
      if (diffA !== diffB) return diffB - diffA;

      if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
      return a.name.localeCompare(b.name, 'ru');
    });

    sorted.forEach((team, i) => {
      standings.find((t) => t.index === team.index).place = i + 1;
    });

    return sorted;
  },

  getMatchCell(matches, teamIdx, oppIdx) {
    const match = matches.find(
      (m) =>
        (m.teamA === teamIdx && m.teamB === oppIdx) ||
        (m.teamA === oppIdx && m.teamB === teamIdx)
    );
    if (!match || !match.isPlayed || match.scoreA === null) return null;
    if (match.teamA === teamIdx) return { scored: match.scoreA, conceded: match.scoreB };
    return { scored: match.scoreB, conceded: match.scoreA };
  },

  async exportXlsx(meta, teams, matches, standings, sport) {
    await SheetJSLoader.load();
    if (typeof XLSX === 'undefined') {
      throw new Error('библиотека Excel не загружена');
    }
    const n = teams.length;
    const wsData = [];

    wsData[0] = [];
    wsData[0][2] = meta.eventName || 'Мероприятие';
    wsData[0][5] = formatSport(meta.sport);

    wsData[1] = [];
    wsData[1][2] = meta.venue || '';

    wsData[2] = [];
    wsData[2][2] = formatDateRu(meta.eventDate);

    standings.forEach((team, rowOffset) => {
      const r = 3 + rowOffset;
      wsData[r] = wsData[r] || [];
      wsData[r][0] = team.index + 1;
      wsData[r][1] = team.name;

      for (let j = 0; j < n; j++) {
        const col = 2 + j;
        if (j === team.index) {
          wsData[r][col] = '—';
        } else {
          const cell = this.getMatchCell(matches, team.index, j);
          wsData[r][col] = cell ? `${cell.scored}:${cell.conceded}` : '—';
        }
      }

const base = 2 + n;
      const gd = team.goalsFor - team.goalsAgainst;
      const isHockey = sport === 'хоккей';
      if (isHockey) {
        wsData[r][base] = team.wins;
        wsData[r][base + 1] = team.winsOT || 0;
        wsData[r][base + 2] = team.winsSO || 0;
        wsData[r][base + 3] = team.lossesSO || 0;
        wsData[r][base + 4] = team.lossesOT || 0;
        wsData[r][base + 5] = team.losses;
        wsData[r][base + 6] = team.goalsFor;
        wsData[r][base + 7] = team.goalsAgainst;
        wsData[r][base + 8] = gd;
        wsData[r][base + 9] = team.points;
        wsData[r][base + 10] = team.place || '';
      } else {
        wsData[r][base] = team.wins;
        wsData[r][base + 1] = team.draws;
        wsData[r][base + 2] = team.losses;
        wsData[r][base + 3] = team.goalsFor;
        wsData[r][base + 4] = team.goalsAgainst;
        wsData[r][base + 5] = gd;
        wsData[r][base + 6] = team.points;
        wsData[r][base + 7] = team.place || '';
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Турнирная таблица');
    const name = (meta.eventName || 'турнир').replace(/[<>:"/\\|?*]/g, '_');
    downloadXlsxWorkbook(wb, `${name}.xlsx`);
  }
};

window.RoundRobinEngine = RoundRobinEngine;

