const Finals = {
    standardLineupMode: "trio",
    registrations: [],
    winners: [],
    losers: [],
    matches: [],
    chasingData: [],
    awardFreezeTriggered: false,
    awardPendingPodiumData: null,
    awardPlaybackCompleted: false,
    awardSnapshotDataUrl: "",
    awardVideoSrc: "img/award_ceremony.mp4?v=1",
    awardFreezeTimeSec: 22,
    awardAssets: {
        "藍鳥": "img/bird_blue.jpg?v=1",
        "藍鳥隊": "img/bird_blue.jpg?v=1",
        "黑鳥": "img/bird_black.jpg?v=1",
        "黑鳥隊": "img/bird_black.jpg?v=1",
        "青鳥": "img/bird_cyan.jpg?v=1",
        "青鳥隊": "img/bird_cyan.jpg?v=1",
        "粉鳥": "img/bird_pink.jpg?v=1",
        "粉鳥隊": "img/bird_pink.jpg?v=1"
    },
    podiumMap: {
        rank1: { xPct: 50, yPct: 52, logoScale: 1.1, labelWidthPct: 22 },
        rank2: { xPct: 29, yPct: 58, logoScale: 1.0, labelWidthPct: 20 },
        rank3: { xPct: 69, yPct: 61, logoScale: 0.95, labelWidthPct: 20 },
        rank4: { xPct: 84, yPct: 66, logoScale: 0.88, labelWidthPct: 18 }
    },
    lineups: {
        champ: [],  // 冠軍賽
        third: []   // 季軍賽
    },

    async load(silent = false) {
        const chasingRes = await API.getChasingSchedule();
        const regRes = await API.getRegistrations();
        
        if (chasingRes && chasingRes.status === "success" && regRes && regRes.status === "success") {
            const data = chasingRes.data || [];
            this.registrations = regRes.data || [];
            this.chasingData = data;

            // 1. 顯示現有決賽表
            const finalsData = data.filter(m => (String(m["區"]).includes("冠軍賽") || String(m["區"]).includes("季軍賽")));
            const detailData = data.filter(m => (
                String(m["區"]).includes("準決賽") ||
                String(m["區"]).includes("冠軍賽") ||
                String(m["區"]).includes("季軍賽")
            ));
            this.renderTable(finalsData, detailData, data);

            if (silent) return;

            // 2. 判定準決賽勝負以建構編輯器
            // 找出準決賽的最終分進度 (通常是 66分)
            const semiFinals = data.filter(i => {
                const area = String(i["區"] || "");
                const status = String(i["比賽狀態"] || "");
                // 為了保險，搜尋該區最後一場 (比分最高的一場)
                return area.includes("準決賽") && status === "已完賽";
            });

            // 根據區群組化，並找出最高分的場次
            const groups = {};
            semiFinals.forEach(m => {
                if (!groups[m["區"]]) groups[m["區"]] = m;
                const scoreM = (parseInt(m["A隊比分"]) || 0) + (parseInt(m["B隊比分"]) || 0);
                const scoreG = (parseInt(groups[m["區"]]["A隊比分"]) || 0) + (parseInt(groups[m["區"]]["B隊比分"]) || 0);
                if (scoreM > scoreG) groups[m["區"]] = m;
            });

            const finalSemiResults = Object.values(groups);

            if (finalSemiResults.length < 2) {
                const editorEl = document.getElementById("finals-lineup-editor");
                if (editorEl) {
                    editorEl.innerHTML = `
                        <div class="card" style="text-align:center; color:var(--text-dim); padding:2rem;">
                            <i class="fas fa-clock"></i> 準決賽尚未全數完賽 (需有兩組完賽紀錄)，無法自動帶入對戰名單。
                        </div>
                    `;
                }
            } else {
                this.winners = [];
                this.losers = [];
                finalSemiResults.forEach(m => {
                    const sA = parseInt(m["A隊比分"]) || 0;
                    const sB = parseInt(m["B隊比分"]) || 0;
                    const cleanName = (n) => String(n || "").replace(/\s*\(.*\)/g, "").trim();
                    
                    if (sA > sB) {
                        this.winners.push(cleanName(m["A隊名"]));
                        this.losers.push(cleanName(m["B隊名"]));
                    } else {
                        this.winners.push(cleanName(m["B隊名"]));
                        this.losers.push(cleanName(m["A隊名"]));
                    }
                });

                if (this.lineups.champ.length === 0) {
                    this.initDefaultLineups();
                }
                this.renderLineupEditor();
            }
        }

        // 綁定生成按鈕
        const btnGen = document.getElementById("btn-generate-finals");
        if (btnGen) btnGen.onclick = () => this.generateFinalsSchedule();

        const btnAward = document.getElementById("btn-open-award-modal");
        if (btnAward) btnAward.onclick = () => this.openAwardModal();

        // 綁定摺疊按鈕
        const btnToggle = document.getElementById("toggle-finals-editor");
        if (btnToggle) {
            btnToggle.onclick = () => {
                const wrapper = document.getElementById("finals-editor-wrapper");
                const icon = document.getElementById("finals-editor-icon");
                if (wrapper.style.display === "none") {
                    wrapper.style.display = "block";
                    icon.classList.replace("fa-plus", "fa-minus");
                } else {
                    wrapper.style.display = "none";
                    icon.classList.replace("fa-minus", "fa-plus");
                }
            };
        }

        this.bindAwardVideoEvents();
    },

    bindAwardVideoEvents() {
        if (this.awardEventsBound) return;

        const modal = document.getElementById("award-ceremony-modal");
        const closeBtn = document.getElementById("award-modal-close");
        const video = document.getElementById("award-ceremony-video");
        const compareVideo = document.getElementById("award-compare-video");
        const showOverlayBtn = document.getElementById("award-show-overlay-btn");
        const syncCompareBtn = document.getElementById("award-sync-compare-btn");
        if (!modal || !closeBtn || !video) return;

        video.crossOrigin = "anonymous";
        video.controls = true;
        if (compareVideo) compareVideo.crossOrigin = "anonymous";
        closeBtn.onclick = () => this.closeAwardModal();
        if (showOverlayBtn) showOverlayBtn.onclick = () => this.showAwardOverlayManually();
        if (syncCompareBtn) syncCompareBtn.onclick = () => this.syncAwardCompareFrame();
        modal.onclick = event => {
            if (event.target === modal) this.closeAwardModal();
        };

        video.ontimeupdate = null;
        video.onended = async () => {
            this.holdAwardVideoOnDisplayFrame(video);
            this.awardPlaybackCompleted = true;
            await this.captureAwardSnapshot(video);
            if (showOverlayBtn) showOverlayBtn.disabled = true;
            await this.showAwardOverlayManually();
            return;
            this.updateAwardStatus(snapshotReady ? "影片播放完成，可按「顯示頒獎名單」帶出隊伍資訊" : "影片播放完成，但無法建立快照，顯示頒獎名單時將直接疊在影片上", snapshotReady ? "success" : "info");
            return;
            this.updateAwardStatus("影片播放完成，可按「顯示頒獎名單」帶出隊伍資訊", "success");
        };
        video.onloadedmetadata = () => {
            this.awardPlaybackCompleted = false;
            this.resetAwardSnapshotLayer();
            this.hideAwardEmpty();
            if (showOverlayBtn) showOverlayBtn.disabled = true;
            this.updateAwardStatus("Award video loaded. Preparing playback...", "info");
            return;
            this.updateAwardStatus("影片載入完成，正在準備播放頒獎影片...", "info");
            return;
            this.updateAwardStatus("影片載入完成，正在準備播放頒獎影片...", "info");
        };
        video.onerror = () => {
            this.awardPlaybackCompleted = false;
            this.resetAwardSnapshotLayer();
            this.updateAwardStatus("Award mp4 not found: img/award_ceremony.mp4", "error");
            this.showAwardEmpty("Award mp4 not found: img/award_ceremony.mp4");
            if (showOverlayBtn) showOverlayBtn.disabled = true;
            return;
            this.updateAwardStatus("找不到頒獎 mp4，請將影片放到 img/award_ceremony.mp4", "error");
            this.showAwardEmpty("找不到頒獎 mp4，請將影片放到 img/award_ceremony.mp4");
            if (showOverlayBtn) showOverlayBtn.disabled = true;
            return;
            this.updateAwardStatus("找不到頒獎 mp4，請將影片放到 img/award_ceremony.mp4", "error");
            this.showAwardEmpty("找不到頒獎 mp4，請將影片放到 img/award_ceremony.mp4");
            if (showOverlayBtn) showOverlayBtn.disabled = true;
        };

        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && modal.classList.contains("show")) {
                this.closeAwardModal();
            }
        });

        this.awardEventsBound = true;
    },

    normalizeTeamName(teamName) {
        return String(teamName || "").replace(/\s*\(.*\)/g, "").replace(/\s+/g, "").trim();
    },

    getTeamAsset(teamName) {
        const normalized = this.normalizeTeamName(teamName);
        return this.awardAssets[normalized] || "";
    },

    getTeamMembers(teamName) {
        const normalized = this.normalizeTeamName(teamName);
        return this.registrations
            .filter(player => this.normalizeTeamName(player["隊名"]) === normalized)
            .map(player => String(player["姓名"] || "").trim())
            .filter(Boolean);
    },

    updateAwardStatus(message, type = "info") {
        const statusEl = document.getElementById("award-modal-status");
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.className = `award-modal-status ${type}`.trim();
    },

    showAwardEmpty(message) {
        const emptyEl = document.getElementById("award-modal-empty");
        const overlayEl = document.getElementById("award-overlay-layer");
        if (emptyEl) {
            emptyEl.hidden = false;
            emptyEl.innerHTML = `<div class="award-modal-empty-text">${this.escapeHtml(message)}</div>`;
        }
        if (overlayEl) overlayEl.innerHTML = "";
    },

    hideAwardEmpty() {
        const emptyEl = document.getElementById("award-modal-empty");
        if (!emptyEl) return;
        emptyEl.hidden = true;
        emptyEl.innerHTML = "";
    },

    resetAwardSnapshotLayer() {
        const video = document.getElementById("award-ceremony-video");
        const snapshotEl = document.getElementById("award-podium-snapshot");
        const frameEl = document.getElementById("award-video-frame");
        if (frameEl) frameEl.classList.remove("snapshot-active");
        if (video) {
            video.hidden = false;
            video.style.display = "";
        }
        if (snapshotEl) {
            snapshotEl.hidden = true;
            snapshotEl.classList.remove("show");
            snapshotEl.removeAttribute("src");
        }
        this.awardSnapshotDataUrl = "";
    },

    async captureAwardSnapshot(video) {
        const snapshotEl = document.getElementById("award-podium-snapshot");
        if (!video || !snapshotEl) return false;

        const width = video.videoWidth || 0;
        const height = video.videoHeight || 0;
        if (!width || !height) return false;

        try {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d", { alpha: false });
            if (!ctx) return false;

            ctx.drawImage(video, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/png");
            if (!dataUrl || !dataUrl.startsWith("data:image/")) return false;

            snapshotEl.src = dataUrl;
            this.awardSnapshotDataUrl = dataUrl;
            return true;
        } catch (error) {
            this.awardSnapshotDataUrl = "";
            snapshotEl.removeAttribute("src");
            return false;
        }
    },

    showAwardSnapshotLayer() {
        const video = document.getElementById("award-ceremony-video");
        const snapshotEl = document.getElementById("award-podium-snapshot");
        const frameEl = document.getElementById("award-video-frame");
        if (!snapshotEl || !this.awardSnapshotDataUrl) return false;

        snapshotEl.src = this.awardSnapshotDataUrl;
        snapshotEl.hidden = false;
        snapshotEl.classList.add("show");
        if (frameEl) frameEl.classList.add("snapshot-active");
        if (video) {
            video.hidden = true;
            video.style.display = "none";
        }
        return true;
    },

    getAwardRankRow(areaKeyword) {
        const matches = (this.chasingData || [])
            .filter(match => String(match["區"] || "").includes(areaKeyword) && String(match["比賽狀態"] || "").includes("完賽"))
            .sort((a, b) => {
                const seqA = parseInt(this.read(a, ["序號"], 0), 10) || 0;
                const seqB = parseInt(this.read(b, ["序號"], 0), 10) || 0;
                if (seqA !== seqB) return seqA - seqB;
                return String(this.read(a, ["比賽時間"], "")).localeCompare(String(this.read(b, ["比賽時間"], "")), "zh-Hant");
            });
        return matches.length ? matches[matches.length - 1] : null;
    },

    resolveFinalRanksFromChasing() {
        const champRow = this.getAwardRankRow("冠軍賽");
        const thirdRow = this.getAwardRankRow("季軍賽");
        if (!champRow || !thirdRow) return null;

        const champA = parseInt(this.read(champRow, ["A隊比分"], 0), 10) || 0;
        const champB = parseInt(this.read(champRow, ["B隊比分"], 0), 10) || 0;
        const thirdA = parseInt(this.read(thirdRow, ["A隊比分"], 0), 10) || 0;
        const thirdB = parseInt(this.read(thirdRow, ["B隊比分"], 0), 10) || 0;

        if (champA === champB || thirdA === thirdB) return null;

        return {
            rank1: champA > champB ? this.read(champRow, ["A隊名"], "") : this.read(champRow, ["B隊名"], ""),
            rank2: champA > champB ? this.read(champRow, ["B隊名"], "") : this.read(champRow, ["A隊名"], ""),
            rank3: thirdA > thirdB ? this.read(thirdRow, ["A隊名"], "") : this.read(thirdRow, ["B隊名"], ""),
            rank4: thirdA > thirdB ? this.read(thirdRow, ["B隊名"], "") : this.read(thirdRow, ["A隊名"], "")
        };
    },

    buildAwardPodiumData() {
        const ranks = this.resolveFinalRanksFromChasing();
        if (!ranks) return null;

        return ["rank1", "rank2", "rank3", "rank4"].map(rankKey => {
            const teamName = ranks[rankKey];
            return {
                rank: rankKey.replace("rank", ""),
                teamName,
                shortTeamName: this.getShortTeamName(teamName),
                birdAsset: this.getTeamAsset(teamName),
                members: this.getTeamMembers(teamName),
                position: this.podiumMap[rankKey]
            };
        });
    },

    renderAwardOverlays(podiumData) {
        const overlayEl = document.getElementById("award-overlay-layer");
        if (!overlayEl) return;

        overlayEl.innerHTML = (podiumData || []).map(item => {
            const style = [
                `left:${item.position.xPct}%`,
                `top:${item.position.yPct}%`,
                `--award-logo-scale:${item.position.logoScale}`,
                `--award-label-width:${item.position.labelWidthPct}%`
            ].join(";");
            const membersText = item.members.length ? item.members.join(" / ") : "尚未帶入隊員名單";
            const logoHtml = item.birdAsset
                ? `<img src="${item.birdAsset}" alt="${this.escapeHtml(item.shortTeamName)}" class="award-podium-logo">`
                : `<div class="award-podium-logo award-podium-logo-fallback">${this.escapeHtml(item.shortTeamName)}</div>`;

            return `
                <div class="award-podium-item" style="${style}">
                    <div class="award-podium-rank">#${this.escapeHtml(item.rank)}</div>
                    ${logoHtml}
                    <div class="award-podium-team">${this.escapeHtml(item.shortTeamName)}</div>
                    <div class="award-podium-members">${this.escapeHtml(membersText)}</div>
                </div>
            `;
        }).join("");
    },

    async attemptAwardAutoplay(video) {
        if (!video) return;

        try {
            await video.play();
            this.updateAwardStatus("Award video is playing...", "info");
            return;
            this.updateAwardStatus("頒獎影片播放中...", "info");
        } catch (primaryError) {
            try {
                video.defaultMuted = true;
                video.muted = true;
                video.setAttribute("muted", "");
                await video.play();
                this.updateAwardStatus("Autoplay switched to muted mode. Podium list stays hidden until playback ends.", "info");
                return;
                this.updateAwardStatus("自動播放音訊可能被瀏覽器限制，已改為靜音自動播放，播放完可按按鈕顯示隊伍資訊", "info");
            } catch (fallbackError) {
                video.controls = true;
                this.updateAwardStatus("Autoplay blocked. Please press play.", "error");
                return;
                this.updateAwardStatus("瀏覽器阻擋自動播放，請按一下播放鍵", "error");
            }
        }
    },

    async openAwardModal() {
        const podiumData = this.buildAwardPodiumData();
        if (!podiumData) {
            alert("Final results are incomplete. Award modal is unavailable.");
            return;
            alert("決賽結果尚未完整，無法產生頒獎畫面");
            return;
        }

        const modal = document.getElementById("award-ceremony-modal");
        const video = document.getElementById("award-ceremony-video");
        const compareVideo = document.getElementById("award-compare-video");
        const overlayEl = document.getElementById("award-overlay-layer");
        const showOverlayBtn = document.getElementById("award-show-overlay-btn");
        if (!modal || !video || !overlayEl) return;

        this.awardFreezeTriggered = false;
        this.awardPlaybackCompleted = false;
        this.awardPendingPodiumData = podiumData;
        this.resetAwardSnapshotLayer();
        overlayEl.innerHTML = "";
        overlayEl.classList.remove("show");
        this.hideAwardEmpty();
        this.updateAwardStatus("Loading award video...", "info");
        this.updateAwardStatus("載入頒獎影片中...", "info");
        this.updateAwardStatus("Loading award video...", "info");
        if (showOverlayBtn) showOverlayBtn.disabled = true;

        modal.classList.add("show");
        document.body.classList.add("award-modal-open");

        video.pause();
        video.currentTime = 0;
        video.crossOrigin = "anonymous";
        video.controls = true;
        video.autoplay = true;
        video.preload = "auto";
        video.playsInline = true;
        video.defaultMuted = false;
        video.muted = false;
        video.removeAttribute("muted");
        video.removeAttribute("src");
        video.src = this.awardVideoSrc;
        video.load();

        if (compareVideo) {
            compareVideo.pause();
            compareVideo.currentTime = 0;
            compareVideo.crossOrigin = "anonymous";
            compareVideo.preload = "metadata";
            compareVideo.removeAttribute("src");
            compareVideo.src = this.awardVideoSrc;
            compareVideo.load();
        }

        if (video.readyState >= 3) {
            await this.attemptAwardAutoplay(video);
            return;
        }

        video.addEventListener("canplay", () => {
            this.attemptAwardAutoplay(video);
        }, { once: true });
        return;

        try {
            await video.play();
            this.updateAwardStatus("頒獎影片播放中...", "info");
        } catch (primaryError) {
            try {
                video.defaultMuted = true;
                video.muted = true;
                video.setAttribute("muted", "");
                await video.play();
                this.updateAwardStatus("瀏覽器限制自動播放音訊，已改為靜音自動播放，可用控制列手動開啟聲音", "info");
            } catch (fallbackError) {
                video.controls = true;
                this.updateAwardStatus("瀏覽器阻擋自動播放，請直接按影片控制列的播放鍵開始播放", "error");
            }
        }
    },

    syncAwardCompareFrame() {
        const video = document.getElementById("award-ceremony-video");
        const compareVideo = document.getElementById("award-compare-video");
        if (!video || !compareVideo) return;

        const applySync = () => {
            const duration = Number.isFinite(compareVideo.duration) ? compareVideo.duration : 0;
            const targetTime = duration > 0
                ? Math.min(Math.max(video.currentTime || 0, 0), Math.max(duration - 0.05, 0))
                : Math.max(video.currentTime || 0, 0);
            compareVideo.pause();
            compareVideo.currentTime = targetTime;
        };

        if (compareVideo.readyState >= 1) {
            applySync();
            return;
        }

        compareVideo.addEventListener("loadedmetadata", applySync, { once: true });
    },

    holdAwardVideoOnDisplayFrame(video) {
        if (!video) return;
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const holdTime = duration > 0 ? Math.max(duration - 0.05, 0) : Math.max(video.currentTime || 0, 0);
        if (Math.abs((video.currentTime || 0) - holdTime) > 0.001) {
            video.currentTime = holdTime;
        }
        video.pause();
    },

    async showAwardOverlayManually() {
        const overlayEl = document.getElementById("award-overlay-layer");
        const video = document.getElementById("award-ceremony-video");
        const showOverlayBtn = document.getElementById("award-show-overlay-btn");
        const podiumData = this.awardPendingPodiumData || this.buildAwardPodiumData();

        if (!overlayEl || !video || !podiumData) return;
        if (!this.awardPlaybackCompleted) {
            this.updateAwardStatus("Finish the video first, then show the podium list.", "info");
            return;
            this.updateAwardStatus("請先播放完頒獎影片，再顯示頒獎名單", "info");
            return;
        }

        this.awardPendingPodiumData = podiumData;
        this.awardFreezeTriggered = true;
        this.holdAwardVideoOnDisplayFrame(video);

        let usedSnapshot = this.showAwardSnapshotLayer();
        if (!usedSnapshot) {
            const snapshotReady = await this.captureAwardSnapshot(video);
            if (snapshotReady) {
                usedSnapshot = this.showAwardSnapshotLayer();
            }
        }

        this.renderAwardOverlays(podiumData);
        video.controls = false;
        overlayEl.classList.add("show");
        this.syncAwardCompareFrame();
        if (showOverlayBtn) showOverlayBtn.disabled = true;
        this.updateAwardStatus(usedSnapshot ? "Snapshot ready. Podium overlay is now visible." : "Snapshot failed. Overlay is shown on the video frame.", usedSnapshot ? "success" : "info");
        return;
        this.updateAwardStatus(usedSnapshot ? "已切換為頒獎台快照並顯示 1~4 名隊伍資訊" : "快照建立失敗，已改為直接顯示頒獎名單", usedSnapshot ? "success" : "info");
        return;
        this.updateAwardStatus("已顯示 1~4 名隊伍與全隊名單", "success");
    },

    freezeAwardVideo() {
        if (this.awardFreezeTriggered) return;

        const video = document.getElementById("award-ceremony-video");
        const overlayEl = document.getElementById("award-overlay-layer");
        if (!video || !overlayEl) return;

        this.awardFreezeTriggered = true;
        video.pause();
        overlayEl.classList.add("show");
        this.updateAwardStatus("頒獎台已定位，顯示 1~4 名隊伍與全隊名單", "success");
    },

    closeAwardModal() {
        const modal = document.getElementById("award-ceremony-modal");
        const video = document.getElementById("award-ceremony-video");
        const compareVideo = document.getElementById("award-compare-video");
        const overlayEl = document.getElementById("award-overlay-layer");
        const showOverlayBtn = document.getElementById("award-show-overlay-btn");
        if (!modal || !video || !overlayEl) return;

        this.awardFreezeTriggered = false;
        this.awardPlaybackCompleted = false;
        this.awardPendingPodiumData = null;
        modal.classList.remove("show");
        document.body.classList.remove("award-modal-open");
        overlayEl.classList.remove("show");
        overlayEl.innerHTML = "";
        this.resetAwardSnapshotLayer();
        this.hideAwardEmpty();
        this.updateAwardStatus("載入頒獎畫面中...", "info");
        if (showOverlayBtn) showOverlayBtn.disabled = true;
        video.pause();
        video.currentTime = 0;
        video.controls = true;
        video.defaultMuted = false;
        video.muted = false;
        video.removeAttribute("muted");
        video.removeAttribute("src");
        video.load();
        if (compareVideo) {
            compareVideo.pause();
            compareVideo.currentTime = 0;
            compareVideo.removeAttribute("src");
            compareVideo.load();
        }
    },

    initDefaultLineups() {
        const defaults = this.getDefaultRows();
        this.lineups.champ = JSON.parse(JSON.stringify(defaults));
        this.lineups.third = JSON.parse(JSON.stringify(defaults));
    },

    createEmptyLineupRow(targetScore = "分接力") {
        return {
            targetScore,
            A1: "", A2: "", A3: "",
            B1: "", B2: "", B3: ""
        };
    },

    getDefaultRows() {
        if (this.standardLineupMode === "trio") {
            return [
                this.createEmptyLineupRow("第一組3劍客搶25分"),
                this.createEmptyLineupRow("第二組3劍客搶25分"),
                this.createEmptyLineupRow("第三組3劍客(1:1平)搶10分")
            ];
        }

        return [11, 22, 33, 44, 55, 66].map(s => (
            this.createEmptyLineupRow(s + "分接力")
        ));
    },

    updateStandardLineupMode(mode) {
        this.standardLineupMode = mode === "doubles" ? "doubles" : "trio";
        this.initDefaultLineups();
        this.renderLineupEditor();
    },

    renderLineupEditor() {
        const container = document.getElementById("finals-lineup-editor");
        if (!container) return;

        const matchChamp = { teamA: this.winners[0], teamB: this.winners[1], court: "C", area: "冠軍賽", id: "champ" };
        const matchThird = { teamA: this.losers[0], teamB: this.losers[1], court: "B", area: "季軍賽", id: "third" };

        container.innerHTML = `
            <div class="card" style="margin-bottom:1rem; padding:1rem 1.2rem;">
                <div style="display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap;">
                    <label for="finals-lineup-mode" style="color:var(--primary); font-weight:700; white-space:nowrap;">手動設定出場順序模式</label>
                    <select id="finals-lineup-mode" style="min-width:220px; padding:0.65rem 0.85rem; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:white; border-radius:8px;">
                        <option value="trio" ${this.standardLineupMode === "trio" ? "selected" : ""}>1. 團體3劍客</option>
                        <option value="doubles" ${this.standardLineupMode === "doubles" ? "selected" : ""}>2. 雙打追分賽</option>
                    </select>
                    <span style="color:var(--text-dim); font-size:0.85rem;">切換後會重建冠軍/季軍賽預設棒次。</span>
                </div>
            </div>
            ${this.buildMatchEditor(matchChamp)}
            ${this.buildMatchEditor(matchThird)}
        `;

        const modeSelect = document.getElementById("finals-lineup-mode");
        if (modeSelect) {
            modeSelect.onchange = event => this.updateStandardLineupMode(event.target.value);
        }
    },

    buildMatchEditor(m) {
        const cleanName = (n) => String(n || "").replace(/\s*\(.*\)/g, "").trim();
        const playersA = this.registrations.filter(r => cleanName(r["隊名"]) === cleanName(m.teamA));
        const playersB = this.registrations.filter(r => cleanName(r["隊名"]) === cleanName(m.teamB));

        const rows = this.lineups[m.id].map((row, idx) => `
            <tr>
                <td><input type="text" class="score-input" value="${row.targetScore}" onchange="Finals.updateRow('${m.id}', ${idx}, 'targetScore', this.value)"></td>
                <td>${this.buildPlayerSelect(playersA, row.A1, (val) => Finals.updateRow(m.id, idx, 'A1', val))}</td>
                <td>${this.buildPlayerSelect(playersA, row.A2, (val) => Finals.updateRow(m.id, idx, 'A2', val))}</td>
                <td>${this.buildPlayerSelect(playersA, row.A3, (val) => Finals.updateRow(m.id, idx, 'A3', val))}</td>
                <td style="color:var(--primary); font-weight:bold;">VS</td>
                <td>${this.buildPlayerSelect(playersB, row.B1, (val) => Finals.updateRow(m.id, idx, 'B1', val))}</td>
                <td>${this.buildPlayerSelect(playersB, row.B2, (val) => Finals.updateRow(m.id, idx, 'B2', val))}</td>
                <td>${this.buildPlayerSelect(playersB, row.B3, (val) => Finals.updateRow(m.id, idx, 'B3', val))}</td>
            </tr>
        `).join("");

        return `
            <div class="match-setup-card animate-fadeIn">
                <h3 style="color:#ffd700;"><i class="fas fa-trophy"></i> ${m.area}: ${m.teamA} vs ${m.teamB} (場地: ${m.court})</h3>
                <div class="table-container">
                    <table class="lineup-table">
                        <thead>
                            <tr>
                                <th>目標分</th>
                                <th>A隊員1</th>
                                <th>A隊員2</th>
                                <th>A隊員3</th>
                                <th></th>
                                <th>B隊員1</th>
                                <th>B隊員2</th>
                                <th>B隊員3</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div class="lineup-actions">
                    <button class="btn-add-round" onclick="Finals.addRound('${m.id}')"><i class="fas fa-plus"></i> 新增一輪</button>
                    <button class="btn-remove-round" onclick="Finals.removeRound('${m.id}')"><i class="fas fa-minus"></i> 刪除最後一輪</button>
                </div>
            </div>
        `;
    },

    buildPlayerSelect(players, current, onChange) {
        const id = 'fsel-' + Math.random().toString(36).substr(2, 9);
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) el.onchange = (e) => onChange(e.target.value);
        }, 0);

        let options = `<option value="">--選擇--</option>`;
        players.forEach(p => {
            options += `<option value="${p["姓名"]}" ${p["姓名"] === current ? 'selected' : ''}>${p["姓名"]}</option>`;
        });
        return `<select id="${id}">${options}</select>`;
    },

    updateRow(id, idx, field, val) {
        this.lineups[id][idx][field] = val;
    },

    addRound(id) {
        const defaultLabel = this.standardLineupMode === "trio"
            ? "加開3劍客"
            : "分接力";
        this.lineups[id].push({ targetScore: defaultLabel, A1: "", A2: "", A3: "", B1: "", B2: "", B3: "" });
        this.renderLineupEditor();
    },

    removeRound(id) {
        if (this.lineups[id].length > 1) {
            this.lineups[id].pop();
            this.renderLineupEditor();
        }
    },

    async generateFinalsSchedule() {
        const champData = this.lineups.champ.map(row => ({
            ...row,
            teamA: this.winners[0],
            teamB: this.winners[1],
            court: "C",
            area: "冠軍賽"
        }));
        const thirdData = this.lineups.third.map(row => ({
            ...row,
            teamA: this.losers[0],
            teamB: this.losers[1],
            court: "B",
            area: "季軍賽"
        }));

        const allData = [...champData, ...thirdData];

        const invalid = allData.some(d => !d.A1 || !d.A2 || !d.B1 || !d.B2);
        if (invalid) {
            alert("請確保每一輪的隊員1與隊員2皆已填寫！");
            return;
        }

        if (!confirm("確定要依據上述「出場順序表」產生「決賽」賽程嗎？\n(這會寫入追分賽紀錄表，若已存在該月決賽資料將被覆蓋)")) return;

        const btn = document.getElementById("btn-generate-finals");
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 正在傳送賽程資料...`;
        btn.disabled = true;

        try {
            let res = await API.generateFinals(allData);
            if (res && res.status === "warning" && res.code === "ALREADY_EXISTS") {
                const overwrite = window.confirm(
                    `追分賽紀錄表中已存在本日資料 ${res.count} 筆。\n\n是否覆蓋決賽賽程資料？`
                );
                if (!overwrite) return;
                res = await API.generateFinals(allData, "overwrite");
            }

            if (res && res.status === "success") {
                alert("決賽賽程已成功產生！");
                this.load();
            }
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    read(match, keys, fallback = "") {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
            const value = match && match[key];
            if (value !== undefined && value !== null && String(value) !== "") {
                return value;
            }
        }
        return fallback;
    },

    escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, ch => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        }[ch]));
    },

    getShortTeamName(teamName) {
        return String(teamName || "").trim().replace(/隊$/, "");
    },

    getAreaSortWeight(area) {
        const text = String(area || "");
        if (text.includes("準決賽")) return 0;
        if (text.includes("冠軍賽")) return 1;
        if (text.includes("季軍賽")) return 2;
        return 9;
    },

    getRoundSortWeight(round) {
        const text = String(round || "").replace(/\s+/g, "");
        if (text.includes("第一組3劍客")) return 1;
        if (text.includes("第二組3劍客")) return 2;
        if (text.includes("第三組3劍客")) return 3;
        const numberMatch = text.match(/(\d+)/);
        return numberMatch ? 100 + (parseInt(numberMatch[1], 10) || 0) : 999;
    },

    getRoundMeta(round) {
        const text = String(round || "").replace(/\s+/g, "");
        if (text.includes("第一組3劍客")) {
            return {
                key: "round1",
                title: "第一組3劍客 搶25分",
                cells: ["A(1~8)", "B(9~16)", "C(17~24)"]
            };
        }
        if (text.includes("第二組3劍客")) {
            return {
                key: "round2",
                title: "第二組3劍客 搶25分",
                cells: ["A(1~8)", "B(9~16)", "C(17~24)"]
            };
        }
        if (text.includes("第三組3劍客")) {
            return {
                key: "round3",
                title: "第三組3劍客(1:1平手) 搶10分",
                cells: ["A(1~3)", "B(4~6)", "C(7~9)"]
            };
        }
        return null;
    },

    parseTimeToMinutes(timeText) {
        const match = String(timeText || "").trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return null;
        return (parseInt(match[1], 10) || 0) * 60 + (parseInt(match[2], 10) || 0);
    },

    formatMinutesToTime(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    },

    getTimeOrderList(allData) {
        const uniqueTimes = [...new Set((allData || [])
            .map(match => String(this.read(match, ["比賽時間"], "")).trim())
            .filter(Boolean))];

        return uniqueTimes.sort((a, b) => {
            const timeA = this.parseTimeToMinutes(a);
            const timeB = this.parseTimeToMinutes(b);
            if (timeA !== null && timeB !== null) return timeA - timeB;
            return a.localeCompare(b, "zh-Hant");
        });
    },

    buildTimeMetaMap(allData) {
        const timeList = this.getTimeOrderList(allData);
        const metaMap = {};
        timeList.forEach((time, index) => {
            const nextTime = timeList[index + 1];
            const startMinutes = this.parseTimeToMinutes(time);
            const nextMinutes = this.parseTimeToMinutes(nextTime);
            let rangeText = time;

            if (startMinutes !== null) {
                const endText = nextMinutes !== null
                    ? this.formatMinutesToTime(nextMinutes)
                    : this.formatMinutesToTime(startMinutes + 45);
                rangeText = `${time}~${endText}`;
            }

            metaMap[time] = {
                slotNo: index + 1,
                rangeText
            };
        });
        return metaMap;
    },

    getSlotGroups(data) {
        const sorted = [...(data || [])].sort((a, b) => {
            const timeDiff = String(this.read(a, ["比賽時間"], "")).localeCompare(String(this.read(b, ["比賽時間"], "")), "zh-Hant");
            if (timeDiff !== 0) return timeDiff;

            const areaDiff = this.getAreaSortWeight(this.read(a, ["區"], "")) - this.getAreaSortWeight(this.read(b, ["區"], ""));
            if (areaDiff !== 0) return areaDiff;

            const courtDiff = String(this.read(a, ["場地"], "")).localeCompare(String(this.read(b, ["場地"], "")), "zh-Hant");
            if (courtDiff !== 0) return courtDiff;

            const roundDiff = this.getRoundSortWeight(this.read(a, ["輪次"], "")) - this.getRoundSortWeight(this.read(b, ["輪次"], ""));
            if (roundDiff !== 0) return roundDiff;

            return (parseInt(this.read(a, ["序號"], 0), 10) || 0) - (parseInt(this.read(b, ["序號"], 0), 10) || 0);
        });

        const slots = [];
        const slotMap = new Map();

        sorted.forEach(match => {
            const time = String(this.read(match, ["比賽時間"], "未排時間")).trim() || "未排時間";
            let slot = slotMap.get(time);
            if (!slot) {
                slot = { time, matches: [] };
                slotMap.set(time, slot);
                slots.push(slot);
            }

            const groupKey = [
                this.read(match, ["區"], ""),
                this.read(match, ["場地"], ""),
                this.read(match, ["A隊名"], ""),
                this.read(match, ["B隊名"], "")
            ].join("||");

            let grouped = slot.matches.find(item => item.key === groupKey);
            if (!grouped) {
                grouped = {
                    key: groupKey,
                    area: String(this.read(match, ["區"], "")).trim(),
                    court: String(this.read(match, ["場地"], "")).trim(),
                    teamA: String(this.read(match, ["A隊名"], "")).trim(),
                    teamB: String(this.read(match, ["B隊名"], "")).trim(),
                    referees: [],
                    statuses: [],
                    rows: []
                };
                slot.matches.push(grouped);
            }

            const referee = String(this.read(match, ["裁判"], "")).trim();
            if (referee && !grouped.referees.includes(referee)) grouped.referees.push(referee);

            const status = String(this.read(match, ["比賽狀態"], "")).trim();
            if (status && !grouped.statuses.includes(status)) grouped.statuses.push(status);

            grouped.rows.push(match);
        });

        slots.forEach(slot => {
            slot.matches.sort((a, b) => {
                const areaDiff = this.getAreaSortWeight(a.area) - this.getAreaSortWeight(b.area);
                if (areaDiff !== 0) return areaDiff;
                return String(a.court || "").localeCompare(String(b.court || ""), "zh-Hant");
            });
        });

        return slots;
    },

    getScoreDisplay(match, prefix) {
        if (!match) return "";
        const field = prefix === "A" ? "A隊比分" : "B隊比分";
        const value = match[field];
        return value === undefined || value === null || value === "" ? "" : String(value);
    },

    getPlayers(match, prefix) {
        if (!match) return ["", "", ""];
        return [1, 2, 3].map(index => String(this.read(match, [`${prefix}隊員${index}`], "")).trim());
    },

    renderPlayerCells(players) {
        return players.map(player => `
            <td class="finals-detail-player${player ? "" : " is-empty"}">${this.escapeHtml(player || "")}</td>
        `).join("");
    },

    renderScoreCells(score) {
        return `
            <td colspan="2" class="finals-detail-score-label">分數</td>
            <td class="finals-detail-score-value">${this.escapeHtml(score || "")}</td>
        `;
    },

    renderTeamRows(teamName, roundRows, prefix) {
        const playerCells = roundRows.map(match => this.renderPlayerCells(this.getPlayers(match, prefix))).join("");
        const scoreCells = roundRows.map(match => this.renderScoreCells(this.getScoreDisplay(match, prefix))).join("");
        return `
            <tr>
                <th rowspan="2" class="finals-detail-team-name">${this.escapeHtml(this.getShortTeamName(teamName || ""))}</th>
                ${playerCells}
            </tr>
            <tr>
                ${scoreCells}
            </tr>
        `;
    },

    renderTrioMatchTable(matchGroup) {
        const roundOrder = ["round1", "round2", "round3"];
        const metaMap = {
            round1: this.getRoundMeta("第一組3劍客"),
            round2: this.getRoundMeta("第二組3劍客"),
            round3: this.getRoundMeta("第三組3劍客")
        };
        const rowMap = {};
        (matchGroup.rows || []).forEach(match => {
            const meta = this.getRoundMeta(this.read(match, ["輪次"], ""));
            if (meta && !rowMap[meta.key]) rowMap[meta.key] = match;
        });

        const roundRows = roundOrder.map(key => rowMap[key] || null);

        return `
            <div class="finals-detail-match-card">
                <table class="finals-detail-table">
                    <thead>
                        <tr>
                            <th class="finals-detail-court-header">場地${this.escapeHtml(matchGroup.court || "")}</th>
                            ${roundOrder.map(key => `<th colspan="3">${this.escapeHtml(metaMap[key].title)}</th>`).join("")}
                        </tr>
                        <tr>
                            <th class="finals-detail-court-subhead"></th>
                            ${roundOrder.map(key => metaMap[key].cells.map(cell => `
                                <th class="finals-detail-subhead">${this.escapeHtml(cell)}</th>
                            `).join("")).join("")}
                        </tr>
                    </thead>
                    <tbody>
                        ${this.renderTeamRows(matchGroup.teamA, roundRows, "A")}
                        ${this.renderTeamRows(matchGroup.teamB, roundRows, "B")}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderStandardMatchTable(matchGroup) {
        const rows = [...(matchGroup.rows || [])].sort((a, b) =>
            this.getRoundSortWeight(this.read(a, ["輪次"], "")) - this.getRoundSortWeight(this.read(b, ["輪次"], ""))
        );

        return `
            <div class="finals-detail-match-card">
                <table class="finals-detail-fallback-table">
                    <thead>
                        <tr>
                            <th>輪次</th>
                            <th>${this.escapeHtml(this.getShortTeamName(matchGroup.teamA))}</th>
                            <th>比分</th>
                            <th>${this.escapeHtml(this.getShortTeamName(matchGroup.teamB))}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(match => `
                            <tr>
                                <td>${this.escapeHtml(this.read(match, ["輪次"], ""))}</td>
                                <td>${this.escapeHtml(this.getPlayers(match, "A").filter(Boolean).join(" / "))}</td>
                                <td class="finals-detail-fallback-score">${this.escapeHtml(this.getScoreDisplay(match, "A"))} : ${this.escapeHtml(this.getScoreDisplay(match, "B"))}</td>
                                <td>${this.escapeHtml(this.getPlayers(match, "B").filter(Boolean).join(" / "))}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderDetailSection(data, allData) {
        const slots = this.getSlotGroups(data);
        if (!slots.length) return "";
        const timeMetaMap = this.buildTimeMetaMap(allData);

        return `
            <div class="finals-detail-wrapper">
                <div class="finals-detail-title">決賽明細表</div>
                ${slots.map((slot, index) => `
                    <section class="finals-detail-slot">
                        <div class="finals-detail-slot-label">時段${this.escapeHtml((timeMetaMap[slot.time] && timeMetaMap[slot.time].slotNo) || (index + 1))}:${this.escapeHtml((timeMetaMap[slot.time] && timeMetaMap[slot.time].rangeText) || slot.time)}</div>
                        <div class="finals-detail-slot-content">
                            ${slot.matches.map(matchGroup => {
                                const isTrio = (matchGroup.rows || []).some(match => this.getRoundMeta(this.read(match, ["輪次"], "")));
                                return isTrio ? this.renderTrioMatchTable(matchGroup) : this.renderStandardMatchTable(matchGroup);
                            }).join("")}
                        </div>
                    </section>
                `).join("")}
            </div>
        `;
    },

    renderSummarySection(data) {
        let html = `
            <div class="finals-summary-wrapper">
                <div class="finals-detail-title">決賽總覽</div>
                <table class="pivot-table">
                    <thead>
                        <tr>
                            <th style="width: 120px;">分</th>
                            <th>區/場地</th>
                            <th>A隊對戰</th>
                            <th>A隊員</th>
                            <th style="width: 60px;">分</th>
                            <th style="width: 60px;">分</th>
                            <th>B隊對戰</th>
                            <th>B隊員</th>
                            <th style="width: 130px;">狀態</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.forEach((m, idx) => {
            const isDone = m["比賽狀態"] === "已完賽";
            const pA = [m["A隊員1"], m["A隊員2"], m["A隊員3"]].filter(p => p && p !== "待定").join(" / ");
            const pB = [m["B隊員1"], m["B隊員2"], m["B隊員3"]].filter(p => p && p !== "待定").join(" / ");
            const isChamp = String(m["區"]).includes("冠軍賽");

            const isUmpire = typeof currentRole !== "undefined" && currentRole === "umpire";
            const voiceBtn = isUmpire ? `
                <button class="btn-icon" onclick="SpeechManager.announceMatch(Finals.matches[${idx}], 'finals')" title="語音播報" style="margin-left:8px; color:var(--accent);">
                    <i class="fas fa-volume-up"></i>
                </button>
            ` : "";

            html += `
                <tr style="${isChamp ? "background:rgba(255,215,0,0.05); border-left:4px solid gold;" : "border-left:4px solid #cd7f32;"}">
                    <td><strong>${this.escapeHtml(m["輪次"])}</strong></td>
                    <td><span class="badge" style="background:${isChamp ? "gold" : "#cd7f32"}; color:#000;">${this.escapeHtml(m["區"])}</span><br/>${this.escapeHtml(m["場地"])}場</td>
                    <td><strong style="color:var(--primary);">${this.escapeHtml(m["A隊名"])}</strong></td>
                    <td style="font-size:0.85rem;">${this.escapeHtml(pA)}</td>
                    <td style="font-size: 1.1rem; font-weight: bold;">${this.escapeHtml(m["A隊比分"] || 0)}</td>
                    <td style="font-size: 1.1rem; font-weight: bold;">${this.escapeHtml(m["B隊比分"] || 0)}</td>
                    <td><strong style="color:var(--accent);">${this.escapeHtml(m["B隊名"])}</strong></td>
                    <td style="font-size:0.85rem;">${this.escapeHtml(pB)}</td>
                    <td>
                        <div style="display:flex; align-items:center; justify-content:center;">
                            <span class="status-badge ${isDone ? "status-done" : "status-pending"}">${this.escapeHtml(m["比賽狀態"] || "待賽")}</span>
                            ${voiceBtn}
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
        return html;
    },

    renderTable(data, detailData = data, allData = detailData) {
        const container = document.getElementById("finals-schedule-container");
        if (data.length === 0) {
            container.innerHTML = `<div class="card" style="text-align: center; color: var(--text-dim); padding: 2rem;">目前尚無決賽賽程。</div>`;
            return;
        }
        const sortedData = [...data].sort((a, b) => {
            const timeDiff = String(this.read(a, ["比賽時間"], "")).localeCompare(String(this.read(b, ["比賽時間"], "")), "zh-Hant");
            if (timeDiff !== 0) return timeDiff;
            const areaDiff = this.getAreaSortWeight(this.read(a, ["區"], "")) - this.getAreaSortWeight(this.read(b, ["區"], ""));
            if (areaDiff !== 0) return areaDiff;
            return this.getRoundSortWeight(this.read(a, ["輪次"], "")) - this.getRoundSortWeight(this.read(b, ["輪次"], ""));
        });
        this.matches = sortedData;

        container.innerHTML = `
            <div class="finals-schedule-stack">
                ${this.renderSummarySection(sortedData)}
                ${this.renderDetailSection(detailData, allData)}
            </div>
        `;
    }
};
