function getTournamentSpreadsheet_() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (activeSpreadsheet) {
    return activeSpreadsheet;
  }

  const configuredSpreadsheetId = String(
    PropertiesService.getScriptProperties().getProperty(SCRIPT_PROPERTY_KEYS.spreadsheetId) || ''
  ).trim();
  const bundledFallbackSpreadsheetId = '1ERnk240HvBwMpDCNdf5mjYpngpZ6NH37qwc1WcqW7J4';
  const candidateIds = [configuredSpreadsheetId, bundledFallbackSpreadsheetId].filter(function (id, index, list) {
    return id && list.indexOf(id) === index;
  });
  let lastError = null;

  for (let index = 0; index < candidateIds.length; index += 1) {
    try {
      return SpreadsheetApp.openById(candidateIds[index]);
    } catch (error) {
      lastError = error;
    }
  }

  if (candidateIds.length) {
    throw new Error(
      '無法開啟試算表。已嘗試 ID：' +
      candidateIds.join('、') +
      (lastError && lastError.message ? '。原始錯誤：' + lastError.message : '')
    );
  }

  throw new Error('目前找不到可用的試算表，也沒有設定預設 Spreadsheet ID。');
}

function ensureProjectSheets_() {
  Object.keys(TOURNAMENT_SHEETS).forEach(function (key) {
    const sheetConfig = TOURNAMENT_SHEETS[key];
    const sheet = getOrCreateSheet_(sheetConfig.name, sheetConfig.legacyNames || []);

    if (sheet.getMaxColumns() < sheetConfig.headers.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), sheetConfig.headers.length - sheet.getMaxColumns());
    }

    const headerRange = sheet.getRange(1, 1, 1, sheetConfig.headers.length);
    const currentHeaders = headerRange.getValues()[0];
    const needsReset = sheetConfig.headers.some(function (header, index) {
      return currentHeaders[index] !== header;
    });

    if (needsReset) {
      headerRange.setValues([sheetConfig.headers]);
      sheet.setFrozenRows(1);
      headerRange.setFontWeight('bold').setBackground('#dbeafe');
    }
  });

  getOrCreateSheet_(TOURNAMENT_SHEETS.settings.name).hideSheet();
}

function buildDashboard_() {
  const roster = getRosterRecords_();
  const schedule = getScheduleRecords_();
  const standings = buildGroupStandingsFromSchedule_(roster, schedule);
  const bracketConfigs = getSettingObject_(SETTING_KEYS.brackets, {});
  const brackets = buildBracketViewModels_(bracketConfigs, schedule, standings);
  const config = normalizeGenerationOptions_(getSettingObject_(SETTING_KEYS.config, DEFAULT_GENERATION_OPTIONS));
  const spreadsheet = getTournamentSpreadsheet_();

  return {
    roster: roster,
    schedule: schedule,
    standings: standings,
    brackets: brackets,
    config: config,
    meta: {
      spreadsheetName: spreadsheet.getName(),
      spreadsheetUrl: spreadsheet.getUrl(),
    },
    summaries: buildSummaries_(roster, schedule, standings),
  };
}

function normalizeGenerationOptions_(rawOptions) {
  const options = Object.assign({}, DEFAULT_GENERATION_OPTIONS, rawOptions || {});
  options.courtCount = Math.max(1, Number(options.courtCount) || DEFAULT_GENERATION_OPTIONS.courtCount);
  options.matchMinutes = Math.max(5, Number(options.matchMinutes) || DEFAULT_GENERATION_OPTIONS.matchMinutes);
  options.startTime = normalizeTimeString_(options.startTime || DEFAULT_GENERATION_OPTIONS.startTime);
  options.seedOverrides = normalizeSeedOverrides_(options.seedOverrides || {});
  return options;
}

function normalizeSeedOverrides_(seedOverrides) {
  const normalized = {};
  Object.keys(seedOverrides || {}).forEach(function (eventName) {
    if (!isSeedOverrideEnabledEvent_(eventName)) {
      return;
    }
    const eventOverrides = seedOverrides[eventName] || {};
    normalized[eventName] = {};
    Object.keys(eventOverrides).forEach(function (seedLabel) {
      const value = String(eventOverrides[seedLabel] || '').trim();
      if (value) {
        normalized[eventName][String(seedLabel)] = value;
      }
    });
  });
  return normalized;
}

function parseRosterText_(text) {
  const source = String(text || '').replace(/\uFEFF/g, '').trim();
  if (!source) {
    throw new Error('請貼上至少一筆人員名單。');
  }

  const lines = source
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(function (line) {
      return line;
    });

  const delimiter = lines.some(function (line) {
    return line.indexOf('\t') !== -1;
  }) ? '\t' : ',';

  const rows = lines.map(function (line) {
    return Utilities.parseCsv(line, delimiter)[0].map(function (cell) {
      return String(cell || '').trim();
    });
  });

  const headerAliases = [
    ['報名項目', '項目'],
    ['隊名'],
    ['隊員', '成員'],
    ['分組編號', '分組代碼'],
  ];
  const hasHeader = headerAliases.every(function (aliases, index) {
    return aliases.indexOf(rows[0][index]) !== -1;
  });
  const bodyRows = hasHeader ? rows.slice(1) : rows;

  const records = bodyRows.map(function (row, index) {
    if (row.length < 4) {
      throw new Error('第 ' + (index + 1) + ' 筆資料欄位不足，請提供 4 欄：報名項目、隊名、隊員、分組編號。');
    }

    const record = {
      eventName: row[0],
      teamName: row[1],
      members: row[2],
      groupCode: normalizeGroupCode_(row[3]),
      preliminaryRank: '',
      finalRank: '',
      importOrder: index + 1,
    };

    if (!record.eventName || !record.teamName || !record.members || !record.groupCode) {
      throw new Error('第 ' + (index + 1) + ' 筆資料有空欄，請確認報名項目、隊名、隊員、分組編號都已填寫。');
    }

    return record;
  });

  validateRosterRecords_(records);
  return records;
}

function validateRosterRecords_(records) {
  const seenKeys = {};
  records.forEach(function (record) {
    const duplicateKey = record.eventName + '::' + record.teamName;
    if (seenKeys[duplicateKey]) {
      throw new Error('同一項目內有重複隊名：' + record.eventName + ' / ' + record.teamName);
    }
    seenKeys[duplicateKey] = true;
  });
}

