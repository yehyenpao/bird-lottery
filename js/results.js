const Results = {
    standardCombos: [
        { order: 1, label: "組合1" },
        { order: 2, label: "組合2" },
        { order: 3, label: "組合3" },
        { order: 4, label: "組合4" },
        { order: 5, label: "組合5" },
        { order: 6, label: "組合6" }
    ],
    async load() {
        const res = await API.getSchedule();
        if (res && res.status === "success") {
            this.calculateAndRender(res.data || []);
        } else {
            this.renderEmpty();
        }
    },

    calculateAndRender(matches) {
        if (!Array.isArray(matches) || matches.length === 0) {
            this.lastLotteryData = null;
            this.lastStandardMatches = [];
            this.renderEmpty();
            return;
        }

        const clean = (value) => String(value || "").trim();
        const allTeams = new Set();

        matches.forEach(match => {
            const teamA = clean(match["A隊名"]);
            const teamB = clean(match["B隊名"]);
            if (teamA) allTeams.add(teamA);
            if (teamB) allTeams.add(teamB);
        });

        const isLottery = allTeams.size > 4;

        const standardTable = document.getElementById("results-standard-table");
        const lotterySection = document.getElementById("results-section");
        const lotteryAction = document.getElementById("lottery-action-section");
        if (standardTable) standardTable.style.display = isLottery ? "none" : "";
        if (lotterySection) lotterySection.style.display = isLottery ? "" : "none";
        if (lotteryAction) lotteryAction.style.display = isLottery ? "" : "none";
        this.toggleStandardPointsColumn(isLottery);

        const stats = {};
        matches.forEach(match => {
            const teamA = clean(match["A隊名"]);
            const teamB = clean(match["B隊名"]);
            const area = clean(match["區"]);

            [teamA, teamB].forEach(team => {
                if (!team) return;
                if (!stats[team]) {
                    stats[team] = {
                        teamName: team,
                        area,
                        matchWins: 0,
                        matchLosses: 0,
                        matchPoints: 0,
                        totalPoints: 0,
                        totalScored: 0,
                        totalConceded: 0,
                        diff: 0,
                        quotient: 0,
                        rank: 0
                    };
                }
            });
        });

        matches.forEach(match => {
            const teamA = clean(match["A隊名"]);
            const teamB = clean(match["B隊名"]);
            if (!teamA || !teamB || !stats[teamA] || !stats[teamB]) return;

            const scoreA = parseInt(match["A隊比分"] || 0, 10);
            const scoreB = parseInt(match["B隊比分"] || 0, 10);

            stats[teamA].totalScored += scoreA;
            stats[teamA].totalConceded += scoreB;
            stats[teamB].totalScored += scoreB;
            stats[teamB].totalConceded += scoreA;

            if (scoreA > scoreB) {
                stats[teamA].matchWins++;
                stats[teamB].matchLosses++;
                stats[teamA].totalPoints += isLottery ? 100 : 3;
                stats[teamB].totalPoints += isLottery ? 50 : 1;
            } else if (scoreB > scoreA) {
                stats[teamB].matchWins++;
                stats[teamA].matchLosses++;
                stats[teamB].totalPoints += isLottery ? 100 : 3;
                stats[teamA].totalPoints += isLottery ? 50 : 1;
            }
        });

        this.applyComboMatchPoints(matches, stats, clean);

        Object.values(stats).forEach(team => {
            team.diff = team.totalScored - team.totalConceded;
            team.quotient = team.totalConceded === 0
                ? (team.totalScored > 0 ? 999 : 0)
                : (team.totalScored / team.totalConceded);
        });

        const sortFn = (a, b) => {
            if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
            if (b.matchWins !== a.matchWins) return b.matchWins - a.matchWins;
            if (b.diff !== a.diff) return b.diff - a.diff;
            return b.quotient - a.quotient;
        };

        if (isLottery) {
            this.lastStandardMatches = [];

            const byArea = {};
            Object.values(stats).forEach(team => {
                const key = team.area || "未分區";
                if (!byArea[key]) byArea[key] = [];
                byArea[key].push(team);
            });

            Object.values(byArea).forEach(list => {
                list.sort(sortFn).forEach((team, index) => {
                    team.rank = index + 1;
                });
            });

            this.lastLotteryData = byArea;
            this.clearStandardDetailTable();
            this.renderLotteryTable(byArea);
            return;
        }

        this.lastLotteryData = null;
        this.lastStandardMatches = matches;
        const resultList = Object.values(stats).sort(sortFn);
        resultList.forEach((team, index) => {
            team.rank = index + 1;
        });
        this.renderTable(resultList, matches);
    },

    applyComboMatchPoints(matches, stats, clean) {
        const comboGroups = {};

        matches.forEach(match => {
            const teamA = clean(match["A隊名"]);
            const teamB = clean(match["B隊名"]);
            if (!teamA || !teamB || !stats[teamA] || !stats[teamB]) return;

            const round = clean(match["輪次"]);
            const pairKey = [teamA, teamB].sort().join("::");
            const groupKey = `${round}||${pairKey}`;

            if (!comboGroups[groupKey]) {
                comboGroups[groupKey] = {
                    teamA,
                    teamB,
                    wins: { [teamA]: 0, [teamB]: 0 }
                };
            }

            const scoreA = parseInt(match["A隊比分"] || 0, 10);
            const scoreB = parseInt(match["B隊比分"] || 0, 10);
            if (scoreA > scoreB) comboGroups[groupKey].wins[teamA]++;
            if (scoreB > scoreA) comboGroups[groupKey].wins[teamB]++;
        });

        Object.values(comboGroups).forEach(group => {
            const winsA = group.wins[group.teamA] || 0;
            const winsB = group.wins[group.teamB] || 0;

            if (winsA === 0 && winsB === 0) return;

            if (winsA > winsB) {
                stats[group.teamA].matchPoints += 2;
                stats[group.teamB].matchPoints += 1;
            } else if (winsB > winsA) {
                stats[group.teamB].matchPoints += 2;
                stats[group.teamA].matchPoints += 1;
            }
        });
    },

    renderEmpty() {
        const standardTbody = document.getElementById("results-tbody");
        const lotterySection = document.getElementById("results-section");
        this.toggleStandardPointsColumn(false);
        this.clearStandardDetailTable();
        if (standardTbody) {
            standardTbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--text-dim);">尚未產生預賽資料</td></tr>`;
        }
        if (lotterySection) {
            lotterySection.innerHTML = `<div style="text-align:center;color:var(--text-dim);padding:3rem;">尚未產生預賽資料</div>`;
        }
    },

    toggleStandardPointsColumn(showPoints) {
        const header = document.querySelector("#results-standard-table thead th:nth-child(6)");
        if (header) {
            header.style.display = showPoints ? "" : "none";
        }

        const cells = document.querySelectorAll("#results-standard-table tbody td:nth-child(6)");
        cells.forEach(cell => {
            cell.style.display = showPoints ? "" : "none";
        });
    },

    renderLotteryTable(byArea) {
        const container = document.getElementById("results-section");
        this.clearStandardDetailTable();
        if (!container) {
            this.renderTableFallback(byArea);
            return;
        }

        const html = Object.keys(byArea).sort().map(area => {
            const list = byArea[area];
            const rows = list.map(team => {
                const rankStyle = team.rank <= 2
                    ? `color:${team.rank === 1 ? "#ffd700" : "#c0c0c0"};font-weight:bold;`
                    : "";

                return `
                    <tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:8px;text-align:center;${rankStyle}">${team.rank}</td>
                        <td style="padding:8px;font-weight:bold;color:${CONFIG.TEAM_COLORS[team.teamName] || "var(--text-main)"};">${team.teamName}</td>
                        <td style="padding:8px;text-align:center;">${team.matchWins}</td>
                        <td style="padding:8px;text-align:center;">${team.matchLosses}</td>
                        <td style="padding:8px;text-align:center;background:rgba(245,158,11,0.08);"><strong style="color:var(--accent);">${team.matchPoints}</strong></td>
                        <td style="padding:8px;text-align:center;"><span class="badge-points">${team.totalPoints}</span></td>
                        <td style="padding:8px;text-align:center;">${team.totalScored}</td>
                        <td style="padding:8px;text-align:center;">${team.totalConceded}</td>
                        <td style="padding:8px;text-align:center;">${team.diff > 0 ? "+" : ""}${team.diff}</td>
                        <td style="padding:8px;text-align:center;">${team.quotient.toFixed(3)}</td>
                    </tr>
                `;
            }).join("");

            return `
                <div style="margin-bottom:2rem;">
                    <h4 style="color:var(--accent);margin-bottom:0.8rem;border-left:3px solid var(--accent);padding-left:0.7rem;">
                        ${area} 排名
                    </h4>
                    <div style="overflow-x:auto;">
                        <table class="results-table" style="width:100%;border-collapse:collapse;">
                            <thead>
                                <tr>
                                    <th style="padding:8px;background:rgba(0,0,0,0.3);color:var(--accent);">排名</th>
                                    <th style="padding:8px;background:rgba(0,0,0,0.3);color:var(--accent);">隊伍</th>
                                    <th style="padding:8px;background:rgba(0,0,0,0.3);color:var(--accent);">勝場</th>
                                    <th style="padding:8px;background:rgba(0,0,0,0.3);color:var(--accent);">敗場</th>
                                    <th style="padding:8px;background:rgba(245,158,11,0.15);color:var(--accent);">勝負場積分</th>
                                    <th style="padding:8px;background:rgba(0,0,0,0.3);color:var(--accent);">積點</th>
                                    <th style="padding:8px;background:rgba(0,0,0,0.3);color:var(--accent);">總得分</th>
                                    <th style="padding:8px;background:rgba(0,0,0,0.3);color:var(--accent);">總失分</th>
                                    <th style="padding:8px;background:rgba(0,0,0,0.3);color:var(--accent);">分差</th>
                                    <th style="padding:8px;background:rgba(0,0,0,0.3);color:var(--accent);">商數</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join("");

        container.innerHTML = html;
    },

    renderTable(list, matches) {
        const tbody = document.getElementById("results-tbody");
        if (!tbody) return;

        tbody.innerHTML = list.map(team => `
            <tr class="${team.rank <= 3 ? `rank-${team.rank}` : ""}">
                <td><strong>${team.rank}</strong></td>
                <td>${team.teamName}</td>
                <td>${team.matchWins}</td>
                <td>${team.matchLosses}</td>
                <td style="background:rgba(245,158,11,0.08);"><strong style="color:var(--accent);">${team.matchPoints}</strong></td>
                <td><span class="badge-points">${team.totalPoints}</span></td>
                <td>${team.totalScored}</td>
                <td>${team.totalConceded}</td>
                <td>${team.diff > 0 ? "+" : ""}${team.diff}</td>
                <td>${team.quotient.toFixed(3)}</td>
            </tr>
        `).join("");

        this.toggleStandardPointsColumn(false);
        this.renderStandardDetailTable(matches || this.lastStandardMatches || []);
    },

    ensureStandardDetailContainer() {
        const anchor = document.getElementById("results-standard-table");
        if (!anchor) return null;

        let container = document.getElementById("results-standard-detail");
        if (!container) {
            container = document.createElement("div");
            container.id = "results-standard-detail";
            container.className = "card results-detail-card";
            anchor.insertAdjacentElement("afterend", container);
        }

        return container;
    },

    clearStandardDetailTable() {
        const container = document.getElementById("results-standard-detail");
        if (container) {
            container.innerHTML = "";
            container.style.display = "none";
        }
    },

    renderStandardDetailTable(matches) {
        const container = this.ensureStandardDetailContainer();
        if (!container) return;

        const payload = this.buildStandardDetailPayload(matches || []);
        if (!payload.rounds.length) {
            this.clearStandardDetailTable();
            return;
        }

        container.style.display = "";
        container.innerHTML = `
            <div class="results-detail-head">
                <div>
                    <h3 class="results-detail-title">預賽結果表</h3>
                    <p class="results-detail-subtitle">資料來源：預賽紀錄表</p>
                </div>
            </div>
            <div class="results-detail-scroll">
                <table class="results-detail-table results-detail-table-compact">
                    ${this.renderDetailColgroup()}
                    <tbody>
                        ${payload.rounds.map((round, index) => this.renderStandardDetailRound(round, index)).join("")}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderDetailColgroup() {
        return `
            <colgroup>
                <col class="col-match-order">
                <col class="col-court">
                <col class="col-mid">
                <col class="col-mid">
                <col class="col-mid-score">
                <col class="col-mid">
                <col class="col-mid">
                <col class="col-mid-score">
                <col class="col-referee">
            </colgroup>
        `;
    },

    buildStandardDetailPayload(matches) {
        const clean = (value) => String(value || "").trim();
        const areaSlots = this.getDetailAreaSlots(matches, clean);
        const roundMap = new Map();

        matches.forEach(match => {
            const roundNo = this.parseRoundNumber(match["輪次"]);
            if (!roundNo) return;

            if (!roundMap.has(roundNo)) {
                roundMap.set(roundNo, []);
            }
            roundMap.get(roundNo).push(match);
        });

        const rounds = this.standardCombos.map((combo, index) => {
            const roundMatches = roundMap.get(combo.order) || [];
            const firstMatch = roundMatches.find(Boolean) || null;

            if (!firstMatch) {
                return null;
            }

            const matchBySlot = {};
            roundMatches.forEach(match => {
                const courtKey = this.resolveCourtKey(match, clean);
                if (courtKey) {
                    matchBySlot[courtKey] = match;
                }
            });

            return {
                order: combo.order,
                comboLabel: combo.label,
                timeLabel: this.formatRoundTime(
                    roundMatches,
                    roundMap.get(this.standardCombos[index + 1]?.order) || [],
                    clean
                ),
                teamAName: clean(firstMatch["A隊名"]),
                teamBName: clean(firstMatch["B隊名"]),
                matchBySlot,
                areaSlots,
                summary: this.buildRoundSummary(
                    roundMatches,
                    clean(firstMatch["A隊名"]),
                    clean(firstMatch["B隊名"]),
                    clean
                )
            };
        }).filter(Boolean);

        return { areaSlots, rounds };
    },

    getDetailAreaSlots(matches, clean) {
        const preferred = [
            { key: "A", label: "A區" },
            { key: "B", label: "B區" },
            { key: "C", label: "C區" }
        ];
        const discovered = new Set();
        const labels = {};

        matches.forEach(match => {
            const key = this.resolveCourtKey(match, clean);
            if (!key) return;

            discovered.add(key);
            if (!labels[key]) {
                const area = clean(match["區"]);
                const court = clean(match["場地"]);
                if (area && court) labels[key] = `${court}場 ${area}`;
                else if (area) labels[key] = area;
                else if (court) labels[key] = `${court}場`;
            }
        });

        const ordered = preferred.filter(slot => discovered.has(slot.key));
        return (ordered.length ? ordered : preferred).map(slot => ({
            key: slot.key,
            label: labels[slot.key] || slot.label
        }));
    },

    renderStandardDetailRound(round, index) {
        const periodLabel = round.timeLabel
            ? `時段${index + 1}: ${round.timeLabel}`
            : `時段${index + 1}`;

        return `
            <tr class="results-detail-period-row">
                <td colspan="9" class="results-detail-period">${this.escapeHtml(periodLabel)}</td>
            </tr>
            <tr class="results-detail-head-row">
                <th rowspan="3" class="results-detail-combo-head">${this.escapeHtml(round.comboLabel)}<br>循環賽</th>
                <th rowspan="3" class="results-detail-field-head">場地</th>
                <th colspan="3" class="results-detail-team-head">${this.escapeHtml(round.teamAName)}</th>
                <th colspan="3" class="results-detail-team-head">${this.escapeHtml(round.teamBName)}</th>
                <th rowspan="3" class="results-detail-ref-head">裁判</th>
            </tr>
            <tr class="results-detail-head-row">
                ${this.renderTeamStatHeaderCells(round.summary.teamA)}
                ${this.renderTeamStatHeaderCells(round.summary.teamB)}
            </tr>
            <tr class="results-detail-head-row">
                <th colspan="2">隊員</th>
                <th>分數</th>
                <th colspan="2">隊員</th>
                <th>分數</th>
            </tr>
            ${round.areaSlots.map((slot, slotIndex) => this.renderRoundMatchRow(round, slot, slotIndex)).join("")}
            ${this.renderRoundPointsRow(round)}
        `;
    },

    renderTeamStatHeaderCells(summary) {
        return `
            <th class="results-detail-stat-head">
                <div class="results-detail-stat-label">總得分</div>
                <div class="results-detail-stat-value">${summary.totalScored}</div>
            </th>
            <th class="results-detail-stat-head">
                <div class="results-detail-stat-label">勝負差</div>
                <div class="results-detail-stat-value">${summary.diff > 0 ? "+" : ""}${summary.diff}</div>
            </th>
            <th class="results-detail-stat-head">
                <div class="results-detail-stat-label">勝負商</div>
                <div class="results-detail-stat-value">${this.formatRatio(summary.quotient)}</div>
            </th>
        `;
    },

    renderRoundMatchRow(round, slot, slotIndex) {
        const match = round.matchBySlot[slot.key] || null;
        const orderLabel = `#${((round.order - 1) * round.areaSlots.length) + slotIndex + 1}.對打${slotIndex + 1}`;
        const teamA = this.extractRoundTeamCell(match, round.teamAName);
        const teamB = this.extractRoundTeamCell(match, round.teamBName);
        const referee = match ? this.escapeHtml(String(match["裁判"] || "").trim()) : "";

        return `
            <tr class="results-detail-row">
                <td class="results-detail-match-order">${this.escapeHtml(orderLabel)}</td>
                <td class="results-detail-court">
                    <div class="results-detail-court-key">${this.escapeHtml(slot.key)}</div>
                    <div class="results-detail-court-area">${this.escapeHtml(slot.label)}</div>
                </td>
                <td class="results-detail-player">${teamA.player1}</td>
                <td class="results-detail-player">${teamA.player2}</td>
                <td class="results-detail-score${teamA.isWin ? " is-win" : ""}">${teamA.score}</td>
                <td class="results-detail-player">${teamB.player1}</td>
                <td class="results-detail-player">${teamB.player2}</td>
                <td class="results-detail-score${teamB.isWin ? " is-win" : ""}">${teamB.score}</td>
                <td class="results-detail-referee">${referee}</td>
            </tr>
        `;
    },

    renderRoundPointsRow(round) {
        return `
            <tr class="results-detail-points-row">
                <td colspan="2" class="results-detail-points-legend">
                    <span class="is-win">3~2勝:積分+2</span>
                    <span class="is-lose">0~1勝:積分+1</span>
                </td>
                <td class="results-detail-points-win">${round.summary.teamA.wins}</td>
                <td class="results-detail-points-label">積分</td>
                <td class="results-detail-points-score">${round.summary.teamA.points}</td>
                <td class="results-detail-points-win">${round.summary.teamB.wins}</td>
                <td class="results-detail-points-label">積分</td>
                <td class="results-detail-points-score">${round.summary.teamB.points}</td>
                <td class="results-detail-points-note">紅字勝場/藍字積分</td>
            </tr>
        `;
    },

    extractRoundTeamCell(match, teamName) {
        if (!match || !teamName) {
            return { player1: "", player2: "", score: "", isWin: false };
        }

        const side = this.getMatchSideForTeam(match, teamName);
        if (!side) {
            return { player1: "", player2: "", score: "", isWin: false };
        }

        const otherSide = side === "A" ? "B" : "A";
        const player1 = this.escapeHtml(String(match[`${side}隊員1`] || "").trim());
        const player2 = this.escapeHtml(String(match[`${side}隊員2`] || "").trim());
        const scoreText = String(match[`${side}隊比分`] ?? "").trim();
        const ownScore = Number(match[`${side}隊比分`] || 0);
        const rivalScore = Number(match[`${otherSide}隊比分`] || 0);

        return {
            player1,
            player2,
            score: this.escapeHtml(scoreText),
            isWin: scoreText !== "" && ownScore > rivalScore
        };
    },

    getMatchSideForTeam(match, teamName) {
        const expected = String(teamName || "").trim();
        const teamA = String(match["A隊名"] || "").trim();
        const teamB = String(match["B隊名"] || "").trim();

        if (expected && expected === teamA) return "A";
        if (expected && expected === teamB) return "B";
        return "";
    },

    buildRoundSummary(roundMatches, teamAName, teamBName, clean) {
        const teamA = { totalScored: 0, totalConceded: 0, diff: 0, quotient: 0, wins: 0, points: 0 };
        const teamB = { totalScored: 0, totalConceded: 0, diff: 0, quotient: 0, wins: 0, points: 0 };

        roundMatches.forEach(match => {
            const sideA = this.getMatchSideForTeam(match, teamAName);
            const sideB = this.getMatchSideForTeam(match, teamBName);
            if (!sideA || !sideB) return;

            const teamAScore = Number(match[`${sideA}隊比分`] || 0);
            const teamBScore = Number(match[`${sideB}隊比分`] || 0);

            teamA.totalScored += teamAScore;
            teamA.totalConceded += teamBScore;
            teamB.totalScored += teamBScore;
            teamB.totalConceded += teamAScore;

            if (teamAScore > teamBScore) teamA.wins++;
            if (teamBScore > teamAScore) teamB.wins++;
        });

        teamA.diff = teamA.totalScored - teamA.totalConceded;
        teamB.diff = teamB.totalScored - teamB.totalConceded;
        teamA.quotient = teamA.totalConceded === 0 ? (teamA.totalScored > 0 ? 999 : 0) : (teamA.totalScored / teamA.totalConceded);
        teamB.quotient = teamB.totalConceded === 0 ? (teamB.totalScored > 0 ? 999 : 0) : (teamB.totalScored / teamB.totalConceded);

        const bonus = this.calculateRoundBonus(roundMatches, clean);
        teamA.points = bonus.teamA;
        teamB.points = bonus.teamB;

        return { teamA, teamB };
    },

    calculateRoundBonus(roundMatches, clean) {
        const firstMatch = roundMatches.find(Boolean);
        if (!firstMatch) {
            return { teamA: 0, teamB: 0 };
        }

        const teamAName = clean(firstMatch["A隊名"]);
        const teamBName = clean(firstMatch["B隊名"]);
        let winsA = 0;
        let winsB = 0;

        roundMatches.forEach(match => {
            const matchTeamA = clean(match["A隊名"]);
            const matchTeamB = clean(match["B隊名"]);
            const scoreA = Number(match["A隊比分"] || 0);
            const scoreB = Number(match["B隊比分"] || 0);

            if (scoreA > scoreB) {
                if (matchTeamA === teamAName) winsA++;
                if (matchTeamA === teamBName) winsB++;
            } else if (scoreB > scoreA) {
                if (matchTeamB === teamAName) winsA++;
                if (matchTeamB === teamBName) winsB++;
            }
        });

        if (winsA > winsB) {
            return { teamA: 2, teamB: 1 };
        }

        if (winsB > winsA) {
            return { teamA: 1, teamB: 2 };
        }

        return { teamA: 0, teamB: 0 };
    },

    formatRatio(value) {
        if (!Number.isFinite(value)) return "";
        if (value === 999) return "999";
        return value.toFixed(6).replace(/\.?0+$/, "");
    },

    parseRoundNumber(value) {
        const match = String(value || "").match(/\d+/);
        return match ? Number(match[0]) : 0;
    },

    formatRoundTime(currentMatches, nextMatches, clean) {
        const start = this.pickRoundTime(currentMatches, clean);
        const nextStart = this.pickRoundTime(nextMatches, clean);
        return this.formatTimeRange(start, nextStart);
    },

    pickRoundTime(matches, clean) {
        const raw = (matches || [])
            .map(match => clean(match["比賽時間"]))
            .find(Boolean);
        return raw || "";
    },

    formatTimeRange(start, nextStart) {
        const begin = this.normalizeTime(start);
        if (!begin) return "";

        const end = this.normalizeTime(nextStart) || this.addMinutes(begin, 15);
        return `${begin}-${end}`;
    },

    normalizeTime(value) {
        const raw = String(value || "").trim();
        if (!raw) return "";

        if (raw.includes("T") || raw.includes(" ")) {
            const parts = raw.split(/[ T]/);
            const timePart = parts.find(part => /^\d{1,2}:\d{2}/.test(part));
            return timePart ? timePart.slice(0, 5) : raw.slice(0, 5);
        }

        return raw.slice(0, 5);
    },

    addMinutes(time, amount) {
        const [hours, minutes] = String(time || "00:00").split(":").map(Number);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return "";

        const total = (hours * 60) + minutes + amount;
        const nextHours = Math.floor(total / 60);
        const nextMinutes = total % 60;
        return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
    },

    resolveCourtKey(match, clean) {
        const courtValue = clean(match["場地"] || match["球場"]);
        const upper = courtValue.toUpperCase();

        if (upper.includes("A") || upper === "1") return "A";
        if (upper.includes("B") || upper === "2") return "B";
        if (upper.includes("C") || upper === "3") return "C";

        const area = clean(match["區"]);
        if (area.includes("青")) return "A";
        if (area.includes("藍")) return "B";
        if (area.includes("黑") || area.includes("粉")) return "C";
        return "";
    },

    escapeHtml(text) {
        return String(text ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    },

    renderTableFallback(byArea) {
        const tbody = document.getElementById("results-tbody");
        if (!tbody) return;

        let html = "";
        Object.entries(byArea).forEach(([area, list]) => {
            html += `<tr><td colspan="10" style="background:rgba(0,0,0,0.4);color:var(--accent);font-weight:bold;padding:6px 10px;">${area}</td></tr>`;
            list.forEach(team => {
                html += `
                    <tr>
                        <td><strong>${team.rank}</strong></td>
                        <td>${team.teamName}</td>
                        <td>${team.matchWins}</td>
                        <td>${team.matchLosses}</td>
                        <td>${team.matchPoints}</td>
                        <td>${team.totalPoints}</td>
                        <td>${team.totalScored}</td>
                        <td>${team.totalConceded}</td>
                        <td>${team.diff > 0 ? "+" : ""}${team.diff}</td>
                        <td>${team.quotient.toFixed(3)}</td>
                    </tr>
                `;
            });
        });
        tbody.innerHTML = html;
    },

    startLotteryDraw() {
        const modal = document.getElementById("draw-seed-modal");
        const slotC = document.getElementById("slot-c");
        const slotB = document.getElementById("slot-b");
        const resultArea = document.getElementById("draw-result-area");

        if (!modal || !this.lastLotteryData) return;

        slotC.innerHTML = "抽籤中...";
        slotC.style.color = "var(--text-dim)";
        slotB.innerHTML = "抽籤中...";
        slotB.style.color = "var(--text-dim)";
        resultArea.style.display = "none";
        modal.style.display = "block";

        const firstPlaces = [];
        const thirdPlaces = [];

        Object.values(this.lastLotteryData).forEach(list => {
            const first = list.find(team => team.rank === 1);
            const third = list.find(team => team.rank === 3);
            if (first) firstPlaces.push(first.teamName);
            if (third) thirdPlaces.push(third.teamName);
        });

        if (firstPlaces.length < 3 || thirdPlaces.length < 3) {
            alert("排名資料不足，無法進行抽籤。");
            modal.style.display = "none";
            return;
        }

        let count = 0;
        const maxTicks = 20;
        const interval = setInterval(() => {
            count++;
            slotC.innerHTML = `${firstPlaces[Math.floor(Math.random() * firstPlaces.length)]} / ${firstPlaces[Math.floor(Math.random() * firstPlaces.length)]}`;
            slotB.innerHTML = `${thirdPlaces[Math.floor(Math.random() * thirdPlaces.length)]} / ${thirdPlaces[Math.floor(Math.random() * thirdPlaces.length)]}`;

            if (count >= maxTicks) {
                clearInterval(interval);
                this.finalizeDraw(firstPlaces, thirdPlaces);
            }
        }, 100);
    },

    finalizeDraw(firstPlaces, thirdPlaces) {
        const shuffle = array => [...array].sort(() => 0.5 - Math.random());
        const seedsC = shuffle(firstPlaces).slice(0, 2);
        const seedsB = shuffle(thirdPlaces).slice(0, 2);

        this.selectedSeedsC = seedsC;
        this.selectedSeedsB = seedsB;

        const slotC = document.getElementById("slot-c");
        const slotB = document.getElementById("slot-b");
        const resultArea = document.getElementById("draw-result-area");

        slotC.innerHTML = `${seedsC[0]} / ${seedsC[1]}`;
        slotC.style.color = "var(--danger)";
        slotB.innerHTML = `${seedsB[0]} / ${seedsB[1]}`;
        slotB.style.color = "var(--primary)";
        resultArea.style.display = "block";
    },

    async generateLotteryKnockout() {
        const btnConfirm = document.getElementById("btn-confirm-knockout");
        if (!this.lastLotteryData || !this.selectedSeedsC || !this.selectedSeedsB) {
            alert("缺少抽籤結果，無法產生複賽。");
            return;
        }

        if (!confirm("要依照目前抽出的種子隊伍產生複賽賽程嗎？")) return;

        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 產生中...';

        try {
            const payload = {
                ranksByArea: this.lastLotteryData,
                seedsC: this.selectedSeedsC,
                seedsB: this.selectedSeedsB
            };

            const res = await API.generateLotteryKnockout(payload);
            if (res && res.status === "success") {
                alert("複賽賽程已產生。");
                document.getElementById("draw-seed-modal").style.display = "none";
            } else {
                alert("產生失敗: " + ((res && res.message) || "未知錯誤"));
            }
        } catch (error) {
            alert("API 呼叫失敗: " + error.message);
        } finally {
            btnConfirm.disabled = false;
            btnConfirm.innerHTML = '<i class="fas fa-table"></i> 產生複賽賽程';
        }
    }
};

if (!document.getElementById("results-detail-style")) {
    const style = document.createElement("style");
    style.id = "results-detail-style";
    style.textContent = `
        .results-detail-card {
            margin-top: 1.5rem;
            padding: 1.25rem;
        }

        .results-detail-head {
            margin-bottom: 0.9rem;
        }

        .results-detail-title {
            margin: 0;
            color: var(--primary);
            font-size: 1.15rem;
        }

        .results-detail-subtitle {
            margin: 0.35rem 0 0;
            color: var(--text-dim);
            font-size: 0.9rem;
        }

        .results-detail-period {
            color: #4338ca;
            font-size: 0.98rem;
            font-weight: 700;
        }

        .results-detail-scroll {
            overflow-x: hidden;
        }

        .results-detail-table {
            width: 100%;
            min-width: 0;
            border-collapse: collapse;
            table-layout: fixed;
            background: #ffffff;
            color: #111827;
        }

        .results-detail-table-compact .col-match-order { width: 12%; }
        .results-detail-table-compact .col-court { width: 13%; }
        .results-detail-table-compact .col-mid { width: 9.5%; }
        .results-detail-table-compact .col-mid-score { width: 7%; }
        .results-detail-table-compact .col-referee { width: 11%; }

        .results-detail-table th,
        .results-detail-table td {
            border: 1px solid #1f2937;
            padding: 0.34rem 0.24rem;
            text-align: center;
            vertical-align: middle;
            font-size: 0.9rem;
        }

        .results-detail-table th {
            background: #e5e7eb;
            color: #111827;
            font-weight: 700;
        }

        .results-detail-period-row td {
            border: none;
            background: #ffffff;
            padding: 0.55rem 0 0.3rem;
            text-align: left;
        }

        .results-detail-head-row th {
            background: #e5e7eb;
        }

        .results-detail-combo-head {
            line-height: 1.35;
            font-size: 0.96rem;
        }

        .results-detail-field-head {
            font-size: 0.96rem;
        }

        .results-detail-team-head {
            font-size: 1rem;
        }

        .results-detail-ref-head,
        .results-detail-field-head {
            padding-left: 0.4rem;
            padding-right: 0.4rem;
        }

        .results-detail-stat-head {
            background: #f3f4f6;
            padding: 0.24rem 0.18rem;
        }

        .results-detail-stat-label {
            color: #374151;
            font-size: 0.76rem;
            line-height: 1.1;
        }

        .results-detail-stat-value {
            margin-top: 0.12rem;
            font-weight: 700;
            color: #111827;
            font-size: 0.94rem;
        }

        .results-detail-row td {
            background: #e8f1fb;
        }

        .results-detail-match-order {
            font-weight: 700;
            background: #ffffff;
            font-size: 0.9rem;
        }

        .results-detail-court {
            background: #ffffff;
            padding-left: 0.45rem;
            padding-right: 0.45rem;
        }

        .results-detail-court-key {
            font-weight: 700;
            font-size: 0.95rem;
        }

        .results-detail-court-area {
            margin-top: 0.1rem;
            font-size: 0.8rem;
            color: #374151;
        }

        .results-detail-player {
            background: #e8f1fb;
            font-size: 0.94rem;
            letter-spacing: 0.01em;
        }

        .results-detail-score {
            color: #1d4ed8;
            font-weight: 700;
            font-size: 1.12rem;
        }

        .results-detail-score.is-win {
            color: #1d4ed8;
        }

        .results-detail-referee {
            background: #ffffff;
            font-size: 0.92rem;
            padding-left: 0.45rem;
            padding-right: 0.45rem;
        }

        .results-detail-points-row td {
            background: #fff2cc;
        }

        .results-detail-points-legend {
            text-align: left;
            font-size: 0.78rem;
            line-height: 1.3;
            background: #ffffff !important;
        }

        .results-detail-points-legend span {
            display: flex;
            align-items: center;
            gap: 0.2rem;
        }

        .results-detail-points-legend .is-win {
            color: #dc2626;
            font-weight: 700;
        }

        .results-detail-points-legend .is-lose {
            color: #2563eb;
            font-weight: 700;
        }

        .results-detail-points-win {
            color: #dc2626;
            font-size: 1.45rem;
            font-weight: 800;
        }

        .results-detail-points-label {
            color: #1d4ed8;
            font-size: 1.45rem;
            font-weight: 800;
        }

        .results-detail-points-score {
            color: #1d4ed8;
            font-size: 1.45rem;
            font-weight: 800;
        }

        .results-detail-points-note {
            background: #ffffff !important;
            color: #1d4ed8;
            font-size: 0.76rem;
            line-height: 1.2;
            white-space: nowrap;
        }

        @media (max-width: 720px) {
            .results-detail-card {
                padding: 1rem;
            }

            .results-detail-table th,
            .results-detail-table td {
                font-size: 0.78rem;
                padding: 0.28rem 0.18rem;
            }

            .results-detail-score {
                font-size: 0.98rem;
            }
        }
    `;
    document.head.appendChild(style);
}

window.Results = Results;
document.addEventListener("tabChanged", event => {
    if (event.detail.tabId === "results") {
        Results.load();
        initLotteryUI();
    }
});

function initLotteryUI() {
    const btnDraw = document.getElementById("btn-draw-lottery");
    if (btnDraw) {
        btnDraw.onclick = () => {
            if (!Results.lastLotteryData) {
                alert("請先產生預賽結果。");
                Results.load();
                return;
            }
            Results.startLotteryDraw();
        };
    }

    const btnConfirm = document.getElementById("btn-confirm-knockout");
    if (btnConfirm) {
        btnConfirm.onclick = () => Results.generateLotteryKnockout();
    }

    window.onclick = function(event) {
        const modal = document.getElementById("draw-seed-modal");
        if (event.target === modal) {
            modal.style.display = "none";
        }
    };
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLotteryUI);
} else {
    initLotteryUI();
}

window.manualInitLottery = initLotteryUI;







