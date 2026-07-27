const ScoreboardApp = {
  esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
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

  renderSession(root, session) {
    ScoreTimer.clear(session.id);
    const sp = SCORE_SPORTS[session.sport];
    if (!sp) {
      location.hash = '#/score';
      return;
    }

    let body = '';
    if (session.sport === 'basketball') body = this._htmlBasketball(session);
    else if (session.sport === 'volleyball') body = this._htmlVolleyball(session);
    else body = this._htmlFootball(session);

    root.innerHTML = `
      <div class="app-shell scoreboard-page">
        <header class="app-header">
          <div class="app-header__top">
            <a href="#/score" class="btn btn-ghost btn-sm">← Выбор спорта</a>
            <h1 class="page-title-offset">${sp.label}</h1>
          </div>
          <div class="app-header__actions">
            ${Theme.controlHtml()}
            <button type="button" class="btn btn-warning btn-sm" data-export-score>Excel</button>
            <button type="button" class="btn btn-success btn-sm" data-publish-score>Транслировать онлайн</button>
          </div>
        </header>
        ${body}
      </div>`;

    if (session.sport === 'basketball') this._bindBasketball(root, session);
    else if (session.sport === 'volleyball') this._bindVolleyball(root, session);
    else this._bindFootball(root, session);

    const persist = () => ScoreStorage.save(session);
    ScoreTimer.bind(root, session, persist);

    root.querySelector('[data-export-score]')?.addEventListener('click', () => {
      ScoreExport.exportSession(session);
    });
    root.querySelector('[data-publish-score]')?.addEventListener('click', () => {
      this._publishScoreboard(session);
    });
  },

  _periodLabelBasketball(n) {
    if (n <= 3) return `${n}-й период`;
    return 'Матч завершён';
  },

  _htmlBasketball(session) {
    const st = session.state;
    const periodLabel = this._periodLabelBasketball(st.currentPeriod);
    const finished = st.matchFinished;

    const periodRows = st.periods
      .map((p) => {
        const ptsA = p.pointsA != null ? p.pointsA : p.scoreA;
        const ptsB = p.pointsB != null ? p.pointsB : p.scoreB;
        const totA = p.totalA != null ? p.totalA : ptsA;
        const totB = p.totalB != null ? p.totalB : ptsB;
        const highlight = p.period >= 2 ? ' score-history-row--period-detail' : '';
        const periodPtsLine =
          p.period >= 2
            ? `<span class="score-period-pts">Заброшено за период: <strong>${ptsA} : ${ptsB}</strong></span>`
            : `<span class="score-period-pts">Заброшено: <strong>${ptsA} : ${ptsB}</strong></span>`;
        return `
        <div class="score-history-row${highlight}">
          <span>${p.period}-й период</span>
          ${periodPtsLine}
          <span class="score-period-total">Счёт ${totA} : ${totB}</span>
          <span class="score-history-time">${this.esc(p.timer || '')}</span>
        </div>`;
      })
      .join('');

    const totalA = st.scoreA;
    const totalB = st.scoreB;

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
          <button type="button" class="btn btn-success" data-bb-record>Записать результат ${st.currentPeriod <= 3 ? periodLabel : 'матча'}</button>
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
    const rerender = () => this.renderSession(root, session);

    const syncNames = () => {
      session.teamA = root.querySelector('[data-team-name="A"]')?.value || session.teamA;
      session.teamB = root.querySelector('[data-team-name="B"]')?.value || session.teamB;
    };

    root.querySelectorAll('[data-bb-pts]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (st.matchFinished) return;
        syncNames();
        const [side, delta] = btn.dataset.bbPts.split(':');
        const d = parseInt(delta, 10);
        if (side === 'A') st.scoreA = Math.max(0, st.scoreA + d);
        else st.scoreB = Math.max(0, st.scoreB + d);
        persist();
        rerender();
      });
    });

    root.querySelector('[data-bb-reset]')?.addEventListener('click', () => {
      if (st.matchFinished) return;
      if (!confirm('Убрать очки, набранные в текущем периоде? (общий счёт вернётся к концу прошлого периода)')) return;
      syncNames();
      const last = st.periods[st.periods.length - 1];
      st.scoreA = last ? last.totalA : 0;
      st.scoreB = last ? last.totalB : 0;
      persist();
      rerender();
    });

    root.querySelector('[data-bb-record]')?.addEventListener('click', () => {
      if (st.matchFinished) return;
      syncNames();
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
      st.currentPeriod += 1;
      if (st.currentPeriod > 3) st.matchFinished = true;
      persist();
      rerender();
    });

    root.querySelectorAll('[data-team-name]').forEach((inp) => {
      inp.addEventListener('change', () => {
        syncNames();
        persist();
      });
    });
  },

  _htmlVolleyball(session) {
    const st = session.state;
    const cur = st.current;

    const setCols = Math.max(st.sets.length + 1, st.setNumber, 1);
    let headerCells = '';
    let cellsA = '';
    let cellsB = '';
    for (let i = 1; i <= setCols; i++) {
      const set = st.sets.find((s) => s.set === i);
      headerCells += `<th>П${i}</th>`;
      if (set) {
        cellsA += `<td>${set.pointsA}</td>`;
        cellsB += `<td>${set.pointsB}</td>`;
      } else if (i === st.setNumber) {
        cellsA += `<td class="score-live-cell">${cur.pointsA}</td>`;
        cellsB += `<td class="score-live-cell">${cur.pointsB}</td>`;
      } else {
        cellsA += `<td>—</td>`;
        cellsB += `<td>—</td>`;
      }
    }

    const setHistory = st.sets
      .map(
        (s) => `
      <div class="score-history-row">
        <span>Партия ${s.set}</span>
        <strong>${s.pointsA} : ${s.pointsB}</strong>
      </div>`
      )
      .join('');

    return `
      <section class="glass scoreboard-card">
        <p class="score-phase-badge">Партия ${st.setNumber}${cur.matchBall ? ' · Матчбол' : ''}</p>
        <table class="score-sets-table">
          <thead><tr><th></th>${headerCells}<th>Всего</th></tr></thead>
          <tbody>
            <tr>
              <td class="score-sets-name"><input type="text" class="score-team-name" data-team-name="A" value="${this.esc(session.teamA)}"></td>
              ${cellsA}
              <td><strong>${st.setsWonA}</strong></td>
            </tr>
            <tr>
              <td class="score-sets-name"><input type="text" class="score-team-name" data-team-name="B" value="${this.esc(session.teamB)}"></td>
              ${cellsB}
              <td><strong>${st.setsWonB}</strong></td>
            </tr>
          </tbody>
        </table>
        <div class="score-vb-live glass">
          <h3 class="section-title">Счёт в партии</h3>
          <div class="score-duel score-duel--compact">
            <div class="score-team-zone">
              <span class="score-team-label">${this.esc(session.teamA)}</span>
              <div class="score-big" data-vb-a>${cur.pointsA}</div>
              <div class="score-pts-inline">
                <button type="button" class="btn score-pt-btn" data-vb-pts="A:1">+1</button>
                <button type="button" class="btn score-pt-btn btn-ghost" data-vb-pts="A:-1">−1</button>
              </div>
            </div>
            <div class="score-team-zone">
              <span class="score-team-label">${this.esc(session.teamB)}</span>
              <div class="score-big" data-vb-b>${cur.pointsB}</div>
              <div class="score-pts-inline">
                <button type="button" class="btn score-pt-btn" data-vb-pts="B:1">+1</button>
                <button type="button" class="btn score-pt-btn btn-ghost" data-vb-pts="B:-1">−1</button>
              </div>
            </div>
          </div>
          <div class="score-actions-row">
            <button type="button" class="btn ${cur.matchBall ? 'btn-warning' : 'btn-ghost'}" data-vb-matchball>
              ${cur.matchBall ? '✓ Матчбол' : 'Матчбол'}
            </button>
            <button type="button" class="btn btn-success" data-vb-end-set>Завершить партию</button>
          </div>
        </div>
        ${
          st.sets.length
            ? `<div class="score-history"><h3 class="section-title">Результаты партий</h3>${setHistory}</div>`
            : ''
        }
      </section>
      ${ScoreTimer.html()}`;
  },

  _bindVolleyball(root, session) {
    const st = session.state;
    const persist = () => ScoreStorage.save(session);
    const rerender = () => this.renderSession(root, session);

    const syncNames = () => {
      session.teamA = root.querySelector('[data-team-name="A"]')?.value || session.teamA;
      session.teamB = root.querySelector('[data-team-name="B"]')?.value || session.teamB;
    };

    root.querySelectorAll('[data-vb-pts]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncNames();
        const [side, delta] = btn.dataset.vbPts.split(':');
        const d = parseInt(delta, 10);
        if (side === 'A') st.current.pointsA = Math.max(0, st.current.pointsA + d);
        else st.current.pointsB = Math.max(0, st.current.pointsB + d);
        persist();
        rerender();
      });
    });

    root.querySelector('[data-vb-matchball]')?.addEventListener('click', () => {
      st.current.matchBall = !st.current.matchBall;
      persist();
      rerender();
    });

    root.querySelector('[data-vb-end-set]')?.addEventListener('click', () => {
      syncNames();
      const { pointsA, pointsB, matchBall } = st.current;
      if (pointsA === pointsB) {
        alert('Счёт партии не может быть ничейным.');
        return;
      }
      const max = Math.max(pointsA, pointsB);
      const min = Math.min(pointsA, pointsB);
      if (matchBall && max - min < 2) {
        alert('При матчболе партия завершается с разницей минимум в 2 очка.');
        return;
      }
      if (max < 25) {
        if (!confirm('Счёт меньше 25. Всё равно завершить партию?')) return;
      }

      st.sets.push({ set: st.setNumber, pointsA, pointsB });
      if (pointsA > pointsB) st.setsWonA += 1;
      else st.setsWonB += 1;
      st.setNumber += 1;
      st.current = { pointsA: 0, pointsB: 0, matchBall: false };
      persist();
      rerender();
    });

    root.querySelectorAll('[data-team-name]').forEach((inp) => {
      inp.addEventListener('change', () => {
        syncNames();
        persist();
      });
    });
  },

  _htmlFootball(session) {
    const st = session.state;
    const phase = st.phase;

    let phaseLabel = '1-й тайм';
    if (phase === 'half2') phaseLabel = '2-й тайм';
    else if (phase === 'draw_prompt') phaseLabel = 'Ничья — выбор';
    else if (phase === 'extra') phaseLabel = 'Дополнительное время';
    else if (phase === 'extra_draw') phaseLabel = 'Ничья после доп. времени';
    else if (phase === 'penalties') phaseLabel = 'Серия пенальти';
    else if (phase === 'finished') phaseLabel = 'Матч завершён';

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
              ? `<button type="button" class="btn btn-success score-actions-row" data-fb-end-extra>Завершить доп. время</button>`
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
      summary = `
        <section class="glass scoreboard-card">
          <h3 class="section-title">Итог матча</h3>
          <div class="score-summary">
            <p>Основное время: <strong>${st.regularTotalA} : ${st.regularTotalB}</strong></p>
            ${st.extra.recorded ? `<p>Доп. время: <strong>${st.extra.scoreA} : ${st.extra.scoreB}</strong></p>` : ''}
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
              ? '<button type="button" class="btn btn-success" data-fb-end-half>Завершить 1-й тайм</button>'
              : '<button type="button" class="btn btn-success" data-fb-end-match>Завершить матч</button>'
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
    const prevA = st.halves.reduce((s, h) => s + h.scoreA, 0);
    const prevB = st.halves.reduce((s, h) => s + h.scoreB, 0);
    return {
      scoreA: Math.max(0, st.scoreA - prevA),
      scoreB: Math.max(0, st.scoreB - prevB)
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
    const root = document.querySelector('.scoreboard-page');
    if (root) return root.outerHTML;
    return `<div><h2>Счёт ${this.esc(session.teamA)} — ${this.esc(session.teamB)}</h2><p>Текущий матч в режиме онлайн.</p></div>`;
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

    const syncNames = () => {
      session.teamA = root.querySelector('[data-team-name="A"]')?.value || session.teamA;
      session.teamB = root.querySelector('[data-team-name="B"]')?.value || session.teamB;
    };

    const totalRegular = () => {
      st.regularTotalA = st.scoreA;
      st.regularTotalB = st.scoreB;
    };

    root.querySelectorAll('[data-fb-pts]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncNames();
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
      syncNames();
      const delta = this._footballHalfDelta(st);
      st.halves.push({ half: 1, scoreA: delta.scoreA, scoreB: delta.scoreB });
      st.phase = 'half2';
      persist();
      rerender();
    });

    root.querySelector('[data-fb-end-match]')?.addEventListener('click', () => {
      syncNames();
      const delta = this._footballHalfDelta(st);
      st.halves.push({ half: 2, scoreA: delta.scoreA, scoreB: delta.scoreB });
      totalRegular();
      if (st.regularTotalA === st.regularTotalB) {
        st.phase = 'draw_prompt';
      } else {
        st.winner = st.regularTotalA > st.regularTotalB ? session.teamA : session.teamB;
        st.phase = 'finished';
      }
      persist();
      rerender();
    });

    root.querySelector('[data-fb-extra]')?.addEventListener('click', () => {
      st.phase = 'extra';
      st.extra = { scoreA: 0, scoreB: 0, active: true, recorded: false };
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
      syncNames();
      st.extra.recorded = true;
      const totalA = st.regularTotalA + st.extra.scoreA;
      const totalB = st.regularTotalB + st.extra.scoreB;
      if (totalA === totalB) {
        st.phase = 'extra_draw';
      } else {
        st.winner = totalA > totalB ? session.teamA : session.teamB;
        st.phase = 'finished';
      }
      persist();
      rerender();
    });

    root.querySelector('[data-fb-finish-draw]')?.addEventListener('click', () => {
      st.winner = null;
      st.phase = 'finished';
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
      persist();
      rerender();
    });

    root.querySelectorAll('[data-team-name]').forEach((inp) => {
      inp.addEventListener('change', () => {
        syncNames();
        persist();
      });
    });
  }
};
