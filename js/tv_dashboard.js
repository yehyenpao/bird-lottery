const TVDashboard = {
    carousels: ['tv-slide-stats', 'tv-slide-finals', 'tv-slide-registration'],
    currentCarouselIdx: 0,
    scrollInterval: null,
    refreshInterval: null,
    carouselInterval: null,
    targetDate: null,

    async init() {
        console.log("TV Dashboard: Init started...");
        
        if (!window.logDebug) window.logDebug = function(msg) { console.log("[DEBUG]", msg); };

        // 1. 先獲取最新日期
        try {
            const res = await API.call("getLatestDate");
            if (res && res.status === "success" && res.data) {
                this.targetDate = res.data;
                console.log("TV Dashboard: Latest date found:", this.targetDate);
                
                // 更新標題顯示日期
                document.querySelectorAll('.tv-title').forEach(title => {
                    const icon = title.querySelector('i');
                    const text = title.textContent.trim();
                    title.innerHTML = `${icon ? icon.outerHTML : ''} ${text} (${this.targetDate})`;
                });
            }
        } catch (e) {
            console.error("TV Dashboard: Failed to fetch latest date:", e);
        }

        // 2. 如果還是沒日期，預設為本月 yyyy-mm
        if (!this.targetDate) {
            this.targetDate = new Date().toLocaleDateString('sv').substring(0, 7);
        }

        // 3. 執行第一次載入
        await this.loadData();
        
        // 4. 啟動循環機制
        this.startCarousel();
        this.startAutoRefresh();
        this.startAutoScroll();
    },

    async loadData() {
        const dateToUse = this.targetDate;
        console.log("TV Dashboard: Loading data for", dateToUse);
        try {
            const [scheduleRes, chasingRes, rankingsRes, regRes] = await Promise.all([
                API.getSchedule(dateToUse),
                API.getChasingSchedule(dateToUse),
                API.getRankings(dateToUse),
                API.getRegistrations(dateToUse)
            ]);
            
            const matches = (scheduleRes && scheduleRes.status === "success") ? (scheduleRes.data || []) : [];
            const chasingMatches = (chasingRes && chasingRes.status === "success") ? (chasingRes.data || []) : [];
            const rankings = (rankingsRes && rankingsRes.status === "success") ? (rankingsRes.data || []) : [];
            const regData = (regRes && regRes.status === "success") ? (regRes.data || []) : [];

            this.renderSchedule(matches);
            this.renderStats(rankings);
            this.renderLiveScores(matches.concat(chasingMatches));
            this.renderFinals(chasingMatches);
            this.renderRegistration(regData);
            
        } catch (err) {
            console.error("TV Dashboard 載入資料失敗:", err);
        }
    },

    renderSchedule(matches) {
        const tbody = document.getElementById("tv-schedule-tbody");
        if (!tbody) return;

        let html = "";
        matches.forEach(m => {
            const time = m["比賽時間"] || "";
            const status = m["比賽狀態"] || "待賽";
            let statusStyle = "";
            if (status === "進行中") statusStyle = "color: #ef4444; font-weight:bold; text-shadow: 0 0 5px rgba(239,68,68,0.5);";
            else if (status === "已完賽") statusStyle = "color: #10b981;";

            const playersA = [m["A隊員1"], m["A隊員2"], m["A隊員3"]].filter(p => p && p !== "待定").join(", ");
            const playersB = [m["B隊員1"], m["B隊員2"], m["B隊員3"]].filter(p => p && p !== "待定").join(", ");

            html += `
                <tr style="border-bottom:1px solid #334155; background: rgba(0,0,0,0.1);">
                    <td style="font-size:0.9rem;">${this.escapeHtml(time)}</td>
                    <td>
                        <div style="color:var(--accent); font-weight:bold;">${m["序號"] || ""}</div>
                        <div style="font-size:0.8rem; color:var(--text-dim);">第${m["輪次"] || ""}輪</div>
                    </td>
                    <td>
                        <div style="font-weight:bold;">${m["區"] || ""}</div>
                        <div style="font-size:0.8rem; color:var(--text-dim);">${m["場地"] || ""}場</div>
                    </td>
                    <td style="text-align:right; padding-right:4px;">
                        <div style="font-weight:bold; color:#fff;">${m["A隊名"]}</div>
                        <div style="font-size:0.8rem; color:var(--text-dim);">${playersA}</div>
                    </td>
                    <td style="text-align:center; font-weight:bold; color:var(--accent); font-size:0.9rem;">${m["A隊比分"] || 0} : ${m["B隊比分"] || 0}</td>
                    <td style="text-align:left; padding-left:4px;">
                        <div style="font-weight:bold; color:#fff;">${m["B隊名"]}</div>
                        <div style="font-size:0.8rem; color:var(--text-dim);">${playersB}</div>
                    </td>
                    <td style="${statusStyle}; font-size:0.9rem;">${status}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        
        // Reset scroll when data reloads
        this.resetScroll();
    },

    renderStats(list) {
        const tbody = document.getElementById("tv-stats-tbody");
        if (!tbody) return;

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td style="text-align:center; padding: 2rem; color:#94a3b8;">尚無統計資料</td></tr>`;
            return;
        }

        // 隊伍與圖片對照表
        const birdImgMap = {
            "藍鳥隊": "img/bird_blue.jpg",
            "黑鳥隊": "img/bird_black.jpg",
            "青鳥隊": "img/bird_cyan.jpg",
            "粉鳥隊": "img/bird_pink.jpg"
        };

        const createRow = (label, values, isHeader = false) => {
            const bg = isHeader ? "background:#cbd5e1; font-weight:900;" : "background:#f1f5f9;";
            const color = "color:#0f172a;";
            let rowHtml = `<tr style="border-bottom:1px solid #94a3b8; ${bg} ${color}">`;
            rowHtml += `<td style="font-weight:bold; width:100px; border-right:1px solid #94a3b8;">${label}</td>`;
            
            values.forEach((v, idx) => {
                let cellContent = v;
                if (isHeader) {
                    // 如果是隊名行，加上對應的小鳥圖片
                    const teamName = v;
                    const imgPath = birdImgMap[teamName];
                    if (imgPath) {
                        cellContent = `
                            <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                                <img src="${imgPath}" style="height:35px; width:auto; border-radius:4px; margin-bottom:2px;">
                                <span>${teamName}</span>
                            </div>
                        `;
                    }
                }
                rowHtml += `<td style="text-align:center; border-right:1px solid #94a3b8;">${cellContent}</td>`;
            });
            rowHtml += `</tr>`;
            return rowHtml;
        };

        const names = list.map(t => t.name);
        const wins = list.map(t => t.wins || 0);
        const losses = list.map(t => (t.matches || 0) - (t.wins || 0));
        const scored = list.map(t => t.scored || 0);
        const conceded = list.map(t => t.conceded || 0);
        const diffs = list.map(t => {
            const d = (t.scored || 0) - (t.conceded || 0);
            return d > 0 ? '+'+d : d;
        });
        const points = list.map(t => t.points || 0);
        const ranks = list.map((_, i) => i + 1);

        let html = "";
        html += createRow("隊名", names, true);
        html += createRow("勝場", wins);
        html += createRow("敗場", losses);
        html += createRow("總得分", scored);
        html += createRow("總失分", conceded);
        html += createRow("正負商", diffs);
        html += createRow("積分", points);
        html += createRow("排名", ranks);

        tbody.innerHTML = html;
        const table = document.getElementById("tv-stats-table");
        if (table) {
            table.style.tableLayout = "auto";
            table.style.background = "#f1f5f9";
        }
    },

    renderLiveScores(matches) {
        const tbody = document.getElementById("tv-live-tbody");
        if (!tbody) return;

        const liveMatches = matches.filter(m => m["比賽狀態"] === "進行中");
        let html = "";

        if (liveMatches.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding: 2rem;">目前無進行中的比賽</td></tr>`;
            return;
        }

        liveMatches.forEach(m => {
            const cA = CONFIG.TEAM_COLORS[m["A隊名"]] || "#60a5fa"; 
            const cB = CONFIG.TEAM_COLORS[m["B隊名"]] || "#f87171"; 

            html += `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.1); background: rgba(59, 130, 246, 0.05);">
                    <td style="width: 20%; color: #94a3b8; font-weight:bold; font-size:0.8rem; padding: 2px 0;">${m["場地"] || ""}場 (${m["區"] || ""})</td>
                    <td style="width: 25%; text-align:right; font-weight:900; color:${cA}; font-size:0.9rem; padding: 2px 0;">${m["A隊名"]}</td>
                    <td style="width: 15%; text-align:center; font-size:1.2rem; font-weight:900; color:#fbbf24; text-shadow: 0 0 8px rgba(251,191,36,0.4); padding: 2px 0;">
                        ${m["A隊比分"] || 0} : ${m["B隊比分"] || 0}
                    </td>
                    <td style="width: 25%; text-align:left; font-weight:900; color:${cB}; font-size:0.9rem; padding: 2px 0;">${m["B隊名"]}</td>
                    <td style="width: 15%; color:#34d399; font-size:0.75rem; font-weight:bold; padding: 2px 0;"><i class="fas fa-user-check"></i> ${m["裁判"]||"無"}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    renderFinals(chasingMatches) {
        const tbody = document.getElementById("tv-finals-tbody");
        if (!tbody) return;

        if (chasingMatches.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding: 2rem;">決賽名單尚未產生或尚未進行</td></tr>`;
            return;
        }

        let html = "";
        chasingMatches.forEach(m => {
            const status = m["比賽狀態"] || "待賽";
            let statusStyle = "";
            let rowBg = "";
            if (status === "進行中") {
                statusStyle = "color: #f87171; font-weight:900; animation: pulse 2s infinite;";
                rowBg = "background: rgba(248, 113, 113, 0.05);";
            } else if (status === "已完賽") {
                statusStyle = "color: #34d399; font-weight:bold;";
            }

            html += `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05); ${rowBg}">
                    <td style="color:#f59e0b; font-weight:bold;">${m["區"] || ""}</td>
                    <td style="color:#94a3b8;">${m["場地"] || ""}場</td>
                    <td style="text-align:right; font-weight:bold; color:#fff;">${m["A隊名"] || "--"}</td>
                    <td style="text-align:center; font-weight:900; color:#fbbf24; font-size:1.1rem;">${m["A隊比分"]||0} : ${m["B隊比分"]||0}</td>
                    <td style="text-align:left; font-weight:bold; color:#fff;">${m["B隊名"] || "--"}</td>
                    <td style="${statusStyle}">${status}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    },

    renderRegistration(data) {
        const container = document.getElementById("tv-reg-container");
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 2rem; color:#94a3b8;">尚無報名資料</div>`;
            return;
        }

        // 動態偵測資料內的隊列與區域 (邏輯複刻自 registration.js)
        const dataTeams = [...new Set(data.map(p => String(p.隊名 || "").trim()).filter(t => t))];
        const dataAreas = [...new Set(data.map(p => String(p.區 || p.區別 || "").replace("區", "").trim()).filter(a => a))];
        
        const areas = dataAreas.length > 0 
            ? dataAreas 
            : CONFIG.AREAS.map(a => a.replace("區", ""));
            
        const teams = dataTeams.length > 0 
            ? dataTeams 
            : CONFIG.TEAMS;

        let html = `
            <table class="matrix-table">
                <thead>
                    <tr>
                        <th style="min-width: 80px;">隊名 \\ 區</th>
                        ${areas.map(area => `<th>${area}</th>`).join("")}
                    </tr>
                </thead>
                <tbody>
        `;

        teams.forEach(team => {
            const teamColor = CONFIG.TEAM_COLORS[team] || "#60a5fa";
            html += `<tr><td style="color: ${teamColor}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.1);">${team}</td>`;

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

        html += `</tbody></table>`;
        container.innerHTML = html;
    },

    startCarousel() {
        if (this.carouselInterval) clearInterval(this.carouselInterval);
        this.carouselInterval = setInterval(() => {
            document.getElementById(this.carousels[this.currentCarouselIdx]).classList.remove('active');
            this.currentCarouselIdx = (this.currentCarouselIdx + 1) % this.carousels.length;
            document.getElementById(this.carousels[this.currentCarouselIdx]).classList.add('active');
        }, 10000); // 10秒輪播
    },

    startAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => {
            console.log("TV Dashboard: 定時自動更新資料...");
            this.loadData();
        }, 15000); // 每15秒更新一次資料
    },

    startAutoScroll() {
        const wrap = document.getElementById('schedule-scroll-wrap');
        const content = document.getElementById('schedule-scroll-content');
        if(!wrap || !content) return;

        let scrollY = 0;
        const scrollSpeed = 0.6; // PX per tick

        if (this.scrollInterval) clearInterval(this.scrollInterval);
        
        this.scrollInterval = setInterval(() => {
            const wrapHeight = wrap.clientHeight;
            const contentHeight = content.clientHeight;
            
            if (contentHeight > wrapHeight) {
                scrollY -= scrollSpeed;
                
                // 增加底部緩衝，讓最後一列停留更久 (contentHeight - wrapHeight + 額外 100px)
                if (Math.abs(scrollY) >= (contentHeight - wrapHeight + 100)) {
                    scrollY = 150; // 重置到頂部並多留一些暫停時間 (透過正值判定)
                }
                
                // 如果是正值 (暫停在頂部階段)，顯示 Y 為 0
                const actualY = scrollY > 0 ? 0 : scrollY;
                content.style.transform = `translateY(${actualY}px)`;
            } else {
                content.style.transform = `translateY(0px)`;
            }
        }, 30);
    },

    resetScroll() {
        const content = document.getElementById('schedule-scroll-content');
        if (content) {
            content.style.transform = `translateY(0px)`;
            // startAutoScroll will pick it up and pause briefly if logic handles it
        }
    },

    escapeHtml(text) {
        return String(text ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }
};

window.onload = () => {
    TVDashboard.init();
};
