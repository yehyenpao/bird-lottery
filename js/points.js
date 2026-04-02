const Points = {
    async init() {
        this.bindEvents();
        await this.loadParticipants();
    },

    bindEvents() {
        const btnCalc = document.getElementById("btn-calculate-points");
        if (btnCalc) {
            btnCalc.onclick = () => this.calculatePoints();
        }
    },

    async loadParticipants() {
        try {
            const tbody = document.getElementById("manual-points-tbody");
            if (!tbody) return;
            
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> 載入名單中...</td></tr>';
            
            const res = await API.getRegistrations();
            if (!res || res.status !== "success") {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #ff6b6b;">載入失敗或目前查無報名資料</td></tr>';
                return;
            }
            
            const list = res.data || [];
            if (list.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">無本月名單</td></tr>';
                return;
            }
            
            let html = "";
            list.forEach((p, idx) => {
                const name = p["姓名"] || "";
                const team = p["隊名"] || "尚未分隊";
                const area = p["區"] || "";
                html += `
                    <tr data-name="${name}">
                        <td style="font-weight:bold;">${name}</td>
                        <td>${team}</td>
                        <td>${area}</td>
                        <td><input type="number" class="manual-input guess-pts" min="0" value="0" style="width:70px; text-align:center; background: rgba(0,0,0,0.3); color:#fff; border: 1px solid rgba(255,255,255,0.2); border-radius:4px; padding:6px; font-size:1rem;"></td>
                        <td><input type="number" class="manual-input ref-pts" min="0" value="0" style="width:70px; text-align:center; background: rgba(0,0,0,0.3); color:#fff; border: 1px solid rgba(255,255,255,0.2); border-radius:4px; padding:6px; font-size:1rem;"></td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch (e) {
            console.error(e);
        }
    },

    async calculatePoints() {
        const btnCalc = document.getElementById("btn-calculate-points");
        btnCalc.disabled = true;
        btnCalc.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 後端雲端運算與資料庫寫入中...';
        
        try {
            const manualData = {};
            const rows = document.querySelectorAll("#manual-points-tbody tr[data-name]");
            rows.forEach(tr => {
                const name = tr.dataset.name;
                const guess = parseInt(tr.querySelector(".guess-pts").value) || 0;
                const ref = parseInt(tr.querySelector(".ref-pts").value) || 0;
                if (guess > 0 || ref > 0) {
                    manualData[name] = { guess, ref };
                }
            });

            const res = await API.calculatePoints(manualData);
            
            if (res && res.status === "success") {
                alert(res.message);
                this.renderReport(res.data);
            }
        } catch (e) {
            console.error(e);
            alert("計算積分時發生錯誤：" + e.message);
        } finally {
            btnCalc.disabled = false;
            btnCalc.innerHTML = '<i class="fas fa-calculator"></i> 執行統計並產出本月積點報表';
        }
    },

    renderReport(dataList) {
        const tbody = document.getElementById("points-record-tbody");
        if (!tbody) return;
        
        if (!dataList || dataList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;">查無統計數據</td></tr>';
            return;
        }
        
        let html = "";
        dataList.forEach((p, idx) => {
            const rankStyle = idx === 0 ? "background: #ffd700; color: #000;" : 
                              idx === 1 ? "background: #c0c0c0; color: #000;" : 
                              idx === 2 ? "background: #cd7f32; color: #fff;" : "";
                              
            html += `
                <tr class="animate-fadeIn">
                    <td><span class="rank-badge" style="${rankStyle}">${idx + 1}</span></td>
                    <td style="font-weight:bold; font-size:1.1em;">${p.name}</td>
                    <td>${p.team}</td>
                    <td>${p.area}</td>
                    <td>${p.rrRank}</td>
                    <td>${p.elimRank}</td>
                    <td style="color:#aaa;">${p.currPts}</td>
                    <td style="color:#4caf50;">${p.guessPts > 0 ? "+" + p.guessPts : 0}</td>
                    <td style="color:#4caf50;">${p.refPts > 0 ? "+" + p.refPts : 0}</td>
                    <td style="color:#2196f3;">${p.rrPts > 0 ? "+" + p.rrPts : 0}</td>
                    <td style="color:#ff9800;">${p.elimPts > 0 ? "+" + p.elimPts : 0}</td>
                    <td style="font-weight:bold; font-size:1.3em; color:var(--accent); text-shadow: 0 0 10px rgba(0, 255, 204, 0.5);">${p.totalPts}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        
        setTimeout(() => {
            document.getElementById("points-record-table").parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
};
