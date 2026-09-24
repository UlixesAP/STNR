const ScoreboardCore = {
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
    if (sport === 'hockey') {
      const totals = this._computeTotals(st);
      const periodA = totals.periodA;
      const periodB = totals.periodB;
      const otA = totals.overtimePeriodA;
      const otB = totals.overtimePeriodB;
      const shotsA = st.penaltyShootouts?.shotsA || [];
      const shotsB = st.penaltyShootouts?.shotsB || [];
      const hadShootout = shotsA.length > 0 && shotsB.length > 0;
      const hadOvertime = (st.overtimePeriods || []).length > 0;
      let resultType = 'regulation';
      if (hadShootout) resultType = 'shootout';
      else if (hadOvertime) resultType = 'overtime';
      return {
        scoreA: periodA + otA + st.scoreA,
        scoreB: periodB + otB + st.scoreB,
        regularTotalA: periodA,
        regularTotalB: periodB,
        extraScoreA: otA,
        extraScoreB: otB,
        resultType
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
      const t = TournamentStorage.get(session.tournamentId);
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

      let targetMatch = null;
      let isGroupMatch = false;

      if (t.type === 'round-robin') {
        targetMatch = t.state.matches?.[session.matchIndex];
        isGroupMatch = true;
      } else if (t.type === 'mixed') {
        if (session.isFinalRound && session.matchIndex != null) {
          targetMatch = t.state.playoff?.roundRobin?.matches?.[session.matchIndex];
          isGroupMatch = true;
        } else if (session.matchIndex != null) {
          targetMatch = t.state.roundRobin?.matches?.[session.matchIndex];
          isGroupMatch = true;
        } else if (session.bracketMatch) {
          const bracket = t.state.playoff?.bracket;
          if (bracket) {
            const { kind, rIdx, mIdx } = session.bracketMatch;
            if (kind === 'final') {
              targetMatch = bracket.finalMatch;
            } else if (kind === 'third') {
              targetMatch = bracket.thirdPlaceMatch;
            } else {
              targetMatch = bracket.rounds?.[parseInt(rIdx)]?.matches?.[parseInt(mIdx)];
            }
          }
        }
      } else if (t.type === 'olympic') {
        const bracket = t.state.bracket;
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
      }
      if (!targetMatch) return;

      const hasChanged = targetMatch.scoreA !== finalScoreA || targetMatch.scoreB !== finalScoreB;
      if (scores.penaltyA !== null || scores.penaltyB !== null) {
        targetMatch._synced = false;
      }
      if (targetMatch._synced && !hasChanged) return;

      targetMatch.scoreA = finalScoreA;
      targetMatch.scoreB = finalScoreB;
      targetMatch.isPlayed = true;
      targetMatch.penaltyA = scores.penaltyA;
      targetMatch.penaltyB = scores.penaltyB;
      targetMatch.wasDecidedByPenalties = scores.wasDecidedByPenalties;
      if (scores.resultType) targetMatch.resultType = scores.resultType;
      if (scores.extraScoreA != null) targetMatch.extraScoreA = scores.extraScoreA;
      if (scores.extraScoreB != null) targetMatch.extraScoreB = scores.extraScoreB;
      if (finalScoreA > finalScoreB) {
        targetMatch.winner = session.teamA;
        targetMatch.loser = session.teamB;
      } else if (finalScoreB > finalScoreA) {
        targetMatch.winner = session.teamB;
        targetMatch.loser = session.teamA;
      } else {
        if (isGroupMatch) {
          targetMatch.winner = st.winner || null;
        } else {
          targetMatch.winner = st.winner || null;
          targetMatch.loser = st.winner ? (st.winner === session.teamA ? session.teamB : session.teamA) : null;
        }
      }
      if (!isGroupMatch && session.bracketMatch) {
        targetMatch.isFinished = true;
      }
      targetMatch._synced = true;
      TournamentStorage.save(t);
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

    this.root.insertAdjacentHTML('beforeend', this._footerHtml());

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

  _tournamentHash(tournamentId) {
    if (!tournamentId) return '#/';
    const t = TournamentStorage.get(tournamentId);
    return t ? '#/t/' + t.id : '#/';
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

    const hasTournament = session && session.tournamentId;
    const tournamentHash = hasTournament ? this._tournamentHash(session.tournamentId) : '#/';
    const tournamentBackButton = hasTournament
      ? `<a href="${tournamentHash}" class="btn btn-ghost btn-sm">← К турниру</a>`
      : '';

    root.innerHTML = `
      <div class="app-shell scoreboard-page">
        <header class="app-header">
          <div class="app-header__top">
            <a href="#/score" class="btn btn-ghost btn-sm">← Выбор спорта</a>
            ${tournamentBackButton}
            <h1 class="page-title-offset">${sp.label}</h1>
          </div>
          <div class="app-header__actions">
            ${Theme.controlHtml()}
            <button type="button" class="btn btn-warning btn-sm" data-export-score>Excel</button>
            <button type="button" class="btn btn-success btn-sm" data-publish-score>Транслировать онлайн</button>
            <button type="button" class="btn btn-sm btn-ghost" data-auto-publish-toggle>Авто-трансляция: ВЫКЛ</button>
            <label class="auto-publish-interval-label">сек: <input type="number" class="auto-publish-interval" data-auto-publish-interval min="2" max="60" value="5"></label>
          </div>
        </header>
        ${body}
      </div>`;

    this.root.insertAdjacentHTML('beforeend', this._footerHtml());

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
    App.bindAutoPublish(session, () => {
      return this._renderScoreboardPublishPreview(session);
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
};

window.ScoreboardCore = ScoreboardCore;

