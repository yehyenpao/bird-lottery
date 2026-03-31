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

    async load() {
        const res = await API.getSchedule();
        if (res && res.status === "success") {
            this.render(res.data);
        } else {
            this.render([]);
        }
    },

    async generate() {
        if (!confirm("確定要產生新的循環賽程嗎？這會清除現有的當月賽程。")) return;
        const res = await API.generateSchedule();
        if (res && res.status === "success") {
            alert(res.message || "賽程產生成功！");
            this.load();
        }
    },

    render(data) {
        const tbody = document.querySelector("#schedule-table tbody");
        if (!data || data.length === 0) {
            tbody.innerHTML = "<tr><td colspan='7'>尚無賽程資料，請按按鈕產生。</td></tr>";
            return;
        }

        let html = "";
        data.forEach(match => {
            const areaName = match.區 || match.區別 || "";
            html += `
                <tr>
                    <td>${this.formatTime(match.比賽時間)}</td>
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
                        <span class="status-badge ${match.比賽狀態 === '已完賽' ? 'status-done' : 'status-pending'}">
                            ${match.比賽狀態 || "待賽"}
                        </span>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }
};

// 綁定事件
document.getElementById("btn-gen-schedule").addEventListener("click", () => Schedule.generate());
