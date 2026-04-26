function runSmokeChecks() {
  Logger.log('seedOrder4=%s', buildSeedOrder_(4).join(','));
  Logger.log('seedOrder8=%s', buildSeedOrder_(8).join(','));
  Logger.log('nextPowerOfTwo18=%s', nextPowerOfTwo_(18));
  Logger.log('timeAfter45=%s', addMinutesToTimeString_('09:00', 45));
  Logger.log('normalizedTime=%s', normalizeTimeString_('7:5'));

  const tiedTeams = [
    {
      teamName: 'A',
      standingsPoints: 3,
      scoreFor: 26,
      scoreDiff: 0,
      headToHeadWins: { B: 1 },
      results: [
        { opponent: 'B', scoreFor: 15, scoreAgainst: 10 },
        { opponent: 'C', scoreFor: 11, scoreAgainst: 16 },
      ],
    },
    {
      teamName: 'B',
      standingsPoints: 3,
      scoreFor: 27,
      scoreDiff: 0,
      headToHeadWins: { C: 1 },
      results: [
        { opponent: 'A', scoreFor: 10, scoreAgainst: 15 },
        { opponent: 'C', scoreFor: 17, scoreAgainst: 12 },
      ],
    },
    {
      teamName: 'C',
      standingsPoints: 3,
      scoreFor: 28,
      scoreDiff: 0,
      headToHeadWins: { A: 1 },
      results: [
        { opponent: 'A', scoreFor: 16, scoreAgainst: 11 },
        { opponent: 'B', scoreFor: 12, scoreAgainst: 17 },
      ],
    },
  ];
  Logger.log('threeWayTieOrder=%s', rankGroupTeams_(tiedTeams).map(function (team) {
    return team.teamName;
  }).join(','));

  const groupedRoster = groupRosterByEvent_([
    { eventName: '男雙', teamName: 'A1', members: 'A1', groupCode: 'A' },
    { eventName: '男雙', teamName: 'A2', members: 'A2', groupCode: 'A' },
    { eventName: '男雙', teamName: 'A3', members: 'A3', groupCode: 'A' },
    { eventName: '男雙', teamName: 'A4', members: 'A4', groupCode: 'A' },
    { eventName: '男雙', teamName: 'B1', members: 'B1', groupCode: 'B' },
    { eventName: '男雙', teamName: 'B2', members: 'B2', groupCode: 'B' },
    { eventName: '男雙', teamName: 'B3', members: 'B3', groupCode: 'B' },
    { eventName: '男雙', teamName: 'B4', members: 'B4', groupCode: 'B' },
    { eventName: '男雙', teamName: 'C1', members: 'C1', groupCode: 'C' },
    { eventName: '男雙', teamName: 'C2', members: 'C2', groupCode: 'C' },
    { eventName: '男雙', teamName: 'C3', members: 'C3', groupCode: 'C' },
    { eventName: '男雙', teamName: 'C4', members: 'C4', groupCode: 'C' },
  ]);
  const groupOrderSummary = {};
  buildGroupStageMatches_(groupedRoster).forEach(function (match, index) {
    if (!groupOrderSummary[match.slotLabel]) {
      groupOrderSummary[match.slotLabel] = [];
    }
    groupOrderSummary[match.slotLabel].push(index + 1);
  });
  Logger.log('imageRoundRobinOrder=%s', JSON.stringify(groupOrderSummary));

  const eventOrderMatches = buildGroupStageMatches_(groupRosterByEvent_([
    { eventName: '男雙', teamName: '男1', members: '男1', groupCode: 'A', importOrder: 1 },
    { eventName: '男雙', teamName: '男2', members: '男2', groupCode: 'A', importOrder: 2 },
    { eventName: '女雙', teamName: '女1', members: '女1', groupCode: 'A', importOrder: 3 },
    { eventName: '女雙', teamName: '女2', members: '女2', groupCode: 'A', importOrder: 4 },
  ]));
  Logger.log('importEventOrderFirst=%s', eventOrderMatches[0].eventName);
}
  