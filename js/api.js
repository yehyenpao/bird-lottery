const API = {
    /**
     * 統一 API 呼叫 (解決 GAS 302 redirect 吃掉 POST body 的問題)
     * 
     * Google Apps Script 的 /exec 端點會先 302 redirect 到實際執行 URL，
     * 瀏覽器 fetch 的 redirect:"follow" 在跟隨 302 時會把 POST 轉成 GET，
     * 導致 e.postData 為 undefined。
     * 
     * 解法：所有帶 data 的請求一律把 data 放在 URL query parameter，
     *       用 GET 發送讓 GAS 透過 e.parameter.data 接收。
     *       若 data 太大超過 URL 限制 (~2000 chars)，改用兩步驟：
     *       1) 先 GET 空請求取得 redirect 後的真正 URL
     *       2) 直接 POST 到真正 URL（不再經過 redirect）
     */
    async call(action, data = null, yearMonthOverride = null) {
        const baseUrl = CONFIG.API_URL.trim();
        const dateEl = document.getElementById("current-date");
        const currentDate = yearMonthOverride !== null ? yearMonthOverride : (dateEl ? dateEl.value : CONFIG.DEFAULT_DATE);

        if (window.logDebug) window.logDebug(`[REQ] ${action}...`);

        try {
            let url = `${baseUrl}?action=${action}&yearMonth=${currentDate}`;
            let fetchOptions;
            
            if (data) {
                const dataStr = encodeURIComponent(JSON.stringify(data));
                const fullUrl = `${url}&data=${dataStr}`;
                
                // URL 長度限制約 8000 chars 對 GAS 來說安全；超過改用兩步 POST
                if (fullUrl.length < 7500) {
                    // ── 方法 A：資料塞 URL query parameter，用 GET ──
                    url = fullUrl;
                    fetchOptions = { method: "GET", redirect: "follow" };
                } else {
                    // ── 方法 B：資料太大，先解析 redirect URL 再直接 POST ──
                    // Step 1: 取得 redirect 後的真正 URL
                    const probe = await fetch(`${baseUrl}?action=ping`, { 
                        method: "GET", 
                        redirect: "follow" 
                    });
                    const realBaseUrl = probe.url.split('?')[0];
                    
                    url = `${realBaseUrl}?action=${action}&yearMonth=${currentDate}`;
                    fetchOptions = {
                        method: "POST",
                        redirect: "follow",
                        body: JSON.stringify({ data: data }),
                        headers: { "Content-Type": "text/plain;charset=utf-8" }
                    };
                }
            } else {
                fetchOptions = { method: "GET", redirect: "follow" };
            }

            console.group(`📡 [API] ${action}`);
            console.log("方法:", fetchOptions.method);
            console.log("URL:", url);
            if (fetchOptions.body) console.log("Body:", fetchOptions.body);
            console.groupEnd();

            const response = await fetch(url, fetchOptions);
            const textData = await response.text();
            console.log(`📥 [API] ${action} 回應 (HTTP ${response.status}):`, textData.substring(0, 300));

            let result;
            try {
                result = JSON.parse(textData.trim());
            } catch (jsonErr) {
                const snippet = textData.substring(0, 200);
                if (window.logDebug) window.logDebug(`[ERR] 解析失敗: ${snippet}`);
                throw new Error("伺服器傳回內容非 JSON 格式 (" + snippet + ")");
            }

            if (window.logDebug) window.logDebug(`[RES] ${result.status}`);

            if (result.status === "success") {
                return result;
            } else {
                console.warn(`[API] ${action} 回報錯誤:`, result.message);
                throw new Error(result.message || "伺服器發生未知錯誤");
            }

        } catch (error) {
            console.error("❌ API ERROR:", error);
            if (window.logDebug) window.logDebug(`[FAIL] ${error.message}`);

            const errorMsg = error.message.includes("Failed to fetch")
                ? "無法連接到伺服器，請檢查網路連線或 API 網址是否正確。"
                : error.message;

            alert(`執行失敗！\n指令: ${action}\n原因: ${errorMsg}`);
            return null;
        }
    },

    getRegistrations() { return this.call("getRegistrations"); },
    getSchedule(ym = null) { return this.call("getSchedule", null, ym); },
    getLiveScores(ym = null) { return this.call("getLiveScores", null, ym); },
    getChasingSchedule(ym = null) { return this.call("getChasingSchedule", null, ym); },
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
