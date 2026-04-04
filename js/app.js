let currentRole = 'viewer';

document.addEventListener("DOMContentLoaded", () => {
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
        initialTab = 'v-schedule';
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
            if(sidebarBackdrop) sidebarBackdrop.classList.add("show");
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

    // 初始化日期選擇器與監聽
    const datePicker = document.getElementById("current-date");
    if (datePicker) {
        // 先設定為今天 (備援)
        datePicker.value = CONFIG.DEFAULT_DATE;
        
        // 非同步獲取系統最新比賽日期 (<= 今日)
        (async () => {
            try {
                const res = await API.call("getLatestDate");
                if (res && res.status === "success" && res.data) {
                    datePicker.value = res.data;
                    console.log("自動切換至最新比賽日期:", res.data);
                    
                    // 日期變更後，若已經載入分頁則重新整理
                    const activeLink = document.querySelector(`#${currentNavId} li.active`);
                    if (activeLink) {
                        const activeTab = activeLink.getAttribute("data-tab");
                        loadTabData(activeTab);
                    }
                }
            } catch (e) {
                console.warn("無法取得最新比賽日期:", e);
            }
        })();

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
    
    // 初始化相片上傳 UI
    if (typeof Photo !== "undefined") Photo.init();
});

function loadTabData(tabId) {
    console.log("Loading tab:", tabId);
    switch (tabId) {
        // Umpire Tabs
        case "registration":
            if (typeof Registration !== "undefined") Registration.load();
            break;
        case "schedule":
            if (typeof Schedule !== "undefined") Schedule.load();
            break;
        case "bracket":
            if (typeof Bracket !== "undefined") Bracket.load();
            break;
        case "referee":
            if (typeof Referee !== "undefined") Referee.load();
            break;
        case "results":
            if (typeof Results !== "undefined") Results.load();
            break;
        case "chasing":
            if (typeof Chasing !== "undefined") Chasing.load();
            break;
        case "chasing_referee":
            if (typeof ChasingReferee !== "undefined") ChasingReferee.load();
            break;
        case "finals":
            if (typeof Finals !== "undefined") Finals.load();
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
            if (typeof LiveScore !== "undefined") LiveScore.load();
            break;

        // Viewer Tabs
        case "v-schedule":
            if (typeof Viewer !== "undefined") Viewer.loadSchedule();
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
