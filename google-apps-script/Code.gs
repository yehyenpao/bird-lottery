/**
 * 羽毛球比賽系統 - Google Apps Script 後端 (終極穩定版)
 */

const CONFIG = {
  SHEET_REGISTRATION: "報名紀錄",
  SHEET_MEMBER: "隊員紀錄",
  SHEET_ROUND_ROBIN: "預賽紀錄表",
  SHEET_ELIMINATION: "單淘汰追分賽",
  TEAMS: ["藍鳥隊", "黑鳥隊", "青鳥隊", "粉鳥隊"],
  AREAS: ["猛禽區", "小鳥區", "鳥蛋區"]
};

/**
 * 統一入口：所有請求 (GET & POST) 都轉向這裡
 */
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const action = e.parameter.action;
    const yearMonth = e.parameter.yearMonth || "";
    let data = null;
    
    if (e.parameter.data) {
      data = JSON.parse(decodeURIComponent(e.parameter.data));
    } else if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents).data;
    }
    
    if (!action) {
      return createResponse({ status: "error", message: "缺少 action 指令" });
    }

    let result = { status: "error", message: "未定義的指令" };
    
    switch (action) {
      case "getRegistrations":
        result = { status: "success", data: helperGetData(CONFIG.SHEET_REGISTRATION, yearMonth) };
        break;
      case "getSchedule":
      case "getLiveScores":
        result = { status: "success", data: helperGetData(CONFIG.SHEET_ROUND_ROBIN, yearMonth) };
        break;
      case "getRankings":
        result = { status: "success", data: helperCalculateRankings(yearMonth) };
        break;
      case "addRegistrations":
        result = logicAddRegistrations(data);
        break;
      case "autoGroup":
        result = logicAutoGroup(yearMonth);
        break;
      case "generateSchedule":
        result = logicGenerateSchedule(yearMonth);
        break;
      case "updateScore":
        result = logicUpdateScore(data);
        break;
      default:
        result = { status: "error", message: "不支援的指令: " + action };
    }
    
    return createResponse(result);
      
  } catch (err) {
    return createResponse({ 
      status: "error", 
      message: "系統崩潰: " + err.toString(),
      stack: err.stack 
    });
  }
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.TEXT);
}

// --- 輔助函式 (Helper) ---

function helperGetData(sheetName, yearMonth) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];
    
    const headers = values[0];
    const targetYM = String(yearMonth || "").trim().replace(/\//g, "-");
    const result = [];
    
    const ymIdx = headers.indexOf("年月");
    
    for (let i = 1; i < values.length; i++) {
        let row = values[i];
        let obj = {};
        headers.forEach((h, idx) => obj[h] = row[idx]);
        
        let rYM = obj["年月"];
        if (rYM instanceof Date) {
            rYM = Utilities.formatDate(rYM, Session.getScriptTimeZone(), "yyyy-MM");
        } else {
            rYM = String(rYM || "").trim().replace(/\//g, "-");
            if (rYM.length > 7) rYM = rYM.substring(0, 7);
        }
        
        if (!targetYM || rYM === targetYM) {
            result.push(obj);
        }
    }
    return result;
  } catch (e) {
    return [];
  }
}

// --- 業務邏輯 (Logic) ---

function logicAddRegistrations(items) {
  if (!items || !Array.isArray(items)) return { status: "error", message: "報名資料格式錯誤" };
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_REGISTRATION);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_REGISTRATION);
    sheet.appendRow(["年月", "姓名", "身份", "隊名", "區", "循環賽積分", "淘汰賽積分", "裁判積分", "猜隊積分"]);
  }
  
  items.forEach(item => {
    sheet.appendRow([
      item.yearMonth, item.name, item.role, "", item.area, 0, 0, 0, 0
    ]);
  });
  
  return { status: "success", message: "已成功匯入 " + items.length + " 筆資料" };
}

function logicAutoGroup(yearMonth) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_REGISTRATION);
    if (!sheet) return { status: "error", message: "找不到『報名紀錄』分頁，請確認您的試算表分頁名稱是否正確。" };
    
    // 取得所有資料
    const range = sheet.getDataRange();
    const data = range.getValues();
    const headers = data[0].map(h => String(h || "").trim());
    
    const ymIdx = headers.indexOf("年月");
    const areaIdx = headers.indexOf("區");
    const teamIdx = headers.indexOf("隊名");
    
    if (ymIdx === -1 || areaIdx === -1 || teamIdx === -1) {
       return { status: "error", message: "欄位標題不符，請確認包含：年月, 區, 隊名 (目前的欄位為: " + headers.join(",") + ")" };
    }

    const targetYM = String(yearMonth || "").trim().replace(/\//g, "-");
    const areaMap = {};
    CONFIG.AREAS.forEach(a => areaMap[a] = []);
    
    // 找出符合的人員
    for (let i = 1; i < data.length; i++) {
        let rYM = data[i][ymIdx];
        if (rYM instanceof Date) {
            rYM = Utilities.formatDate(rYM, Session.getScriptTimeZone(), "yyyy-MM");
        } else {
            rYM = String(rYM || "").trim().replace(/\//g, "-");
            if (rYM.length > 7) rYM = rYM.substring(0, 7);
        }
        
        if (rYM === targetYM) {
            let area = String(data[i][areaIdx] || "").trim();
            if (!area.endsWith("區") && area !== "") area += "區";
            if (areaMap[area]) areaMap[area].push(i);
        }
    }
    
    let count = 0;
    // 亂序分組
    Object.keys(areaMap).forEach(area => {
        const indices = areaMap[area];
        if (indices.length === 0) return;

        // Shuffle
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        
        // 分派隊伍
        indices.forEach((dataRowIdx, idx) => {
            const teamName = CONFIG.TEAMS[idx % 4];
            data[dataRowIdx][teamIdx] = teamName;
            count++;
        });
    });
    
    if (count === 0) {
      return { status: "error", message: "在月分 " + targetYM + " 中找不到任何報名人員，請檢查 A 欄位內容。" };
    }
    
    // 將整份資料刷回試算表
    range.setValues(data);
    SpreadsheetApp.flush();
    
    // 取得目前的試算表網址與名稱以便診斷
    const ssUrl = ss.getUrl();
    const sheetName = sheet.getName();
    
    return { 
      status: "success", 
      message: "✅ 分組完成！共分配 " + count + " 人。\n\n確認修改位置：\n1. 檔案：" + ss.getName() + "\n2. 分頁：" + sheetName + "\n3. 欄位：第 " + (teamIdx + 1) + " 欄 (隊名)\n\n如果沒看到資料，請點開此網址確認：\n" + ssUrl
    };
  } catch (e) {
    return { status: "error", message: "分組過程錯誤: " + e.toString() };
  }
}

