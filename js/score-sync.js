const ScoreSync = {
  ensureLinkedScoreId(t, matchIndex) {
    const m = t.state.matches?.[matchIndex];
    if (!m) return null;
    if (!m.linkedScoreId) {
      m.linkedScoreId = 'ls_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      this.persist(t);
    }
    return m.linkedScoreId;
  },

  ensureBracketLinkedScoreId(t, kind, rIdx, mIdx) {
    const match = this._getPlayoffMatch(t.state.bracket, kind, rIdx, mIdx);
    if (!match) return null;
    if (!match.linkedScoreId) {
      match.linkedScoreId = 'ls_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      this.persist(t);
    }
    return match.linkedScoreId;
  },

  createLinkedScoreboard(tournamentId, teamA, teamB, matchIndex) {
    const t = TournamentStorage.get(tournamentId);
    if (!t) return null;
    const matches = t.type === 'mixed' ? t.state.roundRobin?.matches : t.state.matches;
    if (!matches) return null;
    const match = matches[matchIndex];
    if (!match) return null;

    if (match.linkedScoreId) {
      const existing = ScoreStorage.getByLinkedId(match.linkedScoreId);
      if (existing) return existing;
    }

    const linkedScoreId = 'ls_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    match.linkedScoreId = linkedScoreId;
    this.persist(t);

    const _sportMap = { 'волейбол': 'volleyball', 'баскетбол': 'basketball', 'хоккей': 'hockey', 'стритбол': 'streetball' };
    const sport = _sportMap[t.meta?.sport] || 'football';
    const session = ScoreStorage.create(sport);
    session.teamA = teamA;
    session.teamB = teamB;
    session.tournamentId = tournamentId;
    session.matchIndex = matchIndex;
    session.linkedScoreId = linkedScoreId;
    session.updatedAt = new Date().toISOString();
    ScoreStorage.save(session);
    return session;
  },

  createBracketLinkedScoreboard(tournamentId, teamA, teamB, kind, rIdx, mIdx) {
    const t = TournamentStorage.get(tournamentId);
    if (!t) return null;
    const bracket = t.type === 'mixed' ? (t.state.playoff?.bracket || t.state.bracket) : t.state.bracket;
    if (!bracket) return null;

    const match = this._getPlayoffMatch(bracket, kind, rIdx, mIdx);
    if (!match) return null;

    const linkedScoreId = 'ls_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    match.linkedScoreId = linkedScoreId;
    this.persist(t);

    const _sportMap = { 'волейбол': 'volleyball', 'баскетбол': 'basketball', 'хоккей': 'hockey', 'стритбол': 'streetball' };
    const sport = _sportMap[t.meta?.sport] || 'football';
    const session = ScoreStorage.create(sport);
    session.teamA = teamA;
    session.teamB = teamB;
    session.tournamentId = tournamentId;
    session.matchIndex = null;
    session.bracketMatch = { kind, rIdx: String(rIdx), mIdx: String(mIdx) };
    session.linkedScoreId = linkedScoreId;
    session.updatedAt = new Date().toISOString();
    ScoreStorage.save(session);
    return session;
  },

  _getFinalScore(sb) {
    if (!sb || !sb.state) return { scoreA: 0, scoreB: 0 };
    const st = sb.state;
    const sport = sb.sport;

    if (sport === 'football') {
      let regularA = 0, regularB = 0, extraA = 0, extraB = 0;
      if (st.phase === 'finished' || st.phase === 'extra_draw' || st.phase === 'penalties') {
        regularA = st.regularTotalA || 0;
        regularB = st.regularTotalB || 0;
        if (st.extra && st.extra.recorded) {
          extraA = st.extra.scoreA || 0;
          extraB = st.extra.scoreB || 0;
        }
      } else {
        regularA = st.scoreA || 0;
        regularB = st.scoreB || 0;
      }
      const scoreA = regularA + extraA;
      const scoreB = regularB + extraB;
      if (st.phase === 'finished' && st.penalties && st.penalties.shotsA && st.penalties.shotsA.length > 0) {
        const penaltyA = st.penalties.shotsA.filter(Boolean).length;
        const penaltyB = st.penalties.shotsB.filter(Boolean).length;
        return { scoreA, scoreB, extraScoreA: extraA, extraScoreB: extraB, penaltyA, penaltyB, wasDecidedByPenalties: regularA === regularB && extraA === extraB };
      }
      return { scoreA, scoreB, extraScoreA: extraA || null, extraScoreB: extraB || null, penaltyA: null, penaltyB: null, wasDecidedByPenalties: false };
    }

    if (sport === 'hockey') {
      const tot = this._getHockeyTotals(st);
      const finalA = tot.periodA + tot.overtimePeriodA;
      const finalB = tot.periodB + tot.overtimePeriodB;
      const shotsA = st.penaltyShootouts?.shotsA || [];
      const shotsB = st.penaltyShootouts?.shotsB || [];
      const hadShootout = shotsA.length > 0 && shotsB.length > 0;
      const hadOvertime = (st.overtimePeriods || []).length > 0;
      const penaltyA = hadShootout ? shotsA.filter(Boolean).length : null;
      const penaltyB = hadShootout ? shotsB.filter(Boolean).length : null;
      let resultType = 'regulation';
      if (hadShootout) {
        resultType = 'shootout';
      } else if (hadOvertime) {
        resultType = 'overtime';
      }
      return { scoreA: finalA, scoreB: finalB, penaltyA, penaltyB, wasDecidedByPenalties: hadShootout, resultType };
    }

    const scoreA = st.regularTotalA ?? st.scoreA ?? 0;
    const scoreB = st.regularTotalB ?? st.scoreB ?? 0;
    return { scoreA, scoreB, penaltyA: null, penaltyB: null, wasDecidedByPenalties: false };
  },

  _getHockeyTotals(st) {
    return {
      periodA: (st.periods || []).reduce((sum, p) => sum + (p.scoreA || 0), 0),
      periodB: (st.periods || []).reduce((sum, p) => sum + (p.scoreB || 0), 0),
      overtimePeriodA: (st.overtimePeriods || []).reduce((sum, p) => sum + (p.scoreA || 0), 0),
      overtimePeriodB: (st.overtimePeriods || []).reduce((sum, p) => sum + (p.scoreB || 0), 0)
    };
  },

  _syncPlayoffBracketWithScoreboard(t) {
    if (t.type !== 'mixed' || !t.state.playoff?.bracket) return;
    // Если пользователь на странице табло — не синхронизируем
    if (location.hash.startsWith('#/score/s/')) return;
    const bracket = t.state.playoff.bracket;
    const syncMatch = (match, label) => {
      if (!match?.linkedScoreId) return;
      const sb = ScoreStorage.getByLinkedId(match.linkedScoreId);
      if (!sb) return;
      const phase = sb.state?.phase;
      if (phase !== 'finished' && phase !== 'extra_draw' && phase !== 'penalties') return;
      const scores = this._getFinalScore(sb);
      const checkSynced = match._synced === true
        && match.scoreA === scores.scoreA
        && match.scoreB === scores.scoreB
        && match.penaltyA === scores.penaltyA
        && match.penaltyB === scores.penaltyB
        && match.extraScoreA === scores.extraScoreA
        && match.extraScoreB === scores.extraScoreB;
      if (checkSynced) return;

      console.log(`[SYNC:${label}] OVERWRITING match`, { from: { a: match.scoreA, b: match.scoreB, synced: match._synced }, to: { a: scores.scoreA, b: scores.scoreB }, sbPhase: phase });
      match.scoreA = scores.scoreA;
      match.scoreB = scores.scoreB;
      match.penaltyA = scores.penaltyA;
      match.penaltyB = scores.penaltyB;
      match.wasDecidedByPenalties = scores.wasDecidedByPenalties;
      if (scores.resultType) match.resultType = scores.resultType;
      if (scores.extraScoreA != null) match.extraScoreA = scores.extraScoreA;
      if (scores.extraScoreB != null) match.extraScoreB = scores.extraScoreB;

      let winner = null, loser = null;
      if (scores.penaltyA != null && scores.penaltyB != null && scores.penaltyA !== scores.penaltyB) {
        winner = scores.penaltyA > scores.penaltyB ? sb.teamA : sb.teamB;
        loser = scores.penaltyA > scores.penaltyB ? sb.teamB : sb.teamA;
      } else if (scores.scoreA > scores.scoreB) {
        winner = sb.teamA; loser = sb.teamB;
      } else if (scores.scoreB > scores.scoreA) {
        winner = sb.teamB; loser = sb.teamA;
      }
      match.winner = winner;
      match.loser = loser;
      match.isFinished = true;
      match._synced = true;
    };

    if (bracket.rounds) {
      for (const round of bracket.rounds) {
        for (const match of round.matches) syncMatch(match, 'round');
      }
    }
    syncMatch(bracket.finalMatch, 'FINAL');
    syncMatch(bracket.thirdPlaceMatch, 'THIRD');
    TournamentStorage.save(t);
  },

  startScorePolling(t) {
    this.stopScorePolling();
    this._currentTournament = t;
    this._scorePollInterval = setInterval(() => {
      if (this._currentScoreboardId) return;
      // Если пользователь на странице табло — не синхронизируем
      if (location.hash.startsWith('#/score/s/')) { this.stopScorePolling(); return; }
      if (!this._currentTournament) { this.stopScorePolling(); return; }
      const fresh = TournamentStorage.get(this._currentTournament.id);
      if (!fresh) { this.stopScorePolling(); return; }

      let hasChanges = false;

      if (fresh.type === 'round-robin') {
        const matches = fresh.state.matches || [];
        for (const m of matches) {
          if (!m.linkedScoreId) continue;
          const sb = ScoreStorage.getByLinkedId(m.linkedScoreId);
          if (sb && sb.state?.phase === 'finished') {
            const scores = this._getFinalScore(sb);
            const hasChanged = !m._synced || m.scoreA !== scores.scoreA || m.scoreB !== scores.scoreB;
            m.scoreA = scores.scoreA;
            m.scoreB = scores.scoreB;
            if (scores.penaltyA != null) m.penaltyA = scores.penaltyA;
            if (scores.penaltyB != null) m.penaltyB = scores.penaltyB;
            if (scores.wasDecidedByPenalties) m.wasDecidedByPenalties = scores.wasDecidedByPenalties;
            if (scores.resultType) m.resultType = scores.resultType;
            m.isPlayed = true;
            if (scores.scoreA > scores.scoreB) m.winner = sb.teamA;
            else if (scores.scoreB > scores.scoreA) m.winner = sb.teamB;
            else m.winner = null;
            m._synced = true;
            if (hasChanged) hasChanges = true;
          }
        }
      } else if (fresh.type === 'olympic') {
        const bracket = fresh.state.bracket;
        const checkMatch = (match) => {
          if (!match?.linkedScoreId) return;
          const sb = ScoreStorage.getByLinkedId(match.linkedScoreId);
          if (sb && sb.state?.phase === 'finished') {
            const scores = this._getFinalScore(sb);
            const hasChanged = !match._synced || match.scoreA !== scores.scoreA || match.scoreB !== scores.scoreB;
            match.scoreA = scores.scoreA;
            match.scoreB = scores.scoreB;
            if (scores.penaltyA != null) match.penaltyA = scores.penaltyA;
            if (scores.penaltyB != null) match.penaltyB = scores.penaltyB;
            if (scores.wasDecidedByPenalties) match.wasDecidedByPenalties = scores.wasDecidedByPenalties;
            if (scores.resultType) match.resultType = scores.resultType;
            if (sb.state?.winner) {
              match.winner = sb.state.winner;
              match.loser = sb.state.winner === sb.teamA ? sb.teamB : sb.teamA;
            } else if (scores.scoreA > scores.scoreB) {
              match.winner = sb.teamA; match.loser = sb.teamB;
            } else if (scores.scoreB > scores.scoreA) {
              match.winner = sb.teamB; match.loser = sb.teamA;
            } else {
              match.winner = null; match.loser = null;
            }
            match.isFinished = true;
            match._synced = true;
            if (hasChanged) hasChanges = true;
          }
        };
        if (bracket?.rounds) {
          for (const round of bracket.rounds) {
            for (const match of round.matches) checkMatch(match);
          }
        }
        checkMatch(bracket.finalMatch);
        checkMatch(bracket.thirdPlaceMatch);

        if (bracket.finalMatch?.isFinished && bracket.finalMatch.loser && !bracket.thirdPlaceTeam) {
          bracket.thirdPlaceTeam = bracket.finalMatch.loser;
          hasChanges = true;
        }
        if (bracket.thirdPlaceMatch?.isFinished && bracket.thirdPlaceMatch.winner && !bracket.thirdPlaceTeam) {
          bracket.thirdPlaceTeam = bracket.thirdPlaceMatch.winner;
          hasChanges = true;
        }
      } else if (fresh.type === 'mixed') {
        const bracket = fresh.state.playoff?.bracket;
        if (!bracket) return;
        let syncedAny = false;
        const checkMatch = (match, label) => {
          if (!match?.linkedScoreId) return;
          const sb = ScoreStorage.getByLinkedId(match.linkedScoreId);
          if (!sb) return;
          const phase = sb.state?.phase;
          if (phase !== 'finished' && phase !== 'extra_draw' && phase !== 'penalties') return;
          const scores = this._getFinalScore(sb);
          const hasChanged = !match._synced || match.scoreA !== scores.scoreA || match.scoreB !== scores.scoreB;
          if (hasChanged) console.log(`[POLL:${label}] CHANGED`, { from: { a: match.scoreA, b: match.scoreB, synced: match._synced }, to: { a: scores.scoreA, b: scores.scoreB } });
          match.scoreA = scores.scoreA;
          match.scoreB = scores.scoreB;
          if (scores.penaltyA != null) match.penaltyA = scores.penaltyA;
          if (scores.penaltyB != null) match.penaltyB = scores.penaltyB;
          if (scores.extraScoreA != null) match.extraScoreA = scores.extraScoreA;
          if (scores.extraScoreB != null) match.extraScoreB = scores.extraScoreB;
          if (scores.wasDecidedByPenalties) match.wasDecidedByPenalties = scores.wasDecidedByPenalties;
          if (scores.resultType) match.resultType = scores.resultType;
          let winner = null, loser = null;
          if (scores.penaltyA != null && scores.penaltyB != null && scores.penaltyA !== scores.penaltyB) {
            winner = scores.penaltyA > scores.penaltyB ? sb.teamA : sb.teamB;
            loser = scores.penaltyA > scores.penaltyB ? sb.teamB : sb.teamA;
          } else if (scores.scoreA > scores.scoreB) {
            winner = sb.teamA; loser = sb.teamB;
          } else if (scores.scoreB > scores.scoreA) {
            winner = sb.teamB; loser = sb.teamA;
          }
          match.winner = winner;
          match.loser = loser;
          match.isFinished = true;
          match._synced = true;
          if (hasChanged) { syncedAny = true; hasChanges = true; }
        };
        if (bracket?.rounds) {
          for (let ri = 0; ri < bracket.rounds.length; ri++) {
            for (const match of bracket.rounds[ri].matches) checkMatch(match, 'round');
          }
        }
        checkMatch(bracket.finalMatch, 'POLL-FINAL');
        checkMatch(bracket.thirdPlaceMatch, 'POLL-THIRD');

        if (bracket.finalMatch?.isFinished && bracket.finalMatch.loser && !bracket.thirdPlaceTeam) {
          bracket.thirdPlaceTeam = bracket.finalMatch.loser;
          hasChanges = true;
        }
        if (bracket.thirdPlaceMatch?.isFinished && bracket.thirdPlaceMatch.winner && !bracket.thirdPlaceTeam) {
          bracket.thirdPlaceTeam = bracket.thirdPlaceMatch.winner;
          hasChanges = true;
        }
      }
      const rrPlayoffPoll = fresh.state.playoff?.roundRobin;
      if (rrPlayoffPoll?.matches) {
        for (const match of rrPlayoffPoll.matches) {
          if (!match.linkedScoreId) continue;
          const sb = ScoreStorage.getByLinkedId(match.linkedScoreId);
          if (!sb) continue;
          const phase = sb.state?.phase;
          if (phase !== 'finished' && phase !== 'extra_draw' && phase !== 'penalties') continue;
          const scores = this._getFinalScore(sb);
          const hasChanged = !match._synced || match.scoreA !== scores.scoreA || match.scoreB !== scores.scoreB;
          match.scoreA = scores.scoreA;
          match.scoreB = scores.scoreB;
          if (scores.penaltyA != null) match.penaltyA = scores.penaltyA;
          if (scores.penaltyB != null) match.penaltyB = scores.penaltyB;
          if (scores.wasDecidedByPenalties) match.wasDecidedByPenalties = scores.wasDecidedByPenalties;
          if (scores.resultType) match.resultType = scores.resultType;
          if (scores.scoreA > scores.scoreB) { match.winner = sb.teamA; match.loser = sb.teamB; }
          else if (scores.scoreB > scores.scoreA) { match.winner = sb.teamB; match.loser = sb.teamA; }
          else { match.winner = null; match.loser = null; }
          match.isPlayed = true;
          match._synced = true;
          if (hasChanged) hasChanges = true;
        }
      }

      if (hasChanges) {
        this.persist(fresh);
        const activeEl = document.activeElement;
        const isEditing = activeEl && activeEl.classList && activeEl.classList.contains('score-input');
        console.log('[POLL] hasChanges=true, isEditing=' + isEditing + ', type=' + fresh.type);
        if (!isEditing) {
          if (fresh.type === 'round-robin') this.renderRoundRobin(fresh);
          else if (fresh.type === 'mixed') this.renderMixed(fresh);
          else this.renderOlympic(fresh);
        }
      }
    }, 2000);
  },

  stopScorePolling() {
    if (this._scorePollInterval) {
      clearInterval(this._scorePollInterval);
      this._scorePollInterval = null;
    }
    this._currentTournament = null;
  },

  _checkScoreboardUpdates() {
    if (this._currentScoreboardId) return;
    // Если пользователь на странице табло — не синхронизируем
    if (location.hash.startsWith('#/score/s/')) return;
    if (!this.currentId) return;
    const t = TournamentStorage.get(this.currentId);
    if (!t || !t.state.generated) return;

    let hasChanges = false;

    if (t.type === 'round-robin') {
      const matches = t.state.matches || [];
      for (const m of matches) {
        if (!m.linkedScoreId) continue;
        const sb = ScoreStorage.getByLinkedId(m.linkedScoreId);
        if (sb && sb.state?.phase === 'finished') {
          const scores = this._getFinalScore(sb);
          const hasChanged = !m._synced || m.scoreA !== scores.scoreA || m.scoreB !== scores.scoreB;
          m.scoreA = scores.scoreA;
          m.scoreB = scores.scoreB;
          if (scores.penaltyA != null) m.penaltyA = scores.penaltyA;
          if (scores.penaltyB != null) m.penaltyB = scores.penaltyB;
          if (scores.wasDecidedByPenalties) m.wasDecidedByPenalties = scores.wasDecidedByPenalties;
          if (scores.resultType) m.resultType = scores.resultType;
          m.isPlayed = true;
          if (scores.scoreA > scores.scoreB) m.winner = sb.teamA;
          else if (scores.scoreB > scores.scoreA) m.winner = sb.teamB;
          else m.winner = null;
          m._synced = true;
          if (hasChanged) hasChanges = true;
        }
      }
    } else if (t.type === 'olympic') {
      const bracket = t.state.bracket;
      const checkMatch = (match) => {
        if (!match?.linkedScoreId) return;
        const sb = ScoreStorage.getByLinkedId(match.linkedScoreId);
        if (sb && sb.state?.phase === 'finished') {
          const scores = this._getFinalScore(sb);
          const hasChanged = !match._synced || match.scoreA !== scores.scoreA || match.scoreB !== scores.scoreB;
          match.scoreA = scores.scoreA;
          match.scoreB = scores.scoreB;
          if (scores.penaltyA != null) match.penaltyA = scores.penaltyA;
          if (scores.penaltyB != null) match.penaltyB = scores.penaltyB;
          if (scores.wasDecidedByPenalties) match.wasDecidedByPenalties = scores.wasDecidedByPenalties;
          if (scores.resultType) match.resultType = scores.resultType;
          if (scores.scoreA > scores.scoreB) { match.winner = sb.teamA; match.loser = sb.teamB; }
          else if (scores.scoreB > scores.scoreA) { match.winner = sb.teamB; match.loser = sb.teamA; }
          else { match.winner = null; match.loser = null; }
          match.isFinished = true;
          match._synced = true;
          if (hasChanged) hasChanges = true;
        }
      };
      if (bracket?.rounds) {
        for (const round of bracket.rounds) {
          for (const match of round.matches) checkMatch(match);
        }
      }
      checkMatch(bracket.finalMatch);
      checkMatch(bracket.thirdPlaceMatch);

      if (bracket.finalMatch?.isFinished && bracket.finalMatch.loser && !bracket.thirdPlaceTeam) {
        bracket.thirdPlaceTeam = bracket.finalMatch.loser; hasChanges = true;
      }
      if (bracket.thirdPlaceMatch?.isFinished && bracket.thirdPlaceMatch.winner && !bracket.thirdPlaceTeam) {
        bracket.thirdPlaceTeam = bracket.thirdPlaceMatch.winner; hasChanges = true;
      }
    } else if (t.type === 'mixed') {
      const bracket = t.state.playoff?.bracket;
      if (bracket) {
        const checkMatch = (match, label) => {
          if (!match?.linkedScoreId) return;
          const sb = ScoreStorage.getByLinkedId(match.linkedScoreId);
          if (sb && sb.state?.phase === 'finished') {
            const scores = this._getFinalScore(sb);
            const hasChanged = !match._synced || match.scoreA !== scores.scoreA || match.scoreB !== scores.scoreB;
            if (hasChanged) console.log(`[CHECK:${label}] CHANGED`, { from: { a: match.scoreA, b: match.scoreB, synced: match._synced }, to: { a: scores.scoreA, b: scores.scoreB } });
            match.scoreA = scores.scoreA;
            match.scoreB = scores.scoreB;
            if (scores.penaltyA != null) match.penaltyA = scores.penaltyA;
            if (scores.penaltyB != null) match.penaltyB = scores.penaltyB;
            if (scores.wasDecidedByPenalties) match.wasDecidedByPenalties = scores.wasDecidedByPenalties;
            if (scores.resultType) match.resultType = scores.resultType;
            if (scores.scoreA > scores.scoreB) { match.winner = sb.teamA; match.loser = sb.teamB; }
            else if (scores.scoreB > scores.scoreA) { match.winner = sb.teamB; match.loser = sb.teamA; }
            else { match.winner = null; match.loser = null; }
            match.isFinished = true;
            match._synced = true;
            if (hasChanged) hasChanges = true;
          }
        };
        if (bracket.rounds) {
          for (const round of bracket.rounds) {
            for (const match of round.matches) checkMatch(match, 'round');
          }
        }
        checkMatch(bracket.finalMatch, 'CHECK-FINAL');
        checkMatch(bracket.thirdPlaceMatch, 'CHECK-THIRD');

        if (bracket.finalMatch?.isFinished && bracket.finalMatch.loser && !bracket.thirdPlaceTeam) {
          bracket.thirdPlaceTeam = bracket.finalMatch.loser; hasChanges = true;
        }
        if (bracket.thirdPlaceMatch?.isFinished && bracket.thirdPlaceMatch.winner && !bracket.thirdPlaceTeam) {
          bracket.thirdPlaceTeam = bracket.thirdPlaceMatch.winner; hasChanges = true;
        }
      }
      const rrPlayoff = t.state.playoff?.roundRobin;
      if (rrPlayoff?.matches) {
        for (const match of rrPlayoff.matches) {
          if (!match.linkedScoreId) continue;
          const sb = ScoreStorage.getByLinkedId(match.linkedScoreId);
          if (sb && sb.state?.phase === 'finished') {
            const scores = this._getFinalScore(sb);
            const hasChanged = !match._synced || match.scoreA !== scores.scoreA || match.scoreB !== scores.scoreB;
            match.scoreA = scores.scoreA;
            match.scoreB = scores.scoreB;
            if (scores.penaltyA != null) match.penaltyA = scores.penaltyA;
            if (scores.penaltyB != null) match.penaltyB = scores.penaltyB;
            if (scores.wasDecidedByPenalties) match.wasDecidedByPenalties = scores.wasDecidedByPenalties;
            if (scores.resultType) match.resultType = scores.resultType;
            if (scores.scoreA > scores.scoreB) { match.winner = sb.teamA; match.loser = sb.teamB; }
            else if (scores.scoreB > scores.scoreA) { match.winner = sb.teamB; match.loser = sb.teamA; }
            else { match.winner = null; match.loser = null; }
            match.isPlayed = true;
            match._synced = true;
            if (hasChanged) hasChanges = true;
          }
        }
      }
    }

    if (hasChanges) {
      this.persist(t);
      const activeEl = document.activeElement;
      const isEditing = activeEl && activeEl.classList && activeEl.classList.contains('score-input');
      if (!isEditing) {
        if (t.type === 'round-robin') this.renderRoundRobin(t);
        else if (t.type === 'mixed') this.renderMixed(t);
        else this.renderOlympic(t);
      }
    }
  },

  showScoreChoiceModal(teamA, teamB, callback) {
    const existing = document.getElementById('score-choice-modal');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'score-choice-modal';
    overlay.className = 'score-choice-overlay';
    overlay.innerHTML = `
      <div class="score-choice-panel">
        <h3>Внести результат матча</h3>
        <p class="score-choice-teams">${this._esc(teamA)} — ${this._esc(teamB)}</p>
        <div class="score-choice-buttons">
          <button type="button" class="btn btn-ghost score-choice-btn" data-method="manual">Вписать вручную</button>
          <button type="button" class="btn btn-success score-choice-btn" data-method="scoreboard">⚽ Вести счёт</button>
        </div>
        <button type="button" class="btn btn-ghost score-choice-close" data-close>Отмена</button>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target.dataset.close) overlay.remove();
      else if (e.target.dataset.method) { overlay.remove(); callback(e.target.dataset.method); }
    });
    document.body.appendChild(overlay);
  },

  renderScorePicker() {
    this.currentId = null;
    ScoreboardApp.renderSportPicker(this.root);
  },

  openScoreboard(id) {
    const s = ScoreStorage.get(id);
    if (!s) { location.hash = '#/score'; return; }
    this.currentId = id;
    this._currentScoreboardId = id;
    try { ScoreboardApp.renderSession(this.root, s); }
    catch (err) { this.renderScorePicker(); }
  }
};

window.ScoreSync = ScoreSync;

