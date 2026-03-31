const Chasing = {
    async load() {
        const res = await API.getChasingSchedule();
        if (res && res.status === "success") {
            this.renderTable(res.data || []);
        }
        
        // 綁定生成按鈕
        const btnGen = document.getElementById("btn-generate-chasing");
        if (btnGen) {
            btnGen.onclick = () => this.generateSemiFinals();
        }
    },

    async generateSemiFinals() {
        if (!confirm("確定要依據目前預賽排名自動產生「準決賽」追分賽程嗎？\n(這會寫入追分賽紀錄表)")) return;

        const btn = document.getElementById("btn-generate-chasing");
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 正在計算排名並生成賽程...`;
        btn.disabled = true;

        try {
            const res = await API.generateChasingSchedule();
            if (res && res.status === "success") {
                alert("準決賽程已成功產生！");
                this.load(); // 重新載入顯示
            }
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    renderTable(data) {
        const container = document.getElementById("chasing-schedule-container");
        if (data.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align: center; color: var(--text-dim); padding: 2rem;">
                    目前尚無追分賽程資料。請先點擊上方按鈕產生準決賽。
                </div>
            `;
            return;
        }

        let html = `
            <table class="pivot-table">
                <thead>
                    <tr>
                        <th style="width: 120px;">輪次</th>
                        <th>場地</th>
                        <th>A隊對戰</th>
                        <th>A隊員</th>
                        <th style="width: 80px;">比分</th>
                        <th style="width: 80px;">比分</th>
                        <th>B隊對戰</th>
                        <th>B隊員</th>
                        <th>狀態</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // 過濾機制：僅顯示區為準決賽(1v4) 或 準決賽(2v3) 的資料
        const semiFinalsOnly = data.filter(m => {
            const area = String(m.區 || m["區"] || "");
            return area.includes("準決賽(1v4)") || area.includes("準決賽(2v3)");
        });

        semiFinalsOnly.forEach(m => {
            const isDone = m.比賽狀態 === "已完賽" || m.比賽狀態 === "已結束";
            
            // 抓取新的欄位對位：輪次是接力進度，區是對抗分組
            const relayInfo = m.輪次 || m["輪次"] || "接力賽";
            const pairingInfo = m.區 || m["區"] || "淘汰賽";

            html += `
                <tr>
                    <td><strong>${relayInfo}</strong><br/><small>${pairingInfo}</small></td>
                    <td><span class="badge" style="background: rgba(59, 130, 246, 0.2);">${m.場地}場</span></td>
                    <td><strong style="color: var(--primary);">${m.A隊名}</strong></td>
                    <td>${m.A隊員1} / ${m.A隊員2}</td>
                    <td style="font-size: 1.2rem; font-weight: bold;">${m.A隊比分 || 0}</td>
                    <td style="font-size: 1.2rem; font-weight: bold;">${m.B隊比分 || 0}</td>
                    <td><strong style="color: var(--accent);">${m.B隊名}</strong></td>
                    <td>${m.B隊員1} / ${m.B隊員2}</td>
                    <td><span class="status-badge ${isDone ? 'status-done' : 'status-pending'}">${m.比賽狀態 || '待賽'}</span></td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }
};
