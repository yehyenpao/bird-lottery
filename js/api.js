const API = {
    async call(action, data = null) {
        const baseUrl = CONFIG.API_URL.trim();
        let url = `${baseUrl}?action=${action}&yearMonth=${CONFIG.YEAR_MONTH}`;
        
        if (data) {
            const dataStr = encodeURIComponent(JSON.stringify(data));
            url += `&data=${dataStr}`;
        }

        if (window.logDebug) window.logDebug(`[REQ] ${action}...`);
        
        try {
            const response = await fetch(url, { method: "GET", redirect: "follow" });
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
    getRankings() { return this.call("getRankings"); },
    addRegistrations(items) { return this.call("addRegistrations", items); },
    autoGroup() { return this.call("autoGroup"); },
    generateSchedule() { return this.call("generateSchedule"); },
    updateScore(scoreData) { return this.call("updateScore", scoreData); }
};
