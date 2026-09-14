const ScoreboardVolleyball = {
  _teamZoneVolleyball(side, name, setsWon, setNumber, points, matchBall) {
    return `
      <div class="score-team-zone" data-team="${side}">
        <input type="text" class="score-team-name" data-team-name="${side}" value="${this.esc(name)}" placeholder="Команда" aria-label="Команда ${side}">
        <div class="score-big" data-vb-${side.toLowerCase()}>${points}</div>
        <span class="score-team-label">Побед в матче: ${setsWon}</span>
        <div class="score-pts-inline">
          <button type="button" class="btn score-pt-btn" data-vb-pts="${side}:1">+1</button>
          <button type="button" class="btn score-pt-btn btn-ghost" data-vb-pts="${side}:-1">−1</button>
        </div>
      </div>`;
  },

  _htmlVolleyball(session) {
    const st = session.state;
    const cur = st.current;

    const setHistory = st.sets
      .map(
        (s) => `
      <div class="score-history-row">
        <span>Партия ${s.set}</span>
        <strong>${s.pointsA} : ${s.pointsB}</strong>
      </div>`
      )
      .join('');

    const matchFinished = st.setsWonA >= 3 || st.setsWonB >= 3 || st.sets.length >= 5;
    const winner = st.setsWonA >= 3 ? session.teamA : (st.setsWonB >= 3 ? session.teamB : null);

    return `
      <section class="glass scoreboard-card">
        <p class="score-phase-badge">${matchFinished ? 'Матч завершён' : `Партия ${st.setNumber}`}</p>
        ${winner ? `<p class="score-winner" style="text-align:center;font-size:1.25rem;margin:0.5rem 0">Победитель: ${this.esc(winner)}</p>` : ''}
        <div class="score-duel score-duel--volleyball">
          ${this._teamZoneVolleyball('A', session.teamA, st.setsWonA, st.setNumber, cur.pointsA)}
          ${this._teamZoneVolleyball('B', session.teamB, st.setsWonB, st.setNumber, cur.pointsB)}
        </div>
        <div class="score-actions-row">
          ${matchFinished ? '<p class="muted-desc">Матч завершён. Максимум 5 партий, победа до 3 выигранных партий.</p>' : '<button type="button" class="btn btn-success" data-vb-end-set>Завершить партию</button>'}
        </div>
        ${
          st.sets.length
            ? `<div class="score-history"><h3 class="section-title">Результаты партий</h3>${setHistory}</div>`
            : ''
        }
        <div class="score-match-summary glass">
          <h3 class="section-title">Счёт в матче</h3>
          <div class="score-match-summary-row">
            <span>${this.esc(session.teamA)}</span>
            <strong>${st.setsWonA}</strong>
            <span>:</span>
            <strong>${st.setsWonB}</strong>
            <span>${this.esc(session.teamB)}</span>
          </div>
        </div>
      </section>`;
  },

  _bindVolleyball(root, session) {
    const st = session.state;
    const persist = () => ScoreStorage.save(session);
    const rerender = () => this.renderSession(root, session);

    root.querySelectorAll('[data-vb-pts]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._syncNames(session, root);
        const [side, delta] = btn.dataset.vbPts.split(':');
        const d = parseInt(delta, 10);
        if (side === 'A') st.current.pointsA = Math.max(0, st.current.pointsA + d);
        else st.current.pointsB = Math.max(0, st.current.pointsB + d);
        persist();
        rerender();
      });
    });

    root.querySelector('[data-vb-end-set]')?.addEventListener('click', () => {
      if (st.setsWonA >= 3 || st.setsWonB >= 3 || st.sets.length >= 5) {
        alert('Матч завершён.');
        return;
      }
      this._syncNames(session, root);
      const { pointsA, pointsB } = st.current;
      if (pointsA === pointsB) {
        alert('Счёт партии не может быть ничейным.');
        return;
      }
      if (st.sets.length >= 5) {
        alert('Максимальное количество партий (5) достигнут.');
        return;
      }
      if (pointsA < 25 && pointsB < 25) {
        if (!confirm('Счёт меньше 25. Всё равно завершить партию?')) return;
      }

      st.sets.push({ set: st.setNumber, pointsA, pointsB });
      if (pointsA > pointsB) st.setsWonA += 1;
      else st.setsWonB += 1;
      st.setNumber += 1;
      st.current = { pointsA: 0, pointsB: 0 };
      
      // Проверяем, заверлён ли матч, и синхронизируем
      if (st.setsWonA >= 3 || st.setsWonB >= 3 || st.sets.length >= 5) {
        this._syncToTournament(session);
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
  },
};

window.ScoreboardVolleyball = ScoreboardVolleyball;

