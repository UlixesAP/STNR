const ScoreboardTennis = {
  _gamePointDisplay(p, adv) {
    if (p === -1) return '-';
    if (adv === 'A' && p === 4) return 'АД';
    if (adv === 'B' && p === 4) return 'АД';
    if (adv === 'A' && p === -1) return '-';
    if (adv === 'B' && p === -1) return '-';
    const labels = ['0', '15', '30', '40'];
    if (p >= 0 && p < 3) return labels[p];
    if (p === 3) return '40';
    return String(p);
  },

  _gameWon(game) {
    if (game.advantage === 'A' && game.pointA >= 4) return 'A';
    if (game.advantage === 'B' && game.pointB >= 4) return 'B';
    if (game.pointA >= 4 && (game.pointA - game.pointB) >= 2) return 'A';
    if (game.pointB >= 4 && (game.pointB - game.pointA) >= 2) return 'B';
    return null;
  },

  _htmlTennis(session) {
    const st = session.state;
    const cs = st.currentSet;
    const setResults = st.sets || [];
    const finished = st.matchFinished;

    const setRows = setResults
      .map((s, i) => `
        <div class="score-history-row">
          <span>Сет ${i + 1}</span>
          <strong>${s.gamesA} : ${s.gamesB}</strong>
        </div>
      `)
      .join('');

    const phaseText = finished
      ? 'Матч завершён'
      : cs.tiebreakActive
        ? 'Тай-брейк'
        : 'Игра';

    const setCountA = setResults.reduce((s, s2) => s + (s2.winner === 'A' ? 1 : 0), 0);
    const setCountB = setResults.reduce((s, s2) => s + (s2.winner === 'B' ? 1 : 0), 0);

    const displayA = this._gamePointDisplay(cs.game.pointA, cs.game.advantage);
    const displayB = this._gamePointDisplay(cs.game.pointB, cs.game.advantage);

    const tbDisplayA = cs.tiebreakActive ? this._gamePointDisplay(cs.tiebreak.pointA, null) : displayA;
    const tbDisplayB = cs.tiebreakActive ? this._gamePointDisplay(cs.tiebreak.pointB, null) : displayB;

    return `
      <section class="glass scoreboard-card scoreboard-card--tennis">
        <p class="score-phase-badge">${phaseText}</p>

        <div class="score-tennis-match">
          <div class="score-tennis-player score-tennis-player--left">
            <input type="text" class="score-team-name" data-team-name="A" value="${this.esc(session.teamA)}" placeholder="Игрок 1">
            <div class="score-sets-won">Выиграно сетов: <strong>${setCountA}</strong></div>
            <div class="score-tennis-points score-tennis-points--big">${cs.tiebreakActive ? tbDisplayA : displayA}</div>
          </div>

          <div class="score-tennis-match-center">
            <h3 class="section-title">Сетка матча</h3>
            <div class="score-tennis-sets-table">
              ${setResults.length
                ? setRows
                : '<p class="score-empty-hint">Результаты сетов появятся после их завершения</p>'
              }
            </div>
          </div>

          <div class="score-tennis-player score-tennis-player--right">
            <input type="text" class="score-team-name" data-team-name="B" value="${this.esc(session.teamB)}" placeholder="Игрок 2">
            <div class="score-sets-won">Выиграно сетов: <strong>${setCountB}</strong></div>
            <div class="score-tennis-points score-tennis-points--big">${cs.tiebreakActive ? tbDisplayB : displayB}</div>
          </div>
        </div>

        <div class="score-tennis-game-info">
          <div class="score-tennis-sets-info">
            <span>Текущий сет: <strong>${cs.gamesA} : ${cs.gamesB}</strong></span>
            ${cs.tiebreakActive ? '<span class="score-tennis-tb-badge">Тай-брейк</span>' : ''}
          </div>
        </div>

        ${!finished ? `
        <div class="score-tennis-actions">
          <button type="button" class="btn btn-sm btn-success" data-tn-pts="A">+ Очко</button>
          <button type="button" class="btn btn-sm btn-success" data-tn-pts="B">+ Очко</button>
        </div>` : ''}

        ${finished ? '<p class="score-winner" style="text-align:center;font-size:1.25rem;margin:0.5rem 0">Матч завершён</p>' : ''}
      </section>
    `;
  },

  _bindTennis(root, session) {
    const st = session.state;
    const persist = () => ScoreStorage.save(session);
    const rerender = () => this.renderSession(root, session);

    root.querySelectorAll('[data-tn-pts]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (st.matchFinished) return;
        this._syncNames(session, root);
        const side = btn.dataset.tnPts;

        this._gamePoint(st, side, session);

        persist();
        rerender();
      });
    });

    root.querySelectorAll('[data-team-name]').forEach((inp) => {
      inp.addEventListener('change', () => {
        this._syncNames(session, root);
        persist();
      });
    });
  },

  _gamePoint(st, side, session) {
    const cs = st.currentSet;
    const game = cs.tiebreakActive ? cs.tiebreak : cs.game;

    if (game.advantage === null) {
      if (side === 'A') game.pointA++;
      else game.pointB++;

      // Проверка победы в гейме: 4+ очков и разница >= 2
      if (game.pointA >= 4 && (game.pointA - game.pointB) >= 2) {
        this._winGame(st, session);
        return;
      }
      if (game.pointB >= 4 && (game.pointB - game.pointA) >= 2) {
        this._winGame(st, session);
        return;
      }

      if (game.pointA >= 3 && game.pointB >= 3) {
        if (game.pointA === game.pointB) {
          game.advantage = 'deuce';
        } else if (game.pointA > game.pointB) {
          game.advantage = 'A';
          game.pointB = -1;
        } else {
          game.advantage = 'B';
          game.pointA = -1;
        }
      }
    } else if (game.advantage === 'deuce') {
      if (side === 'A') {
        game.advantage = 'A';
        game.pointB = -1;
      } else {
        game.advantage = 'B';
        game.pointA = -1;
      }
    } else if (game.advantage === 'A') {
      if (side === 'A') {
        this._winGame(st, session);
      } else {
        game.advantage = 'deuce';
        game.pointA = 3;
        game.pointB = 3;
      }
    } else if (game.advantage === 'B') {
      if (side === 'B') {
        this._winGame(st, session);
      } else {
        game.advantage = 'deuce';
        game.pointA = 3;
        game.pointB = 3;
      }
    }
  },

  _winGame(st, session) {
    const cs = st.currentSet;
    const game = cs.tiebreakActive ? cs.tiebreak : cs.game;

    if (game.pointA > game.pointB) cs.gamesA++;
    else cs.gamesB++;
    this._checkSetWin(st, session);
    if (!st.matchFinished) {
      if (cs.tiebreakActive) {
        cs.tiebreakActive = false;
        cs.tiebreak.pointA = 0;
        cs.tiebreak.pointB = 0;
        cs.tiebreak.servingA = !cs.tiebreak.servingA;
      }
      cs.game.pointA = 0;
      cs.game.pointB = 0;
      cs.game.advantage = null;
    }
  },

  _checkSetWin(st, session) {
    const cs = st.currentSet;

    if (!st.sets) st.sets = [];

    const gamesA = cs.gamesA;
    const gamesB = cs.gamesB;

    if (gamesA >= 6 && (gamesA - gamesB) >= 2) {
      this._finishSet(st, 'A', session);
    } else if (gamesB >= 6 && (gamesB - gamesA) >= 2) {
      this._finishSet(st, 'B', session);
    } else if (gamesA === 7 && gamesB === 5) {
      this._finishSet(st, 'A', session);
    } else if (gamesB === 7 && gamesA === 5) {
      this._finishSet(st, 'B', session);
    } else if (gamesA === 6 && gamesB === 6) {
      cs.tiebreakActive = true;
      cs.tiebreak.pointA = 0;
      cs.tiebreak.pointB = 0;
    }
  },

  _finishSet(st, winner, session) {
    const cs = st.currentSet;
    st.sets.push({
      gamesA: cs.gamesA,
      gamesB: cs.gamesB,
      winner
    });

    let matchEnded = false;
    if (st.sets.length >= 2) {
      const setsWonA = st.sets.filter(s => s.winner === 'A').length;
      const setsWonB = st.sets.filter(s => s.winner === 'B').length;
      if (setsWonA >= 2 || setsWonB >= 2) {
        st.matchFinished = true;
        matchEnded = true;
      }
    }

    cs.gamesA = 0;
    cs.gamesB = 0;
    cs.game.pointA = 0;
    cs.game.pointB = 0;
    cs.game.advantage = null;
    cs.tiebreakActive = false;
    cs.tiebreak.pointA = 0;
    cs.tiebreak.pointB = 0;

    // Синхронизируем с турниром при завершении матча
    if (matchEnded && session && session.tournamentId) {
      ScoreboardApp._syncToTournament(session);
    }
  },
};

window.ScoreboardTennis = ScoreboardTennis;

