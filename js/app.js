const App = {
  root: null,
  currentId: null,
  _currentScoreboardId: null,
  _scorePollInterval: null,
  _currentTournament: null,

  init() {
    this.root = document.getElementById('app');
    if (!this.root) {
      console.error('Элемент #app не найден');
      return;
    }
    window.addEventListener('hashchange', () => this.route());
    window.addEventListener('storage', (e) => {
      if (e.key === ScoreStorage.KEY) {
        ScoreStorage.invalidate();
        this._checkScoreboardUpdates();
      }
      if (e.key === TournamentStorage.KEY) {
        TournamentStorage.invalidate();
      }
    });
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

  persist(t) {
    const fm = t.state?.playoff?.bracket?.finalMatch;
    if (fm) console.log('[PERSIST]', { finalA: fm.scoreA, finalB: fm.scoreB, synced: fm._synced, finished: fm.isFinished, hash: location.hash });
    TournamentStorage.save(t);
  },

  openTournament(id) {
    const t = TournamentStorage.get(id);
    if (!t) { location.hash = '#/'; return; }
    this.currentId = id;
    this._currentScoreboardId = null;
    if (t.type === 'round-robin') this.renderRoundRobin(t);
    else if (t.type === 'olympic') this.renderOlympic(t);
    else if (t.type === 'mixed') this.renderMixed(t);
  },

  renderDashboard() {
    this.currentId = null;
    this._currentScoreboardId = null;
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

    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action], [data-open-score], [data-del-score], [data-open], [data-del]');
      if (!btn) return;
      e.preventDefault();
      if (btn.dataset.action === 'new-rr') location.hash = '#/new/rr';
      else if (btn.dataset.action === 'new-oly') location.hash = '#/new/oly';
      else if (btn.dataset.action === 'new-mixed') location.hash = '#/new/mixed';
      else if (btn.dataset.action === 'score-pick') location.hash = '#/score';
      else if (btn.dataset.openScore) location.hash = `#/score/s/${btn.dataset.openScore}`;
      else if (btn.dataset.delScore) {
        if (confirm('Удалить табло?')) { ScoreStorage.remove(btn.dataset.delScore); this.renderDashboard(); }
      }
      else if (btn.dataset.open) location.hash = `#/t/${btn.dataset.open}`;
      else if (btn.dataset.del) {
        if (confirm('Удалить турнир?')) { TournamentStorage.remove(btn.dataset.del); this.renderDashboard(); }
      }
    });
  },

  _scoreCardHtml(s) {
    const sport = SCORE_SPORTS[s.sport]?.label || s.sport;
    let scoreText = '';
    if (s.state && typeof ScoreboardCore !== 'undefined') {
      const ms = ScoreboardCore._getMatchScores(s);
      scoreText = `${ms.scoreA ?? 0} : ${ms.scoreB ?? 0}`;
    } else if (s.state) {
      scoreText = `${s.state.scoreA ?? 0} : ${s.state.scoreB ?? 0}`;
    }
    return `
      <article class="tournament-card glass">
        <div class="tournament-card__head">
          <span class="badge badge--score">${sport}</span>
          <span class="tournament-card__date">${new Date(s.updatedAt).toLocaleDateString('ru')}</span>
        </div>
        <h3 class="tournament-card__title">${this._esc(s.teamA)} — ${this._esc(s.teamB)}</h3>
        ${scoreText ? `<div class="tournament-card__score">${scoreText}</div>` : ''}
        <div class="card-actions">
          <button class="btn btn-sm" data-open-score="${s.id}">Открыть</button>
          <button class="btn btn-sm btn-danger" data-del-score="${s.id}">Удалить</button>
        </div>
      </article>
    `;
  },

  _cardHtml(t) {
    const system = t.type === 'round-robin' ? 'Турнирная таблица' : t.type === 'olympic' ? 'Олимпийская' : 'Смешанный';
    return `
      <article class="tournament-card glass">
        <div class="tournament-card__head">
          <span class="badge badge--${t.type}">${system}</span>
          <span class="tournament-card__date">${new Date(t.updatedAt).toLocaleDateString('ru')}</span>
        </div>
        <h3 class="tournament-card__title">${this._esc(t.meta.eventName || 'Без названия')}</h3>
        <p class="muted-desc">${formatSport(t.meta.sport)} · ${t.meta.venue || '—'}</p>
        <div class="card-actions">
          <button class="btn btn-sm" data-open="${t.id}">Открыть</button>
          <button class="btn btn-sm btn-danger" data-del="${t.id}">Удалить</button>
        </div>
      </article>
    `;
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

  _bindExportButtons(t, handler) {
    this.root.querySelectorAll('[data-export-xlsx]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          const result = handler();
          if (result && typeof result.catch === 'function') {
            result.catch((err) => { console.error('export', err); alert('Ошибка выгрузки: ' + (err.message || err)); });
          }
        } catch (err) { console.error('export', err); alert('Ошибка выгрузки: ' + (err.message || err)); }
      });
    });
  },

  _bindPublishButtons(t, handler) {
    this.root.querySelectorAll('[data-publish-online]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { handler(); } catch (err) { console.error('publish', err); alert('Ошибка трансляции: ' + (err.message || err)); }
      });
    });
  },

  _publishOnline(t, html) {
    if (!html) { alert('Нет данных для трансляции.'); return; }
    fetch('/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html })
    })
      .then((res) => res.json())
      .then((json) => {
        if (json && json.ok) alert('Таблица отправлена для онлайн-трансляции. Откройте /viewer чтобы посмотреть.');
        else { console.error('publish failed', json); alert('Ошибка трансляции: ' + (json?.error || 'сервер не ответил')); }
      })
      .catch((err) => { console.error('publish error', err); alert('Ошибка связи с сервером трансляции.'); });
  },

  _autoPublishTimer: null,
  _autoPublishHandler: null,

  _getAutoPublishSettings() {
    try {
      const raw = localStorage.getItem('autoPublish');
      if (!raw) return { enabled: false, interval: 5 };
      const s = JSON.parse(raw);
      return { enabled: !!s.enabled, interval: Math.min(60, Math.max(2, parseInt(s.interval, 10) || 5)) };
    } catch { return { enabled: false, interval: 5 }; }
  },

  _saveAutoPublishSettings(enabled, interval) {
    localStorage.setItem('autoPublish', JSON.stringify({ enabled, interval }));
  },

  startAutoPublish(htmlProvider) {
    this.stopAutoPublish();
    const settings = this._getAutoPublishSettings();
    this._autoPublishHandler = htmlProvider;
    this._autoPublishTimer = setInterval(() => {
      try {
        const html = htmlProvider();
        if (!html) return;
        fetch('/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html })
        }).catch(() => {});
      } catch { /* one error per tick */ }
    }, settings.interval * 1000);
    this._saveAutoPublishSettings(true, settings.interval);
    this._updateAutoPublishUI();
  },

  stopAutoPublish() {
    if (this._autoPublishTimer) {
      clearInterval(this._autoPublishTimer);
      this._autoPublishTimer = null;
    }
    this._autoPublishHandler = null;
    this._saveAutoPublishSettings(false, this._getAutoPublishSettings().interval);
    this._updateAutoPublishUI();
  },

  isAutoPublishActive() {
    return this._autoPublishTimer != null;
  },

  _updateAutoPublishUI() {
    const active = this.isAutoPublishActive();
    this.root.querySelectorAll('[data-auto-publish-toggle]').forEach((toggle) => {
      toggle.classList.toggle('active', active);
      toggle.textContent = active ? 'Авто-трансляция: ВКЛ' : 'Авто-трансляция: ВЫКЛ';
    });
    this.root.querySelectorAll('[data-auto-publish-interval]').forEach((inp) => {
      inp.disabled = active;
    });
  },

  bindAutoPublish(t, htmlProvider) {
    const settings = this._getAutoPublishSettings();
    const toggle = this.root.querySelector('[data-auto-publish-toggle]');
    const intervalInput = this.root.querySelector('[data-auto-publish-interval]');
    if (toggle) {
      toggle.textContent = settings.enabled ? 'Авто-трансляция: ВКЛ' : 'Авто-трансляция: ВЫКЛ';
      toggle.addEventListener('click', () => {
        if (this.isAutoPublishActive()) {
          this.stopAutoPublish();
        } else {
          this.startAutoPublish(htmlProvider);
        }
      });
    }
    if (intervalInput) {
      intervalInput.value = settings.interval;
      intervalInput.addEventListener('change', () => {
        let v = parseInt(intervalInput.value, 10);
        if (isNaN(v) || v < 2) v = 2;
        if (v > 60) v = 60;
        intervalInput.value = v;
        this._saveAutoPublishSettings(this.isAutoPublishActive(), v);
        if (this.isAutoPublishActive()) {
          this.startAutoPublish(htmlProvider);
        }
      });
    }
  },

  _esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }
};

window.App = App;

window.addEventListener('beforeunload', () => {
  if (App.isAutoPublishActive()) App.stopAutoPublish();
});

