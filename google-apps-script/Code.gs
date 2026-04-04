/**
 * 羽毛球比賽系統 - Google Apps Script 後端 (終極穩定版)
 */

const CONFIG = {
  SHEET_REGISTRATION: "報名紀錄",
  SHEET_MEMBER: "隊員紀錄",
  SHEET_ROUND_ROBIN: "預賽紀錄表",
  SHEET_CHASING: "追分賽紀錄表",
  SHEET_ELIMINATION: "單淘汰追分賽",
  SHEET_POINTS: "積點統計表",
  SHEET_SPECIAL: "特殊紀錄",
  SHEET_PLAYER_DB: "球員資料庫",
  TEAMS: ["藍鳥隊", "黑鳥隊", "青鳥隊", "粉鳥隊"],
  AREAS: ["猛禽區", "小鳥區", "鳥蛋區"],
  TIMEZONE: "GMT+8"
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
      case "getChasingSchedule":
        result = { status: "success", data: helperGetData(CONFIG.SHEET_CHASING, yearMonth) };
        break;
      case "getRankings":
        result = { status: "success", data: helperGetTeamRankings(yearMonth) };
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
      case "updateChasingScore":
        result = logicUpdateChasingScore(data);
        break;
      case "updatePlayerOrder":
        result = logicUpdatePlayerOrder(data);
        break;
      case "generateChasingSchedule":
        result = logicGenerateChasingSchedule(yearMonth, data);
        break;
      case "generateFinals":
        result = logicGenerateFinals(yearMonth, data);
        break;
      case "clearData":
        result = logicClearData(yearMonth, e.parameter.sheet);
        break;
      case "calculatePoints":
        result = logicCalculatePoints(yearMonth, data);
        break;
      case "getPointsRecords":
        result = { status: "success", data: helperGetPointsRecords(yearMonth) };
        break;
      case "getSpecialRecords":
        result = { status: "success", data: helperGetSpecialRecords() };
        break;
      case "saveSpecialRecords":
        result = logicSaveSpecialRecords(yearMonth, data);
        break;
      case "getPlayersInfo":
        result = { status: "success", data: logicGetPlayersInfo() };
        break;
      case "uploadPhoto":
        result = logicUploadPhoto(data);
        break;
      case "debugSheet":
        result = { status: "success", data: helperDebugSheet(e.parameter.sheet || CONFIG.SHEET_CHASING) };
        break;
    }
    
    return createResponse(result);
  } catch (err) {
    return createResponse({ status: "error", message: err.toString() });
  }
}

function createResponse(content) {
  return ContentService.createTextOutput(JSON.stringify(content))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 取得指定月份的資料
 */
function helperGetData(sheetName, yearMonth) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const ymIdx = headers.indexOf("年月");
  const timeIdx = headers.indexOf("比賽時間");
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    // 處理「年月」欄位 - 統一轉為 "yyyy-MM" 字串再比對
    let rYM = ymIdx > -1 ? data[i][ymIdx] : "";
    if (rYM instanceof Date) {
      rYM = Utilities.formatDate(rYM, CONFIG.TIMEZONE, "yyyy-MM-dd");
    } else {
      // 非 Date 時，取前 10 碼 ("2026-03-01") 防止格式不一致
      rYM = String(rYM).trim().substring(0, 10);
    }
    
    const targetDate = String(yearMonth).trim();
    
    // 如果傳入的是 yyyy-MM-dd，則精確比對；如果只有 yyyy-MM，則比對前 7 碼
    const isFullDate = targetDate.length === 10;
    
    if (!yearMonth || (isFullDate ? rYM === targetDate : rYM.substring(0, 7) === targetDate)) {
      const obj = {};
      headers.forEach((h, idx) => {
        let val = data[i][idx];
        
        // 處理「比賽時間」欄位：轉為 HH:mm 格式
        if (idx === timeIdx && val instanceof Date) {
          val = Utilities.formatDate(val, CONFIG.TIMEZONE, "HH:mm");
        }
        // 處理「年月」欄位：統一輸出為 yyyy-MM 字串
        if (idx === ymIdx && val instanceof Date) {
          val = Utilities.formatDate(val, CONFIG.TIMEZONE, "yyyy-MM-dd");
        }
        
        obj[h] = val;
      });
      result.push(obj);
    }
  }
  return result;
}

/**
 * 診斷用：直接回傳試算表所有原始資料（不篩選年月）
 */
function helperDebugSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: "找不到工作表: " + sheetName };
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { rowCount: data.length, headers: data[0] || [], rows: [] };
  
  const headers = data[0];
  const ymIdx = headers.indexOf("年月");
  
  // 直接回傳前 10 筆原始資料，以便偵錯
  const rows = data.slice(1, 11).map((row, i) => {
    const rawYM = row[ymIdx];
    return {
      rowNum: i + 2,
      rawYM: rawYM instanceof Date ? rawYM.toISOString() : String(rawYM),
      formattedYM: rawYM instanceof Date ? Utilities.formatDate(rawYM, CONFIG.TIMEZONE, "yyyy-MM") : String(rawYM).substring(0, 7),
      isDate: rawYM instanceof Date,
      firstFewCols: row.slice(0, 6).map(v => v instanceof Date ? v.toISOString() : v)
    };
  });
  
  return {
    sheetName: sheetName,
    totalRows: data.length - 1,
    headers: headers,
    ymColumnIndex: ymIdx,
    debugRows: rows
  };
}

/**
 * 寫入報名資料
 */
