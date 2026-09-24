import express from 'express';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
app.use(express.json({ limit: '5mb' }));

const RESULTS_DIR = path.join(process.cwd(), 'results');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

let clients = [];
let lastBroadcastHTML = null;

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  clients.push(res);
  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

function broadcast(obj) {
  const msg = `data: ${JSON.stringify(obj)}\n\n`;
  clients.forEach(c => c.write(msg));
}

function sanitizeFilename(name) {
  return String(name || 'export').replace(/[<>:"/\\|?*]/g, '_');
}

app.post('/publish', (req, res) => {
  try {
    const { html } = req.body || {};
    if (!html) {
      return res.json({ ok: false, error: 'html is empty' });
    }
    if (html === lastBroadcastHTML) {
      return res.json({ ok: true, status: 'unchanged' });
    }
    lastBroadcastHTML = html;
    broadcast({ html });
    res.json({ ok: true, status: 'sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/save', async (req, res) => {
  try {
    const { filename, wbData } = req.body;

    if (!wbData || !Array.isArray(wbData)) {
      return res.status(400).json({ ok: false, error: 'wbData missing or invalid' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Турнирная таблица');

    wbData.forEach(row => {
      worksheet.addRow(row);
    });

    worksheet.columns.forEach((column, i) => {
      column.width = Math.max(12, wbData.reduce((max, row) => Math.max(max, String(row[i] || '').length), 12));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    
    const safe = sanitizeFilename(filename || `result_${Date.now()}`) + '.xlsx';
    const outPath = path.join(RESULTS_DIR, safe);
    fs.writeFileSync(outPath, buffer);

    res.json({ ok: true, path: `/results/${safe}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.use('/results', express.static(RESULTS_DIR));
app.use(express.static(path.join(__dirname, 'dist')));

app.get('/viewer', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'viewer.html'));
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
