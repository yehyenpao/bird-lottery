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
    async load() {
        if (window.logDebug) window.logDebug("[CHASING] 正在載入追分賽程...");
        
        // 抓取 UI 上的年份月份
        const yearMonthEl = document.getElementById("current-year-month");
        const yearMonth = yearMonthEl ? yearMonthEl.innerText.trim() : "2026-03";
        
        const select = document.getElementById("chg-referee-select");
        if (select) select.innerHTML = '<option value="">正在載入資料...</option>';

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

        let html = '<option value="">-- 請選擇追分接力場次 --</option>';
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

        if (teamAName) teamAName.innerText = match.A隊名;
        if (teamAPlayers) teamAPlayers.innerText = `${match.A隊員1} / ${match.A隊員2}`;
        if (teamBName) teamBName.innerText = match.B隊名;
        if (teamBPlayers) teamBPlayers.innerText = `${match.B隊員1} / ${match.B隊員2}`;
        if (actualStart) actualStart.innerText = `${pairingInfo} - ${relayInfo}`;
        
        this.updateScoreUI();
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
            row.style.flexDirection = this.isSwapped ? "row-reverse" : "row";
        }
    },

    updateScoreUI() {
        const scoreAEl = document.getElementById("chg-score-a");
        const scoreBEl = document.getElementById("chg-score-b");
        if (scoreAEl) scoreAEl.innerText = this.scoreA;
        if (scoreBEl) scoreBEl.innerText = this.scoreB;
    },

    async syncScore(isFinal = false) {
        if (!this.currentMatch) return;
        
        const yearMonthEl = document.getElementById("current-year-month");
        const yearMonth = yearMonthEl ? yearMonthEl.innerText.trim() : "2026-03";
        const refNameEl = document.getElementById("chg-ref-name");
        const refereeName = refNameEl ? refNameEl.value : "";
        
        const payload = {
            yearMonth,
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
        alert("追分接力賽紀錄成功！");
        this.releaseWakeLock();
        this.load(); // 重新整理下拉選單
    }
};
