const Referee = {
    matches: [],
    currentMatch: null,
    actualStartTime: null,
    clockInterval: null,
    wakeLock: null,

    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
            } catch (err) {
                console.error('Wake Lock error:', err);
            }
        }
    },

    releaseWakeLock() {
        if (this.wakeLock !== null) {
            this.wakeLock.release().then(() => {
                this.wakeLock = null;
            });
        }
    },
    async load() {
        const res = await API.getSchedule();
        if (res && res.status === "success") {
            this.matches = res.data || [];
            this.populateSelects();
            if (!this.clockInterval) this.startClock();
        }
    },

    startClock() {
        this.clockInterval = setInterval(() => {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const clockEl = document.getElementById("current-time");
            if (clockEl) clockEl.textContent = `${hours}:${minutes}:${seconds}`;
        }, 1000);
    },

    populateSelects() {
        const selectMatch = document.getElementById("select-match");
        let html = "<option value=''>-- 請選擇比賽 (輪次, 區, 場地, 隊名-人員) --</option>";
        
        this.matches.forEach((m, idx) => {
            const statusStr = m.比賽狀態 ? ` [${m.比賽狀態}]` : "";
            const label = `第${m.輪次}輪, ${m.區}, 場地${m.場地}, ${m.A隊名}(${m.A隊員1},${m.A隊員2}) vs ${m.B隊名}(${m.B隊員1},${m.B隊員2})${statusStr}`;
            html += `<option value="${idx}">${label}</option>`;
        });
        selectMatch.innerHTML = html;
        
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
            this.releaseWakeLock();
            return;
        }

        const match = this.matches[parseInt(idx)];
        if (!match) return;

        this.currentMatch = { ...match };
        this.requestWakeLock();
        
        // 修正顯示邏輯：
        // 1. 如果是「待賽」狀態，代表尚未正式開賽，顯示 -- : --
        // 2. 如果是「進行中」或「已完賽」，則讀取紀錄中的時間
        const status = this.currentMatch.比賽狀態 || "待賽";
        const existingTime = String(this.currentMatch.比賽時間 || "");
        
        if (status === "待賽") {
            this.actualStartTime = null;
        } else {
            this.actualStartTime = existingTime.includes(":") ? existingTime : null;
        }
        
        const startEl = document.getElementById("actual-start-time");
        if (startEl) startEl.textContent = this.actualStartTime || "-- : --";

        this.renderScoreboard();
    },

    renderScoreboard() {
        const scoreboard = document.getElementById("scoreboard");
        scoreboard.classList.remove("hidden");
        
        const colorA = CONFIG.TEAM_COLORS[this.currentMatch.A隊名] || "#333";
        const colorB = CONFIG.TEAM_COLORS[this.currentMatch.B隊名] || "#333";

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

    swapSides() {
        const container = document.getElementById("score-row-container");
        container.classList.toggle("swap-sides");
    },

    adjustColor(hex, amt) {
        let usePound = false;
        if (hex[0] == "#") { hex = hex.slice(1); usePound = true; }
        let num = parseInt(hex, 16);
        let r = (num >> 16) + amt; if (r > 255) r = 255; else if (r < 0) r = 0;
        let b = ((num >> 8) & 0x00FF) + amt; if (b > 255) b = 255; else if (b < 0) b = 0;
        let g = (num & 0x0000FF) + amt; if (g > 255) g = 255; else if (g < 0) g = 0;
        return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16);
    },

    syncTimer: null,

    changeScore(team, delta) {
        if (!this.currentMatch) return;
        
        // 判定開賽時間：雙方皆為 0 且有人得分增加時觸發
        if (this.currentMatch.A隊比分 === 0 && this.currentMatch.B隊比分 === 0 && delta > 0) {
            if (!this.actualStartTime) {
                const now = new Date();
                const hh = String(now.getHours()).padStart(2, '0');
                const mm = String(now.getMinutes()).padStart(2, '0');
                this.actualStartTime = `${hh}:${mm}`;
                document.getElementById("actual-start-time").textContent = this.actualStartTime;
                console.log("[紀錄] 比賽正式開始:", this.actualStartTime);
            }
        }

        const scoreElem = document.getElementById(`ref-score-${team.toLowerCase()}`);
        let currentScore = parseInt(scoreElem.innerText);
        currentScore = Math.max(0, currentScore + delta);
        scoreElem.innerText = currentScore;
        
        if (team === 'A') this.currentMatch.A隊比分 = currentScore;
        else this.currentMatch.B隊比分 = currentScore;

        if (this.syncTimer) clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => this.syncScoreToServer("進行中"), 1000);
    },

    async syncScoreToServer(status) {
        if (!this.currentMatch) return;
        
        const dateEl = document.getElementById("current-date");
        const dateStr = dateEl ? dateEl.value : CONFIG.DEFAULT_DATE;
        const data = {
            yearMonth: dateStr,
            round: this.currentMatch.輪次,
            court: this.currentMatch.場地,
            scoreA: this.currentMatch.A隊比分,
            scoreB: this.currentMatch.B隊比分,
            startTime: this.actualStartTime, // 傳送開賽時間
            referee: document.getElementById("ref-name").value.trim() || undefined,
            status: status
        };

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
        this.releaseWakeLock();
        this.load();
    }
};

window.changeScore = (team, delta) => Referee.changeScore(team, delta);
window.swapSides = () => Referee.swapSides();
document.getElementById("select-match").addEventListener("change", () => Referee.loadMatch());
document.getElementById("btn-submit-score").addEventListener("click", () => Referee.submitScore());
Referee.load();