function logicAddRegistrations(dataList) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_REGISTRATION);
  
  // 防呆機制：如果「報名紀錄」分頁不存在，自動建立並加入標題列
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_REGISTRATION);
    sheet.appendRow(["年月", "姓名", "身份", "隊名", "區", "循環名次", "淘汰名次", "循環積分", "淘汰積分"]);
  }

  dataList.forEach(d => {
    // 依序寫入 9 個欄位：
    // 1.年月 | 2.姓名 | 3.身份 | 4.隊名 | 5.區 | 6.循環名次 | 7.淘汰名次 | 8.循環積分 | 9.淘汰積分
    sheet.appendRow([
      d.yearMonth, 
      d.name, 
      d.role || "球員", 
      d.team || "", 
      d.area, 
      "", "", "", ""
    ]);
  });
  
  // 同步球員資料庫
  const names = dataList.map(d => d.name);
  if (names.length > 0) syncPlayerDatabase(names);

  return { status: "success", message: "成功報名 " + dataList.length + " 筆資料" };
}

/**
 * 自動產生循環賽程
 */
function logicGenerateSchedule(yearMonth) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const regItems = helperGetData(CONFIG.SHEET_REGISTRATION, yearMonth);
  if (regItems.length < 24) return { status: "error", message: "分組人數不足 (目前 " + regItems.length + " 人)" };
  
  let sheet = ss.getSheetByName(CONFIG.SHEET_ROUND_ROBIN);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_ROUND_ROBIN);
  } else {
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      let rYM = data[i][0];
      if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, Session.getScriptTimeZone(), "yyyy-MM-dd");
      if (String(rYM || "").trim().substring(0, 10) === String(yearMonth).trim().substring(0, 10)) sheet.deleteRow(i + 1);
    }
  }
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["序號", "年月", "比賽時間", "輪次", "區", "場地", "A隊名", "A隊員1", "A隊員2", "A隊比分", "B隊比分", "B隊名", "B隊員1", "B隊員2", "裁判", "比賽狀態"]);
  }
  
  const matchups = [[0, 2], [1, 3], [0, 1], [2, 3], [0, 3], [2, 1]];
  const roundLabels = ["1", "2", "3", "4", "5", "6"];
  const roundTimes = {
    "1": "13:40", "2": "14:05", "3": "14:30",
    "4": "14:45", "5": "15:00", "6": "15:15"
  };
  
  const areaCourtMap = {
    "鳥蛋區": "A", "鳥蛋": "A",
    "小鳥區": "B", "小鳥": "B",
    "猛禽區": "C", "猛禽": "C"
  };
  
  let sequenceNum = 1;

  matchups.forEach((pair, idx) => {
    const roundLabel = roundLabels[idx] || (idx + 1).toString();
    const matchTime = roundTimes[roundLabel] || "";
    
    CONFIG.AREAS.forEach((area) => {
      const teamA = CONFIG.TEAMS[pair[0]];
      const teamB = CONFIG.TEAMS[pair[1]];
      const court = areaCourtMap[area] || "A";
      const cleanArea = area.replace("區", "");
      const playersA = regItems.filter(p => p.隊名 === teamA && (p.區 === area || p.區 === cleanArea));
      const playersB = regItems.filter(p => p.隊名 === teamB && (p.區 === area || p.區 === cleanArea));
      
      const memberA1 = playersA[0] ? playersA[0].姓名 : "待定";
      const memberA2 = playersA[1] ? playersA[1].姓名 : "待定";
      const memberB1 = playersB[0] ? playersB[0].姓名 : "待定";
      const memberB2 = playersB[1] ? playersB[1].姓名 : "待定";
      
      sheet.appendRow([
        sequenceNum++, yearMonth, matchTime, roundLabel, area, court, 
        teamA, memberA1, memberA2, 0, 
        0, teamB, memberB1, memberB2, "", "待賽"
      ]);
    });
  });
  
  return { status: "success", message: "賽程已成功產生，並已套用預計時間與場地" };
}

/**
 * 更新裁判比分 (即時同步)
 */
function logicUpdateScore(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_ROUND_ROBIN);
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    let rYM = rows[i][1]; // 年月移動到第 2 欄 (Index 1)
    if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, CONFIG.TIMEZONE, "yyyy-MM");
    
    // 輪次 (Index 3), 場地 (Index 5)
    if (String(rYM) === String(d.yearMonth) && rows[i][3] == d.round && rows[i][5] == d.court) {
      if (d.startTime) sheet.getRange(i + 1, 3).setValue(d.startTime); // 比賽時間移動到第 3 欄 (Index 2)
      sheet.getRange(i + 1, 10).setValue(d.scoreA);
      sheet.getRange(i + 1, 11).setValue(d.scoreB);
      if (d.referee !== undefined) sheet.getRange(i + 1, 15).setValue(d.referee);
      
      const newStatus = d.status || "已完賽";
      sheet.getRange(i + 1, 16).setValue(newStatus);
      
      return { status: "success", message: "比分已成功更新為 " + newStatus };
    }
  }
  return { status: "error", message: "找不到該場比賽" };
}

function helperCalculateRankings(yearMonth) {
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

function logicClearData(yearMonth, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { status: "error", message: "找不到工作表" };
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    let rYM = data[i][0];
    if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, Session.getScriptTimeZone(), "yyyy-MM");
    if (String(rYM).trim() === String(yearMonth).trim()) sheet.deleteRow(i + 1);
  }
  return { status: "success", message: "已清除 " + yearMonth + " 的相關資料" };
}

/**
 * 取得團隊排名計算 (積分 > 正負商)
 */
/**
 * 取得團隊排名計算 (積分 > 對戰勝場 > 正負商)
 */
