const ScoreboardFootball = {
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
              ? `<button type="button" class="btn btn-success score-actions-row" data-fb-end-extra ${!this._timerRunning(session) ? 'disabled' : ''}>Завершить доп. время</button>`
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
          <button type="button" class="btn btn-ghost" data-fb-finish-draw>Завершить матч (ничья)</button>
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
              ? `<button type="button" class="btn btn-success" data-fb-end-half ${!this._timerRunning(session) ? 'disabled' : ''}>Завершить 1-й тайм</button>`
              : `<button type="button" class="btn btn-success" data-fb-end-match ${!this._timerRunning(session) ? 'disabled' : ''}>Завершить матч</button>`
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
      if (!confirm('Завершить 1-й тайм?')) return;
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
      if (!confirm('Завершить матч?')) return;
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
      if (!confirm('Завершить дополнительное время?')) return;
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
};

window.ScoreboardFootball = ScoreboardFootball;

