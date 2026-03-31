/**
 * 羽毛球比賽系統 - Google Apps Script 後端 (終極穩定版)
 */

const CONFIG = {
  SHEET_REGISTRATION: "報名紀錄",
  SHEET_MEMBER: "隊員紀錄",
  SHEET_ROUND_ROBIN: "預賽紀錄表",
  SHEET_CHASING: "追分賽紀錄表",
  SHEET_ELIMINATION: "單淘汰追分賽",
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
      case "updateChasingScore":
        result = logicUpdateChasingScore(data);
        break;
      case "updatePlayerOrder":
        result = logicUpdatePlayerOrder(data);
        break;
      case "generateChasingSchedule":
        result = logicGenerateChasingSchedule(yearMonth);
        break;
      case "generateFinals":
        result = logicGenerateFinals(yearMonth);
        break;
      case "clearData":
        result = logicClearData(yearMonth, e.parameter.sheet);
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
  const headers = data[0];
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    // 處理第一欄 (年月)
    let rYM = data[i][0];
    if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, CONFIG.TIMEZONE, "yyyy-MM");
    
    if (!yearMonth || String(rYM).trim() === String(yearMonth).trim()) {
      const obj = {};
      headers.forEach((h, idx) => {
        let val = data[i][idx];
        
        // 處理第二欄 (比賽時間)：如果是 Date 物件，轉為 HH:mm 臺北時間
        if (idx === 1 && val instanceof Date) {
          val = Utilities.formatDate(val, CONFIG.TIMEZONE, "HH:mm");
        }
        
        obj[h] = val;
      });
      result.push(obj);
    }
  }
  return result;
}

/**
 * 寫入報名資料
 */
function logicAddRegistrations(dataList) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_REGISTRATION);
  dataList.forEach(d => {
    sheet.appendRow([d.yearMonth, d.area, d.team, d.name, d.phone, new Date()]);
  });
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
      if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, Session.getScriptTimeZone(), "yyyy-MM");
      if (String(rYM || "").trim() === String(yearMonth).trim()) sheet.deleteRow(i + 1);
    }
  }
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["年月", "比賽時間", "輪次", "區", "場地", "A隊名", "A隊員1", "A隊員2", "A隊比分", "B隊比分", "B隊名", "B隊員1", "B隊員2", "裁判", "比賽狀態"]);
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
        yearMonth, matchTime, roundLabel, area, court, 
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
    let rYM = rows[i][0];
    if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, CONFIG.TIMEZONE, "yyyy-MM");
    
    if (String(rYM) === String(d.yearMonth) && rows[i][2] == d.round && rows[i][4] == d.court) {
      if (d.startTime) sheet.getRange(i + 1, 2).setValue(d.startTime); // 回寫實際開賽時間
      sheet.getRange(i + 1, 9).setValue(d.scoreA);
      sheet.getRange(i + 1, 10).setValue(d.scoreB);
      if (d.referee !== undefined) sheet.getRange(i + 1, 14).setValue(d.referee);
      
      const newStatus = d.status || "已完賽";
      sheet.getRange(i + 1, 15).setValue(newStatus);
      
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
function helperGetTeamRankings(yearMonth) {
  const items = helperGetData(CONFIG.SHEET_ROUND_ROBIN, yearMonth);
  const stats = {};
  
  // 初始化
  CONFIG.TEAMS.forEach(t => {
    stats[t] = { points: 0, scored: 0, conceded: 0 };
  });

  // 按輪次分組
  const rounds = {};
  items.forEach(m => {
    const rid = m.輪次;
    if (!rounds[rid]) rounds[rid] = [];
    rounds[rid].push(m);
  });

  // 計算每輪積分
  Object.keys(rounds).forEach(rid => {
    const group = rounds[rid];
    const teamA = group[0].A隊名;
    const teamB = group[0].B隊名;
    let aWins = 0, bWins = 0;

    group.forEach(m => {
      const sA = parseInt(m.A隊比分 || 0);
      const sB = parseInt(m.B隊比分 || 0);
      stats[teamA].scored += sA;
      stats[teamA].conceded += sB;
      stats[teamB].scored += sB;
      stats[teamB].conceded += sA;
      if (sA > sB) aWins++;
      else if (sB > sA) bWins++;
    });

    if (aWins > bWins) { stats[teamA].points += 3; stats[teamB].points += 1; }
    else if (bWins > aWins) { stats[teamB].points += 3; stats[teamA].points += 1; }
  });

  const sorted = Object.keys(stats).map(name => {
    const s = stats[name];
    const quo = s.conceded === 0 ? s.scored : (s.scored / s.conceded);
    return { name, points: s.points, quotient: quo };
  }).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.quotient - a.quotient;
  });

  return sorted; // 傳回 [{name, points, quotient}, ...] 已排序
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
 * 產生追分賽程 (準決賽 1v4, 2v3)
 */