function helperGetTeamRankings(yearMonth) {
  const items = helperGetData(CONFIG.SHEET_ROUND_ROBIN, yearMonth);
  const stats = {};
  const h2hWins = {}; // 對戰勝場矩陣
  
  // 輔助函數：徹底清理隊名中的所有空白
  const clean = (str) => String(str || "").replace(/\s+/g, "").trim();
  const teamNames = CONFIG.TEAMS.map(t => clean(t));

  teamNames.forEach(t => {
    stats[t] = { points: 0, scored: 0, conceded: 0 };
    h2hWins[t] = {};
    teamNames.forEach(opp => h2hWins[t][opp] = 0);
  });

  // 1. 累加數據與對戰矩陣
  const rounds = {};
  items.forEach(m => {
    const rid = clean(m.輪次);
    if (!rid) return;
    if (!rounds[rid]) rounds[rid] = [];
    rounds[rid].push(m);

    const tA = clean(m.A隊名);
    const tB = clean(m.B隊名);
    const sA = Number(m.A隊比分) || 0;
    const sB = Number(m.B隊比分) || 0;

    if (stats[tA] && stats[tB]) {
      stats[tA].scored += sA;
      stats[tA].conceded += sB;
      stats[tB].scored += sB;
      stats[tB].conceded += sA;

      // 累加單場對戰勝場
      if (sA > sB) h2hWins[tA][tB] = (h2hWins[tA][tB] || 0) + 1;
      else if (sB > sA) h2hWins[tB][tA] = (h2hWins[tB][tA] || 0) + 1;
    }
  });

  // 2. 計算大場積分
  Object.keys(rounds).forEach(rid => {
    const group = rounds[rid];
    if (group.length === 0) return;
    const teamA = clean(group[0].A隊名);
    const teamB = clean(group[0].B隊名);
    
    if (stats[teamA] && stats[teamB]) {
      let aWins = 0, bWins = 0;
      group.forEach(m => {
        const sA = Number(m.A隊比分) || 0;
        const sB = Number(m.B隊比分) || 0;
        if (sA > sB) aWins++;
        else if (sB > sA) bWins++;
      });
      if (aWins > bWins) { stats[teamA].points += 3; stats[teamB].points += 1; }
      else if (bWins > aWins) { stats[teamB].points += 3; stats[teamA].points += 1; }
      else { stats[teamA].points += 1; stats[teamB].points += 1; }
    }
  });

  // 3. 排序 (積分 DESC > 對戰 DESC > 正負商 DESC)
  const sorted = teamNames.map(name => {
    const s = stats[name];
    const quo = s.conceded === 0 ? s.scored : (s.scored / s.conceded);
    return { name, points: s.points, quotient: quo };
  }).sort((a, b) => {
    // Stage 1: 積分
    if (b.points !== a.points) return b.points - a.points;

    // Stage 2: 對戰勝場 (Head-to-Head)
    const winsA = h2hWins[a.name][b.name] || 0;
    const winsB = h2hWins[b.name][a.name] || 0;
    if (winsA !== winsB) return winsB - winsA; // 勝場多者排前面

    // Stage 3: 正負商
    return b.quotient - a.quotient;
  });

  return sorted;
}

/**
 * 更新球員棒次 (1~6 棒)
 */
function logicUpdatePlayerOrder(dataList) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_REGISTRATION);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  
  // 動態尋找欄位索引
  let nameIdx = headers.indexOf("姓名");
  let orderIdx = headers.indexOf("棒次");
  
  // 如果沒有棒次欄位，則新增一個
  if (orderIdx === -1) {
    orderIdx = headers.length;
    sheet.getRange(1, orderIdx + 1).setValue("棒次");
  }
  
  dataList.forEach(d => {
    for (let i = 1; i < rows.length; i++) {
        // 比對姓名，確保去除空白
        if (String(rows[i][nameIdx]).trim() === String(d.name).trim()) {
            sheet.getRange(i + 1, orderIdx + 1).setValue(d.order);
        }
    }
  });
  return { status: "success", message: "球員棒次已成功儲存至試算表 (第 " + (orderIdx+1) + " 欄)" };
}

/**
 * 確保追分賽記錄表欄位正確。判斷基準：是否包含「年月」欄位（而非對齊結構）
 * 這樣即便表格第一行是標題文字也能正確處理。
 */
function ensureChasingHeaders(sheet) {
  const STANDARD_HEADERS = ["\u5e74\u6708", "\u6bd4\u8cfd\u6642\u9593", "\u8f2a\u6b21", "\u5340", "\u5834\u5730", "A\u968a\u540d", "A\u968a\u54e11", "A\u968a\u54e12", "A\u968a\u54e13", "A\u968a\u6bd4\u5206", "B\u968a\u6bd4\u5206", "B\u968a\u540d", "B\u968a\u54e11", "B\u968a\u54e12", "B\u968a\u54e13", "\u88c1\u5224", "\u6bd4\u8cfd\u72c0\u614b"];
  
  let rawHeaders = sheet.getDataRange().getValues()[0] || [];
  let headers = rawHeaders.map(h => String(h || "").trim());

  // 關鍵判斷：只要找不到「年月」欄位，就必須重新初始化
  // (不管第一行是空的、標題文字、還是其他内容都適用)
  if (!headers.includes("\u5e74\u6708")) {
    Logger.log("[ensureChasingHeaders] \u5e74\u6708欄\u4f4d未找到，現有標題: " + JSON.stringify(headers));
    Logger.log("[ensureChasingHeaders] 重新初始化標題列...");
    // 先清除不寬用的內容（保留格式），再正確寫入標題
    // 用 setValues 寫入第一行，避免 appendRow 在已有內容下方新增
    sheet.clearContents(); // 清除內容（保留格式）
    sheet.appendRow(STANDARD_HEADERS);
    return STANDARD_HEADERS;
  }
  
  // 年月欄已存在，檢查是否需要新增 A/B 隊員3 欄位
  if (!headers.includes("A\u968a\u54e13")) {
    const idxA2 = headers.indexOf("A\u968a\u54e12");
    if (idxA2 !== -1) {
      sheet.insertColumnAfter(idxA2 + 1);
      sheet.getRange(1, idxA2 + 2).setValue("A\u968a\u54e13");
      headers = sheet.getDataRange().getValues()[0].map(h => String(h || "").trim());
    }
  }

  if (!headers.includes("B\u968a\u54e13")) {
    const idxB2 = headers.indexOf("B\u968a\u54e12");
    if (idxB2 !== -1) {
      sheet.insertColumnAfter(idxB2 + 1);
      sheet.getRange(1, idxB2 + 2).setValue("B\u968a\u54e13");
      headers = sheet.getDataRange().getValues()[0].map(h => String(h || "").trim());
    }
  }
  
  return headers;
}

