const ScoreTimer = {
  _intervals: new Map(),

  clear(sessionId) {
    const iv = this._intervals.get(sessionId);
    if (iv) {
      clearInterval(iv);
      this._intervals.delete(sessionId);
    }
  },

  format(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  getElapsedMs(session) {
    const t = session.state.timer;
    let ms = t.elapsedMs || 0;
    if (t.running && t.lastTick) {
      ms += Date.now() - t.lastTick;
    }
    return ms;
  },

  start(session, onTick) {
    const t = session.state.timer;
    if (t.running) return;
    t.running = true;
    t.lastTick = Date.now();
    this.clear(session.id);
    const iv = setInterval(() => {
      onTick?.();
    }, 200);
    this._intervals.set(session.id, iv);
  },

  pause(session) {
    const t = session.state.timer;
    if (t.running && t.lastTick) {
      t.elapsedMs = (t.elapsedMs || 0) + (Date.now() - t.lastTick);
    }
    t.running = false;
    t.lastTick = null;
    this.clear(session.id);
  },

  reset(session) {
    this.pause(session);
    session.state.timer.elapsedMs = 0;
  },

  html() {
    return `
      <div class="score-timer glass">
        <h3 class="score-timer__title">Секундомер</h3>
        <div class="score-timer__display" data-timer-display>00:00</div>
        <div class="score-timer__btns">
          <button type="button" class="btn btn-sm btn-success" data-timer-start>Старт</button>
          <button type="button" class="btn btn-sm btn-ghost" data-timer-pause>Пауза</button>
          <button type="button" class="btn btn-sm btn-danger" data-timer-reset>Сброс</button>
        </div>
      </div>`;
  },

  bind(root, session, persist) {
    const updateDisplay = () => {
      const el = root.querySelector('[data-timer-display]');
      if (el) el.textContent = this.format(this.getElapsedMs(session));
    };

    updateDisplay();

    if (session.state.timer.running) {
      this.start(session, updateDisplay);
    }

    root.querySelector('[data-timer-start]')?.addEventListener('click', () => {
      this.start(session, updateDisplay);
      persist();
      updateDisplay();
    });
    root.querySelector('[data-timer-pause]')?.addEventListener('click', () => {
      this.pause(session);
      persist();
      updateDisplay();
    });
    root.querySelector('[data-timer-reset]')?.addEventListener('click', () => {
      if (confirm('Сбросить секундомер на ноль?')) {
        this.reset(session);
        persist();
        updateDisplay();
      }
    });
  }
};