function logicGenerateChasingSchedule(yearMonth) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ranks = helperGetTeamRankings(yearMonth);
  if (ranks.length < 4) return { status: "error", message: "預賽排名不足 4 隊" };

  const regItems = helperGetData(CONFIG.SHEET_REGISTRATION, yearMonth);
  let sheet = ss.getSheetByName(CONFIG.SHEET_CHASING);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_CHASING);
  }
  
  // 清除舊的該月資料
  const oldData = sheet.getDataRange().getValues();
  for (let i = oldData.length - 1; i >= 1; i--) {
     let rYM = oldData[i][0];
     if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, CONFIG.TIMEZONE, "yyyy-MM");
     if (String(rYM) === String(yearMonth)) sheet.deleteRow(i + 1);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["年月", "比賽時間", "輪次", "區", "場地", "A隊名", "A隊員1", "A隊員2", "A隊比分", "B隊比分", "B隊名", "B隊員1", "B隊員2", "裁判", "比賽狀態"]);
  }

  const pairings = [
    { teamA: ranks[0].name, teamB: ranks[3].name, court: "C", round: "準決賽(1v4)" },
    { teamA: ranks[1].name, teamB: ranks[2].name, court: "B", round: "準決賽(2v3)" }
  ];

  pairings.forEach(p => {
    // 強化過濾邏輯：確保隊名匹配精準
    const playersA = regItems.filter(i => String(i.隊名 || i["隊名"]).trim() === String(p.teamA).trim());
    const playersB = regItems.filter(i => String(i.隊名 || i["隊名"]).trim() === String(p.teamB).trim());

    const sequence = [[1,2], [2,3], [3,4], [4,5], [5,6], [6,1]];
    
    sequence.forEach((pair, idx) => {
      // 強化搜尋邏輯：數字轉型比對
      const pA1Obj = playersA.find(x => parseInt(x.棒次 || x["棒次"]) === pair[0]);
      const pA2Obj = playersA.find(x => parseInt(x.棒次 || x["棒次"]) === pair[1]);
      const pB1Obj = playersB.find(x => parseInt(x.棒次 || x["棒次"]) === pair[0]);
      const pB2Obj = playersB.find(x => parseInt(x.棒次 || x["棒次"]) === pair[1]);
      
      const pA1 = pA1Obj ? pA1Obj.姓名 || pA1Obj["姓名"] : "待定";
      const pA2 = pA2Obj ? pA2Obj.姓名 || pA2Obj["姓名"] : "待定";
      const pB1 = pB1Obj ? pB1Obj.姓名 || pB1Obj["姓名"] : "待定";
      const pB2 = pB2Obj ? pB2Obj.姓名 || pB2Obj["姓名"] : "待定";
      
      const targetScore = (idx + 1) * 11;
      const relayLabel = targetScore + "分接力";

      sheet.appendRow([
        yearMonth, "15:30", relayLabel, p.round, p.court,
        p.teamA, pA1, pA2, 0,
        0, p.teamB, pB1, pB2, "", "待賽"
      ]);
    });
  });

  return { status: "success", message: "追分賽準決賽程已成功產生！" };
}

/**
 * 更新追分賽裁判比分 (分頁 8 專屬回寫)
 */
