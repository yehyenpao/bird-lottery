const API = {
    async call(action, data = null) {
        const baseUrl = CONFIG.API_URL.trim();
        const yearMonthEl = document.getElementById("current-year-month");
        const currentYM = yearMonthEl ? yearMonthEl.innerText.trim() : CONFIG.YEAR_MONTH;
        let url = `${baseUrl}?action=${action}&yearMonth=${currentYM}`;
        
        if (data) {
            const dataStr = encodeURIComponent(JSON.stringify(data));
            url += `&data=${dataStr}`;
        }

        if (window.logDebug) window.logDebug(`[REQ] ${action}...`);
        
        try {
            let fetchOptions = { method: "GET", redirect: "follow" };
            
            // 若資料體積較大或為特定寫入動作，改用 POST
            const postActions = ['uploadPhoto', 'generateChasingSchedule', 'generateFinals', 'calculatePoints', 'saveSpecialRecords'];
            if (postActions.includes(action) && data) {
                url = `${baseUrl}?action=${action}&yearMonth=${currentYM}`;
                fetchOptions = {
                    method: "POST",
                    redirect: "follow",
                    body: JSON.stringify({ data: data }),
                    headers: {
                        "Content-Type": "text/plain;charset=utf-8"
                    }
                };
            }

            const response = await fetch(url, fetchOptions);
            const textData = await response.text();
            
            let result;
            try {
                result = JSON.parse(textData.trim());
            } catch (jsonErr) {
                const snippet = textData.substring(0, 100);
                if (window.logDebug) window.logDebug(`[ERR] 解析失敗: ${snippet}`);
                throw new Error("伺服器傳回內容非 JSON 格式 (" + snippet + ")");
            }

            if (window.logDebug) window.logDebug(`[RES] ${result.status}`);
            
            if (result.status === "success") {
                return result;
            } else {
                // 如果後端傳回的是 success 以外的狀態，直接丟出後端的 message
                throw new Error(result.message || "伺服器發生未知錯誤");
            }

        } catch (error) {
            console.error("❌ API ERROR:", error);
            if (window.logDebug) window.logDebug(`[FAIL] ${error.message}`);
            alert(`執行失敗！\n原因: ${error.message}`);
            return null;
        }
    },

    getRegistrations() { return this.call("getRegistrations"); },
    getSchedule() { return this.call("getSchedule"); },
    getLiveScores() { return this.call("getLiveScores"); },
    getChasingSchedule() { return this.call("getChasingSchedule"); },
    getRankings() { return this.call("getRankings"); },
    addRegistrations(items) { return this.call("addRegistrations", items); },
    autoGroup() { return this.call("autoGroup"); },
    generateSchedule() { return this.call("generateSchedule"); },
    updateScore(scoreData) { return this.call("updateScore", scoreData); },
    updateChasingScore(scoreData) { return this.call("updateChasingScore", scoreData); },
    updatePlayerOrder(data) { return this.call("updatePlayerOrder", data); },
    generateChasingSchedule(data) { return this.call("generateChasingSchedule", data); },
    generateFinals(data) { return this.call("generateFinals", data); },
    calculatePoints(manualData) { return this.call("calculatePoints", manualData); },
    getPointsRecords() { return this.call("getPointsRecords"); },
    getSpecialRecords() { return this.call("getSpecialRecords"); },
    saveSpecialRecords(data) { return this.call("saveSpecialRecords", data); },
    getPlayersInfo() { return this.call("getPlayersInfo"); },
    uploadPhoto(data) { return this.call("uploadPhoto", data); }
};