function buildSummaries_(roster, schedule, standings) {
  const events = {};
  roster.forEach(function (record) {
    if (!events[record.eventName]) {
      events[record.eventName] = { teams: 0, groups: {} };
    }
    events[record.eventName].teams += 1;
    events[record.eventName].groups[record.groupCode] = true;
  });

  const eventSummaries = Object.keys(events)
    .sort(sortTextNaturally_)
    .map(function (eventName) {
      return {
        eventName: eventName,
        teamCount: events[eventName].teams,
        groupCount: Object.keys(events[eventName].groups).length,
      };
    });

  const completedMatches = schedule.filter(function (match) {
    return [MATCH_STATUS.complete, MATCH_STATUS.walkover, MATCH_STATUS.bye].indexOf(match.status) !== -1;
  }).length;

  return {
    totalTeams: roster.length,
    totalMatches: schedule.length,
    completedMatches: completedMatches,
    eventSummaries: eventSummaries,
    standingsUpdatedAt: getSettingObject_(SETTING_KEYS.lastGeneratedAt, null),
    seedOptions: buildSeedOptionMap_(standings),
    groupsWithStandings: Object.keys(standings).length,
  };
}

function buildSeedOptionMap_(standings) {
  const seedOptions = {};
  Object.keys(standings).forEach(function (eventName) {
    if (!isSeedOverrideEnabledEvent_(eventName)) {
      return;
    }
    seedOptions[eventName] = [];
    const groupCodes = Object.keys(standings[eventName]).sort(sortTextNaturally_);
    
    // Collect Rank 1 and Rank 2 from each group (3 groups * 2 = 6 teams)
    groupCodes.forEach(function (groupCode) {
      const teams = standings[eventName][groupCode] || [];
      // Rank 1
      if (teams[0]) {
        seedOptions[eventName].push({
          value: groupCode + '#1',
          label: groupCode + '組 #1 - ' + teams[0].teamName
        });
      }
      // Rank 2
      if (teams[1]) {
        seedOptions[eventName].push({
          value: groupCode + '#2',
          label: groupCode + '組 #2 - ' + teams[1].teamName
        });
      }
    });
  });
  return seedOptions;
}

function groupRosterByEvent_(roster) {
  return roster.reduce(function (accumulator, record) {
    if (!accumulator[record.eventName]) {
      accumulator[record.eventName] = {};
    }
    if (!accumulator[record.eventName][record.groupCode]) {
      accumulator[record.eventName][record.groupCode] = [];
    }
    accumulator[record.eventName][record.groupCode].push(record);
    return accumulator;
  }, {});
}

function isSeedOverrideEnabledEvent_(eventName) {
  return String(eventName || '').indexOf('男') !== -1;
}

function validateRequiredSeedOverrides_(groupedRoster, seedOverrides) {
  Object.keys(groupedRoster || {}).forEach(function (eventName) {
    const groupCodes = Object.keys(groupedRoster[eventName] || {}).sort(sortTextNaturally_);
    const qualifierLabels = [];
    groupCodes.forEach(function (groupCode) {
      qualifierLabels.push(groupCode + '#1');
    });
    groupCodes.forEach(function (groupCode) {
      qualifierLabels.push(groupCode + '#2');
    });

    if (!shouldUseSixTeamSeededFormat_(eventName, qualifierLabels)) {
      return;
    }

    const eventOverrides = (seedOverrides && seedOverrides[eventName]) || {};
    const seed1 = String(eventOverrides['1'] || '').trim();
    const seed6 = String(eventOverrides['6'] || '').trim();

    if (!seed1 || !seed6) {
      throw new Error(eventName + ' 請先指定 1 號與 6 號種子，再儲存決賽籤表。');
    }
    if (seed1 === seed6) {
      throw new Error(eventName + ' 的 1 號與 6 號種子不可相同。');
    }
    if (qualifierLabels.indexOf(seed1) === -1 || qualifierLabels.indexOf(seed6) === -1) {
      throw new Error(eventName + ' 的種子來源不在可晉級名單內，請重新選擇。');
    }
  });
}

function getEventNamesInImportOrder_(groupedRoster) {
  return Object.keys(groupedRoster).sort(function (leftEventName, rightEventName) {
    return getFirstImportOrderForEvent_(groupedRoster[leftEventName]) -
      getFirstImportOrderForEvent_(groupedRoster[rightEventName]);
  });
}

function getFirstImportOrderForEvent_(eventGroups) {
  let firstOrder = Number.MAX_SAFE_INTEGER;
  Object.keys(eventGroups || {}).forEach(function (groupCode) {
    (eventGroups[groupCode] || []).forEach(function (record) {
      firstOrder = Math.min(firstOrder, Number(record.importOrder) || Number.MAX_SAFE_INTEGER);
    });
  });
  return firstOrder;
}

function buildGroupStageMatches_(groupedRoster) {
  const matches = [];

  getEventNamesInImportOrder_(groupedRoster)
    .forEach(function (eventName) {
      const groupCodes = Object.keys(groupedRoster[eventName]).sort(sortTextNaturally_);
      const roundsByGroup = {};
      let maxRoundCount = 0;

      groupCodes.forEach(function (groupCode) {
        const teams = groupedRoster[eventName][groupCode].slice();
        if (teams.length < 2) {
          throw new Error('分組 ' + eventName + ' / ' + groupCode + ' 至少需要 2 隊才能產生小組賽。');
        }

        roundsByGroup[groupCode] = buildGroupRoundRobinRounds_(eventName, groupCode, teams);
        maxRoundCount = Math.max(maxRoundCount, roundsByGroup[groupCode].length);
      });

      for (let roundIndex = 0; roundIndex < maxRoundCount; roundIndex += 1) {
        groupCodes.forEach(function (groupCode) {
          const roundMatches = roundsByGroup[groupCode][roundIndex] || [];
          roundMatches.forEach(function (match) {
            matches.push(match);
          });
        });
      }
    });

  return matches;
}

function buildGroupRoundRobinRounds_(eventName, groupCode, teams) {
  if (teams.length === 4) {
    return buildFourTeamImageRounds_(eventName, groupCode, teams);
  }
  return buildGenericRoundRobinRounds_(eventName, groupCode, teams);
}

function buildFourTeamImageRounds_(eventName, groupCode, teams) {
  const pairIndexes = [
    [0, 1],
    [2, 3],
    [0, 2],
    [1, 3],
    [0, 3],
    [1, 2],
  ];
  return pairIndexes.map(function (pair) {
    return [createGroupStageMatch_(eventName, groupCode, teams[pair[0]], teams[pair[1]])];
  });
}

function buildGenericRoundRobinRounds_(eventName, groupCode, teams) {
  const rotatingTeams = teams.slice();
  if (rotatingTeams.length % 2 === 1) {
    rotatingTeams.push(null);
  }

  const rounds = [];
  const roundCount = rotatingTeams.length - 1;
  const half = rotatingTeams.length / 2;

  for (let round = 0; roundCount > 0 && round < roundCount; round += 1) {
    const roundMatches = [];
    for (let index = 0; index < half; index += 1) {
      const left = rotatingTeams[index];
      const right = rotatingTeams[rotatingTeams.length - 1 - index];
      if (left && right) {
        roundMatches.push(createGroupStageMatch_(eventName, groupCode, left, right));
      }
    }
    rounds.push(roundMatches);
    rotatingTeams.splice(1, 0, rotatingTeams.pop());
  }

  return rounds;
}

