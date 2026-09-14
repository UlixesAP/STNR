const MixedUI = {

  _root: null,

  setRoot(root) {
    this._root = root;
  },

  get root() {
    return this._root || (typeof App !== 'undefined' && App.root);
  },

  generateGroupStage(t) {
    const config = MIXED_SYSTEM_CONFIGS[t.meta.systemId] || {};
    const isGenerated = t.state.roundRobin?.generated === true;
    const hasGroups = config.groups > 1;
    const exportBtn = isGenerated ? '<button type="button" class="btn btn-warning" data-mx-export-group>Выгрузить .xlsx</button>' : '';
    const phaseTitle = config.title || 'Групповой этап';

    // Для систем с группами показываем отдельную карточку настройки групп
    let metaSection = '';
    if (hasGroups && !isGenerated) {
      metaSection = this._groupConfigCard(t);
    } else {
      metaSection = this._metaForm(t);
    }

    return `
      <div class="app-shell">
        ${this._pageHeader('Смешанный турнир: ' + phaseTitle, exportBtn)}
        <section class="glass">
          ${metaSection}
          <div class="system-info-banner"><strong>Система:</strong> ${this._esc(config.title || t.meta.systemId)}</div>
        </section>
        <div id="mixed-workspace"></div>
      </div>
    `;
  },

  generatePlayoffBracket(t) {
    const playoff = t.state.playoff;
    if (!playoff || !playoff.bracket) {
      return '<div class="glass"><p class="muted-desc">Плей-офф ещё не начат.</p></div>';
    }
    const config = MIXED_SYSTEM_CONFIGS[t.meta.systemId] || {};
    const exportBtn = '<button type="button" class="btn btn-warning" data-mx-export-playoff>Выгрузить .xlsx</button>';
    const publishBtn = `<button type="button" class="btn btn-success" data-mx-publish-playoff>Транслировать онлайн</button>
      <button type="button" class="btn btn-sm btn-ghost" data-auto-publish-toggle>Авто-трансляция: ВЫКЛ</button>
      <label class="auto-publish-interval-label">сек: <input type="number" class="auto-publish-interval" data-auto-publish-interval min="2" max="60" value="5"></label>`;
    const phaseTitle = config.title ? 'Плей-офф (' + config.title + ')' : 'Плей-офф';

    return `
      <div class="app-shell">
        ${this._pageHeader('Смешанный турнир: ' + phaseTitle, exportBtn + publishBtn)}
        <section class="glass">
          <div class="system-info-banner"><strong>Групповой этап:</strong> завершён · <strong>Система:</strong> ${this._esc(config.title || t.meta.systemId)}</div>
          <div class="toolbar" style="margin-top: 1rem;"><button type="button" class="btn btn-ghost" data-mx-back-to-group>← Назад к таблице</button></div>
        </section>
        <div id="mixed-playoff-workspace"></div>
        <div id="mixed-group-standings"></div>
      </div>
    `;
  },

  /**
   * Привязка обработчиков для карточки конфигурации групп
   */
  bindGroupConfig(t) {
    const config = MIXED_SYSTEM_CONFIGS[t.meta.systemId] || {};
    const groupCount = config.groups || 2;

    // Общие поля
    const eventName = document.getElementById('mx-eventName');
    const sport = document.getElementById('mx-sport');
    const date = document.getElementById('mx-date');

    const saveShared = () => {
      t.meta.eventName = eventName?.value.trim() || '';
      t.meta.sport = sport?.value || t.meta.sport;
      t.meta.eventDate = date?.value || '';
      if (typeof App !== 'undefined') App.persist(t);
    };

    eventName?.addEventListener('input', saveShared);
    sport?.addEventListener('change', saveShared);
    date?.addEventListener('change', saveShared);

    // Обработчик для выбора количества команд в группе
    document.querySelectorAll('.mx-team-count').forEach(select => {
      select.addEventListener('change', (e) => {
        const g = parseInt(e.target.dataset.group, 10);
        const newCount = parseInt(e.target.value, 10);
        const fields = document.querySelectorAll('.team-field-' + g);
        
        // Обновляем видимость полей команд
        fields.forEach(field => {
          const idx = parseInt(field.dataset.teamIdx, 10);
          if (idx < newCount) {
            field.style.display = '';
          } else {
            field.style.display = 'none';
          }
        });

        // Сохраняем конфиг в state
        if (!t.state.groups) t.state.groups = {};
        t.state.groups[g] = t.state.groups[g] || {};
        t.state.groups[g].teamCount = newCount;
        if (typeof App !== 'undefined') App.persist(t);
      });
    });

    // Обработчик для мест проведения групп
    document.querySelectorAll('.mx-group-venue').forEach(select => {
      select.addEventListener('change', (e) => {
        const g = parseInt(e.target.dataset.group, 10);
        if (!t.state.groups) t.state.groups = {};
        t.state.groups[g] = t.state.groups[g] || {};
        t.state.groups[g].venue = e.target.value;
        if (typeof App !== 'undefined') App.persist(t);
      });
    });

    // Обработчик для названий команд
    document.querySelectorAll('.mx-team-inp').forEach(inp => {
      inp.addEventListener('input', () => {
        const g = parseInt(inp.dataset.group, 10);
        const idx = parseInt(inp.dataset.teamIdx, 10);
        if (!t.state.groups) t.state.groups = {};
        t.state.groups[g] = t.state.groups[g] || {};
        if (!t.state.groups[g].teams) {
          const count = parseInt(document.querySelector('.mx-team-count[data-group="' + g + '"]')?.value, 10) || 4;
          t.state.groups[g].teams = Array(count).fill('');
        }
        // Расширяем массив если нужно
        while (t.state.groups[g].teams.length <= idx) {
          t.state.groups[g].teams.push('');
        }
        t.state.groups[g].teams[idx] = inp.value.trim();
        if (typeof App !== 'undefined') App.persist(t);
      });
    });
  },

  generateGroupMatchRow(t, m, i) {
    // Для групповых систем используем локальные индексы внутри группы
    const groupTeams = m.group != null ? t.state.roundRobin?.groups?.[m.group] : null;
    const a = groupTeams ? groupTeams[m.teamA] : t.state.teams[m.teamA];
    const b = groupTeams ? groupTeams[m.teamB] : t.state.teams[m.teamB];
    const sa = m.scoreA ?? '';
    const sb = m.scoreB ?? '';
    const hasTour = m.tour != null;
    const rowClass = hasTour ? 'match-row match-row--with-tour' : 'match-row match-row--flat';
    const label = hasTour ? '<span class="match-tour-label">Матч ' + m.matchInTour + '</span>' : '';
    const hasScoreboard = t.meta?.sport === 'футбол' || t.meta?.sport === 'хоккей' || t.meta?.sport === 'баскетбол' || t.meta?.sport === 'стритбол' || t.meta?.sport === 'волейбол';
    const isHockey = t.meta?.sport === 'хоккей';
    const sportEmoji = t.meta?.sport === 'хоккей' ? '🏒' : (t.meta?.sport === 'волейбол' ? '🏐' : (t.meta?.sport === 'баскетбол' || t.meta?.sport === 'стритбол' ? '🏀' : '⚽'));
    const hasLinked = !!m.linkedScoreId;
    const sbExists = hasLinked && ScoreStorage.getByLinkedId(m.linkedScoreId);
    // ИСПРАВЛЕНО: раньше строка блокировалась сразу после ввода счёта (m.isPlayed),
    // даже без подтверждения. Теперь блокируется только подтверждённый матч.
    const isMatchFinished = m._synced === true || m.isFinalized === true;

    let statusHtml = '';
    let statusCls = '';
    if (isMatchFinished) {
      const sA = m.scoreA != null ? m.scoreA : 0;
      const sB = m.scoreB != null ? m.scoreB : 0;
      if (m.winner) statusHtml = m.winner + ' выигрывает';
      else if (sA === sB) statusHtml = 'Ничья';
      else statusHtml = 'Матч завершён';
      statusCls = ' match-status--finished';
    }

    let scoreboardBtn = '';
    let recordBtn = '';

    if (hasScoreboard) {
      if (isMatchFinished) {
        scoreboardBtn = '<button type="button" class="btn btn-sm btn-scoreboard-match btn-scoreboard-match--finished" disabled>✓ Матч завершён</button>';
        recordBtn = '<button type="button" class="btn btn-sm btn-record-match btn-record-match--finished" disabled>✓ Записано</button>';
      } else {
        scoreboardBtn = '<button type="button" class="btn btn-sm btn-scoreboard-match" data-mx-match-btn="' + i + '" data-mx-linked="' + (sbExists ? '1' : '') + '">' + (hasLinked && sbExists ? sportEmoji + ' Счёт' : sportEmoji + ' Вести счёт') + '</button>';
        recordBtn = '<button type="button" class="btn btn-sm btn-record-match" data-mx-record-btn="' + i + '">✎ Записать счёт</button>';
      }
    } else {
      if (isMatchFinished) {
        recordBtn = '<button type="button" class="btn btn-sm btn-record-match btn-record-match--finished" disabled>✓ Записано</button>';
      } else {
        recordBtn = '<button type="button" class="btn btn-sm btn-record-match" data-mx-record-btn="' + i + '">✎ Записать счёт</button>';
      }
    }

    const dis = isMatchFinished ? ' disabled' : '';

    return '<div class="' + rowClass + (isMatchFinished ? ' match-row--played' : '') + '" id="mrow-' + i + '">' +
      label +
      '<div class="match-row__teams">' +
      '<span class="team-name team-name--away">' + this._esc(a) + '</span>' +
      '<div class="scores">' +
      '<input type="number" min="0" inputmode="numeric" class="sc-a score-input" data-mx-score-a="' + i + '" value="' + sa + '" placeholder="0" aria-label="Счёт ' + this._esc(a) + '"' + dis + '>' +
      '<span aria-hidden="true">:</span>' +
      '<input type="number" min="0" inputmode="numeric" class="sc-b score-input" data-mx-score-b="' + i + '" value="' + sb + '" placeholder="0" aria-label="Счёт ' + this._esc(b) + '"' + dis + '>' +
      (isHockey && !isMatchFinished
        ? '<select class="score-input hockey-result-select" data-mx-result-type="' + i + '" aria-label="Тип результата"><option value=""' + (!m.resultType ? ' selected' : '') + '></option><option value="regulation"' + (m.resultType === 'regulation' ? ' selected' : '') + '>Регламент</option><option value="overtime"' + (m.resultType === 'overtime' ? ' selected' : '') + '>Овертайм</option><option value="shootout"' + (m.resultType === 'shootout' ? ' selected' : '') + '>Буллиты</option></select>'
        : '') +
      (isHockey && isMatchFinished && m.resultType
        ? '<span class="hockey-result-badge">' + (m.resultType === 'overtime' ? 'ВО' : m.resultType === 'shootout' ? 'ВБ' : 'В') + '</span>'
        : '') +
      '</div>' +
      '<span class="team-name">' + this._esc(b) + '</span>' +
      '</div>' +
      '<div class="match-row__footer"><div class="match-row__actions">' +
      '<span class="match-status' + statusCls + '" id="mst-' + i + '">' + statusHtml + '</span>' +
      recordBtn + scoreboardBtn +
      '</div></div>' +
      '</div>';
  },

  generatePlayoffMatchEl(t, match, rIdx, mIdx, kind, title) {
    const div = document.createElement('div');
    div.className = 'playoff-match' + (kind === 'final' ? ' final-block' : '');
    let inner = title ? '<strong>' + this._esc(title) + '</strong>' : '';

    const done = !!(match.isFinished && match.winner) || match.isFinalized;
    const penId = kind === 'round' ? 'pen-' + rIdx + '-' + mIdx : 'pen-' + kind;
    const hasScoreboard = t.meta?.sport === 'футбол' || t.meta?.sport === 'хоккей' || t.meta?.sport === 'баскетбол';
    const sportEmoji = t.meta?.sport === 'хоккей' ? '🏒' : (t.meta?.sport === 'баскетбол' ? '🏀' : '⚽');
    const hasLinked = !!match.linkedScoreId;

    const line = (team, side, score) => {
      const isW = done && match.winner === team;
      const isL = done && match.loser === team;
      if (!done) {
        return '<div class="team-line' + (isW ? ' winner' : '') + (isL ? ' loser' : '') + '">' +
          '<span class="team-name">' + this._esc(team) + '</span>' +
          '<input type="number" min="0" inputmode="numeric" class="sc-' + side + ' score-input score-input--sm" value="' + (score != null ? score : '') + '" placeholder="0" aria-label="Счёт">' +
          '</div>';
      }
      return '<div class="team-line' + (isW ? ' winner' : '') + (isL ? ' loser' : '') + '">' +
        '<span class="team-name">' + this._esc(team) + '</span>' +
        '<span class="team-score">' + (score != null ? score : 0) + '</span>' +
        '</div>';
    };

    inner += line(match.teamA, 'a', match.scoreA) + line(match.teamB, 'b', match.scoreB);

    if (match.penaltyA != null && match.penaltyB != null) {
      inner += '<div class="match-penalty-result">(пен. ' + match.penaltyA + ':' + match.penaltyB + ')</div>';
    }
    if (match.extraScoreA != null && match.extraScoreB != null) {
      inner += '<div class="match-extra-result">Доп. время: ' + match.extraScoreA + ':' + match.extraScoreB + '</div>';
    }

    // ДОБАВЛЕНО: блок ввода пенальти (раньше penId вычислялся, но не использовался,
    // а _handleConfirmPlayoff читал .pen-a/.pen-b, которых не было в разметке).
    if (!done) {
      inner += this._penaltyInputsHtml(penId);
    }

    div.innerHTML = inner;

    if (!done) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-success playoff-confirm';
      btn.textContent = 'Подтвердить результат';
      btn.setAttribute('data-mx-confirm-playoff', '1');
      btn.dataset.kind = kind;
      btn.dataset.rIdx = rIdx != null ? String(rIdx) : '';
      btn.dataset.mIdx = mIdx != null ? String(mIdx) : '';
      div.appendChild(btn);

      if (hasScoreboard) {
        const sbBtn = document.createElement('button');
        sbBtn.type = 'button';
        sbBtn.className = 'btn btn-sm btn-scoreboard-match';
        let isMatchFinished = false;
        if (hasLinked && match.linkedScoreId) {
          const sb = ScoreStorage.getByLinkedId(match.linkedScoreId);
          if (sb && sb.state?.phase === 'finished' && match._synced) { isMatchFinished = true; }
        }
        if (isMatchFinished) {
          sbBtn.className += ' btn-scoreboard-match--finished';
          sbBtn.textContent = '✓ Матч завершён';
          sbBtn.disabled = true;
        } else {
          sbBtn.textContent = hasLinked ? sportEmoji + ' Счёт' : sportEmoji + ' Вести счёт';
        }
        sbBtn.dataset.mxBracketBtn = '1';
        sbBtn.dataset.kind = kind;
        sbBtn.dataset.rIdx = rIdx != null ? String(rIdx) : '';
        sbBtn.dataset.mIdx = mIdx != null ? String(mIdx) : '';
        sbBtn.dataset.mxLinked = hasLinked ? '1' : '';
        div.appendChild(sbBtn);
      }
    }

    return div;
  },

  generateResultsPanel(bracket) {
    let html = '';
    if (bracket.thirdPlaceTeam) {
      html += '<div class="results-panel"><h3>Призовые места</h3><div class="medal">🥉 3 место: <strong>' + this._esc(bracket.thirdPlaceTeam) + '</strong></div></div>';
    }
    if (bracket.finalMatch?.isFinished && bracket.finalMatch?.winner) {
      const champ = bracket.finalMatch.winner;
      const second = bracket.finalMatch.teamA === champ ? bracket.finalMatch.teamB : bracket.finalMatch.teamA;
      html += '<div class="results-panel"><h3>Итоги</h3><div class="medal">🥇 1 место: <strong>' + this._esc(champ) + '</strong></div><div class="medal">🥈 2 место: <strong>' + this._esc(second) + '</strong></div>';
      if (!bracket.thirdPlaceTeam && bracket.thirdPlaceMatch?.isFinished) {
        html += '<div class="medal">🥉 3 место: <strong>' + this._esc(bracket.thirdPlaceMatch.winner) + '</strong></div>';
      }
      html += '</div>';
    }
    return html;
  },

  generateGroupMatchList(t) {
    const matches = t.state.roundRobin?.matches || [];
    const useTours = matches.some(m => m.tour != null);
    const groupNames = t.state.roundRobin?.groupNames || [];

    // Если есть группы (например, 2tables-2eac)
    if (groupNames.length > 1) {
      let html = '';
      groupNames.forEach((groupName, groupIdx) => {
        // Ищем индексы матчей этой группы в оригинальном массиве
        const groupMatchIndices = matches.map((m, i) => m.group === groupIdx ? i : -1).filter(i => i >= 0);
        
        html += '<div class="group-section"><h3 class="group-title">Группа ' + this._esc(groupName) + '</h3>';
        
        if (groupMatchIndices.length > 0) {
          if (useTours) {
            const groupMatches = groupMatchIndices.map(i => matches[i]);
            const groups = RoundRobinEngine.getTourGroups(groupMatches);
            html += groups.map(g => {
              let tourHtml = '<div class="rr-tour-block"><h4 class="rr-tour-title">Тур ' + g.tour + '</h4>';
              if (g.restTeam != null && t.state.teams[g.restTeam]) {
                tourHtml += '<div class="rr-tour-rest">Отдыхает: ' + this._esc(t.state.teams[g.restTeam]) + '</div>';
              }
              tourHtml += g.matches.map(({ match, index }) => MixedUI.generateGroupMatchRow(t, match, groupMatchIndices[index])).join('');
              tourHtml += '</div>';
              return tourHtml;
            }).join('');
          } else {
            // Используем оригинальные индексы из массива matches
            html += groupMatchIndices.map(origIdx => MixedUI.generateGroupMatchRow(t, matches[origIdx], origIdx)).join('');
          }
        } else {
          html += '<p class="no-matches">Матчи в этой группе ещё не начались</p>';
        }
        
        html += '</div>';
      });
      return html;
    }

    if (useTours) {
      const groups = RoundRobinEngine.getTourGroups(matches);
      return groups.map(g => {
        let html = '<div class="rr-tour-block"><h4 class="rr-tour-title">Тур ' + g.tour + '</h4>';
        if (g.restTeam != null && t.state.teams[g.restTeam]) {
          html += '<div class="rr-tour-rest">Отдыхает: ' + this._esc(t.state.teams[g.restTeam]) + '</div>';
        }
        html += g.matches.map(({ match, index }) => MixedUI.generateGroupMatchRow(t, match, index)).join('');
        html += '</div>';
        return html;
      }).join('');
    }

    return matches.map((m, i) => MixedUI.generateGroupMatchRow(t, m, i)).join('');
  },

  generateBracketUI(t) {
    const bracket = t.state.playoff.bracket;
    if (!bracket) return '';

    let html = '';

    if (bracket.rounds) {
      bracket.rounds.forEach((round, rIdx) => {
        html += '<div class="round-block">';
        html += '<h4>' + this._esc(OlympicEngine.getRoundLabel(round)) + '</h4>';
        if (round.byeNote) {
          html += '<div class="bye-list">' + this._esc(round.byeNote) + '</div>';
        } else if (round.byeTeams?.length) {
          html += '<div class="bye-list">Пропускают тур: ' + round.byeTeams.map(x => this._esc(x)).join(', ') + '</div>';
        }
        round.matches.forEach((match, mIdx) => {
          html += this._renderBracketMatchHTML(t, match, rIdx, mIdx, 'round');
        });
        html += '</div>';
      });
    }

    if (bracket.thirdPlaceMatch || bracket.finalMatch) {
      html += '<div class="round-block"><h4>Финальные матчи</h4>';
      if (bracket.thirdPlaceMatch) {
        html += this._renderBracketMatchHTML(t, bracket.thirdPlaceMatch, null, null, 'third', 'Матч за 3-е место');
      }
      if (bracket.finalMatch) {
        html += this._renderBracketMatchHTML(t, bracket.finalMatch, null, null, 'final', 'Финал');
      }
      html += '</div>';
    }

    return html;
  },

  _renderBracketMatchHTML(t, match, rIdx, mIdx, kind, title) {
    const done = !!(match.isFinished && match.winner) || match.isFinalized;
    const hasScoreboard = t.meta?.sport === 'футбол' || t.meta?.sport === 'хоккей' || t.meta?.sport === 'баскетбол';
    const sportEmoji = t.meta?.sport === 'хоккей' ? '🏒' : (t.meta?.sport === 'баскетбол' ? '🏀' : '⚽');
    const hasLinked = !!match.linkedScoreId;
    let html = '<div class="playoff-match' + (kind === 'final' ? ' final-block' : '') + '" data-match-kind="' + kind + '">';

    if (title) {
      html += '<strong>' + this._esc(title) + '</strong>';
    }

    const line = (team, side, score) => {
      const isW = done && match.winner === team;
      const isL = done && match.loser === team;
      if (!done) {
        return '<div class="team-line' + (isW ? ' winner' : '') + (isL ? ' loser' : '') + '">' +
          '<span class="team-name">' + this._esc(team) + '</span>' +
          '<input type="number" min="0" inputmode="numeric" class="sc-' + side + ' score-input score-input--sm" value="' + (score != null ? score : '') + '" placeholder="0" aria-label="Счёт">' +
          '</div>';
      }
      return '<div class="team-line' + (isW ? ' winner' : '') + (isL ? ' loser' : '') + '">' +
        '<span class="team-name">' + this._esc(team) + '</span>' +
        '<span class="team-score">' + (score != null ? score : 0) + '</span>' +
        '</div>';
    };

    html += line(match.teamA, 'a', match.scoreA) + line(match.teamB, 'b', match.scoreB);

    if (match.penaltyA != null && match.penaltyB != null) {
      html += '<div class="match-penalty-result">(пен. ' + match.penaltyA + ':' + match.penaltyB + ')</div>';
    }
    if (match.extraScoreA != null && match.extraScoreB != null) {
      html += '<div class="match-extra-result">Доп. время: ' + match.extraScoreA + ':' + match.extraScoreB + '</div>';
    }

    if (!done) {
      // ДОБАВЛЕНО: поля пенальти (см. комментарий в generatePlayoffMatchEl)
      const penId = kind === 'round' ? 'pen-' + rIdx + '-' + mIdx : 'pen-' + kind;
      html += this._penaltyInputsHtml(penId);

      html += '<button type="button" class="btn btn-sm btn-success playoff-confirm" data-mx-confirm-playoff="1" data-kind="' + kind + '" data-r-idx="' + (rIdx != null ? rIdx : '') + '" data-m-idx="' + (mIdx != null ? mIdx : '') + '">Подтвердить результат</button>';

      if (hasScoreboard) {
        // ИСПРАВЛЕНО (стык частей 1–3): было `match.linkLinked` и задвоенный
        // тернарник в className. Кнопка теперь собирается строкой, как и весь блок.
        let isMatchFinished = false;
        if (hasLinked && match.linkedScoreId) {
          const sb = ScoreStorage.getByLinkedId(match.linkedScoreId);
          if (sb && sb.state?.phase === 'finished' && match._synced) {
            isMatchFinished = true;
          }
        }
        const sbClass = 'btn btn-sm btn-scoreboard-match' + (isMatchFinished ? ' btn-scoreboard-match--finished' : '');
        const sbText = isMatchFinished ? '✓ Матч завершён' : (hasLinked ? sportEmoji + ' Счёт' : sportEmoji + ' Вести счёт');
        html += '<button type="button" class="' + sbClass + '"' + (isMatchFinished ? ' disabled' : '') +
          ' data-mx-bracket-btn="1"' +
          ' data-kind="' + kind + '"' +
          ' data-r-idx="' + (rIdx != null ? rIdx : '') + '"' +
          ' data-m-idx="' + (mIdx != null ? mIdx : '') + '"' +
          ' data-mx-linked="' + (hasLinked ? '1' : '') + '">' + sbText + '</button>';
      }
    }

    html += '</div>';
    return html;
  },

  _penaltyInputsHtml(penId) {
    return '<div class="penalty-block" id="' + penId + '">' +
      '<span class="penalty-label muted-desc">Пенальти (при ничьей):</span> ' +
      '<input type="number" min="0" inputmode="numeric" class="pen-a score-input score-input--sm" placeholder="0" aria-label="Пенальти, команда A">' +
      '<span aria-hidden="true">:</span>' +
      '<input type="number" min="0" inputmode="numeric" class="pen-b score-input score-input--sm" placeholder="0" aria-label="Пенальти, команда B">' +
      '</div>';
  },

  generateEmptyGroupMessage() {
    return '<section class="glass"><p class="muted-desc" style="text-align: center; padding: 2rem;">Введите названия команд и нажмите «Сгенерировать игры» для начала группового этапа.</p></section>';
  },

  generateGroupStandingsSummary(t) {
    if (!t.state.roundRobin?.generated) return '';
    const standings = RoundRobinEngine.calculateStandings(t.state.teams, t.state.roundRobin.matches, t.meta?.sport);
    return '<section class="glass"><h2 class="section-title">Итоги группового этапа</h2><div id="group-standings">' + this._rrStandingsBlockHtml(t.state.teams, t.state.roundRobin.matches, standings, t.meta?.sport) + '</div></section>';
  },

  generateSystemInfoBanner(config) {
    if (!config || !config.title) return '';
    return '<div class="system-info-banner"><strong>Система:</strong> ' + this._esc(config.title) + '<br><small class="muted-desc">' + this._esc(config.desc || '') + '</small></div>';
  },

  generatePlayoffEntryBanner(canEnterPlayoff, config) {
    if (!canEnterPlayoff) return '';
    return '<div class="playoff-entry-banner"><button type="button" class="btn btn-success btn-lg" data-mx-enter-playoff>🏆 Перейти к плей-офф</button><p class="muted-desc">Все матчи группового этапа завершены. Топ-' + (config?.advanceCount || 4) + ' команд выйдут в плей-офф.</p></div>';
  },

  generateMetaForm(t) {
    return this._metaForm(t);
  },

  generatePageHeader(title, extraButtons) {
    return this._pageHeader(title, extraButtons);
  },

  bindGroupMatchInputs(t) {
    const config = MIXED_SYSTEM_CONFIGS[t.meta.systemId] || {};
    const groupCount = config.groups || 1;

    // Привязываем матчи для каждой группы отдельно
    const groupContainers = document.querySelectorAll('[data-group-matches]');
    
    if (groupContainers.length === 0) return;

    const matches = t.state.roundRobin.matches;

    // Заполняем матчи в каждый контейнер группы
    groupContainers.forEach((list) => {
      const groupIdx = parseInt(list.dataset.groupMatches, 10);
      const groupMatches = matches.filter(m => m.group === groupIdx);
      
      // Заполняем матчи если список пуст
      if (groupMatches.length > 0 && !list.innerHTML.trim()) {
        list.innerHTML = groupMatches.map((m, localIdx) => {
          const globalIdx = matches.indexOf(m);
          return MixedUI.generateGroupMatchRow(t, m, globalIdx);
        }).join('');
      }
    });

    const update = (changedMatchIdx) => {
      const matches = t.state.roundRobin.matches;
      
      // Обновляем статусы матчей для всех групп
      groupContainers.forEach((list, groupIdx) => {
        const groupMatches = matches.filter(m => m.group === groupIdx);
        
        groupMatches.forEach((m) => {
          const globalIdx = matches.indexOf(m);
          const aIn = list.querySelector('[data-mx-score-a="' + globalIdx + '"]');
          const bIn = list.querySelector('[data-mx-score-b="' + globalIdx + '"]');
          if (!aIn || !bIn) return;
          const sa = aIn.value === '' ? null : parseInt(aIn.value, 10);
          const sb = bIn.value === '' ? null : parseInt(bIn.value, 10);
          m.scoreA = sa;
          m.scoreB = sb;
          m.isPlayed = sa !== null && sb !== null && !isNaN(sa) && !isNaN(sb) && sa >= 0 && sb >= 0;
          const st = document.getElementById('mst-' + globalIdx);
          if (st) {
            if (m._synced || m.isFinalized) {
              if (m.winner) st.textContent = m.winner + ' выигрывает';
              else if (m.scoreA != null && m.scoreB != null && m.scoreA === m.scoreB) st.textContent = 'Ничья';
              else st.textContent = 'Матч завершён';
              st.className = 'match-status match-status--finished';
            } else if (m.isPlayed) {
              const groupTeams = t.state.roundRobin.groups[groupIdx] || [];
              st.textContent = (sa > sb ? (groupTeams[m.teamA] || 'Команда А') : (sb > sa ? (groupTeams[m.teamB] || 'Команда Б') : 'Ничья'));
              st.className = 'match-status';
            } else {
              st.textContent = 'Ожидание';
              st.className = 'match-status';
            }
          }
        });
      });

      // Обновляем standings для каждой группы в реальном времени
      if (groupCount > 1) {
        const groupedStandings = typeof App !== 'undefined' && App._calculateGroupedStandings ? App._calculateGroupedStandings(t, groupCount) : [];
        groupedStandings.forEach((groupSt, idx) => {
          const groupName = t.state.roundRobin?.groupNames?.[idx] || String.fromCharCode(65 + idx);
          const groupTeams = t.state.roundRobin.groups[idx] || [];
          const groupMatches = matches.filter(m => m.group === idx);
          const standingsEl = document.getElementById('standings-group-' + this._esc(groupName));
          if (standingsEl) {
            standingsEl.innerHTML = this._rrStandingsBlockHtml(groupTeams, groupMatches, groupSt, t.meta?.sport);
          }
        });
      } else {
        const st = RoundRobinEngine.calculateStandings(t.state.teams, matches, t.meta?.sport);
        const stEl = document.querySelector('.group-standings');
        if (stEl) stEl.innerHTML = this._rrStandingsBlockHtml(t.state.teams, matches, st, t.meta?.sport);
      }

      if (typeof App !== 'undefined') App.persist(t);

      // Обновление состояния кнопки плей-офф
      const playoffBtn = document.getElementById('playoff-entry-block')?.querySelector('[data-enter-playoff]');
      const desc = document.getElementById('playoff-entry-desc');
      const allPlayed = matches.length > 0 && matches.every(function(m) { return m.isPlayed === true; });
      if (playoffBtn) {
        if (allPlayed) {
          playoffBtn.disabled = false;
        } else {
          playoffBtn.disabled = true;
        }
      }
      if (desc) {
        if (allPlayed) {
          desc.textContent = 'Все матчи группового этапа завершены. Нажмите кнопку, чтобы перейти к плей-офф.';
        } else {
          const remaining = matches.filter(function(m) { return !m.isPlayed; }).length;
          desc.textContent = 'Осталось сыграть: ' + remaining + ' матч(ов). После завершения всех матчей кнопка разблокируется.';
        }
      }
    };

    // Привязываем обработчики для каждого контейнера групповых матчей
    groupContainers.forEach((list) => {
      list.querySelectorAll('input').forEach((inp) => {
        const dataA = inp.dataset.mxScoreA;
        const dataB = inp.dataset.mxScoreB;
        const idx = dataA !== undefined ? dataA : dataB;
        if (idx === undefined) return;
        const match = t.state.roundRobin.matches[parseInt(idx, 10)];
        if (match?.isFinalized) {
          inp.disabled = true;
          inp.classList.add('score-input--disabled');
        }
        inp.addEventListener('input', update);
      });

      list.querySelectorAll('[data-mx-match-btn]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(btn.dataset.mxMatchBtn, 10);
          const m = t.state.roundRobin.matches[idx];
          if (!m) return;
          if (typeof App === 'undefined') return;
          const teamA = t.state.teams[m.teamA];
          const teamB = t.state.teams[m.teamB];
          const freshT = TournamentStorage.get(t.id);
          if (!freshT) { alert('Турнир не найден. Обновите страницу.'); return; }
          const freshM = freshT.state.roundRobin.matches[idx];
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
                // АСИНХРОННО: сначала hash, потом ререндер
                const savedSbId = existingSb.id;
                setTimeout(() => { location.hash = '#/score/s/' + savedSbId; }, 50);
                if (hasChanged) {
                  TournamentStorage.save(freshT);
                  setTimeout(() => { App.renderMixed(freshT); }, 100);
                }
                return;
              }
              window.location.hash = '#/score/s/' + existingSb.id;
              return;
            }
            freshM.linkedScoreId = null;
            TournamentStorage.save(freshT);
            App.renderMixed(freshT);
            return;
          }
          const newSession = ScoreSync.createLinkedScoreboard(freshT.id, teamA, teamB, idx);
          if (newSession) {
            setTimeout(() => { window.location.hash = '#/score/s/' + newSession.id; }, 50);
          }
        });
      });

      list.querySelectorAll('[data-mx-record-btn]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(btn.dataset.mxRecordBtn, 10);
          const m = t.state.roundRobin.matches[idx];
          if (!m) return;
          const freshT = TournamentStorage.get(t.id);
          const freshM = freshT?.state?.roundRobin?.matches?.[idx];
          if (!freshM) { alert('Матч не найден. Обновите страницу.'); return; }
          const scoreAInput = list.querySelector('[data-mx-score-a="' + idx + '"]');
          const scoreBInput = list.querySelector('[data-mx-score-b="' + idx + '"]');
          const scoreA = scoreAInput && scoreAInput.value !== '' ? parseInt(scoreAInput.value, 10) : null;
          const scoreB = scoreBInput && scoreBInput.value !== '' ? parseInt(scoreBInput.value, 10) : null;
          if (scoreA === null || scoreB === null || isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
            alert('Введите корректный счёт (числа 0 или больше) в поля результата матча.');
            return;
          }
          const teamA = freshT.state.teams[freshM.teamA];
          const teamB = freshT.state.teams[freshM.teamB];
          if (freshT.meta?.sport === 'хоккей' && scoreA !== scoreB) {
            const rtSelect = list.querySelector('[data-mx-result-type="' + idx + '"]');
            const resultType = rtSelect ? rtSelect.value : '';
            if (!resultType) {
              alert('Для хоккейного матча выберите тип результата (Регламент / Овертайм / Буллиты).');
              return;
            }
            freshM.resultType = resultType;
          }
          freshM.scoreA = scoreA;
          freshM.scoreB = scoreB;
          freshM.isPlayed = true;
          if (scoreA > scoreB) { freshM.winner = teamA; freshM.loser = teamB; }
          else if (scoreB > scoreA) { freshM.winner = teamB; freshM.loser = teamA; }
          else { freshM.winner = null; freshM.loser = null; }
          freshM._synced = true;
          TournamentStorage.save(freshT);

          const scrollY = window.scrollY;

          // Обновляем строку матча инлайн (без полного ререндера)
          const matchRow = list.querySelector('#mrow-' + idx);
          if (matchRow) {
            matchRow.classList.add('match-row--played');
            matchRow.querySelectorAll('input.score-input').forEach(inp => { inp.disabled = true; });
            const recBtn = matchRow.querySelector('[data-mx-record-btn="' + idx + '"]');
            if (recBtn) recBtn.style.display = 'none';
            const st = matchRow.querySelector('#mst-' + idx);
            if (st) {
              if (scoreA > scoreB) st.textContent = teamA + ' выигрывает';
              else if (scoreB > scoreA) st.textContent = teamB + ' выигрывает';
              else st.textContent = 'Ничья';
              st.className = 'match-status match-status--finished';
            }
          }

          // Обновляем таблицу
          const config = MIXED_SYSTEM_CONFIGS[freshT.meta.systemId] || {};
          const groupCount = config.groups || 1;
          const ws = document.getElementById('mixed-workspace');
          if (ws && groupCount > 1) {
            for (let g = 0; g < groupCount; g++) {
              const grpTeams = freshT.state.roundRobin.groups?.[g] || [];
              const grpMatches = freshT.state.roundRobin.matches.filter(mm => mm.group === g);
              const grpSt = RoundRobinEngine.calculateStandings(grpTeams, grpMatches, freshT.meta?.sport);
              const stEl = document.getElementById('standings-group-' + freshT.state.roundRobin.groupNames?.[g]);
              if (stEl) stEl.innerHTML = this._rrStandingsBlockHtml(grpTeams, grpMatches, grpSt, freshT.meta?.sport);
            }
          } else if (ws) {
            const allTeams = freshT.state.teams;
            const allMatches = freshT.state.roundRobin.matches;
            const st = RoundRobinEngine.calculateStandings(allTeams, allMatches, freshT.meta?.sport);
            const stEl = ws.querySelector('.group-standings');
            if (stEl) stEl.innerHTML = this._rrStandingsBlockHtml(allTeams, allMatches, st, freshT.meta?.sport);
          }
          setTimeout(() => { window.scrollTo(0, scrollY); }, 0);
        });
      });
    });

    update();
  },

  bindPlayoffBracket(t) {
    const root = document.getElementById('bracket-root');
    if (!root) return;

    root.innerHTML = this.generateBracketUI(t);

    const results = document.getElementById('oly-results');
    if (results) {
      results.innerHTML = this.generateResultsPanel(t.state.playoff.bracket);
    }

    root.onclick = (e) => {
      const btn = e.target.closest('[data-mx-confirm-playoff]');
      if (btn) {
        this._handleConfirmPlayoff(t, btn);
      }
    };

    root.querySelectorAll('[data-mx-bracket-btn]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const kind = btn.dataset.kind;
        const rIdx = btn.dataset.rIdx !== '' ? parseInt(btn.dataset.rIdx, 10) : null;
        const mIdx = btn.dataset.mIdx !== '' ? parseInt(btn.dataset.mIdx, 10) : null;
        this._handleScoreboardOpen(t, kind, rIdx, mIdx);
      });
    });

    this.bindPublishPlayoff(t);

    let saveTimer = null;
    root.addEventListener('input', (e) => {
      const inp = e.target;
      if (!inp.classList.contains('score-input')) return;
      const card = inp.closest('.playoff-match');
      if (!card) return;
      const btn = card.querySelector('[data-mx-confirm-playoff]');
      if (!btn) return;
      const kind = btn.dataset.kind;
      const rIdx = btn.dataset.rIdx !== '' ? parseInt(btn.dataset.rIdx, 10) : null;
      const mIdx = btn.dataset.mIdx !== '' ? parseInt(btn.dataset.mIdx, 10) : null;
      const bracket = t.state.playoff?.bracket;
      if (!bracket) return;
      const match = this._getPlayoffMatch(bracket, kind, rIdx, mIdx);
      if (!match || match.isFinalized) return;
      if (inp.classList.contains('sc-a')) match.scoreA = inp.value === '' ? null : parseInt(inp.value, 10);
      else if (inp.classList.contains('sc-b')) match.scoreB = inp.value === '' ? null : parseInt(inp.value, 10);
      else if (inp.classList.contains('pen-a')) match.penaltyA = inp.value === '' ? null : parseInt(inp.value, 10);
      else if (inp.classList.contains('pen-b')) match.penaltyB = inp.value === '' ? null : parseInt(inp.value, 10);
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { App.persist(t); }, 300);
    });
  },

  bindBackToGroup() {
    const btn = this.root?.querySelector('[data-mx-back-to-group]');
    if (btn) {
      btn.addEventListener('click', () => {
        const t = TournamentStorage.get(App.currentId);
        if (t) {
          t.state.phase = 'group';
          App.persist(t);
          App.renderMixed(t);
        }
      });
    }
  },

  bindEnterPlayoff() {
    const btn = this.root?.querySelector('[data-mx-enter-playoff]');
    if (btn) {
      btn.addEventListener('click', () => {
        const t = TournamentStorage.get(App.currentId);
        if (t && confirm('Перейти к плей-офф? Команды будут распределены по парам на основе таблицы.')) {
          App._enterPlayoffPhase(t);
        }
      });
    }
  },

  bindExportButtons(handler) {
    const btn = this.root?.querySelector('[data-mx-export-group], [data-mx-export-playoff]');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { handler(); }
        catch (err) { console.error('export', err); alert('Ошибка выгрузки: ' + (err.message || err)); }
      });
    }
  },

  bindPublishPlayoff(t) {
    const btn = this.root?.querySelector('[data-mx-publish-playoff]');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fresh = TournamentStorage.get(t.id);
        if (!fresh) return;
        const html = this.generatePlayoffBracket(fresh);
        App._publishOnline(fresh, html);
      });
    }
    App.bindAutoPublish(t, () => {
      const fresh = TournamentStorage.get(t.id);
      if (!fresh) return '';
      return this.generatePlayoffBracket(fresh);
    });
  },

  _handleConfirmPlayoff(t, btn) {
    const bracket = t.state.playoff.bracket;
    const kind = btn.dataset.kind;
    const rIdx = btn.dataset.rIdx !== '' ? parseInt(btn.dataset.rIdx, 10) : null;
    const mIdx = btn.dataset.mIdx !== '' ? parseInt(btn.dataset.mIdx, 10) : null;
    const match = this._getPlayoffMatch(bracket, kind, rIdx, mIdx);
    if (!match) { alert('Матч не найден. Обновите страницу.'); return; }

    const card = btn.closest('.playoff-match');
    if (!card) return;

    const scoreA = parseInt(card.querySelector('.sc-a')?.value, 10);
    const scoreB = parseInt(card.querySelector('.sc-b')?.value, 10);
    if (isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
      alert('Введите корректный счёт матча (0 или больше)');
      return;
    }

    let penA = null;
    let penB = null;
    if (scoreA === scoreB) {
      penA = parseInt(card.querySelector('.pen-a')?.value, 10);
      penB = parseInt(card.querySelector('.pen-b')?.value, 10);
    }

    const res = OlympicEngine.resolveWinner(match, scoreA, scoreB, penA, penB);
    if (res.error) { alert(res.error); return; }

    try {
      OlympicEngine.finalizeMatch(match, scoreA, scoreB, res.penaltyA, res.penaltyB, res.winner, res.loser);

      if (!Array.isArray(t.state.matchHistory)) t.state.matchHistory = [];
      t.state.matchHistory.push({
        round: this._getPlayoffRoundLabel(kind, rIdx, bracket),
        teamA: match.teamA,
        teamB: match.teamB,
        scoreA,
        scoreB,
        penaltyA: match.penaltyA,
        penaltyB: match.penaltyB,
        winner: match.winner
      });

      if (kind === 'round') {
        const round = bracket.rounds[rIdx];
        if (round?.matches?.length && round.matches.every(m => m.isFinished && m.winner)) {
          OlympicEngine.advanceOnRoundComplete(bracket, rIdx);
        }
      }

      // ИСПРАВЛЕНО: 3-е место в матче за 3-е место занимает ПОБЕДИТЕЛЬ (был loser).
      // УДАЛЕНО: присвоение thirdPlaceTeam = loser финала — проигравший финала
      // занимает 2-е место (оно уже выводится в generateResultsPanel).
      if (kind === 'third' && match.isFinished && match.winner && !bracket.thirdPlaceTeam) {
        bracket.thirdPlaceTeam = match.winner;
      }

      App.persist(t);
      App.renderMixed(t);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении результата: ' + (err.message || err));
    }
  },

  _handleScoreboardOpen(t, kind, rIdx, mIdx) {
    const bracket = t.state.playoff.bracket;
    const match = this._getPlayoffMatch(bracket, kind, rIdx, mIdx);
    if (!match) return;

    const teamA = match.teamA || '';
    const teamB = match.teamB || '';
    const freshT = TournamentStorage.get(t.id);
    if (!freshT) { alert('Турнир не найден. Обновите страницу.'); return; }
    const freshMatch = this._getPlayoffMatch(freshT.state.playoff.bracket, kind, rIdx, mIdx);
    if (!freshMatch) { alert('Матч не найден. Обновите страницу.'); return; }

    if (freshMatch.linkedScoreId) {
      const existingSb = ScoreStorage.getByLinkedId(freshMatch.linkedScoreId);
      if (existingSb) {
        if (existingSb.state?.phase === 'finished') {
          const scores = ScoreSync._getFinalScore(existingSb);
          const hasChanged = !freshMatch._synced || freshMatch.scoreA !== scores.scoreA || freshMatch.scoreB !== scores.scoreB;
          freshMatch.scoreA = scores.scoreA;
          freshMatch.scoreB = scores.scoreB;
          if (scores.penaltyA != null) freshMatch.penaltyA = scores.penaltyA;
          if (scores.penaltyB != null) freshMatch.penaltyB = scores.penaltyB;
          if (scores.wasDecidedByPenalties) freshMatch.wasDecidedByPenalties = scores.wasDecidedByPenalties;
          if (scores.resultType) freshMatch.resultType = scores.resultType;
          if (scores.scoreA > scores.scoreB) { freshMatch.winner = existingSb.teamA; freshMatch.loser = existingSb.teamB; }
          else if (scores.scoreB > scores.scoreA) { freshMatch.winner = existingSb.teamB; freshMatch.loser = existingSb.teamA; }
          else { freshMatch.winner = null; freshMatch.loser = null; }
          freshMatch.isFinished = true;
          freshMatch._synced = true;
          // АСИНХРОННО: сначала hash, потом ререндер
          const savedSbId = existingSb.id;
          setTimeout(() => { location.hash = '#/score/s/' + savedSbId; }, 50);
          if (hasChanged) {
            TournamentStorage.save(freshT);
            setTimeout(() => { App.renderMixed(freshT); }, 100);
          }
          return;
        }
        window.location.hash = '#/score/s/' + existingSb.id;
        return;
      }
      freshMatch.linkedScoreId = null;
      TournamentStorage.save(freshT);
      App.renderMixed(freshT);
      return;
    }

    const newSession = App.createBracketLinkedScoreboard(freshT.id, teamA, teamB, kind, rIdx, mIdx);
    if (newSession) {
      setTimeout(() => { window.location.hash = '#/score/s/' + newSession.id; }, 50);
    }
  },

  _getPlayoffMatch(bracket, kind, rIdx, mIdx) {
    if (kind === 'final') return bracket.finalMatch;
    if (kind === 'third') return bracket.thirdPlaceMatch;
    const ri = parseInt(rIdx, 10);
    const mi = parseInt(mIdx, 10);
    if (isNaN(ri) || isNaN(mi) || !bracket.rounds || !bracket.rounds[ri]) return null;
    return bracket.rounds[ri].matches[mi] || null;
  },

  _getPlayoffRoundLabel(kind, rIdx, bracket) {
    if (kind === 'final') return 'Финал';
    if (kind === 'third') return 'Матч за 3-е место';
    if (kind === 'round') {
      const ri = parseInt(rIdx, 10);
      const round = bracket.rounds[ri];
      return round ? OlympicEngine.getRoundLabel(round) : 'Тур ' + (ri + 1);
    }
    return 'Матч';
  },

  /**
   * Генерирует HTML-карточку конфигурации для систем с группами (2tables и т.д.)
   * Содержит: общие поля + блок для каждой группы (кол-во команд, названия, место)
   */
  _groupConfigCard(t) {
    const config = MIXED_SYSTEM_CONFIGS[t.meta.systemId] || {};
    const groupCount = config.groups || 2;
    const groupNames = ['A', 'B', 'C', 'D'];
    
    // Получаем существующую конфигурацию групп из состояния
    const existingGroups = t.state.groups || {};
    
    // Общие поля (разблокированные)
    const sharedFields = `
      <div class="grid-2">
        <div class="form-group">
          <label>Название турнира</label>
          <input type="text" id="mx-eventName" value="${this._esc(t.meta.eventName)}" placeholder="Название турнира">
        </div>
        <div class="form-group">
          <label>Вид спорта</label>
          <select id="mx-sport">${SPORTS.map(s => '<option value="' + s + '" ' + (t.meta.sport === s ? 'selected' : '') + '>' + formatSport(s) + '</option>').join('')}</select>
        </div>
        <div class="form-group">
          <label>Дата проведения</label>
          <input type="date" id="mx-date" value="${t.meta.eventDate || ''}">
        </div>
      </div>
    `;

    // Блоки групп
    let groupsHtml = '';
    for (let g = 0; g < groupCount; g++) {
      const grp = existingGroups[g] || {};
      const teamCount = grp.teamCount || 4;
      const venue = grp.venue || '';
      const teamNames = grp.teams || Array(teamCount).fill('');
      const groupName = grp.name || groupNames[g] || String.fromCharCode(65 + g);
      
      // Опции количества команд — берём min/maxPerGroup из конфига системы
      const config = MIXED_SYSTEM_CONFIGS[t.meta.systemId] || {};
      const minTeams = config.minTeamsPerGroup || 2;
      const maxTeams = config.maxTeamsPerGroup || 8;
      const teamCountOpts = Array.from({length: maxTeams - minTeams + 1}, (_, i) => i + minTeams)
        .map(n => '<option value="' + n + '" ' + (teamCount === n ? 'selected' : '') + '>' + n + ' ' + this._teamWord(n) + '</option>')
        .join('');

      // Поля названий команд (показываем все для текущего teamCount)
      let teamInputsHtml = '';
      for (let i = 0; i < 16; i++) { // максимум 16 команд в группе
        const val = i < teamNames.length ? teamNames[i] : '';
        const style = i < teamCount ? '' : 'style="display:none;"';
        teamInputsHtml += '<div class="form-group form-group--compact team-field-' + g + '" data-group="' + g + '" data-team-idx="' + i + '" ' + style + '>' +
          '<label>Команда ' + (i + 1) + '</label>' +
          '<input type="text" class="mx-team-inp" data-group="' + g + '" data-team-idx="' + i + '" value="' + this._esc(val) + '" placeholder="Команда ' + (i + 1) + '">' +
          '</div>';
      }

      groupsHtml += `
        <div class="group-config-block" data-group-id="${g}">
          <div class="group-config-header">
            <h3 class="section-title">Группа ${this._esc(groupName)}</h3>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label>Количество команд</label>
              <select class="mx-team-count" data-group="${g}">${teamCountOpts}</select>
            </div>
            <div class="form-group">
              <label>Место проведения матчей группы</label>
              <select class="mx-group-venue" data-group="${g}">
                <option value="">— Выберите —</option>
                ${VENUES.map(v => '<option value="' + this._esc(v) + '" ' + (venue === v ? 'selected' : '') + '>' + this._esc(v) + '</option>').join('')}
              </select>
            </div>
          </div>
          <div class="team-fields-container" id="mx-team-fields-' + g + '">
            ${teamInputsHtml}
          </div>
        </div>
      `;
    }

    return `
      <div class="group-config-card">
        ${sharedFields}
        <div class="groups-config-section">
          <h3 class="section-title">Настройки групп</h3>
          ${groupsHtml}
        </div>
        <div class="generate-actions">
          <button type="button" class="btn btn-success" id="btn-generate">Сгенерировать игры</button>
          <button type="button" class="btn btn-ghost" id="btn-generate-sequential">Распределить команды</button>
        </div>
        <p class="generate-hint">Количество команд и названия задаются для каждой группы отдельно.</p>
      </div>
    `;
  },

  _teamWord(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return 'команд';
    if (mod10 === 1) return 'команда';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'команды';
    return 'команд';
  },

  _metaForm(t) {
    const isGenerated = t.state.roundRobin?.generated === true;
    const config = MIXED_SYSTEM_CONFIGS[t.meta.systemId];
    const teamCounts = config ? (MIXED_TEAM_COUNTS[t.meta.systemId] || [4]) : [4];
    const opts = teamCounts.map(n => '<option value="' + n + '" ' + (t.meta.numTeams === n ? 'selected' : '') + '>' + n + ' команд</option>').join('');
    const disabled = isGenerated ? ' disabled' : '';

    // ИСПРАВЛЕНО: переменная называлась isGroupPhase, но проверяла фазу 'playoff'
    const isPlayoffPhase = t.state.phase === 'playoff';

    return `
      <div class="grid-2">
        <div class="form-group">
          <label>Название мероприятия</label>
          <input type="text" id="f-eventName" value="${this._esc(t.meta.eventName)}" placeholder="Чемпионат района"${disabled}>
        </div>
        <div class="form-group">
          <label>Вид спорта</label>
          <select id="f-sport"${disabled}>${SPORTS.map(s => '<option value="' + s + '" ' + (t.meta.sport === s ? 'selected' : '') + '>' + formatSport(s) + '</option>').join('')}</select>
        </div>
        <div class="form-group">
          <label>Место проведения</label>
          <select id="f-venue"${disabled}>${VENUES.map(v => '<option value="' + this._esc(v) + '" ' + (t.meta.venue === v ? 'selected' : '') + '>' + this._esc(v) + '</option>').join('')}</select>
        </div>
        <div class="form-group">
          <label>Дата проведения</label>
          <input type="date" id="f-date" value="${t.meta.eventDate || ''}"${disabled}>
        </div>
        <div class="form-group">
          <label>Количество команд</label>
          <select id="f-numTeams"${disabled}>${opts}</select>
        </div>
      </div>
      <div id="team-names-block" class="${isGenerated || isPlayoffPhase ? 'hidden' : ''}">
        <h3 class="section-title">Названия команд</h3>
        <div class="team-inputs" id="team-inputs"></div>
        ${!isPlayoffPhase ? '<div class="generate-actions"><button type="button" class="btn btn-success" id="btn-generate">Сгенерировать игры</button><button type="button" class="btn btn-ghost" id="btn-generate-sequential">Распределить команды</button></div>' : ''}
      </div>
    `;
  },

  _pageHeader(title, exportButtonHtml) {
    const actions = [Theme.controlHtml(), exportButtonHtml].filter(Boolean).join('');
    return '<header class="app-header"><div class="app-header__top"><a href="#/" class="btn btn-ghost btn-sm">← Все турниры</a><h1 class="page-title-offset">' + this._esc(title) + '</h1></div><div class="app-header__actions">' + actions + '</div></header>';
  },

  _rrStandingsBlockHtml(teams, matches, standings, sport) {
    return '<div class="standings-scroll is-cards-only" id="standings-scroll"><div class="standings-wrap">' + this._rrTableHtml(teams, matches, standings, sport) + '<span class="standings-scroll-hint" aria-hidden="true">Проведите пальцем влево-вправо для просмотра таблицы</span><div class="standings-cards" role="list">' + this._rrStandingsCardsHtml(teams, standings, sport) + '</div></div></div>';
  },

  _rrTableHtml(teams, matches, standings, sport) {
    const n = teams.length;
    const isHockey = sport === 'хоккей';
    // Создаём lookup-таблицу для быстрого доступа к данным standings по индексу команды
    const standingsMap = {};
    standings.forEach(s => { standingsMap[s.index] = s; });
    
    let h = '<table class="standings-table"><thead><tr><th class="col-sticky-num">№</th><th class="col-sticky-team">Команда</th>';
    for (let i = 1; i <= n; i++) h += '<th>И' + i + '</th>';
    if (isHockey) {
      h += '<th>В</th><th>ВО</th><th>ВБ</th><th>ПБ</th><th>ПО</th><th>П</th><th>ШЗ</th><th>ШП</th><th>Р</th><th>О</th><th>Место</th></tr></thead><tbody>';
    } else {
      h += '<th>В</th><th>Н</th><th>П</th><th>ЗМ</th><th>ПМ</th><th>Р</th><th>О</th><th>Место</th></tr></thead><tbody>';
    }
    // Используем исходный порядок команд из teams, а не отсортированный standings
    teams.forEach((teamName, teamIdx) => {
      const team = standingsMap[teamIdx];
      if (!team) return;
      const plc = team.place <= 3 ? 'place-' + team.place : '';
      h += '<tr><td class="col-sticky-num">' + (team.index + 1) + '</td><td class="col-sticky-team">' + this._esc(team.name) + '</td>';
      for (let j = 0; j < n; j++) {
        if (j === team.index) { h += '<td class="cell-diagonal">—</td>'; }
        else {
          const cell = RoundRobinEngine.getMatchCell(matches, team.index, j);
          if (!cell) h += '<td>—</td>';
          else {
            let cls = 'cell-draw';
            if (cell.scored > cell.conceded) cls = 'cell-win';
            if (cell.scored < cell.conceded) cls = 'cell-loss';
            h += '<td class="' + cls + '"><strong>' + cell.scored + ':' + cell.conceded + '</strong></td>';
          }
        }
      }
      const gd = team.goalsFor - team.goalsAgainst;
      if (isHockey) {
        h += '<td>' + team.wins + '</td><td>' + (team.winsOT || 0) + '</td><td>' + (team.winsSO || 0) + '</td>';
        h += '<td>' + (team.lossesSO || 0) + '</td><td>' + (team.lossesOT || 0) + '</td><td>' + team.losses + '</td>';
      } else {
        h += '<td>' + team.wins + '</td><td>' + team.draws + '</td><td>' + team.losses + '</td>';
      }
      h += '<td>' + team.goalsFor + '</td><td>' + team.goalsAgainst + '</td>';
      h += '<td>' + team.goalsFor + '</td><td>' + team.goalsAgainst + '</td>';
      h += '<td>' + (gd > 0 ? '+' : '') + gd + '</td><td><strong>' + team.points + '</strong></td>';
      h += '<td class="' + plc + '">' + (team.place || '—') + '</td></tr>';
    });
    return h + '</tbody></table>';
  },

  _rrStandingsCardsHtml(teams, standings, sport) {
    const isHockey = sport === 'хоккей';
    const standingsMap = {};
    standings.forEach(s => { standingsMap[s.index] = s; });
    
    return teams.map((teamName, teamIdx) => {
      const team = standingsMap[teamIdx];
      if (!team) return '';
      const gd = team.goalsFor - team.goalsAgainst;
      const plc = team.place <= 3 ? ' place-' + team.place : '';
      const statsHtml = isHockey
        ? '<dt>Очки</dt><dd>' + team.points + '</dd>' +
          '<dt>В / ВО / ВБ</dt><dd>' + team.wins + ' / ' + (team.winsOT || 0) + ' / ' + (team.winsSO || 0) + '</dd>' +
          '<dt>ПБ / ПО / П</dt><dd>' + (team.lossesSO || 0) + ' / ' + (team.lossesOT || 0) + ' / ' + team.losses + '</dd>' +
          '<dt>ШЗ : ШП</dt><dd>' + team.goalsFor + ' : ' + team.goalsAgainst + '</dd>' +
          '<dt>Разница</dt><dd>' + (gd > 0 ? '+' : '') + gd + '</dd>'
        : '<dt>Очки</dt><dd>' + team.points + '</dd>' +
          '<dt>В / Н / П</dt><dd>' + team.wins + ' / ' + team.draws + ' / ' + team.losses + '</dd>' +
          '<dt>ЗМ : ПМ</dt><dd>' + team.goalsFor + ' : ' + team.goalsAgainst + '</dd>' +
          '<dt>Разница</dt><dd>' + (gd > 0 ? '+' : '') + gd + '</dd>';
      return '<article class="standings-card-item' + plc + '" role="listitem">' +
        '<div class="standings-card-item__head">' +
        '<span class="standings-card-item__name">' + (team.index + 1) + '. ' + this._esc(team.name) + '</span>' +
        '<span class="standings-card-item__place">' + (team.place || '—') + '</span>' +
        '</div>' +
        '<dl class="standings-card-item__stats">' +
        statsHtml +
        '</dl></article>';
    }).filter(Boolean).join('');
  },

  _initResponsiveStandings() {
    const block = document.getElementById('standings-scroll');
    const wrap = block?.querySelector('.standings-wrap');
    if (!block || !wrap) return;
    const check = () => { block.classList.toggle('is-scrollable', wrap.scrollWidth > wrap.clientWidth + 2); };
    check();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(check);
      ro.observe(wrap);
    } else {
      window.addEventListener('resize', check, { passive: true });
    }
  },

  _esc(s) {
    if (s == null) return '';
    // ИСПРАВЛЕНО: добавлено экранирование > и одинарной кавычки
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  renderTeamInputs(t) {
    const wrap = document.getElementById('team-inputs');
    if (!wrap) return;
    const n = t.meta.numTeams;
    const names = t.state.teams.length === n ? t.state.teams : Array(n).fill('');
    wrap.innerHTML = names.map((name, i) => '<div class="form-group form-group--compact"><label>Команда ' + (i + 1) + '</label><input type="text" class="team-inp" data-idx="' + i + '" value="' + this._esc(name) + '" placeholder="Название команды ' + (i + 1) + '"></div>').join('');
    wrap.querySelectorAll('.team-inp').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = parseInt(inp.dataset.idx, 10);
        const arr = this._collectTeamNames(t.meta.numTeams);
        arr[idx] = inp.value;
        t.state.teams = arr;
        if (typeof App !== 'undefined') App.persist(t);
      });
    });
  },

  _collectTeamNames(n) {
    const inputs = document.querySelectorAll('.team-inp');
    const arr = Array(n).fill('');
    inputs.forEach(inp => { arr[parseInt(inp.dataset.idx, 10)] = inp.value.trim(); });
    return arr;
  },

  /**
   * Сгенерировать полный HTML для смешанного турнира (групповой этап).
   */
  generateFullGroupStage(t) {
    return this.generateGroupStage(t);
  },

  /**
   * Сгенерировать полный HTML для смешанного турнира (плей-офф).
   */
  generateFullPlayoff(t) {
    return this.generatePlayoffBracket(t);
  }
};

window.MixedUI = MixedUI;

