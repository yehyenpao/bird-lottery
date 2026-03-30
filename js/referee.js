const Referee = {
    matches: [],
    currentMatch: null,

    async load() {
        const res = await API.getSchedule();
        if (res && res.status === "success") {
            this.matches = res.data || [];
            this.populateSelects();
        }
    },

    populateSelects() {
        const selectMatch = document.getElementById("select-match");
        let html = "<option value=''>-- 請選擇比賽 (輪次, 區, 場地, 隊名-人員) --</option>";
        
        this.matches.forEach((m, idx) => {
            // 格式: 輪次, 區, 場地, A隊 (隊員1,2), B隊 (隊員1,2) [狀態]
            const statusStr = m.比賽狀態 ? ` [${m.比賽狀態}]` : "";
            const label = `第${m.輪次}輪, ${m.區}, 場地${m.場地}, ${m.A隊名}(${m.A隊員1},${m.A隊員2}) vs ${m.B隊名}(${m.B隊員1},${m.B隊員2})${statusStr}`;
            html += `<option value="${idx}">${label}</option>`;
        });
        selectMatch.innerHTML = html;
        
        // 如果原本就有選中的比賽，重新選擇 (用於 Load 之後)
        if (this.currentMatch) {
            const currentIdx = this.matches.findIndex(m => 
                m.輪次 == this.currentMatch.輪次 && m.場地 == this.currentMatch.場地
            );
            if (currentIdx > -1) selectMatch.value = currentIdx;
        }
    },

    loadMatch() {
        const idx = document.getElementById("select-match").value;
        const scoreboard = document.getElementById("scoreboard");

        if (idx === "") {
            this.currentMatch = null;
            scoreboard.classList.add("hidden");
            return;
        }

        const match = this.matches[parseInt(idx)];
        if (!match) return;

        this.currentMatch = { ...match }; // 淺拷貝以供計分使用
        this.renderScoreboard();
    },

    renderScoreboard() {
        const scoreboard = document.getElementById("scoreboard");
        const container = document.getElementById("score-row-container");
        scoreboard.classList.remove("hidden");
        
        // 取得 A/B 隊背景色
        const colorA = CONFIG.TEAM_COLORS[this.currentMatch.A隊名] || "#333";
        const colorB = CONFIG.TEAM_COLORS[this.currentMatch.B隊名] || "#333";

        // 動態設定背景色 (使用深色漸層確保文字清晰)
        const boxA = document.getElementById("score-box-a");
        const boxB = document.getElementById("score-box-b");
        
        boxA.style.background = `linear-gradient(135deg, ${colorA}, ${this.adjustColor(colorA, -40)})`;
        boxB.style.background = `linear-gradient(135deg, ${colorB}, ${this.adjustColor(colorB, -40)})`;

        document.getElementById("ref-team-a-name").innerText = this.currentMatch.A隊名;
        document.getElementById("ref-team-a-players").innerText = `${this.currentMatch.A隊員1} / ${this.currentMatch.A隊員2}`;
        document.getElementById("ref-score-a").innerText = this.currentMatch.A隊比分;

        document.getElementById("ref-team-b-name").innerText = this.currentMatch.B隊名;
        document.getElementById("ref-team-b-players").innerText = `${this.currentMatch.B隊員1} / ${this.currentMatch.B隊員2}`;
        document.getElementById("ref-score-b").innerText = this.currentMatch.B隊比分;

        document.getElementById("ref-name").value = this.currentMatch.裁判 || "";
    },

    // 換邊功能：僅切換 CSS 類別，不影響內部 A/B 資料邏輯
    swapSides() {
        const container = document.getElementById("score-row-container");
        container.classList.toggle("swap-sides");
        console.log("[系統] 交換場地顯示。");
    },

    // 輔助函式：微調顏色亮度用
    adjustColor(hex, amt) {
        let usePound = false;
        if (hex[0] == "#") {
            hex = hex.slice(1);
            usePound = true;
        }
        let num = parseInt(hex, 16);
        let r = (num >> 16) + amt;
        if (r > 255) r = 255; else if (r < 0) r = 0;
        let b = ((num >> 8) & 0x00FF) + amt;
        if (b > 255) b = 255; else if (b < 0) b = 0;
        let g = (num & 0x0000FF) + amt;
        if (g > 255) g = 255; else if (g < 0) g = 0;
        return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16);
    },

    syncTimer: null,

    changeScore(team, delta) {
        if (!this.currentMatch) return;
        const scoreElem = document.getElementById(`ref-score-${team.toLowerCase()}`);
        let currentScore = parseInt(scoreElem.innerText);
        currentScore = Math.max(0, currentScore + delta);
        scoreElem.innerText = currentScore;
        
        // 同步到目前物件
        if (team === 'A') this.currentMatch.A隊比分 = currentScore;
        else this.currentMatch.B隊比分 = currentScore;

        // 即時存入 logic: 使用 debounce 避免過於頻繁的 API 請求
        if (this.syncTimer) clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => this.syncScoreToServer("進行中"), 1000);
    },

    async syncScoreToServer(status) {
        if (!this.currentMatch) return;
        
        const data = {
            yearMonth: CONFIG.YEAR_MONTH,
            round: this.currentMatch.輪次,
            court: this.currentMatch.場地,
            scoreA: this.currentMatch.A隊比分,
            scoreB: this.currentMatch.B隊比分,
            referee: document.getElementById("ref-name").value.trim() || undefined,
            status: status
        };

        console.log(`[同步] 比分更新至雲端 (${status})...`, data);
        await API.updateScore(data);
    },

    async submitScore() {
        if (!this.currentMatch) return;
        
        const referee = document.getElementById("ref-name").value.trim();
        if (!referee) return alert("請輸入裁判姓名後再結束比賽");

        if (!confirm("確定要結束這場比賽嗎？結束後狀態將改為 [已完賽]")) return;

        await this.syncScoreToServer("已完賽");
        
        alert("比賽已正式結束！比分將以此結果列入積分計算。");
        this.currentMatch = null;
        document.getElementById("scoreboard").classList.add("hidden");
        document.getElementById("select-match").value = "";
        this.load();
    }
};

// 暴露全域函式供 HTML 按鈕使用
window.changeScore = (team, delta) => Referee.changeScore(team, delta);

// 綁定事件
document.getElementById("select-match").addEventListener("change", () => Referee.loadMatch());
document.getElementById("btn-submit-score").addEventListener("click", () => Referee.submitScore());
