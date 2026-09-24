const ScoreboardOnePeriod = {
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
              ? `<button type="button" class="btn btn-success" data-op-end-period ${!this._timerRunning(session) ? 'disabled' : ''}>Завершить период</button>`
              : `<button type="button" class="btn btn-ghost" data-op-end-period ${!this._timerRunning(session) ? 'disabled' : ''}>Завершить еще период</button>
                 <button type="button" class="btn btn-warning" data-op-finish-match ${!this._timerRunning(session) ? 'disabled' : ''}>Завершить матч</button>`
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
      if (!confirm('Завершить период?')) return;
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
      if (!confirm('Завершить матч?')) return;
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
};

window.ScoreboardOnePeriod = ScoreboardOnePeriod;

