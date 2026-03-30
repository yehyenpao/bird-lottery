document.addEventListener("DOMContentLoaded", () => {
    // 初始化分頁切換
    const navLinks = document.querySelectorAll(".nav-links li");
    const contents = document.querySelectorAll(".tab-content");
    const pageTitle = document.getElementById("page-title");

    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            const tabId = link.getAttribute("data-tab");
            
            // UI 更新
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");
            
            contents.forEach(c => c.classList.remove("active"));
            document.getElementById(`tab-${tabId}`).classList.add("active");
            
            pageTitle.innerText = link.innerText;

            // 切換至對應分頁時自動載入資料
            loadTabData(tabId);
        });
    });

    // 初始化重新整理按鈕
    const refreshBtn = document.getElementById("refresh-all");
    refreshBtn.addEventListener("click", () => {
        const activeTab = document.querySelector(".nav-links li.active").getAttribute("data-tab");
        loadTabData(activeTab);
    });

    // 預設載入第一個分頁
    loadTabData("registration");
});

function loadTabData(tabId) {
    console.log("Loading tab:", tabId);
    switch (tabId) {
        case "registration":
            if (typeof Registration !== "undefined") Registration.load();
            break;
        case "schedule":
            if (typeof Schedule !== "undefined") Schedule.load();
            break;
        case "bracket":
            if (typeof Bracket !== "undefined") Bracket.load();
            break;
        case "livescore":
            if (typeof LiveScore !== "undefined") LiveScore.load();
            break;
        case "referee":
            if (typeof Referee !== "undefined") Referee.load();
            break;
    }
}