function createGroupStageMatch_(eventName, groupCode, teamA, teamB) {
  return createEmptyScheduleRow_({
    eventName: eventName,
    teamAName: teamA.teamName,
    teamAMembers: teamA.members,
    teamBName: teamB.teamName,
    teamBMembers: teamB.members,
    stage: MATCH_STAGE.group,
    slotLabel: String(groupCode),
  });
}

function buildBracketConfigs_(groupedRoster, rawOverrides) {
  const bracketConfigs = {};

  getEventNamesInImportOrder_(groupedRoster)
    .forEach(function (eventName) {
      const groupCodes = Object.keys(groupedRoster[eventName]).sort(sortTextNaturally_);
      const qualifierLabels = [];
      groupCodes.forEach(function (groupCode) {
        qualifierLabels.push(groupCode + '#1');
      });
      groupCodes.forEach(function (groupCode) {
        qualifierLabels.push(groupCode + '#2');
      });

      if (qualifierLabels.length < 2) {
        return;
      }

      const usesSixTeamSeededFormat = shouldUseSixTeamSeededFormat_(eventName, qualifierLabels);
      let bracketSize = nextPowerOfTwo_(qualifierLabels.length);
      let totalRounds = Math.log(bracketSize) / Math.log(2);
      const seedAssignments = assignQualifierSeeds_(
        qualifierLabels,
        isSeedOverrideEnabledEvent_(eventName) ? ((rawOverrides || {})[eventName] || {}) : {}
      );
      let matches = [];

      if (usesSixTeamSeededFormat) {
        bracketSize = 6;
        totalRounds = 3;
        matches = buildSixTeamSeededMatches_(eventName);
      } else {
        const seedOrder = buildSeedOrder_(bracketSize);
        for (let round = 1; round <= totalRounds; round += 1) {
          const matchCount = bracketSize / Math.pow(2, round);
          for (let matchNumber = 1; matchNumber <= matchCount; matchNumber += 1) {
            const matchId = buildFinalMatchId_(eventName, round, matchNumber);
            let sourceA;
            let sourceB;

            if (round === 1) {
              const positionIndex = (matchNumber - 1) * 2;
              const seedA = seedOrder[positionIndex];
              const seedB = seedOrder[positionIndex + 1];
              sourceA = seedA <= qualifierLabels.length ? { type: 'seed', seed: seedA } : { type: 'bye' };
              sourceB = seedB <= qualifierLabels.length ? { type: 'seed', seed: seedB } : { type: 'bye' };
            } else {
              sourceA = { type: 'winner', matchId: buildFinalMatchId_(eventName, round - 1, (matchNumber - 1) * 2 + 1) };
              sourceB = { type: 'winner', matchId: buildFinalMatchId_(eventName, round - 1, (matchNumber - 1) * 2 + 2) };
            }

            matches.push({
              matchId: matchId,
              round: round,
              matchNumber: matchNumber,
              sourceA: sourceA,
              sourceB: sourceB,
            });
          }
        }

        // Add 3rd place match if total rounds >= 2 (i.e. at least 4 teams)
        if (totalRounds >= 2) {
          const rounds = totalRounds;
          const loserMatchId = buildFinalMatchId_(eventName, rounds, 0); // Use 0 to indicate 3rd place
          matches.push({
            matchId: loserMatchId,
            round: rounds, // Same round as final or specialized indicator
            matchNumber: 0,
            isThirdPlace: true,
            sourceA: { type: 'loser', matchId: buildFinalMatchId_(eventName, rounds - 1, 1) },
            sourceB: { type: 'loser', matchId: buildFinalMatchId_(eventName, rounds - 1, 2) },
          });
        }
      }

      bracketConfigs[eventName] = {
        eventName: eventName,
        groupCodes: groupCodes,
        qualifierLabels: qualifierLabels,
        bracketSize: bracketSize,
        totalRounds: totalRounds,
        seedAssignments: seedAssignments,
        matches: matches,
      };
    });

  return bracketConfigs;
}

function shouldUseSixTeamSeededFormat_(eventName, qualifierLabels) {
  return isSeedOverrideEnabledEvent_(eventName) && qualifierLabels.length === 6;
}

function buildSixTeamSeededMatches_(eventName) {
  return [
    {
      matchId: buildFinalMatchId_(eventName, 1, 1),
      round: 1,
      matchNumber: 1,
      sourceA: { type: 'seed', seed: 2 },
      sourceB: { type: 'seed', seed: 3 },
    },
    {
      matchId: buildFinalMatchId_(eventName, 1, 2),
      round: 1,
      matchNumber: 2,
      sourceA: { type: 'seed', seed: 4 },
      sourceB: { type: 'seed', seed: 5 },
    },
    {
      matchId: buildFinalMatchId_(eventName, 2, 1),
      round: 2,
      matchNumber: 1,
      sourceA: { type: 'seed', seed: 1 },
      sourceB: { type: 'winner', matchId: buildFinalMatchId_(eventName, 1, 1) },
    },
    {
      matchId: buildFinalMatchId_(eventName, 2, 2),
      round: 2,
      matchNumber: 2,
      sourceA: { type: 'winner', matchId: buildFinalMatchId_(eventName, 1, 2) },
      sourceB: { type: 'seed', seed: 6 },
    },
    {
      matchId: buildFinalMatchId_(eventName, 3, 0),
      round: 3,
      matchNumber: 0,
      isThirdPlace: true,
      sourceA: { type: 'loser', matchId: buildFinalMatchId_(eventName, 2, 1) },
      sourceB: { type: 'loser', matchId: buildFinalMatchId_(eventName, 2, 2) },
    },
    {
      matchId: buildFinalMatchId_(eventName, 3, 1),
      round: 3,
      matchNumber: 1,
      sourceA: { type: 'winner', matchId: buildFinalMatchId_(eventName, 2, 1) },
      sourceB: { type: 'winner', matchId: buildFinalMatchId_(eventName, 2, 2) },
    },
  ];
}

function assignQualifierSeeds_(qualifierLabels, overrides) {
  const seedAssignments = {};
  const available = qualifierLabels.slice();
  const overrideKeys = Object.keys(overrides || {}).sort(function (left, right) {
    return Number(left) - Number(right);
  });

  overrideKeys.forEach(function (seedKey) {
    const desiredLabel = overrides[seedKey];
    const index = available.indexOf(desiredLabel);
    if (index !== -1) {
      seedAssignments[seedKey] = desiredLabel;
      available.splice(index, 1);
    }
  });

  for (let seed = 1; seed <= qualifierLabels.length; seed += 1) {
    if (!seedAssignments[String(seed)]) {
      seedAssignments[String(seed)] = available.shift();
    }
  }

  return seedAssignments;
}

