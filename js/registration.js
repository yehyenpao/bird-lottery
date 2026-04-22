const Registration = {
    init() {
        const typeSelect = document.getElementById("tournament-type");
        const modeWrapper = document.getElementById("group-mode-wrapper");
        if (typeSelect && modeWrapper) {
            typeSelect.addEventListener("change", (e) => {
                modeWrapper.style.display = e.target.value === "standard" ? "block" : "none";
            });
        }
    },

    async load() {
        const res = await API.getRegistrations();
        if (res && res.status === "success") {
            this.render(res.data);
        } else {
            this.render([]);
        }
    },

    async importData() {
        console.log("開始執行匯入程序...");
        const inputElem = document.getElementById("import-data");
        if (!inputElem) {
            console.error("找不到輸入欄位 #import-data");
            return;
        }

        const text = inputElem.value.trim();
        if (!text) {
            alert("請先輸入資料！");
            return;
        }

        let items;
        try {
            const currentDate = document.getElementById("current-date")?.value || new Date().toISOString().substring(0, 10);
            const lines = text.split("\n").filter(line => line.trim() !== "");

            items = lines.flatMap((line) => {
                const separator = line.includes("\t") ? "\t" : ",";
                const parts = line.split(separator).map(s => s.trim());
                if (parts.length < 1 || !parts[0]) return [];

                // 格式 1: 5 欄位格式 (含日期 | 隊名 | 身份 | 姓名 | 區)
                if (parts.length >= 4 && (parts[0].match(/^\d{4}-\d{2}/) || parts.length === 5)) {
                    const hasDate = parts[0].match(/^\d{4}-\d{2}/);
                    const team     = hasDate ? parts[1] : parts[0];
                    // 正確提取「身份」欄位（可為猛禽/小鳥/鳥蛋等技能標記）
                    const role     = hasDate ? (parts[2] || "球員") : (parts[1] || "球員");
                    const rawNames = hasDate ? parts[3] : parts[2];
                    const area     = hasDate ? (parts[4] || "") : (parts[3] || "");
                    const pNames   = rawNames.split(/[\s/、]+/).map(n => n.trim()).filter(n => n);
                    return pNames.map(n => ({ yearMonth: currentDate, name: n, team, area, role }));
                }

                // 格式 2: 舊版 (姓名,隊名,區)
                const name = parts[0];
                const team = parts.length >= 3 ? parts[1] : "";
                const area = parts.length >= 3 ? parts[2] : (parts[1] || "");
                if (!name) return [];
                return [{ yearMonth: currentDate, name, team, area, role: "球員" }];
            });

            if (items.length === 0) {
                alert("沒有有效的資料可以匯入，請檢查格式是否正確。");
                return;
            }
        } catch (parseErr) {
            alert(`資料解析失敗：${parseErr.message}`);
            return;
        }

        try {
            // ── 第一階段：預檢（讓後端判斷是否有重複） ──
            let res = await API.addRegistrations(items, "check");
            if (!res) return; // 發生網路錯誤，API.call 已彈出提示

            // ── 若後端偵測到已有資料，詢問使用者如何處理 ──
            if (res.status === "warning" && res.code === "ALREADY_EXISTS") {
                const choice = window.confirm(
                    `⚠️ 資料庫中已有 ${res.count} 筆該月份的報名資料。\n\n` +
                    `按【確定】→ 刪除舊資料，整份重新匯入（覆蓋）\n` +
                    `按【取消】→ 保留舊資料，將新名單排在後面（追加）`
                );
                const mode = choice ? "overwrite" : "append";
                res = await API.addRegistrations(items, mode);
                if (!res) return;
            }

            if (res.status === "success") {
                alert(`✅ ${res.message}`);
                inputElem.value = "";
                await this.load();
            } else {
                // 其他非預期的 warning
                alert(`⚠️ ${res.message}`);
            }
        } catch (err) {
            console.error("匯入過程發生未預期錯誤:", err);
            // 顯示具體錯誤訊息，而非通用提示
            alert(`匯入失敗：${err.message || "請檢查您的網路連線或資料格式。"}`);
        }
    },

    async autoGroup() {
        const type = document.getElementById("tournament-type").value || "standard";
        const mode = document.getElementById("group-mode").value || "default";

        // 顯示魔法彈窗
        const modal = document.getElementById("magic-group-modal");
        const status = document.getElementById("magic-status");
        const orb = document.getElementById("magic-orb");
        
        if (modal) {
            modal.style.display = "block";
            if (status) status.innerText = "等待啟動中...";
            if (orb) orb.classList.remove("processing");
            
            // 儲存當前模式以便後續使用
            this.currentGroupType = type === "lottery" ? "lottery" : mode;
        }
    },

    playMagicSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            
            // 隨機抽選音效 (快速的電子音階)
            for (let i = 0; i < 20; i++) {
                setTimeout(() => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = "sine";
                    // 頻率隨機跳動，模擬魔法陣運算
                    osc.frequency.setValueAtTime(400 + Math.random() * 800, ctx.currentTime);
                    
                    gain.gain.setValueAtTime(0.1, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                    
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 0.1);
                }, i * 100);
            }
            // 最後成功音階
            setTimeout(() => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = "triangle";
                osc.frequency.setValueAtTime(600, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
                
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.5);
            }, 2300);
        } catch(e) {
            console.log("Audio not supported or blocked", e);
        }
    },

    async executeMagicGrouping() {
        const orb = document.getElementById("magic-orb");
        const status = document.getElementById("magic-status");
        
        if (!orb || orb.classList.contains("processing")) return;
        
        orb.classList.add("processing");
        status.innerText = "魔法陣啟動中...";
        
        // 播放音效
        this.playMagicSound();
        
        // 模擬一些華麗的進度提示
        const steps = ["分析球員戰力...", "平衡各隊實力...", "產生隨機序列...", "寫入資料庫..."];
        let stepIdx = 0;
        
        const timer = setInterval(() => {
            if (stepIdx < steps.length) {
                status.innerText = steps[stepIdx++];
            } else {
                clearInterval(timer);
            }
        }, 600);
        
        try {
            const res = await API.autoGroup(this.currentGroupType);
            
            // 等待動畫跑完
            setTimeout(async () => {
                if (!res) {
                    status.innerText = "魔法失效 (網路錯誤)";
                    orb.classList.remove("processing");
                    return;
                }

                if (res.status === "success" || res.status === "warning") {
                    status.innerHTML = `<span style="color:#4ad66d">✅ ${res.status === 'success' ? '分組完成！' : '部分分組完成'}</span>`;
                    
                    // 成功特效後關閉並顯示全螢幕動畫
                    setTimeout(() => {
                        document.getElementById("magic-group-modal").style.display = "none";
                        this.load();
                        
                        // 動態插入 iframe 播放過場動畫
                        const iframe = document.createElement("iframe");
                        iframe.src = "intro_animation.html";
                        iframe.id = "intro-animation-iframe";
                        iframe.style.position = "fixed";
                        iframe.style.top = "0";
                        iframe.style.left = "0";
                        iframe.style.width = "100vw";
                        iframe.style.height = "100vh";
                        iframe.style.border = "none";
                        iframe.style.zIndex = "9999";
                        document.body.appendChild(iframe);
                        
                        // 監聽動畫內部發送的關閉訊息
                        const messageHandler = function(e) {
                            if (e.data && (e.data.action === "closeIntroAnimation" || e.data.action === "closeAndGoToSchedule")) {
                                const frames = document.querySelectorAll("#intro-animation-iframe");
                                frames.forEach(f => {
                                    // 加上淡出效果
                                    f.style.transition = "opacity 0.5s ease";
                                    f.style.opacity = "0";
                                    setTimeout(() => f.remove(), 500);
                                });
                                window.removeEventListener("message", messageHandler);
                                
                                // 若收到跳轉賽程分頁的請求
                                if (e.data.action === "closeAndGoToSchedule") {
                                    setTimeout(() => {
                                        // 全域切換到「循環籤表」(分頁3)
                                        const btn = document.querySelector('li[data-tab="bracket"]');
                                        if (btn) btn.click();
                                    }, 500);
                                }
                            }
                        };
                        window.addEventListener("message", messageHandler);
                    }, 1500);
                } else {
                    status.innerHTML = `<span style="color:#ff4d4d">❌ 失敗：${res.message || "人數錯誤"}</span>`;
                    orb.classList.remove("processing");
                }
            }, 2500); // 確保動畫至少跑 2.5 秒，增加儀式感
            
        } catch (err) {
            status.innerHTML = `<span style="color:#ff4d4d">❌ 錯誤：${err.message}</span>`;
            orb.classList.remove("processing");
        }
    },



    render(data) {
        const container = document.getElementById("reg-list-container");
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align: center; color: var(--text-dim); padding: 3rem;">
                    <i class="fas fa-users-slash" style="font-size: 3rem; margin-bottom: 1rem; display: block; opacity: 0.3;"></i>
                    <p>目前尚無報名資料。</p>
                </div>`;
            return;
        }

        // 動態偵測資料內的隊列與區域
        const dataTeams = [...new Set(data.map(p => String(p.隊名 || "").trim()).filter(t => t))];
        const dataAreas = [...new Set(data.map(p => String(p.區 || p.區別 || "").replace("區", "").trim()).filter(a => a))];
        
        const isLottery = document.getElementById("tournament-type")?.value === "lottery";
        const hasCustomTeams = dataTeams.some(t => !CONFIG.TEAMS.includes(t));

        const areas = (isLottery || hasCustomTeams) && dataAreas.length > 0 
            ? dataAreas 
            : [...new Set([...CONFIG.AREAS.map(a => a.replace("區", "")), ...dataAreas])];
            
        const teams = (isLottery || hasCustomTeams) && dataTeams.length > 0 
            ? dataTeams 
            : CONFIG.TEAMS;

        let html = `
            <div class="card animate-fadeIn" style="overflow-x: auto;">
                <table class="matrix-table">
                    <thead>
                        <tr>
                            <th style="background: rgba(255,255,255,0.05); min-width: 100px;">隊名 \\ 區</th>
                            ${areas.map(area => `<th>${area}</th>`).join("")}
                        </tr>
                    </thead>
                    <tbody>
        `;

        // 逐行產生隊伍資料
        teams.forEach(team => {
            const teamColor = CONFIG.TEAM_COLORS[team] || "var(--text-main)";
            html += `
                <tr>
                    <td style="color: ${teamColor}; font-weight: bold; border-right: 1px solid var(--border);">
                        ${team}
                    </td>
            `;

            // 逐格填入人員
            areas.forEach(area => {
                const cleanArea = area.replace("區", "");
                const cellPlayers = data.filter(p => {
                    const pTeam = String(p.隊名 || "").trim();
                    const pArea = String(p.區 || p.區別 || "").replace("區", "");
                    // 如果這格是尚未分區的區域列，則捕捉空區域球員
                    if (area === "未分區" && !pArea && pTeam === team) return true;
                    return pTeam === team && pArea === cleanArea;
                });

                html += `
                    <td>
                        <div class="player-stack">
                            ${cellPlayers.length > 0 ? 
                                cellPlayers.map(p => `<div class="p-name">${p.姓名}</div>`).join("") : 
                                "<span style='opacity:0.2'>-</span>"
                            }
                        </div>
                    </td>
                `;
            });

            html += `</tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        // 額外顯示「未分配」人員 (如果有)
        const unassigned = data.filter(p => !p.隊名 || p.隊名.trim() === "");
        if (unassigned.length > 0) {
            html += `
                <div class="card animate-fadeIn" style="margin-top: 1.5rem; border: 1px dashed var(--border);">
                    <h4 style="color: var(--text-dim); margin-bottom: 0.8rem;"><i class="fas fa-clock"></i> 尚未分組人員 (${unassigned.length})</h4>
                    <div class="player-list">
                        ${unassigned.map(p => `<span class="player-tag">${p.姓名} (${(p.區 || "").replace("區", "")})</span>`).join("")}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
        
        // 矩陣桌樣式
        if (!document.getElementById("registration-matrix-style")) {
            const style = document.createElement("style");
            style.id = "registration-matrix-style";
            style.textContent = `
                .matrix-table { width: 100%; min-width: 0 !important; border-collapse: collapse; text-align: center; }
                .matrix-table th { padding: 8px 5px; background: rgba(0,0,0,0.2); color: var(--accent); border: 1px solid var(--border); font-size: 1rem; }
                .matrix-table td { padding: 8px 5px; border: 1px solid var(--border); vertical-align: middle; }
                .player-stack { display: flex; flex-direction: column; gap: 4px; }
                .p-name { font-weight: 500; font-size: 0.9rem; color: var(--text-main); }
                .player-list { display: flex; flex-wrap: wrap; gap: 8px; }
            `;
            document.head.appendChild(style);
        }
    }
};

// 將物件暴露到全域，確保 HTML 的 onclick 可以呼叫到
window.Registration = Registration;