/**
 * 產生追分賽程 (準決賽)，接收前端自訂出戰順序表
 */
function logicGenerateChasingSchedule(yearMonth, customizedData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!customizedData || customizedData.length === 0) return { status: "error", message: "沒有接收到自訂賽程資料" };

  let sheet = ss.getSheetByName(CONFIG.SHEET_CHASING);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_CHASING);
  
  const headers = ensureChasingHeaders(sheet);
  
  // 清除舊的該月準決賽資料
  const oldData = sheet.getDataRange().getValues();
  for (let i = oldData.length - 1; i >= 1; i--) {
     let rYM = oldData[i][0];
     if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, CONFIG.TIMEZONE, "yyyy-MM-dd");
     if (String(rYM).substring(0, 10) === String(yearMonth).substring(0, 10) && String(oldData[i][headers.indexOf("區")]).includes("準決賽")) {
         sheet.deleteRow(i + 1);
     }
  }

  // 建立欄位索引 (trim 防空格)
  const headIdx = {};
  headers.forEach((h, i) => headIdx[String(h).trim()] = i);
  
  // 防錯檢查：如果找不到「年月」欄，立即失敗並回報明確錯誤
  if (headIdx["\u5e74\u6708"] === undefined) {
    return { status: "error", message: "標題列异常：找不到「年月」欄位。目前標題=" + JSON.stringify(headers) };
  }

  customizedData.forEach(p => {
    const rowObj = [];
    headers.forEach(() => rowObj.push(""));
    
    rowObj[headIdx["年月"]] = yearMonth;
    rowObj[headIdx["比賽時間"]] = "15:30"; // 預設時間
    rowObj[headIdx["輪次"]] = p.targetScore; 
    rowObj[headIdx["區"]] = p.area;
    rowObj[headIdx["場地"]] = p.court;
    rowObj[headIdx["A隊名"]] = p.teamA;
    rowObj[headIdx["A隊員1"]] = p.A1;
    rowObj[headIdx["A隊員2"]] = p.A2;
    rowObj[headIdx["A隊員3"]] = p.A3 || "";
    rowObj[headIdx["A隊比分"]] = 0;
    rowObj[headIdx["B隊比分"]] = 0;
    rowObj[headIdx["B隊名"]] = p.teamB;
    rowObj[headIdx["B隊員1"]] = p.B1;
    rowObj[headIdx["B隊員2"]] = p.B2;
    rowObj[headIdx["B隊員3"]] = p.B3 || "";
    rowObj[headIdx["裁判"]] = "";
    rowObj[headIdx["比賽狀態"]] = "待賽";

    sheet.appendRow(rowObj);
  });

  return { status: "success", message: "追分賽(準決賽)已依照自訂順序成功產生！" };
}

/**
 * 更新追分賽裁判比分，並承接至自訂下一棒
 */
function logicUpdateChasingScore(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_CHASING);
  if (!sheet) return { status: "error", message: "找不到追分賽紀錄表" };
  
  const rows = sheet.getDataRange().getValues();
  const headIdx = {};
  rows[0].forEach((h, i) => headIdx[h] = i);
  
  for (let i = 1; i < rows.length; i++) {
    let rYM = rows[i][headIdx["年月"]];
    if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, CONFIG.TIMEZONE, "yyyy-MM-dd");
    
    // 對齊邏輯：年月 && 輪次 && 區 && 場地
    if (String(rYM).substring(0, 10) === String(d.yearMonth).substring(0, 10) && 
        rows[i][headIdx["輪次"]] == d.round && 
        rows[i][headIdx["區"]] == d.area && 
        rows[i][headIdx["場地"]] == d.court) {
      
      if (d.startTime) sheet.getRange(i + 1, headIdx["裁判"] + 1).setValue("開賽: " + d.startTime);
      sheet.getRange(i + 1, headIdx["A隊比分"] + 1).setValue(d.scoreA);
      sheet.getRange(i + 1, headIdx["B隊比分"] + 1).setValue(d.scoreB);
      if (d.referee !== undefined) sheet.getRange(i + 1, headIdx["裁判"] + 1).setValue(d.referee);
      
      const newStatus = d.status || "已完賽";
      sheet.getRange(i + 1, headIdx["比賽狀態"] + 1).setValue(newStatus);
      
      // 自動尋找下一棒：同一場地、同一區塊中，出現在當前場次之後且為「待賽」的第一場
      if (newStatus === "已完賽") {
        for (let j = i + 1; j < rows.length; j++) {
          if (String(rows[j][headIdx["區"]]) === String(d.area) && 
              String(rows[j][headIdx["場地"]]) === String(d.court) &&
              String(rows[j][headIdx["比賽狀態"]]).includes("待賽")) {
            
            // 寫入下一棒初始分
            sheet.getRange(j + 1, headIdx["A隊比分"] + 1).setValue(d.scoreA);
            sheet.getRange(j + 1, headIdx["B隊比分"] + 1).setValue(d.scoreB);
            break;
          }
        }
      }
      return { status: "success", message: "比分已更新，自動銜接下一手！" };
    }
  }
  return { status: "error", message: "找不到該場追分接力賽" };
}

