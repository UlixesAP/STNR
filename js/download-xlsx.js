/**
 * Выгрузка .xlsx — синхронно в обработчике нажатия (важно для iOS/Android).
 * На планшетах показываем панель с явной ссылкой «Сохранить файл».
 */
function sanitizeXlsxFilename(filename) {
  return (
    String(filename || 'export')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\.xlsx$/i, '') + '.xlsx'
  );
}

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isTouchDevice() {
  if (isIOS()) return true;
  if (navigator.maxTouchPoints > 0) {
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia('(pointer: coarse)').matches;
    }
    return true;
  }
  return false;
}

function hideDownloadPanel() {
  const panel = document.getElementById('xlsx-download-panel');
  if (panel) panel.hidden = true;
}

function showDownloadPanel(href, safeName, revoke) {
  let panel = document.getElementById('xlsx-download-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'xlsx-download-panel';
    panel.className = 'xlsx-download-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Сохранение Excel');
    document.body.appendChild(panel);
  }

  panel.innerHTML = `
    <div class="xlsx-download-panel__inner glass">
      <p class="xlsx-download-panel__title">Файл готов</p>
      <p class="xlsx-download-panel__hint">${safeName}</p>
      <a href="${href}" download="${safeName}" class="btn btn-warning xlsx-download-panel__link">Сохранить .xlsx</a>
      <button type="button" class="btn btn-ghost btn-sm xlsx-download-panel__close">Закрыть</button>
    </div>
  `;

  panel.hidden = false;

  const link = panel.querySelector('.xlsx-download-panel__link');
  const closeBtn = panel.querySelector('.xlsx-download-panel__close');

  closeBtn.onclick = () => {
    hideDownloadPanel();
    if (typeof revoke === 'function') revoke();
  };

  link.onclick = () => {
    setTimeout(() => {
      hideDownloadPanel();
      if (typeof revoke === 'function') revoke();
    }, 500);
  };

  if (isTouchDevice()) {
    try {
      link.focus({ preventScroll: true });
    } catch (_) {
      link.focus();
    }
  }
}

function triggerAnchorDownload(href, safeName) {
  const a = document.createElement('a');
  a.href = href;
  a.download = safeName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 0);
}

function downloadXlsxWorkbook(wb, filename) {
  hideDownloadPanel();

  if (typeof XLSX === 'undefined') {
    alert('Библиотека Excel не загружена.\n\nОбновите страницу. Если не помогло — откройте сайт заново.');
    return;
  }

  const safeName = sanitizeXlsxFilename(filename);
  const touch = isTouchDevice();

  try {
    if (isIOS()) {
      const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const dataUrl =
        'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + b64;
      triggerAnchorDownload(dataUrl, safeName);
      showDownloadPanel(dataUrl, safeName, null);
      return;
    }

    const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const revoke = () => URL.revokeObjectURL(url);

    triggerAnchorDownload(url, safeName);

    if (touch) {
      showDownloadPanel(url, safeName, revoke);
    } else {
      setTimeout(revoke, 120000);
    }
  } catch (err) {
    console.error('downloadXlsxWorkbook', err);
    alert('Не удалось создать файл Excel:\n' + (err.message || String(err)));
  }
}
