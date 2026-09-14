const OlympicUI = {
  _startOlympicBracket(t, randomDraw) {
    const teams = this._collectTeamNames(t.meta.numTeams);
    if (teams.some((x) => !x)) {
      alert('Заполните все названия команд');
      return;
    }
    if (new Set(teams).size !== teams.length) {
      alert('Названия команд должны быть уникальными');
      return;
    }
    t.state.teams = teams;
    t.state.bracket = OlympicEngine.generateBracket(t.meta.numTeams, teams, { random: randomDraw });
    t.state.matchHistory = [];
    t.state.generated = true;
    this.persist(t);
    this.renderOlympic(t);
  },

  renderOlympic(t) {
    this.stopScorePolling();
    const scrollY = window.scrollY;
    const exportBtn = t.state.generated
      ? '<button type="button" class="btn btn-warning" data-export-xlsx>Выгрузить .xlsx</button>'
      : '';
    const publishBtn = t.state.generated
      ? `<button type="button" class="btn btn-success" data-publish-online>Транслировать онлайн</button>
         <button type="button" class="btn btn-sm btn-ghost" data-auto-publish-toggle>Авто-трансляция: ВЫКЛ</button>
         <label class="auto-publish-interval-label">сек: <input type="number" class="auto-publish-interval" data-auto-publish-interval min="2" max="60" value="5"></label>`
      : '';
    this.root.innerHTML = `
      <div class="app-shell">
        ${this._pageHeader('Олимпийская система', `${exportBtn}${exportBtn && publishBtn ? ' ' : ''}${publishBtn}`)}
        <section class="glass">${this._metaForm(t)}</section>
        <div id="oly-workspace"></div>
      </div>
    `;

    this._bindMeta(t, () => {
      if (!t.state.generated) this._renderTeamInputs(t);
      this.renderOlympic(t);
    });
    if (!t.state.generated) this._renderTeamInputs(t);

    document.getElementById('btn-generate')?.addEventListener('click', () => {
      this._startOlympicBracket(t, true);
    });
    document.getElementById('btn-generate-sequential')?.addEventListener('click', () => {
      this._startOlympicBracket(t, false);
    });

    if (!t.state.generated) return;

    if (!t.state.bracket.totalTeams) {
      t.state.bracket.totalTeams = t.meta.numTeams;
    }
    OlympicEngine.normalizeBracket(t.state.bracket);

    const ws = document.getElementById('oly-workspace');
    ws.innerHTML = `
      <section class="glass">
        <h2 class="section-title">Сетка плей-офф</h2>
        <div class="bracket-layout" id="bracket-root" data-tournament-id="${t.id}"></div>
        <div id="oly-results"></div>
        <div class="toolbar">
          <button type="button" class="btn btn-warning" data-export-xlsx>Выгрузить .xlsx</button>
        </div>
      </section>
    `;

    this._renderBracketUI(t);
    this._bindExportButtons(t, () => {
      const fresh = TournamentStorage.get(t.id);
      if (!fresh) return;
      OlympicEngine.exportXlsx(fresh.meta, fresh.state.matchHistory, fresh.state.bracket);
    });
    this._bindPublishButtons(t, () => {
      const fresh = TournamentStorage.get(t.id);
      if (!fresh) return;
      this._publishOnline(t, this._renderOlympicPublishPreview(fresh));
    });
    App.bindAutoPublish(t, () => {
      const fresh = TournamentStorage.get(t.id);
      if (!fresh) return '';
      return this._renderOlympicPublishPreview(fresh);
    });
    this.startScorePolling(t);
    requestAnimationFrame(() => { window.scrollTo(0, scrollY); });
  },

  _renderBracketUI(t) {
    const root = document.getElementById('bracket-root');
    const results = document.getElementById('oly-results');
    if (!root) return;

    const b = t.state.bracket;
    root.innerHTML = '';

    b.rounds.forEach((round, rIdx) => {
      const block = document.createElement('div');
      block.className = 'round-block';
      block.innerHTML = `<h4>${this._esc(OlympicEngine.getRoundLabel(round))}</h4>`;
      if (round.byeNote) {
        block.innerHTML += `<div class="bye-list">${this._esc(round.byeNote)}</div>`;
      } else if (round.byeTeams?.length) {
        block.innerHTML += `<div class="bye-list">Пропускают тур: ${round.byeTeams.map((x) => this._esc(x)).join(', ')}</div>`;
      }
      round.matches.forEach((match, mIdx) => {
        block.appendChild(this._playoffMatchEl(t, match, rIdx, mIdx, 'round'));
      });
      root.appendChild(block);
    });

    if (b.thirdPlaceMatch || b.finalMatch) {
      const finals = document.createElement('div');
      finals.className = 'round-block';
      finals.innerHTML = '<h4>Финальные матчи</h4>';
      if (b.thirdPlaceMatch) {
        finals.appendChild(
          this._playoffMatchEl(t, b.thirdPlaceMatch, null, null, 'third', 'Матч за 3-е место')
        );
      }
      if (b.finalMatch) {
        finals.appendChild(
          this._playoffMatchEl(t, b.finalMatch, null, null, 'final', 'Финал')
        );
      }
      root.appendChild(finals);
    }

    root.onclick = (e) => this._onBracketClick(e);

    root.querySelectorAll('[data-bracket-btn]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const kind = btn.dataset.kind;
        const rIdx = btn.dataset.rIdx !== '' ? parseInt(btn.dataset.rIdx, 10) : null;
        const mIdx = btn.dataset.mIdx !== '' ? parseInt(btn.dataset.mIdx, 10) : null;
        const match = this._getPlayoffMatch(b, kind, rIdx, mIdx);
        if (!match) return;
        const a = match.teamA || t.state.teams[match.teamA] || '';
        const bTeam = match.teamB || t.state.teams[match.teamB] || '';

        const freshT = TournamentStorage.get(t.id);
        const freshMatch = this._getPlayoffMatch(freshT.state.bracket, kind, rIdx, mIdx);
        if (!freshMatch) {
          alert('Матч не найден. Обновите страницу.');
          return;
        }

        if (freshMatch.linkedScoreId) {
          const existingSb = ScoreStorage.getByLinkedId(freshMatch.linkedScoreId);
          if (existingSb) {
              if (existingSb.state?.phase === 'finished') {
                const scores = this._getFinalScore(existingSb);
                const hasChanged = !freshMatch._synced || freshMatch.scoreA !== scores.scoreA || freshMatch.scoreB !== scores.scoreB;
                freshMatch.scoreA = scores.scoreA;
                freshMatch.scoreB = scores.scoreB;
                if (scores.penaltyA != null) freshMatch.penaltyA = scores.penaltyA;
                if (scores.penaltyB != null) freshMatch.penaltyB = scores.penaltyB;
                if (scores.wasDecidedByPenalties) freshMatch.wasDecidedByPenalties = scores.wasDecidedByPenalties;
                if (scores.resultType) freshMatch.resultType = scores.resultType;
                if (scores.scoreA > scores.scoreB) {
                  freshMatch.winner = existingSb.teamA;
                  freshMatch.loser = existingSb.teamB;
                } else if (scores.scoreB > scores.scoreA) {
                  freshMatch.winner = existingSb.teamB;
                  freshMatch.loser = existingSb.teamA;
                } else {
                  if (existingSb.state?.winner) {
                    freshMatch.winner = existingSb.state.winner;
                    freshMatch.loser = existingSb.state.winner === existingSb.teamA ? existingSb.teamB : existingSb.teamA;
                  } else {
                    freshMatch.winner = null;
                    freshMatch.loser = null;
                  }
                }
                freshMatch.isFinished = true;
                freshMatch._synced = true;
                const savedId = existingSb.id;
                setTimeout(() => {
                  location.hash = `#/score/s/${savedId}`;
                }, 50);
                if (hasChanged) {
                  TournamentStorage.save(freshT);
                  setTimeout(() => {
                    this.renderOlympic(freshT);
                  }, 100);
                }
                return;
            }
            window.location.hash = `#/score/s/${existingSb.id}`;
            return;
          }
          freshMatch.linkedScoreId = null;
          TournamentStorage.save(freshT);
          this.renderOlympic(freshT);
          return;
        }

        const newSession = this.createBracketLinkedScoreboard(freshT.id, a, bTeam, kind, rIdx, mIdx);
        if (newSession) {
          setTimeout(() => {
            window.location.hash = `#/score/s/${newSession.id}`;
          }, 50);
        }
      });
    });

    let html = '';
    if (b.thirdPlaceTeam) {
      html += `<div class="results-panel"><h3>Призовые места</h3>
        <div class="medal">🥉 3 место: <strong>${this._esc(b.thirdPlaceTeam)}</strong></div></div>`;
    }
    if (b.finalMatch?.isFinished && b.finalMatch?.winner) {
      const champ = b.finalMatch.winner;
      const second =
        b.finalMatch.teamA === champ ? b.finalMatch.teamB : b.finalMatch.teamA;
      html += `<div class="results-panel"><h3>Итоги</h3>
        <div class="medal">🥇 1 место: <strong>${this._esc(champ)}</strong></div>
        <div class="medal">🥈 2 место: <strong>${this._esc(second)}</strong></div>`;
      if (!b.thirdPlaceTeam && b.thirdPlaceMatch?.isFinished) {
        html += `<div class="medal">🥉 3 место: <strong>${this._esc(b.thirdPlaceMatch.winner)}</strong></div>`;
      }
      html += '</div>';
    }
    results.innerHTML = html;
  },

  _getPlayoffMatch(bracket, kind, rIdx, mIdx) {
    if (kind === 'final') return bracket.finalMatch;
    if (kind === 'third') return bracket.thirdPlaceMatch;
    const ri = parseInt(rIdx, 10);
    const mi = parseInt(mIdx, 10);
    if (isNaN(ri) || isNaN(mi) || !bracket.rounds[ri]) return null;
    return bracket.rounds[ri].matches[mi] || null;
  },

  _onBracketClick(e) {
    const btn = e.target.closest('[data-confirm-playoff]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const root = document.getElementById('bracket-root');
    const tournamentId = root?.dataset.tournamentId;
    if (!tournamentId) return;

    const card = btn.closest('.playoff-match');
    if (!card) return;

    this._confirmPlayoff(
      tournamentId,
      btn.dataset.kind,
      btn.dataset.rIdx,
      btn.dataset.mIdx,
      card
    );
  },

  _playoffMatchEl(t, match, rIdx, mIdx, kind, title) {
    const div = document.createElement('div');
    div.className = 'playoff-match' + (kind === 'final' ? ' final-block' : '');
    let inner = title ? `<strong>${title}</strong>` : '';

    const done = !!(match.isFinished && match.winner) || match.isFinalized;
    const penId = kind === 'round' ? `pen-${rIdx}-${mIdx}` : `pen-${kind}`;
    const hasScoreboard = t.meta?.sport === 'футбол' || t.meta?.sport === 'хоккей' || t.meta?.sport === 'баскетбол' || t.meta?.sport === 'стритбол' || t.meta?.sport === 'волейбол';
    const sportEmoji = t.meta?.sport === 'хоккей' ? '🏒' : (t.meta?.sport === 'волейбол' ? '🏐' : (t.meta?.sport === 'баскетбол' || t.meta?.sport === 'стритбол' ? '🏀' : '⚽'));
    const hasLinked = !!match.linkedScoreId;

    const line = (team, side, score) => {
      const isW = done && match.winner === team;
      const isL = done && match.loser === team;
      
      if (!done) {
        return `
          <div class="team-line ${isW ? 'winner' : ''} ${isL ? 'loser' : ''}">
            <span class="team-name">${this._esc(team)}</span>
            <input type="number" min="0" inputmode="numeric" class="sc-${side} score-input score-input--sm" placeholder="0" aria-label="Счёт">
          </div>`;
      }
      
      return `
        <div class="team-line ${isW ? 'winner' : ''} ${isL ? 'loser' : ''}">
          <span class="team-name">${this._esc(team)}</span>
          <span class="team-score">${score ?? 0}</span>
        </div>`;
    };

    inner += line(match.teamA, 'a', match.scoreA) + line(match.teamB, 'b', match.scoreB);
    
    if (match.penaltyA != null && match.penaltyB != null) {
      inner += `<div class="match-penalty-result">(пен. ${match.penaltyA}:${match.penaltyB})</div>`;
    }
    
    if (match.extraScoreA != null && match.extraScoreB != null) {
      inner += `<div class="match-extra-result">Доп. время: ${match.extraScoreA}:${match.extraScoreB}</div>`;
    }
    
    div.innerHTML = inner;

    if (!done) {
      const pen = document.createElement('div');
      pen.className = 'penalty-row hidden';
      pen.id = penId;
      pen.innerHTML = `
        <span>Пенальти:</span>
        <input type="number" min="0" inputmode="numeric" class="pen-a score-input score-input--sm" aria-label="Пенальти команды А">
        <span aria-hidden="true">:</span>
        <input type="number" min="0" inputmode="numeric" class="pen-b score-input score-input--sm" aria-label="Пенальти команды Б">
      `;
      div.appendChild(pen);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-success playoff-confirm';
      btn.textContent = 'Подтвердить результат';
      btn.setAttribute('data-confirm-playoff', '1');
      btn.dataset.kind = kind;
      btn.dataset.rIdx = rIdx != null ? String(rIdx) : '';
      btn.dataset.mIdx = mIdx != null ? String(mIdx) : '';
      div.appendChild(btn);

      const scA = div.querySelector('.sc-a');
      const scB = div.querySelector('.sc-b');
      const togglePen = () => {
        const a = parseInt(scA.value, 10);
        const b = parseInt(scB.value, 10);
        if (!isNaN(a) && !isNaN(b) && a === b) pen.classList.remove('hidden');
        else pen.classList.add('hidden');
      };
      scA.addEventListener('input', togglePen);
      scB.addEventListener('input', togglePen);

        if (hasScoreboard) {
        const sbBtn = document.createElement('button');
        sbBtn.type = 'button';
        sbBtn.className = 'btn btn-sm btn-scoreboard-match';
        
        let isMatchFinished = false;
        if (hasLinked && match.linkedScoreId) {
          const sb = ScoreStorage.getByLinkedId(match.linkedScoreId);
          if (sb && sb.state?.phase === 'finished' && match._synced) {
            isMatchFinished = true;
          }
        }
        
        if (isMatchFinished) {
          sbBtn.className += ' btn-scoreboard-match--finished';
          sbBtn.textContent = '✓ Матч завершён';
          sbBtn.disabled = true;
        } else {
          sbBtn.textContent = hasLinked ? sportEmoji + ' Счёт' : sportEmoji + ' Вести счёт';
        }
        sbBtn.dataset.bracketBtn = '1';
        sbBtn.dataset.kind = kind;
        sbBtn.dataset.rIdx = rIdx != null ? String(rIdx) : '';
        sbBtn.dataset.mIdx = mIdx != null ? String(mIdx) : '';
        sbBtn.dataset.linked = hasLinked ? '1' : '';
        div.appendChild(sbBtn);
      }
    }

    return div;
  },

  _confirmPlayoff(tournamentId, kind, rIdx, mIdx, cardEl) {
    const t = TournamentStorage.get(tournamentId);
    if (!t?.state?.bracket) return;

    const bracket = t.state.bracket;
    if (!bracket.totalTeams) bracket.totalTeams = t.meta.numTeams;

    const match = this._getPlayoffMatch(bracket, kind, rIdx, mIdx);
    if (!match) {
      alert('Матч не найден. Обновите страницу.');
      return;
    }

    const scoreA = parseInt(cardEl.querySelector('.sc-a')?.value, 10);
    const scoreB = parseInt(cardEl.querySelector('.sc-b')?.value, 10);
    if (isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
      alert('Введите корректный счёт матча (0 или больше)');
      return;
    }

    let penA = null;
    let penB = null;
    if (scoreA === scoreB) {
      penA = parseInt(cardEl.querySelector('.pen-a')?.value, 10);
      penB = parseInt(cardEl.querySelector('.pen-b')?.value, 10);
    }

    const res = OlympicEngine.resolveWinner(match, scoreA, scoreB, penA, penB);
    if (res.error) {
      alert(res.error);
      return;
    }

    try {
      OlympicEngine.finalizeMatch(
        match,
        scoreA,
        scoreB,
        res.penaltyA,
        res.penaltyB,
        res.winner,
        res.loser
      );

      let roundLabel = 'Финал';
      if (kind === 'third') {
        roundLabel = 'Матч за 3-е место';
      } else if (kind === 'round') {
        const ri = parseInt(rIdx, 10);
        const round = bracket.rounds[ri];
        roundLabel = round ? OlympicEngine.getRoundLabel(round) : `Тур ${ri + 1}`;
      }

      if (!Array.isArray(t.state.matchHistory)) t.state.matchHistory = [];
      t.state.matchHistory.push({
        round: roundLabel,
        teamA: match.teamA,
        teamB: match.teamB,
        scoreA,
        scoreB,
        penaltyA: match.penaltyA,
        penaltyB: match.penaltyB,
        winner: match.winner
      });

      if (kind === 'round') {
        const ri = parseInt(rIdx, 10);
        const round = bracket.rounds[ri];
        if (round?.matches?.length && round.matches.every((m) => m.isFinished && m.winner)) {
          OlympicEngine.advanceOnRoundComplete(bracket, ri);
        }
      }

      if (kind === 'final' && match.isFinished && match.loser && !bracket.thirdPlaceTeam) {
        bracket.thirdPlaceTeam = match.loser;
      }

      if (kind === 'third' && match.isFinished && match.winner && !bracket.thirdPlaceTeam) {
        bracket.thirdPlaceTeam = match.winner;
      }

      this.persist(t);
      this.currentId = tournamentId;
      this.renderOlympic(t);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении результата: ' + (err.message || err));
    }
  },

  _renderOlympicPublishPreview(t) {
    const workspace = document.getElementById('oly-workspace');
    if (workspace) return workspace.outerHTML;
    return `<div><h2>Олимпийская система</h2><p>Сетка и результаты доступны в приложении.</p></div>`;
  },
};

window.OlympicUI = OlympicUI;

