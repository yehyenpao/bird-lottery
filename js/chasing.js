const Chasing = {
    isBroadcastMode: false,
    standardLineupMode: "trio",
    rankings: [],
    registrations: [],
    matches: [],
    lineups: {
        match1: [],
        match2: []
    },

    read(item, keys, fallback = "") {
        if (!item || typeof item !== "object") return fallback;
        for (const key of keys) {
            const value = item[key];
            if (value !== undefined && value !== null && String(value).trim() !== "") {
                return value;
            }
        }
        return fallback;
    },

    cleanText(value) {
        return String(value || "").trim();
    },

    normalizeTeamName(value) {
        return this.cleanText(value).replace(/\s*\(.*\)\s*/g, "").trim();
    },

    escapeAttr(value) {
        return this.cleanText(value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    },

    getRankingTeamName(item) {
        return this.normalizeTeamName(this.read(item, ["name", "隊名", "team"]));
    },

    getRegistrationTeamName(item) {
        return this.normalizeTeamName(this.read(item, ["隊名", "team"]));
    },

    getRegistrationPlayerName(item) {
        return this.cleanText(this.read(item, ["姓名", "name"]));
    },

    getMatchPlayers(match, side) {
        return [
            match[`${side}隊員1`],
            match[`${side}隊員2`],
            match[`${side}隊員3`]
        ].filter(name => name && name !== "待定");
    },

    getPlayersByTeam(teamName) {
        const target = this.normalizeTeamName(teamName);
        const names = this.registrations
            .filter(item => this.getRegistrationTeamName(item) === target)
            .map(item => this.getRegistrationPlayerName(item))
            .filter(Boolean);
        return [...new Set(names)];
    },

    ensureLineup(matchId, rowsFactory = null) {
        if (!Array.isArray(this.lineups[matchId]) || this.lineups[matchId].length === 0) {
            const rows = rowsFactory ? rowsFactory() : this.getDefaultRelayRows();
            this.lineups[matchId] = JSON.parse(JSON.stringify(rows));
        }
    },

    getDefaultRelayRows() {
        return [11, 22, 33, 44, 55, 66].map(score => (
            this.createEmptyLineupRow(`${score}分接力`)
        ));
    },

    toggleBroadcastMode(checked) {
        this.isBroadcastMode = checked;

        const otherToggle = document.getElementById("broadcast-mode-v-toggle");
        if (otherToggle) otherToggle.checked = checked;

        if (typeof Viewer !== "undefined") {
            Viewer.isBroadcastMode = checked;
        }

        this.load(true);
    },

    async load(silent = false) {
        const chasingRes = await API.getChasingSchedule();
        if (chasingRes && chasingRes.status === "success") {
            this.renderTable(chasingRes.data || []);
        } else {
            this.renderTable([]);
        }

        if (silent) return;

        const rankRes = await API.getRankings();
        const regRes = await API.getRegistrations();
        const editor = document.getElementById("chasing-lineup-editor");

        if (rankRes && rankRes.status === "success" && regRes && regRes.status === "success") {
            this.rankings = rankRes.data || [];
            this.registrations = regRes.data || [];

            if (this.rankings.length >= 4) {
                this.ensureLineup("match1", () => this.getDefaultStandardRows());
                this.ensureLineup("match2", () => this.getDefaultStandardRows());
                this.renderLineupEditor();
            } else if (editor) {
                editor.innerHTML = `
                    <div class="card" style="text-align:center; color:var(--text-dim); padding:2rem;">
                        <i class="fas fa-exclamation-triangle"></i> 預賽排名資料不足，至少需要 4 隊才能設定追分出場順序。
                    </div>
                `;
            }
        } else if (editor) {
            editor.innerHTML = `
                <div class="card" style="text-align:center; color:var(--text-dim); padding:2rem;">
                    <i class="fas fa-exclamation-triangle"></i> 無法載入排名或報名資料，請稍後再試。
                </div>
            `;
        }

        const btnGen = document.getElementById("btn-generate-chasing");
        if (btnGen) btnGen.onclick = () => this.generateSemiFinals();

        const btnToggle = document.getElementById("toggle-chasing-editor");
        if (btnToggle) {
            btnToggle.onclick = () => {
                const wrapper = document.getElementById("chasing-editor-wrapper");
                const icon = document.getElementById("chasing-editor-icon");
                if (!wrapper || !icon) return;

                if (wrapper.style.display === "none") {
                    wrapper.style.display = "block";
                    icon.classList.replace("fa-plus", "fa-minus");
                } else {
                    wrapper.style.display = "none";
                    icon.classList.replace("fa-minus", "fa-plus");
                }
            };
        }
    },

    initDefaultLineups() {
        const defaults = this.getDefaultStandardRows();
        this.lineups.match1 = JSON.parse(JSON.stringify(defaults));
        this.lineups.match2 = JSON.parse(JSON.stringify(defaults));
    },

    createEmptyLineupRow(targetScore = "分接力") {
        return {
            targetScore,
            A1: "",
            A2: "",
            A3: "",
            B1: "",
            B2: "",
            B3: ""
        };
    },

    getDefaultStandardRows() {
        if (this.standardLineupMode === "trio") {
            return [
                this.createEmptyLineupRow("第一組3劍客搶25分"),
                this.createEmptyLineupRow("第二組3劍客搶25分"),
                this.createEmptyLineupRow("第三組3劍客(1:1平)搶10分")
            ];
        }

        return this.getDefaultRelayRows();
    },

    updateStandardLineupMode(mode) {
        this.standardLineupMode = mode === "trio" ? "trio" : "doubles";
        this.initDefaultLineups();
        this.renderLineupEditor();
    },

    renderLineupEditor() {
        const container = document.getElementById("chasing-lineup-editor");
        if (!container) return;

        const isLottery = this.rankings.length > 4;

        if (!isLottery) {
            const rankedTeams = this.rankings
                .slice(0, 4)
                .map(item => this.getRankingTeamName(item))
                .filter(Boolean);

            if (rankedTeams.length < 4) {
                container.innerHTML = `
                    <div class="card" style="text-align:center; color:var(--text-dim); padding:2rem;">
                        <i class="fas fa-exclamation-triangle"></i> 排名資料不足，暫時無法建立追分賽程。
                    </div>
                `;
                return;
            }

            const match1 = {
                teamA: rankedTeams[0],
                teamB: rankedTeams[3],
                court: "C",
                area: "準決賽(1v4)",
                id: "match1"
            };
            const match2 = {
                teamA: rankedTeams[1],
                teamB: rankedTeams[2],
                court: "B",
                area: "準決賽(2v3)",
                id: "match2"
            };

            this.ensureLineup("match1", () => this.getDefaultStandardRows());
            this.ensureLineup("match2", () => this.getDefaultStandardRows());

            container.innerHTML = `
                <div class="card" style="margin-bottom:1rem; padding:1rem 1.2rem;">
                    <div style="display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap;">
                        <label for="standard-lineup-mode" style="color:var(--primary); font-weight:700; white-space:nowrap;">手動設定出場順序模式</label>
                        <select id="standard-lineup-mode" style="min-width:220px; padding:0.65rem 0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:white; border-radius:8px;">
                            <option value="trio" ${this.standardLineupMode === "trio" ? "selected" : ""}>1. 團體3劍客</option>
                            <option value="doubles" ${this.standardLineupMode === "doubles" ? "selected" : ""}>2. 雙打追分賽</option>
                        </select>
                        <span style="color:var(--text-dim); font-size:0.85rem;">切換後會重建本區預設棒次。</span>
                    </div>
                </div>
                ${this.buildMatchEditor(match1)}
                ${this.buildMatchEditor(match2)}
            `;

            const modeSelect = document.getElementById("standard-lineup-mode");
            if (modeSelect) {
                modeSelect.onchange = event => this.updateStandardLineupMode(event.target.value);
            }
            return;
        }

        const raptorRank = this.rankings.slice(0, 6);
        const birdRank = this.rankings.slice(6, 12);

        container.innerHTML = `
            <div class="lottery-bracket-header" style="grid-column:1/-1; text-align:center; padding:1.5rem; background:rgba(255,107,53,0.1); border-radius:12px; margin-bottom:1rem; border:1px solid rgba(255,107,53,0.2);">
                <h2 style="color:#ff6b35; margin:0;"><i class="fas fa-crown"></i> 追分/淘汰賽：猛禽區（6 隊）</h2>
                <p style="margin:0.5rem 0 0 0; font-size:0.9rem; opacity:0.8;">排名 1、2 名直接晉級準決賽，其餘 4 隊先進行資格賽。</p>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(400px, 1fr)); gap:2rem;">
                ${this.build6TeamBracket("猛禽", raptorRank)}
            </div>

            <div class="lottery-bracket-header" style="grid-column:1/-1; text-align:center; padding:1.5rem; background:rgba(78,205,196,0.1); border-radius:12px; margin:3rem 0 1rem 0; border:1px solid rgba(78,205,196,0.2);">
                <h2 style="color:#4ecdc4; margin:0;"><i class="fas fa-seedling"></i> 追分/淘汰賽：小鳥區（6 隊）</h2>
                <p style="margin:0.5rem 0 0 0; font-size:0.9rem; opacity:0.8;">排名 1、2 名直接晉級準決賽，其餘 4 隊先進行資格賽。</p>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(400px, 1fr)); gap:2rem;">
                ${this.build6TeamBracket("小鳥", birdRank)}
            </div>
        `;
    },

    build6TeamBracket(zone, ranks) {
        const rankedTeams = ranks
            .map(item => this.getRankingTeamName(item))
            .filter(Boolean);

        if (rankedTeams.length < 6) {
            return `<div class="card" style="padding:1.5rem; text-align:center; color:var(--text-dim);">此區排名資料不足，無法建立淘汰賽。</div>`;
        }

        const matches = [
            { id: `${zone}-Q1`, area: `${zone}區-資格賽1`, teamA: rankedTeams[2], teamB: rankedTeams[5], court: "A" },
            { id: `${zone}-Q2`, area: `${zone}區-資格賽2`, teamA: rankedTeams[3], teamB: rankedTeams[4], court: "B" },
            { id: `${zone}-S1`, area: `${zone}區-準決賽1`, teamA: rankedTeams[0], teamB: "資格賽1勝者", court: "C" },
            { id: `${zone}-S2`, area: `${zone}區-準決賽2`, teamA: rankedTeams[1], teamB: "資格賽2勝者", court: "A" },
            { id: `${zone}-Final`, area: `${zone}區-冠軍賽`, teamA: "準決賽1勝者", teamB: "準決賽2勝者", court: "B" },
            { id: `${zone}-3rd`, area: `${zone}區-季軍賽`, teamA: "準決賽1敗者", teamB: "準決賽2敗者", court: "C" },
            { id: `${zone}-5th`, area: `${zone}區-5/6名賽`, teamA: "資格賽1敗者", teamB: "資格賽2敗者", court: "A" }
        ];

        return matches.map(match => {
            this.ensureLineup(match.id, () => this.getDefaultRelayRows());
            return this.buildMatchEditor(match);
        }).join("");
    },

    buildMatchEditor(match) {
        const playersA = this.getPlayersByTeam(match.teamA);
        const playersB = this.getPlayersByTeam(match.teamB);

        const rows = (this.lineups[match.id] || []).map((row, idx) => `
            <tr>
                <td><input type="text" class="score-input" value="${this.escapeAttr(row.targetScore)}" onchange="Chasing.updateRow('${match.id}', ${idx}, 'targetScore', this.value)"></td>
                <td>${this.buildPlayerSelect(playersA, row.A1, match.id, idx, "A1")}</td>
                <td>${this.buildPlayerSelect(playersA, row.A2, match.id, idx, "A2")}</td>
                <td>${this.buildPlayerSelect(playersA, row.A3, match.id, idx, "A3")}</td>
                <td style="color:var(--primary); font-weight:bold;">VS</td>
                <td>${this.buildPlayerSelect(playersB, row.B1, match.id, idx, "B1")}</td>
                <td>${this.buildPlayerSelect(playersB, row.B2, match.id, idx, "B2")}</td>
                <td>${this.buildPlayerSelect(playersB, row.B3, match.id, idx, "B3")}</td>
            </tr>
        `).join("");

        return `
            <div
                class="match-setup-card animate-fadeIn"
                style="margin-bottom:1rem;"
                data-match-id="${this.escapeAttr(match.id)}"
                data-area="${this.escapeAttr(match.area)}"
                data-court="${this.escapeAttr(match.court)}"
                data-team-a="${this.escapeAttr(match.teamA)}"
                data-team-b="${this.escapeAttr(match.teamB)}"
            >
                <h4 style="color:var(--accent); margin-bottom:1rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.5rem;">
                    <i class="fas fa-sitemap"></i> ${match.area}: ${match.teamA} vs ${match.teamB} (${match.court}場)
                </h4>
                <div class="table-container">
                    <table class="lineup-table" style="font-size:0.85rem;">
                        <thead>
                            <tr>
                                <th>棒次</th>
                                <th>A員1</th>
                                <th>A員2</th>
                                <th>A員3</th>
                                <th></th>
                                <th>B員1</th>
                                <th>B員2</th>
                                <th>B員3</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div class="lineup-actions" style="margin-top:1rem; display:flex; justify-content:center; gap:0.5rem;">
                    <button class="btn btn-sm" onclick="Chasing.addRound('${match.id}')" style="font-size:0.7rem;"><i class="fas fa-plus"></i></button>
                    <button class="btn btn-sm" onclick="Chasing.removeRound('${match.id}')" style="font-size:0.7rem;"><i class="fas fa-minus"></i></button>
                </div>
            </div>
        `;
    },

    buildPlayerSelect(players, current, matchId, idx, field) {
        let options = `<option value="">--</option>`;
        players.forEach(name => {
            options += `<option value="${this.escapeAttr(name)}" ${name === current ? "selected" : ""}>${name}</option>`;
        });

        return `<select class="row-select"
                    style="width:100%; border:1px solid rgba(255,255,255,0.1); background:#1e293b; color:white; border-radius:4px; padding:2px;"
                    onchange="Chasing.updateRow('${matchId}', ${idx}, '${field}', this.value)">
                    ${options}
                </select>`;
    },

    updateRow(matchId, idx, field, value) {
        if (!this.lineups[matchId] || !this.lineups[matchId][idx]) return;
        this.lineups[matchId][idx][field] = value;
    },

    addRound(matchId) {
        this.ensureLineup(matchId);
        const isStandardMatch = matchId === "match1" || matchId === "match2";
        const defaultLabel = isStandardMatch && this.standardLineupMode === "trio"
            ? "加開3劍客"
            : "分接力";
        this.lineups[matchId].push(this.createEmptyLineupRow(defaultLabel));
        this.renderLineupEditor();
    },

    removeRound(matchId) {
        if (this.lineups[matchId] && this.lineups[matchId].length > 1) {
            this.lineups[matchId].pop();
            this.renderLineupEditor();
        }
    },

    async generateSemiFinals() {
        const payload = [];
        const cards = document.querySelectorAll(".match-setup-card");

        cards.forEach(card => {
            const area = this.cleanText(card.dataset.area);
            const court = this.cleanText(card.dataset.court);
            const teamA = this.normalizeTeamName(card.dataset.teamA);
            const teamB = this.normalizeTeamName(card.dataset.teamB);
            const selects = card.querySelectorAll("select");
            const inputs = card.querySelectorAll(".score-input");

            for (let i = 0; i < inputs.length; i += 1) {
                const targetScore = this.cleanText(inputs[i].value);
                const a1 = selects[i * 6]?.value || "";
                const a2 = selects[i * 6 + 1]?.value || "";
                const a3 = selects[i * 6 + 2]?.value || "";
                const b1 = selects[i * 6 + 3]?.value || "";
                const b2 = selects[i * 6 + 4]?.value || "";
                const b3 = selects[i * 6 + 5]?.value || "";

                if (a1 || a2 || a3 || b1 || b2 || b3) {
                    payload.push({
                        area,
                        court,
                        teamA,
                        teamB,
                        targetScore,
                        A1: a1,
                        A2: a2,
                        A3: a3,
                        B1: b1,
                        B2: b2,
                        B3: b3
                    });
                }
            }
        });

        if (payload.length === 0) {
            alert("請先填入至少一列出場順序。");
            return;
        }

        if (!confirm(`要產生 ${payload.length} 筆追分/淘汰賽賽程嗎？`)) return;

        const btn = document.getElementById("btn-generate-chasing");
        const originalText = btn ? btn.innerHTML : "";
        if (btn) {
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 產生中...`;
            btn.disabled = true;
        }

        try {
            const res = await API.generateChasingSchedule(payload);
            if (res && res.status === "success") {
                alert("賽程已成功產生。");
                this.load();
            }
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    },

    renderTable(data) {
        const container = document.getElementById("chasing-schedule-container");
        if (!container) return;

        const sortedData = [...(data || [])].sort((a, b) => {
            const seqA = parseInt(this.read(a, ["序號", "順序", "seq"], 0), 10) || 0;
            const seqB = parseInt(this.read(b, ["序號", "順序", "seq"], 0), 10) || 0;
            return seqA - seqB;
        });
        this.matches = sortedData;

        if (sortedData.length === 0) {
            container.classList.remove("broadcast-grid");
            container.innerHTML = `<div class="card" style="text-align:center; color:var(--text-dim); padding:2rem;">目前尚未產生追分/淘汰賽賽程</div>`;
            return;
        }

        if (this.isBroadcastMode) {
            container.classList.add("broadcast-grid");

            const groups = {};
            sortedData.forEach(match => {
                const key = `${this.read(match, ["場地"], "-")}-${this.read(match, ["區"], "-")}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(match);
            });

            let broadcastHtml = "";
            Object.keys(groups).forEach(key => {
                const matches = groups[key].sort((a, b) => {
                    const seqA = parseInt(this.read(a, ["序號"], 0), 10) || 0;
                    const seqB = parseInt(this.read(b, ["序號"], 0), 10) || 0;
                    return seqA - seqB;
                });

                const first = matches[0];
                const last = matches[matches.length - 1];
                const status = this.cleanText(this.read(last, ["比賽狀態"], "未開賽"));
                const isLive = status.includes("比賽中");
                const isDone = status.includes("已完賽");
                const statusHtml = isDone
                    ? `<span class="status-badge status-done">已完賽</span>`
                    : isLive
                        ? `<span class="status-badge status-live">LIVE</span>`
                        : `<span class="status-badge status-pending">${status}</span>`;
                const scoreA = this.read(last, ["A隊比分"], 0);
                const scoreB = this.read(last, ["B隊比分"], 0);
                const area = this.cleanText(this.read(first, ["區"], ""));
                const areaColor = area.includes("猛禽")
                    ? "var(--raptor)"
                    : area.includes("小鳥")
                        ? "var(--birdie)"
                        : "var(--accent)";

                let legInfoHtml = "";
                let prevA = 0;
                let prevB = 0;
                const isRelay = matches.length > 1 || matches.some(match => {
                    const round = this.cleanText(this.read(match, ["輪次"], ""));
                    return ["接力", "追分", "3劍客"].some(text => round.includes(text));
                });

                matches.forEach(match => {
                    const matchStatus = this.cleanText(this.read(match, ["比賽狀態"], "未開賽"));
                    const rowClass = matchStatus.includes("比賽中")
                        ? "leg-card live"
                        : matchStatus.includes("已完賽")
                            ? "leg-card done"
                            : "leg-card";

                    const currA = parseInt(this.read(match, ["A隊比分"], 0), 10) || 0;
                    const currB = parseInt(this.read(match, ["B隊比分"], 0), 10) || 0;
                    const diffA = currA - prevA;
                    const diffB = currB - prevB;

                    legInfoHtml += `
                        <div class="${rowClass}">
                            <div class="leg-round">${this.read(match, ["輪次"], "-")}</div>
                            <div class="leg-players">
                                <div class="p-side">${this.getMatchPlayers(match, "A").join("/")}</div>
                                <div class="p-vs">vs</div>
                                <div class="p-side">${this.getMatchPlayers(match, "B").join("/")}</div>
                            </div>
                            <div class="leg-score">
                                <span class="s-val ${diffA > diffB ? "win" : ""}">${diffA >= 0 ? `+${diffA}` : diffA}</span>
                                <span class="s-sep">:</span>
                                <span class="s-val ${diffB > diffA ? "win" : ""}">${diffB >= 0 ? `+${diffB}` : diffB}</span>
                            </div>
                        </div>
                    `;

                    prevA = currA;
                    prevB = currB;
                });

                broadcastHtml += `
                    <div class="broadcast-card animate-fadeIn" style="border-left-color:${areaColor};">
                        <div class="card-top-bar">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <span class="badge-pill gray" style="font-size:0.8rem; padding:2px 10px;">序號 ${this.read(first, ["序號"], "-")}</span>
                                <span style="color:${areaColor}; font-weight:900; font-size:1.1rem; letter-spacing:1px;">${area}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <span style="color:var(--text-dim); font-size:0.9rem;"><i class="fas fa-desktop"></i> ${this.read(first, ["場地"], "-")} 場</span>
                                ${statusHtml}
                            </div>
                        </div>

                        <div class="broadcast-score-row">
                            <div class="team-block">
                                <div class="broadcast-team-name">${this.read(first, ["A隊名"], "")}</div>
                            </div>

                            <div class="broadcast-score-wrapper">
                                <div class="broadcast-score">${scoreA}</div>
                                <div class="broadcast-divider">:</div>
                                <div class="broadcast-score">${scoreB}</div>
                            </div>

                            <div class="team-block">
                                <div class="broadcast-team-name">${this.read(first, ["B隊名"], "")}</div>
                            </div>
                        </div>

                        ${isRelay ? `
                        <div class="broadcast-legs-list">
                            ${legInfoHtml}
                        </div>
                        ` : ""}

                        <div class="broadcast-footer">
                            <i class="fas fa-user-tie"></i> 裁判: ${this.read(last, ["裁判"], "-")} | <i class="far fa-clock"></i> ${this.read(first, ["比賽時間"], "")}
                        </div>
                    </div>
                `;
            });

            container.innerHTML = broadcastHtml;
            return;
        }

        container.classList.remove("broadcast-grid");

        let html = `
            <div class="table-responsive animate-fadeIn" style="margin-bottom:3rem;">
                <table class="concise-match-table" style="width:100%; border-collapse:collapse; table-layout:fixed;">
                    <thead>
                        <tr style="background:rgba(0,0,0,0.2); border-bottom:2px solid var(--border);">
                            <th style="width:70px; padding:12px 10px;">時間</th>
                            <th style="width:45px;">序號</th>
                            <th style="width:200px;">輪次</th>
                            <th style="width:140px;">區別/階段</th>
                            <th style="width:3.6em;">場地</th>
                            <th style="width:20%;">A隊（隊員）</th>
                            <th style="text-align:center; width:150px; background:rgba(255,255,255,0.03);">比分</th>
                            <th style="width:20%;">B隊（隊員）</th>
                            <th style="width:80px;">裁判</th>
                            <th style="width:130px; text-align:center;">狀態</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        sortedData.forEach((match, idx) => {
            const time = this.read(match, ["比賽時間"], "--:--");
            const seq = this.read(match, ["序號"], "-");
            const round = this.read(match, ["輪次"], "-");
            const area = this.read(match, ["區"], "-");
            const court = this.read(match, ["場地"], "");
            const scoreA = this.read(match, ["A隊比分"], 0);
            const scoreB = this.read(match, ["B隊比分"], 0);
            const status = this.read(match, ["比賽狀態"], "未開賽");
            const referee = this.read(match, ["裁判"], "-");

            let statusClass = "gray";
            let rowStyle = "";
            if (status === "已完賽") {
                statusClass = "success";
                rowStyle = "opacity:0.75;";
            } else if (status === "比賽中") {
                statusClass = "primary";
                rowStyle = "background:rgba(var(--primary-rgb), 0.05); border-left:3px solid var(--primary);";
            }

            const areaLabel = this.cleanText(area).replace("區", "").trim();
            const isUmpire = typeof currentRole !== "undefined" && currentRole === "umpire";
            const voiceBtn = isUmpire ? `
                <button class="btn-icon" onclick="SpeechManager.announceMatch(Chasing.matches[${idx}], 'chasing')" title="語音播報" style="margin-left:8px; color:var(--accent);">
                    <i class="fas fa-volume-up"></i>
                </button>
            ` : "";

            html += `
                <tr style="border-bottom:1px solid var(--border); ${rowStyle}">
                    <td style="font-weight:600; color:var(--accent); font-size:1.1rem; padding:15px 10px;">${time}</td>
                    <td style="color:var(--text-dim); font-size:0.85rem;">${seq}</td>
                    <td style="color:var(--text-main); width:200px; white-space:nowrap;">${round}</td>
                    <td><span class="badge-pill gray" style="font-size:0.75rem; white-space:normal; line-height:1.2;">${areaLabel}</span></td>
                    <td style="color:var(--text-dim); width:3.6em; white-space:nowrap;">${court ? `${court}場` : "-"}</td>
                    <td style="text-align:center; padding:10px;">
                        <div class="team-info-stack" style="align-items:center;">
                            <span class="team-name" style="font-size:1.05rem; word-break:break-all;">${this.read(match, ["A隊名"], "")}</span>
                            <span class="player-names" style="font-size:0.8rem; opacity:0.6;">${this.getMatchPlayers(match, "A").join(", ")}</span>
                        </div>
                    </td>
                    <td style="background:rgba(255,255,255,0.03);">
                        <div class="score-mega-display" style="gap:8px;">
                            <span style="color:var(--text-main); font-size:1.3rem; font-family:'Outfit', sans-serif; min-width:40px; text-align:center;">${scoreA}</span>
                            <span class="score-divider" style="opacity:0.3;">:</span>
                            <span style="color:var(--text-main); font-size:1.3rem; font-family:'Outfit', sans-serif; min-width:40px; text-align:center;">${scoreB}</span>
                        </div>
                    </td>
                    <td style="text-align:center; padding:10px;">
                        <div class="team-info-stack" style="align-items:center;">
                            <span class="team-name" style="font-size:1.05rem; word-break:break-all;">${this.read(match, ["B隊名"], "")}</span>
                            <span class="player-names" style="font-size:0.8rem; opacity:0.6;">${this.getMatchPlayers(match, "B").join(", ")}</span>
                        </div>
                    </td>
                    <td style="color:var(--text-dim); font-size:0.85rem;">${referee}</td>
                    <td style="text-align:center; padding:10px;">
                        <div style="display:flex; align-items:center; justify-content:center;">
                            <span class="badge-pill ${statusClass}" style="padding:4px 10px; font-size:0.8rem;">
                                ${status === "已完賽" ? '<i class="fas fa-check-circle"></i> ' : ""}${status}
                            </span>
                            ${voiceBtn}
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }
};

document.addEventListener("tabChanged", event => {
    if (event.detail.tabId === "chasing") {
        Chasing.load();
    }
});
