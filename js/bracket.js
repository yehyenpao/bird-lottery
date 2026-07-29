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
        const getMatch = (roundNo, courtKey) => {
            return (matches || []).find(m => {
                const r = String(m["輪次"] || "").replace(/\D/g, "");
                const c = String(m["場地"] || "").toUpperCase().trim();
                return r === String(roundNo) && c === courtKey;
            });
        };

        const roundsDef = [
            { roundNo: 1, time: "13:20-13:35", desc: "循環賽1<br><small style='color:#38bdf8;'>3分列隊<br>12分鐘比賽</small>", team: "鳥蛋", seqB: "序號1", seqC: "序號2", teamsB: "藍鳥 VS 青鳥", teamsC: "黑鳥 VS 粉鳥" },
            { roundNo: 2, time: "13:35-13:47", desc: "循環賽2<br><small style='color:#38bdf8;'>12分鐘比賽</small>", team: "小鳥", seqB: "序號3", seqC: "序號4", teamsB: "藍鳥 VS 青鳥", teamsC: "黑鳥 VS 粉鳥" },
            { roundNo: 3, time: "13:47-13:59", desc: "循環賽3<br><small style='color:#38bdf8;'>12分鐘比賽</small>", team: "猛禽", seqB: "序號5", seqC: "序號6", teamsB: "藍鳥 VS 青鳥", teamsC: "黑鳥 VS 粉鳥" },
            { roundNo: 4, time: "13:59-14:14", desc: "循環賽4<br><small style='color:#38bdf8;'>3分列隊<br>12分鐘比賽</small>", team: "鳥蛋", seqB: "序號7", seqC: "序號8", teamsB: "藍鳥 VS 黑鳥", teamsC: "青鳥 VS 粉鳥" },
            { roundNo: 5, time: "14:14-14:26", desc: "循環賽5<br><small style='color:#38bdf8;'>12分鐘比賽</small>", team: "小鳥", seqB: "序號9", seqC: "序號10", teamsB: "藍鳥 VS 黑鳥", teamsC: "青鳥 VS 粉鳥" },
            { roundNo: 6, time: "14:26-14:38", desc: "循環賽6<br><small style='color:#38bdf8;'>12分鐘比賽</small>", team: "猛禽", seqB: "序號11", seqC: "序號12", teamsB: "藍鳥 VS 黑鳥", teamsC: "青鳥 VS 粉鳥" },
            { roundNo: 7, time: "14:38-14:53", desc: "循環賽7<br><small style='color:#38bdf8;'>3分列隊<br>12分鐘比賽</small>", team: "鳥蛋", seqB: "序號13", seqC: "序號14", teamsB: "藍鳥 VS 粉鳥", teamsC: "青鳥 VS 黑鳥" },
            { roundNo: 8, time: "14:53-15:05", desc: "循環賽8<br><small style='color:#38bdf8;'>12分鐘比賽</small>", team: "小鳥", seqB: "序號15", seqC: "序號16", teamsB: "藍鳥 VS 粉鳥", teamsC: "青鳥 VS 黑鳥" },
            { roundNo: 9, time: "15:05-15:17", desc: "循環賽9<br><small style='color:#38bdf8;'>12分鐘比賽</small>", team: "猛禽", seqB: "序號17", seqC: "序號18", teamsB: "藍鳥 VS 粉鳥", teamsC: "青鳥 VS 黑鳥" }
        ];

        return `
            <div class="record-board-wrap">
                <div class="record-board-head">
                    <h3 class="record-board-title">預賽紀錄表</h3>
                    <p class="record-board-subtitle">全場時間流程對照與對戰紀錄表（與大會賽程表格式一致）。</p>
                </div>
                <div class="record-board-scroll">
                    <table class="rr-record-table timetable-grid" style="width:100%; border-collapse:collapse; text-align:center;">
                        <thead>
                            <tr style="background: rgba(30, 41, 59, 0.9); color: var(--accent);">
                                <th style="width:12%; padding:10px; border:1px solid var(--border);">時間</th>
                                <th style="width:18%; padding:10px; border:1px solid var(--border);">行程</th>
                                <th style="width:10%; padding:10px; border:1px solid var(--border);">隊伍</th>
                                <th style="width:20%; padding:10px; border:1px solid var(--border);">場A</th>
                                <th style="width:20%; padding:10px; border:1px solid var(--border);">場B</th>
                                <th style="width:20%; padding:10px; border:1px solid var(--border);">場C</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- 13:00-13:10 自由練習 -->
                            <tr style="border-bottom:1px solid var(--border);">
                                <td style="padding:10px; border:1px solid var(--border);">13:00-13:10</td>
                                <td style="padding:10px; border:1px solid var(--border);">自由練習</td>
                                <td style="padding:10px; border:1px solid var(--border); color:var(--text-dim);">先來先用</td>
                                <td colspan="3" style="padding:10px; border:1px solid var(--border); background:rgba(255,255,255,0.02);">
                                    <b>自由使用</b><br>
                                    <small style="color:var(--text-dim);">抽籤分隊伍、主審協助完成各場名單登錄</small>
                                </td>
                            </tr>

                            <!-- 13:10-13:20 賽前拍照 -->
                            <tr style="border-bottom:1px solid var(--border);">
                                <td style="padding:10px; border:1px solid var(--border);">13:10-13:20</td>
                                <td style="padding:10px; border:1px solid var(--border);">
                                    賽前拍照<br><small style="color:#ef4444; font-weight:bold;">10分鐘拍照</small>
                                </td>
                                <td style="padding:10px; border:1px solid var(--border); color:var(--text-dim);">拍照小物</td>
                                <td colspan="3" style="padding:10px; border:1px solid var(--border); background:rgba(255,255,255,0.02);">
                                    <b>賽前大合照，順便點名未到者，隊友協助聯繫</b><br>
                                    <small style="color:var(--text-dim);">團體賽3點順序出賽，取得2點隊伍獲勝 (3點都要比完)</small>
                                </td>
                            </tr>

                            <!-- 循環賽 1~9 -->
                            ${roundsDef.map((r, idx) => `
                                <tr style="border-bottom:1px solid var(--border); background:${idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.15)'}">
                                    <td style="padding:8px; border:1px solid var(--border);">${r.time}</td>
                                    <td style="padding:8px; border:1px solid var(--border);">${r.desc}</td>
                                    <td style="padding:8px; border:1px solid var(--border); font-weight:bold; color:var(--primary);">${r.team}</td>
                                    ${idx === 0 ? `
                                        <td rowspan="9" style="padding:12px; border:1px solid var(--border); vertical-align:middle; background:rgba(251,191,36,0.08); color:#fbbf24; font-weight:bold;">
                                            自由使用，建議下一輪對戰的可以先簡單熱身 3~5 分鐘
                                        </td>
                                    ` : ''}
                                    <td style="padding:8px; border:1px solid var(--border);">${this.renderCourtCell(getMatch(r.roundNo, "B"), r.seqB, r.teamsB)}</td>
                                    <td style="padding:8px; border:1px solid var(--border);">${this.renderCourtCell(getMatch(r.roundNo, "C"), r.seqC, r.teamsC)}</td>
                                </tr>
                            `).join("")}

                            <!-- 15:17-15:20 排名結果 -->
                            <tr style="border-bottom:1px solid var(--border);">
                                <td style="padding:10px; border:1px solid var(--border);">15:17-15:20</td>
                                <td style="padding:10px; border:1px solid var(--border); font-weight:bold;">排名結果</td>
                                <td style="padding:10px; border:1px solid var(--border); color:var(--text-dim);">NA</td>
                                <td rowspan="6" style="padding:12px; border:1px solid var(--border); vertical-align:middle; background:rgba(239,68,68,0.12); color:#f87171; font-weight:bold;">
                                    15:00開始，取消A場，不可使用
                                </td>
                                <td colspan="2" style="padding:10px; border:1px solid var(--border); background:rgba(255,255,255,0.02); font-weight:bold; color:var(--accent);">
                                    循環賽成績公布 / 複賽 (羽球接力賽)
                                </td>
                            </tr>

                            <!-- 15:20-15:25 複賽分隊 -->
                            <tr style="border-bottom:1px solid var(--border);">
                                <td style="padding:8px; border:1px solid var(--border);">15:20-15:25</td>
                                <td style="padding:8px; border:1px solid var(--border);">複賽<br><small style="color:#38bdf8;">5分鐘分隊</small></td>
                                <td style="padding:8px; border:1px solid var(--border); color:var(--text-dim);">NA</td>
                                <td style="padding:8px; border:1px solid var(--border); font-size:0.85rem; color:var(--text-dim);">循環排名3 VS 循環排名2</td>
                                <td style="padding:8px; border:1px solid var(--border); font-size:0.85rem; color:var(--text-dim);">循環排名4 VS 循環排名1</td>
                            </tr>

                            <!-- 15:25-16:05 複賽對戰 -->
                            <tr style="border-bottom:1px solid var(--border); background:rgba(0,0,0,0.15);">
                                <td style="padding:8px; border:1px solid var(--border);">15:25-16:05</td>
                                <td style="padding:8px; border:1px solid var(--border); font-weight:bold;">複賽<br><small style="color:#38bdf8;">40分鐘比賽</small></td>
                                <td style="padding:8px; border:1px solid var(--border); color:var(--text-dim);">NA</td>
                                <td style="padding:8px; border:1px solid var(--border);">${this.renderChasingCell(chasingMatches, "準決賽1", "序號19", "循環排名3 VS 循環排名2")}</td>
                                <td style="padding:8px; border:1px solid var(--border);">${this.renderChasingCell(chasingMatches, "準決賽2", "序號20", "循環排名4 VS 循環排名1")}</td>
                            </tr>

                            <!-- 16:05-16:10 最終排名賽分隊 -->
                            <tr style="border-bottom:1px solid var(--border);">
                                <td style="padding:8px; border:1px solid var(--border);">16:05-16:10</td>
                                <td style="padding:8px; border:1px solid var(--border);">最終排名賽<br><small style="color:#38bdf8;">5分鐘分隊</small></td>
                                <td style="padding:8px; border:1px solid var(--border); color:var(--text-dim);">NA</td>
                                <td style="padding:8px; border:1px solid var(--border); font-size:0.85rem; color:var(--text-dim);">季軍戰(序號21)</td>
                                <td style="padding:8px; border:1px solid var(--border); font-size:0.85rem; color:var(--text-dim);">冠亞軍戰(序號22)</td>
                            </tr>

                            <!-- 16:10-16:50 最終排名賽對戰 -->
                            <tr style="border-bottom:1px solid var(--border); background:rgba(0,0,0,0.15);">
                                <td style="padding:8px; border:1px solid var(--border);">16:10-16:50</td>
                                <td style="padding:8px; border:1px solid var(--border); font-weight:bold;">最終排名賽<br><small style="color:#38bdf8;">40分鐘比賽</small></td>
                                <td style="padding:8px; border:1px solid var(--border); color:var(--text-dim);">NA</td>
                                <td style="padding:8px; border:1px solid var(--border);">${this.renderChasingCell(chasingMatches, "季軍戰", "季軍戰(序號21)", "複賽敗隊 VS 複賽敗隊")}</td>
                                <td style="padding:8px; border:1px solid var(--border);">${this.renderChasingCell(chasingMatches, "冠軍賽", "冠亞軍戰(序號22)", "複賽勝隊 VS 複賽勝隊")}</td>
                            </tr>

                            <!-- 16:50-17:00 頒獎 -->
                            <tr style="border-bottom:1px solid var(--border);">
                                <td style="padding:10px; border:1px solid var(--border);">16:50-17:00</td>
                                <td style="padding:10px; border:1px solid var(--border); font-weight:bold;">頒獎</td>
                                <td style="padding:10px; border:1px solid var(--border); color:var(--text-dim);">NA</td>
                                <td colspan="2" style="padding:10px; border:1px solid var(--border); background:rgba(255,255,255,0.02); font-weight:bold; color:var(--accent);">
                                    公布最後排名 & 各隊伍拍照
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderCourtCell(match, defaultLabel, defaultTeams) {
        if (!match) {
            return `
                <div style="text-align:center; padding:0.2rem;">
                    <div style="font-size:0.75rem; color:var(--primary); font-weight:bold;">${this.escapeHtml(defaultLabel)}</div>
                    <div style="font-size:0.85rem; color:white; margin-top:2px;">${this.escapeHtml(defaultTeams)}</div>
                </div>
            `;
        }

        const seq = match["序號"] ? `序號${match["序號"]}` : defaultLabel;
        const teamA = match["A隊名"] || "";
        const teamB = match["B隊名"] || "";
        const scoreA = match["A隊比分"] ?? "";
        const scoreB = match["B隊比分"] ?? "";
        const status = match["比賽狀態"] || "待賽";
        const isDone = status === "已完賽";

        let scoreHtml = "";
        if (isDone || (scoreA !== "" && scoreB !== "" && (Number(scoreA) > 0 || Number(scoreB) > 0))) {
            const numA = Number(scoreA) || 0;
            const numB = Number(scoreB) || 0;
            const colorA = numA > numB ? "#4ade80" : (numB > numA ? "#f87171" : "white");
            const colorB = numB > numA ? "#4ade80" : (numA > numB ? "#f87171" : "white");
            scoreHtml = `<div style="font-weight:bold; font-size:0.95rem; margin-top:2px;"><span style="color:${colorA}">${numA}</span> : <span style="color:${colorB}">${numB}</span></div>`;
        }

        return `
            <div style="text-align:center; padding:0.2rem;">
                <div style="font-size:0.75rem; color:var(--accent); font-weight:bold;">${this.escapeHtml(seq)}</div>
                <div style="font-weight:bold; color:white; font-size:0.85rem; margin-top:2px;">
                    ${this.escapeHtml(teamA)} <span style="color:var(--text-dim); font-size:0.75rem;">VS</span> ${this.escapeHtml(teamB)}
                </div>
                ${scoreHtml}
            </div>
        `;
    },

    renderChasingCell(chasingMatches, matchKey, defaultLabel, defaultTeams) {
        const clean = (v) => String(v || "").trim();
        const match = (chasingMatches || []).find(m => {
            const area = clean(m["區"]);
            const id = clean(m.id || m["序號"]);
            return area.includes(matchKey) || id === matchKey || id === defaultLabel;
        });

        if (!match) {
            return `
                <div style="text-align:center; padding:0.2rem;">
                    <div style="font-size:0.75rem; color:var(--accent); font-weight:bold;">${this.escapeHtml(defaultLabel)}</div>
                    <div style="font-size:0.8rem; color:var(--text-dim); margin-top:2px;">${this.escapeHtml(defaultTeams)}</div>
                </div>
            `;
        }

        const teamA = match["A隊名"] || "";
        const teamB = match["B隊名"] || "";
        const scoreA = match["A隊比分"] ?? "";
        const scoreB = match["B隊比分"] ?? "";
        const isDone = String(match["比賽狀態"]).includes("已完賽");

        let scoreHtml = "";
        if (isDone || (scoreA !== "" && scoreB !== "" && (Number(scoreA) > 0 || Number(scoreB) > 0))) {
            scoreHtml = `<div style="font-weight:bold; font-size:0.95rem; color:#fbbf24; margin-top:2px;">${scoreA} : ${scoreB}</div>`;
        }

        return `
            <div style="text-align:center; padding:0.2rem;">
                <div style="font-size:0.75rem; color:var(--primary); font-weight:bold;">${this.escapeHtml(defaultLabel)}</div>
                <div style="font-size:0.85rem; color:white; margin-top:2px;">
                    ${this.escapeHtml(teamA || "待定")} <span style="color:var(--text-dim); font-size:0.75rem;">VS</span> ${this.escapeHtml(teamB || "待定")}
                </div>
                ${scoreHtml}
            </div>
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
