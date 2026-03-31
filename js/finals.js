const Finals = {
    async load() {
        if (window.logDebug) window.logDebug("[FINALS] 正在載入決賽賽程...");
        
        try {
            const res = await API.getChasingSchedule();
            if (res && res.status === "success") {
                const data = res.data || [];
                // 僅顯示區欄位包含 "冠軍賽" 或 "季軍賽" 的紀錄
                const finalsData = data.filter(m => {
                    const area = String(m.區 || m["區"] || "");
                    return area.includes("冠軍賽") || area.includes("季軍賽");
                });
                
                if (window.logDebug) window.logDebug(`[FINALS] 抓取決賽/季軍賽: ${finalsData.length} 筆`);
                this.renderTable(finalsData);
            }
        } catch (err) {
            console.error(err);
        }

        // 綁定生成按鈕
        const btnGen = document.getElementById("btn-generate-finals");
        if (btnGen) {
            btnGen.onclick = () => this.generateFinals();
        }
    },

    async generateFinals() {
        if (!confirm("確定要依據目前準決賽 66 分比分結果，自動產生「冠軍賽」與「季軍賽」賽程嗎？\n(這會將新賽程追加寫入追分賽紀錄表)")) return;

        const btn = document.getElementById("btn-generate-finals");
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 正在判定準決賽勝負並生成中...`;
        btn.disabled = true;

        try {
            const res = await API.generateFinals();
            if (res && res.status === "success") {
                alert("冠軍賽與季軍賽程已成功產生！");
                this.load(); // 重新整理畫面
            } else {
                alert("生成失敗: " + (res.message || "準決賽可能尚未全部結束"));
            }
        } catch (err) {
            alert("伺服器連線出錯");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    renderTable(data) {
        const container = document.getElementById("finals-schedule-container");
        if (data.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align: center; color: var(--text-dim); padding: 3rem; background: rgba(255,255,255,0.02); border: 1px dashed #444;">
                    <i class="fas fa-info-circle" style="font-size: 2rem; margin-bottom: 1rem; color: #ffd700;"></i>
                    <p>目前尚無決賽資料。請在分頁 8 錄完所有「準決賽 66 分」數據後，點擊上方按鈕產生。</p>
                </div>
            `;
            return;
        }

        let html = `
            <table class="pivot-table animate-fadeIn">
                <thead style="background: linear-gradient(to bottom, #444, #222);">
                    <tr>
                        <th style="width: 130px;">接力進度</th>
                        <th>區/場地</th>
                        <th>A隊對戰</th>
                        <th>A隊員</th>
                        <th style="width: 70px;">比分</th>
                        <th style="width: 70px;">比分</th>
                        <th>B隊對戰</th>
                        <th>B隊員</th>
                        <th>狀態</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.forEach(m => {
            const isChampionship = String(m.區 || m["區"]).includes("冠軍賽");
            const rowStyle = isChampionship ? "border-left: 4px solid gold; background: rgba(255, 215, 0, 0.03);" : "border-left: 4px solid #cd7f32; background: rgba(205, 127, 50, 0.03);";
            const badgeColor = isChampionship ? "#ffd700" : "#cd7f32";
            const isDone = m.比賽狀態 === "已完賽" || m.比賽狀態 === "已結束";

            html += `
                <tr style="${rowStyle}" class="${isDone ? 'status-done' : ''}">
                    <td><strong>${m.輪次}</strong><br/><small style="color: #888;">${m.比賽時間}</small></td>
                    <td>
                        <span class="badge" style="background: ${badgeColor}; color: #000; font-weight: bold; padding: 2px 8px;">${m.區}</span>
                        <br/><span style="font-weight: bold; color: var(--primary);">${m.場地}場</span>
                    </td>
                    <td><strong style="color: #fff;">${m.A隊名}</strong></td>
                    <td style="font-size: 0.85rem;">${m.A隊員1} / ${m.A隊員2}</td>
                    <td style="font-size: 1.2rem; font-weight: bold; color: gold;">${m.A隊比分 || 0}</td>
                    <td style="font-size: 1.2rem; font-weight: bold; color: gold;">${m.B隊比分 || 0}</td>
                    <td><strong style="color: #fff;">${m.B隊名}</strong></td>
                    <td style="font-size: 0.85rem;">${m.B隊員1} / ${m.B隊員2}</td>
                    <td><span class="status-badge ${isDone ? 'status-done' : 'status-pending'}">${m.比賽狀態 || '待賽'}</span></td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }
};
