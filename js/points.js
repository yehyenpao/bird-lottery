const Points = {
    teamPlayersMap: {},
    allPlayers: [],

    async init() {
        this.bindEvents();
        await this.loadParticipants();
        await this.loadExistingReport();
    },

    async loadExistingReport() {
        const tbody = document.getElementById("points-record-tbody");
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;"><i class="fas fa-sync fa-spin"></i> 載入現有積點紀錄中...</td></tr>';
        
        try {
            const res = await API.getPointsRecords();
            if (res && res.status === "success" && res.data && res.data.length > 0) {
                this.renderReport(res.data);
            } else {
                tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;">目前查無此日期的積點紀錄</td></tr>';
            }
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; color: #ff6b6b;">讀取失敗</td></tr>';
        }
    },

    bindEvents() {
        const btnCalc = document.getElementById("btn-calculate-points");
        if (btnCalc) btnCalc.onclick = () => this.calculatePoints();

        const btnAdd = document.getElementById("btn-add-point-row");
        if (btnAdd) btnAdd.onclick = () => this.addManualRow();

        const btnRemove = document.getElementById("btn-remove-point-row");
        if (btnRemove) btnRemove.onclick = () => this.removeManualRow();
    },

    async loadParticipants() {
        try {
            const tbody = document.getElementById("manual-points-tbody");
            const datalist = document.getElementById("all-players-list");
            if (!tbody) return;
            
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> 載入名單資料庫中...</td></tr>';
            
            // 1. 抓取本次比賽報名成員
            const regRes = await API.getRegistrations();
            const registrations = (regRes && regRes.status === "success") ? (regRes.data || []) : [];
            
            this.teamPlayersMap = { "藍鳥隊": [], "黑鳥隊": [], "青鳥隊": [], "粉鳥隊": [] };
            const registeredNames = new Set();
            
            registrations.forEach(p => {
                const name = p["姓名"] ? p["姓名"].trim() : "";
                const team = p["隊名"] ? p["隊名"].trim() : "";
                if (name) {
                    registeredNames.add(name);
                    if (team && this.teamPlayersMap[team]) {
                        this.teamPlayersMap[team].push(name);
                    }
                }
            });

            // 2. 抓取全體歷史球員庫
            const dbRes = await API.getPlayersInfo();
            const dbNames = (dbRes && dbRes.status === "success" && dbRes.data) ? Object.keys(dbRes.data) : [];
            
            // 合併所有已知的姓名 (去重)
            this.allPlayers = [...new Set([...registeredNames, ...dbNames])].sort();

            // 3. 更新 datalist 供智慧搜尋使用
            if (datalist) {
                datalist.innerHTML = "";
                this.allPlayers.forEach(name => {
                    const opt = document.createElement("option");
                    opt.value = name;
                    datalist.appendChild(opt);
                });
            }

            // 4. 初始化介面
            tbody.innerHTML = "";
            for (let i = 0; i < 5; i++) {
                this.addManualRow();
            }
        } catch (e) {
            console.error(e);
            const tbody = document.getElementById("manual-points-tbody");
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #ff6b6b;">載入失敗</td></tr>';
        }
    },

    addManualRow() {
        const tbody = document.getElementById("manual-points-tbody");
        if (!tbody) return;
        const tr = document.createElement("tr");

        let teamOptions = `<option value="">--請選擇--</option>`;
        CONFIG.TEAMS.forEach(t => teamOptions += `<option value="${t}">${t}</option>`);
        teamOptions += `<option value="鳥巢隊" style="color:var(--accent);">鳥巢隊 (非本次參賽)</option>`;

        tr.innerHTML = `
            <td>
                <select class="manual-team" style="width:100%; padding:0.4rem; border-radius:4px; background:rgba(0,0,0,0.3); border:1px solid #666; color:#fff;">
                    ${teamOptions}
                </select>
            </td>
            <td>
                <input type="text" class="manual-name" list="all-players-list" placeholder="輸入姓名或搜尋" style="width:100%; padding:0.4rem; border-radius:4px; background:rgba(0,0,0,0.3); border:1px solid #666; color:#fff;">
            </td>
            <td><input type="number" class="manual-input guess-pts" min="0" placeholder="0" style="width:70px; text-align:center; background: rgba(0,0,0,0.3); color:#fff; border: 1px solid rgba(255,255,255,0.2); border-radius:4px; padding:6px; font-size:1rem;"></td>
            <td><input type="number" class="manual-input ref-pts" min="0" placeholder="0" style="width:70px; text-align:center; background: rgba(0,0,0,0.3); color:#fff; border: 1px solid rgba(255,255,255,0.2); border-radius:4px; padding:6px; font-size:1rem;"></td>
        `;

        const teamSelect = tr.querySelector(".manual-team");
        const nameInput = tr.querySelector(".manual-name");

        // 當切換隊伍時，如果是正式四隊，我們可以協助填入，如果是鳥巢隊則清空讓使用者搜尋
        teamSelect.addEventListener("change", (e) => {
            const team = e.target.value;
            if (!team) return;
            
            // 如果是正式隊伍，我們把原本該隊的人員提示放進 placeholder 或清空
            if (this.teamPlayersMap[team] && this.teamPlayersMap[team].length > 0) {
                nameInput.placeholder = `推薦: ${this.teamPlayersMap[team].join(", ")}`;
            } else if (team === "鳥巢隊") {
                nameInput.placeholder = "請搜尋或輸入姓名";
            }
        });

        tbody.appendChild(tr);
    },

    removeManualRow() {
        const tbody = document.getElementById("manual-points-tbody");
        if (tbody && tbody.children.length > 0) {
            tbody.removeChild(tbody.lastChild);
        }
    },

    async calculatePoints() {
        const btnCalc = document.getElementById("btn-calculate-points");
        btnCalc.disabled = true;
        btnCalc.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 後端雲端運算與資料庫寫入中...';
        
        try {
            const manualData = {};
            const rows = document.querySelectorAll("#manual-points-tbody tr");
            rows.forEach(tr => {
                const teamSelect = tr.querySelector(".manual-team");
                const nameInput = tr.querySelector(".manual-name");
                if (!teamSelect || !nameInput) return;

                const team = teamSelect.value;
                const name = nameInput.value.trim();
                const guess = parseInt(tr.querySelector(".guess-pts").value) || 0;
                const ref = parseInt(tr.querySelector(".ref-pts").value) || 0;
                
                if (name && (guess > 0 || ref > 0 || team.includes("鳥巢隊"))) {
                    if (!manualData[name]) {
                        manualData[name] = { 
                            guess: 0, 
                            ref: 0,
                            team: team === "鳥巢隊" ? "鳥巢隊" : team,
                            area: team === "鳥巢隊" ? "外部" : ""
                        };
                    }
                    manualData[name].guess += guess;
                    manualData[name].ref += ref;
                }
            });

            const res = await API.calculatePoints(manualData);
            
            if (res && res.status === "success") {
                alert(res.message);
                this.renderReport(res.data);
            }
        } catch (e) {
            console.error(e);
            alert("計算積分時發生錯誤：" + e.message);
        } finally {
            btnCalc.disabled = false;
            btnCalc.innerHTML = '<i class="fas fa-calculator"></i> 執行統計並產出本月積點報表';
        }
    },

    renderReport(dataList) {
        const tbody = document.getElementById("points-record-tbody");
        if (!tbody) return;
        
        if (!dataList || dataList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;">查無統計數據</td></tr>';
            return;
        }
        
        let html = "";
        dataList.forEach((p, idx) => {
            const rankStyle = idx === 0 ? "background: #ffd700; color: #000;" : 
                              idx === 1 ? "background: #c0c0c0; color: #000;" : 
                              idx === 2 ? "background: #cd7f32; color: #fff;" : "";
                              
            html += `
                <tr class="animate-fadeIn">
                    <td><span class="rank-badge" style="${rankStyle}">${idx + 1}</span></td>
                    <td style="font-weight:bold; font-size:1.1em;">${p.name}</td>
                    <td>${p.team}</td>
                    <td>${p.area}</td>
                    <td>${p.rrRank}</td>
                    <td>${p.elimRank}</td>
                    <td style="color:#aaa;">${p.currPts}</td>
                    <td style="color:#4caf50;">${p.guessPts > 0 ? "+" + p.guessPts : 0}</td>
                    <td style="color:#4caf50;">${p.refPts > 0 ? "+" + p.refPts : 0}</td>
                    <td style="color:#2196f3;">${p.rrPts > 0 ? "+" + p.rrPts : 0}</td>
                    <td style="color:#ff9800;">${p.elimPts > 0 ? "+" + p.elimPts : 0}</td>
                    <td style="font-weight:bold; font-size:1.3em; color:var(--accent); text-shadow: 0 0 10px rgba(0, 255, 204, 0.5);">${p.totalPts}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        
        setTimeout(() => {
            const table = document.getElementById("points-record-table");
            if (table) table.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
};

window.Points = Points;