function buildBracketScheduleRows_(bracketConfigs) {
  const matches = [];
  Object.keys(bracketConfigs)
    .forEach(function (eventName) {
      bracketConfigs[eventName].matches.forEach(function (match) {
        matches.push(createEmptyScheduleRow_({
          eventName: eventName,
          teamAName: formatBracketSourceLabel_(bracketConfigs[eventName], match.sourceA),
          teamAMembers: '',
          teamBName: formatBracketSourceLabel_(bracketConfigs[eventName], match.sourceB),
          teamBMembers: '',
          stage: MATCH_STAGE.final,
          slotLabel: match.matchId,
        }));
      });
    });
  return matches;
}

function buildEmptyFinalScheduleRows_(bracketConfigs) {
  const matches = [];
  Object.keys(bracketConfigs)
    .forEach(function (eventName) {
      bracketConfigs[eventName].matches.forEach(function (match) {
        const row = createEmptyScheduleRow_({
          eventName: eventName,
          teamAName: '',
          teamAMembers: '',
          teamBName: '',
          teamBMembers: '',
          stage: MATCH_STAGE.final,
          slotLabel: match.matchId,
        });
        row.status = '';
        matches.push(row);
      });
    });
  return matches;
}

function assignScheduleMetadata_(matches, options) {
  matches.forEach(function (match, index) {
    const timeIndex = Math.floor(index / options.courtCount);
    const courtIndex = (index % options.courtCount) + 1;
    match.court = '場地' + courtIndex;
    match.time = addMinutesToTimeString_(options.startTime, timeIndex * options.matchMinutes);
    match.order = index + 1;
  });
}

function assignScheduleMetadataWithOffset_(matches, options, offset) {
  const baseIndex = Math.max(0, Number(offset) || 0);
  matches.forEach(function (match, index) {
    const sequenceIndex = baseIndex + index;
    const timeIndex = Math.floor(sequenceIndex / options.courtCount);
    const courtIndex = (sequenceIndex % options.courtCount) + 1;
    match.court = '場地' + courtIndex;
    match.time = addMinutesToTimeString_(options.startTime, timeIndex * options.matchMinutes);
    match.order = sequenceIndex + 1;
  });
}

function createEmptyScheduleRow_(params) {
  return {
    court: '',
    time: '',
    order: '',
    eventName: params.eventName,
    teamAName: params.teamAName || '',
    teamAMembers: params.teamAMembers || '',
    teamBName: params.teamBName || '',
    teamBMembers: params.teamBMembers || '',
    scoreA: '',
    scoreB: '',
    winner: '',
    status: MATCH_STATUS.pending,
    stage: params.stage,
    slotLabel: params.slotLabel,
  };
}

function refreshDerivedState_() {
  const roster = getRosterRecords_();
  const schedule = getScheduleRecords_();
  const standings = buildGroupStandingsFromSchedule_(roster, schedule);
  const bracketConfigs = getSettingObject_(SETTING_KEYS.brackets, {});
  const bracketResolution = resolveBracketState_(bracketConfigs, schedule, standings);
  applyScheduleDerivations_(schedule, bracketResolution);
  const finalPlacements = buildFinalPlacements_(bracketResolution);
  applyRosterPlacements_(roster, standings, finalPlacements, schedule);
  writeRoster_(roster);
  writeSchedule_(schedule);
}

function buildGroupStandingsFromSchedule_(roster, schedule) {
  const grouped = {};
  roster.forEach(function (record) {
    if (!grouped[record.eventName]) {
      grouped[record.eventName] = {};
    }
    if (!grouped[record.eventName][record.groupCode]) {
      grouped[record.eventName][record.groupCode] = {};
    }
    grouped[record.eventName][record.groupCode][record.teamName] = {
      teamName: record.teamName,
      members: record.members,
      groupCode: record.groupCode,
      eventName: record.eventName,
      matches: 0,
      wins: 0,
      losses: 0,
      standingsPoints: 0,
      scoreFor: 0,
      scoreAgainst: 0,
      scoreDiff: 0,
      headToHeadWins: {},
      results: [],
    };
  });

  schedule
    .filter(function (match) {
      return match.stage === MATCH_STAGE.group;
    })
    .forEach(function (match) {
      const groupStats = grouped[match.eventName] && grouped[match.eventName][match.slotLabel];
      if (!groupStats) {
        return;
      }

      const teamA = groupStats[match.teamAName];
      const teamB = groupStats[match.teamBName];
      if (!teamA || !teamB) {
        return;
      }

      if ([MATCH_STATUS.complete, MATCH_STATUS.walkover, MATCH_STATUS.bye].indexOf(match.status) === -1) {
        return;
      }

      teamA.matches += 1;
      teamB.matches += 1;

      if (match.status === MATCH_STATUS.walkover) {
        if (match.winner === teamA.teamName) {
          teamA.wins += 1;
          teamB.losses += 1;
          teamA.standingsPoints += 2;
          teamA.headToHeadWins[teamB.teamName] = 1;
          teamA.results.push({ opponent: teamB.teamName, scoreFor: 0, scoreAgainst: 0, won: true });
          teamB.results.push({ opponent: teamA.teamName, scoreFor: 0, scoreAgainst: 0, won: false });
        } else if (match.winner === teamB.teamName) {
          teamB.wins += 1;
          teamA.losses += 1;
          teamB.standingsPoints += 2;
          teamB.headToHeadWins[teamA.teamName] = 1;
          teamA.results.push({ opponent: teamB.teamName, scoreFor: 0, scoreAgainst: 0, won: false });
          teamB.results.push({ opponent: teamA.teamName, scoreFor: 0, scoreAgainst: 0, won: true });
        }
        return;
      }

      const scoreA = Number(match.scoreA) || 0;
      const scoreB = Number(match.scoreB) || 0;
      teamA.scoreFor += scoreA;
      teamA.scoreAgainst += scoreB;
      teamB.scoreFor += scoreB;
      teamB.scoreAgainst += scoreA;
      teamA.scoreDiff = teamA.scoreFor - teamA.scoreAgainst;
      teamB.scoreDiff = teamB.scoreFor - teamB.scoreAgainst;

      if (scoreA > scoreB) {
        teamA.wins += 1;
        teamB.losses += 1;
        teamA.standingsPoints += 2;
        teamB.standingsPoints += 1;
        teamA.headToHeadWins[teamB.teamName] = 1;
        teamA.results.push({ opponent: teamB.teamName, scoreFor: scoreA, scoreAgainst: scoreB, won: true });
        teamB.results.push({ opponent: teamA.teamName, scoreFor: scoreB, scoreAgainst: scoreA, won: false });
      } else if (scoreB > scoreA) {
        teamB.wins += 1;
        teamA.losses += 1;
        teamB.standingsPoints += 2;
        teamA.standingsPoints += 1;
        teamB.headToHeadWins[teamA.teamName] = 1;
        teamA.results.push({ opponent: teamB.teamName, scoreFor: scoreA, scoreAgainst: scoreB, won: false });
        teamB.results.push({ opponent: teamA.teamName, scoreFor: scoreB, scoreAgainst: scoreA, won: true });
      }
    });

  const standings = {};
  Object.keys(grouped)
    .sort(sortTextNaturally_)
    .forEach(function (eventName) {
      standings[eventName] = {};
      Object.keys(grouped[eventName])
        .sort(sortTextNaturally_)
        .forEach(function (groupCode) {
          const teams = Object.keys(grouped[eventName][groupCode]).map(function (teamName) {
            return grouped[eventName][groupCode][teamName];
          });
          standings[eventName][groupCode] = rankGroupTeams_(teams);
        });
    });

  return standings;
}