/**
 * 產生決賽與季軍賽程，接收前端自訂出戰順序表
 */
function logicGenerateFinals(yearMonth, customizedData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!customizedData || customizedData.length === 0) return { status: "error", message: "沒有接收到自訂賽程資料" };

  let sheet = ss.getSheetByName(CONFIG.SHEET_CHASING);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_CHASING);
  
  const headers = ensureChasingHeaders(sheet);
  
  // 清除舊的該月決賽資料
  const oldData = sheet.getDataRange().getValues();
  for (let i = oldData.length - 1; i >= 1; i--) {
     let rYM = oldData[i][0];
     if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, CONFIG.TIMEZONE, "yyyy-MM-dd");
     if (String(rYM).substring(0, 10) === String(yearMonth).substring(0, 10) && (String(oldData[i][headers.indexOf("區")]).includes("冠軍賽") || String(oldData[i][headers.indexOf("區")]).includes("季軍賽"))) {
         sheet.deleteRow(i + 1);
     }
  }

  const headIdx = {};
  headers.forEach((h, i) => headIdx[h] = i);

  customizedData.forEach(p => {
    const rowObj = [];
    headers.forEach(() => rowObj.push(""));
    
    rowObj[headIdx["年月"]] = yearMonth;
    rowObj[headIdx["比賽時間"]] = "15:30";
    rowObj[headIdx["輪次"]] = p.targetScore; 
    rowObj[headIdx["區"]] = p.area;
    rowObj[headIdx["場地"]] = p.court;
    rowObj[headIdx["A隊名"]] = p.teamA;
    rowObj[headIdx["A隊員1"]] = p.A1;
    rowObj[headIdx["A隊員2"]] = p.A2;
    rowObj[headIdx["A隊員3"]] = p.A3 || "";
    rowObj[headIdx["A隊比分"]] = 0;
    rowObj[headIdx["B隊比分"]] = 0;
    rowObj[headIdx["B隊名"]] = p.teamB;
    rowObj[headIdx["B隊員1"]] = p.B1;
    rowObj[headIdx["B隊員2"]] = p.B2;
    rowObj[headIdx["B隊員3"]] = p.B3 || "";
    rowObj[headIdx["裁判"]] = "";
    rowObj[headIdx["比賽狀態"]] = "待賽";

    sheet.appendRow(rowObj);
  });

  return { status: "success", message: "冠軍賽與季軍賽程已依照自訂順序成功產生！" };
}

/**
 * 智慧自動分組 (分區獨立補齊：每隊每區各 2 人制)
 */
function logicAutoGroup(yearMonth) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_REGISTRATION);
  const data = sheet.getDataRange().getValues();
  
  // 1. 抓取名單並依據正確的「區」分桶 (4隊 x 3區 x 2人 = 24人)
  const areaGroups = {};
  CONFIG.AREAS.forEach(area => areaGroups[area] = []);

  for (let i = 1; i < data.length; i++) {
    let rYM = data[i][0];
    if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, CONFIG.TIMEZONE, "yyyy-MM");
    if (String(rYM) === String(yearMonth)) {
      // 區在第 5 欄 (Index 4)
      const pAreaRaw = String(data[i][4] || "").trim();
      // 模糊比對區名 (例如 "猛禽" 匹配 "猛禽區")
      const normalizedArea = CONFIG.AREAS.find(a => a.includes(pAreaRaw) || pAreaRaw.includes(a.replace("區",""))) || pAreaRaw;
      
      if (areaGroups[normalizedArea]) {
        areaGroups[normalizedArea].push({ 
          rowIdx: i + 1, 
          name: data[i][1], 
          team: String(data[i][3] || "").trim() // 隊名在第 4 欄 (Index 3)
        });
      }
    }
  }

  // 2. 嚴格驗證分區人數
  for (const area of CONFIG.AREAS) {
    const list = areaGroups[area];
    if (list.length !== 8) {
      return { 
        status: "error", 
        message: `分組失敗：「${area}」目前報名 ${list.length} 人，不符合「每分區 8 人」的規則 (共需 24 人)。請補齊名單。` 
      };
    }
  }

  // 3. 分區進行隨機分配
  const updates = [];
  for (const area of CONFIG.AREAS) {
    const list = areaGroups[area];
    const teamCounts = {};
    CONFIG.TEAMS.forEach(t => teamCounts[t] = 0);
    const unassigned = [];

    // 統計該區已手動分配與未分配的人員
    list.forEach(item => {
      if (item.team && CONFIG.TEAMS.includes(item.team)) {
        teamCounts[item.team]++;
      } else {
        unassigned.push(item);
      }
    });

    // 檢查分區內是否已經超員 (每區每隊限 2 人)
    const over = CONFIG.TEAMS.filter(t => teamCounts[t] > 2);
    if (over.length > 0) {
      return { status: "error", message: `分組失敗：在「${area}」中，${over.join(", ")} 已手動指定超過 2 人。` };
    }

    // 產生該區的可用「隊名坑位」 (每個隊伍目標 2 人)
    const slots = [];
    CONFIG.TEAMS.forEach(team => {
      const need = 2 - teamCounts[team];
      for (let i = 0; i < need; i++) slots.push(team);
    });

    // 將該區未分配人員隨機洗牌並填坑
    const shuffledUnassigned = unassigned.sort(() => Math.random() - 0.5);
    shuffledUnassigned.forEach((item, idx) => {
      updates.push({ rowIdx: item.rowIdx, team: slots[idx] });
    });
  }

  // 4. 執行寫入隊名 (第 4 欄)
  updates.forEach(upd => {
    sheet.getRange(upd.rowIdx, 4).setValue(upd.team);
  });

  return { status: "success", message: `智慧分組成功！已確保每隊在三區中各佔 2 人，共補齊 ${updates.length} 位人員。` };
}

