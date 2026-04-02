const Viewer = {
    async loadSchedule() {
        const tbodyRR = document.querySelector("#v-schedule-table tbody");
        const tbodyChasing = document.querySelector("#v-chasing-table tbody");
        
        if (!tbodyRR || !tbodyChasing) return;

        tbodyRR.innerHTML = "<tr><td colspan='7'>載入中...</td></tr>";
        tbodyChasing.innerHTML = "<tr><td colspan='7'>載入中...</td></tr>";

        try {
            const rrData = await API.getSchedule();
            const chData = await API.getChasingSchedule();
            
            // 渲染循環賽
            if (rrData && rrData.data) {
                tbodyRR.innerHTML = "";
                if (rrData.data.length === 0) {
                    tbodyRR.innerHTML = "<tr><td colspan='7'>目前尚無賽程資料</td></tr>";
                } else {
                    rrData.data.forEach(m => {
                        const status = m["比賽狀態"] || "待賽";
                        const isDone = status.includes("完賽");
                        const statusHtml = isDone ? `<span class="status-badge status-done">已完賽</span>` : `<span class="status-badge status-pending">${status}</span>`;
                        const aScore = isDone ? `<strong>${m["A隊比分"]||0}</strong>` : "-";
                        const bScore = isDone ? `<strong>${m["B隊比分"]||0}</strong>` : "-";
                        
                        tbodyRR.innerHTML += `
                            <tr>
                                <td>${m["比賽時間"] || ""}</td>
                                <td>${m["序號"] || ""}</td>
                                <td>${m["輪次"] || ""}<br><small>${m["場地"] || ""}</small></td>
                                <td>${m["A隊名"] || ""}<br><small>${m["A隊員1"] || ""}, ${m["A隊員2"] || ""}</small></td>
                                <td style="text-align:center;">${aScore} : ${bScore}</td>
                                <td>${m["B隊名"] || ""}<br><small>${m["B隊員1"] || ""}, ${m["B隊員2"] || ""}</small></td>
                                <td>${statusHtml}<br><small>${m["裁判"] || ""}</small></td>
                            </tr>
                        `;
                    });
                }
            }

            // 渲染追分賽與冠軍戰
            if (chData && chData.data) {
                tbodyChasing.innerHTML = "";
                if (chData.data.length === 0) {
                    tbodyChasing.innerHTML = "<tr><td colspan='7'>目前尚無追分賽資料</td></tr>";
                } else {
                    chData.data.forEach(m => {
                        const status = m["比賽狀態"] || "待賽";
                        const isDone = status.includes("完賽");
                        const statusHtml = isDone ? `<span class="status-badge status-done">已完賽</span>` : `<span class="status-badge status-pending">${status}</span>`;
                        const aScore = isDone ? `<strong>${m["A隊比分"]||0}</strong>` : "-";
                        const bScore = isDone ? `<strong>${m["B隊比分"]||0}</strong>` : "-";
                        
                        tbodyChasing.innerHTML += `
                            <tr>
                                <td>${m["輪次"] || ""}</td>
                                <td>${m["區"] || ""}</td>
                                <td>${m["場地"] || ""}</td>
                                <td>${m["A隊名"] || ""}<br><small>${m["A隊員1"] || ""}, ${m["A隊員2"] || ""}</small></td>
                                <td style="text-align:center;">${aScore} : ${bScore}</td>
                                <td>${m["B隊名"] || ""}<br><small>${m["B隊員1"] || ""}, ${m["B隊員2"] || ""}</small></td>
                                <td>${statusHtml}</td>
                            </tr>
                        `;
                    });
                }
            }
        } catch(e) {
            if(tbodyRR) tbodyRR.innerHTML = "<tr><td colspan='7'>載入失敗</td></tr>";
            if(tbodyChasing) tbodyChasing.innerHTML = "<tr><td colspan='7'>載入失敗</td></tr>";
        }
    },

    initHistory() {
        const btn = document.getElementById("btn-v-history-search");
        if(btn && !btn.hasAttribute("data-bound")) {
            btn.setAttribute("data-bound", "true");
            btn.addEventListener("click", () => this.searchHistory());
        }
    },

    async searchHistory() {
        const query = document.getElementById("v-history-search").value.trim();
        const resultsDiv = document.getElementById("v-history-results");
        if (!query) {
            alert("請輸入姓名！");
            return;
        }

        resultsDiv.innerHTML = "<div style='text-align:center; padding: 2rem;'><i class='fas fa-spinner fa-spin fa-2x'></i><br>搜尋中...</div>";

        try {
            const rrData = await API.getSchedule();
            const chData = await API.getChasingSchedule();
            let matches = [];

            if (rrData && rrData.data) {
                rrData.data.forEach(m => {
                    const matchString = JSON.stringify(m);
                    if (matchString.includes(query)) {
                        m.MatchType = "預賽";
                        matches.push(m);
                    }
                });
            }

            if (chData && chData.data) {
                chData.data.forEach(m => {
                    const matchString = JSON.stringify(m);
                    if (matchString.includes(query)) {
                        m.MatchType = m["區"] && m["區"].includes("賽") ? "決賽" : "追分賽";
                        matches.push(m);
                    }
                });
            }

            if (matches.length === 0) {
                resultsDiv.innerHTML = `<div class="card" style="text-align:center; color:var(--text-dim);">找不到符合「${query}」的比賽紀錄。</div>`;
                return;
            }

            let html = `<h3 style="margin-bottom:1rem; text-align:center; color:var(--primary);">🎯 「${query}」的比賽紀錄</h3>`;
            html += `<div class="team-grid">`;
            
            matches.forEach(m => {
                const status = m["比賽狀態"] || "待賽";
                const isDone = status.includes("完賽");
                const aName = m["A隊名"];
                const bName = m["B隊名"];
                const isTeamA = (m["A隊員1"] === query || m["A隊員2"] === query || aName === query);
                
                // Highlight the user's team
                const queryAStyle = isTeamA ? "color:var(--accent); font-weight:bold;" : "";
                const queryBStyle = !isTeamA ? "color:var(--accent); font-weight:bold;" : "";

                html += `
                <div class="card" style="padding:1rem;">
                    <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:0.5rem; margin-bottom:0.5rem;">
                        <span style="color:var(--primary);">${m.MatchType} - ${m["輪次"]}</span>
                        <span class="status-badge ${isDone ? 'status-done' : 'status-pending'}">${status}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="text-align:center; flex:1; ${queryAStyle}">
                            <div>${aName}</div>
                            <small>${m["A隊員1"]||""}, ${m["A隊員2"]||""}</small>
                        </div>
                        <div style="padding: 0 1rem; font-size:1.5rem; font-weight:bold;">
                            ${m["A隊比分"]||0} - ${m["B隊比分"]||0}
                        </div>
                        <div style="text-align:center; flex:1; ${queryBStyle}">
                            <div>${bName}</div>
                            <small>${m["B隊員1"]||""}, ${m["B隊員2"]||""}</small>
                        </div>
                    </div>
                </div>`;
            });
            html += `</div>`;
            resultsDiv.innerHTML = html;

        } catch (e) {
            resultsDiv.innerHTML = "<div style='text-align:center; color:red;'>查詢發生錯誤。</div>";
        }
    },

    async loadPoints() {
        const tbody = document.getElementById("v-points-tbody");
        if (!tbody) return;
        tbody.innerHTML = "<tr><td colspan='5'>載入中...</td></tr>";
        
        try {
            const currentYM = document.getElementById("current-year-month").innerText.trim();
            const url = `${CONFIG.API_URL}?action=calculatePoints&yearMonth=${currentYM}&data=%7B%7D`; 
            
            const res = await fetch(url).then(r=>r.json());
            if (res && res.data) {
                tbody.innerHTML = "";
                res.data.forEach((p, idx) => {
                    const tr = document.createElement("tr");
                    if (idx === 0) tr.classList.add("rank-1");
                    else if (idx === 1) tr.classList.add("rank-2");
                    else if (idx === 2) tr.classList.add("rank-3");
                    
                    tr.innerHTML = `
                        <td>${idx + 1}</td>
                        <td>${p.name}</td>
                        <td>${p.team}</td>
                        <td>${p.area}</td>
                        <td><span class="badge-points" style="font-size:1.2rem;">${p.totalPts}</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch(e) {
            tbody.innerHTML = "<tr><td colspan='5'>無法載入積分，請確認本月裁判已執行統計。</td></tr>";
        }
    },

    async loadSpecial() {
        const container = document.getElementById("v-special-container");
        if (!container) return;
        container.innerHTML = "<div style='text-align:center;'>載入中...</div>";

        try {
            const res = await API.getSpecialRecords();
            if (res && res.data) {
                const currentYM = document.getElementById("current-year-month").innerText.trim();
                const monthData = res.data.filter(r => r["年月"] === currentYM);
                
                if (monthData.length === 0) {
                    container.innerHTML = "<div class='card' style='text-align:center;'>本月份尚無發布特殊紀錄。</div>";
                    return;
                }

                let html = "";
                monthData.forEach(r => {
                    let iconHtml = ``;
                    if (r["類型"] === "禽王") iconHtml = `<i class="fas fa-crown" style="color:var(--raptor); font-size:2rem; float:right;"></i>`;
                    else if (r["類型"] === "鳥王") iconHtml = `<i class="fas fa-crown" style="color:var(--birdie); font-size:2rem; float:right;"></i>`;
                    else if (r["類型"] === "蛋王") iconHtml = `<i class="fas fa-crown" style="color:var(--egg); font-size:2rem; float:right;"></i>`;
                    else if (r["類型"] === "追分王") iconHtml = `<i class="fas fa-bolt" style="color:gold; font-size:2rem; float:right;"></i>`;

                    html += `
                    <div class="card" style="padding:1.5rem; text-align:left; border-left: 4px solid var(--primary);">
                        ${iconHtml}
                        <h3 style="color:var(--text-dim); margin-bottom:1rem; font-size:1.5rem;">${r["類型"]}</h3>
                        <div style="font-size:1.8rem; font-weight:bold; color:white; margin-bottom:0.5rem;">${r["姓名"]}</div>
                        ${r["備註"] ? `<div style="color:var(--accent); font-size:1.1rem;"><i class="fas fa-info-circle"></i> ${r["備註"]}</div>` : ''}
                    </div>
                    `;
                });
                container.innerHTML = html;
            }
        } catch(e) {
            container.innerHTML = "<div style='text-align:center;'>載入錯誤</div>";
        }
    }
};
