// olympic-logic.js - Полная реализация Олимпийской системы с плей-офф

document.addEventListener('DOMContentLoaded', function() {
    // DOM элементы
    const numTeamsSelect = document.getElementById('numTeamsOlympic');
    const teamsInputContainer = document.getElementById('teamsInputContainerOly');
    const teamsInputsDiv = document.getElementById('teamsInputsOly');
    const generateBtn = document.getElementById('generateBracketBtn');
    const bracketContainer = document.getElementById('bracketContainer');
    const bracketDiv = document.getElementById('bracket');
    const finalResultsDiv = document.getElementById('finalResults');
    const exportBtn = document.getElementById('exportOlyBtn');

    // Данные турнира
    let teams = [];
    let totalTeams = 0;
    let bracket = { rounds: [], thirdPlaceMatch: null, finalMatch: null };
    let matchHistory = []; // История всех матчей для расчета разницы
    let publishEnabled = false;
    let autoSaved = false;

    // Заполнение выпадающих списков при загрузке
    function populateSelects() {
        // Виды спорта
        const sportSelect = document.getElementById('sportType');
        const sports = ['футбол', 'хоккей', 'стритбол', 'баскетбол', 'волейбол', 'лапта', 'регби'];
        sportSelect.innerHTML = sports.map(sport => `<option value="${sport}">${sport.charAt(0).toUpperCase() + sport.slice(1)}</option>`).join('');

        // Места проведения
        const venueSelect = document.getElementById('venue');
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
        venueSelect.innerHTML = venues.map(venue => `<option value="${venue}">${venue}</option>`).join('');
    }

    populateSelects();

    // Обработчик изменения количества команд
    numTeamsSelect.addEventListener('change', function() {
        totalTeams = parseInt(this.value);
        teamsInputsDiv.innerHTML = '';
        
        for (let i = 0; i < totalTeams; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Команда ${i + 1}`;
            input.classList.add('team-name-input');
            input.style.marginBottom = '10px';
            teamsInputsDiv.appendChild(input);
        }
        
        teamsInputContainer.classList.remove('hidden');
        bracketContainer.classList.add('hidden');
        finalResultsDiv.innerHTML = '';
    });

    // Генерация сетки
    generateBtn.addEventListener('click', function() {
        const inputs = document.querySelectorAll('.team-name-input');
        teams = Array.from(inputs).map(inp => inp.value.trim()).filter(name => name);
        
        if (teams.length !== totalTeams) {
            alert('Заполните все названия команд!');
            return;
        }
        
        matchHistory = [];
        generateOlympicBracket();
        renderBracket();
        bracketContainer.classList.remove('hidden');
        finalResultsDiv.innerHTML = '';
    });

    // Генерация олимпийской сетки
    function generateOlympicBracket() {
        bracket = { rounds: [], thirdPlaceMatch: null, finalMatch: null };
        let shuffledTeams = [...teams];
        shuffleArray(shuffledTeams);

        // Определяем количество команд в первом раунде
        let teamsInFirstRound = totalTeams;
        let byeTeams = [];
        
        // Для четного количества команд
        if (totalTeams % 2 === 0) {
            // Все играют в первом раунде
            createFirstRound(shuffledTeams, []);
        } else {
            // Нечетное количество - последняя команда пропускает первый тур
            const lastTeam = shuffledTeams[shuffledTeams.length - 1];
            const playingTeams = shuffledTeams.slice(0, -1);
            byeTeams = [lastTeam];
            createFirstRound(playingTeams, byeTeams);
        }
    }

    function createFirstRound(playingTeams, byeTeams) {
        const firstRound = { number: 1, matches: [], byeTeams: byeTeams };
        
        // Создаем пары для первого раунда
        for (let i = 0; i < playingTeams.length; i += 2) {
            if (i + 1 < playingTeams.length) {
                firstRound.matches.push({
                    teamA: playingTeams[i],
                    teamB: playingTeams[i + 1],
                    scoreA: null,
                    scoreB: null,
                    penaltyA: null,
                    penaltyB: null,
                    winner: null,
                    loser: null,
                    goalDifference: 0,
                    isFinished: false
                });
            } else {
                // Если осталась одна команда без пары (на всякий случай)
                firstRound.byeTeams.push(playingTeams[i]);
            }
        }
        
        bracket.rounds.push(firstRound);
    }

    // Отрисовка сетки
    function renderBracket() {
        bracketDiv.innerHTML = '';
        
        bracket.rounds.forEach((round, rIdx) => {
            const roundDiv = document.createElement('div');
            roundDiv.classList.add('round');
            roundDiv.innerHTML = `<h3>Раунд ${round.number}</h3>`;
            
            // Показываем команды, пропускающие тур
            if (round.byeTeams && round.byeTeams.length > 0) {
                const byeDiv = document.createElement('div');
                byeDiv.classList.add('bye-teams');
                byeDiv.innerHTML = '<h4>Пропускают тур:</h4>';
                round.byeTeams.forEach(team => {
                    byeDiv.innerHTML += `<div class="team bye">${team}</div>`;
                });
                roundDiv.appendChild(byeDiv);
            }
            
            // Отрисовка матчей
            round.matches.forEach((match, mIdx) => {
                const matchDiv = document.createElement('div');
                matchDiv.classList.add('match');
                matchDiv.setAttribute('data-round', rIdx);
                matchDiv.setAttribute('data-match', mIdx);
                
                const teamADiv = document.createElement('div');
                teamADiv.classList.add('team');
                teamADiv.innerHTML = `
                    <span class="team-name">${match.teamA || 'TBD'}</span>
                    ${match.teamB ? `<input type="number" min="0" class="score-input scoreA" data-round="${rIdx}" data-match="${mIdx}" placeholder="0" ${match.isFinished ? 'disabled' : ''}>` : ''}
                `;
                
                const teamBDiv = document.createElement('div');
                teamBDiv.classList.add('team');
                teamBDiv.innerHTML = `
                    <span class="team-name">${match.teamB || 'BYE'}</span>
                    ${match.teamB ? `<input type="number" min="0" class="score-input scoreB" data-round="${rIdx}" data-match="${mIdx}" placeholder="0" ${match.isFinished ? 'disabled' : ''}>` : ''}
                `;
                
                const penaltyDiv = document.createElement('div');
                penaltyDiv.classList.add('penalty-input', 'hidden');
                penaltyDiv.setAttribute('id', `penalty-${rIdx}-${mIdx}`);
                penaltyDiv.innerHTML = `
                    <span>Пенальти:</span>
                    <input type="number" min="0" class="pen-input penA" data-round="${rIdx}" data-match="${mIdx}" placeholder="A">
                    <span>:</span>
                    <input type="number" min="0" class="pen-input penB" data-round="${rIdx}" data-match="${mIdx}" placeholder="B">
                `;
                
                const confirmBtn = document.createElement('button');
                confirmBtn.classList.add('btn', 'confirm-match');
                confirmBtn.textContent = 'Подтвердить результат';
                confirmBtn.setAttribute('data-round', rIdx);
                confirmBtn.setAttribute('data-match', mIdx);
                if (match.isFinished) {
                    confirmBtn.disabled = true;
                    confirmBtn.textContent = 'Результат подтвержден';
                }
                
                matchDiv.appendChild(teamADiv);
                matchDiv.appendChild(teamBDiv);
                matchDiv.appendChild(penaltyDiv);
                matchDiv.appendChild(confirmBtn);
                
                // Если матч завершен, показываем результат
                if (match.isFinished) {
                    teamADiv.classList.add(match.winner === match.teamA ? 'winner' : 'loser');
                    teamBDiv.classList.add(match.winner === match.teamB ? 'winner' : 'loser');
                    
                    const resultDiv = document.createElement('div');
                    resultDiv.classList.add('match-result');
                    resultDiv.innerHTML = `
                        <strong>${match.scoreA} : ${match.scoreB}</strong>
                        ${match.penaltyA !== null ? `<br>Пенальти: ${match.penaltyA} : ${match.penaltyB}` : ''}
                    `;
                    matchDiv.appendChild(resultDiv);
                }
                
                roundDiv.appendChild(matchDiv);
            });
            
            bracketDiv.appendChild(roundDiv);
        });

        // После отрисовки сетки — проверяем завершение турнира и публикуем при включении
        try{ checkTournamentFinished(); if (publishEnabled) publishTable(); }catch(e){/* ignore */}
        
        // Отрисовка финальных матчей
        renderFinalMatches();
        
        // Добавление обработчиков событий
        addEventListeners();
    }

    function renderFinalMatches() {
        const finalsDiv = document.createElement('div');
        finalsDiv.classList.add('finals-container');
        finalsDiv.innerHTML = '<h3>Финальные матчи</h3>';
        
        // Матч за 3-4 место
        if (bracket.thirdPlaceMatch) {
            const thirdPlaceDiv = createFinalMatchDiv(bracket.thirdPlaceMatch, 'third');
            finalsDiv.appendChild(thirdPlaceDiv);
        }
        
        // Финал
        if (bracket.finalMatch) {
            const finalDiv = createFinalMatchDiv(bracket.finalMatch, 'final');
            finalsDiv.appendChild(finalDiv);
        }
        
        bracketDiv.appendChild(finalsDiv);
    }

    function createFinalMatchDiv(match, type) {
        const matchDiv = document.createElement('div');
        matchDiv.classList.add('match', `${type}-match`);
        
        const title = type === 'third' ? 'Матч за 3-е место' : 'ФИНАЛ';
        matchDiv.innerHTML = `<h4>${title}</h4>`;
        
        const teamADiv = document.createElement('div');
        teamADiv.classList.add('team');
        teamADiv.innerHTML = `
            <span class="team-name">${match.teamA || 'TBD'}</span>
            ${!match.isFinished ? `<input type="number" min="0" class="score-input final-scoreA" data-type="${type}" placeholder="0">` : ''}
        `;
        
        const teamBDiv = document.createElement('div');
        teamBDiv.classList.add('team');
        teamBDiv.innerHTML = `
            <span class="team-name">${match.teamB || 'TBD'}</span>
            ${!match.isFinished ? `<input type="number" min="0" class="score-input final-scoreB" data-type="${type}" placeholder="0">` : ''}
        `;
        
        const penaltyDiv = document.createElement('div');
        penaltyDiv.classList.add('penalty-input', 'hidden');
        penaltyDiv.setAttribute('id', `penalty-${type}`);
        penaltyDiv.innerHTML = `
            <span>Пенальти:</span>
            <input type="number" min="0" class="pen-input final-penA" data-type="${type}" placeholder="A">
            <span>:</span>
            <input type="number" min="0" class="pen-input final-penB" data-type="${type}" placeholder="B">
        `;
        
        const confirmBtn = document.createElement('button');
        confirmBtn.classList.add('btn', 'confirm-final');
        confirmBtn.textContent = 'Подтвердить результат';
        confirmBtn.setAttribute('data-type', type);
        if (match.isFinished) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Результат подтвержден';
        }
        
        matchDiv.appendChild(teamADiv);
        matchDiv.appendChild(teamBDiv);
        matchDiv.appendChild(penaltyDiv);
        matchDiv.appendChild(confirmBtn);
        
        if (match.isFinished) {
            teamADiv.classList.add(match.winner === match.teamA ? 'winner' : 'loser');
            teamBDiv.classList.add(match.winner === match.teamB ? 'winner' : 'loser');
            
            const resultDiv = document.createElement('div');
            resultDiv.classList.add('match-result');
            resultDiv.innerHTML = `
                <strong>${match.scoreA} : ${match.scoreB}</strong>
                ${match.penaltyA !== null ? `<br>Пенальти: ${match.penaltyA} : ${match.penaltyB}` : ''}
            `;
            matchDiv.appendChild(resultDiv);
        }
        
        return matchDiv;
    }

    function addEventListeners() {
        // Обработчики для основных матчей
        document.querySelectorAll('.score-input').forEach(input => {
            input.addEventListener('input', function() {
                const round = parseInt(this.dataset.round);
                const match = parseInt(this.dataset.match);
                checkForDraw(round, match, 'regular');
            });
        });
        
        document.querySelectorAll('.confirm-match').forEach(btn => {
            btn.addEventListener('click', function() {
                const round = parseInt(this.dataset.round);
                const match = parseInt(this.dataset.match);
                confirmMatchResult(round, match);
            });
        });
        
        // Обработчики для финальных матчей
        document.querySelectorAll('.final-scoreA, .final-scoreB').forEach(input => {
            input.addEventListener('input', function() {
                const type = this.dataset.type;
                checkForDrawInFinal(type);
            });
        });
        
        document.querySelectorAll('.confirm-final').forEach(btn => {
            btn.addEventListener('click', function() {
                const type = this.dataset.type;
                confirmFinalResult(type);
            });
        });
    }

    function checkForDraw(roundIdx, matchIdx, matchType) {
        const scoreA = parseInt(document.querySelector(`.scoreA[data-round="${roundIdx}"][data-match="${matchIdx}"]`)?.value) || 0;
        const scoreB = parseInt(document.querySelector(`.scoreB[data-round="${roundIdx}"][data-match="${matchIdx}"]`)?.value) || 0;
        const penaltyDiv = document.getElementById(`penalty-${roundIdx}-${matchIdx}`);
        
        if (scoreA === scoreB && scoreA > 0) {
            penaltyDiv.classList.remove('hidden');
        } else {
            penaltyDiv.classList.add('hidden');
            // Очищаем значения пенальти
            document.querySelector(`.penA[data-round="${roundIdx}"][data-match="${matchIdx}"]`).value = '';
            document.querySelector(`.penB[data-round="${roundIdx}"][data-match="${matchIdx}"]`).value = '';
        }
    }

    function checkForDrawInFinal(type) {
        const scoreA = parseInt(document.querySelector(`.final-scoreA[data-type="${type}"]`)?.value) || 0;
        const scoreB = parseInt(document.querySelector(`.final-scoreB[data-type="${type}"]`)?.value) || 0;
        const penaltyDiv = document.getElementById(`penalty-${type}`);
        
        if (scoreA === scoreB && scoreA > 0) {
            penaltyDiv.classList.remove('hidden');
        } else {
            penaltyDiv.classList.add('hidden');
            document.querySelector(`.final-penA[data-type="${type}"]`).value = '';
            document.querySelector(`.final-penB[data-type="${type}"]`).value = '';
        }
    }

    function confirmMatchResult(roundIdx, matchIdx) {
        const round = bracket.rounds[roundIdx];
        const match = round.matches[matchIdx];
        
        const scoreA = parseInt(document.querySelector(`.scoreA[data-round="${roundIdx}"][data-match="${matchIdx}"]`).value);
        const scoreB = parseInt(document.querySelector(`.scoreB[data-round="${roundIdx}"][data-match="${matchIdx}"]`).value);
        
        if (isNaN(scoreA) || isNaN(scoreB)) {
            alert('Введите счет матча!');
            return;
        }
        
        // Проверка на ничью и пенальти
        if (scoreA === scoreB) {
            const penA = parseInt(document.querySelector(`.penA[data-round="${roundIdx}"][data-match="${matchIdx}"]`).value);
            const penB = parseInt(document.querySelector(`.penB[data-round="${roundIdx}"][data-match="${matchIdx}"]`).value);
            
            if (isNaN(penA) || isNaN(penB)) {
                alert('Введите результат пенальти!');
                return;
            }
            
            match.penaltyA = penA;
            match.penaltyB = penB;
            
            if (penA > penB) {
                match.winner = match.teamA;
                match.loser = match.teamB;
            } else if (penB > penA) {
                match.winner = match.teamB;
                match.loser = match.teamA;
            } else {
                alert('Пенальти не может закончиться вничью!');
                return;
            }
        } else if (scoreA > scoreB) {
            match.winner = match.teamA;
            match.loser = match.teamB;
        } else {
            match.winner = match.teamB;
            match.loser = match.teamA;
        }
        
        match.scoreA = scoreA;
        match.scoreB = scoreB;
        match.goalDifference = Math.abs(scoreA - scoreB);
        match.isFinished = true;
        
        // Добавляем в историю матчей
        matchHistory.push({
            round: round.number,
            teamA: match.teamA,
            teamB: match.teamB,
            scoreA: scoreA,
            scoreB: scoreB,
            penaltyA: match.penaltyA,
            penaltyB: match.penaltyB,
            winner: match.winner,
            loser: match.loser,
            goalDifference: match.goalDifference
        });
        
        // Проверяем, все ли матчи в раунде завершены
        const allMatchesFinished = round.matches.every(m => m.isFinished);
        
        if (allMatchesFinished) {
            advanceToNextRound(roundIdx);
        }
        
        renderBracket();
        displayFinalResults();
    }

    function confirmFinalResult(type) {
        const match = type === 'third' ? bracket.thirdPlaceMatch : bracket.finalMatch;
        
        const scoreA = parseInt(document.querySelector(`.final-scoreA[data-type="${type}"]`).value);
        const scoreB = parseInt(document.querySelector(`.final-scoreB[data-type="${type}"]`).value);
        
        if (isNaN(scoreA) || isNaN(scoreB)) {
            alert('Введите счет матча!');
            return;
        }
        
        if (scoreA === scoreB) {
            const penA = parseInt(document.querySelector(`.final-penA[data-type="${type}"]`).value);
            const penB = parseInt(document.querySelector(`.final-penB[data-type="${type}"]`).value);
            
            if (isNaN(penA) || isNaN(penB)) {
                alert('Введите результат пенальти!');
                return;
            }
            
            match.penaltyA = penA;
            match.penaltyB = penB;
            
            if (penA > penB) {
                match.winner = match.teamA;
            } else if (penB > penA) {
                match.winner = match.teamB;
            } else {
                alert('Пенальти не может закончиться вничью!');
                return;
            }
        } else if (scoreA > scoreB) {
            match.winner = match.teamA;
        } else {
            match.winner = match.teamB;
        }
        
        match.scoreA = scoreA;
        match.scoreB = scoreB;
        match.isFinished = true;
        
        matchHistory.push({
            round: type === 'third' ? 'Матч за 3-е место' : 'Финал',
            teamA: match.teamA,
            teamB: match.teamB,
            scoreA: scoreA,
            scoreB: scoreB,
            penaltyA: match.penaltyA,
            penaltyB: match.penaltyB,
            winner: match.winner
        });
        
        renderBracket();
        displayFinalResults();
    }

    function advanceToNextRound(roundIdx) {
        const currentRound = bracket.rounds[roundIdx];
        const nextRoundNumber = roundIdx + 2; // +2 потому что индексация с 0
        
        // Собираем победителей
        let winners = currentRound.matches.map(m => m.winner).filter(w => w);
        
        // Добавляем команды, пропускавшие тур
        if (currentRound.byeTeams && currentRound.byeTeams.length > 0) {
            winners = winners.concat(currentRound.byeTeams);
        }
        
        // Собираем проигравших для возможного добора
        let losers = currentRound.matches
            .filter(m => m.loser)
            .map(m => ({ team: m.loser, goalDifference: m.goalDifference }));
        
        // Логика для special cases (6, 10, 14, 18 команд)
        if ([6, 10, 14, 18].includes(totalTeams) && roundIdx === 0) {
            // Победитель с наибольшей разницей пропускает следующий тур
            const bestWinner = currentRound.matches.reduce((best, current) => 
                current.goalDifference > best.goalDifference ? current : best
            );
            
            // Убираем лучшего победителя из списка играющих в следующем раунде
            winners = winners.filter(w => w !== bestWinner.winner);
            
            // Создаем следующий раунд с bye для лучшего победителя
            const nextRound = {
                number: nextRoundNumber,
                matches: [],
                byeTeams: [bestWinner.winner]
            };
            
            // Создаем пары из оставшихся победителей
            for (let i = 0; i < winners.length; i += 2) {
                if (i + 1 < winners.length) {
                    nextRound.matches.push({
                        teamA: winners[i],
                        teamB: winners[i + 1],
                        scoreA: null,
                        scoreB: null,
                        penaltyA: null,
                        penaltyB: null,
                        winner: null,
                        loser: null,
                        goalDifference: 0,
                        isFinished: false
                    });
                } else if (winners[i]) {
                    nextRound.byeTeams.push(winners[i]);
                }
            }
            
            bracket.rounds.push(nextRound);
            
        } else if (totalTeams % 2 !== 0 && roundIdx === 0 && losers.length > 0) {
            // Нечетное количество команд - проигравший с наименьшей разницей проходит дальше
            const bestLoser = losers.reduce((best, current) => 
                current.goalDifference < best.goalDifference ? current : best
            );
            
            winners.push(bestLoser.team);
            
            // Две команды с наибольшей разницей побед пропускают следующий тур
            const sortedWinners = currentRound.matches
                .filter(m => m.winner)
                .sort((a, b) => b.goalDifference - a.goalDifference);
            
            let byeTeams = [];
            if (sortedWinners.length >= 2) {
                byeTeams = [sortedWinners[0].winner, sortedWinners[1].winner];
                winners = winners.filter(w => !byeTeams.includes(w));
            }
            
            const nextRound = {
                number: nextRoundNumber,
                matches: [],
                byeTeams: byeTeams
            };
            
            // Создаем пары из оставшихся команд
            for (let i = 0; i < winners.length; i += 2) {
                if (i + 1 < winners.length) {
                    nextRound.matches.push({
                        teamA: winners[i],
                        teamB: winners[i + 1],
                        scoreA: null,
                        scoreB: null,
                        penaltyA: null,
                        penaltyB: null,
                        winner: null,
                        loser: null,
                        goalDifference: 0,
                        isFinished: false
                    });
                } else if (winners[i]) {
                    nextRound.byeTeams.push(winners[i]);
                }
            }
            
            bracket.rounds.push(nextRound);
            
        } else if (winners.length === 4) {
            // Полуфиналы - создаем следующий раунд
            const semiFinalRound = {
                number: nextRoundNumber,
                matches: [],
                byeTeams: []
            };
            
            // Перемешиваем победителей для случайных пар
            shuffleArray(winners);
            
            for (let i = 0; i < winners.length; i += 2) {
                semiFinalRound.matches.push({
                    teamA: winners[i],
                    teamB: winners[i + 1],
                    scoreA: null,
                    scoreB: null,
                    penaltyA: null,
                    penaltyB: null,
                    winner: null,
                    loser: null,
                    goalDifference: 0,
                    isFinished: false
                });
            }
            
            bracket.rounds.push(semiFinalRound);
            
        } else if (winners.length === 2) {
            // Финал и матч за 3-е место
            const semiFinalLosers = currentRound.matches
                .filter(m => m.loser)
                .map(m => m.loser);
            
            if (semiFinalLosers.length === 2) {
                bracket.thirdPlaceMatch = {
                    teamA: semiFinalLosers[0],
                    teamB: semiFinalLosers[1],
                    scoreA: null,
                    scoreB: null,
                    penaltyA: null,
                    penaltyB: null,
                    winner: null,
                    isFinished: false
                };
            }
            
            bracket.finalMatch = {
                teamA: winners[0],
                teamB: winners[1],
                scoreA: null,
                scoreB: null,
                penaltyA: null,
                penaltyB: null,
                winner: null,
                isFinished: false
            };
        } else {
            // Продолжаем создавать раунды пока есть команды
            if (winners.length > 1) {
                const nextRound = {
                    number: nextRoundNumber,
                    matches: [],
                    byeTeams: []
                };
                
                for (let i = 0; i < winners.length; i += 2) {
                    if (i + 1 < winners.length) {
                        nextRound.matches.push({
                            teamA: winners[i],
                            teamB: winners[i + 1],
                            scoreA: null,
                            scoreB: null,
                            penaltyA: null,
                            penaltyB: null,
                            winner: null,
                            loser: null,
                            goalDifference: 0,
                            isFinished: false
                        });
                    } else {
                        nextRound.byeTeams.push(winners[i]);
                    }
                }
                
                bracket.rounds.push(nextRound);
            }
        }
    }

    function displayFinalResults() {
        if (!bracket.finalMatch || !bracket.finalMatch.isFinished) {
            return;
        }
        
        let results = '<h2>Итоговые результаты</h2>';
        
        // Определяем призеров
        const champion = bracket.finalMatch.winner;
        const secondPlace = bracket.finalMatch.teamA === champion ? bracket.finalMatch.teamB : bracket.finalMatch.teamA;
        
        results += `<div class="result-item gold">🥇 1 место: <strong>${champion}</strong></div>`;
        results += `<div class="result-item silver">🥈 2 место: <strong>${secondPlace}</strong></div>`;
        
        if (bracket.thirdPlaceMatch && bracket.thirdPlaceMatch.isFinished) {
            results += `<div class="result-item bronze">🥉 3 место: <strong>${bracket.thirdPlaceMatch.winner}</strong></div>`;
        }
        
        // Полная история матчей
        results += '<h3>История матчей:</h3>';
        results += '<table class="match-history"><tr><th>Раунд</th><th>Команда А</th><th>Счет</th><th>Команда Б</th><th>Победитель</th></tr>';
        
        matchHistory.forEach(match => {
            let scoreDisplay = `${match.scoreA} : ${match.scoreB}`;
            if (match.penaltyA !== null) {
                scoreDisplay += ` (пен. ${match.penaltyA} : ${match.penaltyB})`;
            }
            
            results += `
                <tr>
                    <td>${match.round}</td>
                    <td>${match.teamA}</td>
                    <td>${scoreDisplay}</td>
                    <td>${match.teamB}</td>
                    <td><strong>${match.winner}</strong></td>
                </tr>
            `;
        });
        
        results += '</table>';
        finalResultsDiv.innerHTML = results;
    }

    // Экспорт в Excel
    exportBtn.addEventListener('click', function() {
        const { wsData, filename } = buildWsDataOly();
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Олимпийская система');
        
        wsData.forEach(row => {
            worksheet.addRow(row);
        });
        
        worksheet.columns.forEach((column, i) => {
            column.width = Math.max(12, wsData.reduce((max, row) => Math.max(max, String(row[i] || '').length), 12));
        });
        
        workbook.xlsx.writeBuffer().then(buffer => {
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        });
    });

    // Кнопка трансляции
    (function createPublishBtnOly(){
        if (document.getElementById('publishBtnOly')) return;
        const btn = document.createElement('button');
        btn.id = 'publishBtnOly';
        btn.className = 'btn btn-outline';
        btn.textContent = 'Онлайн трансляция: выкл';
        exportBtn && exportBtn.parentNode && exportBtn.parentNode.appendChild(btn);
        btn.addEventListener('click', function(){
            publishEnabled = !publishEnabled;
            btn.textContent = 'Онлайн трансляция: ' + (publishEnabled ? 'вкл' : 'выкл');
            if (publishEnabled) {
                alert('Запустите сервер: npm run serve (порт 3333) и откройте /viewer для просмотра.');
                publishTable();
            }
        });
    })();

    // Кнопка ручного сохранения на сервер (олимпийская система)
    (function createSaveBtnOly(){
        if (document.getElementById('saveServerBtnOly')) return;
        const btn = document.createElement('button');
        btn.id = 'saveServerBtnOly';
        btn.className = 'btn btn-primary';
        btn.textContent = 'Сохранить на сервер';
        exportBtn && exportBtn.parentNode && exportBtn.parentNode.appendChild(btn);
        btn.addEventListener('click', function(){
            saveToServerOly();
        });
    })();

    function buildWsDataOly(){
        const eventName = document.getElementById('eventName')?.value || 'Турнир';
        const sportType = document.getElementById('sportType')?.value || '';
        const venue = document.getElementById('venue')?.value || '';
        const eventDate = document.getElementById('eventDate')?.value || '';
        const wsData = [];
        wsData.push(['Название мероприятия:', eventName, '', 'Вид спорта:', sportType]);
        wsData.push(['Место проведения:', venue, '', 'Дата:', eventDate]);
        wsData.push([]);
        wsData.push(['Олимпийская система - Результаты матчей']);
        wsData.push(['Раунд', 'Команда А', 'Счет', 'Команда Б', 'Пенальти', 'Победитель']);
        matchHistory.forEach(match => {
            let scoreDisplay = `${match.scoreA} : ${match.scoreB}`;
            let penaltyDisplay = match.penaltyA !== null ? `${match.penaltyA} : ${match.penaltyB}` : '-';
            wsData.push([match.round, match.teamA, scoreDisplay, match.teamB, penaltyDisplay, match.winner]);
        });
        wsData.push([]);
        if (bracket.finalMatch && bracket.finalMatch.isFinished){
            wsData.push(['Итоговые места:']);
            wsData.push(['1 место', bracket.finalMatch.winner]);
            const secondPlace = bracket.finalMatch.teamA === bracket.finalMatch.winner ? bracket.finalMatch.teamB : bracket.finalMatch.teamA;
            wsData.push(['2 место', secondPlace]);
            if (bracket.thirdPlaceMatch && bracket.thirdPlaceMatch.isFinished) wsData.push(['3 место', bracket.thirdPlaceMatch.winner]);
        }
        return { wsData, filename: (eventName.replace(/\s+/g,'_') || 'Турнир') + '_плейофф.xlsx' };
    }

    function checkTournamentFinished(){
        if (autoSaved) return;
        if (bracket.finalMatch && bracket.finalMatch.isFinished){
            saveToServerOly();
        }
    }

    function publishTable(){
        try{ fetch('/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: bracketContainer.innerHTML || finalResultsDiv.innerHTML }) }).catch(e=>console.error(e)); }catch(e){console.error(e)}
    }

    // Нотификация о сохранении
    function createSaveNotificationElement(){
        if (document.getElementById('save-notification-oly')) return;
        const el = document.createElement('div');
        el.id = 'save-notification-oly';
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
        const el = document.getElementById('save-notification-oly');
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

    function saveToServerOly(){
        const { wsData, filename } = buildWsDataOly();
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

    // Вспомогательная функция перемешивания
    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
});