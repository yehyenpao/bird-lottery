let currentRole = 'viewer';

// 追蹤頁面是否正在重新整理/跳轉
window.isUnloading = false;
window.addEventListener("beforeunload", () => { window.isUnloading = true; });
window.addEventListener("pagehide", () => { window.isUnloading = true; });

// 追蹤側邊欄跳轉按鈕，在實際改變 location 前就設定 flag 避免部分瀏覽器在 beforeunload 啟動前就暫停 fetch
document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (link && link.href && !link.href.includes("javascript:") && !link.href.startsWith("#")) {
        window.isNavigating = true;
    }
});

// 自動更新管理員
const AutoRefreshManager = {
    interval: 20, // 秒
    countdown: 20,
    timer: null,
    currentTab: null,
    pollingTabs: ['livescore', 'v-schedule', 'referee', 'chasing_referee', 'finals', 'schedule', 'results', 'chasing'],

    init() {
        this.timerContainer = document.getElementById("refresh-timer");
        if (this.timerContainer) {
            this.timerContainer.style.display = 'none';
        }
        
        // 頁面可見性偵測
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
    },

    start(tabId) {
        this.currentTab = tabId;
        this.stop();
        
        if (this.pollingTabs.includes(tabId)) {
            this.countdown = this.interval;
            if (this.timerContainer) {
                this.timerContainer.style.display = 'flex';
                this.timerContainer.innerText = this.countdown;
            }
            this.timer = setInterval(() => this.tick(), 1000);
        } else {
            if (this.timerContainer) this.timerContainer.style.display = 'none';
        }
    },

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    },

    pause() {
        this.stop();
    },

    resume() {
        if (this.currentTab) this.start(this.currentTab);
    },

    tick() {
        this.countdown--;
        if (this.countdown <= 0) {
            this.countdown = this.interval;
            if (typeof loadTabData === 'function') {
                loadTabData(this.currentTab, true); // silent reload
            }
        }
        if (this.timerContainer) {
            this.timerContainer.innerText = this.countdown;
        }
    }
};

// 語音廣播管理員
const SpeechManager = {
    synth: window.speechSynthesis,
    voice: null,

    init() {
        // 預啟動，嘗試載入語音清單
        if (!this.synth) return;
        this._loadVoice();
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => this._loadVoice();
        }
    },

    _loadVoice() {
        const voices = this.synth.getVoices();
        // 優先尋找台灣女聲 (Meijia, Huihui, Hanhan 等)
        this.voice = voices.find(v => v.lang.includes('zh-TW') && (v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Microsoft'))) || 
                     voices.find(v => v.lang.includes('zh-TW')) ||
                     voices.find(v => v.lang.includes('zh-CN')) ||
                     voices[0];
    },

    announceMatch(match, mode = 'standard') {
        if (!this.synth) {
            alert("您的瀏覽器不支援語音播報功能。");
            return;
        }

        let text = "";
        const court = match.場地 || match["場地"] || "";
        const teamA = match.A隊名 || "";
        const teamB = match.B隊名 || "";
        const pA = [match.A隊員1, match.A隊員2, match.A隊員3].filter(p => p && p !== "待定").join("、");
        const pB = [match.B隊員1, match.B隊員2, match.B隊員3].filter(p => p && p !== "待定").join("、");
        const referee = match.裁判 || "";

        if (mode === 'standard') {
            text = `各位球友請注意，下一場比賽通知。場地：${court} 場。對戰隊伍：${teamA} 對 ${teamB}。參賽隊員：${pA} 對 ${pB}。本場裁判 ${referee}。請以上球員與裁判立即前往 ${court} 場準備比賽，謝謝。`;
        } else {
            // 追分或決賽可能格式略有不同
            const area = match.區 || match["區"] || "";
            text = `各位球友請注意，下一場比賽通知。${area}，場地：${court} 場。對戰隊伍：${teamA} 對 ${teamB}。參賽隊員：${pA} 對 ${pB}。本場裁判 ${referee}。請立即前往 ${court} 場準備比賽，謝謝。`;
        }

        console.log("Announcement:", text);

        // 如果正在播報則停止
        this.synth.cancel();

        const utter = new SpeechSynthesisUtterance(text);
        if (this.voice) utter.voice = this.voice;
        utter.lang = 'zh-TW';
        utter.rate = 0.95; // 稍微放慢一點點
        utter.pitch = 1.0;
        
        this.synth.speak(utter);
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    // 初始化自動更新與語音
    AutoRefreshManager.init();
    SpeechManager.init();

    // 角色判定
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get('role');
    if (roleParam === 'umpire') {
        currentRole = 'umpire';
    } else {
        currentRole = 'viewer'; // 預設為球友端
    }

    const navUmpire = document.getElementById("nav-umpire");
    const navViewer = document.getElementById("nav-viewer");
    const roleBadge = document.getElementById("role-badge");

    let initialTab = '';

    if (currentRole === 'umpire') {
        navUmpire.style.display = 'block';
        navViewer.style.display = 'none';
        roleBadge.innerText = '裁判端';
        initialTab = 'registration';
    } else {
        navUmpire.style.display = 'none';
        navViewer.style.display = 'block';
        roleBadge.innerText = '球友端';
        initialTab = 'v-registration';
    }

    // 初始化分頁切換
    const currentNavId = currentRole === 'umpire' ? 'nav-umpire' : 'nav-viewer';
    const navLinks = document.querySelectorAll(`#${currentNavId} li`);
    const contents = document.querySelectorAll(".tab-content");
    const pageTitle = document.getElementById("page-title");
    const sidebar = document.getElementById("sidebar");

    navLinks.forEach(link => {
        // 例外處理連結
        if (link.querySelector('a')) return;

        link.addEventListener("click", () => {
            const tabId = link.getAttribute("data-tab");
            
            // UI 更新
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");
            
            contents.forEach(c => c.classList.remove("active"));
            const targetSection = document.getElementById(`tab-${tabId}`);
            if (targetSection) targetSection.classList.add("active");
            
            pageTitle.innerText = link.innerText.trim();

            // 在手機模式點擊選單後自動收合
            sidebar.classList.remove("show");

            // 切換至對應分頁時自動載入資料
            loadTabData(tabId);
        });
    });

    // 漢堡選單控制
    const menuToggle = document.getElementById("menu-toggle");
    const menuClose = document.getElementById("menu-close");
    const sidebarBackdrop = document.getElementById("sidebar-backdrop");
    
    function closeSidebar() {
        sidebar.classList.remove("show");
        if(sidebarBackdrop) sidebarBackdrop.classList.remove("show");
    }

    if (menuToggle) {
        menuToggle.addEventListener("click", (e) => {
            sidebar.classList.add("show");
            if(sidebarBackdrop) sidebarBackdrop.classList.remove("show");
            e.stopPropagation();
        });
    }
    if (menuClose) {
        menuClose.addEventListener("click", () => {
            closeSidebar();
        });
    }
    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener("click", () => {
            closeSidebar();
        });
    }

    // 在小螢幕點擊任何選單項目都會自動收起
    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            closeSidebar();
        });
    });

    // 初始化日期選擇器與點擊前置作業
    const datePicker = document.getElementById("current-date");
    if (datePicker) {
        // 先設定為今天 (靜態備援)
        datePicker.value = CONFIG.DEFAULT_DATE;
        
        // 【關鍵優化】循序獲取系統最新比賽日期 (<= 今日)
        // 避免並行 fetch 導致手機瀏覽器中斷 GAS 的 302 重定向
        try {
            const res = await API.call("getLatestDate");
            if (res && res.status === "success" && res.data) {
                datePicker.value = res.data;
                console.log("初始化：已設定最新比賽日期為", res.data);
            }
        } catch (e) {
            console.warn("無法取得最新比賽日期:", e);
        }

        datePicker.addEventListener("change", () => {
            const activeLink = document.querySelector(`#${currentNavId} li.active`);
            if (activeLink) {
                const activeTab = activeLink.getAttribute("data-tab");
                loadTabData(activeTab);
            }
        });
    }

    // 初始化重新整理按鈕
    const refreshBtn = document.getElementById("refresh-all");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            const activeLink = document.querySelector(`#${currentNavId} li.active`);
            if (activeLink) {
                const activeTab = activeLink.getAttribute("data-tab");
                loadTabData(activeTab);
            }
        });
    }

    // 觸發預設分頁點擊
    const defaultNav = document.querySelector(`#${currentNavId} li[data-tab="${initialTab}"]`);
    if (defaultNav) {
        defaultNav.click();
    }
    
    // 初始化分頁對應組件
    if (typeof Photo !== "undefined") Photo.init();
    if (typeof Registration !== "undefined") Registration.init();
});

