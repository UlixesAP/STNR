/**

 * Олимпийская система:

 * - 6 команд: 4 играют в 1-м туре, 2 пропускают → полуфинал (4) → финал + матч за 3–4 место.

 * - 5 команд: спецсхема (bye, полуфинал с 3-м местом, финал).

 * - 10 команд: 1-й тур все → далее схема 5 команд.

 * - 14 команд: 1-й тур все → далее схема 7 команд.

 * - нечётное (7, 9, 11…): bye, пенальти, приоритет проигравших по пенальти.

 * - 18 команд: победитель 1-го тура с наиб. разницей пропускает 2-й тур.

 */

const OlympicEngine = {

  resolveWinner(match, scoreA, scoreB, penA, penB) {

    if (scoreA > scoreB) {

      return { winner: match.teamA, loser: match.teamB, penaltyA: null, penaltyB: null };

    }

    if (scoreB > scoreA) {

      return { winner: match.teamB, loser: match.teamA, penaltyA: null, penaltyB: null };

    }

    if (penA == null || penB == null || isNaN(penA) || isNaN(penB)) {

      return { error: 'Введите результат пенальти при ничьей' };

    }

    if (penA === penB) return { error: 'Пенальти не может закончиться вничью' };

    if (penA > penB) {

      return { winner: match.teamA, loser: match.teamB, penaltyA: penA, penaltyB: penB };

    }

    return { winner: match.teamB, loser: match.teamA, penaltyA: penA, penaltyB: penB };

  },



  finalizeMatch(match, scoreA, scoreB, penA, penB, winner, loser) {

    match.scoreA = scoreA;

    match.scoreB = scoreB;

    match.penaltyA = penA;

    match.penaltyB = penB;

    match.winner = winner;

    match.loser = loser;

    match.isFinished = true;

    match.wasDecidedByPenalties = scoreA === scoreB;



    if (scoreA === scoreB) {
      match.goalDifference = 0;
      match.loserPenaltyScored = loser === match.teamA ? penA : penB;
      match.loserRegularGoals = loser === match.teamA ? scoreA : scoreB;
    } else {
      match.goalDifference = Math.abs(scoreA - scoreB);
      match.loserPenaltyScored = null;
      match.loserRegularGoals = loser === match.teamA ? scoreA : scoreB;
    }

  },



  pickLoserForByeMatch(finishedMatches) {

    const losers = finishedMatches

      .filter((m) => m.isFinished && m.loser)

      .map((m) => ({

        team: m.loser,

        gd: m.goalDifference,

        wasPen: !!m.wasDecidedByPenalties,

        loserPen: m.loserPenaltyScored ?? 0,

        loserReg: m.loserRegularGoals ?? 0

      }));



    if (!losers.length) return null;



    const penLosers = losers.filter((l) => l.wasPen);

    const pool = penLosers.length > 0 ? penLosers : losers;



    pool.sort((a, b) => {

      if (a.gd !== b.gd) return a.gd - b.gd;

      if (a.wasPen && b.wasPen && a.loserPen !== b.loserPen) {

        return a.loserPen - b.loserPen;

      }

      return b.loserReg - a.loserReg;

    });



    return pool[0].team;

  },



  describeByeOpponentPick(finishedMatches) {

    const losers = finishedMatches

      .filter((m) => m.isFinished && m.loser)

      .map((m) => ({

        team: m.loser,

        wasPen: !!m.wasDecidedByPenalties

      }));



    const picked = this.pickLoserForByeMatch(finishedMatches);

    if (!picked) return '';



    const penLosers = losers.filter((l) => l.wasPen);

    if (penLosers.length > 0) {

      return (

        `Соперник bye: ${picked} (приоритет — проигравший по пенальти` +

        (penLosers.length > 1 ? `; среди ${penLosers.length} таких команд` : '') +

        ')'

      );

    }

    return `Соперник bye: ${picked} (наименьшая разница мячей среди проигравших)`;

  },



  /**
   * @param {{ random?: boolean }} options — random: true (по умолчанию) случайное распределение; false — порядок как в списке команд
   */
  generateBracket(totalTeams, teams, options = {}) {
    const random = options.random !== false;
    const ordered = random ? shuffleArray(teams) : [...teams];

    const bracket = {
      totalTeams,
      flow: 'standard',
      drawMode: random ? 'random' : 'sequential',
      rounds: [],
      waiting: {},
      finalMatch: null,
      thirdPlaceMatch: null,
      thirdPlaceTeam: null
    };

    if (totalTeams === 6) return this._generateSix(bracket, ordered, random);
    if (totalTeams === 10) return this._generateTen(bracket, ordered, random);
    if (totalTeams === 14) return this._generateFourteen(bracket, ordered, random);
    if (totalTeams === 5) return this._generateFive(bracket, ordered, random);

    if (totalTeams % 2 === 1) {
      bracket.flow = 'odd';
      const byeTeam = ordered[ordered.length - 1];
      bracket.waiting.firstRoundBye = byeTeam;
      bracket.rounds.push(
        this._createRound(
          1,
          ordered.slice(0, -1),
          [byeTeam],
          random
            ? 'Тур 1'
            : 'Тур 1 — пары по порядку списка команд (последняя команда пропускает тур)'
        )
      );
      return bracket;
    }

    bracket.rounds.push(
      this._createRound(
        1,
        ordered,
        [],
        random ? 'Тур 1' : 'Тур 1 — пары по порядку списка команд'
      )
    );
    return bracket;
  },



  _generateSix(bracket, ordered, random) {
    bracket.flow = 'six';
    const playing = ordered.slice(0, 4);
    const bye = ordered.slice(4, 6);
    bracket.rounds.push({
      number: 1,
      label: random
        ? 'Тур 1 — играют 4 случайно выбранные команды'
        : 'Тур 1 — играют команды 1–4 по списку (5–6 пропускают тур)',
      matches: [
        this._newMatch(playing[0], playing[1]),
        this._newMatch(playing[2], playing[3])
      ],
      byeTeams: [...bye],
      byeNote: `Пропускают 1-й тур: ${bye.join(', ')}`
    });
    return bracket;
  },



  _generateTen(bracket, ordered, random) {
    bracket.flow = 'ten';
    bracket.rounds.push(
      this._createRound(
        1,
        ordered,
        [],
        random
          ? 'Тур 1 — играют все 10 команд (5 матчей)'
          : 'Тур 1 — все 10 команд, пары 1–2, 3–4, … по порядку списка'
      )
    );
    return bracket;
  },



  _generateFourteen(bracket, ordered, random) {
    bracket.flow = 'fourteen';
    bracket.rounds.push(
      this._createRound(
        1,
        ordered,
        [],
        random
          ? 'Тур 1 — играют все 14 команд (7 матчей)'
          : 'Тур 1 — все 14 команд, пары по порядку списка (7 матчей)'
      )
    );
    return bracket;
  },



  _generateFive(bracket, ordered, random) {
    bracket.flow = 'five';
    const byeTeam = ordered[ordered.length - 1];
    bracket.rounds.push(
      this._createRound(
        1,
        ordered.slice(0, -1),
        [byeTeam],
        random
          ? 'Тур 1'
          : 'Тур 1 — пары 1–2 и 3–4, команда 5 пропускает тур'
      )
    );
    return bracket;
  },



  /** Старт фазы «5 команд» из списка из 5 победителей (после 10 команд) */

  _startFiveTeamPhase(bracket, teams, afterRoundNumber) {

    const shuffled = shuffleArray(teams);

    const bye = shuffled[shuffled.length - 1];

    const playing = shuffled.slice(0, 4);

    bracket.waiting.fivePhase = { step: 1 };

    bracket.rounds.push({

      number: afterRoundNumber,

      label: `Тур ${afterRoundNumber} (схема 5 команд) — 4 команды играют`,

      matches: [

        this._newMatch(playing[0], playing[1]),

        this._newMatch(playing[2], playing[3])

      ],

      byeTeams: [bye],

      byeNote: `Пропускает тур (5 команд): ${bye}`

    });

  },



  /** Старт фазы «7 команд» из 7 победителей (после 14 команд) */

  _startSevenTeamPhase(bracket, teams, afterRoundNumber) {

    const shuffled = shuffleArray(teams);

    const bye = shuffled[shuffled.length - 1];

    const playing = shuffled.slice(0, 6);

    bracket.waiting.sevenPhase = { step: 1 };

    bracket.rounds.push({

      number: afterRoundNumber,

      label: `Тур ${afterRoundNumber} (схема 7 команд) — 6 команд играют`,

      matches: [

        this._newMatch(playing[0], playing[1]),

        this._newMatch(playing[2], playing[3]),

        this._newMatch(playing[4], playing[5])

      ],

      byeTeams: [bye],

      byeNote: `Пропускает тур (7 команд): ${bye}`

    });

  },



  _createRound(number, playingTeams, byeTeams, label) {

    const matches = [];

    let byes = [...byeTeams];

    for (let i = 0; i < playingTeams.length; i += 2) {

      if (i + 1 < playingTeams.length) {

        matches.push(this._newMatch(playingTeams[i], playingTeams[i + 1]));

      } else {

        byes = [...byes, playingTeams[i]];

      }

    }

    return {

      number,

      label: label || `Тур ${number}`,

      matches,

      byeTeams: byes

    };

  },



  _newMatch(teamA, teamB) {
    return {
      teamA,
      teamB,
      scoreA: null,
      scoreB: null,
      penaltyA: null,
      penaltyB: null,
      extraScoreA: null,
      extraScoreB: null,
      winner: null,
      loser: null,
      goalDifference: 0,
      wasDecidedByPenalties: false,
      loserPenaltyScored: null,
      loserRegularGoals: 0,
      isFinished: false
    };
  },



  normalizeBracket(bracket) {

    if (!bracket) return bracket;

    if (!Array.isArray(bracket.rounds)) bracket.rounds = [];

    bracket.rounds.forEach((round) => {

      if (!Array.isArray(round.byeTeams)) round.byeTeams = [];

      round.matches?.forEach((m) => this.normalizeMatch(m));

    });

    if (bracket.finalMatch) this.normalizeMatch(bracket.finalMatch);

    if (bracket.thirdPlaceMatch) this.normalizeMatch(bracket.thirdPlaceMatch);

    if (!bracket.waiting) bracket.waiting = {};

    if (!bracket.flow) bracket.flow = 'standard';

    return bracket;

  },



  normalizeMatch(m) {

    if (!m) return m;

    if (m.wasDecidedByPenalties == null) {

      m.wasDecidedByPenalties = !!(m.isFinished && m.penaltyA != null && m.penaltyB != null);

    }

    if (m.loserPenaltyScored == null && m.wasDecidedByPenalties && m.loser) {

      m.loserPenaltyScored = m.loser === m.teamA ? m.penaltyA : m.penaltyB;

    }

    if (m.loserRegularGoals == null && m.isFinished && m.loser) {

      m.loserRegularGoals = m.loser === m.teamA ? (m.scoreA ?? 0) : (m.scoreB ?? 0);

    }

    return m;

  },



  advanceOnRoundComplete(bracket, roundIdx) {

    const round = bracket.rounds[roundIdx];

    if (!round) return;

    if (roundIdx < bracket.rounds.length - 1) return;



    const n = bracket.totalTeams;



    if (bracket.waiting.fivePhase) {

      return this._advanceFivePhase(bracket, round);

    }

    if (bracket.waiting.sevenPhase) {

      return this._advanceSevenPhase(bracket, round);

    }



    if (n === 6 || bracket.flow === 'six') {

      if (round.number === 1) return this._afterSixRound1(bracket, round);

      if (round.number === 2) return this._createFinalsFromSemifinal(bracket, round);

      return;

    }



    if (n === 10 && bracket.flow === 'ten' && round.number === 1) {

      return this._afterTenRound1(bracket, round);

    }



    if (n === 14 && bracket.flow === 'fourteen' && round.number === 1) {

      return this._afterFourteenRound1(bracket, round);

    }



    if (n === 5 || bracket.flow === 'five') {

      if (round.number === 1) return this._afterFiveRound1(bracket, round);

      if (round.number === 2) return this._afterFiveRound2(bracket, round);

      if (round.number === 3) return this._afterFiveRound3(bracket, round);

      return;

    }



    if (round.number === 1 && n % 2 === 1 && n !== 5) {

      return this._afterOddRound1(bracket, round);

    }

    if (round.number === 1 && SKIP_BEST_WINNER_COUNTS.includes(n)) {

      return this._afterSkipBestRound1(bracket, round);

    }



    this._standardAdvance(bracket, round);

  },



  _advanceFivePhase(bracket, round) {

    const step = bracket.waiting.fivePhase.step;

    if (step === 1) {

      this._afterFiveRound1(bracket, round);

      bracket.waiting.fivePhase.step = 2;

      return;

    }

    if (step === 2) {

      this._afterFiveRound2(bracket, round);

      bracket.waiting.fivePhase.step = 3;

      return;

    }

    if (step === 3) {

      this._afterFiveRound3(bracket, round);

      delete bracket.waiting.fivePhase;

    }

  },



  _advanceSevenPhase(bracket, round) {

    const step = bracket.waiting.sevenPhase.step;

    if (step === 1) {

      this._afterOddRound1(bracket, round);

      bracket.waiting.sevenPhase.step = 2;

      return;

    }

    this._standardAdvance(bracket, round);

  },



  _afterSixRound1(bracket, round) {

    const winners = round.matches.map((m) => m.winner).filter(Boolean);

    const rested = round.byeTeams || [];

    if (winners.length !== 2 || rested.length !== 2) return;



    const pool = shuffleArray([...winners, ...rested]);

    bracket.rounds.push({

      number: 2,

      label: 'Тур 2 — полуфинал (2 победителя + 2 команды с bye)',

      matches: [this._newMatch(pool[0], pool[1]), this._newMatch(pool[2], pool[3])],

      byeTeams: [],

      byeNote: `В полуфинал: ${pool.join(', ')}`

    });

  },



  _createFinalsFromSemifinal(bracket, round) {

    const winners = round.matches.map((m) => m.winner).filter(Boolean);

    const losers = round.matches.map((m) => m.loser).filter(Boolean);

    if (winners.length !== 2 || losers.length !== 2) return;

    if (!bracket.thirdPlaceMatch) {
      bracket.thirdPlaceMatch = this._newMatch(losers[0], losers[1]);
    }

    if (!bracket.finalMatch) {
      bracket.finalMatch = this._newMatch(winners[0], winners[1]);
    }

  },



  _afterTenRound1(bracket, round) {

    const winners = round.matches.map((m) => m.winner).filter(Boolean);

    if (winners.length !== 5) return;

    this._startFiveTeamPhase(bracket, winners, round.number + 1);

  },



  _afterFourteenRound1(bracket, round) {

    const winners = round.matches.map((m) => m.winner).filter(Boolean);

    if (winners.length !== 7) return;

    this._startSevenTeamPhase(bracket, winners, round.number + 1);

  },



  _afterFiveRound1(bracket, round) {

    const bye = round.byeTeams[0];

    const finished = round.matches.filter((m) => m.isFinished);



    const winners = finished

      .map((m) => ({ team: m.winner, gd: m.goalDifference }))

      .sort((a, b) => b.gd - a.gd);



    if (winners.length < 2) return;



    bracket.waiting.finalDirect = winners[0].team;

    bracket.waiting.round3Opponent = winners[1].team;



    const weakestLoser = this.pickLoserForByeMatch(finished);

    if (!weakestLoser || !bye) return;



    const pickNote = this.describeByeOpponentPick(finished);

    const nextNum = round.number + 1;



    bracket.rounds.push({

      number: nextNum,

      label: `Тур ${nextNum} — bye против проигравшего (приоритет — по пенальти)`,

      matches: [this._newMatch(bye, weakestLoser)],

      byeTeams: winners.map((w) => w.team),

      byeNote:

        (pickNote ? pickNote + '. ' : '') +

        'Пропускают тур: победители с наибольшей разницей (' +

        winners.map((w) => w.team).join(', ') +

        ')'

    });

  },



  _afterFiveRound2(bracket, round) {

    const r2winner = round.matches[0]?.winner;

    if (!r2winner || !bracket.waiting.round3Opponent) return;



    const nextNum = round.number + 1;

    bracket.rounds.push({

      number: nextNum,

      label: `Тур ${nextNum} — полуфинал (проигравший — 3-е место)`,

      matches: [this._newMatch(r2winner, bracket.waiting.round3Opponent)],

      byeTeams: bracket.waiting.finalDirect ? [bracket.waiting.finalDirect] : [],

      byeNote: bracket.waiting.finalDirect

        ? `В финал напрямую: ${bracket.waiting.finalDirect}`

        : ''

    });

  },



  _afterFiveRound3(bracket, round) {

    const match = round.matches[0];

    if (!match?.isFinished || !match.winner) return;



    bracket.thirdPlaceTeam = match.loser;

    if (!bracket.finalMatch && bracket.waiting.finalDirect) {

      bracket.finalMatch = this._newMatch(bracket.waiting.finalDirect, match.winner);

    }

  },



  _afterOddRound1(bracket, round) {

    const bye = round.byeTeams[0];

    const finished = round.matches.filter((m) => m.isFinished);



    const winners = finished

      .map((m) => ({ team: m.winner, gd: m.goalDifference }))

      .sort((a, b) => b.gd - a.gd);



    const skipCount = Math.min(2, winners.length);

    const skippers = winners.slice(0, skipCount).map((w) => w.team);

    const otherWinners = winners.slice(skipCount).map((w) => w.team);



    const weakestLoser = this.pickLoserForByeMatch(finished);

    if (!weakestLoser || !bye) return;



    const remainingLosers = finished

      .map((m) => m.loser)

      .filter((t) => t && t !== weakestLoser);



    const pickNote = this.describeByeOpponentPick(finished);

    const nextNum = round.number + 1;

    const r2matches = [this._newMatch(bye, weakestLoser)];

    const pool = shuffleArray([...otherWinners, ...remainingLosers]);

    const r2 = {

      number: nextNum,

      label: `Тур ${nextNum} — bye против проигравшего (приоритет — по пенальти)`,

      matches: r2matches,

      byeTeams: [...skippers]

    };



    const skipNote = skippers.length

      ? 'Пропускают тур: 2 победителя с наибольшей разницей (' + skippers.join(', ') + ')'

      : '';

    r2.byeNote = [pickNote, skipNote].filter(Boolean).join('. ');



    this._pairTeams(pool, r2);

    bracket.rounds.push(r2);

  },



  _afterSkipBestRound1(bracket, round) {

    const finished = round.matches.filter((m) => m.isFinished);

    if (!finished.length) return;



    const best = finished.reduce((a, b) => (b.goalDifference > a.goalDifference ? b : a));

    const pool = [];

    finished.forEach((m) => {

      if (m.winner !== best.winner) pool.push(m.winner);

      pool.push(m.loser);

    });



    const r2 = {

      number: 2,

      label: 'Тур 2',

      matches: [],

      byeTeams: [best.winner],

      byeNote: `Пропускает тур: ${best.winner} (наибольшая разница в 1-м туре)`

    };

    this._pairTeams(shuffleArray(pool), r2);

    bracket.rounds.push(r2);

  },



  _standardAdvance(bracket, round) {

    const pool = [

      ...round.matches.map((m) => m.winner).filter(Boolean),

      ...(round.byeTeams || [])

    ];



    if (pool.length === 4) {

      // Для mixed flow используем фиксированную сетку: QF1 vs QF4, QF2 vs QF3
      if (bracket.flow === 'mixed') {
        const wins = round.matches.map(m => m.winner).filter(Boolean);
        // wins[0] = QF1 winner, wins[1] = QF2, wins[2] = QF3, wins[3] = QF4
        bracket.rounds.push({

          number: round.number + 1,

          label: `Тур ${round.number + 1} — полуфинал`,

          matches: [this._newMatch(wins[0], wins[3]), this._newMatch(wins[1], wins[2])],

          byeTeams: []

        });

        return;

      }

      const s = shuffleArray(pool);

      bracket.rounds.push({

        number: round.number + 1,

        label: `Тур ${round.number + 1} — полуфинал`,

        matches: [this._newMatch(s[0], s[1]), this._newMatch(s[2], s[3])],

        byeTeams: []

      });

      return;

    }



    if (pool.length === 2) {

      const losers = round.matches.map((m) => m.loser).filter(Boolean);

      if (losers.length >= 2 && !bracket.thirdPlaceMatch) {

        bracket.thirdPlaceMatch = this._newMatch(losers[0], losers[1]);

      }

      if (!bracket.finalMatch) {
        bracket.finalMatch = this._newMatch(pool[0], pool[1]);
      }

      return;

    }



    if (pool.length > 1) {

      const next = {

        number: round.number + 1,

        label: `Тур ${round.number + 1}`,

        matches: [],

        byeTeams: []

      };

      this._pairTeams(shuffleArray(pool), next);

      bracket.rounds.push(next);

    }

  },



  _pairTeams(teams, round) {

    if (!Array.isArray(round.byeTeams)) round.byeTeams = [];

    for (let i = 0; i < teams.length; i += 2) {

      if (i + 1 < teams.length) {

        round.matches.push(this._newMatch(teams[i], teams[i + 1]));

      } else {

        round.byeTeams.push(teams[i]);

      }

    }

  },



  getRoundLabel(round) {

    return round.label || `Тур ${round.number}`;

  },



  async exportXlsx(meta, matchHistory, bracket) {
    await SheetJSLoader.load();
    if (typeof XLSX === 'undefined') {
      throw new Error('библиотека Excel не загружена');
    }

    const wsData = [];

    wsData.push(['', '', meta.eventName || '', '', '', formatSport(meta.sport)]);

    wsData.push(['', '', meta.venue || '']);

    wsData.push(['', '', formatDateRu(meta.eventDate)]);

    wsData.push([]);

    wsData.push(['Раунд', 'Команда А', 'Счёт', 'Команда Б', 'Пенальти', 'Победитель']);



    matchHistory.forEach((m) => {

      const pen = m.penaltyA != null ? `${m.penaltyA}:${m.penaltyB}` : '—';

      wsData.push([m.round, m.teamA, `${m.scoreA}:${m.scoreB}`, m.teamB, pen, m.winner]);

    });



    wsData.push([]);

    wsData.push(['Итоговые места']);

    if (bracket.finalMatch?.isFinished) {

      wsData.push(['1 место', bracket.finalMatch.winner]);

      const second =

        bracket.finalMatch.teamA === bracket.finalMatch.winner

          ? bracket.finalMatch.teamB

          : bracket.finalMatch.teamA;

      wsData.push(['2 место', second]);

    }

    if (bracket.thirdPlaceTeam) {

      wsData.push(['3 место', bracket.thirdPlaceTeam]);

    } else if (bracket.thirdPlaceMatch?.isFinished) {

      wsData.push(['3 место', bracket.thirdPlaceMatch.winner]);

    }



    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, 'Олимпийская система');

    const name = (meta.eventName || 'турнир').replace(/[<>:"/\\|?*]/g, '_');

    downloadXlsxWorkbook(wb, `${name}_плейофф.xlsx`);
  },

  /**
   * Создать bracket из пар для плей-офф смешанного турнира.
   *
   * @param {Array} pairs — пары из MixedEngine.seedFromStandings
   * @returns {Object} bracket с rounds, finalMatch, thirdPlaceMatch
   */
  createBracketFromPairs(pairs) {
    if (!pairs || !pairs.length) return { rounds: [], finalMatch: null, thirdPlaceMatch: null };

    const bracket = {
      totalTeams: pairs.length * 2,
      flow: 'mixed',
      drawMode: 'seeded',
      rounds: [],
      waiting: {},
      finalMatch: null,
      thirdPlaceMatch: null,
      thirdPlaceTeam: null,
      fromPairs: pairs.map(p => ({ teamA: p.teamA, teamB: p.teamB }))
    };

    const n = pairs.length;
    let hasThirdPlace = false;
    const firstPair = pairs[0];
    if (firstPair && firstPair.hasThirdPlace !== undefined) {
      hasThirdPlace = firstPair.hasThirdPlace;
    }

    if (n === 2) {
      // 2 пары = полуфиналы → финал
      bracket.rounds.push({
        number: 1,
        label: 'Полуфинал',
        matches: pairs.map(p => {
          const m = this._newMatch(p.teamA, p.teamB);
          m.matchLabel = p.matchLabel || 'SF';
          return m;
        }),
        byeTeams: []
      });

      bracket.finalMatch = null;

    } else if (n === 4) {
      // 4 пары = четвертьфиналы → полуфинал → финал
      bracket.rounds.push({
        number: 1,
        label: 'Четвертьфинал',
        matches: pairs.map(p => {
          const m = this._newMatch(p.teamA, p.teamB);
          m.matchLabel = p.matchLabel || 'QF';
          return m;
        }),
        byeTeams: []
      });

      bracket.finalMatch = null;

    } else if (n === 1) {
      // 1 пара = только финал
      bracket.finalMatch = this._newMatch(pairs[0].teamA, pairs[0].teamB);
      if (hasThirdPlace) {
        bracket.thirdPlaceMatch = this._newMatch('TBD', 'TBD');
      }
    }

    return bracket;
  }

};



window.OlympicEngine = OlympicEngine;

