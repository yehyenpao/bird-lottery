const Registration = {
    async load() {
        const res = await API.getRegistrations();
        if (res && res.status === "success") {
            this.render(res.data);
        } else {
            this.render([]);
        }
    },

    async importData() {
        console.log("開始執行匯入程序...");
        const inputElem = document.getElementById("import-data");
        if (!inputElem) {
            console.error("找不到輸入欄位 #import-data");
            return;
        }

        const text = inputElem.value.trim();
        if (!text) {
            alert("請先輸入資料！");
            return;
        }

        console.log("解析原始資料:", text);
        try {
            const lines = text.split("\n").filter(line => line.trim() !== "");
            const items = lines.map((line, index) => {
                const parts = line.split(",").map(s => s.trim());
                if (parts.length < 1) return null; // 完全空白行跳過
                
                let name = parts[0];
                let team = "";
                let area = "";

                if (parts.length >= 3) {
                    // 標準新格式：姓名,隊名,區 (例如：王小明,藍鳥,猛禽)
                    team = parts[1];
                    area = parts[2];
                } else if (parts.length === 2) {
                    // 相容舊格式：姓名,區 (例如：李四,小鳥)
                    area = parts[1];
                }
                
                if (!name) return null; // 無姓名跳過

                return {
                    yearMonth: CONFIG.YEAR_MONTH,
                    name, team, area,
                    role: "球員"
                };
            }).filter(item => item !== null);

            if (items.length === 0) {
                alert("沒有有效的資料可以匯入，請檢查格式是否正確。");
                return;
            }

            console.log("準備發送 API 請求到:", CONFIG.API_URL, "資料量:", items.length);
            const res = await API.addRegistrations(items);
            
            if (res && res.status === "success") {
                console.log("API 匯入成功");
                alert(res.message || "匯入成功！");
                inputElem.value = "";
                await this.load();
            }
        } catch (err) {
            console.error("匯入過程發生未預期錯誤:", err);
            alert("匯入失敗，請檢查格式或網路連線。");
        }
    },

    async autoGroup() {
        if (!confirm("確定要執行智慧分組嗎？\n系統將「保留」您已經手動指定的隊名，並自動將其餘名額補進尚未滿員 (6人) 的隊伍中。")) return;
        const res = await API.autoGroup();
        if (res && res.status === "success") {
            alert(res.message);
            this.load();
        } else {
            alert("分組失敗: " + (res ? res.message : "請檢查人數是否符合 24 人規則"));
        }
    },

    render(data) {
        const container = document.getElementById("reg-list-container");
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align: center; color: var(--text-dim); padding: 3rem;">
                    <i class="fas fa-users-slash" style="font-size: 3rem; margin-bottom: 1rem; display: block; opacity: 0.3;"></i>
                    <p>目前尚無報名資料。</p>
                </div>`;
            return;
        }

        const areas = CONFIG.AREAS; // 猛禽, 小鳥, 鳥蛋
        const teams = CONFIG.TEAMS; // 藍鳥, 黑鳥, 青鳥, 粉鳥

        let html = `
            <div class="card animate-fadeIn" style="overflow-x: auto;">
                <table class="matrix-table">
                    <thead>
                        <tr>
                            <th style="background: rgba(255,255,255,0.05);">隊名 \ 區</th>
                            ${areas.map(area => `<th>${area.replace("區", "")}</th>`).join("")}
                        </tr>
                    </thead>
                    <tbody>
        `;

        // 逐行產生隊伍資料
        teams.forEach(team => {
            const teamColor = CONFIG.TEAM_COLORS[team] || "var(--text-dim)";
            html += `
                <tr>
                    <td style="color: ${teamColor}; font-weight: bold; border-right: 1px solid var(--border);">
                        ${team}
                    </td>
            `;

            // 逐格填入人員
            areas.forEach(area => {
                const cleanArea = area.replace("區", "");
                const cellPlayers = data.filter(p => {
                    const pTeam = String(p.隊名 || "").trim();
                    const pArea = String(p.區 || p.區別 || "").replace("區", "");
                    return pTeam === team && pArea === cleanArea;
                });

                html += `
                    <td>
                        <div class="player-stack">
                            ${cellPlayers.length > 0 ? 
                                cellPlayers.map(p => `<div class="p-name">${p.姓名}</div>`).join("") : 
                                "<span style='opacity:0.2'>-</span>"
                            }
                        </div>
                    </td>
                `;
            });

            html += `</tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        // 額外顯示「未分配」人員 (如果有)
        const unassigned = data.filter(p => !p.隊名 || p.隊名.trim() === "");
        if (unassigned.length > 0) {
            html += `
                <div class="card animate-fadeIn" style="margin-top: 1.5rem; border: 1px dashed var(--border);">
                    <h4 style="color: var(--text-dim); margin-bottom: 0.8rem;"><i class="fas fa-clock"></i> 尚未分組人員 (${unassigned.length})</h4>
                    <div class="player-list">
                        ${unassigned.map(p => `<span class="player-tag">${p.姓名} (${(p.區 || "").replace("區", "")})</span>`).join("")}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
        
        // 矩陣桌樣式
        if (!document.getElementById("registration-matrix-style")) {
            const style = document.createElement("style");
            style.id = "registration-matrix-style";
            style.textContent = `
                .matrix-table { width: 100%; border-collapse: collapse; text-align: center; }
                .matrix-table th { padding: 15px; background: rgba(0,0,0,0.2); color: var(--accent); border: 1px solid var(--border); font-size: 1.1rem; }
                .matrix-table td { padding: 12px; border: 1px solid var(--border); vertical-align: middle; }
                .player-stack { display: flex; flex-direction: column; gap: 4px; }
                .p-name { font-weight: 500; font-size: 1rem; color: var(--text-main); }
                .player-list { display: flex; flex-wrap: wrap; gap: 8px; }
            `;
            document.head.appendChild(style);
        }
    }
};

// 將物件暴露到全域，確保 HTML 的 onclick 可以呼叫到
window.Registration = Registration;
