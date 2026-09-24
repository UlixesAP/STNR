const RoundRobinUI = {
  _startRoundRobin(t, randomDraw) {
    const teams = this._collectTeamNames(t.meta.numTeams);
    if (teams.some((x) => !x)) {
      alert('Заполните все названия команд');
      return;
    }
    if (new Set(teams).size !== teams.length) {
      alert('Названия команд должны быть уникальными');
      return;
    }
    const n = teams.length;
if (!randomDraw && !ROUND_ROBIN_SCHEDULES[n]) {
      alert(
        'Расписание по турам доступно для 4–20 команд. Для ' +
          n +
          ' команд используйте «Сгенерировать игры» (случайный порядок).'
      );
      return;
    }
    t.state.teams = teams;
    t.state.matches = RoundRobinEngine.generateMatches(teams, { random: randomDraw });
    t.state.scheduleMode = randomDraw ? 'random' : 'sequential';
    t.state.generated = true;
    this.persist(t);
    this.renderRoundRobin(t);
  },

  renderRoundRobin(t) {
    this.stopScorePolling();
    const scrollY = window.scrollY;
    const standings =
      t.state.generated && t.state.teams.length
        ? RoundRobinEngine.calculateStandings(t.state.teams, t.state.matches, t.meta?.sport)
        : [];

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
        ${this._pageHeader('Турнирная таблица', exportBtn + publishBtn)}
        <section class="glass">${this._metaForm(t)}</section>
        <div id="rr-workspace"></div>
      </div>
    `;

    this.root.insertAdjacentHTML('beforeend', this._footerHtml());

    this._bindMeta(t, () => {
      if (!t.state.generated) this._renderTeamInputs(t);
      this.renderRoundRobin(t);
    });
    if (!t.state.generated) this._renderTeamInputs(t);

    document.getElementById('btn-generate')?.addEventListener('click', () => {
      this._startRoundRobin(t, true);
    });
    document.getElementById('btn-generate-sequential')?.addEventListener('click', () => {
      this._startRoundRobin(t, false);
    });

    const ws = document.getElementById('rr-workspace');
    if (!t.state.generated) return;

    ws.innerHTML = `
      <section class="glass">
        <h2 class="section-title">Результаты матчей</h2>
        <div id="matches-list"></div>
      </section>
      <section class="glass">
        <h2 class="section-title">Турнирная таблица</h2>
        <div id="standings-container">${this._rrStandingsBlock(t.state.teams, t.state.matches, standings, t.meta?.sport)}</div>
        <div class="toolbar">
          <button type="button" class="btn btn-warning" data-export-xlsx>Выгрузить .xlsx</button>
        </div>
      </section>
    `;

    this._bindMatchInputs(t, standings);
    this._initResponsiveStandings();
    this._bindExportButtons(t, () => {
      const fresh = TournamentStorage.get(t.id);
      if (!fresh) return;
      const st = RoundRobinEngine.calculateStandings(fresh.state.teams, fresh.state.matches, fresh.meta?.sport);
      RoundRobinEngine.exportXlsx(fresh.meta, fresh.state.teams, fresh.state.matches, st, fresh.meta?.sport);
    });
    this._bindPublishButtons(t, () => {
      const fresh = TournamentStorage.get(t.id);
      if (!fresh) return;
      const st = RoundRobinEngine.calculateStandings(fresh.state.teams, fresh.state.matches, fresh.meta?.sport);
      this._publishOnline(t, this._renderRoundRobinPublishPreview(fresh, st));
    });
    App.bindAutoPublish(t, () => {
      const fresh = TournamentStorage.get(t.id);
      if (!fresh) return '';
      const st = RoundRobinEngine.calculateStandings(fresh.state.teams, fresh.state.matches, fresh.meta?.sport);
      return this._renderRoundRobinPublishPreview(fresh, st);
    });
  },

  _renderMatchRow(t, m, i) {
    // Для групповых систем используем локальные индексы внутри группы
    const groupTeams = m.group != null ? t.state.roundRobin?.groups?.[m.group] : null;
    const a = groupTeams ? groupTeams[m.teamA] : t.state.teams[m.teamA];
    const b = groupTeams ? groupTeams[m.teamB] : t.state.teams[m.teamB];
    const sa = m.scoreA ?? '';
    const sb = m.scoreB ?? '';
    const hasTour = m.tour != null;
    const rowClass = hasTour ? 'match-row match-row--with-tour' : 'match-row match-row--flat';
    const label = hasTour ? `<span class="match-tour-label">Матч ${m.matchInTour}</span>` : '';
    const hasScoreboard = t.meta?.sport === 'футбол' || t.meta?.sport === 'хоккей' || t.meta?.sport === 'баскетбол' || t.meta?.sport === 'стритбол' || t.meta?.sport === 'волейбол';
    const isHockey = t.meta?.sport === 'хоккей';
    const sportEmoji = t.meta?.sport === 'хоккей' ? '🏒' : (t.meta?.sport === 'волейбол' ? '🏐' : (t.meta?.sport === 'баскетбол' || t.meta?.sport === 'стритбол' ? '🏀' : '⚽'));
    const hasLinked = !!m.linkedScoreId;
    const sbExists = hasLinked ? !!ScoreStorage.getByLinkedId(m.linkedScoreId) : false;
    const isMatchFinished = m._synced || (m.isPlayed && m.scoreA !== '' && m.scoreB !== '');
    
    let statusHtml = '';
    if (isMatchFinished) {
      const sA = m.scoreA ?? 0;
      const sB = m.scoreB ?? 0;
      if (m.winner) statusHtml = `${m.winner} выигрывает`;
      else if (sA === sB) statusHtml = 'Ничья';
      else statusHtml = 'Матч завершён';
    }
    
    let scoreboardBtn = '';
    let recordBtn = '';
    
    if (hasScoreboard) {
      if (isMatchFinished) {
        scoreboardBtn = `
          <button type="button" class="btn btn-sm btn-scoreboard-match btn-scoreboard-match--finished" disabled>
            ✓ Матч завершён
          </button>`;
        recordBtn = `
          <button type="button" class="btn btn-sm btn-record-match btn-record-match--finished" disabled>
            ✓ Записано
          </button>`;
      } else if (hasLinked) {
        scoreboardBtn = `
          <button type="button" class="btn btn-sm btn-scoreboard-match" data-match-btn="${i}" data-linked="${sbExists ? '1' : ''}">
            ${sbExists ? sportEmoji + ' Счёт' : sportEmoji + ' Вести счёт'}
          </button>`;
        recordBtn = `
          <button type="button" class="btn btn-sm btn-record-match" data-record-btn="${i}">
            ✎ Записать счёт
          </button>`;
      } else {
        scoreboardBtn = `
          <button type="button" class="btn btn-sm btn-scoreboard-match" data-match-btn="${i}">
            ${sportEmoji} Вести счёт
          </button>`;
        recordBtn = `
          <button type="button" class="btn btn-sm btn-record-match" data-record-btn="${i}">
            ✎ Записать счёт
          </button>`;
      }
    } else {
      if (isMatchFinished) {
        recordBtn = `
          <button type="button" class="btn btn-sm btn-record-match btn-record-match--finished" disabled>
            ✓ Записано
          </button>`;
      } else {
        recordBtn = `
          <button type="button" class="btn btn-sm btn-record-match" data-record-btn="${i}">
            ✎ Записать счёт
          </button>`;
      }
    }
    
    const scoreInputsDisabled = isMatchFinished ? ' disabled' : '';
    
    const hockeyResultSelect = isHockey && !isMatchFinished ? `
          <select class="score-input hockey-result-select" data-result-type="${i}" aria-label="Тип результата">
            <option value=""${!m.resultType ? ' selected' : ''}></option>
            <option value="regulation"${m.resultType === 'regulation' ? ' selected' : ''}>Регламент</option>
            <option value="overtime"${m.resultType === 'overtime' ? ' selected' : ''}>Овертайм</option>
            <option value="shootout"${m.resultType === 'shootout' ? ' selected' : ''}>Буллиты</option>
          </select>` : '';
    const hockeyResultLabel = isHockey && isMatchFinished && m.resultType
      ? `<span class="hockey-result-badge">${m.resultType === 'overtime' ? 'ВО' : m.resultType === 'shootout' ? 'ВБ' : 'В'}</span>`
      : '';

    return `
      <div class="${rowClass} ${isMatchFinished ? 'match-row--played' : ''}" id="mrow-${i}">
        ${label}
        <div class="match-row__teams">
          <span class="team-name team-name--away">${this._esc(a)}</span>
          <div class="scores">
            <input type="number" min="0" inputmode="numeric" class="sc-a score-input" data-i="${i}" value="${sa}" placeholder="0" aria-label="Счёт ${this._esc(a)}"${scoreInputsDisabled}>
            <span aria-hidden="true">:</span>
            <input type="number" min="0" inputmode="numeric" class="sc-b score-input" data-i="${i}" value="${sb}" placeholder="0" aria-label="Счёт ${this._esc(b)}"${scoreInputsDisabled}>
            ${hockeyResultSelect}
            ${hockeyResultLabel}
          </div>
          <span class="team-name">${this._esc(b)}</span>
        </div>
        <div class="match-row__footer">
          <div class="match-row__actions">
            <span class="match-status${isMatchFinished ? ' match-status--finished' : ''}" id="mst-${i}">${statusHtml}</span>
            ${recordBtn}
            ${scoreboardBtn}
          </div>
        </div>
      </div>`;
  },

  _bindMatchInputs(t, standings) {
    const list = document.getElementById('matches-list');
    if (!list) return;

    const useTours =
      t.state.scheduleMode === 'sequential' &&
      t.state.matches.some((m) => m.tour != null);

    if (useTours) {
      const groups = RoundRobinEngine.getTourGroups(t.state.matches);
      list.innerHTML = groups
        .map((g) => {
          let html = `<div class="rr-tour-block"><h4 class="rr-tour-title">Тур ${g.tour}</h4>`;
          if (g.restTeam != null && t.state.teams[g.restTeam]) {
            html += `<div class="rr-tour-rest">Отдыхает: ${this._esc(t.state.teams[g.restTeam])}</div>`;
          }
          html += g.matches
            .map(({ match, index }) => this._renderMatchRow(t, match, index))
            .join('');
          html += '</div>';
          return html;
        })
        .join('');
    } else {
      list.innerHTML = t.state.matches
        .map((m, i) => this._renderMatchRow(t, m, i))
        .join('');
    }

    const update = () => {
      t.state.matches.forEach((m, i) => {
        // Если матч зафиксирован, не позволяем менять счёт
        if (m.isFinalized) return;
        
        const aIn = list.querySelector(`.sc-a[data-i="${i}"]`);
        const bIn = list.querySelector(`.sc-b[data-i="${i}"]`);
        if (!aIn || !bIn) return;
        const sa = aIn.value === '' ? null : parseInt(aIn.value, 10);
        const sb = bIn.value === '' ? null : parseInt(bIn.value, 10);
        m.scoreA = sa;
        m.scoreB = sb;
        m.isPlayed =
          sa !== null && sb !== null && !isNaN(sa) && !isNaN(sb) && sa >= 0 && sb >= 0;
        const st = document.getElementById(`mst-${i}`);
        if (m._synced || m.isFinalized) {
          const teamAName = t.state.teams[m.teamA];
          const teamBName = t.state.teams[m.teamB];
          if (m.winner) st.textContent = `${m.winner} выигрывает`;
          else if (m.scoreA != null && m.scoreB != null && m.scoreA === m.scoreB) st.textContent = 'Ничья';
          else st.textContent = 'Матч завершён';
          st.className = 'match-status match-status--finished';
        } else if (m.isPlayed) {
          if (sa > sb) st.textContent = `${t.state.teams[m.teamA]} выигрывает`;
          else if (sb > sa) st.textContent = `${t.state.teams[m.teamB]} выигрывает`;
          else st.textContent = 'Ничья';
          st.className = 'match-status';
        } else {
          st.textContent = 'Ожидание';
          st.className = 'match-status';
        }
      });
      this.persist(t);
      this._updateStandingsDom(t);
    };

    list.querySelectorAll('input').forEach((inp) => {
      // Не позволяем менять счёт зафиксированных матчей
      const dataI = inp.dataset.i;
      const match = t.state.matches[parseInt(dataI, 10)];
      if (match?.isFinalized) {
        inp.disabled = true;
        inp.classList.add('score-input--disabled');
      }
      inp.addEventListener('input', update);
    });

    list.querySelectorAll('[data-match-btn]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.dataset.matchBtn, 10);
        const m = t.state.matches[idx];
        if (!m) return;
        const a = t.state.teams[m.teamA];
        const bTeam = t.state.teams[m.teamB];

        // Всегда берем свежую копию турнира из хранилища
        const freshT = TournamentStorage.get(t.id);
        const freshM = freshT.state.matches[idx];

        // Сначала проверяем linkedScoreId прямо из матча
        if (freshM.linkedScoreId) {
          const existingSb = ScoreStorage.getByLinkedId(freshM.linkedScoreId);
          if (existingSb) {
            // Табло существует, проверяем, завершен ли матч
            if (existingSb.state?.phase === 'finished') {
              const scores = this._getFinalScore(existingSb);
              const hasChanged = !freshM._synced || freshM.scoreA !== scores.scoreA || freshM.scoreB !== scores.scoreB;
              freshM.scoreA = scores.scoreA;
              freshM.scoreB = scores.scoreB;
              if (scores.penaltyA != null) freshM.penaltyA = scores.penaltyA;
              if (scores.penaltyB != null) freshM.penaltyB = scores.penaltyB;
              if (scores.wasDecidedByPenalties) freshM.wasDecidedByPenalties = scores.wasDecidedByPenalties;
              if (scores.resultType) freshM.resultType = scores.resultType;
              freshM.isPlayed = true;
              if (scores.scoreA > scores.scoreB) {
                freshM.winner = existingSb.teamA;
              } else if (scores.scoreB > scores.scoreA) {
                freshM.winner = existingSb.teamB;
              } else {
                freshM.winner = null;
              }
              freshM._synced = true;
              // АСИНХРОННО: сначала hash, потом ререндер
              const savedSbId = existingSb.id;
              setTimeout(() => { location.hash = '#/score/s/' + savedSbId; }, 50);
              if (hasChanged) {
                TournamentStorage.save(freshT);
                setTimeout(() => { this.renderRoundRobin(freshT); }, 100);
              }
              return;
            }
            // Просто открываем существующее табло
            window.location.hash = `#/score/s/${existingSb.id}`;
            return;
          }
          // Табло было удалено, очищаем linkedScoreId
          freshM.linkedScoreId = null;
          TournamentStorage.save(freshT);
          this.renderRoundRobin(freshT);
          return;
        }

        // Табло нет, создаём новое
        const newSession = this.createLinkedScoreboard(freshT.id, a, bTeam, idx);
        if (newSession) {
          setTimeout(() => {
            window.location.hash = `#/score/s/${newSession.id}`;
          }, 50);
        }
      });
    });

    // Кнопки "Записать счёт" - берём счёт из полей ввода на строке матча
    list.querySelectorAll('[data-record-btn]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.dataset.recordBtn, 10);
        const m = t.state.matches[idx];
        if (!m) return;
        
        const freshT = TournamentStorage.get(t.id);
        const freshM = freshT?.state?.matches?.[idx];
        if (!freshM) {
          alert('Матч не найден. Обновите страницу.');
          return;
        }
        
        // Берём счёт из полей ввода на строке матча
        const scoreAInput = list.querySelector(`.sc-a[data-i="${idx}"]`);
        const scoreBInput = list.querySelector(`.sc-b[data-i="${idx}"]`);
        const scoreA = scoreAInput ? parseInt(scoreAInput.value, 10) : null;
        const scoreB = scoreBInput ? parseInt(scoreBInput.value, 10) : null;
        
        if (scoreA === null || scoreB === null || isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
          alert('Введите корректный счёт (числа 0 или больше) в поля результата матча.');
          return;
        }

        const teamA = freshT.state.teams[freshM.teamA];
        const teamB = freshT.state.teams[freshM.teamB];

        if (freshT.meta?.sport === 'хоккей' && scoreA !== scoreB) {
          const rtSelect = list.querySelector(`[data-result-type="${idx}"]`);
          const resultType = rtSelect ? rtSelect.value : '';
          if (!resultType) {
            alert('Для хоккейного матча выберите тип результата (Регламент / Овертайм / Буллиты).');
            return;
          }
          freshM.resultType = resultType;
        }

        freshM.scoreA = scoreA;
        freshM.scoreB = scoreB;
        freshM.isPlayed = true;
        if (scoreA > scoreB) {
          freshM.winner = teamA;
          freshM.loser = teamB;
        } else if (scoreB > scoreA) {
          freshM.winner = teamB;
          freshM.loser = teamA;
        } else {
          freshM.winner = null;
          freshM.loser = null;
        }
        
        freshM._synced = true;
        TournamentStorage.save(freshT);

        // Обновляем строку матча инлайн (без полного ререндера)
        const matchRow = list.querySelector(`#mrow-${idx}`);
        if (matchRow) {
          matchRow.classList.add('match-row--finished');
          matchRow.querySelectorAll('input.score-input').forEach(inp => { inp.disabled = true; });
          const recBtn = matchRow.querySelector('[data-record-btn]');
          if (recBtn) recBtn.style.display = 'none';
          const st = matchRow.querySelector(`#mst-${idx}`);
          if (st) {
            if (scoreA > scoreB) st.textContent = `${teamA} выигрывает`;
            else if (scoreB > scoreA) st.textContent = `${teamB} выигрывает`;
            else st.textContent = 'Ничья';
            st.className = 'match-status match-status--finished';
          }
        }
        this._updateStandingsDom(freshT);
      });
    });

    update();

    this.startScorePolling(t);
    requestAnimationFrame(() => { window.scrollTo(0, scrollY); });
  },

  _rrTableHtml(teams, matches, standings, sport) {
    const n = teams.length;
    const isHockey = sport === 'хоккей';
    // Создаём lookup-таблицу для быстрого доступа к данным standings по индексу команды
    const standingsMap = {};
    standings.forEach(s => { standingsMap[s.index] = s; });
    
    let h = '<table class="standings-table"><thead><tr><th class="col-sticky-num">№</th><th class="col-sticky-team">Команда</th>';
    for (let i = 1; i <= n; i++) h += '<th>И' + i + '</th>';
    if (isHockey) {
      h += '<th>В</th><th>ВО</th><th>ВБ</th><th>ПБ</th><th>ПО</th><th>П</th><th>ШЗ</th><th>ШП</th><th>Р</th><th>О</th><th>Место</th></tr></thead><tbody>';
    } else {
      h += '<th>В</th><th>Н</th><th>П</th><th>ЗМ</th><th>ПМ</th><th>Р</th><th>О</th><th>Место</th></tr></thead><tbody>';
    }

    // Используем исходный порядок команд из teams, а не отсортированный standings
    teams.forEach((teamName, teamIdx) => {
      const team = standingsMap[teamIdx];
      if (!team) return;
      const plc = team.place <= 3 ? 'place-' + team.place : '';
      h += '<tr><td class="col-sticky-num">' + (team.index + 1) + '</td><td class="col-sticky-team">' + this._esc(team.name) + '</td>';
      for (let j = 0; j < n; j++) {
        if (j === team.index) {
          h += '<td class="cell-diagonal">—</td>';
        } else {
          const cell = RoundRobinEngine.getMatchCell(matches, team.index, j);
          if (!cell) h += '<td>—</td>';
          else {
            let cls = 'cell-draw';
            if (cell.scored > cell.conceded) cls = 'cell-win';
            if (cell.scored < cell.conceded) cls = 'cell-loss';
            h += '<td class="' + cls + '"><strong>' + cell.scored + ':' + cell.conceded + '</strong></td>';
          }
        }
      }
      const gd = team.goalsFor - team.goalsAgainst;
      if (isHockey) {
        h += '<td>' + team.wins + '</td><td>' + (team.winsOT || 0) + '</td><td>' + (team.winsSO || 0) + '</td>';
        h += '<td>' + (team.lossesSO || 0) + '</td><td>' + (team.lossesOT || 0) + '</td><td>' + team.losses + '</td>';
      } else {
        h += '<td>' + team.wins + '</td><td>' + team.draws + '</td><td>' + team.losses + '</td>';
      }
      h += '<td>' + team.goalsFor + '</td><td>' + team.goalsAgainst + '</td>';
      h += '<td>' + (gd > 0 ? '+' : '') + gd + '</td><td><strong>' + team.points + '</strong></td>';
      h += '<td class="' + plc + '">' + (team.place || '—') + '</td></tr>';
    });
    return h + '</tbody></table>';
  },

  _rrStandingsBlock(teams, matches, standings, sport) {
    return `
      <div class="standings-scroll is-cards-only" id="standings-scroll">
        <div class="standings-wrap">${this._rrTableHtml(teams, matches, standings, sport)}</div>
        <span class="standings-scroll-hint" aria-hidden="true">Проведите пальцем влево‑вправо для просмотра таблицы</span>
        <div class="standings-cards" role="list">${this._rrStandingsCardsHtml(standings, sport)}</div>
      </div>`;
  },

  _rrStandingsCardsHtml(standings, sport) {
    const isHockey = sport === 'хоккей';
    return standings
      .map((team) => {
        const gd = team.goalsFor - team.goalsAgainst;
        const plc = team.place <= 3 ? ` place-${team.place}` : '';
        const statsHtml = isHockey
          ? `<dl class="standings-card-item__stats">
            <dt>Очки</dt><dd>${team.points}</dd>
            <dt>В / ВО / ВБ</dt><dd>${team.wins} / ${team.winsOT || 0} / ${team.winsSO || 0}</dd>
            <dt>ПБ / ПО / П</dt><dd>${team.lossesSO || 0} / ${team.lossesOT || 0} / ${team.losses}</dd>
            <dt>ШЗ : ШП</dt><dd>${team.goalsFor} : ${team.goalsAgainst}</dd>
            <dt>Разница</dt><dd>${gd > 0 ? '+' : ''}${gd}</dd>
          </dl>`
          : `<dl class="standings-card-item__stats">
            <dt>Очки</dt><dd>${team.points}</dd>
            <dt>В / Н / П</dt><dd>${team.wins} / ${team.draws} / ${team.losses}</dd>
            <dt>ЗМ : ПМ</dt><dd>${team.goalsFor} : ${team.goalsAgainst}</dd>
            <dt>Разница</dt><dd>${gd > 0 ? '+' : ''}${gd}</dd>
          </dl>`;
        return `
        <article class="standings-card-item${plc}" role="listitem">
          <div class="standings-card-item__head">
            <span class="standings-card-item__name">${team.index + 1}. ${this._esc(team.name)}</span>
            <span class="standings-card-item__place">${team.place || '—'}</span>
          </div>
          ${statsHtml}
        </article>`;
      })
      .join('');
  },

  _renderRoundRobinPublishPreview(t, standings) {
    const workspace = document.getElementById('rr-workspace');
    if (workspace) return workspace.outerHTML;
    return `<div><h2>Турнирная таблица</h2>${this._rrTableHtml(t.state.teams, t.state.matches, standings, t.meta?.sport)}</div>`;
  },

  _updateStandingsDom(t) {
    const scrollY = window.scrollY;
    const st = RoundRobinEngine.calculateStandings(t.state.teams, t.state.matches, t.meta?.sport);
    const container = document.getElementById('standings-container');
    if (container) {
      container.innerHTML = this._rrStandingsBlock(t.state.teams, t.state.matches, st, t.meta?.sport);
      this._initResponsiveStandings();
    }
    setTimeout(() => { window.scrollTo(0, scrollY); }, 0);
    return st;
  },
};

window.RoundRobinUI = RoundRobinUI;

