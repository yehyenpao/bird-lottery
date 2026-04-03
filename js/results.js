const Results = {
    async load() {
        const res = await API.getSchedule();
        if (res && res.status === "success") {
            const data = res.data || [];
            this.calculateAndRender(data);
        }
    },

    calculateAndRender(matches) {
        // 1. 初始化隊伍統計物件
        const stats = {};
        CONFIG.TEAMS.forEach(team => {
            stats[team] = {
                teamName: team,
                matchWins: 0,
                matchLosses: 0,
                totalPoints: 0,
                totalScored: 0,
                totalConceded: 0,
                roundWins: 0,
                roundLosses: 0,
                diff: 0,
                quotient: 0,
                rank: 0
            };
        });

        // 2. 按輪次分組
        const roundGroups = {};
        const h2hWins = {}; // 對戰勝場矩陣
        const clean = (s) => String(s || "").replace(/\s+/g, "").trim();
        
        CONFIG.TEAMS.forEach(t1 => {
            const c1 = clean(t1);
            h2hWins[c1] = {};
            CONFIG.TEAMS.forEach(t2 => h2hWins[c1][clean(t2)] = 0);
        });

        matches.forEach(m => {
            if (!m.輪次) return;
            const rid = m.輪次;
            if (!roundGroups[rid]) roundGroups[rid] = [];
            roundGroups[rid].push(m);
        });

        // 3. 處理每一輪的積分與勝負
        Object.keys(roundGroups).forEach(rid => {
            const group = roundGroups[rid];
            const teamA = clean(group[0].A隊名);
            const teamB = clean(group[0].B隊名);

            if (!stats[teamA] || !stats[teamB]) return;

            let aWins = 0;
            let bWins = 0;

            group.forEach(m => {
                const sA = parseInt(m.A隊比分 || 0);
                const sB = parseInt(m.B隊比分 || 0);

                stats[teamA].totalScored += sA;
                stats[teamA].totalConceded += sB;
                stats[teamB].totalScored += sB;
                stats[teamB].totalConceded += sA;

                if (sA > sB) {
                    aWins++;
                    stats[teamA].matchWins++;
                    stats[teamB].matchLosses++;
                    h2hWins[teamA][teamB]++;
                } else if (sB > sA) {
                    bWins++;
                    stats[teamB].matchWins++;
                    stats[teamA].matchLosses++;
                    h2hWins[teamB][teamA]++;
                }
            });

            if (aWins > bWins) {
                stats[teamA].totalPoints += 3;
                stats[teamA].roundWins += 1;
                stats[teamB].totalPoints += 1;
                stats[teamB].roundLosses += 1;
            } else if (bWins > aWins) {
                stats[teamB].totalPoints += 3;
                stats[teamB].roundWins += 1;
                stats[teamA].totalPoints += 1;
                stats[teamA].roundLosses += 1;
            }
        });

        // 5. 計算勝負差與正負商
        const resultList = Object.values(stats).map(s => {
            s.diff = s.totalScored - s.totalConceded;
            s.quotient = s.totalConceded === 0 ? s.totalScored : (s.totalScored / s.totalConceded);
            return s;
        });

        // 6. 排序邏輯：積分 > 對戰勝場 > 正負商
        resultList.sort((a, b) => {
            const nameA = clean(a.teamName);
            const nameB = clean(b.teamName);

            // Stage 1: 積分
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;

            // Stage 2: 對戰勝場 (Head-to-Head)
            const winsA = h2hWins[nameA][nameB] || 0;
            const winsB = h2hWins[nameB][nameA] || 0;
            if (winsA !== winsB) return winsB - winsA;

            // Stage 3: 正負商
            return b.quotient - a.quotient;
        });

        // 分配排序編號
        resultList.forEach((s, i) => s.rank = i + 1);

        this.renderTable(resultList);
    },

    renderTable(list) {
        const tbody = document.getElementById("results-tbody");
        let html = "";
        
        list.forEach(s => {
            const rankClass = s.rank <= 3 ? `rank-${s.rank}` : "";
            html += `
                <tr class="${rankClass}">
                    <td><strong>${s.rank}</strong></td>
                    <td>${s.teamName}</td>
                    <td>${s.matchWins}</td>
                    <td>${s.matchLosses}</td>
                    <td><span class="badge-points">${s.totalPoints}</span></td>
                    <td>${s.totalScored}</td>
                    <td>${s.totalConceded}</td>
                    <td>${s.diff > 0 ? '+' : ''}${s.diff}</td>
                    <td>${s.quotient.toFixed(3)}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }
};

// 監聽分頁切換以重新整理數據
document.addEventListener("tabChanged", (e) => {
    if (e.detail.tabId === "results") {
        Results.load();
    }
});
