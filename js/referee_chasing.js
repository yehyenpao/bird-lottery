const ChasingReferee = {
    currentMatch: null,
    scoreA: 0,
    scoreB: 0,
    isSwapped: false,
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
    async load(silent = false) {
        if (!silent && window.logDebug) window.logDebug("[CHASING] 正在載入追分/淘汰賽程...");
        
        // 抓取 UI 上的日期
        const dateEl = document.getElementById("current-date");
        const dateStr = dateEl ? dateEl.value : CONFIG.DEFAULT_DATE;
        
        const select = document.getElementById("chg-referee-select");
        if (!silent && select) select.innerHTML = '<option value="">正在載入資料...</option>';

        this.initClock();
        
        try {
            const res = await API.getChasingSchedule();
            if (res && res.status === "success") {
                const data = res.data || [];
                if (window.logDebug) window.logDebug(`[CHASING] 載入成功: ${data.length} 筆`);
                this.renderDropdown(data);
            }
        } catch (err) {
            if (window.logDebug) window.logDebug(`[CHASING] 載入錯誤: ${err.message}`);
        }

        const btnSave = document.getElementById("btn-chg-submit-score");
        if (btnSave) btnSave.onclick = () => this.finishMatch();
    },

    initClock() {
        if (this.clockInterval) clearInterval(this.clockInterval);
        this.clockInterval = setInterval(() => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false });
            const clockEl = document.getElementById("chg-current-time");
            if (clockEl) clockEl.innerText = timeStr;
        }, 1000);
    },

    renderDropdown(matches) {
        const select = document.getElementById("chg-referee-select");
        if (!select) return;

        let html = '<option value="">-- 請選擇追分/淘汰場次 --</option>';
        matches.forEach((m, idx) => {
            const statusLabel = m.比賽狀態 === "已完賽" || m.比賽狀態 === "已結束" ? "[已完]" : "[待賽]";
            const relayInfo = m.輪次 || m["輪次"] || "接力賽";
            const pairingInfo = m.區 || m["區"] || "淘汰賽";
            html += `<option value="${idx}">${statusLabel} ${pairingInfo} - ${relayInfo} (${m.A隊名} vs ${m.B隊名})</option>`;
        });
        
        select.innerHTML = html;
        select.onchange = (e) => {
            const val = e.target.value;
            if (val !== "") {
                this.loadMatch(matches[parseInt(val)]);
            } else {
                this.currentMatch = null;
                const scoreboard = document.getElementById("chg-scoreboard");
                if (scoreboard) scoreboard.classList.add("hidden");
                this.releaseWakeLock();
            }
        };
    },

    loadMatch(match) {
        this.requestWakeLock();
        this.currentMatch = match;
        this.scoreA = parseInt(match.A隊比分 || 0);
        this.scoreB = parseInt(match.B隊比分 || 0);
        
        // 顯露計分板 (CSS 類別控制)
        const scoreboard = document.getElementById("chg-scoreboard");
        if (scoreboard) scoreboard.classList.remove("hidden");
        
        // 更新基本資料
        const teamAName = document.getElementById("chg-team-a-name");
        const teamAPlayers = document.getElementById("chg-team-a-players");
        const teamBName = document.getElementById("chg-team-b-name");
        const teamBPlayers = document.getElementById("chg-team-b-players");
        const actualStart = document.getElementById("chg-actual-start-time");

        const relayInfo = match.輪次 || match["輪次"] || "接力賽";
        const pairingInfo = match.區 || match["區"] || "淘汰賽";

        if (teamAName) teamAName.innerText = match["A隊名"];
        const playersA = [match["A隊員1"], match["A隊員2"], match["A隊員3"]].filter(p => p && p !== "待定").join(" / ");
        if (teamAPlayers) teamAPlayers.innerText = playersA;
        
        if (teamBName) teamBName.innerText = match["B隊名"];
        const playersB = [match["B隊員1"], match["B隊員2"], match["B隊員3"]].filter(p => p && p !== "待定").join(" / ");
        if (teamBPlayers) teamBPlayers.innerText = playersB;
        
        if (actualStart) actualStart.innerText = `${pairingInfo} - ${relayInfo}`;
        
        // 設定隊伍背景色
        const colorA = CONFIG.TEAM_COLORS[match["A隊名"]] || "#4a90e2"; // 預設藍色
        const colorB = CONFIG.TEAM_COLORS[match["B隊名"]] || "#ff4d4f"; // 預設紅色
        const boxA = document.getElementById("chg-score-box-a");
        const boxB = document.getElementById("chg-score-box-b");
        if (boxA) boxA.style.background = `linear-gradient(135deg, ${colorA}, ${this.adjustColor(colorA, -40)})`;
        if (boxB) boxB.style.background = `linear-gradient(135deg, ${colorB}, ${this.adjustColor(colorB, -40)})`;

        this.updateScoreUI();
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

    changeScore(team, delta) {
        if (!this.currentMatch) return;

        // 首次得分自動錄時
        if (this.scoreA === 0 && this.scoreB === 0 && delta > 0) {
            const now = new Date();
            const startTime = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
            this.currentMatch.startTime = startTime;
        }

        if (team === 'A') {
            this.scoreA = Math.max(0, this.scoreA + delta);
        } else {
            this.scoreB = Math.max(0, this.scoreB + delta);
        }
        
        this.updateScoreUI();
        this.syncScore();
    },

    swapSides() {
        this.isSwapped = !this.isSwapped;
        const row = document.getElementById("chg-score-row-container");
        if (row) {
            row.classList.toggle("swap-sides", this.isSwapped);
            // 移除直接控制 flexDirection，改由 CSS swap-sides 類別控制
            row.style.flexDirection = ""; 
        }
    },

    toggleFullscreen() {
        const scoreboard = document.getElementById("chg-scoreboard");
        const isFull = scoreboard.classList.toggle("fullscreen-mode");
        
        // 更新圖示
        const btn = scoreboard.querySelector(".btn-fullscreen-toggle i");
        if (btn) {
            btn.className = isFull ? "fas fa-compress-arrows-alt" : "fas fa-expand-arrows-alt";
        }
    },

    resetScore() {
        if (!this.currentMatch) return;
        if (!confirm("確定要將本場比分歸零嗎？")) return;
        
        this.scoreA = 0;
        this.scoreB = 0;
        this.updateScoreUI();
        this.syncScore(); // 同步至雲端
    },

    updateScoreUI() {
        const scoreAEl = document.getElementById("chg-score-a");
        const scoreBEl = document.getElementById("chg-score-b");
        if (scoreAEl) scoreAEl.innerText = this.scoreA;
        if (scoreBEl) scoreBEl.innerText = this.scoreB;
    },

    async syncScore(isFinal = false) {
        if (!this.currentMatch) return;
        
        const dateEl = document.getElementById("current-date");
        const dateStr = dateEl ? dateEl.value : CONFIG.DEFAULT_DATE;
        const refNameEl = document.getElementById("chg-ref-name");
        const refereeName = refNameEl ? refNameEl.value : "";
        
        const payload = {
            yearMonth: dateStr,
            round: this.currentMatch.輪次 || this.currentMatch["輪次"], // "11分接力"
            area: this.currentMatch.區 || this.currentMatch["區"],   // "準決賽(1v4)"
            court: this.currentMatch.場地 || this.currentMatch["場地"],
            scoreA: this.scoreA,
            scoreB: this.scoreB,
            status: isFinal ? "已完賽" : "進行中",
            referee: refereeName
        };

        if (this.currentMatch.startTime) {
            payload.startTime = this.currentMatch.startTime;
        }

        try {
            const res = await API.updateChasingScore(payload);
            if (res && res.status === "success") {
                if (window.logDebug) window.logDebug(`[SYNC] ${this.currentMatch.A隊名} ${this.scoreA}:${this.scoreB}`);
            }
        } catch (err) {
            console.error("Sync Error", err);
        }
    },

    async finishMatch() {
        if (!this.currentMatch) return;
        if (!confirm("確定要結束這場接力賽並存檔嗎？")) return;
        
        await this.syncScore(true);
        alert("追分/淘汰賽紀錄成功！");
        this.releaseWakeLock();
        this.load(); // 重新整理下拉選單
    }
};
