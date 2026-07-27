// round-robin-logic.js - Полная реализация круговой системы

const ExcelJS = window.ExcelJS;

document.addEventListener('DOMContentLoaded', function() {
    // DOM элементы
    const numTeamsSelect = document.getElementById('numTeams');
    const teamsInputContainer = document.getElementById('teamsInputContainer');
    const teamsInputsDiv = document.getElementById('teamsInputs');
    const generateBtn = document.getElementById('generateScheduleBtn');
    const scheduleContainer = document.getElementById('scheduleContainer');
    const matchesInputDiv = document.getElementById('matchesInput');
    const tableContainer = document.getElementById('tableContainer');
    const exportBtn = document.getElementById('exportBtn');

    // Данные турнира
    let teams = [];
    let matches = [];
    let standings = [];
    let tournamentStarted = false;
    let publishEnabled = false;
    let autoSaved = false;

    // Заполнение выпадающих списков при загрузке
    function populateSelects() {
        // Виды спорта
        const sportSelect = document.getElementById('sportType');
        if (sportSelect) {
            const sports = ['футбол', 'хоккей', 'стритбол', 'баскетбол', 'волейбол', 'лапта', 'регби'];
            sportSelect.innerHTML = sports.map(sport => 
                `<option value="${sport}">${sport.charAt(0).toUpperCase() + sport.slice(1)}</option>`
            ).join('');
        }

        // Места проведения
        const venueSelect = document.getElementById('venue');
        if (venueSelect) {
            const venues = [
                'ул. Коллонтай, д. 32, корп. 2',
                'Искровский пр., д. 4, корп. 3',
                'Искровский пр., д. 6, корп. 7',
                'ул. Запорожская, д. 23, корп. 2',
                'ул. Народная, д. 43',
                'ул. Народная, д. 98',
                'ул. Тельмана, д. 43, корп. 3',
                'Октябрьская наб., д. 118, корп. 7',
                'ул. Караваевская, д. 40, корп. 1',
                'ул. Прибрежная, д. 16',
                'пр. Елизарова, д. 20',
                'ул. Седова, д. 28',
                'пр. Обуховской Обороны (Невский Завод)',
                'ул. Полярников, д. 15',
                'ул. Подвойского, д. 46',
                'ул. Подвойского, д. 42',
                'пр. Солидарности, д.21',
                'ул. Крыленко, д. 27',
                'ул. Дыбенко, д. 13, корп. 1',
                'ул. Дыбенко, д. 17, корп. 3',
                'Железнодорожный пр., д. 32 (ФОК)',
                'ул. Бабушкина, д. 30 (Ледовая арена)'
            ];
            venueSelect.innerHTML = venues.map(venue => 
                `<option value="${venue}">${venue}</option>`
            ).join('');
        }
    }

    populateSelects();

    // Обработчик изменения количества команд
    if (numTeamsSelect) {
        numTeamsSelect.addEventListener('change', function() {
            const num = parseInt(this.value);
            teamsInputsDiv.innerHTML = '';
            
            for (let i = 0; i < num; i++) {
                const inputContainer = document.createElement('div');
                inputContainer.style.marginBottom = '15px';
                
                const label = document.createElement('label');
                label.textContent = `Команда ${i + 1}:`;
                label.style.display = 'block';
                label.style.marginBottom = '5px';
                label.style.fontWeight = '600';
                
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = `Введите название команды ${i + 1}`;
                input.classList.add('team-name-input');
                input.style.width = '100%';
                input.style.padding = '12px';
                input.style.border = '2px solid #dcdde1';
                input.style.borderRadius = '8px';
                input.style.fontSize = '1rem';
                
                inputContainer.appendChild(label);
                inputContainer.appendChild(input);
                teamsInputsDiv.appendChild(inputContainer);
            }
            
            teamsInputContainer.classList.remove('hidden');
            scheduleContainer.classList.add('hidden');
            tournamentStarted = false;
        });
    }

    // Генерация расписания
    if (generateBtn) {
        generateBtn.addEventListener('click', function() {
            const inputs = document.querySelectorAll('.team-name-input');
            teams = Array.from(inputs).map(inp => inp.value.trim()).filter(name => name !== '');
            
            if (teams.length !== parseInt(numTeamsSelect.value)) {
                alert('Заполните все названия команд!');
                return;
            }
            
            // Проверка на уникальность названий
            const uniqueTeams = new Set(teams);
            if (uniqueTeams.size !== teams.length) {
                alert('Названия команд должны быть уникальными!');
                return;
            }
            
            generateRoundRobinMatches();
            renderMatchInputs();
            initializeStandings();
            renderTable();
            scheduleContainer.classList.remove('hidden');
            tournamentStarted = true;
            
            // Прокрутка к расписанию
            scheduleContainer.scrollIntoView({ behavior: 'smooth' });
        });
    }

    function generateRoundRobinMatches() {
        matches = [];
        const n = teams.length;
        
        // Генерируем все пары для кругового турнира
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                matches.push({ 
                    teamA: i, 
                    teamB: j, 
                    scoreA: null, 
                    scoreB: null,
                    isPlayed: false
                });
            }
        }
        
        // Перемешиваем матчи для случайного порядка отображения
        shuffleArray(matches);
    }

    function renderMatchInputs() {
        matchesInputDiv.innerHTML = `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <h3 style="color: #2c3e50; margin-bottom: 20px;">Введите результаты матчей:</h3>
                <div id="matchesList"></div>
            </div>
        `;
        
        const matchesList = document.getElementById('matchesList');
        
        matches.forEach((match, index) => {
            const matchDiv = document.createElement('div');
            matchDiv.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 15px;
                margin-bottom: 10px;
                background: white;
                border-radius: 8px;
                border: 1px solid #e1e8ed;
                transition: all 0.3s ease;
            `;
            matchDiv.id = `match-row-${index}`;
            
            matchDiv.innerHTML = `
                <div style="flex: 1; text-align: right; padding-right: 15px;">
                    <span style="font-weight: 600; color: #2c3e50;">${teams[match.teamA]}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="number" 
                           min="0" 
                           class="match-result-input scoreA" 
                           data-match-index="${index}" 
                           placeholder="0"
                           style="width: 70px; text-align: center; font-size: 1.1em; font-weight: bold;">
                    <span style="font-size: 1.2em; font-weight: bold; color: #7f8c8d;">:</span>
                    <input type="number" 
                           min="0" 
                           class="match-result-input scoreB" 
                           data-match-index="${index}" 
                           placeholder="0"
                           style="width: 70px; text-align: center; font-size: 1.1em; font-weight: bold;">
                </div>
                <div style="flex: 1; padding-left: 15px;">
                    <span style="font-weight: 600; color: #2c3e50;">${teams[match.teamB]}</span>
                </div>
                <div id="match-status-${index}" style="margin-left: 15px; min-width: 100px; text-align: center;">
                    <span style="color: #95a5a6; font-style: italic;">Ожидание</span>
                </div>
            `;
            
            matchesList.appendChild(matchDiv);
        });

        // Добавляем обработчики событий на все поля ввода
        document.querySelectorAll('.scoreA, .scoreB').forEach(input => {
            input.addEventListener('input', function() {
                updateMatchResult(this);
            });
            
            // Добавляем обработку потери фокуса для валидации
            input.addEventListener('blur', function() {
                if (this.value === '' || isNaN(parseInt(this.value)) || parseInt(this.value) < 0) {
                    this.value = '';
                }
            });
        });
    }

    function updateMatchResult(input) {
        const matchIndex = parseInt(input.dataset.matchIndex);
        const match = matches[matchIndex];
        
        // Получаем значения обоих полей
        const scoreAInput = document.querySelector(`.scoreA[data-match-index="${matchIndex}"]`);
        const scoreBInput = document.querySelector(`.scoreB[data-match-index="${matchIndex}"]`);
        
        const scoreA = scoreAInput.value === '' ? null : parseInt(scoreAInput.value);
        const scoreB = scoreBInput.value === '' ? null : parseInt(scoreBInput.value);
        
        match.scoreA = scoreA;
        match.scoreB = scoreB;
        
        // Проверяем, заполнены ли оба поля
        const statusDiv = document.getElementById(`match-status-${matchIndex}`);
        const matchRow = document.getElementById(`match-row-${matchIndex}`);
        
        if (scoreA !== null && scoreB !== null) {
            match.isPlayed = true;
            
            // Определяем победителя для подсветки
            if (scoreA > scoreB) {
                statusDiv.innerHTML = `<span style="color: #27ae60; font-weight: bold;">${teams[match.teamA]} выигрывает</span>`;
                matchRow.style.borderLeft = '4px solid #27ae60';
            } else if (scoreB > scoreA) {
                statusDiv.innerHTML = `<span style="color: #27ae60; font-weight: bold;">${teams[match.teamB]} выигрывает</span>`;
                matchRow.style.borderLeft = '4px solid #27ae60';
            } else {
                statusDiv.innerHTML = `<span style="color: #f39c12; font-weight: bold;">Ничья</span>`;
                matchRow.style.borderLeft = '4px solid #f39c12';
            }
            matchRow.style.backgroundColor = '#f8fff8';
        } else {
            match.isPlayed = false;
            statusDiv.innerHTML = `<span style="color: #95a5a6; font-style: italic;">Ожидание</span>`;
            matchRow.style.borderLeft = '1px solid #e1e8ed';
            matchRow.style.backgroundColor = 'white';
        }
        
        // Обновляем турнирную таблицу
        if (tournamentStarted) {
            calculateStandings();
            renderTable();
        }
    }

    function initializeStandings() {
        standings = teams.map((name, index) => ({
            name: name,
            index: index,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            points: 0,
            place: 0,
            headToHead: {}
        }));
    }

    function calculateStandings() {
        // Сбрасываем статистику
        standings.forEach(team => {
            team.played = 0;
            team.wins = 0;
            team.draws = 0;
            team.losses = 0;
            team.goalsFor = 0;
            team.goalsAgainst = 0;
            team.points = 0;
            team.headToHead = {};
        });

        // Обрабатываем все сыгранные матчи
        matches.forEach(match => {
            if (match.isPlayed && match.scoreA !== null && match.scoreB !== null) {
                const teamA = standings[match.teamA];
                const teamB = standings[match.teamB];

                teamA.played++;
                teamB.played++;
                teamA.goalsFor += match.scoreA;
                teamA.goalsAgainst += match.scoreB;
                teamB.goalsFor += match.scoreB;
                teamB.goalsAgainst += match.scoreA;

                // Определяем результат матча
                if (match.scoreA > match.scoreB) {
                    // Победила команда A
                    teamA.wins++;
                    teamB.losses++;
                    teamA.points += 3;
                    teamA.headToHead[match.teamB] = 'win';
                    teamB.headToHead[match.teamA] = 'loss';
                } else if (match.scoreA < match.scoreB) {
                    // Победила команда B
                    teamB.wins++;
                    teamA.losses++;
                    teamB.points += 3;
                    teamA.headToHead[match.teamB] = 'loss';
                    teamB.headToHead[match.teamA] = 'win';
                } else {
                    // Ничья
                    teamA.draws++;
                    teamB.draws++;
                    teamA.points += 1;
                    teamB.points += 1;
                    teamA.headToHead[match.teamB] = 'draw';
                    teamB.headToHead[match.teamA] = 'draw';
                }
            }
        });

        // Рассчитываем места команд
        calculatePlaces();
    }

    function calculatePlaces() {
        // Создаем копию массива для сортировки
        const sortedStandings = [...standings];
        
        // Сортируем копию согласно правилам турнира
        sortedStandings.sort((a, b) => {
            // 1. По очкам (по убыванию)
            if (a.points !== b.points) {
                return b.points - a.points;
            }
            
            // 2. При равенстве очков - по личным встречам
            const h2hA = a.headToHead[b.index];
            const h2hB = b.headToHead[a.index];
            
            if (h2hA === 'win' && h2hB === 'loss') {
                return -1; // a выше b
            }
            if (h2hA === 'loss' && h2hB === 'win') {
                return 1; // b выше a
            }
            
            // 3. При равенстве в личных встречах - по разнице мячей
            const diffA = a.goalsFor - a.goalsAgainst;
            const diffB = b.goalsFor - b.goalsAgainst;
            
            if (diffA !== diffB) {
                return diffB - diffA;
            }
            
            // 4. При равенстве разницы - по забитым мячам
            if (a.goalsFor !== b.goalsFor) {
                return b.goalsFor - a.goalsFor;
            }
            
            // 5. Если всё равно - по алфавиту
            return a.name.localeCompare(b.name);
        });

        // Присваиваем места в оригинальном массиве
        sortedStandings.forEach((team, index) => {
            const originalTeam = standings.find(t => t.index === team.index);
            if (originalTeam) {
                originalTeam.place = index + 1;
            }
        });
    }

    function renderTable() {
        const n = teams.length;
        
        let html = `
            <div style="overflow-x: auto; margin: 20px 0;">
                <table style="min-width: 100%; border-collapse: collapse; background: white;">
                    <thead>
                        <tr style="background: #34495e; color: white;">
                            <th style="padding: 12px; text-align: center; font-weight: bold;">№</th>
                            <th style="padding: 12px; text-align: left; font-weight: bold; min-width: 150px;">Команда</th>
        `;
        
        // Заголовки для игр
        for (let i = 1; i <= n; i++) {
            html += `<th style="padding: 8px; text-align: center; font-weight: bold;">И${i}</th>`;
        }
        
        html += `
                            <th style="padding: 8px; text-align: center; font-weight: bold; background: #2c3e50;">В</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; background: #2c3e50;">Н</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; background: #2c3e50;">П</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; background: #2c3e50;">ЗМ</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; background: #2c3e50;">ПМ</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; background: #2c3e50;">Р</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; background: #2980b9;">О</th>
                            <th style="padding: 8px; text-align: center; font-weight: bold; background: #e74c3c;">Место</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Данные команд в ИСХОДНОМ порядке (как они были введены)
        standings.forEach((team) => {
            const position = team.index + 1; // Исходный номер команды
            html += '<tr style="border-bottom: 1px solid #ecf0f1;">';
            html += `<td style="padding: 10px; text-align: center; font-weight: bold; background: #f8f9fa;">${position}</td>`;
            html += `<td style="padding: 10px; text-align: left; font-weight: 600;">${team.name}</td>`;
            
            // Результаты игр
            for (let j = 0; j < n; j++) {
                if (j === team.index) {
                    // Синий блок для своей команды
                    html += '<td style="background: #3498db; color: white; text-align: center; font-weight: bold;">X</td>';
                } else {
                    // Ищем матч между этими командами
                    const match = matches.find(m => 
                        (m.teamA === team.index && m.teamB === j) || 
                        (m.teamA === j && m.teamB === team.index)
                    );
                    
                    if (match && match.isPlayed && match.scoreA !== null && match.scoreB !== null) {
                        // Определяем счет для текущей команды
                        if (match.teamA === team.index) {
                            // Команда была первой в матче
                            const bgColor = match.scoreA > match.scoreB ? '#d5f5e3' : match.scoreA < match.scoreB ? '#fadbd8' : '#fef9e7';
                            html += `<td style="text-align: center; background: ${bgColor};">
                                <strong>${match.scoreA}:${match.scoreB}</strong>
                            </td>`;
                        } else {
                            // Команда была второй в матче
                            const bgColor = match.scoreB > match.scoreA ? '#d5f5e3' : match.scoreB < match.scoreA ? '#fadbd8' : '#fef9e7';
                            html += `<td style="text-align: center; background: ${bgColor};">
                                <strong>${match.scoreB}:${match.scoreA}</strong>
                            </td>`;
                        }
                    } else {
                        html += '<td style="text-align: center; color: #bdc3c7;">-</td>';
                    }
                }
            }
            
            const goalDifference = team.goalsFor - team.goalsAgainst;
            const placeColor = team.place === 1 ? '#f1c40f' : 
                              team.place === 2 ? '#bdc3c7' : 
                              team.place === 3 ? '#cd7f32' : '#ecf0f1';
            
            html += `
                <td style="text-align: center; font-weight: bold;">${team.wins}</td>
                <td style="text-align: center;">${team.draws}</td>
                <td style="text-align: center;">${team.losses}</td>
                <td style="text-align: center;">${team.goalsFor}</td>
                <td style="text-align: center;">${team.goalsAgainst}</td>
                <td style="text-align: center; font-weight: bold; color: ${goalDifference > 0 ? '#27ae60' : goalDifference < 0 ? '#e74c3c' : '#34495e'};">
                    ${goalDifference > 0 ? '+' : ''}${goalDifference}
                </td>
                <td style="text-align: center; font-size: 1.2em; font-weight: bold; color: #2980b9;">${team.points}</td>
                <td style="text-align: center; font-weight: bold; background: ${placeColor}; color: #2c3e50;">
                    ${team.place || '-'}
                </td>
            `;
            
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        
        // Добавляем легенду
        html += `
            <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px; font-size: 0.9em;">
                <strong>Легенда:</strong>
                <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-top: 10px;">
                    <span>🟢 Победа</span>
                    <span>🟡 Ничья</span>
                    <span>🔴 Поражение</span>
                    <span>🔵 Своя игра</span>
                </div>
                <div style="margin-top: 5px; color: #7f8c8d;">
                    В - Выигрыши | Н - Ничьи | П - Поражения | ЗМ - Забитые мячи | ПМ - Пропущенные мячи | Р - Разница | О - Очки
                </div>
            </div>
        `;
        
        tableContainer.innerHTML = html;
        // После отрисовки — проверить завершение турнира и отправить обновление при включённой трансляции
        checkTournamentFinished();
        if (publishEnabled) publishTable();
    }

    // Экспорт в Excel
    if (exportBtn) {
        exportBtn.addEventListener('click', async function() {
            if (!tournamentStarted) {
                alert('Сначала создайте турнир и введите результаты!');
                return;
            }
            
            await buildWsData();
        });

        // Создаём кнопку управления трансляцией (если её ещё нет)
        (function createPublishBtn(){
            if (document.getElementById('publishBtn')) return;
            const btn = document.createElement('button');
            btn.id = 'publishBtn';
            btn.className = 'btn btn-outline';
            btn.textContent = 'Онлайн трансляция: выкл';
            exportBtn.parentNode && exportBtn.parentNode.appendChild(btn);
            btn.addEventListener('click', function(){
                publishEnabled = !publishEnabled;
                btn.textContent = 'Онлайн трансляция: ' + (publishEnabled ? 'вкл' : 'выкл');
                if (publishEnabled) {
                    alert('Запустите сервер: npm run serve (порт 3333) и откройте /viewer для просмотра.');
                    publishTable();
                }
            });
        })();

        // Кнопка ручного сохранения на сервер
        (function createSaveBtn(){
            if (document.getElementById('saveServerBtn')) return;
            const btn = document.createElement('button');
            btn.id = 'saveServerBtn';
            btn.className = 'btn btn-primary';
            btn.textContent = 'Сохранить на сервер';
            exportBtn.parentNode && exportBtn.parentNode.appendChild(btn);
            btn.addEventListener('click', function(){
                if (!tournamentStarted) { alert('Сначала создайте турнир и введите результаты!'); return; }
                saveToServer();
            });
        })();

        async function buildWsData() {
            const eventName = document.getElementById('eventName')?.value || 'Турнир';
            const sportType = document.getElementById('sportType')?.value || '';
            const venue = document.getElementById('venue')?.value || '';
            const eventDate = document.getElementById('eventDate')?.value || '';
            const n = teams.length;
            const filename = (eventName).replace(/\s+/g, '_') + '.xlsx';

            // ── Инициализация книги ──────────────────────────────────────────────────
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'TournamentApp';
            workbook.created = new Date();

            const ws = workbook.addWorksheet('Турнирная таблица', {
                views: [{ showGridLines: false }]
            });

            // ── Вспомогательные функции стилей ──────────────────────────────────────

            const fill = (hex) => ({
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF' + hex }
            });

            const thinBorder = (color = '000000') => {
                const side = { style: 'thin', color: { argb: 'FF' + color } };
                return { top: side, left: side, bottom: side, right: side };
            };

            const styleRange = (startRow, startCol, endRow, endCol, styleFn) => {
                for (let r = startRow; r <= endRow; r++) {
                    for (let c = startCol; c <= endCol; c++) {
                        styleFn(ws.getCell(r, c));
                    }
                }
            };

            const COLORS = {
                headerBg:     '1F4E79',
                headerText:   'FFFFFF',
                colHeaderBg:  '2E75B6',
                colHeaderText:'FFFFFF',
                rowOdd:       'DEEAF1',
                rowEven:      'FFFFFF',
                win:          'C6EFCE',
                winText:      '276221',
                draw:         'FFEB9C',
                drawText:     '9C6500',
                loss:         'FFC7CE',
                lossText:     '9C0006',
                self:         'D9D9D9',
                gold:         'FFD700',
                silver:       'C0C0C0',
                bronze:       'CD7F32',
                statHeader:   '5B9BD5',
                borderColor:  'B8CCE4',
            };

            const totalCols = 2 + n + 8;

            ws.mergeCells(1, 1, 1, Math.floor(totalCols / 2));
            const titleCell = ws.getCell(1, 1);
            titleCell.value = eventName;
            titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF' + COLORS.headerText } };
            titleCell.fill = fill(COLORS.headerBg);
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            ws.mergeCells(1, Math.floor(totalCols / 2) + 1, 1, totalCols);
            const sportCell = ws.getCell(1, Math.floor(totalCols / 2) + 1);
            sportCell.value = sportType ? `🏆 ${sportType}` : '';
            sportCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF' + COLORS.headerText } };
            sportCell.fill = fill(COLORS.headerBg);
            sportCell.alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getRow(1).height = 32;

            ws.mergeCells(2, 1, 2, totalCols);
            const venueCell = ws.getCell(2, 1);
            venueCell.value = venue ? `📍 ${venue}` : '';
            venueCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF' + COLORS.headerText } };
            venueCell.fill = fill('2E5F8A');
            venueCell.alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getRow(2).height = 22;

            ws.mergeCells(3, 1, 3, totalCols);
            const dateCell = ws.getCell(3, 1);
            dateCell.value = eventDate ? `📅 ${eventDate}` : '';
            dateCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF' + COLORS.headerText } };
            dateCell.fill = fill('2E5F8A');
            dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getRow(3).height = 20;

            const HEADER_ROW = 4;
            const headers = ['№', 'Команда'];
            for (let i = 1; i <= n; i++) headers.push(`${i}`);
            headers.push('В', 'Н', 'П', 'ЗМ', 'ПМ', 'Р', 'О', 'Место');

            const headerRow = ws.getRow(HEADER_ROW);
            headerRow.values = headers;
            headerRow.height = 28;

            headers.forEach((_, colIdx) => {
                const cell = ws.getCell(HEADER_ROW, colIdx + 1);
                const isStatCol = colIdx >= 2 + n;

                cell.font = {
                    name: 'Calibri',
                    size: 11,
                    bold: true,
                    color: { argb: 'FF' + COLORS.colHeaderText }
                };
                cell.fill = fill(isStatCol ? COLORS.statHeader : COLORS.colHeaderBg);
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = thinBorder(COLORS.borderColor);
            });

            const statTips = { В: 'Победы', Н: 'Ничьи', П: 'Поражения',
                               ЗМ: 'Забитые мячи', ПМ: 'Пропущенные мячи',
                               Р: 'Разница мячей', О: 'Очки', Место: 'Итоговое место' };
            Object.entries(statTips).forEach(([header, tip]) => {
                const colIdx = headers.indexOf(header) + 1;
                if (colIdx > 0) {
                    ws.getCell(HEADER_ROW, colIdx).note = tip;
                }
            });

            standings.forEach((team, rowOffset) => {
                const ROW = HEADER_ROW + 1 + rowOffset;
                const isOdd = rowOffset % 2 === 0;
                const rowBg = isOdd ? COLORS.rowOdd : COLORS.rowEven;
                const wsRow = ws.getRow(ROW);
                wsRow.height = 22;

                const rowValues = [team.index + 1, team.name];

                for (let j = 0; j < n; j++) {
                    if (j === team.index) {
                        rowValues.push('—');
                    } else {
                        const match = matches.find(m =>
                            (m.teamA === team.index && m.teamB === j) ||
                            (m.teamA === j && m.teamB === team.index)
                        );
                        if (match?.isPlayed && match.scoreA !== null && match.scoreB !== null) {
                            rowValues.push(match.teamA === team.index
                                ? `${match.scoreA}:${match.scoreB}`
                                : `${match.scoreB}:${match.scoreA}`
                            );
                        } else {
                            rowValues.push('—');
                        }
                    }
                }

                const goalDiff = team.goalsFor - team.goalsAgainst;
                rowValues.push(team.wins, team.draws, team.losses,
                               team.goalsFor, team.goalsAgainst, goalDiff,
                               team.points, team.place || 0);
                wsRow.values = rowValues;

                rowValues.forEach((val, colIdx) => {
                    const cell = ws.getCell(ROW, colIdx + 1);
                    cell.font = { name: 'Calibri', size: 11 };
                    cell.border = thinBorder(COLORS.borderColor);

                    if (colIdx === 0) {
                        cell.font = { ...cell.font, bold: true };
                        cell.fill = fill(rowBg);
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else if (colIdx === 1) {
                        cell.font = { ...cell.font, bold: true };
                        cell.fill = fill(rowBg);
                        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                    } else if (colIdx === 2 + team.index) {
                        cell.fill = fill(COLORS.self);
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else if (colIdx >= 2 && colIdx < 2 + n) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        if (typeof val === 'string' && val.includes(':')) {
                            const [a, b] = val.split(':').map(Number);
                            if (a > b) {
                                cell.fill = fill(COLORS.win);
                                cell.font = { ...cell.font, color: { argb: 'FF' + COLORS.winText }, bold: true };
                            } else if (a === b) {
                                cell.fill = fill(COLORS.draw);
                                cell.font = { ...cell.font, color: { argb: 'FF' + COLORS.drawText } };
                            } else {
                                cell.fill = fill(COLORS.loss);
                                cell.font = { ...cell.font, color: { argb: 'FF' + COLORS.lossText } };
                            }
                        } else {
                            cell.fill = fill(rowBg);
                        }
                    } else {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.fill = fill(rowBg);

                        if (colIdx === 2 + n + 5) {
                            if (val > 0) {
                                cell.font = { ...cell.font, bold: true, color: { argb: 'FF' + COLORS.winText } };
                            } else if (val < 0) {
                                cell.font = { ...cell.font, bold: true, color: { argb: 'FF' + COLORS.lossText } };
                            }
                        }

                        if (colIdx === 2 + n + 6) {
                            cell.font = { ...cell.font, bold: true, size: 12 };
                        }

                        if (colIdx === 2 + n + 7) {
                            cell.font = { ...cell.font, bold: true };
                            if (val === 1) cell.fill = fill(COLORS.gold);
                            else if (val === 2) cell.fill = fill(COLORS.silver);
                            else if (val === 3) cell.fill = fill(COLORS.bronze);
                        }
                    }
                });
            });

            ws.getColumn(1).width = 5;
            ws.getColumn(2).width = 22;
            for (let i = 3; i <= 2 + n; i++) ws.getColumn(i).width = 8;
            ws.getColumn(2 + n + 1).width = 5;
            ws.getColumn(2 + n + 2).width = 5;
            ws.getColumn(2 + n + 3).width = 5;
            ws.getColumn(2 + n + 4).width = 7;
            ws.getColumn(2 + n + 5).width = 7;
            ws.getColumn(2 + n + 6).width = 7;
            ws.getColumn(2 + n + 7).width = 6;
            ws.getColumn(2 + n + 8).width = 8;

            ws.views = [{
                state: 'frozen',
                xSplit: 2,
                ySplit: HEADER_ROW,
                showGridLines: false
            }];

            ws.autoFilter = {
                from: { row: HEADER_ROW, column: 1 },
                to:   { row: HEADER_ROW, column: totalCols }
            };

            const legendRow = HEADER_ROW + standings.length + 2;
            const legendItems = [
                ['', 'Обозначения:'],
                ['', 'Победа', '', '', '', fill(COLORS.win)],
                ['', 'Ничья', '', '', '', fill(COLORS.draw)],
                ['', 'Поражение', '', '', '', fill(COLORS.loss)],
            ];
            legendItems.forEach(([, text], i) => {
                const r = legendRow + i;
                if (i === 0) {
                    const c = ws.getCell(r, 2);
                    c.value = text;
                    c.font = { bold: true, size: 11, name: 'Calibri' };
                } else {
                    const marker = ws.getCell(r, 2);
                    marker.fill = [fill(COLORS.win), fill(COLORS.draw), fill(COLORS.loss)][i - 1];
                    marker.border = thinBorder(COLORS.borderColor);
                    const label = ws.getCell(r, 3);
                    label.value = text;
                    label.font = { size: 10, name: 'Calibri' };
                }
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }

            function createSaveNotificationElement(){
                if (document.getElementById('save-notification')) return;
                const el = document.createElement('div');
                el.id = 'save-notification';
                el.style.position = 'fixed';
                el.style.right = '20px';
                el.style.bottom = '20px';
                el.style.background = '#2c3e50';
                el.style.color = 'white';
                el.style.padding = '12px 16px';
                el.style.borderRadius = '8px';
                el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
                el.style.zIndex = 9999;
                el.hidden = true;
                document.body.appendChild(el);
            }

            function showSaveNotification(text, href){
                createSaveNotificationElement();
                const el = document.getElementById('save-notification');
                el.innerHTML = '';
                const span = document.createElement('span');
                span.textContent = text;
                el.appendChild(span);
                if (href){
                    const a = document.createElement('a');
                    a.href = href;
                    a.target = '_blank';
                    a.style.color = '#ffd54f';
                    a.style.marginLeft = '10px';
                    a.textContent = 'Открыть файл';
                    el.appendChild(a);
                }
                el.hidden = false;
                setTimeout(()=>{ el.hidden = true; }, 15000);
            }

            function saveToServer(){
                const { wsData, filename } = buildWsData();
                fetch('/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename, wbData: wsData }) })
                    .then(res => res.json())
                    .then(json => {
                        if (json && json.ok && json.path){
                            const url = (json.path.indexOf('http') === 0) ? json.path : (window.location.origin + json.path);
                            showSaveNotification('Результат сохранён на сервере', url);
                            autoSaved = true;
                        } else {
                            showSaveNotification('Сохранение не удалось');
                        }
                    }).catch(err => { console.error(err); showSaveNotification('Ошибка сохранения'); });
            }

            function checkTournamentFinished(){
                if (autoSaved) return;
                if (matches.length > 0 && matches.every(m => m.isPlayed)){
                    saveToServer();
                }
            }

        function publishTable(){
            try{
                fetch('/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: tableContainer.innerHTML }) }).catch(e=>console.error(e));
            }catch(e){console.error(e)}
        }
    }

    // Вспомогательная функция для перемешивания массива
    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
});