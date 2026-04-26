const TOURNAMENT_SHEETS = {
  roster: {
    name: '人員名單',
    legacyNames: ['參賽名單'],
    headers: ['報名項目', '隊名', '隊員', '分組編號', '預賽名次', '決賽名次'],
  },
  schedule: {
    name: '賽程',
    headers: [
      '場地',
      '時間',
      '比賽順序',
      '報名項目',
      'A隊名',
      'A隊員',
      'B隊名',
      'B隊員',
      'A分數',
      'B分數',
      '勝方',
      '狀態',
      '階段',
      '分組/來源',
    ],
  },
  settings: {
    name: '設定',
    headers: ['key', 'value'],
  },
};

const MATCH_STATUS = {
  pending: '未開始',
  ready: '待選手',
  in_progress: '進行中',
  complete: '已完成',
  walkover: '棄權',
  bye: '輪空',
};

const MATCH_STAGE = {
  group: '小組賽',
  final: '決賽',
};

const BRACKET_PLACEHOLDER = '待定';
const WINNER_PLACEHOLDER = '勝方待定';
const LOSER_PLACEHOLDER = '敗方待定';

const SETTING_KEYS = {
  config: 'tournament_config',
  brackets: 'bracket_configs',
  lastGeneratedAt: 'last_generated_at',
};

const SCRIPT_PROPERTY_KEYS = {
  spreadsheetId: 'TOURNAMENT_SPREADSHEET_ID',
};

const DEFAULT_TOURNAMENT_SPREADSHEET_ID = '1ERnk240HvBwMpDCNdf5mjYpngpZ6NH37qwc1WcqW7J4';

