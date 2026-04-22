const Bracket = {
    teamSlots: [
        { key: "blue", defaultName: "藍鳥隊", fallbackShort: "藍鳥", className: "team-blue" },
        { key: "cyan", defaultName: "青鳥隊", fallbackShort: "青鳥", className: "team-cyan" },
        { key: "black", defaultName: "黑鳥隊", fallbackShort: "黑鳥", className: "team-black" },
        { key: "pink", defaultName: "粉鳥隊", fallbackShort: "粉鳥", className: "team-pink" }
    ],

    combinations: [
        { order: 1, label: "組合1", className: "combo-1", teams: ["blue", "cyan"], color: "#e600ff" },
        { order: 2, label: "組合2", className: "combo-2", teams: ["black", "pink"], color: "#ff4b4b" },
        { order: 3, label: "組合3", className: "combo-3", teams: ["blue", "black"], color: "#ffb000" },
        { order: 4, label: "組合4", className: "combo-4", teams: ["cyan", "pink"], color: "#8fd96b" },
        { order: 5, label: "組合5", className: "combo-5", teams: ["blue", "pink"], color: "#1f39ff" },
        { order: 6, label: "組合6", className: "combo-6", teams: ["black", "cyan"], color: "#ff7b39" }
    ],

    async load() {
        const [scheduleRes, registrationRes, chasingRes] = await Promise.all([
            API.getSchedule(),
            API.getRegistrations(),
            API.getChasingSchedule()
        ]);

        const scheduleData = scheduleRes && scheduleRes.status === "success"
            ? (scheduleRes.data || [])
            : [];
        const registrationData = registrationRes && registrationRes.status === "success"
            ? (registrationRes.data || [])
            : [];
        const chasingData = chasingRes && chasingRes.status === "success"
            ? (chasingRes.data || [])
            : [];

        this.render(scheduleData, registrationData, chasingData);
    },

    render(scheduleData, registrationData, chasingData) {
        const container = document.getElementById("bracket-container");
        const matches = Array.isArray(scheduleData) ? scheduleData : [];
        const registrations = Array.isArray(registrationData) ? registrationData : [];
        const chasingMatches = Array.isArray(chasingData) ? chasingData : [];
        const teams = this.buildTeams(matches, registrations);

        const notice = matches.length === 0 && registrations.length === 0
            ? `<div class="card bracket-empty-notice">目前還沒有賽程或報名資料，先顯示固定籤表版型。</div>`
            : "";

        container.innerHTML = `
            ${notice}
            <div class="card bracket-single-card">
                <div class="bracket-area-head">
                    <h3 class="bracket-area-title">循環籤表</h3>
                </div>
                <div class="bracket-board-shell">
                    ${this.renderBoard(teams)}
                </div>
            </div>
            <div class="card bracket-record-card">
                ${this.renderRecordTable(matches, chasingMatches, teams)}
            </div>
        `;
    },

    renderBoard(teams) {
        return `
            <div class="rr-board">
                <svg class="rr-board-lines" viewBox="0 0 820 430" aria-hidden="true">
                    <line class="rr-line rr-line-1" x1="205" y1="38" x2="615" y2="38"></line>
                    <line class="rr-line rr-line-2" x1="205" y1="357" x2="615" y2="357"></line>
                    <line class="rr-line rr-line-3" x1="120" y1="58" x2="120" y2="337"></line>
                    <line class="rr-line rr-line-4" x1="700" y1="58" x2="700" y2="337"></line>
                    <line class="rr-line rr-line-5" x1="205" y1="45" x2="615" y2="344"></line>
                    <line class="rr-line rr-line-6" x1="205" y1="344" x2="615" y2="45"></line>
                </svg>

                ${teams.map(team => this.renderTeam(team)).join("")}

                ${this.combinations.map(combo => `
                    <div class="rr-combo-label ${combo.className}">${combo.label}</div>
                `).join("")}
            </div>
        `;
    },

    renderTeam(team) {
        return `
            <div class="rr-team ${team.className}">
                <div class="rr-team-box">${this.escapeHtml(team.shortName)}</div>
                <div class="rr-team-members">
                    ${team.members.length > 0
                        ? team.members.map(member => `<span>${this.escapeHtml(member)}</span>`).join("")
                        : `<span>待定</span>`}
                </div>
            </div>
        `;
    },

    renderRecordTable(matches, chasingMatches, teams) {
        const areaSlots = this.getRecordAreaSlots(matches);
        const roundRows = this.buildRecordRounds(matches, teams, areaSlots);
        const chasingStages = this.buildChasingStages(chasingMatches);

        return `
            <div class="record-board-wrap">
                <div class="record-board-head">
                    <h3 class="record-board-title">預賽紀錄表</h3>
                    <p class="record-board-subtitle">下方會自動帶入預賽紀錄表與複賽資料；若尚未產生資料則先留空。</p>
                </div>
                <div class="record-board-scroll">
                    <table class="rr-record-table">
                        <thead>
                            <tr>
                                <th rowspan="2">時間</th>
                                <th rowspan="2">行程</th>
                                <th rowspan="2">隊伍</th>
                                ${areaSlots.map(slot => `<th colspan="2">${this.escapeHtml(slot.label)}</th>`).join("")}
                            </tr>
                            <tr>
                                ${areaSlots.map(() => `<th>選手 1</th><th>選手 2</th>`).join("")}
                            </tr>
                        </thead>
                        <tbody>
                            ${roundRows.map((round, index) => this.renderRecordRound(round, index)).join("")}
                            ${this.renderChasingStageRows(chasingStages, areaSlots.length)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    getRecordAreaSlots(matches) {
        const defaults = [
            { key: "A", label: "場A-猛禽區" },
            { key: "B", label: "場B-小鳥區" },
            { key: "C", label: "場C-孵蛋區" }
        ];

        const labelsByCourt = {};
        matches.forEach(match => {
            const court = this.resolveCourtKey(match);
            if (!court || labelsByCourt[court]) return;

            const area = String(match["區"] || "").trim();
            if (!area) return;
            labelsByCourt[court] = `場${court}-${area}`;
        });

        return defaults.map(slot => ({
            ...slot,
            label: labelsByCourt[slot.key] || slot.label
        }));
    },

    buildRecordRounds(matches, teams, areaSlots) {
        const roundMap = new Map();
        matches.forEach(match => {
            const roundNo = this.parseRoundNumber(match["輪次"]);
            if (!roundNo) return;

            if (!roundMap.has(roundNo)) {
                roundMap.set(roundNo, []);
            }
            roundMap.get(roundNo).push(match);
        });

        const teamLookup = Object.fromEntries(teams.map(team => [team.key, team]));
        const uniqueRoundNos = [...roundMap.keys()].sort((a, b) => a - b);
        const roundTimes = {};

        uniqueRoundNos.forEach((roundNo, index) => {
            const currentMatches = roundMap.get(roundNo) || [];
            const start = this.pickRoundTime(currentMatches);
            const nextRound = uniqueRoundNos[index + 1];
            const nextStart = nextRound ? this.pickRoundTime(roundMap.get(nextRound) || []) : "";
            roundTimes[roundNo] = this.formatTimeRange(start, nextStart);
        });

        return this.combinations.map(combo => {
            const roundMatches = roundMap.get(combo.order) || [];
            const matchByCourt = {};
            roundMatches.forEach(match => {
                const court = this.resolveCourtKey(match);
                if (court) matchByCourt[court] = match;
            });

            const teamA = teamLookup[combo.teams[0]];
            const teamB = teamLookup[combo.teams[1]];

            return {
                roundNo: combo.order,
                timeLabel: roundTimes[combo.order] || "",
                tripLabel: combo.label,
                teamAName: teamA ? teamA.teamName : "",
                teamBName: teamB ? teamB.teamName : "",
                matches: Object.fromEntries(areaSlots.map(slot => [slot.key, matchByCourt[slot.key] || null]))
            };
        });
    },

    renderRecordRound(round, index) {
        const rowClass = index % 2 === 0 ? "is-blue" : "is-green";
        const slotKeys = Object.keys(round.matches);

        let winsA = 0;
        let winsB = 0;
        slotKeys.forEach(key => {
            const m = round.matches[key];
            if (m) {
                const sA = Number(m["A隊比分"]) || 0;
                const sB = Number(m["B隊比分"]) || 0;
                if (sA > sB) winsA++;
                else if (sB > sA) winsB++;
            }
        });

        let teamABonus = "";
        let teamBBonus = "";
        if (winsA > winsB) {
            teamABonus = `<span class="combo-bonus win-bonus">+2</span>`;
            teamBBonus = `<span class="combo-bonus lose-bonus">+1</span>`;
        } else if (winsB > winsA) {
            teamABonus = `<span class="combo-bonus lose-bonus">+1</span>`;
            teamBBonus = `<span class="combo-bonus win-bonus">+2</span>`;
        }

        return `
            <tr class="rr-record-row-group ${rowClass}">
                <td rowspan="5" class="rr-record-time">${this.escapeHtml(round.timeLabel || "")}</td>
                <td rowspan="5" class="rr-record-trip">${this.escapeHtml(round.tripLabel)}</td>
                <td class="rr-record-team-name">${teamABonus}${this.escapeHtml(round.teamAName)}</td>
                ${slotKeys.map(key => this.renderPlayerCells(round.matches[key], "A")).join("")}
            </tr>
            <tr class="rr-record-row-group ${rowClass}">
                <td class="rr-record-label score">分數</td>
                ${slotKeys.map(key => this.renderScoreCells(round.matches[key], "A")).join("")}
            </tr>
            <tr class="rr-record-row-group ${rowClass}">
                <td class="rr-record-team-name">${teamBBonus}${this.escapeHtml(round.teamBName)}</td>
                ${slotKeys.map(key => this.renderPlayerCells(round.matches[key], "B")).join("")}
            </tr>
            <tr class="rr-record-row-group ${rowClass}">
                <td class="rr-record-label score">分數</td>
                ${slotKeys.map(key => this.renderScoreCells(round.matches[key], "B")).join("")}
            </tr>
            <tr class="rr-record-row-group ${rowClass}">
                <td class="rr-record-label">裁判</td>
                ${slotKeys.map(key => this.renderResultCells(round.matches[key])).join("")}
            </tr>
        `;
    },

    renderPlayerCells(match, side) {
        const members = match
            ? [match[`${side}隊員1`], match[`${side}隊員2`]].map(value => String(value || "").trim())
            : ["", ""];

        return members.map(member => `<td class="rr-record-member">${this.escapeHtml(member)}</td>`).join("");
    },

    renderScoreCells(match, side) {
        const score = match ? String(match[`${side}隊比分`] ?? "").trim() : "";
        let winClass = "";
        if (match) {
            const sA = Number(match["A隊比分"]) || 0;
            const sB = Number(match["B隊比分"]) || 0;
            if (side === "A" && sA > sB) winClass = " cell-win";
            if (side === "B" && sB > sA) winClass = " cell-win";
        }
        return `
            <td class="rr-record-score-label">分數</td>
            <td class="rr-record-score-value${winClass}">${this.escapeHtml(score)}</td>
        `;
    },

    renderResultCells(match) {
        if (!match) {
            return `<td colspan="2" class="rr-record-result"></td>`;
        }

        const referee = String(match["裁判"] || "").trim();
        return `<td colspan="2" class="rr-record-result">${this.escapeHtml(referee)}</td>`;
    },

    buildChasingStages(chasingMatches) {
        const allMatches = Array.isArray(chasingMatches) ? chasingMatches : [];
        const semiFinals = allMatches.filter(match => String(match["區"] || "").includes("準決賽"));
        const finals = allMatches
            .filter(match => {
                const area = String(match["區"] || "");
                return area.includes("冠軍賽") || area.includes("季軍賽") || area.includes("季殿軍");
            })
            .sort((a, b) => {
                const areaA = String(a["區"] || "");
                const areaB = String(b["區"] || "");
                const rank = area => {
                    if (area.includes("季")) return 0;
                    if (area.includes("冠")) return 1;
                    return 2;
                };
                return rank(areaA) - rank(areaB);
            });

        return [
            {
                timeLabel: this.formatStageTime(semiFinals),
                tripLabel: "複賽",
                stageLabel: "準決賽",
                matches: semiFinals
            },
            {
                timeLabel: this.formatStageTime(finals),
                tripLabel: "複賽",
                stageLabel: "季冠軍賽",
                matches: finals
            }
        ];
    },

    renderChasingStageRows(stageRows, slotCount) {
        return stageRows.map(stage => `
            <tr class="rr-stage-row">
                <td class="rr-record-time">${this.escapeHtml(stage.timeLabel)}</td>
                <td class="rr-record-trip">${this.escapeHtml(stage.tripLabel)}</td>
                <td class="rr-stage-label">${this.escapeHtml(stage.stageLabel)}</td>
                ${Array.from({ length: slotCount }, (_, index) => this.renderStageMatchCell(stage.matches[index])).join("")}
            </tr>
        `).join("");
    },

    renderStageMatchCell(match) {
        if (!match) {
            return `<td colspan="2" class="rr-stage-match"></td>`;
        }

        const area = String(match["區"] || "").trim();
        const teamA = String(match["A隊名"] || "").trim();
        const teamB = String(match["B隊名"] || "").trim();
        const scoreA = String(match["A隊比分"] ?? "").trim();
        const scoreB = String(match["B隊比分"] ?? "").trim();
        const hasScore = scoreA !== "" || scoreB !== "";

        return `
            <td colspan="2" class="rr-stage-match">
                <div class="rr-stage-area">${this.escapeHtml(area)}</div>
                <div class="rr-stage-vs">${this.escapeHtml(teamA)} vs ${this.escapeHtml(teamB)}</div>
                <div class="rr-stage-score">${hasScore ? `${this.escapeHtml(scoreA)} : ${this.escapeHtml(scoreB)}` : ""}</div>
            </td>
        `;
    },

    parseRoundNumber(roundValue) {
        const match = String(roundValue || "").match(/\d+/);
        return match ? Number(match[0]) : 0;
    },

    pickRoundTime(matches) {
        const raw = matches
            .map(match => String(match["比賽時間"] || "").trim())
            .find(Boolean);
        return raw || "";
    },

    formatTimeRange(start, nextStart) {
        const normalizedStart = this.normalizeTime(start);
        if (!normalizedStart) return "";

        const normalizedEnd = this.normalizeTime(nextStart) || this.addMinutes(normalizedStart, 15);
        return `${normalizedStart}-${normalizedEnd}`;
    },

    formatStageTime(matches) {
        const first = (matches || []).find(Boolean);
        if (!first) return "";

        const start = this.normalizeTime(first["比賽時間"]);
        if (!start) return "";
        return `${start}-${this.addMinutes(start, 15)}`;
    },

    normalizeTime(value) {
        const raw = String(value || "").trim();
        if (!raw) return "";

        if (raw.includes("T") || raw.includes(" ")) {
            const split = raw.split(/[ T]/)[1];
            return split ? split.slice(0, 5) : raw.slice(0, 5);
        }

        return raw.slice(0, 5);
    },

    addMinutes(time, minutesToAdd) {
        const [hour, minute] = String(time || "00:00").split(":").map(Number);
        if (Number.isNaN(hour) || Number.isNaN(minute)) return "";

        const total = hour * 60 + minute + minutesToAdd;
        const nextHour = Math.floor(total / 60);
        const nextMinute = total % 60;
        return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
    },

    resolveCourtKey(match) {
        const courtRaw = String(match["場地"] || match["球場"] || "").trim().toUpperCase();
        if (courtRaw.includes("A")) return "A";
        if (courtRaw.includes("B")) return "B";
        if (courtRaw.includes("C")) return "C";

        const area = String(match["區"] || "").trim();
        if (area.includes("猛禽")) return "A";
        if (area.includes("小鳥")) return "B";
        if (area.includes("鳥蛋") || area.includes("孵蛋") || area.includes("狐狸") || area.includes("醬板鴨")) return "C";
        return "";
    },

    buildTeams(matches, registrations) {
        const discoveredTeams = [...new Set(
            [
                ...matches.flatMap(match => [match["A隊名"], match["B隊名"]]),
                ...registrations.map(item => item["隊名"])
            ]
                .map(name => String(name || "").trim())
                .filter(Boolean)
        )];

        const assignedNames = this.assignTeamNames(discoveredTeams);
        const membersByTeam = {};

        registrations.forEach(item => {
            this.collectMembers(membersByTeam, item["隊名"], [item["姓名"]]);
        });

        matches.forEach(match => {
            this.collectMembers(membersByTeam, match["A隊名"], [match["A隊員1"], match["A隊員2"]]);
            this.collectMembers(membersByTeam, match["B隊名"], [match["B隊員1"], match["B隊員2"]]);
        });

        return this.teamSlots.map(slot => {
            const teamName = assignedNames[slot.key] || slot.defaultName;
            const members = [...new Set((membersByTeam[teamName] || []).filter(Boolean))];

            return {
                ...slot,
                teamName,
                shortName: this.getShortTeamName(teamName, slot.fallbackShort),
                members
            };
        });
    },

    assignTeamNames(teamNames) {
        const remaining = [...teamNames];
        const mapping = {};
        const rules = [
            { key: "blue", keyword: "藍" },
            { key: "cyan", keyword: "青" },
            { key: "black", keyword: "黑" },
            { key: "pink", keyword: "粉" }
        ];

        rules.forEach(rule => {
            const index = remaining.findIndex(name => name.includes(rule.keyword));
            if (index !== -1) {
                mapping[rule.key] = remaining.splice(index, 1)[0];
            }
        });

        this.teamSlots.forEach(slot => {
            if (!mapping[slot.key] && remaining.length > 0) {
                mapping[slot.key] = remaining.shift();
            }
        });

        return mapping;
    },

    collectMembers(store, teamName, members) {
        const normalizedTeam = String(teamName || "").trim();
        if (!normalizedTeam) return;

        if (!store[normalizedTeam]) {
            store[normalizedTeam] = [];
        }

        members
            .map(member => String(member || "").trim())
            .filter(member => member && member !== "待定")
            .forEach(member => {
                if (!store[normalizedTeam].includes(member)) {
                    store[normalizedTeam].push(member);
                }
            });
    },

    getShortTeamName(teamName, fallback) {
        const name = String(teamName || "").trim();
        if (!name) return fallback;
        return name.replace(/隊$/, "");
    },

    normalizeArea(area) {
        return String(area || "").replace(/\s+/g, "").trim();
    },

    escapeHtml(text) {
        return String(text ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
};

if (!document.getElementById("round-robin-bracket-style")) {
    const style = document.createElement("style");
    style.id = "round-robin-bracket-style";
    style.textContent = `
        .bracket-empty-notice {
            margin-bottom: 1.25rem;
            color: var(--text-dim);
            text-align: center;
        }

        .bracket-single-card {
            padding: 1.5rem;
        }

        .bracket-record-card {
            margin-top: 1.5rem;
            padding: 1.25rem;
        }

        .bracket-area-head {
            margin-bottom: 1.2rem;
            text-align: center;
        }

        .bracket-area-title {
            margin: 0;
            color: var(--primary);
            font-size: 1.3rem;
        }

        .bracket-board-shell {
            overflow-x: auto;
            padding-bottom: 0.4rem;
        }

        .rr-board {
            position: relative;
            width: 820px;
            min-width: 820px;
            height: 430px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #d7d7d7;
            border-radius: 18px;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
        }

        .rr-board-lines {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }

        .rr-line {
            fill: none;
            stroke-width: 2.4;
            stroke-linecap: round;
        }

        .rr-line-1 { stroke: #e600ff; }
        .rr-line-2 { stroke: #ff4b4b; }
        .rr-line-3 { stroke: #ffb000; }
        .rr-line-4 { stroke: #8fd96b; }
        .rr-line-5 { stroke: #1f39ff; }
        .rr-line-6 { stroke: #ff7b39; }

        .rr-team {
            position: absolute;
            width: 220px;
            color: #111111;
        }

        .rr-team.team-blue { left: 28px; top: 12px; }
        .rr-team.team-cyan { right: 28px; top: 12px; text-align: right; }
        .rr-team.team-black { left: 28px; bottom: 12px; }
        .rr-team.team-pink { right: 28px; bottom: 12px; text-align: right; }

        .rr-team-box {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 188px;
            min-height: 46px;
            padding: 0 20px;
            border: 5px solid #161616;
            background: #ffffff;
            font-size: 1.15rem;
            font-weight: 700;
            line-height: 1;
        }

        .rr-team-members {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem 0.7rem;
            margin-top: 0.85rem;
            max-width: 220px;
            font-size: 0.95rem;
            color: #374151;
            line-height: 1.35;
        }

        .rr-team.team-cyan .rr-team-members,
        .rr-team.team-pink .rr-team-members {
            justify-content: flex-end;
        }

        .rr-combo-label {
            position: absolute;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 104px;
            height: 52px;
            padding: 0 14px;
            background: #ffffff;
            font-size: 1.05rem;
            line-height: 1;
            font-weight: 700;
            border: 2px solid currentColor;
        }

        .rr-combo-label.combo-1 { top: 12px; left: 357px; color: #e600ff; }
        .rr-combo-label.combo-2 { bottom: 12px; left: 357px; color: #ff4b4b; }
        .rr-combo-label.combo-3 { top: 150px; left: 62px; color: #ffb000; }
        .rr-combo-label.combo-4 { top: 150px; right: 62px; color: #8fd96b; }
        .rr-combo-label.combo-5 { top: 110px; left: 286px; color: #1f39ff; }
        .rr-combo-label.combo-6 { top: 82px; right: 220px; color: #ff7b39; }

        .record-board-wrap {
            width: 100%;
        }

        .record-board-head {
            margin-bottom: 0.9rem;
        }

        .record-board-title {
            margin: 0;
            color: var(--primary);
            font-size: 1.15rem;
        }

        .record-board-subtitle {
            margin: 0.35rem 0 0;
            color: var(--text-dim);
            font-size: 0.9rem;
        }

        .record-board-scroll {
            overflow-x: auto;
        }

        .rr-record-table {
            width: 100%;
            min-width: 980px;
            border-collapse: collapse;
            table-layout: fixed;
            background: #f6f8fb;
            color: #1f2937;
        }

        .rr-record-table th,
        .rr-record-table td {
            border: 1px solid #49586b;
            padding: 0.42rem 0.45rem;
            text-align: center;
            vertical-align: middle;
            font-size: 0.86rem;
        }

        .rr-record-table thead th {
            background: #d8dee7;
            color: #111827;
            font-weight: 700;
        }

        .rr-record-time,
        .rr-record-trip,
        .rr-stage-label {
            font-weight: 700;
            color: #1f3a5f;
        }

        .rr-record-row-group.is-blue td {
            background: #dbe7f4;
        }

        .rr-record-row-group.is-green td {
            background: #e5f0db;
        }

        .rr-record-team-name {
            font-weight: 700;
            color: #223047;
            white-space: nowrap;
            position: relative;
        }

        .combo-bonus {
            position: absolute;
            left: -40px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 1.5rem;
            font-weight: 900;
            color: #ef4444; 
            z-index: 5;
        }

        .rr-record-label {
            font-weight: 700;
            color: #374151;
            white-space: nowrap;
        }

        .rr-record-score-label {
            color: #1d4ed8;
            font-weight: 700;
        }

        .rr-record-score-value {
            color: #1d4ed8;
            font-weight: 700;
            position: relative;
        }

        .cell-win::before {
            content: "勝";
            position: absolute;
            bottom: 50%;
            left: 50%;
            transform: translate(-50%, 40%) rotate(-15deg);
            font-size: 3.5rem;
            color: rgba(239, 68, 68, 0.4);
            font-weight: 900;
            pointer-events: none;
            z-index: 10;
        }

        .rr-record-member {
            min-height: 2rem;
        }

        .rr-record-result {
            font-weight: 700;
            color: #374151;
            min-height: 2rem;
        }

        .rr-stage-row td {
            background: #eef2f7;
        }

        .rr-stage-match {
            padding: 0.55rem 0.45rem;
            min-height: 3.8rem;
        }

        .rr-stage-area {
            font-size: 0.78rem;
            color: #4b5563;
            margin-bottom: 0.2rem;
        }

        .rr-stage-vs {
            font-weight: 700;
            color: #1f2937;
        }

        .rr-stage-score {
            margin-top: 0.18rem;
            color: #1d4ed8;
            font-weight: 700;
        }

        @media (max-width: 720px) {
            .bracket-single-card {
                padding: 1rem;
            }

            .bracket-record-card {
                padding: 1rem;
            }
        }
    `;
    document.head.appendChild(style);
}
