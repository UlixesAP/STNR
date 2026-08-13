const ScoreboardApp = {
  esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  },

  _syncNames(session, root) {
    session.teamA = root.querySelector('[data-team-name="A"]')?.value || session.teamA;
    session.teamB = root.querySelector('[data-team-name="B"]')?.value || session.teamB;
  },

  _disableMatchControls(root) {
    // Блокируем все кнопки управления матчем
    root.querySelectorAll('.score-pt-btn, .btn[data-bb-record], .btn[data-bb-reset], ' +
      '.btn[data-bb-penalty], .btn[data-register-player], .btn[data-ind-penalty], ' +
      '.btn[data-fb-end-half], .btn[data-fb-end-match], .btn[data-fb-extra], ' +
      '.btn[data-fb-penalties], .btn[data-fb-end-extra], .btn[data-fb-finish-draw], ' +
      '.btn[data-fb-end-penalties], .btn[data-ps], .btn[data-ps-cancel], .btn[data-ps-restart], ' +
      '.btn[data-ps-finish], .btn[data-op-end-period], .btn[data-op-finish-match], ' +
      '.btn[data-vb-pts], .btn[data-vb-end-set]').forEach((btn) => {
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.style.pointerEvents = 'none';
    });
  },

  _isMatchFinished(session) {
    const st = session.state;
    const sport = session.sport;
    
    if (sport === 'volleyball') {
      return st.setsWonA >= 3 || st.setsWonB >= 3 || st.sets.length >= 5;
    }
    if (sport === 'tennis') {
      return st.matchFinished === true;
    }
    if (sport === 'basketball') {
      return st.matchFinished === true;
    }
    if (sport === 'streetball') {
      return st.matchFinished === true;
    }
    if (sport === 'one_period') {
      return st.matchFinished === true;
    }
    // football, hockey и другие с фазой
    return st.phase === 'finished';
  },

  _getMatchScores(session) {
    const st = session.state;
    const sport = session.sport;
    
    if (sport === 'volleyball') {
      // Для волейбола возвращаем счёт по сетам
      return {
        scoreA: st.setsWonA,
        scoreB: st.setsWonB,
        regularTotalA: st.setsWonA,
        regularTotalB: st.setsWonB
      };
    }
    if (sport === 'tennis') {
      // Для тенниса возвращаем счёт по сетам
      const sets = st.sets || [];
      const gamesA = sets.reduce((sum, s) => sum + s.gamesA, 0);
      const gamesB = sets.reduce((sum, s) => sum + s.gamesB, 0);
      return {
        scoreA: gamesA,
        scoreB: gamesB,
        regularTotalA: gamesA,
        regularTotalB: gamesB
      };
    }
    if (sport === 'basketball') {
      const totals = this._computeTotals(st);
      return {
        scoreA: st.scoreA,
        scoreB: st.scoreB,
        regularTotalA: totals.periodA,
        regularTotalB: totals.periodB
      };
    }
    if (sport === 'streetball') {
      const totalA = st.regularTimeA + (st.overtimeScoreA || 0);
      const totalB = st.regularTimeB + (st.overtimeScoreB || 0);
      return {
        scoreA: totalA,
        scoreB: totalB,
        regularTotalA: st.regularTimeA,
        regularTotalB: st.regularTimeB,
        extraScoreA: st.overtimeScoreA || 0,
        extraScoreB: st.overtimeScoreB || 0
      };
    }
    if (sport === 'one_period') {
      const totals = this._computeTotals(st);
      return {
        scoreA: st.scoreA + totals.periodA,
        scoreB: st.scoreB + totals.periodB,
        regularTotalA: st.scoreA + totals.periodA,
        regularTotalB: st.scoreB + totals.periodB
      };
    }
    // football
    const regularA = st.regularTotalA ?? st.scoreA ?? 0;
    const regularB = st.regularTotalB ?? st.scoreB ?? 0;
    
    // Вычисляем счёт дополнительного времени
    let extraA = 0;
    let extraB = 0;
    if (st.extra && st.extra.recorded) {
      extraA = st.extra.scoreA || 0;
      extraB = st.extra.scoreB || 0;
    }
    
    // Вычисляем общий счёт основного + дополнительного времени
    const totalWithOvertimeA = regularA + extraA;
    const totalWithOvertimeB = regularB + extraB;
    
    // Если матч завершён после серии пенальти
    if (st.phase === 'finished' && st.penalties && st.penalties.shotsA && st.penalties.shotsA.length > 0) {
      const scoredA = st.penalties.shotsA.filter(Boolean).length;
      const scoredB = st.penalties.shotsB.filter(Boolean).length;
      return { 
        // scoreA/scoreB - всегда общий счёт основного + дополнительного времени
        scoreA: totalWithOvertimeA, 
        scoreB: totalWithOvertimeB, 
        regularTotalA: regularA, 
        regularTotalB: regularB,
        // extraScoreA/extraScoreB - счёт в дополнительном времени
        extraScoreA: extraA,
        extraScoreB: extraB,
        // penaltyA/penaltyB - результат серии пенальти
        penaltyA: scoredA,
        penaltyB: scoredB,
        wasDecidedByPenalties: regularA === regularB && extraA === extraB
      };
    }
    return { 
      scoreA: totalWithOvertimeA, 
      scoreB: totalWithOvertimeB, 
      regularTotalA: regularA, 
      regularTotalB: regularB,
      extraScoreA: extraA,
      extraScoreB: extraB,
      penaltyA: null,
      penaltyB: null,
      wasDecidedByPenalties: false
    };
  },

  _syncToTournament(session) {
    if (!session.tournamentId || (session.matchIndex == null && session.bracketMatch == null)) return;
    try {
      console.log('[Scoreboard] _syncToTournament called for:', session.tournamentId);
      const tournamentsRaw = localStorage.getItem('sport_tournaments_v1');
      if (!tournamentsRaw) return;
      const tournaments = JSON.parse(tournamentsRaw);
      const t = tournaments.find(x => x.id === session.tournamentId);
      if (!t) return;

      const st = session.state;
      if (!this._isMatchFinished(session)) {
        return;
      }

      const scores = this._getMatchScores(session);
      const regularA = scores.regularTotalA ?? scores.scoreA ?? 0;
      const regularB = scores.regularTotalB ?? scores.scoreB ?? 0;
      const finalScoreA = scores.scoreA;
      const finalScoreB = scores.scoreB;

      if (t.type === 'round-robin') {
        const match = t.state.matches?.[session.matchIndex];
        if (!match) return;
        // Разрешаем обновление результата, если изменились финальные очки (например, добавлены пенальти)
        const hasChanged = match.scoreA !== finalScoreA || match.scoreB !== finalScoreB;
        if (match._synced && !hasChanged) return;
        
        match.scoreA = finalScoreA;
        match.scoreB = finalScoreB;
        match.isPlayed = true;
        if (finalScoreA > finalScoreB) {
          match.winner = session.teamA;
        } else if (finalScoreB > finalScoreA) {
          match.winner = session.teamB;
        } else {
          // Ничья по голам — используем победителя из scoreboard (пенальти)
          match.winner = st.winner || null;
        }
        match._synced = true;
        t.updatedAt = new Date().toISOString();
        localStorage.setItem('sport_tournaments_v1', JSON.stringify(tournaments));
      } else if (t.type === 'olympic') {
        const bracket = t.state.bracket;
        let targetMatch = null;
        if (session.bracketMatch) {
          const { kind, rIdx, mIdx } = session.bracketMatch;
          if (kind === 'final') {
            targetMatch = bracket.finalMatch;
          } else if (kind === 'third') {
            targetMatch = bracket.thirdPlaceMatch;
          } else {
            targetMatch = bracket.rounds?.[parseInt(rIdx)]?.matches?.[parseInt(mIdx)];
          }
        }
        if (!targetMatch) return;
        // Разрешаем обновление результата, если изменились финальные очки (например, добавлены пенальти)
        const hasChanged = targetMatch.scoreA !== finalScoreA || targetMatch.scoreB !== finalScoreB;
        if (targetMatch._synced && !hasChanged) return;
        
        targetMatch.scoreA = finalScoreA;
        targetMatch.scoreB = finalScoreB;
        // Сохраняем информацию о дополнительном времени для football
        if (scores.extraScoreA != null) targetMatch.extraScoreA = scores.extraScoreA;
        if (scores.extraScoreB != null) targetMatch.extraScoreB = scores.extraScoreB;
        // Сохраняем информацию о пенальти для football
        if (scores.penaltyA != null) targetMatch.penaltyA = scores.penaltyA;
        if (scores.penaltyB != null) targetMatch.penaltyB = scores.penaltyB;
        if (scores.wasDecidedByPenalties) targetMatch.wasDecidedByPenalties = scores.wasDecidedByPenalties;
        
        if (finalScoreA > finalScoreB) {
          targetMatch.winner = session.teamA;
          targetMatch.loser = session.teamB;
        } else if (finalScoreB > finalScoreA) {
          targetMatch.winner = session.teamB;
          targetMatch.loser = session.teamA;
        } else {
          // Ничья по голам — используем победителя из scoreboard (пенальти)
          if (st.winner) {
            targetMatch.winner = st.winner;
            targetMatch.loser = st.winner === session.teamA ? session.teamB : session.teamA;
          } else {
            targetMatch.winner = null;
            targetMatch.loser = null;
          }
        }
        targetMatch.isFinished = true;
        targetMatch._synced = true;
        t.updatedAt = new Date().toISOString();
        localStorage.setItem('sport_tournaments_v1', JSON.stringify(tournaments));
      }
    } catch (e) {
      console.error('[Scoreboard] Failed to sync to tournament:', e);
    }
  },

  _computeTotals(st) {
    return {
      periodScores: st.periods ?? [],
      periodA: (st.periods ?? []).reduce((sum, p) => sum + (p.scoreA || 0), 0),
      periodB: (st.periods ?? []).reduce((sum, p) => sum + (p.scoreB || 0), 0),
      overtimePeriodA: (st.overtimePeriods ?? []).reduce((sum, p) => sum + (p.scoreA || 0), 0),
      overtimePeriodB: (st.overtimePeriods ?? []).reduce((sum, p) => sum + (p.scoreB || 0), 0),
      halftimeA: (st.halves ?? []).reduce((sum, h) => sum + (h.scoreA || 0), 0),
      halftimeB: (st.halves ?? []).reduce((sum, h) => sum + (h.scoreB || 0), 0)
    };
  },

  _timerRunning(session) {
    // Для хоккея проверяем hockeyTimer, для остальных — timer
    if (session.sport === 'hockey') {
      return !!(session.state?.hockeyTimer?.running);
    }
    return !!(session.state?.timer?.running);
  },

  renderSportPicker(root) {
    const cards = Object.values(SCORE_SPORTS)
      .map(
        (sp) => `
        <div class="system-card system-card--no-icon" data-score-sport="${sp.id}" role="button" tabindex="0">
          <h3>${sp.label}</h3>
        </div>`
      )
      .join('');

    root.innerHTML = `
      <div class="app-shell">
        <header class="app-header">
          <div class="app-header__top">
            <a href="#/" class="btn btn-ghost btn-sm">← На главную</a>
            <h1 class="page-title-offset">Вести счёт</h1>
            <p class="subtitle">Выберите вид спорта</p>
          </div>
          <div class="app-header__actions">${Theme.controlHtml()}</div>
        </header>
        <section class="glass">
          <div class="system-pick system-pick--3">${cards}</div>
        </section>
      </div>`;

    root.querySelectorAll('[data-score-sport]').forEach((el) => {
      const go = () => {
        location.hash = `#/score/new/${el.dataset.scoreSport}`;
      };
      el.onclick = go;
      el.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      };
    });
  },

  renderSession(root, session) {
    ScoreTimer.clear(session.id);
    // Не сбрасываем HockeyTimer при ререндере — он управляется вручную в _bindHockey
    if (session.sport !== 'hockey') {
      // Для остальных видов спорта HockeyTimer не используется
    }
    const sp = SCORE_SPORTS[session.sport];
    if (!sp) {
      location.hash = '#/score';
      return;
    }

    let body = '';
    if (session.sport === 'basketball') body = this._htmlBasketball(session);
    else if (session.sport === 'streetball') body = this._htmlStreetball(session);
    else if (session.sport === 'volleyball') body = this._htmlVolleyball(session);
    else if (session.sport === 'football') body = this._htmlFootball(session);
    else if (session.sport === 'hockey') body = this._htmlHockey(session);
    else if (session.sport === 'one_period') body = this._htmlOnePeriod(session);
    else if (session.sport === 'tennis') body = this._htmlTennis(session);
    else return;

    root.innerHTML = `
      <div class="app-shell scoreboard-page">
        <header class="app-header">
          <div class="app-header__top">
            <a href="#/score" class="btn btn-ghost btn-sm">← Выбор спорта</a>
            <h1 class="page-title-offset">${sp.label}</h1>
          </div>
          <div class="app-header__actions">
            ${Theme.controlHtml()}
            <button type="button" class="btn btn-warning btn-sm" data-export-score>Excel</button>
            <button type="button" class="btn btn-success btn-sm" data-publish-score>Транслировать онлайн</button>
          </div>
        </header>
        ${body}
      </div>`;

    // Вызов bind-функций
    if (session.sport === 'basketball') this._bindBasketball(root, session);
    else if (session.sport === 'streetball') this._bindStreetball(root, session);
    else if (session.sport === 'volleyball') this._bindVolleyball(root, session);
    else if (session.sport === 'football') this._bindFootball(root, session);
    else if (session.sport === 'hockey') this._bindHockey(root, session);
    else if (session.sport === 'one_period') this._bindOnePeriod(root, session);
    else if (session.sport === 'tennis') this._bindTennis(root, session);

    const persist = () => ScoreStorage.save(session);
    if (session.sport !== 'volleyball' && session.sport !== 'tennis' && session.sport !== 'streetball') {
      ScoreTimer.bind(root, session, persist);
    }

    root.querySelector('[data-export-score]')?.addEventListener('click', () => {
      ScoreExport.exportSession(session);
    });
    root.querySelector('[data-publish-score]')?.addEventListener('click', () => {
      this._publishScoreboard(session);
    });
  },

  // Карта bind-функций для повторного биндинга после ререндера
  _bindMap: {
    basketball: '_bindBasketball',
    streetball: '_bindStreetball',
    volleyball: '_bindVolleyball',
    football: '_bindFootball',
    hockey: '_bindHockey',
    one_period: '_bindOnePeriod',
    tennis: '_bindTennis'
  },

  _rebindAfterRender(root, session) {
    const bindKey = this._bindMap[session.sport];
    if (bindKey && this[bindKey]) {
      this[bindKey](root, session);
    }
  },

  _periodLabelBasketball(n) {
    if (n <= 4) return `Четверть ${n}`;
    return 'Матч завершён';
  },

  _htmlBasketball(session) {
    const st = session.state;
    const periodLabel = this._periodLabelBasketball(st.currentPeriod);
    const finished = st.matchFinished;
    const penaltyCurrentA = st.penaltyCurrentA || 0;
    const penaltyCurrentB = st.penaltyCurrentB || 0;

    const periodRows = st.periods
      .map((p) => {
        const ptsA = p.pointsA != null ? p.pointsA : p.scoreA;
        const ptsB = p.pointsB != null ? p.pointsB : p.scoreB;
        const totA = p.totalA != null ? p.totalA : ptsA;
        const totB = p.totalB != null ? p.totalB : ptsB;
        return `
        <div class="score-history-row">
          <span>Четверть ${p.period}</span>
          <span class="score-period-pts"><strong>${ptsA} : ${ptsB}</strong></span>
          <span class="score-period-total">Счёт ${totA} : ${totB}</span>
          <span class="score-history-time">${this.esc(p.timer || '')}</span>
        </div>`;
      })
      .join('');

    const totalA = st.scoreA;
    const totalB = st.scoreB;

    // Формируем историю штрафов по четвертям
    const penaltyRowsA = (st.penaltyHistoryA || []).map((p, idx) => `<span>Чет ${idx + 1}: ${p}</span>`).join(' · ');
    const penaltyRowsB = (st.penaltyHistoryB || []).map((p, idx) => `<span>Чет ${idx + 1}: ${p}</span>`).join(' · ');
    const totalPenaltyA = (st.penaltyHistoryA || []).reduce((sum, p) => sum + p, 0);
    const totalPenaltyB = (st.penaltyHistoryB || []).reduce((sum, p) => sum + p, 0);

    return `
      <section class="glass scoreboard-card">
        <p class="score-phase-badge">${finished ? 'Матч завершён' : periodLabel}</p>
        <div class="score-duel score-duel--basketball">
          ${this._teamZoneBasketball('A', session.teamA, st.scoreA)}
          ${this._teamZoneBasketball('B', session.teamB, st.scoreB)}
        </div>
        ${
          !finished
            ? `
        <div class="score-actions-row">
          <button type="button" class="btn btn-ghost" data-bb-reset>Сбросить очки текущего периода</button>
          <button type="button" class="btn btn-success" data-bb-record>Записать результат ${st.currentPeriod <= 4 ? periodLabel : 'матча'}</button>
        </div>`
            : ''
        }
        ${
          st.periods.length
            ? `
        <div class="score-history">
          <h3 class="section-title">Результаты четвертей</h3>
          ${periodRows}
          <div class="score-history-row score-history-row--total">
            <span>Итого матч</span>
            <strong>${totalA} : ${totalB}</strong>
          </div>
        </div>`
            : ''
        }
      </section>
      <section class="glass scoreboard-card scoreboard-card--sub">
        <h3 class="section-title">Командные штрафы</h3>
        <div class="score-penalties-duel score-penalties-duel--streetball">
          <div class="score-team-penalty-simple" data-team-penalties="A">
            <p class="score-team-label">${this.esc(session.teamA)}</p>
            <div class="score-penalty-counter">
              <span class="score-penalty-value" data-penalty-display="A">${penaltyCurrentA}</span>
              <div class="score-penalty-buttons">
                <button type="button" class="btn btn-sm btn-success" data-bb-penalty="A:1">+1</button>
                <button type="button" class="btn btn-sm btn-danger" data-bb-penalty="A:-1">−1</button>
              </div>
            </div>
            ${st.penaltyHistoryA && st.penaltyHistoryA.length > 0 ? `<p style="margin-top:0.5rem;font-size:0.8125rem;color:var(--muted);">История: ${penaltyRowsA}</p><p style="font-size:0.875rem;font-weight:600;">Всего: <strong>${totalPenaltyA}</strong></p>` : ''}
          </div>
          <div class="score-team-penalty-simple" data-team-penalties="B">
            <p class="score-team-label">${this.esc(session.teamB)}</p>
            <div class="score-penalty-counter">
              <span class="score-penalty-value" data-penalty-display="B">${penaltyCurrentB}</span>
              <div class="score-penalty-buttons">
                <button type="button" class="btn btn-sm btn-success" data-bb-penalty="B:1">+1</button>
                <button type="button" class="btn btn-sm btn-danger" data-bb-penalty="B:-1">−1</button>
              </div>
            </div>
            ${st.penaltyHistoryB && st.penaltyHistoryB.length > 0 ? `<p style="margin-top:0.5rem;font-size:0.8125rem;color:var(--muted);">История: ${penaltyRowsB}</p><p style="font-size:0.875rem;font-weight:600;">Всего: <strong>${totalPenaltyB}</strong></p>` : ''}
          </div>
        </div>
      </section>

      <section class="glass scoreboard-card scoreboard-card--sub">
        <h3 class="section-title">Индивидуальные штрафы</h3>
        <div class="score-individual-penalties">
          <div class="score-ind-team">
            <h4 style="margin:0 0 0.75rem;text-align:center;">${this.esc(session.teamA)}</h4>
            <div class="score-player-register">
              <input type="number" class="score-player-input" data-register-team="A" placeholder="№ игрока" min="1" max="99">
              <button type="button" class="btn btn-sm btn-success" data-register-player="A">Регистрация</button>
            </div>
            <div class="score-players-list" data-players="A">
              ${this._renderPlayerFouls('A', session.teamA, st.playersA || {})}
            </div>
          </div>
          <div class="score-ind-team">
            <h4 style="margin:0 0 0.75rem;text-align:center;">${this.esc(session.teamB)}</h4>
            <div class="score-player-register">
              <input type="number" class="score-player-input" data-register-team="B" placeholder="№ игрока" min="1" max="99">
              <button type="button" class="btn btn-sm btn-success" data-register-player="B">Регистрация</button>
            </div>
            <div class="score-players-list" data-players="B">
              ${this._renderPlayerFouls('B', session.teamB, st.playersB || {})}
            </div>
          </div>
        </div>
      </section>
      ${ScoreTimer.html()}`;
  },

  _renderPlayerFouls(side, teamName, players) {
    const playerNumbers = Object.keys(players).sort((a, b) => parseInt(a) - parseInt(b));
    if (playerNumbers.length === 0) {
      return '<p style="text-align:center;color:var(--muted);font-size:0.875rem;margin:0;">Нет зарегистрированных игроков</p>';
    }
    return playerNumbers.map(num => {
      const fouls = players[num] || 0;
      return `
        <div class="score-player-row" data-player="${side}:${num}">
          <span class="score-player-number">#${this.esc(num)}</span>
          <span class="score-player-fouls">${fouls}</span>
          <div class="score-player-buttons">
            <button type="button" class="btn btn-xs btn-success" data-ind-penalty="${side}:${num}:1">+1</button>
            <button type="button" class="btn btn-xs btn-danger" data-ind-penalty="${side}:${num}:-1">−1</button>
          </div>
        </div>`;
    }).join('');
  },

  _teamZoneVolleyball(side, name, setsWon, setNumber, points, matchBall) {
    return `
      <div class="score-team-zone" data-team="${side}">
        <input type="text" class="score-team-name" data-team-name="${side}" value="${this.esc(name)}" placeholder="Команда" aria-label="Команда ${side}">
        <div class="score-big" data-vb-${side.toLowerCase()}>${points}</div>
        <span class="score-team-label">Побед в матче: ${setsWon}</span>
        <div class="score-pts-inline">
          <button type="button" class="btn score-pt-btn" data-vb-pts="${side}:1">+1</button>
          <button type="button" class="btn score-pt-btn btn-ghost" data-vb-pts="${side}:-1">−1</button>
        </div>
      </div>`;
  },

  _teamZoneBasketball(side, name, score) {
    return `
      <div class="score-team-zone" data-team="${side}">
        <input type="text" class="score-team-name" data-team-name="${side}" value="${this.esc(name)}" placeholder="Название команды" aria-label="Команда ${side}">
        <div class="score-big" data-score-display="${side}">${score}</div>
        <div class="score-pts-grid">
          <button type="button" class="btn score-pt-btn" data-bb-pts="${side}:3">+3</button>
          <button type="button" class="btn score-pt-btn" data-bb-pts="${side}:2">+2</button>
          <button type="button" class="btn score-pt-btn" data-bb-pts="${side}:1">+1</button>
          <button type="button" class="btn score-pt-btn btn-ghost" data-bb-pts="${side}:-1">−1</button>
          <button type="button" class="btn score-pt-btn btn-danger" data-bb-pts="${side}:-10">−10</button>
        </div>
      </div>`;
  },

  _bindBasketball(root, session) {
    const st = session.state;
    const persist = () => ScoreStorage.save(session);
    const rerender = () => {
      this.renderSession(root, session);
    };

    root.querySelectorAll('[data-bb-pts]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (st.matchFinished) return;
        if (!this._timerRunning(session)) {
          alert('Начните секундомер перед ведением счёта!');
          return;
        }
        this._syncNames(session, root);
        const [side, delta] = btn.dataset.bbPts.split(':');
        const d = parseInt(delta, 10);
        if (side === 'A') st.scoreA = Math.max(0, st.scoreA + d);
        else st.scoreB = Math.max(0, st.scoreB + d);
        persist();
        rerender();
      });
    });

    // Обработка кнопок командных штрафов +1, -1
    root.querySelectorAll('[data-bb-penalty]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (st.matchFinished) return;
        this._syncNames(session, root);
        const [side, delta] = btn.dataset.bbPenalty.split(':');
        const d = parseInt(delta, 10);
        if (side === 'A') st.penaltyCurrentA = (st.penaltyCurrentA || 0) + d;
        else st.penaltyCurrentB = (st.penaltyCurrentB || 0) + d;
        persist();
        rerender();
      });
    });

    root.querySelector('[data-bb-reset]')?.addEventListener('click', () => {
      if (st.matchFinished) return;
      if (!confirm('Убрать очки, набранные в текущем периоде? (общий счёт вернётся к концу прошлого периода)')) return;
      this._syncNames(session, root);
      const last = st.periods[st.periods.length - 1];
      st.scoreA = last ? last.totalA : 0;
      st.scoreB = last ? last.totalB : 0;
      persist();
      rerender();
    });

    root.querySelector('[data-bb-record]')?.addEventListener('click', () => {
      if (st.matchFinished) return;
      this._syncNames(session, root);
      const timer = ScoreTimer.format(ScoreTimer.getElapsedMs(session));
      const last = st.periods[st.periods.length - 1];
      const prevA = last ? last.totalA : 0;
      const prevB = last ? last.totalB : 0;
      const pointsA = st.scoreA - prevA;
      const pointsB = st.scoreB - prevB;
      st.periods.push({
        period: st.currentPeriod,
        pointsA,
        pointsB,
        totalA: st.scoreA,
        totalB: st.scoreB,
        timer
      });

      // Сохраняем текущие штрафы в историю и обнуляем для новой четверти
      const currentPenaltyA = st.penaltyCurrentA || 0;
      const currentPenaltyB = st.penaltyCurrentB || 0;
      if (currentPenaltyA > 0 || currentPenaltyB > 0) {
        if (!st.penaltyHistoryA) st.penaltyHistoryA = [];
        if (!st.penaltyHistoryB) st.penaltyHistoryB = [];
        st.penaltyHistoryA.push(currentPenaltyA);
        st.penaltyHistoryB.push(currentPenaltyB);
        st.penaltyCurrentA = 0;
        st.penaltyCurrentB = 0;
      }

      st.currentPeriod += 1;
      if (st.currentPeriod > 4) {
        st.matchFinished = true;
        // Синхронизируем с турнирной таблицей
        this._syncToTournament(session);
        // Останавливаем и сбрасываем секундомер
        ScoreTimer.reset(session);
        // Блокируем все кнопки управления матчем
        this._disableMatchControls(root);
      } else {
        // Сбрасываем секундомер для нового периода
        ScoreTimer.reset(session);
      }
      persist();
      rerender();
    });

    root.querySelectorAll('[data-team-name]').forEach((inp) => {
      inp.addEventListener('change', () => {
        this._syncNames(session, root);
        persist();
      });
    });

    // Регистрация игроков
    root.querySelectorAll('[data-register-player]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const side = btn.dataset.registerPlayer;
        const input = root.querySelector(`[data-register-team="${side}"]`);
        const playerNum = input?.value?.trim();
        if (!playerNum) {
          alert('Введите номер игрока!');
          input?.focus();
          return;
        }
        
        const playersKey = side === 'A' ? 'playersA' : 'playersB';
        if (!st[playersKey]) st[playersKey] = {};
        
        if (st[playersKey][playerNum] !== undefined) {
          alert('Игрок с таким номером уже зарегистрирован!');
          return;
        }
        
        st[playersKey][playerNum] = 0;
        persist();
        rerender();
      });
    });

    // Индивидуальные штрафы +1, -1
    root.querySelectorAll('[data-ind-penalty]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (st.matchFinished) return;
        this._syncNames(session, root);
        const parts = btn.dataset.indPenalty.split(':');
        const side = parts[0];
        const playerNum = parts[1];
        const d = parseInt(parts[2], 10);
        
        const playersKey = side === 'A' ? 'playersA' : 'playersB';
        if (!st[playersKey]) st[playersKey] = {};
        if (st[playersKey][playerNum] === undefined) return;
        
        st[playersKey][playerNum] = Math.max(0, st[playersKey][playerNum] + d);
        persist();
        rerender();
      });
    });
  },

  _htmlVolleyball(session) {
    const st = session.state;
    const cur = st.current;

    const setHistory = st.sets
      .map(
        (s) => `
      <div class="score-history-row">
        <span>Партия ${s.set}</span>
        <strong>${s.pointsA} : ${s.pointsB}</strong>
      </div>`
      )
      .join('');

    const matchFinished = st.setsWonA >= 3 || st.setsWonB >= 3 || st.sets.length >= 5;
    const winner = st.setsWonA >= 3 ? session.teamA : (st.setsWonB >= 3 ? session.teamB : null);

    return `
      <section class="glass scoreboard-card">
        <p class="score-phase-badge">${matchFinished ? 'Матч завершён' : `Партия ${st.setNumber}`}</p>
        ${winner ? `<p class="score-winner" style="text-align:center;font-size:1.25rem;margin:0.5rem 0">Победитель: ${this.esc(winner)}</p>` : ''}
        <div class="score-duel score-duel--volleyball">
          ${this._teamZoneVolleyball('A', session.teamA, st.setsWonA, st.setNumber, cur.pointsA)}
          ${this._teamZoneVolleyball('B', session.teamB, st.setsWonB, st.setNumber, cur.pointsB)}
        </div>
        <div class="score-actions-row">
          ${matchFinished ? '<p class="muted-desc">Матч завершён. Максимум 5 партий, победа до 3 выигранных партий.</p>' : '<button type="button" class="btn btn-success" data-vb-end-set>Завершить партию</button>'}
        </div>
        ${
          st.sets.length
            ? `<div class="score-history"><h3 class="section-title">Результаты партий</h3>${setHistory}</div>`
            : ''
        }
        <div class="score-match-summary glass">
          <h3 class="section-title">Счёт в матче</h3>
          <div class="score-match-summary-row">
            <span>${this.esc(session.teamA)}</span>
            <strong>${st.setsWonA}</strong>
            <span>:</span>
            <strong>${st.setsWonB}</strong>
            <span>${this.esc(session.teamB)}</span>
          </div>
        </div>
      </section>`;
  },

  _bindVolleyball(root, session) {
    const st = session.state;
    const persist = () => ScoreStorage.save(session);
    const rerender = () => this.renderSession(root, session);

    root.querySelectorAll('[data-vb-pts]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._syncNames(session, root);
        const [side, delta] = btn.dataset.vbPts.split(':');
        const d = parseInt(delta, 10);
        if (side === 'A') st.current.pointsA = Math.max(0, st.current.pointsA + d);
        else st.current.pointsB = Math.max(0, st.current.pointsB + d);
        persist();
        rerender();
      });
    });

    root.querySelector('[data-vb-end-set]')?.addEventListener('click', () => {
      if (st.setsWonA >= 3 || st.setsWonB >= 3 || st.sets.length >= 5) {
        alert('Матч завершён.');
        return;
      }
      this._syncNames(session, root);
      const { pointsA, pointsB } = st.current;
      if (pointsA === pointsB) {
        alert('Счёт партии не может быть ничейным.');
        return;
      }
      if (st.sets.length >= 5) {
        alert('Максимальное количество партий (5) достигнут.');
        return;
      }
      if (pointsA < 25 && pointsB < 25) {
        if (!confirm('Счёт меньше 25. Всё равно завершить партию?')) return;
      }

      st.sets.push({ set: st.setNumber, pointsA, pointsB });
      if (pointsA > pointsB) st.setsWonA += 1;
      else st.setsWonB += 1;
      st.setNumber += 1;
      st.current = { pointsA: 0, pointsB: 0 };
      
      // Проверяем, заверлён ли матч, и синхронизируем
      if (st.setsWonA >= 3 || st.setsWonB >= 3 || st.sets.length >= 5) {
        this._syncToTournament(session);
      }
      
      persist();
      rerender();
    });

    root.querySelectorAll('[data-team-name]').forEach((inp) => {
      inp.addEventListener('change', () => {
        this._syncNames(session, root);
        persist();
      });
    });
  },

  _htmlFootball(session) {
    const st = session.state;
    const phase = st.phase;

    const FOOTBALL_PHASE_LABELS = {
      half1: '1-й тайм',
      half2: '2-й тайм',
      draw_prompt: 'Ничья — выбор',
      extra: 'Дополнительное время',
      extra_draw: 'Ничья после доп. времени',
      penalties: 'Серия пенальти',
      finished: 'Матч завершён'
    };
    const phaseLabel = FOOTBALL_PHASE_LABELS[phase] ?? 'Матч';

    let extraBlock = '';
    if (phase === 'extra' || phase === 'extra_draw' || st.extra.recorded) {
      extraBlock = `
        <section class="glass scoreboard-card scoreboard-card--sub">
          <h3 class="section-title">Дополнительное время</h3>
          <div class="score-duel score-duel--compact">
            ${this._teamZoneFootball('A', session.teamA, st.extra.scoreA, phase === 'extra' || phase === 'extra_draw')}
            ${this._teamZoneFootball('B', session.teamB, st.extra.scoreB, phase === 'extra' || phase === 'extra_draw')}
          </div>
          ${
            phase === 'extra'
              ? `<button type="button" class="btn btn-success score-actions-row" data-fb-end-extra>Завершить доп. время</button>`
              : ''
          }
        </section>`;
    }

    let penaltiesBlock = '';
    if (phase === 'penalties' || st.penalties.shotsA.length) {
      const pa = st.penalties.shotsA;
      const pb = st.penalties.shotsB;
      const scoredA = pa.filter(Boolean).length;
      const scoredB = pb.filter(Boolean).length;
      penaltiesBlock = `
        <section class="glass scoreboard-card scoreboard-card--sub">
          <h3 class="section-title">Серия пенальти</h3>
          <p class="score-penalty-total">${session.teamA}: <strong>${scoredA}</strong> · ${session.teamB}: <strong>${scoredB}</strong></p>
          <div class="score-penalty-grid">
            <div>
              <p class="score-team-label">${this.esc(session.teamA)}</p>
              <button type="button" class="btn btn-sm btn-success" data-pen="A:1">Забил</button>
              <button type="button" class="btn btn-sm btn-danger" data-pen="A:0">Мимо</button>
            </div>
            <div>
              <p class="score-team-label">${this.esc(session.teamB)}</p>
              <button type="button" class="btn btn-sm btn-success" data-pen="B:1">Забил</button>
              <button type="button" class="btn btn-sm btn-danger" data-pen="B:0">Мимо</button>
            </div>
          </div>
          <p class="muted-desc">Удары: ${pa.length} / ${pb.length}</p>
          ${
            pa.length >= 3 && pb.length >= 3 && !st.penaltiesFinished
              ? `<button type="button" class="btn btn-warning" data-fb-end-penalties>Завершить серию пенальти</button>`
              : ''
          }
        </section>`;
    }

    let drawPrompt = '';
    if (phase === 'draw_prompt') {
      drawPrompt = `
        <div class="score-draw-prompt glass">
          <p>Ничья в основное время (${st.regularTotalA}:${st.regularTotalB}). Что дальше?</p>
          <button type="button" class="btn btn-success" data-fb-extra>Дополнительное время</button>
          <button type="button" class="btn btn-warning" data-fb-penalties>Перейти к пенальти</button>
        </div>`;
    }

    if (phase === 'extra_draw') {
      drawPrompt = `
        <div class="score-draw-prompt glass">
          <p>Ничья после доп. времени.</p>
          <button type="button" class="btn btn-success" data-fb-finish-draw>Завершить матч (ничья)</button>
          <button type="button" class="btn btn-warning" data-fb-penalties>Перейти к пенальти</button>
        </div>`;
    }

    let summary = '';
    if (phase === 'finished') {
      // Вычисляем общий счёт основного + дополнительного времени
      const totalA = st.regularTotalA + (st.extra?.scoreA || 0);
      const totalB = st.regularTotalB + (st.extra?.scoreB || 0);
      summary = `
        <section class="glass scoreboard-card">
          <h3 class="section-title">Итог матча</h3>
          <div class="score-summary">
            <p>Основное время: <strong>${st.regularTotalA} : ${st.regularTotalB}</strong></p>
            ${st.extra.recorded ? `<p>Доп. время: <strong>${st.extra.scoreA} : ${st.extra.scoreB}</strong></p>` : ''}
            ${st.extra.recorded ? `<p>Окончательный счёт (осн. + доп.): <strong>${totalA} : ${totalB}</strong></p>` : ''}
            ${
              st.penalties.shotsA.length
                ? `<p>Пенальти (забито): <strong>${st.penalties.shotsA.filter(Boolean).length} : ${st.penalties.shotsB.filter(Boolean).length}</strong></p>`
                : ''
            }
            ${st.winner ? `<p class="score-winner">Победитель: <strong>${this.esc(st.winner)}</strong></p>` : '<p>Результат: ничья</p>'}
          </div>
        </section>`;
    }

    const showMain = ['half1', 'half2'].includes(phase);

    return `
      <section class="glass scoreboard-card">
        <p class="score-phase-badge">${phaseLabel}</p>
        ${
          showMain
            ? `
        <div class="score-duel score-duel--football">
          ${this._teamZoneFootball('A', session.teamA, st.scoreA, true)}
          ${this._teamZoneFootball('B', session.teamB, st.scoreB, true)}
        </div>
        <div class="score-actions-row">
          ${
            phase === 'half1'
              ? '<button type="button" class="btn btn-success" data-fb-end-half>Завершить 1-й тайм</button>'
              : '<button type="button" class="btn btn-success" data-fb-end-match>Завершить матч</button>'
          }
        </div>`
            : ''
        }
        ${drawPrompt}
        ${st.halves.length ? this._footballHalfHistory(st) : ''}
      </section>
      ${extraBlock}
      ${penaltiesBlock}
      ${summary}
      ${ScoreTimer.html()}`;
  },

  _footballHalfDelta(st) {
    const totals = this._computeTotals(st);
    return {
      scoreA: Math.max(0, st.scoreA - totals.halftimeA),
      scoreB: Math.max(0, st.scoreB - totals.halftimeB)
    };
  },

  _footballHalfHistory(st) {
    const rows = st.halves
      .map(
        (h) => `
      <div class="score-history-row">
        <span>${h.half === 1 ? '1-й тайм' : '2-й тайм'}</span>
        <strong>${h.scoreA} : ${h.scoreB}</strong>
      </div>`
      )
      .join('');
    return `<div class="score-history"><h3 class="section-title">Таймы</h3>${rows}</div>`;
  },

  _publishScoreboard(session) {
    const html = this._renderScoreboardPublishPreview(session);
    if (!html) {
      alert('Нет данных для трансляции. Обновите страницу и попробуйте снова.');
      return;
    }
    fetch('/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html })
    })
      .then((res) => res.json())
      .then((json) => {
        if (json && json.ok) {
          alert('Трансляция запущена. Откройте /viewer для просмотра.');
        } else {
          console.error('publish failed', json);
          alert('Ошибка трансляции: ' + (json?.error || 'сервер не ответил'));
        }
      })
      .catch((err) => {
        console.error('publish error', err);
        alert('Ошибка связи с сервером трансляции.');
      });
  },

  _renderScoreboardPublishPreview(session) {
    const root = document.querySelector('.scoreboard-page') || document.body;
    if (root) return root.outerHTML;
    return `<div><h2>Счёт ${this.esc(session.teamA)} — ${this.esc(session.teamB)}</h2><p>Текущий матч в режиме онлайн.</p></div>`;
  },

  _teamZoneFootball(side, name, score, editable) {
    if (!editable) {
      return `
        <div class="score-team-zone score-team-zone--football">
          <span class="score-team-label">${this.esc(name)}</span>
          <div class="score-big">${score}</div>
        </div>`;
    }
    return `
      <div class="score-team-zone score-team-zone--football" data-team="${side}">
        <input type="text" class="score-team-name" data-team-name="${side}" value="${this.esc(name)}" placeholder="Команда">
        <div class="score-big" data-score-display="${side}">${score}</div>
        <div class="score-pts-inline">
          <button type="button" class="btn score-pt-btn" data-fb-pts="${side}:1">+1</button>
          <button type="button" class="btn score-pt-btn btn-ghost" data-fb-pts="${side}:-1">−1</button>
        </div>
      </div>`;
  },

  _bindFootball(root, session) {
    const st = session.state;
    const persist = () => ScoreStorage.save(session);
    const rerender = () => this.renderSession(root, session);

    root.querySelectorAll('[data-fb-pts]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (st.phase === 'finished') return;
        if (!this._timerRunning(session)) {
          alert('Начните секундомер перед ведением счёта!');
          return;
        }
        this._syncNames(session, root);
        const [side, delta] = btn.dataset.fbPts.split(':');
        const d = parseInt(delta, 10);
        const target = st.phase === 'extra' ? st.extra : st;
        if (side === 'A') target.scoreA = Math.max(0, target.scoreA + d);
        else target.scoreB = Math.max(0, target.scoreB + d);
        persist();
        rerender();
      });
    });

    root.querySelector('[data-fb-end-half]')?.addEventListener('click', () => {
      this._syncNames(session, root);
      const delta = this._footballHalfDelta(st);
      st.halves.push({ half: 1, scoreA: delta.scoreA, scoreB: delta.scoreB });
      st.phase = 'half2';
      // Сбрасываем секундомер для второго тайма
      ScoreTimer.reset(session);
      persist();
      rerender();
    });

    root.querySelector('[data-fb-end-match]')?.addEventListener('click', () => {
      this._syncNames(session, root);
      const delta = this._footballHalfDelta(st);
      st.halves.push({ half: 2, scoreA: delta.scoreA, scoreB: delta.scoreB });
      st.regularTotalA = st.scoreA;
      st.regularTotalB = st.scoreB;
      if (st.regularTotalA === st.regularTotalB) {
        // Ничья — показываем кнопки доп. времени и пенальти
        st.phase = 'draw_prompt';
        // Останавливаем и сбрасываем секундомер для доп. времени
        ScoreTimer.reset(session);
      } else {
        st.winner = st.regularTotalA > st.regularTotalB ? session.teamA : session.teamB;
        st.phase = 'finished';
        // Синхронизируем с турнирной таблицей
        this._syncToTournament(session);
        // Останавливаем и сбрасываем секундомер
        ScoreTimer.reset(session);
        // Блокируем все кнопки управления матчем
        this._disableMatchControls(root);
      }
      persist();
      rerender();
    });

    root.querySelector('[data-fb-extra]')?.addEventListener('click', () => {
      st.phase = 'extra';
      st.extra = { scoreA: 0, scoreB: 0, active: true, recorded: false };
      // Сбрасываем секундомер на 0 для дополнительного времени
      ScoreTimer.reset(session);
      persist();
      rerender();
    });

    root.querySelector('[data-fb-penalties]')?.addEventListener('click', () => {
      st.phase = 'penalties';
      st.penalties = { shotsA: [], shotsB: [] };
      persist();
      rerender();
    });

    root.querySelector('[data-fb-end-extra]')?.addEventListener('click', () => {
      this._syncNames(session, root);
      st.extra.recorded = true;
      const totalA = st.regularTotalA + st.extra.scoreA;
      const totalB = st.regularTotalB + st.extra.scoreB;
      if (totalA === totalB) {
        st.phase = 'extra_draw';
        // Сбрасываем секундомер для продолжения (пенальти или ещё один овертайм)
        ScoreTimer.reset(session);
      } else {
        st.winner = totalA > totalB ? session.teamA : session.teamB;
        st.phase = 'finished';
        // Синхронизируем с турнирной таблицей
        this._syncToTournament(session);
        // Останавливаем и сбрасываем секундомер
        ScoreTimer.reset(session);
        // Блокируем все кнопки управления матчем
        this._disableMatchControls(root);
      }
      persist();
      rerender();
    });

    root.querySelector('[data-fb-finish-draw]')?.addEventListener('click', () => {
      st.winner = null;
      st.phase = 'finished';
      // Синхронизируем с турнирной таблицей
      this._syncToTournament(session);
      // Останавливаем и сбрасываем секундомер
      ScoreTimer.reset(session);
      // Блокируем все кнопки управления матчем
      this._disableMatchControls(root);
      persist();
      rerender();
    });

    root.querySelectorAll('[data-pen]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (st.penaltiesFinished) return;
        const [side, val] = btn.dataset.pen.split(':');
        const scored = val === '1';
        if (side === 'A') st.penalties.shotsA.push(scored);
        else st.penalties.shotsB.push(scored);
        persist();
        rerender();
      });
    });

    root.querySelector('[data-fb-end-penalties]')?.addEventListener('click', () => {
      const sa = st.penalties.shotsA.filter(Boolean).length;
      const sb = st.penalties.shotsB.filter(Boolean).length;
      if (sa === sb) {
        alert('На пенальти ничья. Продолжайте серию или отмените.');
        return;
      }
      st.penaltiesFinished = true;
      st.winner = sa > sb ? session.teamA : session.teamB;
      st.phase = 'finished';
      // Сбрасываем флаг синхронизации, чтобы гарантировать обновление турнира
      const syncId = session.linkedScoreId || session.tournamentId;
      // Сохраняем перед синхронизацией
      persist();
      console.log('[Scoreboard] About to sync penalties:', {
        teamA: session.teamA,
        teamB: session.teamB,
        penalties: st.penalties,
        phase: st.phase,
        winner: st.winner,
        tournamentId: session.tournamentId,
        bracketMatch: session.bracketMatch
      });
      // Синхронизируем с турнирной таблицей
      this._syncToTournament(session);
      // Останавливаем и сбрасываем секундомер
      ScoreTimer.reset(session);
      // Блокируем все кнопки управления матчем
      this._disableMatchControls(root);
      rerender();
    });

    root.querySelectorAll('[data-team-name]').forEach((inp) => {
      inp.addEventListener('change', () => {
        this._syncNames(session, root);
        persist();
      });
    });
  },

  _hockeyPenaltyShootoutBlock(session) {
    const st = session.state;
    const shotsA = st.penaltyShootouts?.shotsA || [];
    const shotsB = st.penaltyShootouts?.shotsB || [];
    const goalsA = shotsA.filter(Boolean).length;
    const goalsB = shotsB.filter(Boolean).length;
    const countA = shotsA.length;
    const countB = shotsB.length;

    return `
      <section class="glass scoreboard-card scoreboard-card--sub">
        <h3 class="section-title">Буллиты</h3>
        <p class="score-penalty-total">${session.teamA}: <strong>${goalsA}</strong> · ${session.teamB}: <strong>${goalsB}</strong></p>
        <div class="score-penalty-grid">
          <div>
            <p class="score-team-label">${this.esc(session.teamA)}</p>
            ${shotsA.map((val, idx) => `
            <div class="score-penalty-shot">
              <span>${val ? '🥅' : '❌'}</span>
              <button type="button" class="btn btn-sm btn-danger" data-ps-cancel="A:${idx}">Отменить</button>
            </div>`).join('') || ''}
            <div class="score-penalty-actions">
              <button ${countA === countB ? '' : 'disabled'} type="button" class="btn btn-sm btn-success" data-ps="A:1">Забил</button>
              <button ${countA === countB ? '' : 'disabled'} type="button" class="btn btn-sm btn-danger" data-ps="A:0">Мимо</button>
            </div>
          </div>
          <div>
            <p class="score-team-label">${this.esc(session.teamB)}</p>
            ${shotsB.map((val, idx) => `
            <div class="score-penalty-shot">
              <span>${val ? '🥅' : '❌'}</span>
              <button type="button" class="btn btn-sm btn-danger" data-ps-cancel="B:${idx}">Отменить</button>
            </div>`).join('') || ''}
            <div class="score-penalty-actions">
              <button ${countA === countB + 1 ? '' : 'disabled'} type="button" class="btn btn-sm btn-success" data-ps="B:1">Забил</button>
              <button ${countA === countB + 1 ? '' : 'disabled'} type="button" class="btn btn-sm btn-danger" data-ps="B:0">Мимо</button>
            </div>
          </div>
        </div>
        <div class="score-actions-row">
          ${countA >= 3 && countB >= 3 && !st.penaltyShootoutsFinished ? '<button type="button" class="btn btn-warning" data-ps-finish>Завершить серию</button>' : ''}
          <button type="button" class="btn btn-warning btn-sm" data-ps-restart>Перезапустить серию</button>
        </div>
      </section>`;
  },

  _hockeyOvertimeSummaryBlock(session) {
    const st = session.state;
    if (!st.overtimePeriods?.length) return '';

    return `
    <section class="glass scoreboard-card scoreboard-card--sub">
      <h3 class="section-title">Овертаймы</h3>
      <div class="score-history">
        ${st.overtimePeriods.map((p) => `
        <div class="score-history-row">
          <span>${p.period}-й овертайм</span>
          <strong>${p.scoreA} : ${p.scoreB}</strong>
        </div>`).join('')}
      </div>
    </section>`;
  },

  _hockeyMatchSummaryBlock(session) {
    const st = session.state;
    const tot = this._computeTotals(st);
    const finalA = tot.periodA + tot.overtimePeriodA;
    const finalB = tot.periodB + tot.overtimePeriodB;
    const shotsA = st.penaltyShootouts?.shotsA || [];
    const shotsB = st.penaltyShootouts?.shotsB || [];

    return `
    <section class="glass scoreboard-card">
      <h3 class="section-title">Итог матча</h3>
      <div class="score-summary">
        <p>Основное время: <strong>${tot.periodA} : ${tot.periodB}</strong></p>
        ${tot.overtimePeriodA > 0 || tot.overtimePeriodB > 0 ? `<p>Овертаймы: <strong>${tot.overtimePeriodA} : ${tot.overtimePeriodB}</strong></p>` : ''}
        ${shotsA.length ? `<p>Буллиты (забито): <strong>${shotsA.filter(Boolean).length} : ${shotsB.filter(Boolean).length}</strong></p>` : ''}
        <p>Финальный счёт: <strong>${finalA} : ${finalB}</strong></p>
        ${st.winner ? `<p class="score-winner">Победитель: <strong>${this.esc(st.winner)}</strong></p>` : '<p>Результат: ничья</p>'}
      </div>
    </section>`;
  },

  _hockeyPeriodsBlock(session) {
    const st = session.state;
    if (!st.periods.length) return '';

    return `
    <section class="glass scoreboard-card">
      <h3 class="section-title">Периоды</h3>
      <div class="score-history">
        ${st.periods.map(p => `
        <div class="score-history-row">
          <span>${p.number}-й период</span>
          <strong>${p.scoreA} : ${p.scoreB}</strong>
        </div>`).join('')}
      </div>
    </section>`;
  },

  _hockeyPenaltiesBlock(session) {
    const teamAPenalties = session.state.teamAPenalties || [];
    const teamBPenalties = session.state.teamBPenalties || [];

    const formatPenTime = (sec) => {
      const m = Math.floor(Math.max(0, sec) / 60);
      const s = sec % 60;
      return `${String(m).padStart(2, '0')}:${String(Math.max(0, s)).padStart(2, '0')}`;
    };

    // Динамически вычисляет оставшееся время штрафа на основе startedAt
    // (работает корректно даже если таймеры паузы и remainingSeconds устарел)
    const getPenaltyRemaining = (pen) => {
      if (!pen.active || !pen.startedAt || !pen.totalSeconds) return Math.max(0, pen.remainingSeconds || 0);
      const elapsed = Math.floor((Date.now() - pen.startedAt) / 1000);
      return Math.max(0, pen.totalSeconds - elapsed);
    };

    const renderPenaltyRow = (pen, side) => {
      const penId = pen.id || ('pen_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7));
      // Если у штрафа нет ID, генерируем его (для обратной совместимости)
      if (!pen.id) {
        pen.id = penId;
      }
      const dynRemaining = getPenaltyRemaining(pen);
      const urgent = pen.active && dynRemaining <= 60 ? ' score-penalty--urgent' : '';
      const timeLeft = formatPenTime(dynRemaining);
      return `
      <div class="score-penalty-row${urgent}" data-pen-index="${penId}" data-team="${side}">
        <div class="score-penalty-info">
          <span class="score-penalty-player">#${this.esc(pen.player)}</span>
          <span class="score-penalty-duration">${pen.minutes} мин.</span>
        </div>
        <div class="score-penalty-timer" data-pen-timer="${penId}">${timeLeft}</div>
        <button type="button" class="btn btn-sm btn-danger btn-pen-release" data-rel-pen="${side}:${penId}">Снять</button>
      </div>`;
    };

    const renderServedPenaltyRow = (pen, side) => {
      return `
      <div class="score-penalty-row score-penalty-row--served" data-served-pen="${pen.id}" data-team="${side}">
        <div class="score-penalty-info">
          <span class="score-penalty-player">#${this.esc(pen.player)}</span>
          <span class="score-penalty-duration">${pen.minutes} мин.</span>
        </div>
        <button type="button" class="btn btn-sm btn-ghost btn-pen-undo" data-undo-pen="${side}:${pen.id}">↩</button>
      </div>`;
    };

    const renderTeamPenalties = (side, penalties, teamName) => {
      // Разделяем на активные и отработавшие (используем динамическое вычисление)
      const activePenalties = penalties.filter(p => p.active && getPenaltyRemaining(p) > 0);
      const servedPenalties = penalties.filter(p => !p.active || getPenaltyRemaining(p) <= 0);
      const hasServed = servedPenalties.length > 0;

      return `
        <div class="score-team-penalty-block" data-team-penalties="${side}">
          <p class="score-team-label">${this.esc(teamName)}</p>
          
          <!-- Зона ввода номера игрока -->
          <div class="score-penalty-input-zone">
            <input type="number" class="score-penalty-player-input" data-player-input="${side}" placeholder="№ игрока" min="1" max="99">
          </div>
          
          <!-- Кнопки штрафа -->
          <div class="score-penalty-buttons">
            <button type="button" class="btn btn-sm btn-penalty btn-pen-2" data-pen-minutes="${side}:2">2 мин</button>
            <button type="button" class="btn btn-sm btn-penalty btn-pen-4" data-pen-minutes="${side}:4">4 мин</button>
            <button type="button" class="btn btn-sm btn-penalty btn-pen-5" data-pen-minutes="${side}:5">5 мин</button>
            <button type="button" class="btn btn-sm btn-penalty btn-pen-10" data-pen-minutes="${side}:10">10 мин</button>
          </div>
          
          <!-- Активные штрафы -->
          <div class="score-penalty-list" data-team="${side}-active">
            ${activePenalties.length > 0
              ? activePenalties.map(pen => renderPenaltyRow(pen, side)).join('')
              : '<p class="score-empty-hint">Нет активных штрафов</p>'
            }
          </div>
          
          <!-- История штрафов (сворачиваемая) -->
          ${hasServed ? `
          <div class="score-penalty-history">
            <button type="button" class="btn btn-ghost btn-sm score-penalty-history-toggle" data-toggle-history="${side}">
              <span class="toggle-icon">▼</span> История штрафов (${servedPenalties.length})
            </button>
            <div class="score-penalty-history-content" data-history-content="${side}" hidden>
              ${servedPenalties.map(pen => renderServedPenaltyRow(pen, side)).join('')}
            </div>
          </div>` : ''}
        </div>`;
    };

    return `
    <section class="glass scoreboard-card scoreboard-card--penalties">
      <h3 class="section-title">Штрафы</h3>
      <div class="score-penalties-duel">
        ${renderTeamPenalties('A', teamAPenalties, session.teamA)}
        ${renderTeamPenalties('B', teamBPenalties, session.teamB)}
      </div>
    </section>`;
  },

  _hockeyMainActionsBlock(phase, tot) {
    if (phase === 'period1' || phase === 'period2' || phase === 'period3') {
      return '<button type="button" class="btn btn-success" data-hk-end-period>Завершить период</button>';
    }
    if (phase === 'draw_prompt') {
      return `<button type="button" class="btn btn-success" data-hk-overtime>Овертайм</button>
             <button type="button" class="btn btn-warning" data-hk-penalties>Буллиты</button>
             <button type="button" class="btn btn-danger" data-hk-finish-match>Завершить матч (ничья)</button>`;
    }
    if (phase === 'overtime') {
      return `<button type="button" class="btn btn-success" data-hk-next-ot>Играть следующий овертайм</button>
             <button type="button" class="btn btn-warning" data-hk-penalties>Перейти к буллитам</button>
             <button type="button" class="btn btn-danger" data-hk-finish-match>Завершить матч</button>`;
    }
    if (phase === 'ot_draw_prompt') {
      return `<button type="button" class="btn btn-success" data-hk-next-ot>Играть ещё овертайм</button>
             <button type="button" class="btn btn-warning" data-hk-penalties>Перейти к буллитам</button>
             <button type="button" class="btn btn-danger" data-hk-finish-match>Завершить матч (ничья)</button>`;
    }
    return '';
  },

  /** @param {{ state: HockeyState, teamA: string, teamB: string }} session */
  _htmlHockey(session) {
    /** @type {HockeyState} */
    const st = session.state;
    const phase = st.phase;
    const tot = this._computeTotals(st);

    const HOCKEY_PHASE_LABELS = {
      period1: '1-й период',
      period2: '2-й период',
      period3: '3-й период',
      overtime: 'Овертайм',
      penalty_shootout: 'Буллиты',
      draw_prompt: 'Ничья — выбор продолжения',
      ot_draw_prompt: 'Ничья в овертайме',
      finished: 'Матч завершён'
    };
    const phaseLabel = HOCKEY_PHASE_LABELS[phase] ?? '';

    const psBlock = phase === 'penalty_shootout' || st.penaltyShootouts?.shotsA?.length
      ? this._hockeyPenaltyShootoutBlock(session)
      : '';
    const otSummaryBlock = this._hockeyOvertimeSummaryBlock(session);
    const summary = phase === 'finished' ? this._hockeyMatchSummaryBlock(session) : '';
    const periodsBlock = this._hockeyPeriodsBlock(session);
    const showPenalties = phase !== 'penalty_shootout' && phase !== 'finished';
    const penaltiesBlock = showPenalties ? this._hockeyPenaltiesBlock(session) : '';
    const actionsBlock = this._hockeyMainActionsBlock(phase, tot);

    let scoreDisplay = '';
    if (st.periods.length > 0) {
      scoreDisplay = `
        <div class="score-period-total">
          <span>Сумма периодов:</span>
          <strong>${tot.periodA} : ${tot.periodB}</strong>
        </div>`;
    }

    let mainScoreA, mainScoreB;
    if (st.phase === 'overtime' || st.phase === 'ot_draw_prompt') {
      mainScoreA = tot.periodA + tot.overtimePeriodA + (st.overtime?.scoreA ?? 0);
      mainScoreB = tot.periodB + tot.overtimePeriodB + (st.overtime?.scoreB ?? 0);
    } else if (st.phase === 'finished') {
      mainScoreA = tot.periodA + tot.overtimePeriodA;
      mainScoreB = tot.periodB + tot.overtimePeriodB;
    } else {
      mainScoreA = tot.periodA + st.scoreA;
      mainScoreB = tot.periodB + st.scoreB;
    }

    return `
      <section class="glass scoreboard-card">
        <p class="score-phase-badge">${phaseLabel}</p>
        <div class="score-duel score-duel--football">
          ${this._teamZoneHockey('A', session.teamA, mainScoreA, phase !== 'finished')}
          ${this._teamZoneHockey('B', session.teamB, mainScoreB, phase !== 'finished')}
        </div>
        ${scoreDisplay}
        <div class="score-actions-row">${actionsBlock}</div>
        ${periodsBlock}
        ${otSummaryBlock}
      </section>
      ${penaltiesBlock}
      ${psBlock}
      ${summary}
      ${(phase !== 'penalty_shootout' && phase !== 'finished') ? HockeyTimer.html() : ''}`;

  },

  _teamZoneHockey(side, name, score, editable) {
    if (!editable) {
      return `
        <div class="score-team-zone score-team-zone--football">
          <span class="score-team-label">${this.esc(name)}</span>
          <div class="score-big">${score}</div>
        </div>`;
    }
    return `
        <div class="score-team-zone score-team-zone--football" data-team="${side}">
          <input type="text" class="score-team-name" data-team-name="${side}" value="${this.esc(name)}" placeholder="Команда">
          <div class="score-big" data-score-display="${side}">${score}</div>
          <div class="score-pts-inline">
            <button type="button" class="btn score-pt-btn" data-hk-pts="${side}:1">+1</button>
            <button type="button" class="btn score-pt-btn btn-ghost" data-hk-pts="${side}:-1">−1</button>
          </div>
        </div>`;
  },

  _htmlOnePeriod(session) {
    const st = session.state;
    const finished = st.matchFinished;
    const firstPeriod = st.periods.length === 0;

    const periodRows = st.periods
      .map((p) => {
        const totA = p.totalA != null ? p.totalA : p.scoreA;
        const totB = p.totalB != null ? p.totalB : p.scoreB;
        return `
        <div class="score-history-row">
          <span>Период ${p.period}</span>
          <span class="score-period-pts"><strong>${p.scoreA} : ${p.scoreB}</strong></span>
          <span class="score-period-total">Счёт ${totA} : ${totB}</span>
        </div>`;
      })
      .join('');

    const totalA = st.periods.reduce((sum, p) => sum + p.scoreA, 0);
    const totalB = st.periods.reduce((sum, p) => sum + p.scoreB, 0);

    return `
      <section class="glass scoreboard-card">
        <p class="score-phase-badge">${finished ? 'Матч завершён' : 'Период 1'}</p>
        <div class="score-duel score-duel--basketball">
          ${this._teamZoneOnePeriod('A', session.teamA, st.scoreA)}
          ${this._teamZoneOnePeriod('B', session.teamB, st.scoreB)}
        </div>
        ${
          !finished
            ? `
        <div class="score-actions-row">
          ${
            firstPeriod
              ? '<button type="button" class="btn btn-success" data-op-end-period>Завершить период</button>'
              : `<button type="button" class="btn btn-ghost" data-op-end-period>Завершить еще период</button>
                 <button type="button" class="btn btn-warning" data-op-finish-match>Завершить матч</button>`
          }
        </div>`
            : ''
        }
        ${
          st.periods.length
            ? `
        <div class="score-history">
          <h3 class="section-title">Результаты периодов</h3>
          ${periodRows}
          <div class="score-history-row score-history-row--total">
            <span>Итого матч</span>
            <strong>${totalA} : ${totalB}</strong>
          </div>
        </div>`
            : ''
        }
      </section>
      ${ScoreTimer.html()}`;
  },

  _teamZoneOnePeriod(side, name, score) {
    return `
      <div class="score-team-zone" data-team="${side}">
        <input type="text" class="score-team-name" data-team-name="${side}" value="${this.esc(name)}" placeholder="Название команды" aria-label="Команда ${side}">
        <div class="score-big" data-score-display="${side}">${score}</div>
        <div class="score-pts-grid">
          <button type="button" class="btn score-pt-btn" data-op-pts="${side}:1">+1</button>
          <button type="button" class="btn score-pt-btn" data-op-pts="${side}:2">+2</button>
          <button type="button" class="btn score-pt-btn" data-op-pts="${side}:3">+3</button>
          <button type="button" class="btn score-pt-btn btn-ghost" data-op-pts="${side}:-1">−1</button>
          <button type="button" class="btn score-pt-btn btn-danger" data-op-pts="${side}:-5">−5</button>
        </div>
      </div>`;
  },

  /**
   * @param {{ state: HockeyState, teamA: string, teamB: string }} session
   */
  _bindHockey(root, session) {
    /** @type {HockeyState} */
    const st = session.state;
    const persist = () => ScoreStorage.save(session);
    const rerender = () => this.renderSession(root, session);

    // Хранилище интервалов штрафов — сохраняем на session чтобы не терять при ререндере
    if (!session._penaltyIntervals) {
      session._penaltyIntervals = new Map();
    }
    const penaltyIntervals = session._penaltyIntervals;

    // Инициализация массивов штрафов при необходимости
    const initPenalties = () => {
      session.state.teamAPenalties = session.state.teamAPenalties || [];
      session.state.teamBPenalties = session.state.teamBPenalties || [];
    };

    // Флаг: таймеры штрафов приостановлены (после завершения периода)
    let penaltiesPausedByPeriodEnd = false;

    // Динамически вычисляет оставшееся время штрафа на основе startedAt
    // (работает корректно даже если таймеры паузы и remainingSeconds устарел)
    const getPenaltyRemaining = (pen) => {
      if (!pen.active || !pen.startedAt || !pen.totalSeconds) return Math.max(0, pen.remainingSeconds || 0);
      const elapsed = Math.floor((Date.now() - pen.startedAt) / 1000);
      return Math.max(0, pen.totalSeconds - elapsed);
    };

    // Сохраняет активные штрафы в текущий период (для переноса на следующий тайм)
    const freezePenalties = () => {
      const curSession = ScoreStorage.get(session.id);
      if (!curSession) return;

      const allPens = [...(curSession.state.teamAPenalties || []), ...(curSession.state.teamBPenalties || [])];
      const activePenalties = allPens.filter(p => p.active && getPenaltyRemaining(p) > 0);
      if (activePenalties.length === 0) return;

      // Определяем текущий период
      const periodIdx = st.periods.length - 1;
      if (periodIdx < 0) return;

      if (!st.periods[periodIdx].penalties) {
        st.periods[periodIdx].penalties = [];
      }

      // Копируем активные штрафы в период
      for (const pen of activePenalties) {
        st.periods[periodIdx].penalties.push({
          id: pen.id,
          side: curSession.state.teamAPenalties.includes(pen) ? 'A' : 'B',
          player: pen.player,
          minutes: pen.minutes,
          totalSeconds: pen.totalSeconds,
          remainingSeconds: getPenaltyRemaining(pen)
        });
      }

      persist();
    };

    // Восстанавливает штрафы из предыдущего периода в начало текущего
    let penaltyRestorePhase = null;
    const restorePenaltiesForPhase = (phase) => {
      if (penaltyRestorePhase === phase) return; // Уже восстановлены
      const curSession = ScoreStorage.get(session.id);
      if (!curSession) return;

      const periodIdx = st.periods.length - 1;
      if (periodIdx < 0) return;
      const prevPeriod = st.periods[periodIdx];
      if (!prevPeriod || !prevPeriod.penalties || prevPeriod.penalties.length === 0) return;

      const teamAPens = curSession.state.teamAPenalties || [];
      const teamBPens = curSession.state.teamBPenalties || [];

      for (const savedPen of prevPeriod.penalties) {
        // getPenaltyRemaining корректно работает и для savedPen без startedAt (вернёт remainingSeconds)
        if (getPenaltyRemaining(savedPen) <= 0) continue;

        // Проверяем, есть ли уже такой штраф в текущих
        const existing = [...teamAPens, ...teamBPens].find(p => p.id === savedPen.id);
        if (existing) continue; // Уже существует

        // Создаём новый штраф из сохранённых данных
        const restored = {
          id: savedPen.id,
          player: savedPen.player,
          minutes: savedPen.minutes,
          totalSeconds: savedPen.remainingSeconds,
          remainingSeconds: savedPen.remainingSeconds,
          active: true,
          startedAt: Date.now()
        };

        if (savedPen.side === 'A') {
          teamAPens.push(restored);
        } else {
          teamBPens.push(restored);
        }
      }

      persist();
      penaltyRestorePhase = phase;
    };

    // Остановка всех таймеров штрафов (пауза)
    const pauseAllPenaltyTicks = () => {
      for (const [penId, iv] of penaltyIntervals) {
        clearInterval(iv);
        penaltyIntervals.delete(penId);
      }
      penaltiesPausedByPeriodEnd = true;
      persist();
    };

    // Генератор уникальных ID для штрафов
    const createPenaltyId = () => 'pen_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

    // Запуск независимого таймера для конкретного штрафа
    const startPenaltyTick = (pen, penId, isRestored) => {
      // Удаляем старый интервал если есть
      const oldId = penaltyIntervals.get(penId);
      if (oldId != null) clearInterval(oldId);

      const iv = setInterval(() => {
        // Читаем актуальное значение из хранилища
        const curSession = ScoreStorage.get(session.id);
        if (!curSession) return;

        let targetPen = null;
        const allPens = [...(curSession.state.teamAPenalties || []), ...(curSession.state.teamBPenalties || [])];
        targetPen = allPens.find(p => p.id === penId);

        if (!targetPen || !targetPen.active) {
          clearInterval(iv);
          penaltyIntervals.delete(penId);
          return;
        }

        // Вычисляем оставшееся время на основе startTime и totalSeconds
        const elapsed = Math.floor((Date.now() - targetPen.startedAt) / 1000);
        const remaining = Math.max(0, targetPen.totalSeconds - elapsed);

        // Сохраняем вычисленное remainingSeconds
        if (targetPen.remainingSeconds !== remaining) {
          targetPen.remainingSeconds = remaining;
          persist();
        }

        if (remaining > 0) {
          // Обновляем отображение
          const rootEl = document.querySelector('.scoreboard-page');
          if (rootEl) {
            const timerEl = rootEl.querySelector(`[data-pen-timer="${penId}"]`);
            if (timerEl) {
              const m = Math.floor(remaining / 60);
              const s = remaining % 60;
              timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            }
          }
        } else {
          targetPen.active = false;
          targetPen.remainingSeconds = 0;
          persist();

          clearInterval(iv);
          penaltyIntervals.delete(penId);

          // Перерисовываем — штраф уйдёт в историю
          rerender();
        }
      }, 1000);

      penaltyIntervals.set(penId, iv);
    };

    // Остановка таймера штрафа по ID
    const stopPenaltyTick = (penId) => {
      const iv = penaltyIntervals.get(penId);
      if (iv != null) {
        clearInterval(iv);
        penaltyIntervals.delete(penId);
      }
    };

    // Возобновление всех таймеров штрафов
    const resumeAllPenaltyTicks = () => {
      const curSession = ScoreStorage.get(session.id);
      if (!curSession) return;

      const allPens = [...(curSession.state.teamAPenalties || []), ...(curSession.state.teamBPenalties || [])];
      for (const pen of allPens) {
        if (pen.active && getPenaltyRemaining(pen) > 0 && !penaltyIntervals.has(pen.id)) {
          startPenaltyTick(pen, pen.id);
        }
      }
    };

    // Остановка всех таймеров штрафов
    const stopAllPenaltyTicks = () => {
      for (const [, iv] of penaltyIntervals) {
        clearInterval(iv);
      }
      penaltyIntervals.clear();
    };

    const initOvertime = () => {
      st.overtime = st.overtime ?? { scoreA: 0, scoreB: 0, period: (st.overtimePeriods?.length || 0) + 1 };
    };

    initOvertime();

    root.querySelectorAll('[data-hk-pts]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (st.phase === 'finished') return;
        if (!this._timerRunning(session)) {
          alert('Начните обратный отсчёт перед ведением счёта!');
          return;
        }
        initOvertime();
        this._syncNames(session, root);
        const [side, delta] = btn.dataset.hkPts.split(':');
        const d = parseInt(delta, 10);
        if (st.phase === 'overtime' || st.phase === 'ot_draw_prompt') {
          if (side === 'A') st.overtime.scoreA = Math.max(0, st.overtime.scoreA + d);
          else st.overtime.scoreB = Math.max(0, st.overtime.scoreB + d);
        } else {
          if (side === 'A') st.scoreA = Math.max(0, st.scoreA + d);
          else st.scoreB = Math.max(0, st.scoreB + d);
        }
        persist();
        rerender();
      });
    });

    root.querySelector('[data-hk-end-period]')?.addEventListener('click', () => {
      this._syncNames(session, root);
      const currentPeriod = st.periods.length + 1;
      st.periods.push({
        number: currentPeriod,
        scoreA: st.scoreA,
        scoreB: st.scoreB
      });
      st.scoreA = 0;
      st.scoreB = 0;
      if (currentPeriod < 3) {
        st.phase = currentPeriod === 1 ? 'period2' : 'period3';
      } else {
        const endTotals = this._computeTotals(st);
        if (endTotals.periodA === endTotals.periodB) {
          st.phase = 'draw_prompt';
        } else {
          st.winner = endTotals.periodA > endTotals.periodB ? session.teamA : session.teamB;
          st.phase = 'finished';
        }
      }
      // Останавливаем таймеры штрафов при завершении периода и сохраняем их в период
      freezePenalties();
      pauseAllPenaltyTicks();
      persist();
      rerender();
    });

    root.querySelector('[data-hk-overtime]')?.addEventListener('click', () => {
      // Сохраняем текущие штрафы в последний период (если есть активные)
      freezePenalties();
      // Останавливаем все таймеры штрафов — овертайм не наследует штрафы
      pauseAllPenaltyTicks();
      // Очищаем активные штрафы
      st.teamAPenalties = [];
      st.teamBPenalties = [];
      
      st.phase = 'overtime';
      st.scoreA = 0;
      st.scoreB = 0;
      st.overtime = { scoreA: 0, scoreB: 0, period: (st.overtimePeriods?.length || 0) + 1 };
      st.overtimePeriods = st.overtimePeriods ?? [];
      persist();
      rerender();
    });

    root.querySelector('[data-hk-next-ot]')?.addEventListener('click', () => {
      if (st.overtimePeriods.length >= 8) {
        alert('Максимум 8 овертаймов. Перейдите к буллитам.');
        return;
      }
      st.overtimePeriods.push({
        period: st.overtime.period,
        scoreA: st.overtime.scoreA,
        scoreB: st.overtime.scoreB
      });
      st.overtime.period += 1;
      st.scoreA = 0;
      st.scoreB = 0;
      st.overtime.scoreA = 0;
      st.overtime.scoreB = 0;
      persist();
      rerender();
    });



    root.querySelector('[data-hk-penalties]')?.addEventListener('click', () => {
      // Сохраняем штрафы текущего периода
      freezePenalties();
      pauseAllPenaltyTicks();
      st.teamAPenalties = [];
      st.teamBPenalties = [];
      
      // Сохраняем текущий период, если в нём есть голы
      if (st.scoreA !== 0 || st.scoreB !== 0) {
        st.periods.push({
          number: st.periods.length + 1,
          scoreA: st.scoreA,
          scoreB: st.scoreB
        });
        st.scoreA = 0;
        st.scoreB = 0;
      }
      st.phase = 'penalty_shootout';
      st.penaltyShootouts = { shotsA: [], shotsB: [] };
      persist();
      rerender();
    });

    root.querySelector('[data-hk-finish-match]')?.addEventListener('click', () => {
      this._syncNames(session, root);

      st.overtimePeriods = st.overtimePeriods ?? [];

      // Сохраняем текущий овертайм, если он не записан
      const OT_PHASES = ['overtime', 'ot_draw_prompt'];
      const isInOvertime = OT_PHASES.includes(st.phase);

      if (isInOvertime) {
        const alreadySaved = st.overtimePeriods.some(
          p => p.period === st.overtime.period
        );

        if (!alreadySaved) {
          st.overtimePeriods.push({
            period: st.overtime.period,
            scoreA: st.overtime.scoreA ?? 0,
            scoreB: st.overtime.scoreB ?? 0
          });
        }
      }

      // Сохраняем текущий основной период, если в нём есть голы
      if (!isInOvertime && (st.scoreA !== 0 || st.scoreB !== 0)) {
        st.periods.push({
          number: st.periods.length + 1,
          scoreA: st.scoreA,
          scoreB: st.scoreB
        });
        st.scoreA = 0;
        st.scoreB = 0;
      }

      const endTotals = this._computeTotals(st);
      const finalA = endTotals.periodA + endTotals.overtimePeriodA;
      const finalB = endTotals.periodB + endTotals.overtimePeriodB;

      st.winner = finalA > finalB
        ? session.teamA
        : finalB > finalA
          ? session.teamB
          : null;

      st.phase = 'finished';

      // Синхронизируем с турнирной таблицей
      this._syncToTournament(session);

      persist();
      rerender();
    });

    root.querySelectorAll('[data-ps-cancel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [side, idx] = btn.dataset.psCancel.split(':');
        const idxNum = parseInt(idx, 10);
        if (side === 'A') {
          if (st.penaltyShootouts?.shotsA?.[idxNum] !== undefined) {
            st.penaltyShootouts.shotsA.splice(idxNum, 1);
          }
        } else {
          if (st.penaltyShootouts?.shotsB?.[idxNum] !== undefined) {
            st.penaltyShootouts.shotsB.splice(idxNum, 1);
          }
        }
        persist();
        rerender();
      });
    });

    root.querySelector('[data-ps-restart]')?.addEventListener('click', () => {
      st.penaltyShootouts = { shotsA: [], shotsB: [], shotCount: 0 };
      st.penaltyShootoutsFinished = false;
      st.winner = null;
      st.phase = 'penalty_shootout';
      persist();
      rerender();
    });

    root.querySelectorAll('[data-ps]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (st.penaltyShootoutsFinished) return;
        if (!this._timerRunning(session)) {
          alert('Начните обратный отсчёт перед ведением счёта!');
          return;
        }
        if (!st.penaltyShootouts) st.penaltyShootouts = { shotsA: [], shotsB: [] };

        const [side, val] = btn.dataset.ps.split(':');
        const scored = val === '1';

        if (side === 'A') {
          if (!st.penaltyShootouts.shotsA) st.penaltyShootouts.shotsA = [];
          st.penaltyShootouts.shotsA.push(scored);
        } else {
          if (!st.penaltyShootouts.shotsB) st.penaltyShootouts.shotsB = [];
          st.penaltyShootouts.shotsB.push(scored);
        }

        const shotsA = st.penaltyShootouts.shotsA;
        const shotsB = st.penaltyShootouts.shotsB;
        const goalsA = shotsA.filter(Boolean).length;
        const goalsB = shotsB.filter(Boolean).length;
        const countA = shotsA.length;
        const countB = shotsB.length;

        const equalShots = countA === countB;
        const minShotsReached = countA >= 3 && countB >= 3;

        if (equalShots && minShotsReached) {
          const diff = Math.abs(goalsA - goalsB);
          if (diff >= 1) {
            st.penaltyShootoutsFinished = true;
            st.winner = goalsA > goalsB ? session.teamA : session.teamB;
            st.phase = 'finished';
            // Синхронизируем с турнирной таблицей
            this._syncToTournament(session);
          }
        }

        if (countA >= 20 && countB >= 20) {
          st.penaltyShootoutsFinished = true;
          st.winner = goalsA > goalsB 
            ? session.teamA 
            : goalsB > goalsA 
              ? session.teamB 
              : null;
          st.phase = 'finished';
          // Синхронизируем с турнирной таблицей
          this._syncToTournament(session);
        }

        persist();
        rerender();
      });
    });

    root.querySelector('[data-ps-finish]')?.addEventListener('click', () => {
      const shotsA = st.penaltyShootouts?.shotsA || [];
      const shotsB = st.penaltyShootouts?.shotsB || [];
      const goalsA = shotsA.filter(Boolean).length;
      const goalsB = shotsB.filter(Boolean).length;
      
      if (goalsA === goalsB) {
        alert('Серия буллитов не может быть завершена при ничьей. Сделайте ещё буллиты.');
        return;
      }
      
      st.penaltyShootoutsFinished = true;
      st.winner = goalsA > goalsB ? session.teamA : session.teamB;
      st.phase = 'finished';
      // Синхронизируем с турнирной таблицей
      this._syncToTournament(session);
      persist();
      rerender();
    });

    root.querySelectorAll('[data-team-name]').forEach((inp) => {
      inp.addEventListener('change', () => {
        this._syncNames(session, root);
        persist();
      });
    });

    const clearPenaltyTimer = () => {
      if (session.penaltyTimerId) clearInterval(session.penaltyTimerId);
      session.penaltyTimerId = null;
    };

    // Обновляем локальный session из ScoreStorage (чтобы иметь актуальные таймеры)
    const syncFromStorage = () => {
      const fromStorage = ScoreStorage.get(session.id);
      if (fromStorage) {
        session.state.teamAPenalties = fromStorage.state.teamAPenalties || [];
        session.state.teamBPenalties = fromStorage.state.teamBPenalties || [];
      }
    };

    // Обработка кнопок штрафа (2, 4, 5, 10 минут)
    root.querySelectorAll('[data-pen-minutes]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (st.phase === 'finished') return;
        const [side, minutes] = btn.dataset.penMinutes.split(':');
        const mins = parseInt(minutes, 10);

        // Читаем номер игрока из поля ввода
        const playerInput = root.querySelector(`[data-player-input="${side}"]`);
        const playerNum = playerInput?.value?.trim();
        if (!playerNum) {
          alert('Введите номер игрока!');
          playerInput?.focus();
          return;
        }

        // Всегда читаем актуальные данные из хранилища!
        initPenalties();
        syncFromStorage();
        const penalties = side === 'A'
          ? session.state.teamAPenalties
          : session.state.teamBPenalties;

        if (penalties.length >= 8) {
          alert('Максимум 8 штрафов на команду');
          return;
        }

        const penId = createPenaltyId();
        const totalSeconds = mins * 60;
        penalties.push({
          id: penId,
          player: playerNum,
          minutes: mins,
          totalSeconds: totalSeconds,
          remainingSeconds: totalSeconds,
          active: true,
          startedAt: Date.now()
        });

        // Очищаем поле ввода
        if (playerInput) playerInput.value = '';

        persist();

        // Запускаем независимый таймер для нового штрафа ПЕРЕД ререндером
        startPenaltyTick(penalties[penalties.length - 1], penId);

        rerender();
      });
    });

    // Обработка снятия штрафа вручную
    root.querySelectorAll('[data-rel-pen]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [side, penId] = btn.dataset.relPen.split(':');
        initPenalties();
        syncFromStorage();
        const penalties = side === 'A' ? session.state.teamAPenalties : session.state.teamBPenalties;
        const pen = penalties.find(p => p.id === penId);
        if (pen) {
          pen.active = false;
          pen.remainingSeconds = 0;
          stopPenaltyTick(penId);
          persist();
          rerender();
        }
      });
    });

    // Обработка отмены снятого штрафа
    root.querySelectorAll('[data-undo-pen]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [side, penId] = btn.dataset.undoPen.split(':');
        initPenalties();
        syncFromStorage();
        const penalties = side === 'A' ? session.state.teamAPenalties : session.state.teamBPenalties;
        const pen = penalties.find(p => p.id === penId);
        if (pen) {
          pen.active = true;
          pen.totalSeconds = pen.minutes * 60;
          pen.remainingSeconds = pen.totalSeconds;
          pen.startedAt = Date.now();
          startPenaltyTick(pen, penId);
          persist();
          rerender();
        }
      });
    });

    // Форматирование времени штрафа (только для отрисовки начального значения)
    const formatPenTime = (sec) => {
      const m = Math.floor(Math.max(0, sec) / 60);
      const s = sec % 60;
      return `${String(m).padStart(2, '0')}:${String(Math.max(0, s)).padStart(2, '0')}`;
    };

    // Восстанавливаем штрафы из предыдущего периода при старте основного таймера HockeyTimer
    // (не автоматически на каждом ререндере, а только когда пользователь нажмёт "Старт")
    const phasesWithPlay = ['period1', 'period2', 'period3', 'overtime', 'ot_draw_prompt'];

    // Логика завершения периода (вызывается когда HockeyTimer достигает 00:00)
    const onHockeyPeriodEnd = () => {
      // Если закончился основной период (1, 2, 3) — завершаем его
      if (st.phase === 'period1' || st.phase === 'period2' || st.phase === 'period3') {
        const currentPeriod = st.periods.length + 1;
        st.periods.push({
          number: currentPeriod,
          scoreA: st.scoreA,
          scoreB: st.scoreB
        });
        st.scoreA = 0;
        st.scoreB = 0;

        // Сохраняем штрафы текущего периода
        freezePenalties();
        pauseAllPenaltyTicks();
        persist();
        rerender();

        // Определяем новую фазу
        if (currentPeriod < 3) {
          st.phase = currentPeriod === 1 ? 'period2' : 'period3';
        } else {
          const endTotals = this._computeTotals(st);
          if (endTotals.periodA === endTotals.periodB) {
            st.phase = 'draw_prompt';
          } else {
            st.winner = endTotals.periodA > endTotals.periodB ? session.teamA : session.teamB;
            st.phase = 'finished';
          }
        }
        persist();
        rerender();
      }
      // Если закончился овертайм — просто сбрасываем таймер
      else if (st.phase === 'overtime' || st.phase === 'ot_draw_prompt') {
        // Овертайм завершён, но не завершаем матч автоматически
        // Пользователь может нажать "Играть следующий овертайм" или "Буллиты"
        freezePenalties();
        pauseAllPenaltyTicks();
        persist();
        rerender();
      }
    };

    // Обработчик кнопки переключения истории штрафов
    root.querySelectorAll('[data-toggle-history]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const side = btn.dataset.toggleHistory;
        const historyContent = root.querySelector(`[data-history-content="${side}"]`);
        const toggleIcon = btn.querySelector('.toggle-icon');
        if (historyContent && toggleIcon) {
          if (historyContent.hidden) {
            historyContent.hidden = false;
            toggleIcon.textContent = '▲';
          } else {
            historyContent.hidden = true;
            toggleIcon.textContent = '▼';
          }
        }
      });
    });

    // Запускаем HockeyTimer с callback-ами для восстановления штрафов и завершения периода
    HockeyTimer.bind(root, session, persist, () => {
      // Callback при нажатии "Старт" — возобновляем штрафы из предыдущего периода
      if (st.phase === 'period2' || st.phase === 'period3') {
        restorePenaltiesForPhase('play');
      }
      resumeAllPenaltyTicks();
    }, onHockeyPeriodEnd);
  },

  _bindOnePeriod(root, session) {
    const st = session.state;
    const persist = () => ScoreStorage.save(session);
    const rerender = () => this.renderSession(root, session);

    const syncNames = () => {
      session.teamA = root.querySelector('[data-team-name="A"]')?.value || session.teamA;
      session.teamB = root.querySelector('[data-team-name="B"]')?.value || session.teamB;
    };

    root.querySelectorAll('[data-op-pts]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this._timerRunning(session)) {
          alert('Начните секундомер перед ведением счёта!');
          return;
        }
        syncNames();
        const [side, delta] = btn.dataset.opPts.split(':');
        const d = parseInt(delta, 10);
        if (side === 'A') st.scoreA = Math.max(0, st.scoreA + d);
        else st.scoreB = Math.max(0, st.scoreB + d);
        persist();
        rerender();
      });
    });

    root.querySelector('[data-op-end-period]')?.addEventListener('click', () => {
      syncNames();
      const periodNum = st.periods.length + 1;
      const timer = ScoreTimer.format(ScoreTimer.getElapsedMs(session));

      st.periods.push({
        period: periodNum,
        scoreA: st.scoreA,
        scoreB: st.scoreB,
        totalA: st.scoreA,
        totalB: st.scoreB,
        timer
      });

      st.scoreA = 0;
      st.scoreB = 0;

      // Сбрасываем секундомер для нового периода
      ScoreTimer.reset(session);
      
      persist();
      rerender();
    });

    root.querySelector('[data-op-finish-match]')?.addEventListener('click', () => {
      syncNames();
      st.matchFinished = true;
      
      // Синхронизируем с турниром
      this._syncToTournament(session);
      
      // Останавливаем и сбрасываем секундомер
      ScoreTimer.reset(session);
      // Блокируем все кнопки управления матчем
      this._disableMatchControls(root);
      
      persist();
      rerender();
    });

    root.querySelectorAll('[data-team-name]').forEach((inp) => {
      inp.addEventListener('change', () => {
        this._syncNames(session, root);
        persist();
      });
    });

    // Регистрация игроков
    root.querySelectorAll('[data-register-player]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const side = btn.dataset.registerPlayer;
        const input = root.querySelector(`[data-register-team="${side}"]`);
        const playerNum = input?.value?.trim();
        if (!playerNum) {
          alert('Введите номер игрока!');
          input?.focus();
          return;
        }
        
        const playersKey = side === 'A' ? 'playersA' : 'playersB';
        if (!st[playersKey]) st[playersKey] = {};
        
        if (st[playersKey][playerNum] !== undefined) {
          alert('Игрок с таким номером уже зарегистрирован!');
          return;
        }
        
        st[playersKey][playerNum] = 0;
        persist();
        rerender();
      });
    });

    // Индивидуальные штрафы +1, -1
    root.querySelectorAll('[data-ind-penalty]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (st.matchFinished) return;
        this._syncNames(session, root);
        const parts = btn.dataset.indPenalty.split(':');
        const side = parts[0];
        const playerNum = parts[1];
        const d = parseInt(parts[2], 10);
        
        const playersKey = side === 'A' ? 'playersA' : 'playersB';
        if (!st[playersKey]) st[playersKey] = {};
        if (st[playersKey][playerNum] === undefined) return;
        
        st[playersKey][playerNum] = Math.max(0, st[playersKey][playerNum] + d);
        persist();
        rerender();
      });
    });
  },

  // ====== TENNIS ======

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

  // ====== STREETBALL ======

  _htmlStreetball(session) {
    const st = session.state;
    const finished = st.matchFinished;
    const overtimeLabel = st.overtimeActive ? ' · Доп. время' : '';
    const phaseLabel = finished ? 'Матч завершён' : (st.overtimeActive ? 'Дополнительное время' : 'Основное время');
    const totalA = st.regularTimeA + (st.overtimeScoreA || 0);
    const totalB = st.regularTimeB + (st.overtimeScoreB || 0);

    // Для отображения текущего счёта в summary используем сохранённые значения
    const displayRegularA = finished ? st.regularTimeA : (st.regularTimeA || st.scoreA);
    const displayRegularB = finished ? st.regularTimeB : (st.regularTimeB || st.scoreB);
    const displayOvertimeA = finished ? (st.overtimeScoreA || 0) : (st.overtimeActive ? st.scoreA : 0);
    const displayOvertimeB = finished ? (st.overtimeScoreB || 0) : (st.overtimeActive ? st.scoreB : 0);
    const displayTotalA = finished ? totalA : (st.overtimeActive ? st.scoreA : displayRegularA);
    const displayTotalB = finished ? totalB : (st.overtimeActive ? st.scoreB : displayRegularB);

    let summaryBlock = '';
    if (finished) {
      summaryBlock = `
      <section class="glass scoreboard-card scoreboard-card--summary">
        <h3 class="section-title">Итог матча</h3>
        <div class="score-match-summary-row" style="display:flex; justify-content:center; align-items:center; gap:1rem; padding:1rem; font-size:1.25rem;">
          <div style="text-align:center;">
            <p style="margin:0 0 0.5rem; font-weight:600;">${this.esc(session.teamA)}</p>
            <p style="margin:0; font-size:2rem; font-weight:800;">${displayTotalA}</p>
          </div>
          <span style="color:var(--muted);">:</span>
          <div style="text-align:center;">
            <p style="margin:0 0 0.5rem; font-weight:600;">${this.esc(session.teamB)}</p>
            <p style="margin:0; font-size:2rem; font-weight:800;">${displayTotalB}</p>
          </div>
        </div>
        <div style="text-align:center; margin-top:0.5rem; color:var(--muted);">
          <p style="margin:0.25rem 0;">Основное время: <strong>${displayRegularA} : ${displayRegularB}</strong></p>
          ${displayOvertimeA > 0 || displayOvertimeB > 0 ? `<p style="margin:0.25rem 0;">Доп. время: <strong>${displayOvertimeA} : ${displayOvertimeB}</strong></p>` : ''}
          <p style="margin:0.25rem 0; font-size:0.875rem; opacity:0.7;">Итого: <strong>${displayTotalA} : ${displayTotalB}</strong></p>
        </div>
        ${st.winner ? `<p class="score-winner" style="text-align:center;font-size:1.25rem;margin:0.5rem 0;">Победитель: ${this.esc(st.winner)}</p>` : '<p style="text-align:center;margin:0.5rem 0;color:var(--muted);">Результат: ничья</p>'}
      </section>`;
    }

    return `
      <section class="glass scoreboard-card">
        <p class="score-phase-badge">${phaseLabel}</p>
        <div class="score-duel score-duel--streetball">
          ${this._teamZoneStreetball('A', session.teamA, st.scoreA, !finished)}
          ${this._teamZoneStreetball('B', session.teamB, st.scoreB, !finished)}
        </div>
        ${finished ? '' : `
        <div class="score-actions-row">
          ${st.overtimeActive 
            ? '<button type="button" class="btn btn-danger" data-sb-finish-match>Завершить матч</button>'
            : '<button type="button" class="btn btn-warning" data-sb-end-period>Завершить период</button>'
          }
        </div>`}
      </section>

      ${finished ? summaryBlock : ''}

      ${!finished && st.overtimeActive && st.regularTimeA > 0 ? `
      <section class="glass scoreboard-card scoreboard-card--summary">
        <h3 class="section-title">Результат основного времени</h3>
        <div class="score-match-summary-row" style="display:flex; justify-content:center; align-items:center; gap:1rem; padding:1rem; font-size:1.25rem;">
          <div style="text-align:center;">
            <p style="margin:0 0 0.5rem; font-weight:600;">${this.esc(session.teamA)}</p>
            <p style="margin:0; font-size:2rem; font-weight:800;">${st.regularTimeA}</p>
          </div>
          <span style="color:var(--muted);">:</span>
          <div style="text-align:center;">
            <p style="margin:0 0 0.5rem; font-weight:600;">${this.esc(session.teamB)}</p>
            <p style="margin:0; font-size:2rem; font-weight:800;">${st.regularTimeB}</p>
          </div>
        </div>
      </section>` : ''}

      ${!finished && !st.overtimeActive && st.regularTimeA > 0 && st.regularTimeB > 0 ? `
      <section class="glass scoreboard-card scoreboard-card--summary">
        <h3 class="section-title">Результат периода</h3>
        <div class="score-match-summary-row" style="display:flex; justify-content:center; align-items:center; gap:1rem; padding:1rem; font-size:1.25rem;">
          <div style="text-align:center;">
            <p style="margin:0 0 0.5rem; font-weight:600;">${this.esc(session.teamA)}</p>
            <p style="margin:0; font-size:2rem; font-weight:800;">${st.regularTimeA}</p>
          </div>
          <span style="color:var(--muted);">:</span>
          <div style="text-align:center;">
            <p style="margin:0 0 0.5rem; font-weight:600;">${this.esc(session.teamB)}</p>
            <p style="margin:0; font-size:2rem; font-weight:800;">${st.regularTimeB}</p>
          </div>
        </div>
      </section>` : ''}

      ${!finished && !st.overtimeActive && st.scoreA === st.scoreB && (st.regularTimeA > 0 || st.regularTimeB > 0) ? `
      <section class="glass scoreboard-card scoreboard-card--overtime">
        <h3 class="section-title">Ничейный счёт после периода!</h3>
        <p style="text-align:center;margin-bottom:1rem;">Хотите играть дополнительное время?</p>
        <div class="score-actions-row" style="justify-content:center; gap:1rem;">
          <button type="button" class="btn btn-success" data-sb-overtime>Играть дополнительное время</button>
          <button type="button" class="btn btn-warning" data-sb-finish-draw>Завершить матч (ничья)</button>
        </div>
      </section>` : ''}

      <section class="glass scoreboard-card scoreboard-card--sub">
        <h3 class="section-title">Командные штрафы</h3>
        <div class="score-penalties-duel score-penalties-duel--streetball">
          <div class="score-team-penalty-simple" data-team-penalties="A">
            <p class="score-team-label">${this.esc(session.teamA)}</p>
            <div class="score-penalty-counter">
              <span class="score-penalty-value" data-penalty-display="A">${st.penaltyA}</span>
              <div class="score-penalty-buttons">
                <button type="button" class="btn btn-sm btn-success" data-sb-penalty="A:1">+1</button>
                <button type="button" class="btn btn-sm btn-danger" data-sb-penalty="A:-1">−1</button>
              </div>
            </div>
          </div>
          <div class="score-team-penalty-simple" data-team-penalties="B">
            <p class="score-team-label">${this.esc(session.teamB)}</p>
            <div class="score-penalty-counter">
              <span class="score-penalty-value" data-penalty-display="B">${st.penaltyB}</span>
              <div class="score-penalty-buttons">
                <button type="button" class="btn btn-sm btn-success" data-sb-penalty="B:1">+1</button>
                <button type="button" class="btn btn-sm btn-danger" data-sb-penalty="B:-1">−1</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="glass scoreboard-card scoreboard-card--sub">
        <h3 class="section-title">Секундомер</h3>
        <div class="score-timer-control">
          <div class="score-timer-display ${st.timerElapsedMs >= 600000 ? 'score-timer-display--expired' : ''}" data-timer-display>${ScoreTimer.format(st.timerElapsedMs)}</div>
          <div class="score-timer-buttons">
            ${st.timerElapsedMs < 600000 ? `
            <button type="button" class="btn btn-success" data-sb-timer-start>Старт</button>
            <button type="button" class="btn btn-warning" data-sb-timer-pause>Пауза</button>
            <button type="button" class="btn btn-danger" data-sb-timer-reset>Сброс</button>` : ''}
          </div>
        </div>
      </section>

      ${!finished && !st.overtimeActive && st.timerElapsedMs >= 600000 ? `
      <section class="glass scoreboard-card scoreboard-card--overtime">
        <h3 class="section-title">Основное время истекло!</h3>
        <p style="text-align:center;margin-bottom:1rem;">Счёт ${st.regularTimeA || st.scoreA}:${st.regularTimeB || st.scoreB}. Что дальше?</p>
        <div class="score-actions-row" style="justify-content:center; gap:1rem;">
          <button type="button" class="btn btn-success" data-sb-overtime>Играть дополнительное время</button>
          <button type="button" class="btn btn-warning" data-sb-finish-draw>Завершить матч (ничья)</button>
        </div>
      </section>` : ''}
    `;
  },

  _teamZoneStreetball(side, name, score, editable) {
    return `
      <div class="score-team-zone" data-team="${side}">
        <input type="text" class="score-team-name" data-team-name="${side}" value="${this.esc(name)}" placeholder="Название команды" aria-label="Команда ${side}">
        <div class="score-big" data-score-display="${side}">${score}</div>
        ${editable ? `
        <div class="score-pts-grid score-pts-grid--streetball">
          <button type="button" class="btn score-pt-btn" data-sb-pts="${side}:1">+1</button>
          <button type="button" class="btn score-pt-btn" data-sb-pts="${side}:2">+2</button>
          <button type="button" class="btn score-pt-btn btn-ghost" data-sb-pts="${side}:-1">−1</button>
        </div>` : ''}
      </div>`;
  },

  _bindStreetball(root, session) {
    const st = session.state;
    const persist = () => ScoreStorage.save(session);
    const rerender = () => this.renderSession(root, session);

    // Обновляем дисплей таймера — читаем актуальные данные из хранилища
    const updateTimerDisplay = () => {
      const curSession = ScoreStorage.get(session.id);
      if (!curSession) return;
      const el = root.querySelector('[data-timer-display]');
      if (el) {
        const elapsed = ScoreTimer.getElapsedMs(curSession);
        el.textContent = ScoreTimer.format(elapsed);
        // Обновляем поля состояния для отображения блока после 10 минут
        st.timerRunning = curSession.state.timer.running;
        st.timerElapsedMs = elapsed;
        persist();
      }
    };

    // Score buttons +1, +2, -1
    root.querySelectorAll('[data-sb-pts]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (st.matchFinished) return;
        this._syncNames(session, root);
        const [side, delta] = btn.dataset.sbPts.split(':');
        const d = parseInt(delta, 10);
        if (side === 'A') st.scoreA = Math.max(0, st.scoreA + d);
        else st.scoreB = Math.max(0, st.scoreB + d);
        persist();
        rerender();
      });
    });

    // Team penalty buttons +1, -1
    root.querySelectorAll('[data-sb-penalty]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (st.matchFinished) return;
        this._syncNames(session, root);
        const [side, delta] = btn.dataset.sbPenalty.split(':');
        const d = parseInt(delta, 10);
        if (side === 'A') st.penaltyA = Math.max(0, st.penaltyA + d);
        else st.penaltyB = Math.max(0, st.penaltyB + d);
        persist();
        rerender();
      });
    });

    // Timer controls — используем ScoreTimer.bind для корректной работы интервала
    root.querySelector('[data-sb-timer-start]')?.addEventListener('click', () => {
      ScoreTimer.start(session, updateTimerDisplay);
      persist();
      updateTimerDisplay();
    });

    root.querySelector('[data-sb-timer-pause]')?.addEventListener('click', () => {
      ScoreTimer.pause(session);
      persist();
      updateTimerDisplay();
    });

    root.querySelector('[data-sb-timer-reset]')?.addEventListener('click', () => {
      if (confirm('Сбросить секундомер?')) {
        ScoreTimer.reset(session);
        persist();
        updateTimerDisplay();
      }
    });

    // Завершить период
    root.querySelector('[data-sb-end-period]')?.addEventListener('click', () => {
      this._syncNames(session, root);
      // Сохраняем результат текущего периода
      st.regularTimeA = st.scoreA;
      st.regularTimeB = st.scoreB;
      // Сбрасываем счёт для следующего периода
      st.scoreA = 0;
      st.scoreB = 0;
      // Сбрасываем секундомер
      ScoreTimer.reset(session);
      persist();
      rerender();
    });

    // Finish match button
    root.querySelector('[data-sb-finish-match]')?.addEventListener('click', () => {
      this._syncNames(session, root);
      
      if (st.overtimeActive) {
        // Завершаем матч после овертайма — сохраняем результат овертайма
        st.overtimeScoreA = st.scoreA;
        st.overtimeScoreB = st.scoreB;
      } else {
        // Завершаем основное время — сохраняем результат
        st.regularTimeA = st.scoreA;
        st.regularTimeB = st.scoreB;
      }
      
      st.matchFinished = true;
      
      // Определяем победителя по общему счёту (основное + овертайм)
      const totalA = st.regularTimeA + (st.overtimeScoreA || 0);
      const totalB = st.regularTimeB + (st.overtimeScoreB || 0);
      
      if (totalA > totalB) {
        st.winner = session.teamA;
      } else if (totalB > totalA) {
        st.winner = session.teamB;
      } else {
        st.winner = null; // Ничья даже после овертайма
      }
      
      // Синхронизируем с турниром
      this._syncToTournament(session);
      // Останавливаем секундомер
      ScoreTimer.reset(session);
      // Блокируем кнопки
      this._disableMatchControls(root);
      persist();
      rerender();
    });

    // Finish match with draw (no overtime)
    root.querySelector('[data-sb-finish-draw]')?.addEventListener('click', () => {
      this._syncNames(session, root);
      // Сохраняем результат основного времени
      st.regularTimeA = st.scoreA;
      st.regularTimeB = st.scoreB;
      
      st.matchFinished = true;
      st.winner = null; // Ничья
      
      // Синхронизируем с турниром
      this._syncToTournament(session);
      // Останавливаем секундомер
      ScoreTimer.reset(session);
      // Блокируем кнопки
      this._disableMatchControls(root);
      persist();
      rerender();
    });

    // Overtime button
    root.querySelector('[data-sb-overtime]')?.addEventListener('click', () => {
      this._syncNames(session, root);
      // Сохраняем результат основного времени, если ещё не сохранён
      if (st.regularTimeA === 0 && st.regularTimeB === 0 && (st.scoreA > 0 || st.scoreB > 0)) {
        st.regularTimeA = st.scoreA;
        st.regularTimeB = st.scoreB;
      }
      // Начинаем овертайм с чистого счёта
      st.scoreA = 0;
      st.scoreB = 0;
      st.matchFinished = false;
      st.overtimeActive = true;
      st.overtimeScoreA = 0;
      st.overtimeScoreB = 0;
      // Сбрасываем секундомер для овертайма
      ScoreTimer.reset(session);
      persist();
      rerender();
    });

    // Team name inputs
    root.querySelectorAll('[data-team-name]').forEach((inp) => {
      inp.addEventListener('change', () => {
        this._syncNames(session, root);
        persist();
      });
    });

    // Инициализация: если таймер был запущен, запускаем обновление дисплея
    updateTimerDisplay();
    if (st.timer && st.timer.running) {
      ScoreTimer.start(session, updateTimerDisplay);
    }
  },
};
