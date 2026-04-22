const LiveScore = {
    async load(silent = false) {
        if (!silent) {
            document.querySelector(".live-courts").innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 5rem 2rem;">
                    <i class="fas fa-spinner fa-spin fa-2x"></i><br>嘗試讀取即時比分中...
                </div>`;
        }
        const res = await API.getLiveScores();
        if (res && res.status === "success") {
            this.render(res.data);
        } else if (!silent) {
            this.render([]);
        }
    },

    render(data) {
        const activeMatches = (data || []).filter(m => m.比賽狀態 === "進行中");

        if (activeMatches.length === 0) {
            document.querySelector(".live-courts").innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 5rem 2rem; background: rgba(255,255,255,0.03); border: 2px dashed var(--border); border-radius: 24px;">
                    <i class="fas fa-satellite-dish animate-pulse" style="font-size: 3rem; color: var(--text-dim); margin-bottom: 1.5rem; display: block;"></i>
                    <h3 style="color: var(--text-dim);">目前尚無進行中的比賽</h3>
                    <p style="color: rgba(255,255,255,0.3); margin-top: 0.5rem;">當裁判開始計分時，此處會即時顯示轉播比分。</p>
                </div>`;
            return;
        }

        let html = "";
        activeMatches.forEach(match => {
            const court = match.場地 || "-";
            const areaName = (match.區 || match.區別 || "").replace("區", "");

            const playersA = [match.A隊員1, match.A隊員2, (match.A隊員3 || match["A隊員3"])].filter(p => p && p !== "待定").join(" / ");
            const playersB = [match.B隊員1, match.B隊員2, (match.B隊員3 || match["B隊員3"])].filter(p => p && p !== "待定").join(" / ");

            html += `
                <div class="court-card" id="court-${court.toLowerCase()}">
                    <div class="court-badge" style="background:${CONFIG.AREA_COLORS[areaName] || '#666'}">
                        場地 ${court} (${areaName})
                    </div>
                    <div class="match-info">${match.區 && match.區.includes("賽") ? "" : "第 " + match.輪次 + " 輪"}</div>
                    <div class="score-display">
                        <div class="team-a team">
                            <span class="team-name" style="color:${CONFIG.TEAM_COLORS[match.A隊名]}">${match.A隊名}</span>
                            <span class="players">${playersA}</span>
                            <span class="score">${match.A隊比分}</span>
                        </div>
                        <div class="vs">VS</div>
                        <div class="team-b team">
                            <span class="score">${match.B隊比分}</span>
                            <span class="team-name" style="color:${CONFIG.TEAM_COLORS[match.B隊名]}">${match.B隊名}</span>
                            <span class="players">${playersB}</span>
                        </div>
                    </div>
                    <div class="court-footer">
                        正在熱賽中... • 裁判: ${match.裁判 || "-"}
                    </div>
                </div>
            `;
        });

        document.querySelector(".live-courts").innerHTML = html;
    }
};

// 額外樣式
const lsStyle = document.createElement("style");
lsStyle.textContent = `
    .live-courts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
    }
    .court-card {
        background: var(--card-bg);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 1.5rem;
        text-align: center;
        position: relative;
        overflow: hidden;
    }
    .court-badge {
        position: absolute;
        top: 0; left: 0; right: 0;
        padding: 8px;
        font-weight: bold;
        color: #111;
        font-size: 0.9rem;
    }
    .match-info { margin-top: 1.5rem; color: var(--text-dim); }
    .score-display {
        display: flex;
        align-items: center;
        justify-content: space-around;
        margin: 1.5rem 0;
    }
    .team { display: flex; flex-direction: column; align-items: center; flex: 1; }
    .team-name { font-size: 1.2rem; font-weight: bold; margin-bottom: 4px; }
    .players { font-size: 0.75rem; color: var(--text-dim); height: 1.2rem; }
    .score { font-size: 3.5rem; font-weight: 800; margin-top: 5px; }
    .vs { font-style: italic; font-weight: bold; color: var(--accent); opacity: 0.5; }
`;
document.head.appendChild(lsStyle);