function loadTabData(tabId, silent = false) {
    if (!silent) AutoRefreshManager.start(tabId);
    console.log("Loading tab:", tabId, silent ? "(silent)" : "");
    switch (tabId) {
        // Umpire Tabs
        case "registration":
            if (typeof Registration !== "undefined") Registration.load();
            break;
        case "schedule":
            if (typeof Schedule !== "undefined") Schedule.load(silent);
            break;
        case "bracket":
            if (typeof Bracket !== "undefined") Bracket.load();
            break;
        case "referee":
            if (typeof Referee !== "undefined") Referee.load(silent);
            break;
        case "results":
            if (typeof Results !== "undefined") Results.load(silent);
            break;
        case "chasing":
            if (typeof Chasing !== "undefined") Chasing.load(silent);
            break;
        case "chasing_referee":
            if (typeof ChasingReferee !== "undefined") ChasingReferee.load(silent);
            break;
        case "finals":
            if (typeof Finals !== "undefined") Finals.load(silent);
            break;
        case "points":
            if (typeof Points !== "undefined") Points.init();
            break;
        case "special":
            if (typeof Special !== "undefined") Special.init();
            break;
        case "photo-upload":
            if (typeof Photo !== "undefined") Photo.loadPlayers();
            break;
            
        // Shared Tabs
        case "livescore":
            if (typeof LiveScore !== "undefined") LiveScore.load(silent);
            break;

        // Viewer Tabs
        case "v-registration":
            if (typeof Viewer !== "undefined") Viewer.loadRegistration();
            break;
        case "v-schedule":
            if (typeof Viewer !== "undefined") Viewer.loadSchedule(silent);
            break;
        case "v-history":
            if (typeof Viewer !== "undefined") Viewer.initHistory();
            break;
        case "v-points":
            if (typeof Viewer !== "undefined") Viewer.loadPoints();
            break;
        case "v-special":
            if (typeof Viewer !== "undefined") Viewer.loadSpecial();
            break;
    }
}

// 裁判端密碼驗證邏輯
function requireUmpirePassword(e) {
    e.preventDefault();
    const pwd = prompt("請輸入裁判密碼:");
    if (pwd === "0705") {
        window.location.href = "?role=umpire";
    } else if (pwd !== null) {
        alert("密碼錯誤，您無權進入裁判端。");
    }
}
