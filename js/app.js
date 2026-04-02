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
    
    if (menuToggle) {
        menuToggle.addEventListener("click", () => {
            sidebar.classList.add("show");
        });
    }
    if (menuClose) {
        menuClose.addEventListener("click", () => {
            sidebar.classList.remove("show");
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