function logicGenerateSchedule(yearMonth) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const regItems = helperGetData(CONFIG.SHEET_REGISTRATION, yearMonth);
  if (regItems.length < 24) return { status: "error", message: "分組人數不足 (目前 " + regItems.length + " 人)" };
  
  let sheet = ss.getSheetByName(CONFIG.SHEET_ROUND_ROBIN);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_ROUND_ROBIN);
  } else {
    // 清除舊月份賽程
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      let rYM = data[i][0];
      if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, Session.getScriptTimeZone(), "yyyy-MM");
      if (String(rYM || "").trim() === String(yearMonth).trim()) sheet.deleteRow(i + 1);
    }
  }
  
  if (sheet.getLastRow() === 0) {
    // 欄位順序：年月, 輪次, 區, 場地, A隊名, A隊員1, A隊員2, A隊比分, B隊比分, B隊名, B隊員1, B隊員2, 裁判, 比賽狀態
    sheet.appendRow(["年月", "輪次", "區", "場地", "A隊名", "A隊員1", "A隊員2", "A隊比分", "B隊比分", "B隊名", "B隊員1", "B隊員2", "裁判", "比賽狀態"]);
  }
  
  // 定義對戰順序 (與使用者要求同步)：
  // 1:藍vs青(0,2), 2:黑vs粉(1,3), 3:藍vs黑(0,1), 4:青vs粉(2,3), 5:藍vs粉(0,3), 6:青vs黑(2,1)
  const matchups = [[0, 2], [1, 3], [0, 1], [2, 3], [0, 3], [2, 1]];
  const roundLabels = ["1", "2", "3", "4", "5", "6"];
  const courts = ["A", "B", "C"];
  
  matchups.forEach((pair, idx) => {
    const roundLabel = roundLabels[idx] || "z"; // 使用 a, b, c...
    
    CONFIG.AREAS.forEach((area, aIdx) => {
      const teamA = CONFIG.TEAMS[pair[0]];
      const teamB = CONFIG.TEAMS[pair[1]];
      
      // 匹配區域資料：精確匹配報名表中的區域文字
      const playersA = regItems.filter(p => p.隊名 === teamA && String(p.區 || "").trim() === String(area || "").trim());
      const playersB = regItems.filter(p => p.隊名 === teamB && String(p.區 || "").trim() === String(area || "").trim());
      
      const memberA1 = playersA[0] ? playersA[0].姓名 : "待定";
      const memberA2 = playersA[1] ? playersA[1].姓名 : "待定";
      const memberB1 = playersB[0] ? playersB[0].姓名 : "待定";
      const memberB2 = playersB[1] ? playersB[1].姓名 : "待定";
      
      // 欄位寫入順序對接 (區別標題改為 區)
      sheet.appendRow([
        yearMonth, roundLabel, area, courts[aIdx], 
        teamA, memberA1, memberA2, 0, 
        0, teamB, memberB1, memberB2, "", "待賽"
      ]);
    });
  });
  
  return { status: "success", message: "預賽紀錄表已填入並標示輪次 1~6" };
}

function logicUpdateScore(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_ROUND_ROBIN);
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    let rYM = rows[i][0];
    if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, Session.getScriptTimeZone(), "yyyy-MM");
    
    if (String(rYM) === String(d.yearMonth) && rows[i][1] == d.round && rows[i][3] == d.court) {
      sheet.getRange(i + 1, 8).setValue(d.scoreA);
      sheet.getRange(i + 1, 9).setValue(d.scoreB);
      if (d.referee !== undefined) sheet.getRange(i + 1, 13).setValue(d.referee);
      
      const newStatus = d.status || "已完賽"; // 如果沒傳狀態，預設為完賽
      sheet.getRange(i + 1, 14).setValue(newStatus);
      
      return { status: "success", message: "比分已成功更新為 " + newStatus };
    }
  }
  return { status: "error", message: "找不到該場比賽" };
}

function helperCalculateRankings(yearMonth) {
  // 簡化版：按姓名累計積分
  const items = helperGetData(CONFIG.SHEET_ROUND_ROBIN, yearMonth);
  const points = {};
  items.forEach(m => {
    const sA = parseInt(m.A得分 || 0);
    const sB = parseInt(m.B得分 || 0);
    if (sA === 0 && sB === 0) return;
    
    const pA = sA > sB ? 3 : (sA < sB ? 1 : 1);
    const pB = sA > sB ? 1 : (sA < sB ? 3 : 1);
    
    (m.A球員 || "").split("/").forEach(n => points[n] = (points[n] || 0) + pA);
    (m.B球員 || "").split("/").forEach(n => points[n] = (points[n] || 0) + pB);
  });
  return points;
}
