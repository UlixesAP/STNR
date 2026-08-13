const App = {
  root: null,
  currentId: null,
  _scorePollInterval: null,
  _currentTournament: null,

  ensureLinkedScoreId(t, matchIndex) {
    const m = t.state.matches?.[matchIndex];
    if (!m) return null;
    if (!m.linkedScoreId) {
      m.linkedScoreId = 'ls_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      this.persist(t);
    }
    return m.linkedScoreId;
  },

  ensureBracketLinkedScoreId(t, kind, rIdx, mIdx) {
    const match = this._getPlayoffMatch(t.state.bracket, kind, rIdx, mIdx);
    if (!match) return null;
    const key = `${kind}-${rIdx}-${mIdx}`;
    if (!match.linkedScoreId) {
      match.linkedScoreId = 'ls_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      this.persist(t);
    }
    return match.linkedScoreId;
  },

  createLinkedScoreboard(tournamentId, teamA, teamB, matchIndex) {
    const t = TournamentStorage.get(tournamentId);
    if (!t) return null;

    const match = t.state.matches?.[matchIndex];
    if (!match) return null;

    // Если уже есть linkedScoreId - ищем scoreboard по этому ID
    if (match.linkedScoreId) {
      const existing = ScoreStorage.getByLinkedId(match.linkedScoreId);
      if (existing) {
        return existing;
      }
      // Табло удалено, можно создать новое
    }

    // Генерируем ID до сохранения
    const linkedScoreId = 'ls_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    match.linkedScoreId = linkedScoreId;
    this.persist(t);

    // Создаём scoreboard с тем же ID
    const session = ScoreStorage.create('football');
    
    // Устанавливаем названия команд
    session.teamA = teamA;
    session.teamB = teamB;
    session.tournamentId = tournamentId;
    session.matchIndex = matchIndex;
    session.linkedScoreId = linkedScoreId;
    session.updatedAt = new Date().toISOString();
    
    // Явно обновляем scoreboard в хранилище
    ScoreStorage.save(session);
    
    return session;
  },

  createBracketLinkedScoreboard(tournamentId, teamA, teamB, kind, rIdx, mIdx) {
    const t = TournamentStorage.get(tournamentId);
    if (!t) return null;

    const match = this._getPlayoffMatch(t.state.bracket, kind, rIdx, mIdx);
    if (!match) return null;

    const linkedScoreId = 'ls_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    match.linkedScoreId = linkedScoreId;
    this.persist(t);

    const session = ScoreStorage.create('football');
    session.teamA = teamA;
    session.teamB = teamB;
    session.tournamentId = tournamentId;
    session.matchIndex = null;
    session.bracketMatch = { kind, rIdx: String(rIdx), mIdx: String(mIdx) };
    session.linkedScoreId = linkedScoreId;
    session.updatedAt = new Date().toISOString();
    ScoreStorage.save(session);
    
    return session;
  },

  /**
   * Получить финальный счёт матча с учётом пенальти для football
   */
  _getFinalScore(sb) {
    if (!sb || !sb.state) return { scoreA: 0, scoreB: 0 };
    const st = sb.state;
    const sport = sb.sport;
    
    // Для football — счёт основного + дополнительного времени (без пенальти)
    if (sport === 'football') {
      let regularA = 0;
      let regularB = 0;
      let extraA = 0;
      let extraB = 0;
      
      if (st.phase === 'finished' || st.phase === 'extra_draw' || st.phase === 'penalties') {
        // Матч завершён или близок к завершению — берём regularTotal
        regularA = st.regularTotalA || 0;
        regularB = st.regularTotalB || 0;
        if (st.extra && st.extra.recorded) {
          extraA = st.extra.scoreA || 0;
          extraB = st.extra.scoreB || 0;
        }
      } else {
        // Матч в процессе — берём текущий счёт
        regularA = st.scoreA || 0;
        regularB = st.scoreB || 0;
      }
      
      const scoreA = regularA + extraA;
      const scoreB = regularB + extraB;
      
      // Если есть серия пенальти, возвращаем отдельно счёт и результат пенальти
      if (st.phase === 'finished' && st.penalties && st.penalties.shotsA && st.penalties.shotsA.length > 0) {
        const penaltyA = st.penalties.shotsA.filter(Boolean).length;
        const penaltyB = st.penalties.shotsB.filter(Boolean).length;
        return { 
          scoreA, 
          scoreB,
          penaltyA,
          penaltyB,
          wasDecidedByPenalties: regularA === regularB && extraA === extraB
        };
      }
      
      return { 
        scoreA, 
        scoreB,
        penaltyA: null,
        penaltyB: null,
        wasDecidedByPenalties: false
      };
    }
    
    // Для других видов спорта — используем regularTotal или текущий счёт
    const scoreA = st.regularTotalA ?? st.scoreA ?? 0;
    const scoreB = st.regularTotalB ?? st.scoreB ?? 0;
    return { 
      scoreA, 
      scoreB,
      penaltyA: null,
      penaltyB: null,
      wasDecidedByPenalties: false
    };
  },

  startScorePolling(t) {
    this.stopScorePolling();
    this._currentTournament = t;
    this._scorePollInterval = setInterval(() => {
      if (!this._currentTournament) {
        this.stopScorePolling();
        return;
      }
      const fresh = TournamentStorage.get(this._currentTournament.id);
      if (!fresh) {
        this.stopScorePolling();
        return;
      }

      let hasChanges = false;

      if (fresh.type === 'round-robin') {
        const matches = fresh.state.matches || [];
        for (const m of matches) {
          if (!m.linkedScoreId) continue;
          const sb = ScoreStorage.getByLinkedId(m.linkedScoreId);
          if (sb && sb.state?.phase === 'finished') {
            const scores = this._getFinalScore(sb);
            const hasChanged = !m._synced || m.scoreA !== scores.scoreA || m.scoreB !== scores.scoreB;
            m.scoreA = scores.scoreA;
            m.scoreB = scores.scoreB;
            if (scores.penaltyA != null) m.penaltyA = scores.penaltyA;
            if (scores.penaltyB != null) m.penaltyB = scores.penaltyB;
            if (scores.wasDecidedByPenalties) m.wasDecidedByPenalties = scores.wasDecidedByPenalties;
            m.isPlayed = true;
            if (scores.scoreA > scores.scoreB) {
              m.winner = sb.teamA;
            } else if (scores.scoreB > scores.scoreA) {
              m.winner = sb.teamB;
            } else {
              m.winner = null;
            }
            m._synced = true;
            if (hasChanged) hasChanges = true;
          }
        }
      } else if (fresh.type === 'olympic') {
        const bracket = fresh.state.bracket;
        const checkMatch = (match) => {
          if (!match?.linkedScoreId) return;
          const sb = ScoreStorage.getByLinkedId(match.linkedScoreId);
          if (sb && sb.state?.phase === 'finished') {
            const scores = this._getFinalScore(sb);
            const hasChanged = !match._synced || match.scoreA !== scores.scoreA || match.scoreB !== scores.scoreB;
            match.scoreA = scores.scoreA;
            match.scoreB = scores.scoreB;
            if (scores.penaltyA != null) match.penaltyA = scores.penaltyA;
            if (scores.penaltyB != null) match.penaltyB = scores.penaltyB;
            if (scores.wasDecidedByPenalties) match.wasDecidedByPenalties = scores.wasDecidedByPenalties;
            // Используем победителя из scoreboard (там уже учтены пенальти)
            if (sb.state?.winner) {
              match.winner = sb.state.winner;
              match.loser = sb.state.winner === sb.teamA ? sb.teamB : sb.teamA;
            } else if (scores.scoreA > scores.scoreB) {
              match.winner = sb.teamA;
              match.loser = sb.teamB;
            } else if (scores.scoreB > scores.scoreA) {
              match.winner = sb.teamB;
              match.loser = sb.teamA;
            } else {
              match.winner = null;
              match.loser = null;
            }
            match.isFinished = true;
            match._synced = true;
            if (hasChanged) hasChanges = true;
          }
        };
        
        if (bracket?.rounds) {
          for (const round of bracket.rounds) {
            for (const match of round.matches) {
              checkMatch(match);
            }
          }
        }
        checkMatch(bracket.finalMatch);
        checkMatch(bracket.thirdPlaceMatch);
        
        // Обработка финала: фиксируем 3-е место из проигравшего финала
        if (bracket.finalMatch?.isFinished && bracket.finalMatch.loser && !bracket.thirdPlaceTeam) {
          bracket.thirdPlaceTeam = bracket.finalMatch.loser;
          hasChanges = true;
        }
        
        // Обработка матча за 3-е место: фиксируем 3-е место
        if (bracket.thirdPlaceMatch?.isFinished && bracket.thirdPlaceMatch.loser && !bracket.thirdPlaceTeam) {
          bracket.thirdPlaceTeam = bracket.thirdPlaceMatch.loser;
          hasChanges = true;
        }
        
        // Проверяем, все ли матчи раунда завершены, и продвигаем команды
        if (bracket?.rounds) {
          for (let ri = 0; ri < bracket.rounds.length; ri++) {
            const round = bracket.rounds[ri];
            if (round?.matches?.length && round.matches.every((m) => m.isFinished && m.winner)) {
              OlympicEngine.advanceOnRoundComplete(bracket, ri);
              hasChanges = true;
            }
          }
        }
      }

      if (hasChanges) {
        this.persist(fresh);
        if (fresh.type === 'round-robin') {
          this.renderRoundRobin(fresh);
        } else {
          this.renderOlympic(fresh);
        }
      }
    }, 2000);
  },

  stopScorePolling() {
    if (this._scorePollInterval) {
      clearInterval(this._scorePollInterval);
      this._scorePollInterval = null;
    }
    this._currentTournament = null;
  },

  showScoreChoiceModal(teamA, teamB, callback) {
    const existing = document.getElementById('score-choice-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'score-choice-modal';
    overlay.className = 'score-choice-overlay';
    overlay.innerHTML = `
      <div class="score-choice-panel">
        <h3>Внести результ��т матча</h3>
        <p class="score-choice-teams">${this._esc(teamA)} — ${this._esc(teamB)}</p>
        <div class="score-choice-buttons">
          <button type="button" class="btn btn-success score-choice-btn" data-method="scoreboard">⚽ Вести счёт</button>
          <button type="button" class="btn btn-ghost score-choice-btn" data-method="manual">Вписать вручную</button>
        </div>
        <button type="button" class="btn btn-ghost score-choice-close" data-close>Отмена</button>
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target.dataset.close) {
        overlay.remove();
      } else if (e.target.dataset.method) {
        overlay.remove();
        callback(e.target.dataset.method);
      }
    });

    document.body.appendChild(overlay);
  },

  _showSystemPickerModal() {
    const existing = document.getElementById('mixed-system-picker');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'mixed-system-picker';
    overlay.className = 'system-picker-overlay';
    overlay.innerHTML = `
      <div class="system-picker-panel">
        <h3>Выберите систему смешанного турнира</h3>
        <p class="system-picker-hint">Каждая система комбинирует групповой этап и плей-офф</p>
        <div class="system-picker-grid">
          ${MIXED_SYSTEMS.map(sys => `
            <div class="system-picker-card" data-system="${sys.id}">
              <h4>${sys.label}</h4>
              <p class="muted-desc">${sys.desc}</p>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-ghost system-picker-close">Отмена</button>
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target.dataset.system) {
        const systemId = e.target.dataset.system;
        document.body.removeChild(overlay);
        this._createMixedTournament(systemId);
      } else if (e.target.classList.contains('system-picker-close')) {
        document.body.removeChild(overlay);
      } else if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    document.body.appendChild(overlay);
  },

  _createMixedTournament(systemId) {
    const t = TournamentStorage.create('mixed', systemId);
    location.hash = `#/t/${t.id}`;
  },

  init() {
    this.root = document.getElementById('app');
    if (!this.root) {
      console.error('Элемент #app не найден');
      return;
    }
    window.addEventListener('hashchange', () => this.route());
    // Обработчик изменения storage (кросс-tab)
    window.addEventListener('storage', (e) => {
      if (e.key === ScoreStorage.KEY) {
        this._checkScoreboardUpdates();
      }
    });
    // Периодическая проверка обновлений scoreboard
    setInterval(() => this._checkScoreboardUpdates(), 2000);
    this.route();
  },

  route() {
    const hash = location.hash.slice(1) || '/';
    const parts = hash.split('/').filter(Boolean);

    if (parts[0] === 't' && parts[1]) {
      this.openTournament(parts[1]);
      return;
    }
    if (parts[0] === 'new' && (parts[1] === 'rr' || parts[1] === 'oly')) {
      const t = TournamentStorage.create(parts[1] === 'rr' ? 'round-robin' : 'olympic');
      location.hash = `#/t/${t.id}`;
      return;
    }
    if (parts[0] === 'new' && parts[1] === 'mixed') {
      this._showSystemPickerModal();
      return;
    }
    if (parts[0] === 'score') {
      if (parts[1] === 'new' && parts[2] && SCORE_SPORTS[parts[2]]) {
        const s = ScoreStorage.create(parts[2]);
        location.hash = `#/score/s/${s.id}`;
        return;
      }
      if (parts[1] === 's' && parts[2]) {
        this.openScoreboard(parts[2]);
        return;
      }
      this.renderScorePicker();
      return;
    }
    this.renderDashboard();
  },

  renderScorePicker() {
    this.currentId = null;
    ScoreboardApp.renderSportPicker(this.root);
  },

  openScoreboard(id) {
    const s = ScoreStorage.get(id);
    if (!s) {
      console.warn('Scoreboard not found:', id);
      location.hash = '#/score';
      return;
    }
    this.currentId = id;
    ScoreboardApp.renderSession(this.root, s);
  },

  renderDashboard() {
    this.currentId = null;
    this.stopScorePolling();
    const list = TournamentStorage.list();
    const scores = ScoreStorage.list();

    this.root.innerHTML = `
      <div class="app-shell">
        <header class="app-header">
          <div class="app-header__top">
            ${AppBrand.html('Несколько турниров одновременно · автоподсчёт · выгрузка Excel')}
          </div>
          <div class="app-header__actions">${Theme.controlHtml()}</div>
        </header>

        <section class="glass">
          <h2 class="glass__title">Создать турнир</h2>
          <div class="system-pick system-pick--4">
            <div class="system-card" data-action="new-rr" role="button" tabindex="0">
              ${SystemIcons.wrap('rr')}
              <h3>Турнирная таблица</h3>
              <p class="muted-desc">Круговая система · 3–8 команд</p>
            </div>
            <div class="system-card" data-action="new-oly" role="button" tabindex="0">
              ${SystemIcons.wrap('oly')}
              <h3>Олимпийская система</h3>
              <p class="muted-desc">Плей-офф · 4–18 команд</p>
            </div>
            <div class="system-card system-card--mixed" data-action="new-mixed" role="button" tabindex="0">
              ${SystemIcons.wrap('mixed')}
              <h3>Смешанный турнир</h3>
              <p class="muted-desc">Турнирная таблица + плей-офф</p>
            </div>
            <div class="system-card system-card--score" data-action="score-pick" role="button" tabindex="0">
              ${SystemIcons.wrap('score')}
              <h3>Вести счёт</h3>
              <p class="muted-desc">Баскетбол · волейбол · футбол</p>
            </div>
          </div>
        </section>

        <h2 class="section-title">Табло счёта (${scores.length})</h2>
        ${
          scores.length
            ? `<div class="tournament-cards">${scores.map((s) => this._scoreCardHtml(s)).join('')}</div>`
            : `<div class="empty-state glass empty-state--compact">Нет активных табло. Нажмите «Вести счёт» выше.</div>`
        }

        <h2 class="section-title">Активные турниры (${list.length})</h2>
        ${
          list.length
            ? `<div class="tournament-cards">${list.map((t) => this._cardHtml(t)).join('')}</div>`
            : `<div class="empty-state glass">Пока нет турниров. Создайте первый выше.</div>`
        }
      </div>
    `;

    const bindCard = (sel, hash) => {
      const el = this.root.querySelector(sel);
      if (!el) {
        console.warn('bindCard: element not found', sel);
        return;
      }
      console.log('bindCard:', sel, '→', hash);
      const go = () => {
        console.log('click:', sel, 'hash:', hash);
        location.hash = hash;
      };
      el.onclick = go;
      el.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      };
    };
    bindCard('[data-action="new-rr"]', '#/new/rr');
    bindCard('[data-action="new-oly"]', '#/new/oly');
    bindCard('[data-action="new-mixed"]', '#/new/mixed');
    bindCard('[data-action="score-pick"]', '#/score');

    scores.forEach((s) => {
      this.root.querySelector(`[data-open-score="${s.id}"]`)?.addEventListener('click', () => {
        location.hash = `#/score/s/${s.id}`;
      });
      this.root.querySelector(`[data-del-score="${s.id}"]`)?.addEventListener('click', () => {
        if (confirm('Удалить табло без восстановления?')) {
          ScoreTimer.clear(s.id);
          ScoreStorage.remove(s.id);
          this.route();
        }
      });
    });

    list.forEach((t) => {
      this.root.querySelector(`[data-open="${t.id}"]`)?.addEventListener('click', () => {
        location.hash = `#/t/${t.id}`;
      });
      this.root.querySelector(`[data-del="${t.id}"]`)?.addEventListener('click', () => {
        if (confirm('Удалить турнир без восстановления?')) {
          TournamentStorage.remove(t.id);
          this.route();
        }
      });
    });
  },

  _scoreCardHtml(s) {
    const sp = SCORE_SPORTS[s.sport];
    return `
      <article class="tournament-card">
        <span class="badge badge-score">${sp?.label || s.sport}</span>
        <h3>${this._esc(s.teamA)} — ${this._esc(s.teamB)}</h3>
        <p class="meta-line">${formatDateRu(s.updatedAt.slice(0, 10)) || '—'}</p>
        <div class="card-actions">
          <button class="btn btn-sm" data-open-score="${s.id}">Открыть</button>
          <button class="btn btn-sm btn-danger" data-del-score="${s.id}">Удалить</button>
        </div>
      </article>`;
  },

  _cardHtml(t) {
    const isRr = t.type === 'round-robin';
    const title = t.meta.eventName || (isRr ? 'Турнирная таблица' : 'Плей-офф');
    const badge = isRr ? 'Круговая' : 'Олимпийская';
    const badgeClass = isRr ? 'badge-rr' : 'badge-oly';
    return `
      <article class="tournament-card">
        <span class="badge ${badgeClass}">${badge}</span>
        <h3>${this._esc(title)}</h3>
        <p class="meta-line">${formatSport(t.meta.sport)} · ${t.meta.numTeams} команд</p>
        <p class="meta-line">${this._esc(t.meta.venue || '—')}</p>
        <p class="meta-line">${formatDateRu(t.meta.eventDate) || '—'}</p>
        <div class="card-actions">
          <button class="btn btn-sm" data-open="${t.id}">Открыть</button>
          <button class="btn btn-sm btn-danger" data-del="${t.id}">Удалить</button>
        </div>
      </article>
    `;
  },

  openTournament(id) {
    const t = TournamentStorage.get(id);
    if (!t) {
      location.hash = '#/';
      return;
    }
    this.currentId = id;
    if (t.type === 'round-robin') this.renderRoundRobin(t);
    else if (t.type === 'olympic') this.renderOlympic(t);
    else if (t.type === 'mixed') this.renderMixed(t);
  },

  persist(t) {
    TournamentStorage.save(t);
  },

  _metaForm(t, teamOptions) {
    const isGenerated = t.state.generated === true;
    const counts = t.type === 'round-robin' ? RR_TEAM_COUNTS : OLY_TEAM_COUNTS;
    const opts = counts
      .map((n) => `<option value="${n}" ${t.meta.numTeams === n ? 'selected' : ''}>${n} команд</option>`)
      .join('');

    const disabled = isGenerated ? ' disabled' : '';

    return `
      <div class="grid-2">
        <div class="form-group">
          <label>Название мероприятия</label>
          <input type="text" id="f-eventName" value="${this._esc(t.meta.eventName)}" placeholder="Чемпионат района"${disabled}>
        </div>
        <div class="form-group">
          <label>Вид спорта</label>
          <select id="f-sport"${disabled}>${SPORTS.map((s) => `<option value="${s}" ${t.meta.sport === s ? 'selected' : ''}>${formatSport(s)}</option>`).join('')}</select>
        </div>
        <div class="form-group">
          <label>Место проведения</label>
          <select id="f-venue"${disabled}>${VENUES.map((v) => `<option value="${this._esc(v)}" ${t.meta.venue === v ? 'selected' : ''}>${this._esc(v)}</option>`).join('')}</select>
        </div>
        <div class="form-group">
          <label>Дата проведения</label>
          <input type="date" id="f-date" value="${t.meta.eventDate || ''}"${disabled}>
        </div>
        <div class="form-group">
          <label>Шаблон (количество команд)</label>
          <select id="f-numTeams"${disabled}>${opts}</select>
        </div>
      </div>
      <div id="team-names-block" class="${t.state.generated ? 'hidden' : ''}">
        <h3 class="section-title">Названия команд</h3>
        <div class="team-inputs" id="team-inputs"></div>
        ${
          t.type === 'olympic'
            ? `<div class="generate-actions">
                <button type="button" class="btn btn-success" id="btn-generate">Сгенерировать игры</button>
                <button type="button" class="btn btn-ghost" id="btn-generate-sequential">Распределить команды</button>
              </div>
              <p class="generate-hint">«Сгенерировать игры» — случайные пары; «Распределить команды» — по порядку в списке (1 с 2, 3 с 4 и т.д.).</p>`
            : t.type === 'round-robin'
              ? `<div class="generate-actions">
                  <button type="button" class="btn btn-success" id="btn-generate">Сгенерировать игры</button>
                  <button type="button" class="btn btn-ghost" id="btn-generate-sequential">Распределить команды</button>
                </div>
                <p class="generate-hint">«Сгенерировать игры» — случайный порядок матчей. «Распределить команды» — фиксированное расписание по турам (для 4–8 команд).</p>`
              : `<button type="button" class="btn btn-success" id="btn-generate">Сгенерировать игры</button>`
        }
      </div>
    `;
  },

  _bindMeta(t, onMetaChange) {
    ['f-eventName', 'f-sport', 'f-venue', 'f-date', 'f-numTeams'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        t.meta.eventName = document.getElementById('f-eventName').value.trim();
        t.meta.sport = document.getElementById('f-sport').value;
        t.meta.venue = document.getElementById('f-venue').value;
        t.meta.eventDate = document.getElementById('f-date').value;
        const n = parseInt(document.getElementById('f-numTeams').value, 10);
        if (n !== t.meta.numTeams) {
          t.meta.numTeams = n;
          t.state.generated = false;
          t.state.teams = [];
          if (t.type === 'round-robin') {
            t.state.matches = [];
            t.state.scheduleMode = null;
          } else {
            t.state.bracket = {
              totalTeams: n,
              flow: 'standard',
              rounds: [],
              waiting: {},
              finalMatch: null,
              thirdPlaceMatch: null,
              thirdPlaceTeam: null
            };
            t.state.matchHistory = [];
          }
        }
        this.persist(t);
        onMetaChange();
      });
      el.addEventListener('input', () => {
        if (id === 'f-eventName') {
          t.meta.eventName = document.getElementById('f-eventName').value.trim();
          this.persist(t);
        }
      });
    });
  },

  _renderTeamInputs(t) {
    const wrap = document.getElementById('team-inputs');
    if (!wrap) return;
    const n = t.meta.numTeams;
    const names = t.state.teams.length === n ? t.state.teams : Array(n).fill('');
    wrap.innerHTML = names
      .map(
        (name, i) => `
      <div class="form-group form-group--compact">
        <label>Команда ${i + 1}</label>
        <input type="text" class="team-inp" data-idx="${i}" value="${this._esc(name)}" placeholder="Название команды ${i + 1}">
      </div>`
      )
      .join('');

    wrap.querySelectorAll('.team-inp').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = parseInt(inp.dataset.idx, 10);
        const arr = this._collectTeamNames(t.meta.numTeams);
        arr[idx] = inp.value;
        t.state.teams = arr;
        this.persist(t);
      });
    });
  },

  _collectTeamNames(n) {
    const inputs = document.querySelectorAll('.team-inp');
    const arr = Array(n).fill('');
    inputs.forEach((inp) => {
      arr[parseInt(inp.dataset.idx, 10)] = inp.value.trim();
    });
    return arr;
  },

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
        'Расписание по турам доступно для 4–8 команд. Для ' +
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

  renderRoundRobin(t) {
    this.stopScorePolling();
    const standings =
      t.state.generated && t.state.teams.length
        ? RoundRobinEngine.calculateStandings(t.state.teams, t.state.matches)
        : [];

    const exportBtn = t.state.generated
      ? '<button type="button" class="btn btn-warning" data-export-xlsx>Выгрузить .xlsx</button>'
      : '';
    const publishBtn = t.state.generated
      ? '<button type="button" class="btn btn-success" data-publish-online>Транслировать онлайн</button>'
      : '';
    this.root.innerHTML = `
      <div class="app-shell">
        ${this._pageHeader('Турнирная таблица', exportBtn + publishBtn)}
        <section class="glass">${this._metaForm(t)}</section>
        <div id="rr-workspace"></div>
      </div>
    `;

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
        <div id="standings-container">${this._rrStandingsBlock(t.state.teams, t.state.matches, standings)}</div>
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
      const st = RoundRobinEngine.calculateStandings(fresh.state.teams, fresh.state.matches);
      RoundRobinEngine.exportXlsx(fresh.meta, fresh.state.teams, fresh.state.matches, st);
    });
    this._bindPublishButtons(t, () => {
      const fresh = TournamentStorage.get(t.id);
      if (!fresh) return;
      const st = RoundRobinEngine.calculateStandings(fresh.state.teams, fresh.state.matches);
      this._publishOnline(t, this._renderRoundRobinPublishPreview(fresh, st));
    });
  },

  _renderMatchRow(t, m, i) {
    const a = t.state.teams[m.teamA];
    const b = t.state.teams[m.teamB];
    const sa = m.scoreA ?? '';
    const sb = m.scoreB ?? '';
    const hasTour = m.tour != null;
    const rowClass = hasTour ? 'match-row match-row--with-tour' : 'match-row match-row--flat';
    const label = hasTour ? `<span class="match-tour-label">Матч ${m.matchInTour}</span>` : '';
    const isFootball = t.meta?.sport === 'футбол';
    const hasLinked = !!m.linkedScoreId;
    const sbExists = hasLinked ? !!ScoreStorage.getByLinkedId(m.linkedScoreId) : false;
    const isMatchFinished = m._synced || (m.isPlayed && m.scoreA !== '' && m.scoreB !== '');
    
    let scoreboardBtn = '';
    let recordBtn = '';
    
    if (isFootball) {
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
            ${sbExists ? '⚽ Счёт' : '⚽ Вести счёт'}
          </button>`;
        recordBtn = `
          <button type="button" class="btn btn-sm btn-record-match" data-record-btn="${i}">
            ✎ Записать счёт
          </button>`;
      } else {
        scoreboardBtn = `
          <button type="button" class="btn btn-sm btn-scoreboard-match" data-match-btn="${i}">
            ⚽ Вести счёт
          </button>`;
        recordBtn = `
          <button type="button" class="btn btn-sm btn-record-match" data-record-btn="${i}">
            ✎ Записать счёт
          </button>`;
      }
    }
    
    const scoreInputsDisabled = isMatchFinished ? ' disabled' : '';
    
    return `
      <div class="${rowClass} ${isMatchFinished ? 'match-row--played' : ''}" id="mrow-${i}">
        ${label}
        <div class="match-row__teams">
          <span class="team-name team-name--away">${this._esc(a)}</span>
          <div class="scores">
            <input type="number" min="0" inputmode="numeric" class="sc-a score-input" data-i="${i}" value="${sa}" placeholder="0" aria-label="Счёт ${this._esc(a)}"${scoreInputsDisabled}>
            <span aria-hidden="true">:</span>
            <input type="number" min="0" inputmode="numeric" class="sc-b score-input" data-i="${i}" value="${sb}" placeholder="0" aria-label="Счёт ${this._esc(b)}"${scoreInputsDisabled}>
          </div>
          <span class="team-name">${this._esc(b)}</span>
        </div>
        <div class="match-row__footer">
          <div class="match-row__actions">
            <span class="match-status" id="mst-${i}"></span>
            ${scoreboardBtn}
            ${recordBtn}
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
          st.textContent = 'Матч завершён';
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
              freshM.isPlayed = true;
              if (scores.scoreA > scores.scoreB) {
                freshM.winner = existingSb.teamA;
              } else if (scores.scoreB > scores.scoreA) {
                freshM.winner = existingSb.teamB;
              } else {
                freshM.winner = null;
              }
              freshM._synced = true;
              if (hasChanged) {
                TournamentStorage.save(freshT);
                this.renderRoundRobin(freshT);
              }
              // Открываем scoreboard
              setTimeout(() => {
                location.hash = `#/score/s/${existingSb.id}`;
              }, 150);
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
        
        // Синхронизируем с таблицей
        freshM._synced = true;
        
        TournamentStorage.save(freshT);
        this.renderRoundRobin(freshT);
      });
    });

    update();

    this.startScorePolling(t);
  },

  _rrTableHtml(teams, matches, standings) {
    const n = teams.length;
    let h = `<table class="standings-table"><thead><tr><th class="col-sticky-num">№</th><th class="col-sticky-team">Команда</th>`;
    for (let i = 1; i <= n; i++) h += `<th>И${i}</th>`;
    h += `<th>В</th><th>Н</th><th>П</th><th>ЗМ</th><th>ПМ</th><th>Р</th><th>О</th><th>Место</th></tr></thead><tbody>`;

    standings.forEach((team) => {
      const plc = team.place <= 3 ? `place-${team.place}` : '';
      h += `<tr><td class="col-sticky-num">${team.index + 1}</td><td class="col-sticky-team">${this._esc(team.name)}</td>`;
      for (let j = 0; j < n; j++) {
        if (j === team.index) {
          h += `<td class="cell-diagonal">—</td>`;
        } else {
          const cell = RoundRobinEngine.getMatchCell(matches, team.index, j);
          if (!cell) h += `<td>—</td>`;
          else {
            let cls = 'cell-draw';
            if (cell.scored > cell.conceded) cls = 'cell-win';
            if (cell.scored < cell.conceded) cls = 'cell-loss';
            h += `<td class="${cls}"><strong>${cell.scored}:${cell.conceded}</strong></td>`;
          }
        }
      }
      const gd = team.goalsFor - team.goalsAgainst;
      h += `<td>${team.wins}</td><td>${team.draws}</td><td>${team.losses}</td>`;
      h += `<td>${team.goalsFor}</td><td>${team.goalsAgainst}</td>`;
      h += `<td>${gd > 0 ? '+' : ''}${gd}</td><td><strong>${team.points}</strong></td>`;
      h += `<td class="${plc}">${team.place || '—'}</td></tr>`;
    });
    return h + '</tbody></table>';
  },

  renderOlympic(t) {
    this.stopScorePolling();
    const exportBtn = t.state.generated
      ? '<button type="button" class="btn btn-warning" data-export-xlsx>Выгрузить .xlsx</button>'
      : '';
    const publishBtn = t.state.generated
      ? '<button type="button" class="btn btn-success" data-publish-online>Транслировать онлайн</button>'
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
    this.startScorePolling(t);
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

        // Всегда берем свежую копию турнира из хранилища
        const freshT = TournamentStorage.get(t.id);
        const freshMatch = this._getPlayoffMatch(freshT.state.bracket, kind, rIdx, mIdx);
        if (!freshMatch) {
          alert('Матч не найден. Обновите страницу.');
          return;
        }

        // Сначала проверяем linkedScoreId прямо из матча
        if (freshMatch.linkedScoreId) {
          const existingSb = ScoreStorage.getByLinkedId(freshMatch.linkedScoreId);
          if (existingSb) {
            // Табло существует, проверяем, завершен ли матч
              if (existingSb.state?.phase === 'finished') {
                // Матч завершен, синхронизируем
                const scores = this._getFinalScore(existingSb);
                const hasChanged = !freshMatch._synced || freshMatch.scoreA !== scores.scoreA || freshMatch.scoreB !== scores.scoreB;
                freshMatch.scoreA = scores.scoreA;
                freshMatch.scoreB = scores.scoreB;
                if (scores.penaltyA != null) freshMatch.penaltyA = scores.penaltyA;
                if (scores.penaltyB != null) freshMatch.penaltyB = scores.penaltyB;
                if (scores.wasDecidedByPenalties) freshMatch.wasDecidedByPenalties = scores.wasDecidedByPenalties;
                if (scores.scoreA > scores.scoreB) {
                  freshMatch.winner = existingSb.teamA;
                  freshMatch.loser = existingSb.teamB;
                } else if (scores.scoreB > scores.scoreA) {
                  freshMatch.winner = existingSb.teamB;
                  freshMatch.loser = existingSb.teamA;
                } else {
                  // Ничья по голам — используем победителя из scoreboard (пенальти)
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
                if (hasChanged) {
                  TournamentStorage.save(freshT);
                  this.renderOlympic(freshT);
                }
              // Открываем scoreboard
              setTimeout(() => {
                location.hash = `#/score/s/${existingSb.id}`;
              }, 150);
              return;
            }
            // Просто открываем существующее табло
            window.location.hash = `#/score/s/${existingSb.id}`;
            return;
          }
          // Табло было удалено, очищаем linkedScoreId
          freshMatch.linkedScoreId = null;
          TournamentStorage.save(freshT);
          this.renderOlympic(freshT);
          return;
        }

        // Табло нет, создаём новое
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
    const isFootball = t.meta?.sport === 'футбол';
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
    
    // Если была серия пенальти — выводим результат пенальти в скобках ниже под обеими командами
    if (match.penaltyA != null && match.penaltyB != null) {
      inner += `<div class="match-penalty-result">(пен. ${match.penaltyA}:${match.penaltyB})</div>`;
    }
    
    // Если игралось дополнительное время — показываем его счёт отдельно
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

      if (isFootball) {
        const sbBtn = document.createElement('button');
        sbBtn.type = 'button';
        sbBtn.className = 'btn btn-sm btn-scoreboard-match';
        
        // Проверяем, завершен ли матч через scoreboard
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
          sbBtn.textContent = hasLinked ? '⚽ Счёт' : '⚽ Вести счёт';
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

      // Обработка финала: фиксируем 3-е место из проигравшего финала
      if (kind === 'final' && match.isFinished && match.loser && !bracket.thirdPlaceTeam) {
        bracket.thirdPlaceTeam = match.loser;
      }

      // Обработка матча за 3-е место: фиксируем 3-е место
      if (kind === 'third' && match.isFinished && match.winner && !bracket.thirdPlaceTeam) {
        bracket.thirdPlaceTeam = match.loser;
      }

      this.persist(t);
      this.currentId = tournamentId;
      this.renderOlympic(t);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении результата: ' + (err.message || err));
    }
  },

  _bindExportButtons(t, handler) {
    this.root.querySelectorAll('[data-export-xlsx]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          handler();
        } catch (err) {
          console.error('export', err);
          alert('Ошибка выгрузки: ' + (err.message || err));
        }
      });
    });
  },

  _bindPublishButtons(t, handler) {
    this.root.querySelectorAll('[data-publish-online]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          handler();
        } catch (err) {
          console.error('publish', err);
          alert('Ошибка трансляции: ' + (err.message || err));
        }
      });
    });
  },

  _publishOnline(t, html) {
    if (!html) {
      alert('Нет данных для трансляции. Перезапустите страницу и попробуйте снова.');
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
          alert('Таблица отправлена для онлайн-трансляции. Откройте /viewer чтобы посмотреть.');
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

  _renderRoundRobinPublishPreview(t, standings) {
    const workspace = document.getElementById('rr-workspace');
    if (workspace) return workspace.outerHTML;
    return `<div><h2>Турнирная таблица</h2>${this._rrTableHtml(t.state.teams, t.state.matches, standings)}</div>`;
  },

  _renderOlympicPublishPreview(t) {
    const workspace = document.getElementById('oly-workspace');
    if (workspace) return workspace.outerHTML;
    return `<div><h2>Олимпийская система</h2><p>Сетка и результаты доступны в приложении.</p></div>`;
  },

  _pageHeader(title, exportButtonHtml = '') {
    const actions = [Theme.controlHtml(), exportButtonHtml].filter(Boolean).join('');
    return `
      <header class="app-header">
        <div class="app-header__top">
          <a href="#/" class="btn btn-ghost btn-sm">← Все турниры</a>
          <h1 class="page-title-offset">${this._esc(title)}</h1>
        </div>
        <div class="app-header__actions">${actions}</div>
      </header>`;
  },

  _initResponsiveStandings() {
    const block = document.getElementById('standings-scroll');
    const wrap = block?.querySelector('.standings-wrap');
    if (!block || !wrap) return;
    const check = () => {
      block.classList.toggle('is-scrollable', wrap.scrollWidth > wrap.clientWidth + 2);
    };
    check();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(check);
      ro.observe(wrap);
    } else {
      window.addEventListener('resize', check, { passive: true });
    }
  },

  _rrStandingsBlock(teams, matches, standings) {
    return `
      <div class="standings-scroll is-cards-only" id="standings-scroll">
        <div class="standings-wrap">${this._rrTableHtml(teams, matches, standings)}</div>
        <span class="standings-scroll-hint" aria-hidden="true">Проведите пальцем влево‑вправо для просмотра таблицы</span>
        <div class="standings-cards" role="list">${this._rrStandingsCardsHtml(standings)}</div>
      </div>`;
  },

  _rrStandingsCardsHtml(standings) {
    return standings
      .map((team) => {
        const gd = team.goalsFor - team.goalsAgainst;
        const plc = team.place <= 3 ? ` place-${team.place}` : '';
        return `
        <article class="standings-card-item${plc}" role="listitem">
          <div class="standings-card-item__head">
            <span class="standings-card-item__name">${team.index + 1}. ${this._esc(team.name)}</span>
            <span class="standings-card-item__place">${team.place || '—'}</span>
          </div>
          <dl class="standings-card-item__stats">
            <dt>Очки</dt><dd>${team.points}</dd>
            <dt>В / Н / П</dt><dd>${team.wins} / ${team.draws} / ${team.losses}</dd>
            <dt>ЗМ : ПМ</dt><dd>${team.goalsFor} : ${team.goalsAgainst}</dd>
            <dt>Разница</dt><dd>${gd > 0 ? '+' : ''}${gd}</dd>
          </dl>
        </article>`;
      })
      .join('');
  },

  _updateStandingsDom(t) {
    const st = RoundRobinEngine.calculateStandings(t.state.teams, t.state.matches);
    const container = document.getElementById('standings-container');
    if (container) {
      container.innerHTML = this._rrStandingsBlock(t.state.teams, t.state.matches, st);
      this._initResponsiveStandings();
    }
    return st;
  },

  _checkScoreboardUpdates() {
    // Проверяем все матчи с linkedScoreId на завершение
    if (!this.currentId) return;
    const t = TournamentStorage.get(this.currentId);
    if (!t || !t.state.generated) return;
    
    let hasChanges = false;
    
    if (t.type === 'round-robin') {
      const matches = t.state.matches || [];
      for (const m of matches) {
        if (!m.linkedScoreId) continue;
        const sb = ScoreStorage.getByLinkedId(m.linkedScoreId);
        if (sb && sb.state?.phase === 'finished') {
          const scores = this._getFinalScore(sb);
          const hasChanged = !m._synced || m.scoreA !== scores.scoreA || m.scoreB !== scores.scoreB;
          m.scoreA = scores.scoreA;
          m.scoreB = scores.scoreB;
          if (scores.penaltyA != null) m.penaltyA = scores.penaltyA;
          if (scores.penaltyB != null) m.penaltyB = scores.penaltyB;
          if (scores.wasDecidedByPenalties) m.wasDecidedByPenalties = scores.wasDecidedByPenalties;
          m.isPlayed = true;
          if (scores.scoreA > scores.scoreB) {
            m.winner = sb.teamA;
          } else if (scores.scoreB > scores.scoreA) {
            m.winner = sb.teamB;
          } else {
            m.winner = null;
          }
          m._synced = true;
          if (hasChanged) hasChanges = true;
        }
      }
    } else if (t.type === 'olympic') {
      const bracket = t.state.bracket;
      const checkMatch = (match) => {
        if (!match?.linkedScoreId) return;
        const sb = ScoreStorage.getByLinkedId(match.linkedScoreId);
        if (sb && sb.state?.phase === 'finished') {
          const scores = this._getFinalScore(sb);
          const hasChanged = !match._synced || match.scoreA !== scores.scoreA || match.scoreB !== scores.scoreB;
          match.scoreA = scores.scoreA;
          match.scoreB = scores.scoreB;
          if (scores.penaltyA != null) match.penaltyA = scores.penaltyA;
          if (scores.penaltyB != null) match.penaltyB = scores.penaltyB;
          if (scores.wasDecidedByPenalties) match.wasDecidedByPenalties = scores.wasDecidedByPenalties;
          if (scores.scoreA > scores.scoreB) {
            match.winner = sb.teamA;
            match.loser = sb.teamB;
          } else if (scores.scoreB > scores.scoreA) {
            match.winner = sb.teamB;
            match.loser = sb.teamA;
          } else {
            match.winner = null;
            match.loser = null;
          }
          match.isFinished = true;
          match._synced = true;
          if (hasChanged) hasChanges = true;
        }
      };
      
      if (bracket?.rounds) {
        for (const round of bracket.rounds) {
          for (const match of round.matches) {
            checkMatch(match);
          }
        }
      }
      checkMatch(bracket.finalMatch);
      checkMatch(bracket.thirdPlaceMatch);
      
      // Обработка финала: фиксируем 3-е место из проигравшего финала
      if (bracket.finalMatch?.isFinished && bracket.finalMatch.loser && !bracket.thirdPlaceTeam) {
        bracket.thirdPlaceTeam = bracket.finalMatch.loser;
        hasChanges = true;
      }
      
      // Обработка матча за 3-е место: фиксируем 3-е место
      if (bracket.thirdPlaceMatch?.isFinished && bracket.thirdPlaceMatch.loser && !bracket.thirdPlaceTeam) {
        bracket.thirdPlaceTeam = bracket.thirdPlaceMatch.loser;
        hasChanges = true;
      }
      
      // Проверяем, все ли матчи раунда завершены, и продвигаем команды
      if (bracket?.rounds) {
        for (let ri = 0; ri < bracket.rounds.length; ri++) {
          const round = bracket.rounds[ri];
          if (round?.matches?.length && round.matches.every((m) => m.isFinished && m.winner)) {
            OlympicEngine.advanceOnRoundComplete(bracket, ri);
            hasChanges = true;
          }
        }
      }
    }
    
    if (hasChanges) {
      this.persist(t);
      if (t.type === 'round-robin') {
        this.renderRoundRobin(t);
      } else {
        this.renderOlympic(t);
      }
    }
  },

  _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
