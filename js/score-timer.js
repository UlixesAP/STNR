const ScoreTimer = {
  _intervals: new Map(),
  _onTickCallbacks: new Map(),

  /** Убирает intervalы всех сессий, кроме текущей. Нужно при переключении сессий. */
  pruneOtherIntervals(currentSessionId) {
    for (const [sid, iv] of this._intervals) {
      if (sid !== currentSessionId) {
        clearInterval(iv);
        this._intervals.delete(sid);
        this._onTickCallbacks.delete(sid);
      }
    }
  },

  clear(sessionId) {
    const iv = this._intervals.get(sessionId);
    if (iv) {
      clearInterval(iv);
      this._intervals.delete(sessionId);
      this._onTickCallbacks.delete(sessionId);
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

    // Интервал уже запущен — просто обновляем onTick, не сбрасываем lastTick
    if (t.running && this._intervals.has(session.id)) {
      this._onTickCallbacks.set(session.id, onTick);
      return;
    }

    // Обновляем elapsedMs текущим временем, чтобы не потерять накопленное время
    if (t.running && t.lastTick) {
      t.elapsedMs = (t.elapsedMs || 0) + (Date.now() - t.lastTick);
    }

    t.running = true;
    t.lastTick = Date.now();
    this.clear(session.id);

    const iv = setInterval(() => {
      const tick = this._onTickCallbacks.get(session.id);
      tick?.();
    }, 200);

    this._intervals.set(session.id, iv);
    this._onTickCallbacks.set(session.id, onTick);
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

const HockeyTimer = {
  _interval: null,

  clear() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  },

  formatSeconds(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  html() {
    return `
      <div class="score-timer glass score-timer--hockey">
        <h3 class="score-timer__title">Обратный отсчёт</h3>
        <div class="score-timer__display" data-hockey-timer-display>00:00</div>
        <div class="score-timer__time-settings">
          <div class="score-timer__time-buttons">
            <button type="button" class="btn btn-sm btn-ghost" data-hockey-add="5">+5 мин</button>
            <button type="button" class="btn btn-sm btn-ghost" data-hockey-add="15">+15 мин</button>
            <button type="button" class="btn btn-sm btn-ghost" data-hockey-add="20">+20 мин</button>
          </div>
          <div class="score-timer__time-buttons">
            <button type="button" class="btn btn-sm btn-ghost" data-hockey-sub="5">-5 мин</button>
            <button type="button" class="btn btn-sm btn-ghost" data-hockey-sub="15">-15 мин</button>
            <button type="button" class="btn btn-sm btn-ghost" data-hockey-sub="20">-20 мин</button>
          </div>
        </div>
        <div class="score-timer__btns">
          <button type="button" class="btn btn-sm btn-success" data-hockey-start>Старт</button>
          <button type="button" class="btn btn-sm btn-ghost" data-hockey-pause>Пауза</button>
          <button type="button" class="btn btn-sm btn-danger" data-hockey-reset>Сброс</button>
        </div>
      </div>`;
  },

  bind(root, session, persist, onTimerStart, onPeriodEnd) {
    const state = session.state;

    // Инициализация состояния HockeyTimer при необходимости
    // Используем отдельное поле state.hockeyTimer, чтобы не конфликтовать с ScoreTimer
    if (!state.hockeyTimer) {
      state.hockeyTimer = { totalSeconds: 300, baseSeconds: 300, running: false, startedAt: null };
    }
    // Гарантируем что baseSeconds установлен
    if (state.hockeyTimer.baseSeconds == null) {
      state.hockeyTimer.baseSeconds = state.hockeyTimer.totalSeconds > 0 ? state.hockeyTimer.totalSeconds : 300;
    }

    // Очищаем старый интервал ПЕРЕД любым обновлением DOM
    this.clear();

    const updateDisplay = () => {
      const el = root.querySelector('[data-hockey-timer-display]');
      if (!el) return;

      // Если hockeyTimer не инициализирован, показываем 00:00
      if (!state.hockeyTimer) {
        el.textContent = this.formatSeconds(0);
        return;
      }

      // Всегда читаем startedAt и baseSeconds напрямую из state — никаких захваченных переменных
      if (state.hockeyTimer.running && state.hockeyTimer.startedAt != null && state.hockeyTimer.baseSeconds != null) {
        const elapsed = Math.floor((Date.now() - state.hockeyTimer.startedAt) / 1000);
        state.hockeyTimer.totalSeconds = Math.max(0, state.hockeyTimer.baseSeconds - elapsed);
      }

      el.textContent = this.formatSeconds(state.hockeyTimer.totalSeconds || 0);

      if (state.hockeyTimer.totalSeconds === 0 && state.hockeyTimer.running) {
        this.clear();
        state.hockeyTimer.running = false;
        state.hockeyTimer.startedAt = null;
        persist();

        // Вызываем callback завершения периода если передан
        if (typeof onPeriodEnd === 'function') {
          onPeriodEnd();
        }
      }
    };

    // Если таймер был запущен при загрузке страницы, восстанавливаем startedAt
    if (state.hockeyTimer.running && state.hockeyTimer.startedAt == null) {
      state.hockeyTimer.startedAt = Date.now() - ((state.hockeyTimer.baseSeconds || 300) - state.hockeyTimer.totalSeconds) * 1000;
    }

    // Запускаем интервал если таймер был в состоянии running
    if (state.hockeyTimer.running) {
      this._interval = setInterval(() => {
        updateDisplay();
      }, 500);
    }

    updateDisplay();

    const startTimer = () => {
      if (!state.hockeyTimer) {
        state.hockeyTimer = { totalSeconds: 300, baseSeconds: 300, running: false, startedAt: null };
      }
      if (state.hockeyTimer.totalSeconds <= 0) {
        state.hockeyTimer.totalSeconds = 300;
        state.hockeyTimer.baseSeconds = 300;
      }
      state.hockeyTimer.running = true;
      state.hockeyTimer.startedAt = Date.now() - ((state.hockeyTimer.baseSeconds || 300) - state.hockeyTimer.totalSeconds) * 1000;
      this.clear();
      this._interval = setInterval(() => {
        updateDisplay();
      }, 500);
      // Вызываем callback при старте таймера
      if (typeof onTimerStart === 'function') {
        onTimerStart();
      }
      persist();
      updateDisplay();
    };

    const pauseTimer = () => {
      this.clear();
      if (state.hockeyTimer && state.hockeyTimer.startedAt != null && state.hockeyTimer.baseSeconds != null) {
        state.hockeyTimer.totalSeconds = Math.max(0, state.hockeyTimer.baseSeconds - Math.floor((Date.now() - state.hockeyTimer.startedAt) / 1000));
      }
      if (state.hockeyTimer) {
        state.hockeyTimer.running = false;
        state.hockeyTimer.startedAt = null;
      }
      persist();
      updateDisplay();
    };

    const resetTimer = () => {
      this.clear();
      if (state.hockeyTimer) {
        state.hockeyTimer.running = false;
        state.hockeyTimer.startedAt = null;
        state.hockeyTimer.totalSeconds = 0;
      }
      persist();
      updateDisplay();
    };

    const addMinutes = (minutes) => {
      if (!state.hockeyTimer || !state.hockeyTimer.running) {
        if (state.hockeyTimer) {
          state.hockeyTimer.totalSeconds += minutes * 60;
        }
        persist();
        updateDisplay();
      }
    };

    const subMinutes = (minutes) => {
      if (!state.hockeyTimer || !state.hockeyTimer.running) {
        if (state.hockeyTimer) {
          state.hockeyTimer.totalSeconds = Math.max(0, state.hockeyTimer.totalSeconds - minutes * 60);
        }
        persist();
        updateDisplay();
      }
    };

    // Всегда перепривязываем — никаких hasListener, т.к. DOM полностью перерисовывается
    root.querySelector('[data-hockey-start]')?.addEventListener('click', startTimer);
    root.querySelector('[data-hockey-pause]')?.addEventListener('click', pauseTimer);
    root.querySelector('[data-hockey-reset]')?.addEventListener('click', resetTimer);

    root.querySelectorAll('[data-hockey-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const minutes = parseInt(btn.dataset.hockeyAdd, 10);
        addMinutes(minutes);
      });
    });

    root.querySelectorAll('[data-hockey-sub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const minutes = parseInt(btn.dataset.hockeySub, 10);
        subMinutes(minutes);
      });
    });
  }
};