function rankGroupTeams_(teams) {
  const groupedByPoints = {};
  teams.forEach(function (team) {
    const key = String(team.standingsPoints);
    if (!groupedByPoints[key]) {
      groupedByPoints[key] = [];
    }
    groupedByPoints[key].push(team);
  });

  return teams
    .slice()
    .sort(function (left, right) {
      if (right.standingsPoints !== left.standingsPoints) {
        return right.standingsPoints - left.standingsPoints;
      }

      const tiedTeams = groupedByPoints[String(left.standingsPoints)] || [];
      if (tiedTeams.length === 2) {
        const leftHeadToHead = left.headToHeadWins[right.teamName] || 0;
        const rightHeadToHead = right.headToHeadWins[left.teamName] || 0;
        if (leftHeadToHead !== rightHeadToHead) {
          return rightHeadToHead - leftHeadToHead;
        }
      } else if (tiedTeams.length > 2) {
        const tiedNames = {};
        tiedTeams.forEach(function (team) {
          tiedNames[team.teamName] = true;
        });
        const leftRelatedScore = getRelatedScoreFor_(left, tiedNames);
        const rightRelatedScore = getRelatedScoreFor_(right, tiedNames);
        if (rightRelatedScore !== leftRelatedScore) {
          return rightRelatedScore - leftRelatedScore;
        }
      }

      if (right.scoreFor !== left.scoreFor) {
        return right.scoreFor - left.scoreFor;
      }

      if (right.scoreDiff !== left.scoreDiff) {
        return right.scoreDiff - left.scoreDiff;
      }

      return sortTextNaturally_(left.teamName, right.teamName);
    })
    .map(function (team, index) {
      const rankedTeam = Object.assign({}, team);
      rankedTeam.rank = index + 1;
      return rankedTeam;
    });
}

function getRelatedScoreFor_(team, tiedNames) {
  return (team.results || []).reduce(function (total, result) {
    return tiedNames[result.opponent] ? total + result.scoreFor : total;
  }, 0);
}

function resolveBracketState_(bracketConfigs, schedule, standings) {
  const scheduleBySlot = {};
  schedule.forEach(function (match) {
    if (match.stage === MATCH_STAGE.final) {
      scheduleBySlot[match.slotLabel] = match;
    }
  });

  const resolution = {};
  Object.keys(bracketConfigs)
    .forEach(function (eventName) {
      const bracketConfig = bracketConfigs[eventName];
      const qualifierMap = {};

      (bracketConfig.groupCodes || []).forEach(function (rawGroupCode) {
        const groupCode = String(rawGroupCode || '').trim();
        const rankedTeams = (standings[eventName] && standings[eventName][groupCode]) || [];
        rankedTeams.forEach(function (team) {
          qualifierMap[groupCode + '#' + team.rank] = team;
        });
      });

      const winners = {};
      const losers = {};
      const resolvedMatches = bracketConfig.matches.map(function (matchConfig) {
        const scheduleRow = scheduleBySlot[matchConfig.matchId];
        const leftSide = resolveBracketParticipant_(matchConfig.sourceA, bracketConfig, qualifierMap, winners, losers);
        const rightSide = resolveBracketParticipant_(matchConfig.sourceB, bracketConfig, qualifierMap, winners, losers);
        let winner = null;
        let loser = null;
        let autoStatus = '';

        if (leftSide && leftSide.isBye && rightSide && !rightSide.isBye && !rightSide.isPlaceholder) {
          winner = rightSide;
          autoStatus = MATCH_STATUS.bye;
        } else if (rightSide && rightSide.isBye && leftSide && !leftSide.isBye && !leftSide.isPlaceholder) {
          winner = leftSide;
          autoStatus = MATCH_STATUS.bye;
        } else if (scheduleRow && [MATCH_STATUS.complete, MATCH_STATUS.walkover, MATCH_STATUS.bye].indexOf(scheduleRow.status) !== -1) {
          if (scheduleRow.winner === scheduleRow.teamAName) {
            winner = leftSide && !leftSide.isBye ? leftSide : createBracketParticipant_(scheduleRow.teamAName, scheduleRow.teamAMembers);
            loser = rightSide && !rightSide.isBye ? rightSide : null;
          } else if (scheduleRow.winner === scheduleRow.teamBName) {
            winner = rightSide && !rightSide.isBye ? rightSide : createBracketParticipant_(scheduleRow.teamBName, scheduleRow.teamBMembers);
            loser = leftSide && !leftSide.isBye ? leftSide : null;
          }
        }

        if (winner) {
          winners[matchConfig.matchId] = winner;
        }
        if (loser) {
          losers[matchConfig.matchId] = loser;
        }

        return {
          matchId: matchConfig.matchId,
          round: matchConfig.round,
          matchNumber: matchConfig.matchNumber,
          leftSide: leftSide,
          rightSide: rightSide,
          winner: winner,
          loser: loser,
          autoStatus: autoStatus,
        };
      });

      resolution[eventName] = {
        config: bracketConfig,
        qualifierMap: qualifierMap,
        winners: winners,
        matches: resolvedMatches,
      };
    });

  return resolution;
}

function resolveBracketParticipant_(source, bracketConfig, qualifierMap, winners, losers) {
  if (!source) {
    return createPlaceholderParticipant_(BRACKET_PLACEHOLDER);
  }

  if (source.type === 'bye') {
    return { teamName: 'BYE', members: '', isBye: true, isPlaceholder: false };
  }

  if (source.type === 'seed') {
    const seedKey = String(source.seed);
    const label = bracketConfig.seedAssignments[seedKey];
    if (!label) {
       return createPlaceholderParticipant_('Seed ' + seedKey);
    }
    const team = qualifierMap[label];
    if (team) {
      return createBracketParticipant_(team.teamName, team.members);
    }
    return createPlaceholderParticipant_(label || BRACKET_PLACEHOLDER);
  }

  if (source.type === 'winner') {
    const winner = winners[source.matchId];
    return winner ? winner : createPlaceholderParticipant_(WINNER_PLACEHOLDER);
  }

  if (source.type === 'loser') {
    const loser = losers[source.matchId];
    return loser ? loser : createPlaceholderParticipant_(LOSER_PLACEHOLDER);
  }

  return createPlaceholderParticipant_(BRACKET_PLACEHOLDER);
}

function createBracketParticipant_(teamName, members) {
  return {
    teamName: teamName,
    members: members || '',
    isBye: false,
    isPlaceholder: false,
  };
}