/**
 * 統計月度積點
 * 包含：循環賽積分、淘汰賽積分、手動積分、上月結餘。
 */
function logicCalculatePoints(yearMonth, manualData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 取得「距離本日最近且早於本日」的歷史紀錄 (不再限制於上個月)
  let pSheet = ss.getSheetByName(CONFIG.SHEET_POINTS);
  const prevBalances = {};
  
  if (pSheet) {
    const pData = pSheet.getDataRange().getValues();
    if (pData.length > 1) {
      const headers = pData[0];
      const ymIdx = headers.indexOf("年月");
      const nameIdx = headers.indexOf("姓名");
      const totalIdx = headers.indexOf("累積積點");
      
      // 找出所有早於 current date 的唯一日期，並由晚到早排序
      const targetDate = new Date(yearMonth);
      let latestPrevDate = null;
      let latestPrevDateStr = "";
      
      for (let i = 1; i < pData.length; i++) {
        let rowDate = pData[i][ymIdx];
        if (!(rowDate instanceof Date)) rowDate = new Date(rowDate);
        
        if (rowDate < targetDate) {
          if (!latestPrevDate || rowDate > latestPrevDate) {
            latestPrevDate = rowDate;
            latestPrevDateStr = Utilities.formatDate(rowDate, CONFIG.TIMEZONE, "yyyy-MM-dd");
          }
        }
      }
      
      // 如果找到了最近的歷史日期，抓取該日期的所有最後結餘
      if (latestPrevDateStr) {
        for (let i = 1; i < pData.length; i++) {
          let rowDate = pData[i][ymIdx];
          const rowDateStr = rowDate instanceof Date ? 
            Utilities.formatDate(rowDate, CONFIG.TIMEZONE, "yyyy-MM-dd") : String(rowDate).substring(0, 10);
            
          if (rowDateStr === latestPrevDateStr) {
            prevBalances[pData[i][nameIdx]] = parseInt(pData[i][totalIdx]) || 0;
          }
        }
      }
    }
  }

  // 3. 初始化全體球員字典 mapping
  const playersMap = {}; 
  
  // 先把有舊餘額的球員塞入 (即使這個月沒報名)
  Object.keys(prevBalances).forEach(name => {
    playersMap[name] = { 
      name: name, team: "", area: "", 
      rrRank: "-", elimRank: "-", 
      currPts: prevBalances[name], 
      guessPts: 0, refPts: 0, rrPts: 0, elimPts: 0, totalPts: 0 
    };
  });
  
  // 讀取當月報名清單
  const currReg = helperGetData(CONFIG.SHEET_REGISTRATION, yearMonth);
  currReg.forEach(p => {
    const name = p["姓名"];
    if (!playersMap[name]) {
      playersMap[name] = { 
        name: name, team: p["隊名"] || "", area: p["區"] || "", 
        rrRank: "-", elimRank: "-", 
        currPts: prevBalances[name] || 0, 
        guessPts: 0, refPts: 0, rrPts: 0, elimPts: 0, totalPts: 0 
      };
    } else {
      playersMap[name].team = p["隊名"] || playersMap[name].team;
      playersMap[name].area = p["區"] || playersMap[name].area;
    }
  });

  // 套用手動給分 (猜隊, 裁判)
  if (manualData) {
    Object.keys(manualData).forEach(name => {
      if (!playersMap[name]) {
         playersMap[name] = { name: name, currPts: 0, guessPts: 0, refPts: 0, rrPts: 0, elimPts: 0, totalPts: 0, team: "", area: "", rrRank: "-", elimRank: "-" };
      }
      playersMap[name].guessPts = parseInt(manualData[name].guess) || 0;
      playersMap[name].refPts = parseInt(manualData[name].ref) || 0;
    });
  }

  // 4. 計算當月循環賽每場得失分
  const rrMatches = helperGetData(CONFIG.SHEET_ROUND_ROBIN, yearMonth);
  const areaPoints = {
    "猛禽區": { win: 100, lose: 50 },
    "猛禽": { win: 100, lose: 50 },
    "小鳥區": { win: 80, lose: 40 },
    "小鳥": { win: 80, lose: 40 },
    "鳥蛋區": { win: 60, lose: 30 },
    "鳥蛋": { win: 60, lose: 30 }
  };
  
  rrMatches.forEach(m => {
    const sA = parseInt(m["A隊比分"]) || 0;
    const sB = parseInt(m["B隊比分"]) || 0;
    if (sA === 0 && sB === 0) return; // 該場尚未有比分
    
    const area = m["區"];
    const ptsCfg = areaPoints[area] || { win: 0, lose: 0 };
    
    let aPts = 0, bPts = 0;
    if (sA > sB) { aPts = ptsCfg.win; bPts = ptsCfg.lose; }
    else if (sB > sA) { aPts = ptsCfg.lose; bPts = ptsCfg.win; }
    
    // 把分數分給 A/B 隊員
    const teamAPlayers = [];
    if (m["A隊員1"] && m["A隊員1"] !== "待定") teamAPlayers.push(m["A隊員1"]);
    if (m["A隊員2"] && m["A隊員2"] !== "待定") teamAPlayers.push(m["A隊員2"]);
    
    const teamBPlayers = [];
    if (m["B隊員1"] && m["B隊員1"] !== "待定") teamBPlayers.push(m["B隊員1"]);
    if (m["B隊員2"] && m["B隊員2"] !== "待定") teamBPlayers.push(m["B隊員2"]);

    teamAPlayers.forEach(p => {
      if (playersMap[p]) playersMap[p].rrPts += aPts;
    });
    teamBPlayers.forEach(p => {
      if (playersMap[p]) playersMap[p].rrPts += bPts;
    });
  });

  // 計算循環賽隊伍排名 (供顯示使用)
  const teamRankings = helperGetTeamRankings(yearMonth);
  const teamToRank = {};
  teamRankings.forEach((t, idx) => {
    teamToRank[t.name] = idx + 1;
  });
  
  Object.keys(playersMap).forEach(name => {
    const t = playersMap[name].team;
    if (t && teamToRank[t]) {
      playersMap[name].rrRank = "第" + teamToRank[t] + "名";
    }
  });

  // 5. 計算當月淘汰賽名次給分 (包含 A隊員3, B隊員3)
  const chasingMatches = helperGetData(CONFIG.SHEET_CHASING, yearMonth);
  // 篩選出決賽場次 (通常是 66 分或該系列最後一場)
  const finals = chasingMatches.filter(m => (String(m["區"]).includes("冠軍賽") || String(m["區"]).includes("季軍賽")) && String(m["比賽狀態"]).includes("已完賽"));
  
  // 找出各組最終比分最高的場次來判定隊伍排名
  const finalRanks = {}; // { "冠軍賽": { winner: "", loser: "" } }
  finals.forEach(m => {
    const area = m["區"];
    if (!finalRanks[area]) finalRanks[area] = { sA: -1, sB: -1, teamA: m["A隊名"], teamB: m["B隊名"] };
    const sA = parseInt(m["A隊比分"]) || 0;
    const sB = parseInt(m["B隊比分"]) || 0;
    if (sA > finalRanks[area].sA || sB > finalRanks[area].sB) {
      finalRanks[area].sA = sA;
      finalRanks[area].sB = sB;
    }
  });

  const elimPointsMapping = {}; 
  const elimRankMapping = {}; 

  Object.keys(finalRanks).forEach(area => {
    const r = finalRanks[area];
    const isChamp = area.includes("冠軍賽");
    if (r.sA > r.sB) {
      if (isChamp) { elimPointsMapping[r.teamA] = 300; elimRankMapping[r.teamA] = "冠軍"; elimPointsMapping[r.teamB] = 250; elimRankMapping[r.teamB] = "亞軍"; }
      else { elimPointsMapping[r.teamA] = 200; elimRankMapping[r.teamA] = "季軍"; elimPointsMapping[r.teamB] = 150; elimRankMapping[r.teamB] = "殿軍"; }
    } else if (r.sB > r.sA) {
      if (isChamp) { elimPointsMapping[r.teamB] = 300; elimRankMapping[r.teamB] = "冠軍"; elimPointsMapping[r.teamA] = 250; elimRankMapping[r.teamA] = "亞軍"; }
      else { elimPointsMapping[r.teamB] = 200; elimRankMapping[r.teamB] = "季軍"; elimPointsMapping[r.teamA] = 150; elimRankMapping[r.teamA] = "殿軍"; }
    }
  });

  // 分配積分至所有隊員 (含 1, 2, 3)
  chasingMatches.forEach(m => {
    const tA = m["A隊名"];
    const tB = m["B隊名"];
    
    [tA, tB].forEach(team => {
      if (elimPointsMapping[team]) {
        const isTeamA = (team === tA);
        const prefix = isTeamA ? "A隊員" : "B隊員";
        [1, 2, 3].forEach(num => {
          const pName = m[prefix + num];
          if (pName && pName !== "待定" && playersMap[pName]) {
            playersMap[pName].elimPts = elimPointsMapping[team];
            playersMap[pName].elimRank = elimRankMapping[team];
          }
        });
      }
    });
  });

  // 6. 加總並排序結果陣列
  const finalArray = [];
  Object.keys(playersMap).forEach(name => {
    const p = playersMap[name];
    p.totalPts = p.currPts + p.guessPts + p.refPts + p.rrPts + p.elimPts;
    finalArray.push(p);
  });

  finalArray.sort((a, b) => b.totalPts - a.totalPts);

  // 7. 將結果寫入積點統計表
  pSheet = ss.getSheetByName(CONFIG.SHEET_POINTS);
  if (!pSheet) {
    pSheet = ss.insertSheet(CONFIG.SHEET_POINTS);
  }
  
  // 清除本月的防呆處理
  const pData = pSheet.getDataRange().getValues();
  for (let i = pData.length - 1; i >= 1; i--) {
    let rYM = pData[i][0];
    if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, CONFIG.TIMEZONE, "yyyy-MM-dd");
    if (String(rYM).substring(0, 10) === String(yearMonth).substring(0, 10)) pSheet.deleteRow(i + 1);
  }
  
  if (pSheet.getLastRow() === 0) {
    pSheet.appendRow([
      "年月", "排名", "姓名", "隊名", "區", 
      "循環名次", "淘汰名次", 
      "目前積點", "猜隊", "裁判", "循環分", "淘汰分", "累積積點"
    ]);
  }
  
  // 核心效能優化：改為 2D 陣列批次寫入 (setValues) 而不是一個一個 appendRow
  if (finalArray.length > 0) {
    const rowsToAppend = finalArray.map((p, idx) => [
      yearMonth, 
      idx + 1,        
      p.name, 
      p.team, 
      p.area, 
      p.rrRank,
      p.elimRank,
      p.currPts,
      p.guessPts,
      p.refPts,
      p.rrPts,
      p.elimPts,
      p.totalPts
    ]);
    
    pSheet.getRange(pSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
  }
  
  return { 
    status: "success", 
    message: "月結積點計算完成，共統計 " + finalArray.length + " 位球員！", 
    data: finalArray 
  };
}

