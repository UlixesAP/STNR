const ScoreboardBasketball = {
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
          <button type="button" class="btn btn-success" data-bb-record ${!this._timerRunning(session) ? 'disabled' : ''}>Записать результат ${st.currentPeriod <= 4 ? periodLabel : 'матча'}</button>
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
      if (!confirm('Записать результат ' + (st.currentPeriod <= 4 ? 'четверти' : 'матча') + '?')) return;
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
};

window.ScoreboardBasketball = ScoreboardBasketball;

