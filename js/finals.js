const Finals = {
    registrations: [],
    winners: [],
    losers: [],
    lineups: {
        champ: [],  // 冠軍賽
        third: []   // 季軍賽
    },

    async load() {
        const chasingRes = await API.getChasingSchedule();
        const regRes = await API.getRegistrations();
        
        if (chasingRes && chasingRes.status === "success" && regRes && regRes.status === "success") {
            const data = chasingRes.data || [];
            this.registrations = regRes.data || [];

            // 1. 顯示現有決賽表
            const finalsData = data.filter(m => (String(m["區"]).includes("冠軍賽") || String(m["區"]).includes("季軍賽")));
            this.renderTable(finalsData);

            // 2. 判定準決賽勝負以建構編輯器
            // 找出準決賽的最終分進度 (通常是 66分)
            const semiFinals = data.filter(i => {
                const area = String(i["區"] || "");
                const status = String(i["比賽狀態"] || "");
                // 為了保險，搜尋該區最後一場 (比分最高的一場)
                return area.includes("準決賽") && status === "已完賽";
            });

            // 根據區群組化，並找出最高分的場次
            const groups = {};
            semiFinals.forEach(m => {
                if (!groups[m["區"]]) groups[m["區"]] = m;
                const scoreM = (parseInt(m["A隊比分"]) || 0) + (parseInt(m["B隊比分"]) || 0);
                const scoreG = (parseInt(groups[m["區"]]["A隊比分"]) || 0) + (parseInt(groups[m["區"]]["B隊比分"]) || 0);
                if (scoreM > scoreG) groups[m["區"]] = m;
            });

            const finalSemiResults = Object.values(groups);

            if (finalSemiResults.length < 2) {
                document.getElementById("finals-lineup-editor").innerHTML = `
                    <div class="card" style="text-align:center; color:var(--text-dim); padding:2rem;">
                        <i class="fas fa-clock"></i> 準決賽尚未全數完賽 (需有兩組完賽紀錄)，無法自動帶入對戰名單。
                    </div>
                `;
                return;
            }

            this.winners = [];
            this.losers = [];
            finalSemiResults.forEach(m => {
                const sA = parseInt(m["A隊比分"]) || 0;
                const sB = parseInt(m["B隊比分"]) || 0;
                if (sA > sB) {
                    this.winners.push(m["A隊名"]);
                    this.losers.push(m["B隊名"]);
                } else {
                    this.winners.push(m["B隊名"]);
                    this.losers.push(m["A隊名"]);
                }
            });

            if (this.lineups.champ.length === 0) {
                this.initDefaultLineups();
            }
            this.renderLineupEditor();
        }

        // 綁定生成按鈕
        const btnGen = document.getElementById("btn-generate-finals");
        if (btnGen) btnGen.onclick = () => this.generateFinalsSchedule();
    },

    initDefaultLineups() {
        const defaults = [11, 22, 33, 44, 55, 66].map(s => ({
            targetScore: s + "分接力",
            A1: "", A2: "", A3: "",
            B1: "", B2: "", B3: ""
        }));
        this.lineups.champ = JSON.parse(JSON.stringify(defaults));
        this.lineups.third = JSON.parse(JSON.stringify(defaults));
    },

    renderLineupEditor() {
        const container = document.getElementById("finals-lineup-editor");
        if (!container) return;

        const matchChamp = { teamA: this.winners[0], teamB: this.winners[1], court: "C", area: "冠軍賽", id: "champ" };
        const matchThird = { teamA: this.losers[0], teamB: this.losers[1], court: "B", area: "季軍賽", id: "third" };

        container.innerHTML = `
            ${this.buildMatchEditor(matchChamp)}
            ${this.buildMatchEditor(matchThird)}
        `;
    },

    buildMatchEditor(m) {
        const playersA = this.registrations.filter(r => r["隊名"] === m.teamA);
        const playersB = this.registrations.filter(r => r["隊名"] === m.teamB);

        const rows = this.lineups[m.id].map((row, idx) => `
            <tr>
                <td><input type="text" class="score-input" value="${row.targetScore}" onchange="Finals.updateRow('${m.id}', ${idx}, 'targetScore', this.value)"></td>
                <td>${this.buildPlayerSelect(playersA, row.A1, (val) => Finals.updateRow(m.id, idx, 'A1', val))}</td>
                <td>${this.buildPlayerSelect(playersA, row.A2, (val) => Finals.updateRow(m.id, idx, 'A2', val))}</td>
                <td>${this.buildPlayerSelect(playersA, row.A3, (val) => Finals.updateRow(m.id, idx, 'A3', val))}</td>
                <td style="color:var(--primary); font-weight:bold;">VS</td>
                <td>${this.buildPlayerSelect(playersB, row.B1, (val) => Finals.updateRow(m.id, idx, 'B1', val))}</td>
                <td>${this.buildPlayerSelect(playersB, row.B2, (val) => Finals.updateRow(m.id, idx, 'B2', val))}</td>
                <td>${this.buildPlayerSelect(playersB, row.B3, (val) => Finals.updateRow(m.id, idx, 'B3', val))}</td>
            </tr>
        `).join("");

        return `
            <div class="match-setup-card animate-fadeIn">
                <h3 style="color:#ffd700;"><i class="fas fa-trophy"></i> ${m.area}: ${m.teamA} vs ${m.teamB} (場地: ${m.court})</h3>
                <div class="table-container">
                    <table class="lineup-table">
                        <thead>
                            <tr>
                                <th>目標分</th>
                                <th>A隊員1</th>
                                <th>A隊員2</th>
                                <th>A隊員3</th>
                                <th></th>
                                <th>B隊員1</th>
                                <th>B隊員2</th>
                                <th>B隊員3</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div class="lineup-actions">
                    <button class="btn-add-round" onclick="Finals.addRound('${m.id}')"><i class="fas fa-plus"></i> 新增一輪</button>
                    <button class="btn-remove-round" onclick="Finals.removeRound('${m.id}')"><i class="fas fa-minus"></i> 刪除最後一輪</button>
                </div>
            </div>
        `;
    },

    buildPlayerSelect(players, current, onChange) {
        const id = 'fsel-' + Math.random().toString(36).substr(2, 9);
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) el.onchange = (e) => onChange(e.target.value);
        }, 0);

        let options = `<option value="">--選擇--</option>`;
        players.forEach(p => {
            options += `<option value="${p["姓名"]}" ${p["姓名"] === current ? 'selected' : ''}>${p["姓名"]}</option>`;
        });
        return `<select id="${id}">${options}</select>`;
    },

    updateRow(id, idx, field, val) {
        this.lineups[id][idx][field] = val;
    },

    addRound(id) {
        this.lineups[id].push({ targetScore: "分接力", A1: "", A2: "", A3: "", B1: "", B2: "", B3: "" });
        this.renderLineupEditor();
    },

    removeRound(id) {
        if (this.lineups[id].length > 1) {
            this.lineups[id].pop();
            this.renderLineupEditor();
        }
    },

    async generateFinalsSchedule() {
        const champData = this.lineups.champ.map(row => ({
            ...row,
            teamA: this.winners[0],
            teamB: this.winners[1],
            court: "C",
            area: "冠軍賽"
        }));
        const thirdData = this.lineups.third.map(row => ({
            ...row,
            teamA: this.losers[0],
            teamB: this.losers[1],
            court: "B",
            area: "季軍賽"
        }));

        const allData = [...champData, ...thirdData];

        const invalid = allData.some(d => !d.A1 || !d.A2 || !d.B1 || !d.B2);
        if (invalid) {
            alert("請確保每一輪的隊員1與隊員2皆已填寫！");
            return;
        }

        if (!confirm("確定要依據上述「出場順序表」產生「決賽」賽程嗎？\n(這會寫入追分賽紀錄表，若已存在該月決賽資料將被覆蓋)")) return;

        const btn = document.getElementById("btn-generate-finals");
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 正在傳送賽程資料...`;
        btn.disabled = true;

        try {
            const res = await API.generateFinals(allData);
            if (res && res.status === "success") {
                alert("決賽賽程已成功產生！");
                this.load();
            }
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    renderTable(data) {
        const container = document.getElementById("finals-schedule-container");
        if (data.length === 0) {
            container.innerHTML = `<div class="card" style="text-align: center; color: var(--text-dim); padding: 2rem;">目前尚無決賽賽程。</div>`;
            return;
        }

        let html = `
            <table class="pivot-table">
                <thead>
                    <tr>
                        <th style="width: 120px;">分</th>
                        <th>區/場地</th>
                        <th>A隊對戰</th>
                        <th>A隊員</th>
                        <th style="width: 60px;">分</th>
                        <th style="width: 60px;">分</th>
                        <th>B隊對戰</th>
                        <th>B隊員</th>
                        <th>狀態</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.forEach(m => {
            const isDone = m["比賽狀態"] === "已完賽";
            const pA = [m["A隊員1"], m["A隊員2"], m["A隊員3"]].filter(p => p && p!=="待定").join(" / ");
            const pB = [m["B隊員1"], m["B隊員2"], m["B隊員3"]].filter(p => p && p!=="待定").join(" / ");
            const isChamp = String(m["區"]).includes("冠軍賽");

            html += `
                <tr style="${isChamp ? 'background:rgba(255,215,0,0.05); border-left:4px solid gold;' : 'border-left:4px solid #cd7f32;'}">
                    <td><strong>${m["輪次"]}</strong></td>
                    <td><span class="badge" style="background:${isChamp ? 'gold' : '#cd7f32'}; color:#000;">${m["區"]}</span><br/>${m["場地"]}場</td>
                    <td><strong style="color:var(--primary);">${m["A隊名"]}</strong></td>
                    <td style="font-size:0.85rem;">${pA}</td>
                    <td style="font-size: 1.1rem; font-weight: bold;">${m["A隊比分"] || 0}</td>
                    <td style="font-size: 1.1rem; font-weight: bold;">${m["B隊比分"] || 0}</td>
                    <td><strong style="color:var(--accent);">${m["B隊名"]}</strong></td>
                    <td style="font-size:0.85rem;">${pB}</td>
                    <td><span class="status-badge ${isDone ? 'status-done' : 'status-pending'}">${m["比賽狀態"] || '待賽'}</span></td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }
};

