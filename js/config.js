const CONFIG = {
    // 請在此更換為您部署後的 Google Apps Script Web App URL
    API_URL: "https://script.google.com/macros/s/AKfycbylJdE0zrBJkgbjkvXKKCbhQYs2wnrHCTMutJueWPRISeiUcAuQNYBf-Mg5X9-1GEKZ0w/exec",

    // 目前年份月份 (用於篩選資料)
    YEAR_MONTH: "2026-03",

    TEAMS: ["藍鳥隊", "黑鳥隊", "青鳥隊", "粉鳥隊"],
    AREAS: ["猛禽", "小鳥", "鳥蛋"],
    SHEET_POINTS: "積點紀錄",

    // 隊伍顏色映射 (用於 UI 呈現)
    TEAM_COLORS: {
        "藍鳥隊": "#4a90e2",
        "黑鳥隊": "#6c757d",
        "青鳥隊": "#20c997",
        "粉鳥隊": "#e91e63"
    },

    AREA_COLORS: {
        "猛禽": "#ff6b35",
        "小鳥": "#4ecdc4",
        "鳥蛋": "#ffe66d",
        "猛禽區": "#ff6b35",
        "小鳥區": "#4ecdc4",
        "鳥蛋區": "#ffe66d"
    }
};