function createPlaceholderParticipant_(label) {
  return {
    teamName: label,
    members: '',
    isBye: false,
    isPlaceholder: true,
  };
}

function applyScheduleDerivations_(schedule, bracketResolution) {
  const resolutionByMatchId = {};
  Object.keys(bracketResolution).forEach(function (eventName) {
    bracketResolution[eventName].matches.forEach(function (match) {
      resolutionByMatchId[match.matchId] = match;
    });
  });

  schedule.forEach(function (match) {
    if (match.stage !== MATCH_STAGE.final) {
      return;
    }

    const resolvedMatch = resolutionByMatchId[match.slotLabel];
    if (!resolvedMatch) {
      return;
    }

    match.teamAName = resolvedMatch.leftSide ? resolvedMatch.leftSide.teamName : BRACKET_PLACEHOLDER;
    match.teamAMembers = resolvedMatch.leftSide && !resolvedMatch.leftSide.isPlaceholder ? resolvedMatch.leftSide.members : '';
    match.teamBName = resolvedMatch.rightSide ? resolvedMatch.rightSide.teamName : BRACKET_PLACEHOLDER;
    match.teamBMembers = resolvedMatch.rightSide && !resolvedMatch.rightSide.isPlaceholder ? resolvedMatch.rightSide.members : '';

    if (resolvedMatch.autoStatus === MATCH_STATUS.bye && resolvedMatch.winner) {
      match.scoreA = '';
      match.scoreB = '';
      match.winner = resolvedMatch.winner.teamName;
      match.status = MATCH_STATUS.bye;
    } else if (!match.winner && (resolvedMatch.leftSide.isPlaceholder || resolvedMatch.rightSide.isPlaceholder)) {
      match.status = MATCH_STATUS.ready;
    } else if ([MATCH_STATUS.complete, MATCH_STATUS.walkover, MATCH_STATUS.bye].indexOf(match.status) === -1) {
      match.status = MATCH_STATUS.pending;
    }
  });
}

function applyRosterPlacements_(roster, standings, finalPlacements, schedule) {
  const groupCompletionMap = buildGroupCompletionMap_(schedule || []);
  roster.forEach(function (record) {
    const rankedTeams = (standings[record.eventName] && standings[record.eventName][record.groupCode]) || [];
    const ranking = rankedTeams.find(function (team) {
      return team.teamName === record.teamName;
    });
    const groupKey = record.eventName + '::' + record.groupCode;
    const isGroupComplete = !!groupCompletionMap[groupKey];
    record.preliminaryRank = isGroupComplete && ranking ? String(ranking.rank) : '';
    record.finalRank = finalPlacements[record.eventName + '::' + record.teamName] || '';
  });
}

function buildGroupCompletionMap_(schedule) {
  const completionMap = {};

  (schedule || []).forEach(function (match) {
    if (match.stage !== MATCH_STAGE.group) {
      return;
    }

    const groupKey = match.eventName + '::' + match.slotLabel;
    if (!completionMap[groupKey]) {
      completionMap[groupKey] = { hasMatches: false, isComplete: true };
    }

    completionMap[groupKey].hasMatches = true;
    if ([MATCH_STATUS.complete, MATCH_STATUS.walkover, MATCH_STATUS.bye].indexOf(match.status) === -1) {
      completionMap[groupKey].isComplete = false;
    }
  });

  const result = {};
  Object.keys(completionMap).forEach(function (groupKey) {
    result[groupKey] = completionMap[groupKey].hasMatches && completionMap[groupKey].isComplete;
  });
  return result;
}

function buildFinalPlacements_(bracketResolution) {
  const placements = {};

  Object.keys(bracketResolution).forEach(function (eventName) {
    const eventResolution = bracketResolution[eventName];
    const rounds = eventResolution.config.totalRounds;

    eventResolution.matches.forEach(function (match) {
      if (match.loser && !match.loser.isPlaceholder && !match.loser.isBye) {
        const placement = match.round === rounds ? 2 : Math.pow(2, rounds - match.round) + 1;
        placements[eventName + '::' + match.loser.teamName] = String(placement);
      }
    });

    const finalMatchId = buildFinalMatchId_(eventName, rounds, 1);
    const finalMatch = eventResolution.matches.find(function (match) {
      return match.matchId === finalMatchId;
    });
    if (finalMatch && finalMatch.winner && !finalMatch.winner.isPlaceholder) {
      placements[eventName + '::' + finalMatch.winner.teamName] = '1';
    }
  });

  return placements;
}

function buildBracketViewModels_(bracketConfigs, schedule, standings) {
  const resolution = resolveBracketState_(bracketConfigs, schedule, standings);
  return Object.keys(resolution)
    .map(function (eventName) {
      const eventResolution = resolution[eventName];
      const rounds = [];
      for (let round = 1; round <= eventResolution.config.totalRounds; round += 1) {
        rounds.push({
          title: round === eventResolution.config.totalRounds ? '決賽' : 'R' + round,
          matches: eventResolution.matches
            .filter(function (match) {
              return match.round === round;
            })
            .map(function (match) {
              const scheduleRow = schedule.find(function (row) {
                return row.slotLabel === match.matchId;
              });
              return {
                matchId: match.matchId,
                leftLabel: match.leftSide ? match.leftSide.teamName : BRACKET_PLACEHOLDER,
                rightLabel: match.rightSide ? match.rightSide.teamName : BRACKET_PLACEHOLDER,
                winner: match.winner ? match.winner.teamName : '',
                status: scheduleRow ? scheduleRow.status : '',
                scoreText: scheduleRow && scheduleRow.scoreA !== '' && scheduleRow.scoreB !== '' ? scheduleRow.scoreA + ' : ' + scheduleRow.scoreB : '',
              };
            }),
        });
      }

      return {
        eventName: eventName,
        rounds: rounds,
      };
    });
}

function updateScheduleMatchResult_(payload) {
  const matchOrder = Number(payload.matchOrder);
  if (!matchOrder) {
    throw new Error('缺少比賽順序。');
  }

  const sheet = getOrCreateSheet_(TOURNAMENT_SHEETS.schedule.name);
  const dataRange = getDataRangeExcludingHeader_(sheet, TOURNAMENT_SHEETS.schedule.headers.length);
  const values = dataRange ? dataRange.getValues() : [];

  for (let index = 0; index < values.length; index += 1) {
    const rowNumber = index + 2;
    if (Number(values[index][2]) !== matchOrder) {
      continue;
    }

    const currentMatch = scheduleRowToObject_(values[index], rowNumber);
    const updates = normalizeScorePayload_(payload, currentMatch);
    const rowValues = scheduleObjectToRow_(Object.assign({}, currentMatch, updates));
    sheet.getRange(rowNumber, 1, 1, rowValues.length).setValues([rowValues]);
    return rowNumber;
  }

  return null;
}

