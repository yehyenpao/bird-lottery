const Schedule = {
    formatTime(timeStr) {
        if (!timeStr) return "-";
        // 如果是 Date 物件或包含 T 的 ISO 字串，嘗試擷取時間部分
        const str = String(timeStr);
        if (str.includes(" ") || str.includes("T")) {
            const timePart = str.split(/[ T]/)[1];
            return timePart ? timePart.slice(0, 5) : str.slice(0, 5);
        }
        return str.slice(0, 5); // 確保只取 HH:mm
    },

    async load(silent = false) {
        const res = await API.getSchedule();
        if (res && res.status === "success") {
            this.render(res.data);
        } else if (!silent) {
            this.render([]);
        }
    },

    async generate() {
        if (!confirm("確定要產生新的循環賽程嗎？這會清除現有的當月賽程。")) return;
        const res = await API.generateSchedule();
        if (res && res.status === "success") {
            alert(res.message || "賽程產生成功！");
            this.load();
        } else if (res) {
            alert("產生賽程失敗：" + res.message);
        } else {
            alert("產生賽程失敗：未知錯誤");
        }
    },

    render(data) {
        this.matches = data || [];
        const tbody = document.querySelector("#schedule-table tbody");
        if (!data || data.length === 0) {
            tbody.innerHTML = "<tr><td colspan='7'>尚無賽程資料，請按按鈕產生。</td></tr>";
            return;
        }

        let html = "";
        data.forEach((match, idx) => {
            const areaName = match.區 || match.區別 || "";
            const isUmpire = typeof currentRole !== 'undefined' && currentRole === 'umpire';
            const voiceBtn = isUmpire ? `
                <button class="btn-icon" onclick="SpeechManager.announceMatch(Schedule.matches[${idx}])" title="語音播報" style="margin-left:8px; color:var(--accent);">
                    <i class="fas fa-volume-up"></i>
                </button>
            ` : '';
            
            html += `
                <tr>
                    <td>${this.formatTime(match.比賽時間)}</td>
                    <td>${match.序號 || ""}</td>
                    <td>第 ${match.輪次} 輪</td>
                    <td><span class="badge" style="background:${CONFIG.AREA_COLORS[areaName] || '#666'}">${areaName}</span></td>
                    <td>場地 ${match.場地}</td>
                    <td>
                        <strong style="color:${CONFIG.TEAM_COLORS[match.A隊名]}">${match.A隊名}</strong><br>
                        <small>${match.A隊員1}, ${match.A隊員2}</small>
                    </td>
                    <td><b style="font-size:1.2rem">${match.A隊比分} : ${match.B隊比分}</b></td>
                    <td>
                        <strong style="color:${CONFIG.TEAM_COLORS[match.B隊名]}">${match.B隊名}</strong><br>
                        <small>${match.B隊員1}, ${match.B隊員2}</small>
                    </td>
                    <td>${match.裁判 || "-"}</td>
                    <td>
                        <div style="display:flex; align-items:center; justify-content:center;">
                            <span class="status-badge ${match.比賽狀態 === '已完賽' ? 'status-done' : 'status-pending'}">
                                ${match.比賽狀態 || "待賽"}
                            </span>
                            ${voiceBtn}
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }
};

// 綁定事件
document.getElementById("btn-gen-schedule").addEventListener("click", () => Schedule.generate());