function logicUpdateChasingScore(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_CHASING);
  if (!sheet) return { status: "error", message: "找不到追分賽紀錄表" };
  
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    let rYM = rows[i][0];
    if (rYM instanceof Date) rYM = Utilities.formatDate(rYM, CONFIG.TIMEZONE, "yyyy-MM");
    
    // 對齊邏輯：年月 && 輪次 (接力進度) && 區 (對戰分組) && 場地
    if (String(rYM) === String(d.yearMonth) && 
        rows[i][2] == d.round && 
        rows[i][3] == d.area && 
        rows[i][4] == d.court) {
      
      if (d.startTime) sheet.getRange(i + 1, 14).setValue("開賽: " + d.startTime); // 備註在裁判欄或時間欄，依習慣錄製
      sheet.getRange(i + 1, 9).setValue(d.scoreA);
      sheet.getRange(i + 1, 10).setValue(d.scoreB);
      if (d.referee !== undefined) sheet.getRange(i + 1, 14).setValue(d.referee);
      
      const newStatus = d.status || "已完賽";
      sheet.getRange(i + 1, 15).setValue(newStatus);
      
      // --- 新增：接力比分自動承接邏輯 ---
      if (newStatus === "已完賽") {
        const currentRef = rows[i][2]; // 例如 "11分接力"
        const currentScore = parseInt(currentRef.replace(/[^0-9]/g, ""));
        
        if (currentScore < 66) {
          const nextScore = currentScore + 11;
          const nextRef = nextScore + "分接力";
          
          // 搜尋下一棒的列
          for (let j = 1; j < rows.length; j++) {
            if (String(rows[j][2]) === nextRef && 
                String(rows[j][3]) === String(d.area) && 
                String(rows[j][4]) === String(d.court)) {
              
              sheet.getRange(j + 1, 9).setValue(d.scoreA); // 寫入下一棒 A 初始分
              sheet.getRange(j + 1, 10).setValue(d.scoreB); // 寫入下一棒 B 初始分
              break;
            }
          }
        }
      }
      // --------------------------------
      
      return { status: "success", message: "追分賽得分已成功更新，並已交接至下一棒！" };
    }
  }
  return { status: "error", message: "找不到該場追分接力賽 (請確認輪次與分組)" };
}

/**
 * 產生決賽與季軍賽程 (基於準決賽結果)
 */
function logicGenerateFinals(yearMonth) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const chasingItems = helperGetData(CONFIG.SHEET_CHASING, yearMonth);
  if (chasingItems.length === 0) return { status: "error", message: "找不到準決賽紀錄" };

  // 1. 找出準決賽的最終分進度 (66分接力)
  const semiFinals = chasingItems.filter(i => {
    const relay = String(i.輪次 || i["輪次"] || "");
    const area = String(i.區 || i["區"] || "");
    return area.includes("準決賽") && relay.includes("66分");
  });

  if (semiFinals.length < 2) return { status: "error", message: "準決賽尚未全數完賽 (需有兩組 66 分紀錄)" };

  // 2. 判定勝負
  const winners = [];
  const losers = [];

  semiFinals.forEach(m => {
    const sA = parseInt(m.A隊比分 || 0);
    const sB = parseInt(m.B隊比分 || 0);
    const tA = m.A隊名 || m["A隊名"];
    const tB = m.B隊名 || m["B隊名"];

    if (sA > sB) {
      winners.push(tA);
      losers.push(tB);
    } else {
      winners.push(tB);
      losers.push(tA);
    }
  });

  // 3. 準備寫入 (增量寫入，不清除舊資料)
  const regItems = helperGetData(CONFIG.SHEET_REGISTRATION, yearMonth);
  const sheet = ss.getSheetByName(CONFIG.SHEET_CHASING);

  const pairings = [
    { teamA: winners[0], teamB: winners[1], court: "C", round: "冠軍賽" },
    { teamA: losers[0], teamB: losers[1], court: "B", round: "季軍賽" }
  ];

  pairings.forEach(p => {
    const playersA = regItems.filter(i => String(i.隊名 || i["隊名"]).trim() === String(p.teamA).trim());
    const playersB = regItems.filter(i => String(i.隊名 || i["隊名"]).trim() === String(p.teamB).trim());

    const sequence = [[1,2], [2,3], [3,4], [4,5], [5,6], [6,1]];
    sequence.forEach((pair, idx) => {
      const pA1Obj = playersA.find(x => parseInt(x.棒次 || x["棒次"]) === pair[0]);
      const pA2Obj = playersA.find(x => parseInt(x.棒次 || x["棒次"]) === pair[1]);
      const pB1Obj = playersB.find(x => parseInt(x.棒次 || x["棒次"]) === pair[0]);
      const pB2Obj = playersB.find(x => parseInt(x.棒次 || x["棒次"]) === pair[1]);
      
      const pA1 = pA1Obj ? pA1Obj.姓名 || pA1Obj["姓名"] : "待定";
      const pA2 = pA2Obj ? pA2Obj.姓名 || pA2Obj["姓名"] : "待定";
      const pB1 = pB1Obj ? pB1Obj.姓名 || pB1Obj["姓名"] : "待定";
      const pB2 = pB2Obj ? pB2Obj.姓名 || pB2Obj["姓名"] : "待定";
      
      const relayLabel = ((idx + 1) * 11) + "分接力";
      sheet.appendRow([
        yearMonth, "15:30", relayLabel, p.round, p.court,
        p.teamA, pA1, pA2, 0, 0, p.teamB, pB1, pB2, "", "待賽"
      ]);
    });
  });

  return { status: "success", message: "冠軍賽與季軍賽程已成功產生！" };
}