function updateScheduleMatchOrders_(payload) {
  const updates = (payload && payload.updates) || [];
  if (!updates.length) {
    throw new Error('沒有可儲存的比賽順序。');
  }

  const normalizedUpdates = updates.map(function (item) {
    const rowNumber = Number(item.rowNumber);
    const order = Number(item.order);
    if (!Number.isInteger(rowNumber) || rowNumber < 2) {
      throw new Error('存在無效的列號。');
    }
    if (!Number.isInteger(order) || order <= 0) {
      throw new Error('比賽順序必須是正整數。');
    }
    return {
      rowNumber: rowNumber,
      order: order,
    };
  });

  const seenOrders = {};
  normalizedUpdates.forEach(function (item) {
    if (seenOrders[item.order]) {
      throw new Error('比賽順序不可重複：' + item.order);
    }
    seenOrders[item.order] = true;
  });

  const sheet = getOrCreateSheet_(TOURNAMENT_SHEETS.schedule.name);
  const dataRange = getDataRangeExcludingHeader_(sheet, TOURNAMENT_SHEETS.schedule.headers.length);
  const values = dataRange ? dataRange.getValues() : [];
  const updatesByRow = {};
  normalizedUpdates.forEach(function (item) {
    updatesByRow[item.rowNumber] = item.order;
  });

  const finalOrders = [];
  values.forEach(function (row, index) {
    const rowNumber = index + 2;
    const existingOrder = Number(row[2]);
    const proposedOrder = updatesByRow[rowNumber] != null ? updatesByRow[rowNumber] : existingOrder;

    if (!Number.isInteger(proposedOrder) || proposedOrder <= 0) {
      throw new Error('賽程工作表中存在無效的比賽順序。');
    }

    finalOrders.push({
      rowNumber: rowNumber,
      order: proposedOrder,
    });
  });

  const duplicateOrders = findDuplicateValues_(finalOrders.map(function (item) {
    return item.order;
  }));
  if (duplicateOrders.length) {
    throw new Error('賽程工作表比賽順序有重複：' + duplicateOrders.join('、'));
  }

  // Update all orders in the sheet first
  finalOrders.forEach(function (item) {
    sheet.getRange(item.rowNumber, 3).setValue(item.order);
  });

  // Re-read everything, sort by order, and re-assign Time and Court
  const updatedValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, TOURNAMENT_SHEETS.schedule.headers.length).getValues();
  const sortedMatches = updatedValues.map(function(row, idx) {
    return {
      rowNumber: idx + 2,
      row: row,
      order: Number(row[2])
    };
  }).sort(function(a, b) {
    return a.order - b.order;
  });

  const config = getSettingObject_(SETTING_KEYS.config) || DEFAULT_GENERATION_OPTIONS;
  const courtCount = Number(config.courtCount) || 2;
  const matchMinutes = Number(config.matchMinutes) || 15;
  const startTime = config.startTime || '09:00';

  sortedMatches.forEach(function(item, index) {
    const sequenceIndex = index;
    const timeIndex = Math.floor(sequenceIndex / courtCount);
    const courtIndex = (sequenceIndex % courtCount) + 1;
    const newCourt = '場地' + courtIndex;
    const newTime = addMinutesToTimeString_(startTime, timeIndex * matchMinutes);
    
    // Update Time (col 1), Court (col 2)
    sheet.getRange(item.rowNumber, 1).setValue(newCourt);
    sheet.getRange(item.rowNumber, 2).setValue(newTime);
  });
}

function findDuplicateValues_(values) {
  const seen = {};
  const duplicates = {};
  values.forEach(function (value) {
    if (seen[value]) {
      duplicates[value] = true;
      return;
    }
    seen[value] = true;
  });
  return Object.keys(duplicates).sort(function (left, right) {
    return Number(left) - Number(right);
  });
}

function normalizeScorePayload_(payload, currentMatch) {
  const action = payload.action || 'score';
  if (action === 'reset') {
    return {
      scoreA: '',
      scoreB: '',
      winner: '',
      status: currentMatch.stage === MATCH_STAGE.final ? MATCH_STATUS.ready : MATCH_STATUS.pending,
    };
  }

  if (action === 'in_progress') {
    const scoreA = Number(payload.scoreA);
    const scoreB = Number(payload.scoreB);
    return {
      scoreA: Number.isFinite(scoreA) ? Math.max(0, scoreA) : '',
      scoreB: Number.isFinite(scoreB) ? Math.max(0, scoreB) : '',
      winner: '',
      status: MATCH_STATUS.in_progress,
    };
  }

  if (currentMatch.teamAName === BRACKET_PLACEHOLDER || currentMatch.teamBName === BRACKET_PLACEHOLDER ||
      currentMatch.teamAName === WINNER_PLACEHOLDER || currentMatch.teamBName === WINNER_PLACEHOLDER ||
      currentMatch.teamAName === 'BYE' || currentMatch.teamBName === 'BYE') {
    throw new Error('這場比賽的選手尚未確定，暫時不能登錄成績。');
  }

  if (action === 'walkoverA') {
    return {
      scoreA: '',
      scoreB: '',
      winner: currentMatch.teamBName, // A walks over, B wins
      status: MATCH_STATUS.walkover,
    };
  }

  if (action === 'walkoverB') {
    return {
      scoreA: '',
      scoreB: '',
      winner: currentMatch.teamAName, // B walks over, A wins
      status: MATCH_STATUS.walkover,
    };
  }

  const scoreA = Number(payload.scoreA);
  const scoreB = Number(payload.scoreB);
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA < 0 || scoreB < 0) {
    throw new Error('請輸入有效的非負分數。');
  }
  if (scoreA === scoreB) {
    throw new Error('比賽不能平手，請重新輸入分數。');
  }

  return {
    scoreA: scoreA,
    scoreB: scoreB,
    winner: scoreA > scoreB ? currentMatch.teamAName : currentMatch.teamBName,
    status: MATCH_STATUS.complete,
  };
}

function getRosterRecords_() {
  const sheet = getOrCreateSheet_(TOURNAMENT_SHEETS.roster.name);
  const dataRange = getDataRangeExcludingHeader_(sheet, TOURNAMENT_SHEETS.roster.headers.length);
  if (!dataRange) {
    return [];
  }

  return dataRange
    .getValues()
    .map(function (row, index) {
      return rosterRowToObject_(row, index + 2);
    })
    .filter(function (record) {
      return record.eventName && record.teamName;
    });
}

function getScheduleRecords_() {
  const sheet = getOrCreateSheet_(TOURNAMENT_SHEETS.schedule.name);
  const dataRange = getDataRangeExcludingHeader_(sheet, TOURNAMENT_SHEETS.schedule.headers.length);
  if (!dataRange) {
    return [];
  }

  return dataRange
    .getValues()
    .map(function (row, index) {
      return scheduleRowToObject_(row, index + 2);
    })
    .filter(function (record) {
      return record.eventName;
    });
}

