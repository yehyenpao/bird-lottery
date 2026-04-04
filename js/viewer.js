const Viewer = {
    async loadSchedule() {
        const rrContainer = document.getElementById("v-rr-list-container");
        const chasingContainer = document.getElementById("v-chasing-list-container");
        
        if (!rrContainer || !chasingContainer) return;

        rrContainer.innerHTML = "<div style='text-align:center; padding: 2rem; width: 100%;'><i class='fas fa-spinner fa-spin fa-2x'></i><br>載入中...</div>";
        chasingContainer.innerHTML = "<div style='text-align:center; padding: 2rem; width: 100%;'><i class='fas fa-spinner fa-spin fa-2x'></i><br>載入中...</div>";

        try {
            const rrData = await API.getSchedule();
            const chData = await API.getChasingSchedule();
            
            // 渲染循環賽 (Cards)
            if (rrData && rrData.data) {
                rrContainer.innerHTML = "";
                if (rrData.data.length === 0) {
                    rrContainer.innerHTML = "<div class='card' style='text-align:center; width:100%;'>目前尚無賽程資料</div>";
                } else {
                    rrData.data.forEach(m => {
                        const status = m["比賽狀態"] || "待賽";
                        const isDone = status.includes("完賽");
                        const isLive = status.includes("進行中");
                        const statusHtml = isDone ? `<span class="status-badge status-done">已完賽</span>` : (isLive ? `<span class="status-badge status-live" style="background:#ff4757; color:white; animation: pulse 1.5s infinite;">即時比分</span>` : `<span class="status-badge status-pending">${status}</span>`);
                        
                        // User requested to show scores even if not finished
                        const aScore = m["A隊比分"] || 0;
                        const bScore = m["B隊比分"] || 0;
                        
                        rrContainer.innerHTML += `
                            <div class="card match-card" style="padding: 1.2rem; border-left: 4px solid var(--primary);">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.8rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                    <span style="color:var(--text-dim); font-size: 0.9rem;"><i class="far fa-clock"></i> ${m["比賽時間"] || ""}</span>
                                    <span style="color:var(--primary); font-weight:bold;">序號: ${m["序號"] || ""}</span>
                                    ${statusHtml}
                                </div>
                                <div style="color: var(--raptor); font-size: 0.85rem; margin-bottom:0.5rem;">
                                    第 ${m["輪次"]} 輪 - ${m["區"]} (${m["場地"]}場)
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; gap: 10px;">
                                    <div style="text-align:center; flex:1;">
                                        <div style="font-weight:bold; font-size:1.1rem; color:white;">${m["A隊名"] || ""}</div>
                                        <small style="color:var(--text-dim);">${m["A隊員1"] || ""}, ${m["A隊員2"] || ""}</small>
                                    </div>
                                    <div style="font-size:1.8rem; font-weight:bold; color:var(--accent); min-width: 80px; text-align:center; padding: 5px 10px; background:rgba(0,0,0,0.3); border-radius:8px;">
                                        ${aScore} : ${bScore}
                                    </div>
                                    <div style="text-align:center; flex:1;">
                                        <div style="font-weight:bold; font-size:1.1rem; color:white;">${m["B隊名"] || ""}</div>
                                        <small style="color:var(--text-dim);">${m["B隊員1"] || ""}, ${m["B隊員2"] || ""}</small>
                                    </div>
                                </div>
                                ${m["裁判"] ? `<div style="text-align:right; margin-top:0.8rem; font-size:0.85rem; color:var(--text-dim); border-top: 1px dashed rgba(255,255,255,0.05); padding-top:0.5rem;">裁判: ${m["裁判"]}</div>` : ''}
                            </div>
                        `;
                    });
                }
            }

            // 渲染追分賽與冠軍戰 (Cards)
            if (chData && chData.data) {
                chasingContainer.innerHTML = "";
                if (chData.data.length === 0) {
                    chasingContainer.innerHTML = "<div class='card' style='text-align:center; width:100%;'>目前尚無追分賽資料</div>";
                } else {
                    chData.data.forEach(m => {
                        const status = m["比賽狀態"] || "待賽";
                        const isDone = status.includes("完賽");
                        const isLive = status.includes("進行中");
                        const statusHtml = isDone ? `<span class="status-badge status-done">已完賽</span>` : (isLive ? `<span class="status-badge status-live" style="background:#ff4757; color:white; animation: pulse 1.5s infinite;">即時比分</span>` : `<span class="status-badge status-pending">${status}</span>`);
                        
                        const aScore = m["A隊比分"] || 0;
                        const bScore = m["B隊比分"] || 0;
                        
                        chasingContainer.innerHTML += `
                            <div class="card match-card" style="padding: 1.2rem; border-left: 4px solid var(--accent);">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.8rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                    <span style="color:var(--accent); font-weight:bold;">${m["區"] || ""}</span>
                                    ${statusHtml}
                                </div>
                                <div style="color: var(--text-dim); font-size: 0.85rem; margin-bottom:0.5rem;">
                                    ${m["輪次"] || ""} - ${m["場地"]}場
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; gap: 10px;">
                                    <div style="text-align:center; flex:1;">
                                        <div style="font-weight:bold; font-size:1.1rem; color:white;">${m["A隊名"] || ""}</div>
                                        <small style="color:var(--text-dim);">${[m["A隊員1"], m["A隊員2"], m["A隊員3"]].filter(p => p && p !== "待定").join(", ")}</small>
                                    </div>
                                    <div style="font-size:1.8rem; font-weight:bold; color:var(--accent); min-width: 80px; text-align:center; padding: 5px 10px; background:rgba(0,0,0,0.3); border-radius:8px;">
                                        ${aScore} : ${bScore}
                                    </div>
                                    <div style="text-align:center; flex:1;">
                                        <div style="font-weight:bold; font-size:1.1rem; color:white;">${m["B隊名"] || ""}</div>
                                        <small style="color:var(--text-dim);">${[m["B隊員1"], m["B隊員2"], m["B隊員3"]].filter(p => p && p !== "待定").join(", ")}</small>
                                    </div>
                                </div>
                                ${m["裁判"] ? `<div style="text-align:right; margin-top:0.8rem; font-size:0.85rem; color:var(--text-dim); border-top: 1px dashed rgba(255,255,255,0.05); padding-top:0.5rem;">裁判: ${m["裁判"]}</div>` : ''}
                            </div>
                        `;
                    });
                }
            }
        } catch(e) {
            if(rrContainer) rrContainer.innerHTML = "<div class='card' style='color:red;'>載入失敗</div>";
            if(chasingContainer) chasingContainer.innerHTML = "<div class='card' style='color:red;'>載入失敗</div>";
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
            const rrData = await API.getSchedule("");
            const chData = await API.getChasingSchedule("");
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
                const isTeamA = (m["A隊員1"] === query || m["A隊員2"] === query || m["A隊員3"] === query || aName === query);
                
                // Highlight the user's team
                const queryAStyle = isTeamA ? "color:var(--accent); font-weight:bold;" : "";
                const queryBStyle = !isTeamA ? "color:var(--accent); font-weight:bold;" : "";

                html += `
                <div class="card" style="padding:1rem;">
                    <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:0.5rem; margin-bottom:0.5rem;">
                        <span style="color:var(--primary);"><i class="far fa-calendar-alt"></i> ${m["年月"] || ""} | ${m.MatchType} - ${m["輪次"]}</span>
                        <span class="status-badge ${isDone ? 'status-done' : 'status-pending'}">${status}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="text-align:center; flex:1; ${queryAStyle}">
                            <div>${aName}</div>
                            <small>${[m["A隊員1"], m["A隊員2"], m["A隊員3"]].filter(p => p && p !== "待定").join(", ")}</small>
                        </div>
                        <div style="padding: 0 1rem; font-size:1.5rem; font-weight:bold;">
                            ${m["A隊比分"]||0} - ${m["B隊比分"]||0}
                        </div>
                        <div style="text-align:center; flex:1; ${queryBStyle}">
                            <div>${bName}</div>
                            <small>${[m["B隊員1"], m["B隊員2"], m["B隊員3"]].filter(p => p && p !== "待定").join(", ")}</small>
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
        const grid = document.getElementById("v-points-grid");
        if (!grid) return;
        
        // 使用 Skeleton Loading 佔位符
        grid.innerHTML = Array(6).fill(0).map(() => `
            <div class="rank-card" style="opacity: 0.3; filter: grayscale(1);">
                <div class="avatar-circle" style="background: #334155;"></div>
                <div class="rank-info">
                    <div style="height: 20px; width: 100px; background: #334155; border-radius: 4px; margin-bottom: 8px;"></div>
                    <div style="height: 14px; width: 150px; background: #334155; border-radius: 4px;"></div>
                </div>
            </div>
        `).join("");
        
        try {
            // 並發請求：抓取本期存檔積分、與球員照片 Mapping (改用 getPointsRecords，不重新計算，速度極快)
            const [ptsRes, infoRes] = await Promise.all([
                API.getPointsRecords(),
                API.getPlayersInfo()
            ]);

            if (ptsRes && ptsRes.data) {
                grid.innerHTML = "";
                const photoMap = (infoRes && infoRes.status === "success") ? infoRes.data : {};
                const defaultAvatar = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzY0NzQ4YiI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==";

                const topPlayers = ptsRes.data.slice(0, 60);
                if (topPlayers.length === 0) {
                    grid.innerHTML = "<div class='card' style='grid-column: 1 / -1; text-align:center;'>尚未執行月結統計，目前暫無資料</div>";
                    return;
                }

                // 效能優化：分批渲染 (Batch Rendering)
                const BATCH_SIZE = 15;
                let renderedCount = 0;

                const renderBatch = () => {
                    const nextBatch = topPlayers.slice(renderedCount, renderedCount + BATCH_SIZE);
                    let htmlList = "";
                    
                    nextBatch.forEach((p, index) => {
                        const actualIdx = renderedCount + index;
                        const rankNum = actualIdx + 1; // 簡化排名邏輯，加速渲染
                        
                        const rankClass = rankNum <= 3 ? `rank-${rankNum}` : "";
                        const badgeHtml = rankNum <= 3 
                            ? `<div class="rank-number"><i class="fas fa-crown" style="margin-right:4px;"></i> NO.${rankNum}</div>` 
                            : `<div class="rank-number" style="background:rgba(255,255,255,0.1);">NO.${rankNum}</div>`;
                        
                        let avatarUrl = photoMap[p.name] || defaultAvatar;
                        if (avatarUrl.includes("drive.google.com/uc?export=view&id=")) {
                            const fileId = avatarUrl.split("id=")[1];
                            avatarUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
                        }

                        htmlList += `
                            <div class="rank-card ${rankClass} animate-fadeIn">
                                ${badgeHtml}
                                <img src="${avatarUrl}" class="avatar-circle" loading="lazy" alt="${p.name}">
                                <div class="rank-info">
                                    <h3>${p.name}</h3>
                                    <p>${p.team || "自由球員"} | ${p.area || "未分區"}</p>
                                </div>
                                <div class="rank-score">${p.totalPts}</div>
                            </div>
                        `;
                    });

                    const tempDiv = document.createElement("div");
                    tempDiv.innerHTML = htmlList;
                    while (tempDiv.firstChild) {
                        grid.appendChild(tempDiv.firstChild);
                    }

                    renderedCount += BATCH_SIZE;
                    if (renderedCount < topPlayers.length) {
                        requestAnimationFrame(renderBatch); // 讓瀏覽器在下一幀空檔繼續畫
                    }
                };

                renderBatch();
            }
        } catch(e) {
            console.error(e);
            grid.innerHTML = "<div class='card' style='grid-column: 1 / -1; text-align:center; color:red;'>讀取失敗，請稍後再試</div>";
        }
    },

    async loadSpecial() {
        const container = document.getElementById("v-special-container");
        if (!container) return;
        container.innerHTML = "<div style='text-align:center;'>載入中...</div>";

        try {
            const res = await API.getSpecialRecords();
            if (res && res.data) {
                const currentYM = document.getElementById("current-date").value;
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
