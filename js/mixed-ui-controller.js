const MixedUIController = {
  _showSystemPickerModal() {
    const existing = document.getElementById('mixed-system-picker');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'mixed-system-picker';
    overlay.className = 'system-picker-overlay';
    overlay.innerHTML = `
      <div class="system-picker-panel">
        <h3>Выберите систему смешанного турнира</h3>
        <p class="system-picker-hint">Каждая система комбинирует групповой этап и плей-офф</p>
        <div class="system-picker-grid">
          ${MIXED_SYSTEMS.map(sys => `
            <div class="system-picker-card" data-system="${sys.id}">
              <h4>${sys.label}</h4>
              <p class="muted-desc">${sys.desc}</p>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-ghost system-picker-close">Отмена</button>
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      const card = e.target.closest('[data-system]');
      if (card) {
        const systemId = card.dataset.system;
        document.body.removeChild(overlay);
        this._createMixedTournament(systemId);
      } else if (e.target.classList.contains('system-picker-close')) {
        document.body.removeChild(overlay);
      } else if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    document.body.appendChild(overlay);
  },

  _createMixedTournament(systemId) {
    const t = TournamentStorage.create('mixed', systemId);
    this.renderMixed(t);
  },

  _enterPlayoffPhase(t) {
    if (!t.state.generated || !t.state.roundRobin?.generated) {
      alert('Сначала завершите групповой этап!');
      return;
    }

    const config = MIXED_SYSTEM_CONFIGS[t.meta.systemId];
    if (!config) {
      alert('Неизвестная система: ' + t.meta.systemId);
      return;
    }

    const allPlayed = t.state.roundRobin.matches.every(m => m.isPlayed);
    if (!allPlayed) {
      if (!confirm('Не все матчи группового этапа сыграны. Продолжить?')) {
        return;
      }
    }

    const groupCount = config.groups || 1;
    let standings;
    
    if (groupCount > 1) {
      standings = this._calculateGroupedStandings(t, groupCount);
    } else {
      standings = RoundRobinEngine.calculateStandings(
        t.state.teams,
        t.state.roundRobin.matches,
        t.meta?.sport
      );
    }

    if (config.playoffType === 'round-robin') {
      const qualified = [];
      if (groupCount > 1) {
        standings.forEach(groupSt => {
          groupSt.slice(0, config.advanceCount || 2).forEach(s => qualified.push(s.name));
        });
      } else {
        standings.slice(0, config.advanceCount || 4).forEach(s => qualified.push(s.name));
      }

      const matches = RoundRobinEngine.generateMatches(qualified, { random: true });
      matches.forEach(m => { m.group = 0; });

      t.state.phase = 'playoff';
      t.state.playoff = {
        type: 'round-robin',
        roundRobin: {
          teams: qualified,
          matches,
          generated: true
        },
        seededFrom: groupCount > 1 ? standings.map(g => g.map(s => s.name)) : standings.map(s => s.name),
        startedAt: new Date().toISOString()
      };
    } else {
      const pairs = MixedEngine.seedFromStandings(standings, config);
      const bracket = OlympicEngine.createBracketFromPairs(pairs);

      t.state.phase = 'playoff';
      t.state.playoff = {
        bracket,
        seededFrom: groupCount > 1 ? standings.map(g => g.map(s => s.name)) : standings.map(s => s.name),
        startedAt: new Date().toISOString()
      };
    }

    t.state.generated = true;
    this.persist(t);
    this.renderMixed(t);
  },

  _calculateGroupedStandings(t, groupCount) {
    const groups = t.state.roundRobin.groups;
    const allStandings = [];
    
    groups.forEach((groupTeams, groupIdx) => {
      const groupMatches = t.state.roundRobin.matches.filter(m => m.group === groupIdx);
      const standings = RoundRobinEngine.calculateStandings(groupTeams, groupMatches, t.meta?.sport);
      allStandings.push(standings);
    });
    
    return allStandings;
  },

  _startMixed(t, randomDraw) {
    const config = MIXED_SYSTEM_CONFIGS[t.meta.systemId];
    const groupCount = config.groups || 1;

    if (groupCount > 1) {
      const allTeams = [];
      const groups = [];
      
      for (let g = 0; g < groupCount; g++) {
        const grp = t.state.groups[g] || {};
        const teamNames = grp.teams || [];
        const validNames = teamNames.filter(name => name && name.trim());
        
        if (validNames.length < 2) {
          const groupName = this._getGroupName(g);
          alert('В группе ' + groupName + ' нужно заполнить названия минимум для 2 команд');
          return;
        }
        
        if (new Set(validNames).size !== validNames.length) {
          alert('Названия команд в группе ' + groupName + ' должны быть уникальными');
          return;
        }
        
        groups.push(validNames);
        allTeams.push(...validNames);
      }

      const allSet = new Set(allTeams);
      if (allSet.size !== allTeams.length) {
        alert('Названия команд должны быть уникальными во всех группах');
        return;
      }

      t.state.teams = allTeams;

      const allMatches = [];
      groups.forEach((groupTeams, groupIdx) => {
        const groupMatches = RoundRobinEngine.generateMatches(groupTeams, { random: randomDraw });
        groupMatches.forEach(m => {
          m.group = groupIdx;
          m.groupName = this._getGroupName(groupIdx);
          allMatches.push(m);
        });
      });

      t.state.roundRobin.matches = allMatches;
      t.state.roundRobin.groups = groups;
      t.state.roundRobin.groupNames = groups.map((_, i) => this._getGroupName(i));
    } else {
      const teams = this._collectTeamNames(t.meta.numTeams);
      if (teams.some((x) => !x)) {
        alert('Заполните все названия команд');
        return;
      }
      if (new Set(teams).size !== teams.length) {
        alert('Названия команд должны быть уникальными');
        return;
      }
      const effectiveTeams = teams.slice(0, config ? config.maxTeams : teams.length);
      t.state.teams = effectiveTeams;
      t.state.roundRobin.matches = RoundRobinEngine.generateMatches(effectiveTeams, { random: randomDraw });
      t.state.roundRobin.matches.forEach(m => { m.group = 0; });
      t.state.roundRobin.groups = [effectiveTeams];
      t.state.roundRobin.groupNames = ['A'];
    }
    t.state.roundRobin.generated = true;
    t.state.generated = true;
    this.persist(t);
    this.renderMixed(t);
  },

  _splitTeamsIntoGroups(teams, groupCount) {
    const groups = Array.from({ length: groupCount }, () => []);
    teams.forEach((team, i) => {
      groups[i % groupCount].push(team);
    });
    return groups;
  },

  _getGroupName(groupIdx) {
    return String.fromCharCode(65 + groupIdx);
  },

  renderMixed(t) {
    this.stopScorePolling();
    let phase = t.state.phase || 'group';
    if (phase === 'roundRobin') phase = 'group';
    const config = MIXED_SYSTEM_CONFIGS[t.meta.systemId] || {};

    if (phase === 'playoff') {
     if (t.state.playoff?.type === 'round-robin') {
       this._renderMixedRoundRobinPlayoff(t);
     } else {
       this._renderMixedPlayoff(t);
     }
     return;
   }

    const standings = t.state.roundRobin?.generated
      ? RoundRobinEngine.calculateStandings(t.state.teams, t.state.roundRobin.matches, t.meta?.sport)
      : [];

   const allPlayed = t.state.roundRobin?.matches?.every(m => m.isPlayed) ?? false;
   const scrollY = window.scrollY;

   const exportBtn = t.state.roundRobin?.generated
     ? '<button type="button" class="btn btn-warning" data-export-xlsx>Выгрузить .xlsx</button>'
     : '';

   const canEnterPlayoff = t.state.roundRobin?.generated && allPlayed;

   const hasGroups = config.groups > 1;
   if (hasGroups) {
     this.root.innerHTML = MixedUI.generateGroupStage(t);
   } else {
     this.root.innerHTML = `
       <div class="app-shell">
         ${this._pageHeader('Смешанный турнир: групповой этап', exportBtn)}
         <section class="glass">
           ${this._metaForm(t)}
           <div class="system-info-banner">
             <strong>Система:</strong> ${config.title || t.meta.systemId}
           </div>
         </section>
         <div id="mixed-workspace"></div>
       </div>
     `;
   }

   if (hasGroups && !t.state.roundRobin?.generated) {
     MixedUI.bindGroupConfig(t);
   }

   this._bindMeta(t, () => {
     if (!t.state.generated && !hasGroups) this._renderTeamInputs(t);
     this.renderMixed(t);
   });
   if (!t.state.generated && !hasGroups) this._renderTeamInputs(t);

   document.getElementById('btn-generate')?.addEventListener('click', () => {
     this._startMixed(t, true);
   });
   document.getElementById('btn-generate-sequential')?.addEventListener('click', () => {
     this._startMixed(t, false);
   });

    const ws = document.getElementById('mixed-workspace');
    if (!t.state.roundRobin?.generated) return;

    const groupCount = config.groups || 1;
    
    let groupSectionsHtml = '';
    
    if (groupCount > 1 && t.state.roundRobin?.generated) {
      const groupedStandings = this._calculateGroupedStandings(t, groupCount);
      for (let idx = 0; idx < groupCount; idx++) {
        const groupName = t.state.roundRobin?.groupNames?.[idx] || String.fromCharCode(65 + idx);
        const groupTeams = t.state.roundRobin.groups[idx] || [];
        const groupMatches = t.state.roundRobin.matches.filter(m => m.group === idx);
        const groupSt = groupedStandings[idx] || [];
        
        groupSectionsHtml += `
          <section class="glass group-block" id="group-section-${idx}">
            <h2 class="section-title">Группа ${this._esc(groupName)}</h2>
            <h3 class="section-subtitle">Результаты матчей</h3>
            <div class="matches-list" data-group-matches="${idx}"></div>
            <h3 class="section-subtitle" style="margin-top:1.5rem;">Турнирная таблица</h3>
            <div class="group-standings" id="standings-group-${this._esc(groupName)}">${this._rrStandingsBlock(groupTeams, groupMatches, groupSt, t.meta?.sport)}</div>
          </section>
        `;
      }
    } else if (t.state.roundRobin?.generated) {
      groupSectionsHtml = `
        <section class="glass group-block" id="group-section-0">
          <h2 class="section-title">Группа A</h2>
          <h3 class="section-subtitle">Результаты матчей</h3>
          <div class="matches-list" data-group-matches="0"></div>
          <h3 class="section-subtitle" style="margin-top:1.5rem;">Турнирная таблица</h3>
          <div class="group-standings">${this._rrStandingsBlock(t.state.teams, t.state.roundRobin.matches, standings, t.meta?.sport)}</div>
        </section>
      `;
    }

    ws.innerHTML = `
      ${groupSectionsHtml}
      <div class="playoff-entry-banner" id="playoff-entry-block">
        <button type="button" class="btn btn-success btn-lg" data-enter-playoff disabled>🏆 Перейти к плей-офф</button>
        <p class="muted-desc" id="playoff-entry-desc">Все матчи группового этапа должны быть завершены для перехода к плей-офф.</p>
      </div>
    `;

    this._initResponsiveStandings();
    MixedUI.bindGroupMatchInputs(t);
    this._bindExportButtons(t, () => {
      const fresh = TournamentStorage.get(t.id);
      if (!fresh) return;
      const st = RoundRobinEngine.calculateStandings(fresh.state.teams, fresh.state.roundRobin.matches, fresh.meta?.sport);
      RoundRobinEngine.exportXlsx(fresh.meta, fresh.state.teams, fresh.state.roundRobin.matches, st, fresh.meta?.sport);
    });

    this.root.querySelector('[data-back-to-group]')?.addEventListener('click', () => {
      t.state.phase = 'group';
      this.persist(t);
      this.renderMixed(t);
    });

    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-enter-playoff]');
      if (btn && !btn.disabled) {
        const freshT = TournamentStorage.get(t.id);
        if (freshT) {
          this._enterPlayoffPhase(freshT);
        }
      }
    });

    this.startScorePolling(t);
    requestAnimationFrame(() => { window.scrollTo(0, scrollY); });
  },

  _renderMixedPlayoff(t) {
    const fresh = TournamentStorage.get(t.id);
    if (!fresh) { console.error('Tournament not found'); return; }
    const fmBefore = fresh.state.playoff?.bracket?.finalMatch;
    if (fmBefore) console.log('[RENDER-FINAL] BEFORE sync', { a: fmBefore.scoreA, b: fmBefore.scoreB, synced: fmBefore._synced, finished: fmBefore.isFinished });
    this._syncPlayoffBracketWithScoreboard(fresh);
    const fmAfter = fresh.state.playoff?.bracket?.finalMatch;
    if (fmAfter) console.log('[RENDER-FINAL] AFTER sync', { a: fmAfter.scoreA, b: fmAfter.scoreB, synced: fmAfter._synced, finished: fmAfter.isFinished });
    t = fresh;

    const playoff = t.state.playoff;
    if (!playoff || !playoff.bracket) {
      console.error('Playoff bracket not found');
      return;
    }

    const bracket = playoff.bracket;
    const config = MIXED_SYSTEM_CONFIGS[t.meta.systemId] || {};
    const scrollY = window.scrollY;

    const exportBtn = '<button type="button" class="btn btn-warning" data-export-xlsx>Выгрузить .xlsx</button>';
    const publishBtn = `<button type="button" class="btn btn-success" data-publish-online>Транслировать онлайн</button>
      <button type="button" class="btn btn-sm btn-ghost" data-auto-publish-toggle>Авто-трансляция: ВЫКЛ</button>
      <label class="auto-publish-interval-label">сек: <input type="number" class="auto-publish-interval" data-auto-publish-interval min="2" max="60" value="5"></label>`;

    this.root.innerHTML = `
      <div class="app-shell">
        ${this._pageHeader('Смешанный турнир: плей-офф', exportBtn + publishBtn)}
        <section class="glass">
          <div class="system-info-banner">
            <strong>Групповой этап:</strong> завершён · <strong>Система:</strong> ${config.title || t.meta.systemId}
          </div>
          <div class="toolbar" style="margin-top: 1rem;">
            <button type="button" class="btn btn-ghost" data-back-to-group>← Назад к таблице</button>
          </div>
        </section>
        <div id="mixed-playoff-workspace"></div>
      </div>
    `;

    const ws = document.getElementById('mixed-playoff-workspace');
    if (!ws) return;

    ws.innerHTML = `
      <section class="glass">
        <h2 class="section-title">Сетка плей-офф</h2>
        <div class="bracket-layout" id="bracket-root" data-tournament-id="${t.id}"></div>
        <div id="oly-results"></div>
        <div class="toolbar">
          <button type="button" class="btn btn-warning" data-export-xlsx>Выгрузить .xlsx</button>
        </div>
      </section>
      <section class="glass">
        <h2 class="section-title">Итоги группового этапа</h2>
        <div id="group-standings">
          ${this._groupedStandingsHtmlForPlayoff(t)}
        </div>
      </section>
    `;

    MixedUI.bindPlayoffBracket(t);

    this._bindExportButtons(t, () => {
      const fresh2 = TournamentStorage.get(t.id);
      if (!fresh2) return;
      const groupSt = RoundRobinEngine.calculateStandings(fresh2.state.teams, fresh2.state.roundRobin?.matches || [], fresh2.meta?.sport);
      OlympicEngine.exportXlsx(fresh2.meta, fresh2.state.matchHistory || [], fresh2.state.playoff.bracket, groupSt);
    });

    App._bindPublishButtons(t, () => {
      const fresh3 = TournamentStorage.get(t.id);
      if (!fresh3) return;
      const html = this.root.querySelector('.app-shell')?.outerHTML || '';
      App._publishOnline(fresh3, html);
    });

    App.bindAutoPublish(t, () => {
      const fresh3 = TournamentStorage.get(t.id);
      if (!fresh3) return '';
      return this.root.querySelector('.app-shell')?.outerHTML || '';
    });

    this.root.querySelector('[data-back-to-group]')?.addEventListener('click', () => {
      t.state.phase = 'group';
      this.persist(t);
      this.renderMixed(t);
    });

    this.startScorePolling(t);
    requestAnimationFrame(() => { window.scrollTo(0, scrollY); });
  },

  _renderMixedRoundRobinPlayoff(t) {
    const fresh = TournamentStorage.get(t.id);
    if (!fresh) return;
    t = fresh;

    const playoff = t.state.playoff;
    if (!playoff || !playoff.roundRobin) return;

    const config = MIXED_SYSTEM_CONFIGS[t.meta.systemId] || {};
    const rr = playoff.roundRobin;
    const standings = RoundRobinEngine.calculateStandings(rr.teams, rr.matches, t.meta?.sport);
    const scrollY = window.scrollY;

    const exportBtn = '<button type="button" class="btn btn-warning" data-export-xlsx>Выгрузить .xlsx</button>';

    this.root.innerHTML = `
      <div class="app-shell">
        ${this._pageHeader('Смешанный турнир: финальный раунд', exportBtn)}
        <section class="glass">
          <div class="system-info-banner">
            <strong>Групповой этап:</strong> завершён · <strong>Система:</strong> ${config.title || t.meta.systemId}
          </div>
          <div class="toolbar" style="margin-top: 1rem;">
            <button type="button" class="btn btn-ghost" data-back-to-group>← Назад к таблице</button>
          </div>
        </section>
        <div id="mixed-playoff-workspace"></div>
      </div>
    `;

    const ws = document.getElementById('mixed-playoff-workspace');
    if (!ws) return;

    ws.innerHTML = `
      <section class="glass">
        <h2 class="section-title">Финальный раунд (круговая система)</h2>
        <div id="rr-playoff-matches"></div>
        <h3 class="section-subtitle" style="margin-top:1.5rem;">Итоговая таблица</h3>
        <div id="rr-playoff-standings"></div>
      </section>
      <section class="glass">
        <h2 class="section-title">Итоги группового этапа</h2>
        <div id="group-standings">
          ${this._groupedStandingsHtmlForPlayoff(t)}
        </div>
      </section>
    `;

    const matchesDiv = document.getElementById('rr-playoff-matches');
    if (matchesDiv) {
      const hasScoreboard = t.meta?.sport === 'футбол' || t.meta?.sport === 'хоккей' || t.meta?.sport === 'баскетбол' || t.meta?.sport === 'стритбол' || t.meta?.sport === 'волейбол';
      const sportEmoji = t.meta?.sport === 'хоккей' ? '🏒' : (t.meta?.sport === 'волейбол' ? '🏐' : (t.meta?.sport === 'баскетбол' || t.meta?.sport === 'стритбол' ? '🏀' : '⚽'));
      matchesDiv.innerHTML = this._rrMatchesBlockHtml(rr.teams, rr.matches, 'rr-playoff', hasScoreboard, sportEmoji);
    }

    const standingsDiv = document.getElementById('rr-playoff-standings');
    if (standingsDiv) {
      standingsDiv.innerHTML = this._rrStandingsBlock(rr.teams, rr.matches, standings, t.meta?.sport);
    }

    this.root.querySelector('[data-back-to-group]')?.addEventListener('click', () => {
      t.state.phase = 'group';
      this.persist(t);
      this.renderMixed(t);
    });

    const matchesContainer = matchesDiv;
    if (matchesContainer) {
      matchesContainer.addEventListener('input', (e) => {
        const inp = e.target;
        if (!inp.classList.contains('score-input')) return;
        const idx = parseInt(inp.dataset.matchIdx, 10);
        if (isNaN(idx)) return;
        const m = rr.matches[idx];
        if (!m) return;
        if (inp.classList.contains('sc-a')) m.scoreA = inp.value === '' ? null : parseInt(inp.value, 10);
        else if (inp.classList.contains('sc-b')) m.scoreB = inp.value === '' ? null : parseInt(inp.value, 10);
      });

      matchesContainer.addEventListener('click', (e) => {
        const rrMatchBtn = e.target.closest('[data-rr-match-btn]');
        if (rrMatchBtn) {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(rrMatchBtn.dataset.rrMatchBtn, 10);
          const m = rr.matches[idx];
          if (!m) return;
          if (typeof App === 'undefined') return;
          const teamA = rr.teams[m.teamA];
          const teamB = rr.teams[m.teamB];
          const freshT = TournamentStorage.get(t.id);
          if (!freshT) { alert('Турнир не найден. Обновите страницу.'); return; }
          const freshM = freshT.state.playoff.roundRobin.matches[idx];
          if (!freshM) { alert('Матч не найден. Обновите страницу.'); return; }
          if (freshM.linkedScoreId) {
            const existingSb = ScoreStorage.getByLinkedId(freshM.linkedScoreId);
            if (existingSb) {
              if (existingSb.state?.phase === 'finished') {
                const scores = ScoreSync._getFinalScore(existingSb);
                const hasChanged = !freshM._synced || freshM.scoreA !== scores.scoreA || freshM.scoreB !== scores.scoreB;
                freshM.scoreA = scores.scoreA;
                freshM.scoreB = scores.scoreB;
                if (scores.penaltyA != null) freshM.penaltyA = scores.penaltyA;
                if (scores.penaltyB != null) freshM.penaltyB = scores.penaltyB;
                if (scores.wasDecidedByPenalties) freshM.wasDecidedByPenalties = scores.wasDecidedByPenalties;
                if (scores.resultType) freshM.resultType = scores.resultType;
                freshM.isPlayed = true;
                freshM.winner = scores.scoreA > scores.scoreB ? existingSb.teamA : (scores.scoreB > scores.scoreA ? existingSb.teamB : null);
                freshM._synced = true;
                const savedSbId = existingSb.id;
                setTimeout(() => { location.hash = '#/score/s/' + savedSbId; }, 50);
                if (hasChanged) {
                  TournamentStorage.save(freshT);
                  setTimeout(() => { this._renderMixedRoundRobinPlayoff(freshT); }, 100);
                }
                return;
              }
              window.location.hash = '#/score/s/' + existingSb.id;
              return;
            }
            freshM.linkedScoreId = null;
            TournamentStorage.save(freshT);
            this._renderMixedRoundRobinPlayoff(freshT);
            return;
          }
          const linkedScoreId = 'ls_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
          freshM.linkedScoreId = linkedScoreId;
          const _sm = { 'волейбол': 'volleyball', 'баскетбол': 'basketball', 'хоккей': 'hockey', 'стритбол': 'streetball' };
          const sport = _sm[freshT.meta?.sport] || 'football';
          const session = ScoreStorage.create(sport);
          session.teamA = teamA;
          session.teamB = teamB;
          session.tournamentId = freshT.id;
          session.matchIndex = idx;
          session.isFinalRound = true;
          session.linkedScoreId = linkedScoreId;
          session.updatedAt = new Date().toISOString();
          ScoreStorage.save(session);
          TournamentStorage.save(freshT);
          if (session) {
            setTimeout(() => { window.location.hash = '#/score/s/' + session.id; }, 50);
          }
          return;
        }

        const btn = e.target.closest('[data-confirm-rr]');
        if (!btn) return;
        const idx = parseInt(btn.dataset.confirmRr, 10);
        const m = rr.matches[idx];
        if (!m || m.isPlayed) return;
        if (m.scoreA == null || m.scoreB == null) return;
        m.isPlayed = true;
        if (m.scoreA > m.scoreB) { m.winner = rr.teams[m.teamA]; m.loser = rr.teams[m.teamB]; }
        else if (m.scoreB > m.scoreA) { m.winner = rr.teams[m.teamB]; m.loser = rr.teams[m.teamA]; }
        else { m.winner = null; m.loser = null; }
        this.persist(fresh);

        const scrollY = window.scrollY;

        // Обновляем строку матча инлайн
        const matchDiv = matchesContainer.querySelector(`.playoff-match[data-rr-idx="${idx}"]`);
        if (matchDiv) {
          matchDiv.classList.add('finished');
          matchDiv.querySelectorAll('input.score-input').forEach(inp => { inp.disabled = true; });
          const confirmBtn = matchDiv.querySelector('[data-confirm-rr]');
          if (confirmBtn) confirmBtn.style.display = 'none';
          const scoreEls = matchDiv.querySelectorAll('.team-score');
          if (scoreEls.length === 0) {
            matchDiv.querySelectorAll('.team-line').forEach((line, li) => {
              const teamIdx = li === 0 ? m.teamA : m.teamB;
              const score = li === 0 ? m.scoreA : m.scoreB;
              const inputs = line.querySelectorAll('input');
              inputs.forEach(inp => inp.remove());
              const span = document.createElement('span');
              span.className = 'team-score';
              span.textContent = score;
              line.appendChild(span);
            });
          }
        }

        // Обновляем таблицу
        const standingsDiv = document.getElementById('rr-playoff-standings');
        if (standingsDiv) {
          const newStandings = RoundRobinEngine.calculateStandings(rr.teams, rr.matches, t.meta?.sport);
          standingsDiv.innerHTML = this._rrStandingsBlock(rr.teams, rr.matches, newStandings, t.meta?.sport);
        }
        setTimeout(() => { window.scrollTo(0, scrollY); }, 0);
      });
    }

    this._bindExportButtons(t, () => {
      const fresh2 = TournamentStorage.get(t.id);
      if (!fresh2) return;
      const st = RoundRobinEngine.calculateStandings(rr.teams, rr.matches, fresh2.meta?.sport);
      RoundRobinEngine.exportXlsx(fresh2.meta, rr.teams, rr.matches, st, fresh2.meta?.sport);
    });

    App._bindPublishButtons(t, () => {
      const fresh3 = TournamentStorage.get(t.id);
      if (!fresh3) return;
      const html = this.root.querySelector('.app-shell')?.outerHTML || '';
      App._publishOnline(fresh3, html);
    });

    App.bindAutoPublish(t, () => {
      const fresh3 = TournamentStorage.get(t.id);
      if (!fresh3) return '';
      return this.root.querySelector('.app-shell')?.outerHTML || '';
    });

    requestAnimationFrame(() => { window.scrollTo(0, scrollY); });
  },

  _rrMatchesBlockHtml(teams, matches, prefix, hasScoreboard, sportEmoji) {
    let html = '<div class="matches-list">';
    matches.forEach((m, idx) => {
      const teamA = teams[m.teamA] || 'TBD';
      const teamB = teams[m.teamB] || 'TBD';
      const isDone = m.isPlayed;
      const scoreA = m.scoreA != null ? m.scoreA : '';
      const scoreB = m.scoreB != null ? m.scoreB : '';
      const hasLinked = !!m.linkedScoreId;
      const sbExists = hasLinked ? !!ScoreStorage.getByLinkedId(m.linkedScoreId) : false;
      html += '<div class="playoff-match' + (isDone ? ' finished' : '') + '" data-rr-idx="' + idx + '">';
      html += '<div class="team-line"><span class="team-name">' + this._esc(teamA) + '</span>';
      if (isDone) {
        html += '<span class="team-score">' + m.scoreA + '</span>';
      } else {
        html += '<input type="number" min="0" inputmode="numeric" class="sc-a score-input score-input--sm" value="' + scoreA + '" placeholder="0" data-match-idx="' + idx + '">';
      }
      html += '</div>';
      html += '<div class="team-line"><span class="team-name">' + this._esc(teamB) + '</span>';
      if (isDone) {
        html += '<span class="team-score">' + m.scoreB + '</span>';
      } else {
        html += '<input type="number" min="0" inputmode="numeric" class="sc-b score-input score-input--sm" value="' + scoreB + '" placeholder="0" data-match-idx="' + idx + '">';
      }
      html += '</div>';
      html += '<div class="playoff-match__actions">';
      if (hasScoreboard) {
        if (isDone && hasLinked) {
          html += '<button type="button" class="btn btn-sm btn-scoreboard-match btn-scoreboard-match--finished" data-rr-match-btn="' + idx + '" data-rr-linked="' + (sbExists ? '1' : '') + '">' + sportEmoji + ' Матч завершён</button>';
        } else if (!isDone) {
          html += '<button type="button" class="btn btn-sm btn-scoreboard-match" data-rr-match-btn="' + idx + '" data-rr-linked="' + (sbExists ? '1' : '') + '">' + (hasLinked && sbExists ? sportEmoji + ' Счёт' : sportEmoji + ' Вести счёт') + '</button>';
          html += '<button type="button" class="btn btn-sm btn-success playoff-confirm" data-confirm-rr="' + idx + '">Подтвердить</button>';
        }
      } else {
        if (!isDone) {
          html += '<button type="button" class="btn btn-sm btn-success playoff-confirm" data-confirm-rr="' + idx + '">Подтвердить</button>';
        }
      }
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  },

  _groupedStandingsHtmlForPlayoff(t) {
    const config = MIXED_SYSTEM_CONFIGS[t.meta.systemId] || {};
    const groupCount = config.groups || 1;

    if (groupCount <= 1 || !t.state.roundRobin?.generated) {
      const standings = RoundRobinEngine.calculateStandings(
        t.state.teams,
        t.state.roundRobin?.matches || [],
        t.meta?.sport
      );
      return this._rrStandingsBlock(t.state.teams, t.state.roundRobin?.matches || [], standings, t.meta?.sport);
    }

    const groupCountReal = t.state.roundRobin.groups?.length || groupCount;
    let html = '';

    for (let g = 0; g < groupCountReal; g++) {
      const groupTeams = t.state.roundRobin.groups[g] || [];
      const groupMatches = t.state.roundRobin.matches?.filter(m => m.group === g) || [];
      const groupName = t.state.roundRobin.groupNames?.[g] || String.fromCharCode(65 + g);

const isVolleyball = t.meta?.sport === 'волейбол';
      const standings = groupTeams.map((name, index) => ({
        name: name,
        index: index,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        place: 0
      }));

      groupMatches.forEach((match) => {
        if (!match.isPlayed || match.scoreA === null || match.scoreB === null) return;
        const teamA = standings[match.teamA];
        const teamB = standings[match.teamB];
        if (!teamA || !teamB) return;

        teamA.goalsFor += match.scoreA;
        teamA.goalsAgainst += match.scoreB;
        teamB.goalsFor += match.scoreB;
        teamB.goalsAgainst += match.scoreA;

        if (isVolleyball) {
          if (match.scoreA > match.scoreB) {
            teamA.wins += 1;
            teamB.losses += 1;
            if (match.scoreB <= 1) {
              teamA.points += 3;
            } else {
              teamA.points += 2;
              teamB.points += 1;
            }
          } else if (match.scoreB > match.scoreA) {
            teamB.wins += 1;
            teamA.losses += 1;
            if (match.scoreA <= 1) {
              teamB.points += 3;
            } else {
              teamB.points += 2;
              teamA.points += 1;
            }
          } else {
            teamA.draws += 1;
            teamB.draws += 1;
            teamA.points += 1;
            teamB.points += 1;
          }
        } else {
          if (match.scoreA > match.scoreB) {
            teamA.wins += 1;
            teamB.losses += 1;
            teamA.points += 3;
          } else if (match.scoreB > match.scoreA) {
            teamB.wins += 1;
            teamA.losses += 1;
            teamB.points += 3;
          } else {
            teamA.draws += 1;
            teamB.draws += 1;
            teamA.points += 1;
            teamB.points += 1;
          }
        }
      });

      const sorted = standings.slice().sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const gdA = a.goalsFor - a.goalsAgainst;
        const gdB = b.goalsFor - b.goalsAgainst;
        if (gdA !== gdB) return gdB - gdA;
        return b.goalsFor - a.goalsFor;
      });
      
      sorted.forEach((team, i) => team.place = i + 1);

      html += '<div class="group-standings-playoff"><h3 class="section-title">Группа ' + this._esc(groupName) + '</h3>';
      html += this._rrStandingsBlock(groupTeams, groupMatches, sorted, t.meta?.sport);
      html += '</div>';
    }

    return html;
  },
};

window.MixedUIController = MixedUIController;