function writeRoster_(records) {
  const sheet = getOrCreateSheet_(TOURNAMENT_SHEETS.roster.name);
  clearDataRows_(sheet);
  if (!records.length) {
    return;
  }

  const values = records.map(function (record) {
    return rosterObjectToRow_(record);
  });
  sheet.getRange(2, 1, values.length, TOURNAMENT_SHEETS.roster.headers.length).setValues(values);
  autoResizeColumns_(sheet, TOURNAMENT_SHEETS.roster.headers.length);
}

function writeSchedule_(matches) {
  const sheet = getOrCreateSheet_(TOURNAMENT_SHEETS.schedule.name);
  clearDataRows_(sheet);
  if (!matches.length) {
    return;
  }

  const values = matches.map(function (match) {
    return scheduleObjectToRow_(match);
  });
  sheet.getRange(2, 2, values.length, 1).setNumberFormat('@');
  sheet.getRange(2, 1, values.length, TOURNAMENT_SHEETS.schedule.headers.length).setValues(values);
  sheet.getRange(2, 2, values.length, 1).setNumberFormat('@');
  autoResizeColumns_(sheet, TOURNAMENT_SHEETS.schedule.headers.length);
}

function rosterRowToObject_(row, rowNumber) {
  return {
    rowNumber: rowNumber,
    eventName: String(row[0] || '').trim(),
    teamName: String(row[1] || '').trim(),
    members: String(row[2] || '').trim(),
    groupCode: String(row[3] || '').trim(),
    preliminaryRank: String(row[4] || '').trim(),
    finalRank: String(row[5] || '').trim(),
    importOrder: rowNumber - 1,
  };
}

function rosterObjectToRow_(record) {
  return [
    record.eventName,
    record.teamName,
    record.members,
    record.groupCode,
    record.preliminaryRank || '',
    record.finalRank || '',
  ];
}

function scheduleRowToObject_(row, rowNumber) {
  return {
    rowNumber: rowNumber,
    court: String(row[0] || '').trim(),
    time: String(row[1] || '').trim(),
    order: row[2],
    eventName: String(row[3] || '').trim(),
    teamAName: String(row[4] || '').trim(),
    teamAMembers: String(row[5] || '').trim(),
    teamBName: String(row[6] || '').trim(),
    teamBMembers: String(row[7] || '').trim(),
    scoreA: row[8] === '' ? '' : Number(row[8]),
    scoreB: row[9] === '' ? '' : Number(row[9]),
    winner: String(row[10] || '').trim(),
    status: String(row[11] || '').trim(),
    stage: String(row[12] || '').trim(),
    slotLabel: String(row[13] || '').trim(),
  };
}

function scheduleObjectToRow_(match) {
  return [
    match.court || '',
    match.time || '',
    match.order || '',
    match.eventName || '',
    match.teamAName || '',
    match.teamAMembers || '',
    match.teamBName || '',
    match.teamBMembers || '',
    match.scoreA === '' ? '' : match.scoreA,
    match.scoreB === '' ? '' : match.scoreB,
    match.winner || '',
    match.status || '',
    match.stage || '',
    match.slotLabel || '',
  ];
}

function getOrCreateSheet_(sheetName, legacyNames) {
  const spreadsheet = getTournamentSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    (legacyNames || []).some(function (legacyName) {
      const legacySheet = spreadsheet.getSheetByName(legacyName);
      if (legacySheet) {
        legacySheet.setName(sheetName);
        sheet = legacySheet;
        return true;
      }
      return false;
    });
  }
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function clearDataRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getMaxColumns()).clearContent();
  }
}

function getDataRangeExcludingHeader_(sheet, width) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return null;
  }
  return sheet.getRange(2, 1, lastRow - 1, width);
}

function autoResizeColumns_(sheet, width) {
  for (let column = 1; column <= width; column += 1) {
    sheet.autoResizeColumn(column);
  }
}

function setSettingObject_(key, value) {
  const sheet = getOrCreateSheet_(TOURNAMENT_SHEETS.settings.name);
  const dataRange = getDataRangeExcludingHeader_(sheet, 2);
  const values = dataRange ? dataRange.getValues() : [];
  const serialized = JSON.stringify(value);

  for (let index = 0; index < values.length; index += 1) {
    if (values[index][0] === key) {
      sheet.getRange(index + 2, 2).setValue(serialized);
      return;
    }
  }

  sheet.appendRow([key, serialized]);
}

function getSettingObject_(key, fallbackValue) {
  const sheet = getOrCreateSheet_(TOURNAMENT_SHEETS.settings.name);
  const dataRange = getDataRangeExcludingHeader_(sheet, 2);
  const values = dataRange ? dataRange.getValues() : [];

  for (let index = 0; index < values.length; index += 1) {
    if (values[index][0] === key) {
      const rawValue = values[index][1];
      if (rawValue === '' || rawValue == null) {
        return fallbackValue;
      }
      try {
        return JSON.parse(rawValue);
      } catch (error) {
        return fallbackValue;
      }
    }
  }

  return fallbackValue;
}

function formatBracketSourceLabel_(bracketConfig, source) {
  if (source.type === 'bye') {
    return 'BYE';
  }
  if (source.type === 'seed') {
    return bracketConfig.seedAssignments[String(source.seed)] || BRACKET_PLACEHOLDER;
  }
  if (source.type === 'winner') {
    return WINNER_PLACEHOLDER;
  }
  return BRACKET_PLACEHOLDER;
}

function buildSeedOrder_(size) {
  if (size <= 1) {
    return [1];
  }

  let order = [1, 2];
  while (order.length < size) {
    const nextOrder = [];
    const maxSeed = order.length * 2 + 1;
    order.forEach(function (seed) {
      nextOrder.push(seed);
      nextOrder.push(maxSeed - seed);
    });
    order = nextOrder;
  }
  return order;
}

function nextPowerOfTwo_(value) {
  let size = 1;
  while (size < value) {
    size *= 2;
  }
  return size;
}

function buildFinalMatchId_(eventName, round, matchNumber) {
  return eventName + ':R' + round + 'M' + matchNumber;
}

function normalizeGroupCode_(groupCode) {
  return String(groupCode || '').trim();
}

function normalizeTimeString_(timeString) {
  const normalized = String(timeString || '').trim();
  const parts = normalized.split(':');
  if (parts.length !== 2) {
    return DEFAULT_GENERATION_OPTIONS.startTime;
  }

  const hours = Math.max(0, Math.min(23, Number(parts[0]) || 0));
  const minutes = Math.max(0, Math.min(59, Number(parts[1]) || 0));
  return Utilities.formatString('%02d:%02d', hours, minutes);
}

function addMinutesToTimeString_(timeString, minutesToAdd) {
  const parts = normalizeTimeString_(timeString).split(':');
  const totalMinutes = Number(parts[0]) * 60 + Number(parts[1]) + minutesToAdd;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return Utilities.formatString('%02d:%02d', hours, minutes);
}

function sortTextNaturally_(left, right) {
  return String(left || '').localeCompare(String(right || ''), 'zh-Hant', {
    numeric: true,
    sensitivity: 'base',
  });
}
