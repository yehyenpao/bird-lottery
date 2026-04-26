const Special = {
    init() {
        const btnSave = document.getElementById("btn-save-special");
        if (btnSave) {
            btnSave.onclick = () => this.saveSpecial();
        }
        // 初始載入歷史紀錄
        this.loadHistory();
        console.log("Special section ready.");
    },

    async loadHistory() {
        const container = document.getElementById("special-history-list");
        if (!container) return;

        try {
            const res = await API.getSpecialRecords();
            if (res && res.status === "success") {
                this.renderHistory(res.data);
            } else {
                container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-dim);">目前尚無公佈紀錄。</div>';
            }
        } catch (err) {
            console.error("載入歷史紀錄失敗:", err);
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--danger);">載入失敗，請檢查網路連線。</div>';
        }
    },

    renderHistory(data) {
        const container = document.getElementById("special-history-list");
        if (!data || data.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-dim);">目前尚無公佈紀錄。</div>';
            return;
        }

        // 按日期排序 (降序)
        const sortedData = [...data].sort((a, b) => new Date(b.年月 || 0) - new Date(a.年月 || 0));

        let html = "";
        sortedData.forEach(item => {
            // 由於後端結構可能改變，我們同時支援舊格式(類型/姓名)與新格式(公佈內容)
            const date = item.年月 || "未知日期";
            const content = item.公佈內容 || `${item.類型}: ${item.姓名} ${item.備註 || ""}`;
            
            html += `
                <div class="card animate-fadeIn" style="padding: 1.5rem; border-left: 4px solid var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">
                        <span style="font-weight: bold; color: var(--accent);"><i class="far fa-calendar-alt"></i> ${date}</span>
                        <span style="font-size: 0.8rem; color: var(--text-dim);">#賽事公告</span>
                    </div>
                    <div style="white-space: pre-wrap; line-height: 1.8; color: var(--text-main); font-size: 1.05rem;">${content}</div>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    async saveSpecial() {
        const content = document.getElementById("special-content").value.trim();

        if (!content) {
            alert("請輸入公佈內容！");
            return;
        }

        const btnSave = document.getElementById("btn-save-special");
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 發布中...';

        try {
            // 取得目前的年月 (從主介面的日期選擇器)
            const yearMonth = document.getElementById("current-date")?.value || new Date().toISOString().substring(0, 10);
            
            const payload = {
                content: content
            };

            const res = await API.saveSpecialRecords(payload, yearMonth);
            if (res && res.status === "success") {
                alert("✅ 公佈欄已成功發布！");
                document.getElementById("special-content").value = "";
                await this.loadHistory();
                
                // 如果在球友端，也同步更新
                if (window.Viewer && Viewer.loadSpecial) {
                    Viewer.loadSpecial();
                }
            }
        } catch (err) {
            console.error("發布失敗:", err);
            alert("發布失敗，請稍後再試。");
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = '<i class="fas fa-paper-plane"></i> 儲存並發布公佈欄';
        }
    }
};

// 將物件暴露到全域
window.Special = Special;