const DEFAULT_GENERATION_OPTIONS = {
  courtCount: 3,
  startTime: '09:00',
  matchMinutes: 15,
  seedOverrides: {},
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('EZ Tournament 超簡單錦標賽產生器')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function initializeTournamentProject() {
  ensureProjectSheets_();
  return getDashboard();
}

function getDashboard() {
  ensureProjectSheets_();
  return buildDashboard_();
}

function connectTournamentSpreadsheet(spreadsheetId) {
  const normalizedId = String(spreadsheetId || '').trim();
  if (!normalizedId) {
    throw new Error('請提供要連接的 Spreadsheet ID。');
  }

  PropertiesService.getScriptProperties().setProperty(
    SCRIPT_PROPERTY_KEYS.spreadsheetId,
    normalizedId
  );

  ensureProjectSheets_();
  return getConnectedSpreadsheetInfo();
}

function getConnectedSpreadsheetInfo() {
  const spreadsheet = getTournamentSpreadsheet_();
  return {
    id: spreadsheet.getId(),
    name: spreadsheet.getName(),
    url: spreadsheet.getUrl(),
  };
}

function importRoster(text) {
  ensureProjectSheets_();
  const records = parseRosterText_(text);
  writeRoster_(records);
  writeSchedule_([]);
  setSettingObject_(SETTING_KEYS.brackets, {});
  setSettingObject_(SETTING_KEYS.config, DEFAULT_GENERATION_OPTIONS);
  setSettingObject_(SETTING_KEYS.lastGeneratedAt, null);
  return buildDashboard_();
}

function generateTournament(rawOptions) {
  ensureProjectSheets_();
  const options = normalizeGenerationOptions_(rawOptions);
  const roster = getRosterRecords_();
  if (!roster.length) {
    throw new Error('請先匯入人員名單，再產生賽程。');
  }

  const groupedRoster = groupRosterByEvent_(roster);
  const preliminaryMatches = buildGroupStageMatches_(groupedRoster);
  const previewBracketConfigs = buildBracketConfigs_(groupedRoster, {});
  const finalPlaceholders = buildEmptyFinalScheduleRows_(previewBracketConfigs);
  const allMatches = preliminaryMatches.concat(finalPlaceholders);
  assignScheduleMetadata_(allMatches, options);

  writeSchedule_(allMatches);
  setSettingObject_(SETTING_KEYS.config, options);
  setSettingObject_(SETTING_KEYS.brackets, {});
  setSettingObject_(SETTING_KEYS.lastGeneratedAt, new Date().toISOString());

  refreshDerivedState_();
  return buildDashboard_();
}

function saveFinalBracket(rawOptions) {
  ensureProjectSheets_();
  const currentConfig = normalizeGenerationOptions_(getSettingObject_(SETTING_KEYS.config, DEFAULT_GENERATION_OPTIONS));
  const incoming = rawOptions || {};
  const options = normalizeGenerationOptions_({
    courtCount: incoming.courtCount != null ? incoming.courtCount : currentConfig.courtCount,
    startTime: incoming.startTime || currentConfig.startTime,
    matchMinutes: incoming.matchMinutes != null ? incoming.matchMinutes : currentConfig.matchMinutes,
    seedOverrides: incoming.seedOverrides || currentConfig.seedOverrides || {},
  });

  const roster = getRosterRecords_();
  if (!roster.length) {
    throw new Error('請先匯入人員名單，再產生決賽籤表。');
  }

  const groupedRoster = groupRosterByEvent_(roster);
  validateRequiredSeedOverrides_(groupedRoster, options.seedOverrides);
  const rawSchedule = getScheduleRecords_();
  const groupCompletionMap = buildGroupCompletionMap_(rawSchedule);
  Object.keys(groupedRoster).forEach(function (eventName) {
    const groupCodes = Object.keys(groupedRoster[eventName] || {});
    groupCodes.forEach(function (groupCode) {
      const key = eventName + '::' + groupCode;
      if (!groupCompletionMap[key]) {
        throw new Error(eventName + ' / ' + groupCode + ' 預賽尚未完成，暫時無法儲存決賽籤表。');
      }
    });
  });

  const bracketConfigs = buildBracketConfigs_(groupedRoster, options.seedOverrides);
  if (!Object.keys(bracketConfigs).length) {
    throw new Error('目前沒有可產生的決賽場次。');
  }

  const expectedFinalSlots = {};
  Object.keys(bracketConfigs).forEach(function (eventName) {
    bracketConfigs[eventName].matches.forEach(function (matchConfig) {
      expectedFinalSlots[matchConfig.matchId] = true;
    });
  });

  let schedule = rawSchedule.filter(function (match) {
    return match.stage !== MATCH_STAGE.final || expectedFinalSlots[match.slotLabel];
  });
  const removedLegacyFinalRows = schedule.length !== rawSchedule.length;
  const maxOrder = schedule.reduce(function (currentMax, match) {
    return Math.max(currentMax, Number(match.order) || 0);
  }, 0);
  const existingFinalSlots = {};
  schedule.forEach(function (match) {
    if (match.stage === MATCH_STAGE.final) {
      existingFinalSlots[match.slotLabel] = true;
    }
  });

  const missingFinalRows = [];
  Object.keys(bracketConfigs).forEach(function (eventName) {
    bracketConfigs[eventName].matches.forEach(function (matchConfig) {
      if (existingFinalSlots[matchConfig.matchId]) {
        return;
      }
      missingFinalRows.push(createEmptyScheduleRow_({
        eventName: eventName,
        teamAName: '',
        teamAMembers: '',
        teamBName: '',
        teamBMembers: '',
        stage: MATCH_STAGE.final,
        slotLabel: matchConfig.matchId,
      }));
      missingFinalRows[missingFinalRows.length - 1].status = '';
    });
  });

  if (removedLegacyFinalRows || missingFinalRows.length) {
    assignScheduleMetadataWithOffset_(missingFinalRows, options, maxOrder);
    schedule = schedule.concat(missingFinalRows);
    writeSchedule_(schedule);
  }

  setSettingObject_(SETTING_KEYS.config, options);
  setSettingObject_(SETTING_KEYS.brackets, bracketConfigs);
  setSettingObject_(SETTING_KEYS.lastGeneratedAt, new Date().toISOString());

  refreshDerivedState_();
  return buildDashboard_();
}

function saveMatchResult(payload) {
  ensureProjectSheets_();
  const rowNumber = updateScheduleMatchResult_(payload);
  if (!rowNumber) {
    throw new Error('找不到要更新的比賽。');
  }

  refreshDerivedState_();
  return buildDashboard_();
}

function saveMatchOrders(payload) {
  ensureProjectSheets_();
  updateScheduleMatchOrders_(payload);
  refreshDerivedState_();
  return buildDashboard_();
}

function resetAllData() {
  ensureProjectSheets_();
  writeRoster_([]);
  writeSchedule_([]);
  setSettingObject_(SETTING_KEYS.brackets, {});
  setSettingObject_(SETTING_KEYS.config, DEFAULT_GENERATION_OPTIONS);
  setSettingObject_(SETTING_KEYS.lastGeneratedAt, null);
  return buildDashboard_();
}

 
