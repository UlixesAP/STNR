/**
 * MixedEngine — оркестратор смешанных турниров.
 *
 * Архитектура:
 * - RoundRobinEngine.generateMatches()         → state.roundRobin.matches
 * - RoundRobinEngine.calculateStandings()      → standings (отсортированный массив мест)
 * - MixedEngine.seedFromStandings()            → посев (пары для плей-офф)
 * - OlympicEngine.createBracket(pairs, opts)   → state.playoff.bracket
 *
 * Правила:
 * - RoundRobinEngine не знает про плей-офф
 * - OlympicEngine не знает про standings
 * - Смешивание через адаптер seedFromStandings
 */

const MixedEngine = {

  /**
   * Правила посева для разных конфигураций.
   * Ключ = seedingRule, значение = массив пар [индекс_победителя, индекс_проигравшего]
   * Индексы relative к отсортированному массиву qualified (0-based).
   */
  SEEDING_RULES: {
    /** 1-е vs 4-е, 2-е vs 3-е */
    '1v4_2v3': [[0, 3], [1, 2]],
    /** 1-е vs 3-е, 2-е vs 4-е */
    '1v3_2v4': [[0, 2], [1, 3]],
    /** Кросс: 1-е из A vs 2-е из B */
    'cross': [[0, 1], [1, 0]],
    /** 4 группы: A1-B2, A2-B1, C1-D2, C2-D1 */
    '4group-cross': [[0, 1], [1, 0], [2, 3], [3, 2]]
  },

  /**
   * Создать посев из standings: места → пары для плей-офф.
   *
   * @param {Array} standings - отсортированный массив мест (один для 1 группы) 
   *                            или массив групп standings для групповых систем
   * @param {Object} config - конфигурация из MIXED_SYSTEM_CONFIGS
   * @returns {Array} пары для плей-офф [{matchLabel, teamA, teamB, seedA, seedB, hasThirdPlace}]
   */
  seedFromStandings(standings, config) {
    if (!standings || !Array.isArray(standings)) {
      throw new Error('seedFromStandings: standings must be an array');
    }
    if (!config) {
      throw new Error('seedFromStandings: config must be provided');
    }

    const { advanceCount, seedingRule, hasThirdPlace, groups } = config;
    
    // Если система поддерживает группы (groups > 1)
    if (groups && groups > 1) {
      return this._seedFromGroupedStandings(standings, config, groups);
    }
    
    // Одна группа (старая логика)
    const qualified = standings.slice(0, advanceCount);

    const rule = this.SEEDING_RULES[seedingRule];
    if (!rule) {
      throw new Error(`seedFromStandings: unknown seedingRule '${seedingRule}'`);
    }

    return rule.map(([a, b], i) => ({
      matchLabel: `SF${i + 1}`,
      teamA: qualified[a]?.name || null,
      teamB: qualified[b]?.name || null,
      seedA: a + 1,
      seedB: b + 1,
      hasThirdPlace: hasThirdPlace
    }));
  },

  /**
   * Посев из нескольких групп: например, 2tables-2eac
   * standings = [[groupA_standings], [groupB_standings]]
   * seedingRule = 'cross' → A1 vs B2, B1 vs A2
   */
  _seedFromGroupedStandings(groupedStandings, config, groupCount) {
    const { advanceCount, seedingRule, hasThirdPlace } = config;
    
    // Для каждой группы берём команды с place <= advanceCount и СОРТИРУЕМ по полю place
    const sortedGroups = groupedStandings.map((groupStandings) => {
      return groupStandings
        .filter(t => t.place > 0 && t.place <= advanceCount)
        .sort((a, b) => {
          // Сначала по полю place (1, 2, 3, 4...)
          if (a.place !== b.place) return a.place - b.place;
          // При равных местах — по очкам, разнице мячей, забитым мячам
          if (b.points !== a.points) return b.points - a.points;
          const gdA = a.goalsFor - a.goalsAgainst;
          const gdB = b.goalsFor - b.goalsAgainst;
          if (gdA !== gdB) return gdB - gdA;
          return b.goalsFor - a.goalsFor;
        });
    });

    if (seedingRule === 'cross') {
      // Кросс-посев: 1-е из A vs 2-е из B, 1-е из B vs 2-е из А
      const groupA = sortedGroups[0] || [];
      const groupB = sortedGroups[1] || [];
      const pairs = [];
      if (groupA[0] && groupB[1]) {
        pairs.push({
          matchLabel: 'ПФ1',
          teamA: groupA[0].name,
          teamB: groupB[1].name,
          seedA: 1,
          seedB: 2,
          hasThirdPlace: hasThirdPlace
        });
      }
      if (groupB[0] && groupA[1]) {
        pairs.push({
          matchLabel: 'ПФ2',
          teamA: groupB[0].name,
          teamB: groupA[1].name,
          seedA: 1,
          seedB: 2,
          hasThirdPlace: hasThirdPlace
        });
      }
      return pairs;
    } else if (seedingRule === '1v4_2v3') {
      // 2 группы: 1-е из A vs 4-е из B, 2-е из A vs 3-е из B, 3-е из A vs 2-е из B, 4-е из A vs 1-е из B
      const groupA = sortedGroups[0] || [];
      const groupB = sortedGroups[1] || [];
      
      const pairs = [];
      for (let i = 0; i < advanceCount; i++) {
        const oppIdx = advanceCount - 1 - i; // 0→3, 1→2, 2→1, 3→0
        if (groupA[i] && groupB[oppIdx]) {
          pairs.push({
            matchLabel: `ЧФ${i + 1}`,
            teamA: groupA[i].name,
            teamB: groupB[oppIdx].name,
            seedA: i + 1,
            seedB: oppIdx + 1,
            hasThirdPlace: hasThirdPlace
          });
        }
      }
      return pairs;
    } else if (seedingRule === '4group-cross') {
      // 4 группы: А, Б, В, Г
      // ЧФ1: А1 vs Б2, ЧФ2: А2 vs В1, ЧФ3: Б1 vs Г2, ЧФ4: В2 vs Г1
      // ПФ1: Победитель ЧФ1 vs Победитель ЧФ4, ПФ2: Победитель ЧФ2 vs Победитель ЧФ3
      const groupA = sortedGroups[0] || [];
      const groupB = sortedGroups[1] || [];
      const groupC = sortedGroups[2] || [];
      const groupD = sortedGroups[3] || [];
      
      return [
        {
          matchLabel: 'ЧФ1',
          teamA: groupA[0]?.name || null,
          teamB: groupB[1]?.name || null,
          seedA: 1,
          seedB: 2,
          hasThirdPlace: hasThirdPlace
        },
        {
          matchLabel: 'ЧФ2',
          teamA: groupA[1]?.name || null,
          teamB: groupC[0]?.name || null,
          seedA: 2,
          seedB: 1,
          hasThirdPlace: hasThirdPlace
        },
        {
          matchLabel: 'ЧФ3',
          teamA: groupB[0]?.name || null,
          teamB: groupD[1]?.name || null,
          seedA: 1,
          seedB: 2,
          hasThirdPlace: hasThirdPlace
        },
        {
          matchLabel: 'ЧФ4',
          teamA: groupC[1]?.name || null,
          teamB: groupD[0]?.name || null,
          seedA: 2,
          seedB: 1,
          hasThirdPlace: hasThirdPlace
        }
      ];
    }
    
    return [];
  }
};

window.MixedEngine = MixedEngine;