/**
 * 取得前台顯示專用的積點紀錄 (純讀取，不計算，效能優化)
 */
function helperGetPointsRecords(yearMonth) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_POINTS);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const result = [];
  const headers = data[0];
  
  // 找到對應月分且依照排名排序 (Excel 裡已經排好了)
  for (let i = 1; i < data.length; i++) {
    let rYM = data[i][0];
    if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, CONFIG.TIMEZONE, "yyyy-MM-dd");
    
    if (String(rYM).substring(0, 10) === String(yearMonth).substring(0, 10)) {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = data[i][idx];
      });
      // 為維持與 calculatePoints 回傳格式一致
      result.push({
        name: obj["姓名"],
        team: obj["隊名"],
        area: obj["區"],
        totalPts: obj["累積積點"]
      });
    }
  }
  return result;
}

/**
 * 取得所有特殊紀錄
 */
function helperGetSpecialRecords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_SPECIAL);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const result = [];
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    const ob = {};
    headers.forEach((h, idx) => {
      let val = data[i][idx];
      if (idx === 0 && val instanceof Date) {
        val = Utilities.formatDate(val, CONFIG.TIMEZONE, "yyyy-MM-dd");
      }
      ob[h] = val;
    });
    result.push(ob);
  }
  return result;
}

/**
 * 儲存特殊紀錄
 */
