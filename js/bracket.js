const Bracket = {
    async load() {
        const res = await API.getSchedule();
        if (res && res.status === "success") {
            this.render(res.data);
        } else {
            this.render([]);
        }
    },

    render(data) {
        const container = document.getElementById("bracket-container");
        if (!data || data.length === 0) {
            container.innerHTML = "<div class='card'>尚未產生賽程</div>";
            return;
        }

        let html = '<div class="bracket-wrapper">';
        CONFIG.AREAS.forEach(area => {
            const matches = data.filter(m => {
                const areaVal = m.區 || m.區別 || "";
                return areaVal === area || areaVal === area + "區";
            });
            
            html += `
                <div class="card bracket-card">
                    <h3 style="color: ${CONFIG.AREA_COLORS[area] || '#666'}">${area.replace("區","")} 籤表</h3>
                    <div class="quad-bracket">
                        <div class="corner tl" style="border-color:${CONFIG.TEAM_COLORS['藍鳥隊']}">藍鳥</div>
                        <div class="corner tr" style="border-color:${CONFIG.TEAM_COLORS['黑鳥隊']}">黑鳥</div>
                        <div class="corner bl" style="border-color:${CONFIG.TEAM_COLORS['青鳥隊']}">青鳥</div>
                        <div class="corner br" style="border-color:${CONFIG.TEAM_COLORS['粉鳥隊']}">粉鳥</div>
                        
                        <div class="center-links">
                            ${this.renderLinks(matches)}
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    },

    renderLinks(matches) {
        // 渲染中間連線的得分
        // 這裡會依據 1-2, 3-4, 1-3, 2-4, 1-4, 2-3 的對戰組合來顯示比分
        // 這裡先簡單列出已完成的比分
        let html = "";
        matches.forEach(m => {
            if (m.A隊比分 > 0 || m.B隊比分 > 0) {
                html += `
                    <div class="match-mini">
                        <span>${m.A隊名[0]} vs ${m.B隊名[0]}</span>
                        <strong>${m.A隊比分}:${m.B隊比分}</strong>
                    </div>
                `;
            }
        });
        return html || "待賽中...";
    }
};

// 增加 CSS 用於四角籤表
const style = document.createElement("style");
style.textContent = `
    .bracket-wrapper {
        display: flex;
        justify-content: center;
        gap: 1.5rem;
        flex-wrap: nowrap;
        overflow-x: auto;
        padding-bottom: 1rem;
    }
    .bracket-card {
        flex: 0 0 auto;
        width: 320px;
        padding: 1rem;
    }
    .quad-bracket {
        position: relative;
        width: 260px;
        height: 260px;
        margin: 1.5rem auto;
        display: grid;
        grid-template: 1fr 1fr / 1fr 1fr;
        gap: 60px;
    }
    .corner {
        background: rgba(255,255,255,0.05);
        border: 2px solid;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 0.9rem;
    }
    .center-links {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--bg-dark);
        padding: 10px;
        border-radius: 50%;
        width: 110px;
        height: 110px;
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        z-index: 10;
    }
    .match-mini { margin-bottom: 4px; border-bottom: 1px solid var(--border); }
    
    @media (max-width: 1000px) {
        .bracket-wrapper { flex-wrap: wrap; justify-content: center; }
        .bracket-card { width: 100%; max-width: 400px; }
    }
`;
document.head.appendChild(style);
