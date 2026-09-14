const ScoreboardStreetball = {
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
window.ScoreboardStreetball = ScoreboardStreetball;