function logicSaveSpecialRecords(yearMonth, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_SPECIAL);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_SPECIAL);
    sheet.appendRow(["年月", "類型", "姓名", "備註"]);
  }

  const oldData = sheet.getDataRange().getValues();
  for (let i = oldData.length - 1; i >= 1; i--) {
    let rYM = oldData[i][0];
    if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, CONFIG.TIMEZONE, "yyyy-MM-dd");
    if (String(rYM).substring(0, 10) === String(yearMonth).substring(0, 10)) {
      sheet.deleteRow(i + 1);
    }
  }

  if (data.qName) sheet.appendRow([yearMonth, "禽王", data.qName, data.qNote || ""]);
  if (data.bName) sheet.appendRow([yearMonth, "鳥王", data.bName, data.bNote || ""]);
  if (data.eName) sheet.appendRow([yearMonth, "蛋王", data.eName, data.eNote || ""]);
  if (data.cName) sheet.appendRow([yearMonth, "追分王", data.cName, data.cNote || ""]);

  return { status: "success", message: "特殊紀錄已成功發布！" };
}

/**
 * 同步球員到獨立的球員資料庫中
 */
function syncPlayerDatabase(names) {
  if (!names || names.length === 0) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_PLAYER_DB);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_PLAYER_DB);
    sheet.appendRow(["姓名", "照片網址"]);
  }

  const data = sheet.getDataRange().getValues();
  const existingNames = new Set();
  
  for (let i = 1; i < data.length; i++) {
    const n = String(data[i][0]).trim();
    if (n) existingNames.add(n);
  }

  const newNames = [...new Set(names)].filter(n => !existingNames.has(String(n).trim()));
  newNames.forEach(n => {
    sheet.appendRow([n.trim(), ""]);
  });
}

/**
 * 獲取球員名單與照片對應圖
 */
function logicGetPlayersInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_PLAYER_DB);
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues();
  const playerMap = {};
  for (let i = 1; i < data.length; i++) {
    const n = String(data[i][0]).trim();
    const photoUrl = String(data[i][1]).trim();
    if (n) playerMap[n] = photoUrl;
  }
  return playerMap;
}

/**
 * 上傳球員照片 (Base64) 至 Google Drive
 */
function logicUploadPhoto(data) {
  const { name, base64Data, mimeType } = data;
  if (!name || !base64Data) {
    return { status: "error", message: "缺少必要參數 (姓名或圖片資料)" };
  }

  // 1. 尋找或建立統一照片資料夾
  const folderName = "羽球系統照片";
  let uploadFolder;
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    uploadFolder = folders.next();
  } else {
    uploadFolder = DriveApp.createFolder(folderName);
    // 注意：在此 GAS 架構下，建立後需管理員手動調整為「知道連結的人均可檢視」
  }

  // 2. 將 base64 解碼並轉成 Blob
  const byteString = Utilities.base64Decode(base64Data.split(',')[1] || base64Data);
  const blob = Utilities.newBlob(byteString, mimeType || "image/jpeg", `${name}_大頭貼.jpg`);

  // 3. 建立檔案並組成分享網址
  const file = uploadFolder.createFile(blob);
  const fileId = file.getId();
  const photoUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

  // 4. 更新球員資料庫
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_PLAYER_DB);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_PLAYER_DB);
    sheet.appendRow(["姓名", "照片網址"]);
  }

  const rows = sheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(name).trim()) {
      sheet.getRange(i + 1, 2).setValue(photoUrl);
      found = true;
      break;
    }
  }

  // 若沒發現這名球員，則新增一行
  if (!found) {
    sheet.appendRow([name.trim(), photoUrl]);
  }

  return { status: "success", message: "照片上傳成功！", photoUrl: photoUrl };
}
