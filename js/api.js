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
        console.log(`[TRACE] API.call entering: action=${action}`);
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
                
                // URL 長度限制約 8000 chars 對 GAS 來說安全；超過改用 POST
                if (fullUrl.length < 7500) {
                    // ── 方法 A：資料塞 URL query parameter，用 GET ──
                    url = fullUrl;
                    fetchOptions = { method: "GET", redirect: "follow" };
                } else {
                    // ── 方法 B：資料太大，直接對 GAS 發送 POST，並使用 text/plain 避免 CORS Preflight 放行
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

            if (result.status === "success" || result.status === "warning") {
                // warning 狀態由呼叫端自行處理 (如重複匯入偵測)
                return result;
            } else {
                console.warn(`[API] ${action} 回報錯誤:`, result.message);
                throw new Error(result.message || "伺服器發生未知錯誤");
            }

        } catch (error) {
            // 忽略因頁面跳轉 (重新整理/切換身分) 而中斷的連線錯誤，避免跳出擾人的警告
            if (window.isNavigating || window.isUnloading) {
                console.warn(`🚫 API [${action}] 請求因頁面跳轉/關閉而中斷，已忽略該錯誤。`);
                return null;
            }

            console.error("❌ API ERROR:", error);
            if (window.logDebug) window.logDebug(`[FAIL] ${error.message}`);

            const errorMsg = (error.message.includes("Failed to fetch") || error.message.includes("Load failed") || error.message.includes("NetworkError"))
                ? "連線中斷 (網路不穩或瀏覽器阻擋請求)，請重整網頁或檢查連線。"
                : error.message;

            alert(`執行失敗！\n指令: ${action}\n原因: ${errorMsg}`);
            return null;
        }
    },

    getRegistrations(ym = null) { return this.call("getRegistrations", null, ym); },
    getSchedule(ym = null) { return this.call("getSchedule", null, ym); },
    getLiveScores(ym = null) { return this.call("getLiveScores", null, ym); },
    getChasingSchedule(ym = null) { return this.call("getChasingSchedule", null, ym); },
    getRankings(ym = null) { return this.call("getRankings", null, ym); },
    addRegistrations(items, mode = "check") {
        // mode: "check"(預檢) | "overwrite"(覆蓋) | "append"(追加)
        let payload;
        if (mode === "overwrite") payload = { items, overwrite: true };
        else if (mode === "append")  payload = { items, append: true };
        else payload = items; // check 模式：讓後端決定
        return this.call("addRegistrations", payload);
    },
    autoGroup(mode = "default") { return this.call("autoGroup", mode); },
    generateSchedule() { return this.call("generateSchedule"); },
    updateScore(scoreData) { return this.call("updateScore", scoreData); },
    updateChasingScore(scoreData) { return this.call("updateChasingScore", scoreData); },
    updatePlayerOrder(data) { return this.call("updatePlayerOrder", data); },
    generateChasingSchedule(data) { return this.call("generateChasingSchedule", data); },
    generateFinals(data, mode = "check") {
        const payload = mode === "overwrite"
            ? { items: data, overwrite: true }
            : { items: data };
        return this.call("generateFinals", payload);
    },
    calculatePoints(manualData) { return this.call("calculatePoints", manualData); },
    getPointsRecords() { return this.call("getPointsRecords"); },
    getSpecialRecords() { return this.call("getSpecialRecords"); },
    saveSpecialRecords(data, ym = null) { return this.call("saveSpecialRecords", data, ym); },
    getPlayersInfo() { return this.call("getPlayersInfo"); },
    uploadPhoto(data) { return this.call("uploadPhoto", data); },
    generateLotteryKnockout(data) { return this.call("generateLotteryKnockout", data); }
};
