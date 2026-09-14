const ScoreExport = {
  async exportSession(session) {
    await SheetJSLoader.load();
    if (typeof XLSX === 'undefined') {
      alert('Библиотека Excel не загружена.');
      return;
    }

    const sport = SCORE_SPORTS[session.sport]?.label || session.sport;
    const wsData = [[`Ведение счёта — ${sport}`], [`${session.teamA} — ${session.teamB}`], []];

    if (session.sport === 'basketball') {
      this._basketball(wsData, session);
    } else if (session.sport === 'volleyball') {
      this._volleyball(wsData, session);
    } else {
      this._football(wsData, session);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Матч');
    const name = `${session.teamA}_vs_${session.teamB}_${session.sport}`.replace(/[<>:"/\\|?*]/g, '_');
    downloadXlsxWorkbook(wb, `${name}.xlsx`);
  },

  _basketball(wsData, session) {
    const st = session.state;
    wsData.push(['Период', 'За период (А)', 'За период (Б)', 'Счёт (А)', 'Счёт (Б)', 'Время']);
    st.periods.forEach((p) => {
      const ptsA = p.pointsA != null ? p.pointsA : p.scoreA;
      const ptsB = p.pointsB != null ? p.pointsB : p.scoreB;
      const totA = p.totalA != null ? p.totalA : ptsA;
      const totB = p.totalB != null ? p.totalB : ptsB;
      wsData.push([`${p.period}-й период`, ptsA, ptsB, totA, totB, p.timer || '']);
    });
    if (st.periods.length) {
      wsData.push([]);
      wsData.push(['Итого матч', '', '', st.scoreA, st.scoreB, '']);
    }
  },

  _volleyball(wsData, session) {
    const st = session.state;
    wsData.push(['Партия', session.teamA, session.teamB]);
    st.sets.forEach((s) => {
      wsData.push([`Партия ${s.set}`, s.pointsA, s.pointsB]);
    });
    wsData.push([]);
    wsData.push(['Партий выиграно', st.setsWonA, st.setsWonB]);
  },

  _football(wsData, session) {
    const st = session.state;
    wsData.push(['Этап', session.teamA, session.teamB]);
    st.halves.forEach((h) => {
      const label = h.half === 1 ? '1-й тайм' : h.half === 2 ? '2-й тайм' : `Тайм ${h.half}`;
      wsData.push([label, h.scoreA, h.scoreB]);
    });
    wsData.push(['Основное время', st.regularTotalA, st.regularTotalB]);
    if (st.extra.recorded) {
      wsData.push(['Дополнительное время', st.extra.scoreA, st.extra.scoreB]);
    }
    if (st.penalties.shotsA.length || st.penalties.shotsB.length) {
      const pa = st.penalties.shotsA.filter(Boolean).length;
      const pb = st.penalties.shotsB.filter(Boolean).length;
      wsData.push(['Серия пенальти (забито)', pa, pb]);
    }
    if (st.winner) {
      wsData.push([]);
      wsData.push(['Победитель', st.winner, '']);
    }
  }
};

window.ScoreExport = ScoreExport;

