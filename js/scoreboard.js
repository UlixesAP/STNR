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
    else if (session.sport === 'hockey') body = this._htmlHockey(session);
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
    else if (session.sport === 'hockey') this._bindHockey(root, session);
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
    const root = document.querySelector('.scoreboard-page') || document.body;
    console.log('root найден:', root);
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
  },

  _htmlHockey(session) {
    const st = session.state;
    const phase = st.phase;

    let phaseLabel = '';
    if (phase === 'period1') phaseLabel = '1-й период';
    else if (phase === 'period2') phaseLabel = '2-й период';
    else if (phase === 'period3') phaseLabel = '3-й период';
    else if (phase === 'overtime') phaseLabel = 'Овертайм';
    else if (phase === 'penalty_shootout') phaseLabel = 'Буллиты';
    else if (phase === 'draw_prompt') phaseLabel = 'Ничья — выбор продолжения';
    else if (phase === 'ot_draw_prompt') phaseLabel = 'Ничья в овертайме';
    else if (phase === 'finished') phaseLabel = 'Матч завершён';

    const psBlock = phase === 'penalty_shootout' || st.penaltyShootouts?.shotsA?.length
      ? `
      <section class="glass scoreboard-card scoreboard-card--sub">
        <h3 class="section-title">Буллиты</h3>
        <p class="score-penalty-total">${session.teamA}: <strong>${st.penaltyShootouts?.shotsA?.filter(Boolean).length || 0}</strong> · ${session.teamB}: <strong>${st.penaltyShootouts?.shotsB?.filter(Boolean).length || 0}</strong></p>
        <div class="score-penalty-grid">
          <div>
            <p class="score-team-label">${this.esc(session.teamA)}</p>
            ${st.penaltyShootouts.shotsA?.map((val, idx) => `
            <div class="score-penalty-shot">
              <span>${val ? '🥅' : '❌'}</span>
              <button type="button" class="btn btn-sm btn-danger" data-ps-cancel="A:${idx}">Отменить</button>
            </div>`).join('') || ''}
            <div class="score-penalty-actions">
              ${(() => {
                const countA = st.penaltyShootouts?.shotsA?.length ?? 0;
                const countB = st.penaltyShootouts?.shotsB?.length ?? 0;
                const canShootA = countA === countB;
                return `
                <button ${canShootA ? '' : 'disabled'} type="button" class="btn btn-sm btn-success" data-ps="A:1">Забил</button>
                <button ${canShootA ? '' : 'disabled'} type="button" class="btn btn-sm btn-danger" data-ps="A:0">Мимо</button>`;
              })()}
            </div>
          </div>
          <div>
            <p class="score-team-label">${this.esc(session.teamB)}</p>
            ${st.penaltyShootouts.shotsB?.map((val, idx) => `
            <div class="score-penalty-shot">
              <span>${val ? '🥅' : '❌'}</span>
              <button type="button" class="btn btn-sm btn-danger" data-ps-cancel="B:${idx}">Отменить</button>
            </div>`).join('') || ''}
            <div class="score-penalty-actions">
              ${(() => {
                const countA = st.penaltyShootouts?.shotsA?.length ?? 0;
                const countB = st.penaltyShootouts?.shotsB?.length ?? 0;
                const canShootB = countA === countB + 1;
                return `
                <button ${canShootB ? '' : 'disabled'} type="button" class="btn btn-sm btn-success" data-ps="B:1">Забил</button>
                <button ${canShootB ? '' : 'disabled'} type="button" class="btn btn-sm btn-danger" data-ps="B:0">Мимо</button>`;
              })()}
            </div>
          </div>
        </div>
        <div class="score-actions-row">
          ${((st.penaltyShootouts?.shotsA?.length || 0) >= 3 && (st.penaltyShootouts?.shotsB?.length || 0) >= 3) && !st.penaltyShootoutsFinished ? '<button type="button" class="btn btn-warning" data-ps-finish>Завершить серию</button>' : ''}
          <button type="button" class="btn btn-warning btn-sm" data-ps-restart>Перезапустить серию</button>
        </div>
      </section>`
      : '';

    const totalPeriodsA = st.periods.reduce((sum, p) => sum + p.scoreA, 0);
    const totalPeriodsB = st.periods.reduce((sum, p) => sum + p.scoreB, 0);

    const drawPrompt = phase === 'draw_prompt'
      ? `
      <div class="score-draw-prompt glass">
        <p>Ничья в основное время (${totalPeriodsA}:${totalPeriodsB}). Что дальше?</p>
        <button type="button" class="btn btn-success" data-hk-overtime>Овертайм</button>
        <button type="button" class="btn btn-warning" data-hk-penalties>Буллиты</button>
        <button type="button" class="btn btn-danger" data-hk-finish-match>Завершить матч (ничья)</button>
      </div>`
      : '';

      const otDrawPrompt = phase === 'ot_draw_prompt'
        ? `
        <div class="score-draw-prompt glass">
          <p>Ничья после овертайма (${st.overtime.scoreA}:${st.overtime.scoreB}).</p>
          <button type="button" class="btn btn-success" data-hk-next-ot>Играть ещё овертайм</button>
          <button type="button" class="btn btn-warning" data-hk-penalties>Перейти к буллитам</button>
        </div>`
        : '';



    const otSummaryBlock = st.overtimePeriods?.length > 0
      ? `
      <section class="glass scoreboard-card scoreboard-card--sub">
        <h3 class="section-title">Овертаймы</h3>
        <div class="score-history">
          ${st.overtimePeriods.map((p) => `
          <div class="score-history-row">
            <span>${p.period}-й овертайм</span>
            <strong>${p.scoreA} : ${p.scoreB}</strong>
          </div>`).join('')}
        </div>
      </section>`
      : '';

    let summary = '';
    if (phase === 'finished') {
      console.log('=== SUMMARY DEBUG ===');
      console.log('st.periods:', JSON.stringify(st.periods));
      console.log('st.overtimePeriods:', JSON.stringify(st.overtimePeriods));
      console.log('st.overtime:', JSON.stringify(st.overtime));
      console.log('st.winner:', st.winner);
      console.log('====================');
      
      const totalPeriodsA = (st.periods ?? []).reduce((sum, p) => sum + p.scoreA, 0);
      const totalPeriodsB = (st.periods ?? []).reduce((sum, p) => sum + p.scoreB, 0);
      
      const totalOvertimeA = (st.overtimePeriods ?? []).reduce((sum, p) => sum + p.scoreA, 0);
      const totalOvertimeB = (st.overtimePeriods ?? []).reduce((sum, p) => sum + p.scoreB, 0);
      
      const finalA = totalPeriodsA + totalOvertimeA;
      const finalB = totalPeriodsB + totalOvertimeB;
      summary = `
      <section class="glass scoreboard-card">
        <h3 class="section-title">Итог матча</h3>
        <div class="score-summary">
          <p>Основное время: <strong>${totalPeriodsA} : ${totalPeriodsB}</strong></p>
          ${totalOvertimeA > 0 || totalOvertimeB > 0 ? `<p>Овертаймы: <strong>${totalOvertimeA} : ${totalOvertimeB}</strong></p>` : ''}
          ${st.penaltyShootouts?.shotsA?.length ? `<p>Буллиты (забито): <strong>${st.penaltyShootouts?.shotsA?.filter(Boolean).length} : ${st.penaltyShootouts?.shotsB?.filter(Boolean).length}</strong></p>` : ''}
          <p>Финальный счёт: <strong>${finalA} : ${finalB}</strong></p>
          ${st.winner ? `<p class="score-winner">Победитель: <strong>${this.esc(st.winner)}</strong></p>` : '<p>Результат: ничья</p>'}
        </div>
      </section>`;
    }

    let periodsBlock = '';
    if (st.periods.length) {
      periodsBlock = `
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
    }

    if (!session.teamAPenalties) session.teamAPenalties = [];
    if (!session.teamBPenalties) session.teamBPenalties = [];
    
    const renderPenaltiesHtml = () => {
      const containerA = document.getElementById('team-a-penalties');
      const containerB = document.getElementById('team-b-penalties');

      const renderPen = (pen, idx, side) => {
        const urgent = pen.remaining <= 1 ? ' score-penalty--urgent' : '';
        return `
        <div class="score-history-row${urgent}" data-pen-index="${idx}">
          <span>#${this.esc(pen.player)}</span>
          <span>
            ${pen.minutes} мин.
            <strong>${pen.remaining ?? pen.minutes}</strong> ост.
          </span>
          <button
            type="button"
            class="btn btn-sm btn-danger"
            data-del-pen="${side}:${idx}">
            Удалить
          </button>
        </div>`;
      };

      if (containerA) {
        containerA.innerHTML = (session.teamAPenalties || [])
          .map((pen, idx) => renderPen(pen, idx, 'A'))
          .join('') || '<p class="score-empty-hint">Нет штрафов</p>';
      }

      if (containerB) {
        containerB.innerHTML = (session.teamBPenalties || [])
          .map((pen, idx) => renderPen(pen, idx, 'B'))
          .join('') || '<p class="score-empty-hint">Нет штрафов</p>';
      }
    };
    
    session.teamAPenalties = session.teamAPenalties || [];
    session.teamBPenalties = session.teamBPenalties || [];
    
    const penaltiesBlock = `
    <section class="glass scoreboard-card">
      <h3 class="section-title">Штрафы</h3>
      <div class="score-penalty-grid">
        <div>
          <p class="score-team-label">${this.esc(session.teamA)}</p>
          <div id="team-a-penalties">
            ${(session.teamAPenalties || []).map((pen, idx) => `
            <div class="score-history-row${pen.remaining <= 1 ? ' score-penalty--urgent' : ''}" data-pen-index="${idx}">
              <span>#${this.esc(pen.player)}</span>
              <span>${pen.minutes} мин. <strong>${pen.remaining ?? pen.minutes}</strong> ост.</span>
              <button type="button" class="btn btn-sm btn-danger" data-del-pen="A:${idx}">Удалить</button>
            </div>`).join('') || '<p class="score-empty-hint">Нет штрафов</p>'}
          </div>
          <button type="button" class="btn btn-sm btn-ghost" data-add-pen="A">+ Добавить штраф</button>
        </div>
        <div>
          <p class="score-team-label">${this.esc(session.teamB)}</p>
          <div id="team-b-penalties">
            ${(session.teamBPenalties || []).map((pen, idx) => `
            <div class="score-history-row${pen.remaining <= 1 ? ' score-penalty--urgent' : ''}" data-pen-index="${idx}">
              <span>#${this.esc(pen.player)}</span>
              <span>${pen.minutes} мин. <strong>${pen.remaining ?? pen.minutes}</strong> ост.</span>
              <button type="button" class="btn btn-sm btn-danger" data-del-pen="B:${idx}">Удалить</button>
            </div>`).join('') || '<p class="score-empty-hint">Нет штрафов</p>'}
          </div>
          <button type="button" class="btn btn-sm btn-ghost" data-add-pen="B">+ Добавить штраф</button>
        </div>
      </div>
    </section>`;

    const totalA = st.periods.reduce((sum, p) => sum + p.scoreA, 0);
    const totalB = st.periods.reduce((sum, p) => sum + p.scoreB, 0);

    let scoreDisplay = '';
    if (st.periods.length > 0) {
      scoreDisplay = `
        <div class="score-period-total">
          <span>Сумма периодов:</span>
          <strong>${totalA} : ${totalB}</strong>
        </div>`;
    }

    const totalPrevOTA = (st.overtimePeriods ?? []).reduce((sum, p) => sum + p.scoreA, 0);
    const totalPrevOTB = (st.overtimePeriods ?? []).reduce((sum, p) => sum + p.scoreB, 0);

    let mainScoreA;
    let mainScoreB;

    if (st.phase === 'overtime' || st.phase === 'ot_draw_prompt') {
      mainScoreA = totalA + totalPrevOTA + (st.overtime?.scoreA ?? 0);
      mainScoreB = totalB + totalPrevOTB + (st.overtime?.scoreB ?? 0);
    } else if (st.phase === 'finished') {
      mainScoreA = totalA + totalPrevOTA;
      mainScoreB = totalB + totalPrevOTB;
    } else {
      mainScoreA = totalA + st.scoreA;
      mainScoreB = totalB + st.scoreB;
    }

    return `
      <section class="glass scoreboard-card">
        <p class="score-phase-badge">${phaseLabel}</p>
        <div class="score-duel score-duel--football">
          ${this._teamZoneHockey('A', session.teamA, mainScoreA, phase !== 'finished')}
          ${this._teamZoneHockey('B', session.teamB, mainScoreB, phase !== 'finished')}
        </div>
        ${scoreDisplay}
         <div class="score-actions-row">
           ${
             phase === 'period1' || phase === 'period2' || phase === 'period3'
               ? '<button type="button" class="btn btn-success" data-hk-end-period>Завершить период</button>'
               : phase === 'draw_prompt'
               ? `<button type="button" class="btn btn-success" data-hk-overtime>Овертайм</button>
                  <button type="button" class="btn btn-warning" data-hk-penalties>Буллиты</button>
                  <button type="button" class="btn btn-danger" data-hk-finish-match>Завершить матч (ничья)</button>`
                : phase === 'overtime'
                ? `<button type="button" class="btn btn-success" data-hk-next-ot>Играть следующий овертайм</button>
                   <button type="button" class="btn btn-warning" data-hk-penalties>Перейти к буллитам</button>
                   <button type="button" class="btn btn-danger" data-hk-finish-match>Завершить матч</button>`
                : phase === 'ot_draw_prompt'
                ? `<button type="button" class="btn btn-success" data-hk-next-ot>Играть ещё овертайм</button>
                   <button type="button" class="btn btn-warning" data-hk-penalties>Перейти к буллитам</button>
                   <button type="button" class="btn btn-danger" data-hk-finish-match>Завершить матч (ничья)</button>`
                : ''
           }
         </div>
        ${otDrawPrompt}
        ${periodsBlock}
       ${otSummaryBlock}
     </section>
     ${penaltiesBlock}
    ${psBlock}
    ${summary}
    ${ScoreTimer.html()}`;
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

  _bindHockey(root, session) {
    const st = session.state;
    const persist = () => ScoreStorage.save(session);
    const rerender = () => this.renderSession(root, session);

    const syncNames = () => {
      session.teamA = root.querySelector('[data-team-name="A"]')?.value || session.teamA;
      session.teamB = root.querySelector('[data-team-name="B"]')?.value || session.teamB;
    };

    const initPenalties = () => {
      session.teamAPenalties = session.teamAPenalties || [];
      session.teamBPenalties = session.teamBPenalties || [];
    };

    root.querySelectorAll('[data-hk-pts]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncNames();
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
      syncNames();
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
        const totalA = st.periods.reduce((sum, p) => sum + p.scoreA, 0);
        const totalB = st.periods.reduce((sum, p) => sum + p.scoreB, 0);
        if (totalA === totalB) {
          st.phase = 'draw_prompt';
        } else {
          st.winner = totalA > totalB ? session.teamA : session.teamB;
          st.phase = 'finished';
        }
      }
      persist();
      rerender();
    });

    root.querySelector('[data-hk-overtime]')?.addEventListener('click', () => {
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
      st.phase = 'penalty_shootout';
      st.penaltyShootouts = { shotsA: [], shotsB: [] };
      persist();
      rerender();
    });

    root.querySelector('[data-hk-finish-match]')?.addEventListener('click', () => {
      syncNames();

      st.overtimePeriods = st.overtimePeriods ?? [];

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

      const totalPeriodsA = (st.periods ?? []).reduce((sum, p) => sum + p.scoreA, 0);
      const totalPeriodsB = (st.periods ?? []).reduce((sum, p) => sum + p.scoreB, 0);

      const totalOvertimeA = st.overtimePeriods.reduce((sum, p) => sum + p.scoreA, 0);
      const totalOvertimeB = st.overtimePeriods.reduce((sum, p) => sum + p.scoreB, 0);

      const finalA = totalPeriodsA + totalOvertimeA;
      const finalB = totalPeriodsB + totalOvertimeB;

      st.winner = finalA > finalB
        ? session.teamA
        : finalB > finalA
          ? session.teamB
          : null;

      st.phase = 'finished';
      
      console.log('=== FINISH MATCH DEBUG ===');
      console.log('st.phase:', st.phase);
      console.log('st.periods:', JSON.stringify(st.periods));
      console.log('st.overtimePeriods:', JSON.stringify(st.overtimePeriods));
      console.log('st.overtime:', JSON.stringify(st.overtime));
      console.log('totalPeriodsA:', totalPeriodsA, 'totalPeriodsB:', totalPeriodsB);
      console.log('totalOvertimeA:', totalOvertimeA, 'totalOvertimeB:', totalOvertimeB);
      console.log('finalA:', finalA, 'finalB:', finalB);
      console.log('========================');
      
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
      persist();
      rerender();
    });

    root.querySelectorAll('[data-team-name]').forEach((inp) => {
      inp.addEventListener('change', () => {
        syncNames();
        persist();
      });
    });

    const clearPenaltyTimer = () => {
      if (session.penaltyTimerId) clearInterval(session.penaltyTimerId);
      session.penaltyTimerId = null;
    };

    console.log('root:', root);
    console.log('addPenBtns:', root?.querySelectorAll('[data-add-pen]'));
    console.log('penaltiesBlock в DOM:', document.getElementById('team-a-penalties'));

    root.addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-add-pen]');
      if (addBtn) {
        const side = addBtn.dataset.addPen;
        const teamName = side === 'A' ? session.teamA : session.teamB;

        const player = prompt(`Номер игрока (${teamName}):`);
        if (!player?.trim()) return;

        const minutes = prompt('Минуты штрафа (2, 5, 10):', '2');
        const mins = parseInt(minutes, 10);

        if (!mins || ![2, 5, 10].includes(mins)) {
          alert('Допустимые значения: 2, 5 или 10 минут');
          return;
        }

        initPenalties();
        const penalties = side === 'A'
          ? session.teamAPenalties
          : session.teamBPenalties;

        if (penalties.length >= 5) {
          alert('Максимум 5 игроков на скамейке штрафников');
          return;
        }

        penalties.push({
          player: player.trim(),
          minutes: mins,
          remaining: mins,
          active: true,
          addedAt: Date.now()
        });

        renderPenaltiesHtml();
        persist();
        return;
      }
      const delBtn = e.target.closest('[data-del-pen]');
      if (delBtn) {
        const [side, idx] = delBtn.dataset.delPen.split(':');
        const idxNum = parseInt(idx, 10);
        initPenalties();
        const penalties = side === 'A' ? session.teamAPenalties : session.teamBPenalties;
        if (penalties[idxNum]) {
          penalties.splice(idxNum, 1);
          renderPenaltiesHtml();
          persist();
        }
        return;
      }
    });

    if (window._penaltyTimerRef) {
      clearInterval(window._penaltyTimerRef);
      window._penaltyTimerRef = null;
    }

    window._penaltyTimerRef = setInterval(() => {
      const timerState = session.state?.timer;
      if (!timerState?.running) return;

      initPenalties();
      let changed = false;

      const processPenalties = (penalties) => {
        for (let i = penalties.length - 1; i >= 0; i--) {
          const pen = penalties[i];
          if (!pen.active) continue;

          if (pen.remaining > 0) {
            pen.remaining--;
            changed = true;
          }

          if (pen.remaining <= 0) {
            penalties.splice(i, 1);
            changed = true;
          }
        }
      };

      processPenalties(session.teamAPenalties);
      processPenalties(session.teamBPenalties);

      if (changed) {
        renderPenaltiesHtml();
        persist();
      }
    }, 60000);
  },
};
