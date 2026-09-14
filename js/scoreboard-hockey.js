const ScoreboardHockey = {
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

  _hockeyMainActionsBlock(phase, tot, timerRunning) {
    if (phase === 'period1' || phase === 'period2' || phase === 'period3') {
      return `<button type="button" class="btn btn-success" data-hk-end-period ${!timerRunning ? 'disabled' : ''}>Завершить период</button>`;
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
    const actionsBlock = this._hockeyMainActionsBlock(phase, tot, this._timerRunning(session));

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
      // Сначала останавливаем все интервалы
      for (const [penId, iv] of penaltyIntervals) {
        clearInterval(iv);
      }
      penaltyIntervals.clear();

      // Читаем АКТУАЛЬНЫЕ remainingSeconds из хранилища (туда писал interval)
      const curSession = ScoreStorage.get(session.id);
      const storagePens = curSession
        ? [...(curSession.state.teamAPenalties || []), ...(curSession.state.teamBPenalties || [])]
        : [];

      // Сохраняем remainingSeconds и обнуляем startedAt — таймер будет перезапущен при старте
      const statePens = [...(session.state.teamAPenalties || []), ...(session.state.teamBPenalties || [])];
      for (const sp of statePens) {
        if (sp.active && sp.remainingSeconds > 0) {
          const fresh = storagePens.find(p => p.id === sp.id);
          sp.remainingSeconds = fresh ? fresh.remainingSeconds : sp.remainingSeconds;
          sp.startedAt = null;
        }
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

      // Если startedAt не установлен (таймер был на паузе) — вычисляем относительно此刻
      if (!pen.startedAt) {
        pen.startedAt = Date.now() - (pen.totalSeconds - pen.remainingSeconds) * 1000;
        persist();
      }

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
      if (!confirm('Завершить период?')) return;
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
      if (!confirm('Завершить матч?')) return;
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
          startedAt: (st.hockeyTimer && st.hockeyTimer.running) ? Date.now() : null
        });

        // Очищаем поле ввода
        if (playerInput) playerInput.value = '';

        persist();

        // Запускаем таймер штрафа ТОЛЬКО если основной обратный отсчёт идёт
        if (st.hockeyTimer && st.hockeyTimer.running) {
          startPenaltyTick(penalties[penalties.length - 1], penId);
        }

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
    }, onHockeyPeriodEnd, () => {
      // Callback при нажатии "Пауза" — останавливаем все штрафные таймеры
      pauseAllPenaltyTicks();
    });
  },
};

window.ScoreboardHockey = ScoreboardHockey;

