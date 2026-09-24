const MetaForm = {
  _metaForm(t, teamOptions) {
    const isGenerated = t.state.generated === true;
    let counts;
    if (t.type === 'round-robin') {
      counts = RR_TEAM_COUNTS;
    } else if (t.type === 'mixed' && t.meta.systemId) {
      counts = MIXED_TEAM_COUNTS[t.meta.systemId] || OLY_TEAM_COUNTS;
    } else {
      counts = OLY_TEAM_COUNTS;
    }
    const opts = counts
      .map((n) => `<option value="${n}" ${t.meta.numTeams === n ? 'selected' : ''}>${n} команд</option>`)
      .join('');

    const disabled = isGenerated ? ' disabled' : '';

    return `
      <div class="grid-2">
        <div class="form-group">
          <label>Название мероприятия</label>
          <input type="text" id="f-eventName" value="${this._esc(t.meta.eventName)}" placeholder="Чемпионат района"${disabled}>
        </div>
        <div class="form-group">
          <label>Вид спорта</label>
          <select id="f-sport"${disabled}>${SPORTS.map((s) => `<option value="${s}" ${t.meta.sport === s ? 'selected' : ''}>${formatSport(s)}</option>`).join('')}</select>
        </div>
        <div class="form-group">
          <label>Место проведения</label>
          <select id="f-venue"${disabled}>${VENUES.map((v) => `<option value="${this._esc(v)}" ${t.meta.venue === v ? 'selected' : ''}>${this._esc(v)}</option>`).join('')}</select>
        </div>
        <div class="form-group">
          <label>Дата проведения</label>
          <input type="date" id="f-date" value="${t.meta.eventDate || ''}"${disabled}>
        </div>
        <div class="form-group">
          <label>Шаблон (количество команд)</label>
          <select id="f-numTeams"${disabled}>${opts}</select>
        </div>
      </div>
      <div id="team-names-block" class="${t.state.generated ? 'hidden' : ''}">
        <h3 class="section-title">Названия команд</h3>
        <div class="team-inputs" id="team-inputs"></div>
        ${
          t.type === 'olympic'
            ? `<div class="generate-actions">
<button type="button" class="btn btn-success" id="btn-generate-sequential">Распределить команды</button>
                <button type="button" class="btn btn-ghost" id="btn-generate">Сгенерировать игры</button>
              </div>
              <p class="generate-hint">«Сгенерировать игры» — случайные пары; «Распределить команды» — по порядку в списке (1 с 2, 3 с 4 и т.д.).</p>`
            : t.type === 'round-robin'
? `<div class="generate-actions">
                <button type="button" class="btn btn-success" id="btn-generate-sequential">Распределить команды</button>
                <button type="button" class="btn btn-ghost" id="btn-generate">Сгенерировать игры</button>
              </div>
                <p class="generate-hint">«Сгенерировать игры» — случайный порядок матчей. «Распределить команды» — фиксированное расписание по турам (для 4–20 команд).</p>`
              : t.type === 'mixed'
                ? `<div class="generate-actions">
<button type="button" class="btn btn-success" id="btn-generate-sequential">Распределить команды</button>
                    <button type="button" class="btn btn-ghost" id="btn-generate">Сгенерировать игры</button>
                  </div>
                  <p class="generate-hint">«Сгенерировать игры» — случайный порядок пар. «Распределить команды» — фиксированное круговое расписание по турам.</p>`
                : `<button type="button" class="btn btn-success" id="btn-generate">Сгенерировать игры</button>`
        }
      </div>
    `;
  },

  _bindMeta(t, onMetaChange) {
    ['f-eventName', 'f-sport', 'f-venue', 'f-date', 'f-numTeams'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        t.meta.eventName = document.getElementById('f-eventName').value.trim();
        t.meta.sport = document.getElementById('f-sport').value;
        t.meta.venue = document.getElementById('f-venue').value;
        t.meta.eventDate = document.getElementById('f-date').value;
        const n = parseInt(document.getElementById('f-numTeams').value, 10);
        if (n !== t.meta.numTeams) {
          const oldTeams = [...t.state.teams];
          t.meta.numTeams = n;
          t.state.generated = false;
          t.state.teams = Array(n).fill('');
          oldTeams.forEach((name, i) => {
            if (i < n) t.state.teams[i] = name;
          });
          if (t.type === 'round-robin') {
            t.state.matches = [];
            t.state.scheduleMode = null;
          } else {
            t.state.bracket = {
              totalTeams: n,
              flow: 'standard',
              rounds: [],
              waiting: {},
              finalMatch: null,
              thirdPlaceMatch: null,
              thirdPlaceTeam: null
            };
            t.state.matchHistory = [];
          }
        }
        this.persist(t);
        if (!t.state.generated) {
          this._renderTeamInputs(t);
        }
        onMetaChange();
      });
      el.addEventListener('input', () => {
        if (id === 'f-eventName') {
          t.meta.eventName = document.getElementById('f-eventName').value.trim();
          this.persist(t);
        }
      });
    });
  },

  _renderTeamInputs(t) {
    const wrap = document.getElementById('team-inputs');
    if (!wrap) return;
    const n = t.meta.numTeams;
    const teams = Array.isArray(t.state.teams) ? t.state.teams : [];
    const names = teams.length === n ? teams : Array(n).fill('');
    wrap.innerHTML = names
      .map(
        (name, i) => `
      <div class="form-group form-group--compact">
        <label>Команда ${i + 1}</label>
        <input type="text" class="team-inp" data-idx="${i}" value="${this._esc(name)}" placeholder="Название команды ${i + 1}">
      </div>`
      )
      .join('');

    wrap.querySelectorAll('.team-inp').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = parseInt(inp.dataset.idx, 10);
        const arr = this._collectTeamNames(t.meta.numTeams);
        arr[idx] = inp.value;
        t.state.teams = arr;
        this.persist(t);
      });
    });
  },

  _collectTeamNames(n) {
    const inputs = document.querySelectorAll('.team-inp, .mx-team-inp');
    const arr = Array(n).fill('');
    inputs.forEach((inp) => {
      const idx = inp.dataset.idx !== undefined ? inp.dataset.idx : inp.dataset.teamIdx;
      if (idx !== undefined) {
        arr[parseInt(idx, 10)] = inp.value.trim();
      }
    });
    return arr;
  }
};

window.MetaForm = MetaForm;

