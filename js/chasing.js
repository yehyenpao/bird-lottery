const Chasing = {
    rankings: [],
    registrations: [],
    lineups: {
        match1: [], // { targetScore: 11, A1, A2, A3, B1, B2, B3 }
        match2: []
    },

    async load() {
        const chasingRes = await API.getChasingSchedule();
        if (chasingRes && chasingRes.status === "success") {
            this.renderTable(chasingRes.data || []);
        }

        // 載入排名與名單以建構編輯器
        const rankRes = await API.getRankings();
        const regRes = await API.getRegistrations();
        
        if (rankRes && rankRes.status === "success" && regRes && regRes.status === "success") {
            this.rankings = rankRes.data || [];
            this.registrations = regRes.data || [];
            
            if (this.rankings.length >= 4) {
                this.initDefaultLineups();
                this.renderLineupEditor();
            } else {
                document.getElementById("chasing-lineup-editor").innerHTML = `
                    <div class="card" style="text-align:center; color:var(--text-dim); padding:2rem;">
                        <i class="fas fa-exclamation-triangle"></i> 預賽排名資料不足 (需至少 4 隊)
                    </div>
                `;
            }
        }
        
        // 綁定基礎生成按鈕
        const btnGen = document.getElementById("btn-generate-chasing");
        if (btnGen) btnGen.onclick = () => this.generateSemiFinals();
    },

    initDefaultLineups() {
        // 預設 6 輪接力 (11, 22, 33, 44, 55, 66)
        const defaults = [11, 22, 33, 44, 55, 66].map(s => ({
            targetScore: s + "分接力",
            A1: "", A2: "", A3: "",
            B1: "", B2: "", B3: ""
        }));
        this.lineups.match1 = JSON.parse(JSON.stringify(defaults));
        this.lineups.match2 = JSON.parse(JSON.stringify(defaults));
    },

    renderLineupEditor() {
        const container = document.getElementById("chasing-lineup-editor");
        if (!container) return;

        const match1 = { teamA: this.rankings[0].name, teamB: this.rankings[3].name, court: "C", area: "準決賽(1v4)", id: "match1" };
        const match2 = { teamA: this.rankings[1].name, teamB: this.rankings[2].name, court: "B", area: "準決賽(2v3)", id: "match2" };

        container.innerHTML = `
            ${this.buildMatchEditor(match1)}
            ${this.buildMatchEditor(match2)}
        `;
    },

    buildMatchEditor(m) {
        const playersA = this.registrations.filter(r => r["隊名"] === m.teamA);
        const playersB = this.registrations.filter(r => r["隊名"] === m.teamB);

        const rows = this.lineups[m.id].map((row, idx) => `
            <tr>
                <td><input type="text" class="score-input" value="${row.targetScore}" onchange="Chasing.updateRow('${m.id}', ${idx}, 'targetScore', this.value)"></td>
                <td>${this.buildPlayerSelect(playersA, row.A1, (val) => Chasing.updateRow(m.id, idx, 'A1', val))}</td>
                <td>${this.buildPlayerSelect(playersA, row.A2, (val) => Chasing.updateRow(m.id, idx, 'A2', val))}</td>
                <td>${this.buildPlayerSelect(playersA, row.A3, (val) => Chasing.updateRow(m.id, idx, 'A3', val))}</td>
                <td style="color:var(--primary); font-weight:bold;">VS</td>
                <td>${this.buildPlayerSelect(playersB, row.B1, (val) => Chasing.updateRow(m.id, idx, 'B1', val))}</td>
                <td>${this.buildPlayerSelect(playersB, row.B2, (val) => Chasing.updateRow(m.id, idx, 'B2', val))}</td>
                <td>${this.buildPlayerSelect(playersB, row.B3, (val) => Chasing.updateRow(m.id, idx, 'B3', val))}</td>
            </tr>
        `).join("");

        return `
            <div class="match-setup-card animate-fadeIn">
                <h3><i class="fas fa-vs"></i> ${m.area}: ${m.teamA} vs ${m.teamB} (場地: ${m.court})</h3>
                <div class="table-container">
                    <table class="lineup-table">
                        <thead>
                            <tr>
                                <th>換輪/目標分</th>
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
                    <button class="btn-add-round" onclick="Chasing.addRound('${m.id}')"><i class="fas fa-plus"></i> 新增一輪</button>
                    <button class="btn-remove-round" onclick="Chasing.removeRound('${m.id}')"><i class="fas fa-minus"></i> 刪除最後一輪</button>
                </div>
            </div>
        `;
    },

    buildPlayerSelect(players, current, onChange) {
        // 生成隨機ID以便綁定
        const id = 'sel-' + Math.random().toString(36).substr(2, 9);
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

    updateRow(matchId, idx, field, val) {
        this.lineups[matchId][idx][field] = val;
    },

    addRound(matchId) {
        this.lineups[matchId].push({ targetScore: "分接力", A1: "", A2: "", A3: "", B1: "", B2: "", B3: "" });
        this.renderLineupEditor();
    },

    removeRound(matchId) {
        if (this.lineups[matchId].length > 1) {
            this.lineups[matchId].pop();
            this.renderLineupEditor();
        }
    },

    async generateSemiFinals() {
        const match1Data = this.lineups.match1.map(row => ({
            ...row,
            teamA: this.rankings[0].name,
            teamB: this.rankings[3].name,
            court: "C",
            area: "準決賽(1v4)"
        }));
        const match2Data = this.lineups.match2.map(row => ({
            ...row,
            teamA: this.rankings[1].name,
            teamB: this.rankings[2].name,
            court: "B",
            area: "準決賽(2v3)"
        }));

        const allData = [...match1Data, ...match2Data];

        // 檢查必填 (至少要有成員1,2)
        const invalid = allData.some(d => !d.A1 || !d.A2 || !d.B1 || !d.B2);
        if (invalid) {
            alert("請確保每一輪的隊員1與隊員2皆已填寫！");
            return;
        }

        if (!confirm("確定要依據上述「出場順序表」產生「準決賽」賽程嗎？\n(這會寫入追分賽紀錄表，若已存在該月準決賽資料將被覆蓋)")) return;

        const btn = document.getElementById("btn-generate-chasing");
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 正在傳送賽程資料...`;
        btn.disabled = true;

        try {
            const res = await API.generateChasingSchedule(allData);
            if (res && res.status === "success") {
                alert("追分賽程(準決賽)已成功產生！");
                this.load();
            }
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    renderTable(data) {
        const container = document.getElementById("chasing-schedule-container");
        if (data.length === 0) {
            container.innerHTML = `<div class="card" style="text-align: center; color: var(--text-dim); padding: 2rem;">目前尚無賽程。</div>`;
            return;
        }

        let html = `
            <table class="pivot-table">
                <thead>
                    <tr>
                        <th style="width: 120px;">輪次</th>
                        <th>場地</th>
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

        const filtered = data.filter(m => String(m["區"]).includes("準決賽"));
        filtered.forEach(m => {
            const isDone = m["比賽狀態"] === "已完賽";
            const playersA = [m["A隊員1"], m["A隊員2"], m["A隊員3"]].filter(p => p && p!=="待定").join(" / ");
            const playersB = [m["B隊員1"], m["B隊員2"], m["B隊員3"]].filter(p => p && p!=="待定").join(" / ");

            html += `
                <tr>
                    <td><strong>${m["輪次"]}</strong><br/><small>${m["區"]}</small></td>
                    <td><span class="badge" style="background: rgba(59, 130, 246, 0.2);">${m["場地"]}場</span></td>
                    <td><strong style="color: var(--primary);">${m["A隊名"]}</strong></td>
                    <td style="font-size:0.85rem;">${playersA}</td>
                    <td style="font-size: 1.1rem; font-weight: bold;">${m["A隊比分"] || 0}</td>
                    <td style="font-size: 1.1rem; font-weight: bold;">${m["B隊比分"] || 0}</td>
                    <td><strong style="color: var(--accent);">${m["B隊名"]}</strong></td>
                    <td style="font-size:0.85rem;">${playersB}</td>
                    <td><span class="status-badge ${isDone ? 'status-done' : 'status-pending'}">${m["比賽狀態"] || '待賽'}</span></td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }
};

