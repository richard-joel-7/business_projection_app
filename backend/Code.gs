const ADMIN_EMAILS = ["admin1@phantom-fx.com", "admin2@phantom-fx.com", "richard.j@phantom-fx.com"];
const REVEAL_CLIENT_INFO_TO_PRODUCTION = false; // Toggle to true if Production role should see real names

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Business Projections')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getUserEmailAndRole() {
  const email = Session.getActiveUser().getEmail();
  const isAdmin = ADMIN_EMAILS.includes(email);
  return { email: email, isAdmin: isAdmin };
}

function login(email, password) {
  const users = getSheetData('Users Credentials');
  const normalizedEmail = email.toLowerCase().trim();
  const user = users.find(u => String(u['Email']).toLowerCase().trim() === normalizedEmail && String(u['Password']).trim() === String(password).trim());
  
  if (user) {
    const role = String(user['Role'] || 'Biz').trim();
    const isAdmin = role.toLowerCase() === 'admin';
    
    return { 
      email: user['Email'], 
      name: user['User Name'], 
      isAdmin: isAdmin,
      role: role,
      success: true
    };
  }
  return { success: false, error: 'Invalid credentials' };
}

// --- MAPPING HELPERS ---

function mapProjectToBackend(p) {
  const blockId = p['Project ID'];
  const dealId = p['Deal_id'] || '';
  const region = p['Region Type'] || p['Region'];
  const office = p['Office'] || p['Contracting_Office'];
  const bizPoc = p['Biz Poc'] || p['BizPoC'];
  const client = p['Client'];
  const dealName = p['Project Name'];
  const blockName = p['Project Name'];
  const dealStage = p['Project Status'] || p['deal_stage'];
  const blockStage = p['Project Status'] || p['Block_Stage'];
  const inBidding = p['Bidding'] || p['In_Bidding'];
  const winningPct = p['Winning %'] || p['Winning_Percentage'];
  const homeAmount = p['Value in Home Currency'] || p['Home_Amount'];
  const homeCurrency = p['Home Currency'] || p['Home_Currency'];
  const amountUsd = p['Amount in USD'] || p['Amount_in_USD'];
  const profitPct = p['Profit %'] || p['Profit_Percentage'];
  const closeDate = ensureTextDate(p['Close Date'] || p['DealclosingDate']);
  const email = p['Gmail'] || p['email'];

  return {
    'Block_id': blockId, 'Block ID': blockId,
    'Deal_id': dealId, 'Deal ID': dealId,
    'Region': region,
    'Contracting_Office': office, 'Contracting Office': office, 'Office': office,
    'BizPoC': bizPoc, 'Biz Poc': bizPoc,
    'Client': client,
    'DealName': dealName, 'Deal Name': dealName,
    'Block_Name': blockName, 'Block Name': blockName,
    'deal_stage': dealStage, 'Deal Stage': dealStage,
    'Block_Stage': blockStage, 'Block Stage': blockStage,
    'In_Bidding': inBidding, 'In Bidding': inBidding,
    'Winning_Percentage': winningPct, 'Winning Percentage': winningPct,
    'Home_Amount': homeAmount, 'Home Amount': homeAmount,
    'Home_Currency': homeCurrency, 'Home Currency': homeCurrency,
    'Amount_in_USD': amountUsd, 'Amount in USD': amountUsd,
    'Profit_Percentage': profitPct, 'Profit Percentage': profitPct,
    'DealclosingDate': closeDate, 'Deal Closing Date': closeDate, 'Close Date': closeDate,
    'email': email, 'Email': email
  };
}

function mapProjectToFrontend(p) {
  const blockId = p['Block_id'] || p['Block ID'] || p['Project ID'];
  const dealId = p['Deal_id'] || p['Deal ID'];
  const region = p['Region'] || p['Region Type'];
  const office = p['Contracting_Office'] || p['Contracting Office'] || p['Office'];
  const bizPoc = p['BizPoC'] || p['Biz Poc'];
  const client = p['Client'];
  const blockName = p['Block_Name'] || p['Block Name'] || p['Project Name'];
  const dealStage = p['deal_stage'] || p['Deal Stage'];
  const blockStage = p['Block_Stage'] || p['Block Stage'];
  const inBidding = p['In_Bidding'] || p['In Bidding'] || p['Bidding'];
  const winningPct = p['Winning_Percentage'] || p['Winning Percentage'] || p['Winning %'];
  const homeAmount = p['Home_Amount'] || p['Home Amount'] || p['Value in Home Currency'];
  const homeCurrency = p['Home_Currency'] || p['Home Currency'];
  const amountUsd = p['Amount_in_USD'] || p['Amount in USD'];
  const profitPct = p['Profit_Percentage'] || p['Profit Percentage'] || p['Profit %'];
  const closeDate = p['DealclosingDate'] || p['Deal Closing Date'] || p['Close Date'];
  const email = p['email'] || p['Email'] || p['Gmail'];

  return {
    'Project ID': blockId,
    'Deal_id': dealId,
    'Region Type': region,
    'Office': office,
    'Biz Poc': bizPoc,
    'Client': client,
    'Project Name': blockName,
    'Project Status': blockStage || dealStage,
    'deal_stage': dealStage,
    'Block_Stage': blockStage,
    'Bidding': inBidding,
    'Winning %': winningPct,
    'Value in Home Currency': homeAmount,
    'Home Currency': homeCurrency,
    'Amount in USD': amountUsd,
    'Profit %': profitPct,
    'Close Date': closeDate,
    'Gmail': email,
    'Region': region,
    'Territory': region
  };
}

function mapProjectionToBackend(p, blockId, blockName) {
  return {
    'Block_id': blockId,
    'Revenue_id': p['Revenue_id'] || p['Projection ID'] || generateRevenueId(),
    'BlockName': blockName,
    'Revenue_date': ensureTextDate(p['Revenue_date'] || p['Projection date']),
    'Amount_in_USD': p['Amount_in_USD'] || p['Amount in USD'] || p['Amount'] || p['Value'],
    'Amount_in_Inr': p['Amount_in_Inr'] || p['Amount in INR'] || ''
  };
}

function mapProjectionToFrontend(p) {
  return {
    'Projection ID': p['Revenue_id'],
    'Project ID': p['Block_id'],
    'Project Name': p['BlockName'],
    'Projection date': p['Revenue_date'],
    'Amount in USD': p['Amount_in_USD'],
    'Amount': p['Amount_in_USD'],
    'Value': p['Amount_in_USD']
  };
}

// --- DATA ACCESS ---

function getDashboardProjects(email, isAdmin, role) {
  try {
    const projects = getSheetData('Projects');
    const projections = getSheetData('Projections');
    
    if (!projects || projects.length === 0) return [];
    
    const historyInfo = getProjectionHistoryInfo();
    const projectionsMap = {};
    if (projections && projections.length > 0) {
      projections.forEach(p => {
        const pid = p['Block_id'];
        if (!projectionsMap[pid]) {
          projectionsMap[pid] = [];
        }
        const frontendProj = mapProjectionToFrontend(p);
        if (frontendProj['Projection date']) {
          frontendProj['Projection date'] = formatDateForDisplay(frontendProj['Projection date']);
        }
        
        const hInfo = historyInfo[frontendProj['Projection ID']];
        if (hInfo) {
          frontendProj['Action ID'] = hInfo['Action ID'];
          frontendProj['Action Date'] = formatDateForDisplay(hInfo['Action Date']);
          frontendProj['Previous Projection Date'] = formatDateForDisplay(hInfo['Previous Projection Date']);
          frontendProj['Previous Amount in USD'] = hInfo['Previous Amount in USD'];
          frontendProj['Change Type'] = hInfo['Change Type'];
          frontendProj['Is Approved'] = hInfo['Is Approved'];
        }
        
        projectionsMap[pid].push(frontendProj);
      });
    }

    // Add unapproved 'Delete' projections
    for (const revId in historyInfo) {
      const hInfo = historyInfo[revId];
      if (hInfo['Change Type'] === 'Delete' && !hInfo['Is Approved']) {
        const pid = hInfo['Block_id'];
        if (!projectionsMap[pid]) {
          projectionsMap[pid] = [];
        }
        projectionsMap[pid].push({
          'Projection ID': revId,
          'Project ID': pid,
          'Project Name': hInfo['BlockName'],
          'Projection date': formatDateForDisplay(hInfo['Previous Projection Date'] || hInfo['Revenue_date']),
          'Amount in USD': hInfo['Previous Amount in USD'] || hInfo['Amount_in_USD'],
          'Amount': hInfo['Previous Amount in USD'] || hInfo['Amount_in_USD'],
          'Value': hInfo['Previous Amount in USD'] || hInfo['Amount_in_USD'],
          'Action ID': hInfo['Action ID'],
          'Action Date': formatDateForDisplay(hInfo['Action Date']),
          'Previous Projection Date': formatDateForDisplay(hInfo['Previous Projection Date'] || hInfo['Revenue_date']),
          'Previous Amount in USD': hInfo['Previous Amount in USD'] || hInfo['Amount_in_USD'],
          'Change Type': 'Delete',
          'Is Approved': false
        });
      }
    }
    
    let result = projects;
    
    const userRoles = String(role || "")
      .split(",")
      .map(r => r.trim().toLowerCase())
      .filter(Boolean);
    const isBiz = userRoles.includes("biz");

    if (!isAdmin && !isBiz) {
      const normalizedEmail = email.toLowerCase().trim();
      result = projects.filter(p => {
        const rowEmail = (p['email'] || '').toString().toLowerCase().trim();
        return rowEmail === normalizedEmail;
      });
    }
    
    const serialized = result.map(p => {
      const frontendP = mapProjectToFrontend(p);
      if (frontendP['Close Date']) {
         frontendP['Close Date'] = formatDateForDisplay(frontendP['Close Date']);
      }
      frontendP.projections = projectionsMap[frontendP['Project ID']] || [];
      return frontendP;
    });
    
    return serialized;
  } catch (error) {
    Logger.log('ERROR in getDashboardProjects: ' + error.toString());
    return [];
  }
}

function getAllowedProjects(email, isAdmin) {
  const projects = getSheetData('Projects');
  let allowed = projects;
  if (!isAdmin) {
    const normalizedEmail = email.toLowerCase().trim();
    allowed = projects.filter(p => (p['email'] || '').toString().toLowerCase().trim() === normalizedEmail);
  }
  return allowed.map(p => ({
    'Project ID': p['Block_id'],
    'Project Name': p['Block_Name']
  }));
}

function getProjectById(projectId) {
  const projects = getSheetData('Projects');
  const project = projects.find(p => {
    const pId = p['Block_id'] || p['Block ID'] || p['Project ID'];
    return String(pId) === String(projectId);
  });
  
  if (!project) return null;
  
  const frontendP = mapProjectToFrontend(project);
  if (frontendP['Close Date']) {
    frontendP['Close Date'] = formatDateForDisplay(frontendP['Close Date']);
  }
  return frontendP;
}

function getProjectionsByProjectId(projectId) {
  const projections = getSheetData('Projections');
  const filtered = projections.filter(p => {
    const pId = p['Block_id'] || p['Block ID'] || p['Project ID'];
    return String(pId) === String(projectId);
  });
  
  const historyInfo = getProjectionHistoryInfo();
  
  const activeProjections = filtered.map(p => {
    const frontendP = mapProjectionToFrontend(p);
    if (frontendP['Projection date']) {
      frontendP['Projection date'] = formatDateForDisplay(frontendP['Projection date']);
    }
    
    const hInfo = historyInfo[frontendP['Projection ID']];
    if (hInfo) {
      frontendP['Action ID'] = hInfo['Action ID'];
      frontendP['Action Date'] = formatDateForDisplay(hInfo['Action Date']);
      frontendP['Previous Projection Date'] = formatDateForDisplay(hInfo['Previous Projection Date']);
      frontendP['Previous Amount in USD'] = hInfo['Previous Amount in USD'];
      frontendP['Change Type'] = hInfo['Change Type'];
      frontendP['Is Approved'] = hInfo['Is Approved'];
    }
    
    return frontendP;
  });

  // Find unapproved 'Delete' projections from historyInfo that belong to this projectId
  const unapprovedDeletes = [];
  for (const revId in historyInfo) {
    const hInfo = historyInfo[revId];
    if (hInfo['Change Type'] === 'Delete' && !hInfo['Is Approved']) {
      if (String(hInfo['Block_id']) === String(projectId)) {
        unapprovedDeletes.push({
          'Projection ID': revId,
          'Project ID': hInfo['Block_id'],
          'Project Name': hInfo['BlockName'],
          'Projection date': formatDateForDisplay(hInfo['Previous Projection Date'] || hInfo['Revenue_date']),
          'Amount in USD': hInfo['Previous Amount in USD'] || hInfo['Amount_in_USD'],
          'Amount': hInfo['Previous Amount in USD'] || hInfo['Amount_in_USD'],
          'Value': hInfo['Previous Amount in USD'] || hInfo['Amount_in_USD'],
          'Action ID': hInfo['Action ID'],
          'Action Date': formatDateForDisplay(hInfo['Action Date']),
          'Previous Projection Date': formatDateForDisplay(hInfo['Previous Projection Date'] || hInfo['Revenue_date']),
          'Previous Amount in USD': hInfo['Previous Amount in USD'] || hInfo['Amount_in_USD'],
          'Change Type': 'Delete',
          'Is Approved': false
        });
      }
    }
  }

  return [...activeProjections, ...unapprovedDeletes];
}


// --- WRITE OPERATIONS ---

function createProject(payload) {
  try {
    const project = payload.project;
    const projections = payload.projections || [];
    const userEmail = payload.userEmail || 'Unknown';
    
    if (!project['Project ID'] || project['Project ID'] === 'Auto-generated') {
      project['Project ID'] = getNextProjectId();
    }
    
    const backendProject = mapProjectToBackend(project);
    appendRow('Projects', backendProject);
    
    if (projections.length > 0) {
      projections.forEach(p => {
        const backendProj = mapProjectionToBackend(p, backendProject['Block_id'], backendProject['Block_Name']);
        if (!backendProj['Revenue_id']) backendProj['Revenue_id'] = generateRevenueId();
        appendRow('Projections', backendProj);
        logProjectionHistory(backendProj, 'Create', userEmail);
      });
    }
    return { success: true, projectId: backendProject['Block_id'] };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function updateProject(payload) {
  try {
    const project = payload.project;
    const projections = payload.projections || [];
    const deletedProjections = payload.deletedProjections || [];
    const userEmail = payload.userEmail || 'Unknown';
    
    const backendProject = mapProjectToBackend(project);
    
    // Remove email fields to preserve original Deal Owner from ETL
    delete backendProject['email'];
    delete backendProject['Email'];
    
    updateRow('Projects', 'Block_id', backendProject['Block_id'], backendProject);
    
    projections.forEach(p => {
      const backendProj = mapProjectionToBackend(p, backendProject['Block_id'], backendProject['Block_Name']);
      upsertProjection(backendProj, userEmail);
    });
    
    deletedProjections.forEach(p => {
      const revId = p['Projection ID'] || p['Revenue_id'];
      if (revId) {
        deleteProjectionByRevenueId(revId);
      }
    });
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function upsertProjection(projection, userEmail) {
  const sheet = getSheet('Projections');
  let data = sheet.getDataRange().getValues();
  let headers = data[0];
  
  // Ensure headers exist
  const requiredHeaders = ['Block_id', 'Revenue_id', 'BlockName', 'Revenue_date', 'Amount_in_USD', 'Amount_in_Inr'];
  let headersChanged = false;
  requiredHeaders.forEach(h => {
    if (headers.indexOf(h) === -1) {
      headers.push(h);
      headersChanged = true;
    }
  });
  
  if (headersChanged) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    data = sheet.getDataRange().getValues();
  }

  const revIdIdx = headers.indexOf('Revenue_id');
  let foundRow = -1;
  
  if (!projection['Revenue_id']) {
    projection['Revenue_id'] = generateRevenueId();
  }
  
  if (projection['Revenue_id']) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][revIdIdx]) === String(projection['Revenue_id'])) {
        foundRow = i + 1;
        break;
      }
    }
  }
  
  if (foundRow > 0) {
    const dateIdx = headers.indexOf('Revenue_date');
    const amountIdx = headers.indexOf('Amount_in_USD');
    
    // Fetch values from data and payload
    let oldDate = data[foundRow-1][dateIdx];
    let newDate = projection['Revenue_date'];
    const oldAmount = data[foundRow-1][amountIdx];
    const newAmount = projection['Amount_in_USD'];
    
    // Robust Date parsing for comparison
    const cleanOldDate = String(oldDate).replace(/^['`]/, '').trim();
    const cleanNewDate = String(newDate).replace(/^['`]/, '').trim();
    
    let oldDateParsed = new Date(cleanOldDate);
    let newDateParsed = new Date(cleanNewDate);

    let isDateChanged = true;
    if (!isNaN(oldDateParsed.getTime()) && !isNaN(newDateParsed.getTime())) {
        if (oldDateParsed.getFullYear() === newDateParsed.getFullYear() &&
            oldDateParsed.getMonth() === newDateParsed.getMonth() &&
            oldDateParsed.getDate() === newDateParsed.getDate()) {
            isDateChanged = false;
        }
    } else if (cleanOldDate === cleanNewDate) {
        isDateChanged = false;
    }

    // Robust Amount comparison
    const numOld = parseFloat(String(oldAmount).replace(/[^0-9.-]+/g, '')) || 0;
    const numNew = parseFloat(String(newAmount).replace(/[^0-9.-]+/g, '')) || 0;
    const isAmountChanged = Math.abs(numOld - numNew) > 0.001;
    
    // Check if it's a real change
    const isRealChange = isDateChanged || isAmountChanged;

    if (isRealChange) {
        let type = '';
        if (isDateChanged && isAmountChanged) type = 'Amount Changed and Date Changed';
        else if (isDateChanged) type = 'Date Changed';
        else if (isAmountChanged) type = 'Amount Changed';
        
        logProjectionHistory(projection, type, userEmail);
    }

    // Update existing
    const rowData = headers.map(h => {
      const val = projection[String(h).trim()];
      return val === undefined ? '' : val;
    });
    sheet.getRange(foundRow, 1, 1, headers.length).setValues([rowData]);
  } else {
    // Insert new
    appendRow('Projections', projection);
    logProjectionHistory(projection, 'Create', userEmail);
  }
}

function deleteProjectionByRevenueId(revenueId) {
  const sheet = getSheet('Projections');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const revIdIdx = headers.indexOf('Revenue_id');
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][revIdIdx]) === String(revenueId)) {
      sheet.deleteRow(i + 1);
      break; 
    }
  }
}

function logProjectionHistory(projection, type, userEmail) {
  const sheet = getSheet('ProjectionHistory');
  const headers = ['Action_id', 'Action_timestamp', 'Block_id', 'Revenue_id', 'BlockName', 'Revenue_date', 'Amount_in_USD', 'Type', 'email', 'Approved'];
  const existingHeaders = getHeaders(sheet);
  
  // Ensure the 'Approved' header exists if it was added later
  if (existingHeaders.length > 0 && existingHeaders.indexOf('Approved') === -1) {
    existingHeaders.push('Approved');
    sheet.getRange(1, 1, 1, existingHeaders.length).setValues([existingHeaders]);
  } else if (existingHeaders.length === 0) {
    sheet.appendRow(headers);
  }
  
  const row = [
    generateActionId(),
    new Date(), 
    projection['Block_id'],
    projection['Revenue_id'],
    projection['BlockName'],
    projection['Revenue_date'],
    projection['Amount_in_USD'],
    type,
    userEmail,
    false // Defaults to Unapproved when logged
  ];
  sheet.appendRow(row);
}

function approveProjectionUpdate(actionId) {
  try {
    if (!actionId) {
      return { success: false, error: 'Missing Action ID' };
    }

    const sheet = getSheet('ProjectionHistory');
    const data = sheet.getDataRange().getValues();
    if (!data || data.length === 0) {
      return { success: false, error: 'ProjectionHistory is empty' };
    }

    const headers = data[0].map(h => String(h).trim());
    const actionIdIdx = headers.findIndex(h => h === 'Action_id' || h === 'Action ID' || h.toLowerCase() === 'action_id');
    let approvedIdx = headers.findIndex(h => h === 'Approved' || h === 'Is Approved' || h.toLowerCase() === 'approved');

    if (actionIdIdx === -1) {
      return { success: false, error: 'Action_id column not found in ProjectionHistory' };
    }

    if (approvedIdx === -1) {
      approvedIdx = headers.length;
      sheet.getRange(1, approvedIdx + 1).setValue('Approved');
    }
    
    for (let i = 1; i < data.length; i++) {
      const rowActionId = String(data[i][actionIdIdx] ?? '').replace(/^['`]/, '').trim();
      const targetActionId = String(actionId).replace(/^['`]/, '').trim();
      if (rowActionId === targetActionId) {
        sheet.getRange(i + 1, approvedIdx + 1).setValue(true);
        return { success: true };
      }
    }
    return { success: false, error: 'Action ID not found' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function getProjectionHistoryInfo() {
  const historyData = getSheetData('ProjectionHistory');
  const historyMap = {};
  
  // Sort history by timestamp ascending so we know chronological order
  historyData.sort((a, b) => new Date(a['Action_timestamp']) - new Date(b['Action_timestamp']));
  
  historyData.forEach(row => {
    const revId = row['Revenue_id'];
    if (!historyMap[revId]) {
      historyMap[revId] = [];
    }
    historyMap[revId].push(row);
  });
  
  const result = {};
  for (const revId in historyMap) {
    const records = historyMap[revId];
    if (records.length > 0) {
      const latest = records[records.length - 1]; // Current state 
      const previous = records.length > 1 ? records[records.length - 2] : null; // State before latest change, if any
      
      // Ensure we only mark it if the latest action is an actual update/delete, not just a duplicate create
      if (latest['Type'] !== 'Create') {
        const isApproved = String(latest['Approved']).toLowerCase() === 'true';
        result[revId] = {
          'Action ID': latest['Action_id'],
          'Action Date': latest['Action_timestamp'],
          'Previous Projection Date': previous ? previous['Revenue_date'] : latest['Revenue_date'],
          'Previous Amount in USD': previous ? previous['Amount_in_USD'] : latest['Amount_in_USD'],
          'Change Type': latest['Type'],
          'Is Approved': isApproved,
          'Block_id': latest['Block_id'],
          'Revenue_date': latest['Revenue_date'],
          'Amount_in_USD': latest['Amount_in_USD'],
          'BlockName': latest['BlockName']
        };
      }
    }
  }
  return result;
}

// --- UTILS ---

function getNextProjectId() {
  const projects = getSheetData('Projects');
  if (projects.length === 0) return 1;
  const ids = projects.map(p => {
    const id = p['Block_id'];
    const num = Number(id);
    return isNaN(num) ? 0 : num;
  });
  return Math.max(...ids) + 1;
}

function generateRevenueId() {
  const timestamp = Date.now(); 
  const random = Math.floor(1000 + Math.random() * 9000); 
  return `R${timestamp}${random}`;
}

function generateActionId() {
  const random = Math.floor(100000000 + Math.random() * 900000000); 
  return `A${random}`;
}

function ensureTextDate(val) {
  if (!val) return '';
  
  // If it's already a Date object, format it using SHEET timezone
  if (val instanceof Date) {
     const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
     return "'" + Utilities.formatDate(val, tz, 'M/d/yyyy');
  }
  
  // CRITICAL FIX: Strip any incoming prepended string quote before parsing
  const str = String(val).replace(/^['`]/, '').trim();
  if (!str) return '';

  // 1. Check for ISO yyyy-mm-dd (Frontend Input)
  // MANUAL FORMATTING to avoid Timezone shifts
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
     const year = parseInt(isoMatch[1], 10);
     const month = parseInt(isoMatch[2], 10); // 1-12
     const day = parseInt(isoMatch[3], 10);   // 1-31
     // Return M/d/yyyy directly
     return "'" + `${month}/${day}/${year}`;
  }

  // 2. Check for M/d/yyyy (Backend Format - using Slashes)
  if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
          const m = parseInt(parts[0], 10);
          const d = parseInt(parts[1], 10);
          const y = parseInt(parts[2], 10);
          return "'" + `${m}/${d}/${y}`;
      }
  }

  // 3. Check for dd-mm-yyyy (Legacy/Frontend Display - using Dashes)
  if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length === 3) {
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const y = parseInt(parts[2], 10);
          // Return M/d/yyyy format for backend storage
          return "'" + `${m}/${d}/${y}`;
      }
  }

  // Fallback
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
     const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
     return "'" + Utilities.formatDate(d, tz, 'M/d/yyyy');
  }
  
  return "'" + val;
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function getSheetData(name) {
  try {
    const sheet = getSheet(name);
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    if (data.length < 2) return [];
    
    const headers = data[0];
    return data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[String(h).trim()] = row[i];
      });
      return obj;
    });
  } catch (error) {
    Logger.log('ERROR in getSheetData: ' + error);
    return [];
  }
}

function appendRow(name, obj) {
  const sheet = getSheet(name);
  const headers = getHeaders(sheet);
  
  if (headers.length === 0) {
    const keys = Object.keys(obj);
    sheet.appendRow(keys);
  }
  
  const currentHeaders = getHeaders(sheet);
  const row = currentHeaders.map(h => {
    const key = String(h).trim();
    return obj[key] !== undefined ? obj[key] : '';
  });
  sheet.appendRow(row);
}

function updateRow(name, keyField, keyValue, obj) {
  const sheet = getSheet(name);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const keyIdx = headers.indexOf(keyField);
  
  if (keyIdx === -1) throw new Error(`Key field ${keyField} not found in sheet ${name}`);
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIdx]) === String(keyValue)) {
      const row = headers.map(h => {
        const trimmedH = String(h).trim();
        return obj[trimmedH] !== undefined ? obj[trimmedH] : data[i][headers.indexOf(h)];
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return;
    }
  }
}

function getHeaders(sheet) {
  if (sheet.getLastRow() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

// --- Maintenance Script ---
function retroactivelySyncFinanceBillableDates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const billSheet = ss.getSheetByName('Billable');
  const finSheet = ss.getSheetByName('Finance');
  
  if (!billSheet || !finSheet) {
    Logger.log("Missing Billable or Finance sheet");
    return;
  }
  
  const billData = billSheet.getDataRange().getValues();
  const billHeaders = billData[0];
  const bIdIdx = billHeaders.indexOf('Billable_id');
  const bDateIdx = billHeaders.indexOf('Billable_date');
  
  const finData = finSheet.getDataRange().getValues();
  const finHeaders = finData[0];
  const fIdIdx = finHeaders.indexOf('Billable_id');
  const fDateIdx = finHeaders.indexOf('Billable_date');
  
  if (bIdIdx === -1 || bDateIdx === -1 || fIdIdx === -1 || fDateIdx === -1) {
    Logger.log("Missing required columns");
    return;
  }
  
  // Build lookup map of Billable_id -> Billable_date
  const dateMap = {};
  for (let i = 1; i < billData.length; i++) {
    const id = String(billData[i][bIdIdx]).trim();
    if (id) {
      dateMap[id] = billData[i][bDateIdx];
    }
  }
  
  // Update Finance sheet
  let updateCount = 0;
  for (let i = 1; i < finData.length; i++) {
    const rawIds = String(finData[i][fIdIdx]).trim();
    if (!rawIds) continue;
    
    // Use the first ID if it's merged
    const firstId = rawIds.split(',')[0].trim();
    if (dateMap[firstId] !== undefined) {
      const currentDate = finData[i][fDateIdx];
      const correctDate = dateMap[firstId];
      
      // Normalize dates for comparison to avoid false positives
      const normCurrentStr = String(currentDate).replace(/^['`]/, '').trim();
      const normCorrectStr = String(correctDate).replace(/^['`]/, '').trim();
      
      const normCurrent = (currentDate instanceof Date) ? currentDate.getTime() : normCurrentStr;
      const normCorrect = (correctDate instanceof Date) ? correctDate.getTime() : normCorrectStr;
      
      const needsTextFormatting = (currentDate instanceof Date) && String(correctDate).trim() !== '';

      if (normCurrent !== normCorrect || needsTextFormatting) {
        // Use ensureTextDate to prepend the apostrophe (') so Google Sheets treats it strictly as a string
        finSheet.getRange(i + 1, fDateIdx + 1).setValue(ensureTextDate(correctDate));
        updateCount++;
      }
    }
  }
  
  Logger.log(`Successfully synchronized ${updateCount} rows in the Finance sheet.`);
}

function updateAllOutstandingAmounts() {
  const financeSheet = getSheet('Finance');
  const financeData = financeSheet.getDataRange().getValues();
  if (financeData.length < 2) return;
  const financeHeaders = financeData[0];
  
  const receiptSheet = getSheet('Receipts');
  const receiptData = receiptSheet.getDataRange().getValues();
  const receiptHeaders = receiptData[0];
  
  const getIdx = (headers, names) => {
    for (let name of names) {
      const idx = headers.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };
  
  const fIdx = {
    invoiceNum: getIdx(financeHeaders, ['Invoice_Number']),
    financeId: getIdx(financeHeaders, ['Finance_id']),
    taxType: getIdx(financeHeaders, ['Tax_type', 'Zone']),
    billedInr: getIdx(financeHeaders, ['Billed_Amount_in_Inr']),
    exchangeDiff: getIdx(financeHeaders, ['Exchange_Diff']),
    bankCharges: getIdx(financeHeaders, ['Bank_Charges']),
    exchangeRate: getIdx(financeHeaders, ['Exchange_Rate']),
    totalGstInr: getIdx(financeHeaders, ['Total Amount + GST (INR)']),
    gstReceived: getIdx(financeHeaders, ['GST_Received']),
    tds: getIdx(financeHeaders, ['TDS']),
    outstanding: getIdx(financeHeaders, ['Outstanding_amount', 'Outstanding amount']),
    paymentStatus: getIdx(financeHeaders, ['Payment_status', 'Payment status']),
    paymentStatusOverride: getIdx(financeHeaders, ['Payment_Status_Override'])
  };
  
  const rIdx = {
    invoiceNum: getIdx(receiptHeaders, ['Invoice_Number']),
    financeId: getIdx(receiptHeaders, ['Finance_id', 'Finance id']),
    receiptAmount: getIdx(receiptHeaders, ['Receipt_Amount_in_INR', 'Receipt Amount (INR)', 'Receipt_Amount']) // Look for INR specifically first
  };
  
  if (fIdx.outstanding === -1) return;
  
  const receiptsByFinanceId = {};
  const receiptsByInvoiceNum = {};
  
  if (receiptData.length > 1 && rIdx.receiptAmount !== -1) {
    for (let i = 1; i < receiptData.length; i++) {
      const amount = parseFloat(String(receiptData[i][rIdx.receiptAmount]).replace(/[^0-9.-]+/g, "")) || 0;
      
      let hasFinId = false;
      if (rIdx.financeId !== -1) {
        const finId = String(receiptData[i][rIdx.financeId]).trim();
        if (finId) {
          receiptsByFinanceId[finId] = (receiptsByFinanceId[finId] || 0) + amount;
          hasFinId = true;
        }
      }
      
      // Only pool into invoice-level receipts if it doesn't have a specific Finance_id
      if (!hasFinId && rIdx.invoiceNum !== -1) {
        const invNum = String(receiptData[i][rIdx.invoiceNum]).trim();
        if (invNum) {
          receiptsByInvoiceNum[invNum] = (receiptsByInvoiceNum[invNum] || 0) + amount;
        }
      }
    }
  }

  // Pre-calculate total gross billed per invoice for proportional receipt distribution
  const invoiceGrossTotals = {};
  for (let i = 1; i < financeData.length; i++) {
    const row = financeData[i];
    const invNum = String(row[fIdx.invoiceNum]).trim();
    if (!invNum) continue;
    
    const taxType = String(row[fIdx.taxType]).toLowerCase();
    const billedInr = parseFloat(String(row[fIdx.billedInr]).replace(/[^0-9.-]+/g, "")) || 0;
    const totalGstInr = parseFloat(String(row[fIdx.totalGstInr]).replace(/[^0-9.-]+/g, "")) || 0;
    const gross = taxType === 'india' ? totalGstInr : billedInr;
    
    invoiceGrossTotals[invNum] = (invoiceGrossTotals[invNum] || 0) + gross;
  }
  
  for (let i = 1; i < financeData.length; i++) {
    const row = financeData[i];
    const invNum = String(row[fIdx.invoiceNum]).trim();
    const finId = String(row[fIdx.financeId]).trim();
    if (!invNum && !finId) continue;
    
    const taxType = String(row[fIdx.taxType]).toLowerCase();
    const billedInr = parseFloat(String(row[fIdx.billedInr]).replace(/[^0-9.-]+/g, "")) || 0;
    const exchangeDiff = parseFloat(String(row[fIdx.exchangeDiff]).replace(/[^\d.-]/g, '')) || 0;
    const bankCharges = parseFloat(String(row[fIdx.bankCharges]).replace(/[^0-9.-]+/g, "")) || 0;
    const exchangeRate = parseFloat(String(row[fIdx.exchangeRate]).replace(/[^0-9.-]+/g, "")) || 1;
    const totalGstInr = parseFloat(String(row[fIdx.totalGstInr]).replace(/[^0-9.-]+/g, "")) || 0;
    
    const rowGross = taxType === 'india' ? totalGstInr : billedInr;
    
    // Prioritize exact Finance_id match. 
    // If not found, take the pooled invoice receipts and multiply by this row's proportion.
    let totalReceiptsInr = 0;
    if (finId && receiptsByFinanceId[finId] !== undefined) {
      totalReceiptsInr = receiptsByFinanceId[finId];
    } else if (invNum && receiptsByInvoiceNum[invNum]) {
      const invTotalGross = invoiceGrossTotals[invNum] || 1; // prevent div by zero
      const ratio = rowGross / invTotalGross;
      totalReceiptsInr = receiptsByInvoiceNum[invNum] * ratio;
    }
    
    const gstReceived = parseFloat(String(row[fIdx.gstReceived]).replace(/[^0-9.-]+/g, "")) || 0;
    const tds = parseFloat(String(row[fIdx.tds]).replace(/[^0-9.-]+/g, "")) || 0;
    
    const baseInr = totalGstInr > 0 ? totalGstInr : billedInr;
    let outstandingInr = baseInr - gstReceived - totalReceiptsInr - tds - exchangeDiff - bankCharges;
    
    financeSheet.getRange(i + 1, fIdx.outstanding + 1).setValue(outstandingInr);
    
    if (fIdx.paymentStatus !== -1) {
      const override = fIdx.paymentStatusOverride !== -1 ? String(row[fIdx.paymentStatusOverride] || '').trim() : '';
      let paymentStatus = 'Partially Paid';
      
      if (override && override.toLowerCase() !== 'false') {
        paymentStatus = String(row[fIdx.paymentStatus] || '').trim() || 'Partially Paid';
      } else {
        if (billedInr === 0) paymentStatus = 'Not Paid';
        else if (totalReceiptsInr === 0) paymentStatus = 'Not Paid';
        else if (outstandingInr <= 100) paymentStatus = 'Paid';
        else paymentStatus = 'Partially Paid';
      }
      
      financeSheet.getRange(i + 1, fIdx.paymentStatus + 1).setValue(paymentStatus);
    }
  }
}

function syncAwardedProjectsToProduction() {
  try {
    const projects = getSheetData('Projects');
    const production = getSheetData('Production');
    
    const prodBlockIds = new Set(production.map(p => String(p['Block_id']).trim()));
    
    const awardedProjects = projects.filter(p => {
      const stage = String(p['deal_stage'] || p['Project Status'] || '').toLowerCase();
      return stage.includes('award');
    });
    
    let addedCount = 0;
    awardedProjects.forEach(p => {
      const blockId = String(p['Block_id'] || p['Block ID'] || p['Project ID']).trim();
      if (blockId && !prodBlockIds.has(blockId)) {
        // Prepare new row for Production
        // Columns needed: [Deal_id, Block_id, DealName, Block_Name, Type, Status, Approved_to_Finance, Approved by]
        // Plus other details fetched from Projects tab
        const newProdRow = {
          'Deal_id': p['Deal_id'] || p['Deal ID'] || '',
          'Block_id': blockId,
          'Region': p['Region'] || p['Region Type'] || '',
          'Contracting_Office': p['Contracting_Office'] || p['Contracting Office'] || p['Office'] || '',
          'BizPoC': p['BizPoC'] || p['Biz Poc'] || '',
          'Client': p['Client'] || '',
          'DealName': p['DealName'] || p['Deal Name'] || p['Project Name'] || '',
          'Block_Name': p['Block_Name'] || p['Block Name'] || p['Project Name'] || '',
          'deal_stage': p['deal_stage'] || p['Deal Stage'] || p['Project Status'] || '',
          'Block_Stage': p['Block_Stage'] || p['Block Stage'] || p['Project Status'] || '',
          'In_Bidding': p['In_Bidding'] || p['In Bidding'] || p['Bidding'] || '',
          'Home_Amount': p['Home_Amount'] || p['Home Amount'] || p['Value in Home Currency'] || '',
          'Home_Currency': p['Home_Currency'] || p['Currency'] || p['Home Currency'] || '',
          'Amount_in_USD': p['Amount_in_USD'] || p['Amount in USD'] || '',
          'Profit_Percentage': p['Profit_Percentage'] || p['Profit Percentage'] || p['Profit %'] || '',
          'DealclosingDate': p['DealclosingDate'] || p['Deal Closing Date'] || p['Close Date'] || '',
          'email': p['email'] || p['Gmail'] || p['Email'] || '',
          'created_ts': p['created_ts'] || p['Created'] || '',
          'Deal_Age_Days': p['Deal_Age_Days'] || p['Age'] || '',
          'Show_Code': p['Show_Code'] || '',
          'Client_Code': p['Client_Code'] || '',
          'Work_Order': p['Work_Order'] || '',
          'Finance_Contact': p['Finance_Contact'] || ''
        };
        appendRow('Production', newProdRow);
        prodBlockIds.add(blockId); // Prevent duplicates in same run
        addedCount++;
      }
    });
    if (addedCount > 0) {
      Logger.log(`Synced ${addedCount} awarded projects to Production.`);
    }
  } catch (error) {
    Logger.log('ERROR in syncAwardedProjectsToProduction: ' + error.toString());
  }
}

function getBillableHistoryInfo() {
  const historyData = getSheetData('Billable History');
  const historyMap = {};
  
  if (!historyData || historyData.length === 0) return {};
  
  // Sort history by timestamp ascending so we know chronological order
  historyData.sort((a, b) => new Date(a['Action_timestamp']) - new Date(b['Action_timestamp']));
  
  historyData.forEach(row => {
    const bId = row['Billable_id'];
    if (!historyMap[bId]) {
      historyMap[bId] = [];
    }
    historyMap[bId].push(row);
  });
  
  const result = {};
  for (const bId in historyMap) {
    const records = historyMap[bId];
    if (records.length > 0) {
      const latest = records[records.length - 1]; // Current state 
      const previous = records.length > 1 ? records[records.length - 2] : null; // State before latest change, if any
      
      const isApproved = String(latest['Approved']).trim().toUpperCase() === 'TRUE';
      result[bId] = {
        'Action ID': latest['Action_id'],
        'Action Date': latest['Action_timestamp'],
        'Previous Billable Date': previous ? previous['Billable_date'] : latest['Billable_date'],
        'Previous Amount in Home Currency': previous ? previous['Billable_Amount_in_Home_Currency'] : latest['Billable_Amount_in_Home_Currency'],
        'Previous Amount in USD': previous ? previous['Amount_in_USD'] : latest['Amount_in_USD'],
        'Change Type': latest['Type'],
        'Is Approved': isApproved,
        'Block_id': latest['Block_id'],
        'Billable_date': latest['Billable_date'],
        'Amount_in_USD': latest['Amount_in_USD'],
        'BlockName': latest['BlockName']
      };
    }
  }
  return result;
}

// --- PRODUCTION HUB APIs ---

function getProductionProjects(email, isAdmin, role) {
  try {
    const projects = getSheetData('Production');
    const billables = getSheetData('Billable');
    const bins = getSheetData('Bin');
    const finances = getSheetData('Finance');

    if (!projects || projects.length === 0) return [{
      'Deal_id': 'EMPTY',
      'Block_id': 'EMPTY',
      'Show_Code': 'EMPTY',
      'DealName': 'EMPTY',
      'Block_Name': 'No projects found in sheet'
    }];

    // Build finance payment status map
    const financeMap = {};
    if (finances && finances.length > 0) {
      finances.forEach(f => {
        const bId = String(f['Billable_id'] || '').trim();
        if (bId) {
            if (!financeMap[bId]) financeMap[bId] = [];
            financeMap[bId].push(f);
        }
      });
    }

    const aggregatedPaymentStatus = {};
    for (const bId in financeMap) {
        const relatedInvoices = financeMap[bId].filter(f => f['Invoice_Number']);
        if (relatedInvoices.length === 0) {
            aggregatedPaymentStatus[bId] = 'Not Paid';
        } else {
            const statuses = relatedInvoices.map(inv => {
                if (inv['Payment_Status_Override']) return inv['Payment_status'];
                if (inv['Payment_status']) return inv['Payment_status'];
                // Fallback calculate if missing
                const billedHome = parseFloat(String(inv['Billable_Amount_in_Home_Currency']).replace(/[^0-9.-]+/g, "")) || 0;
                
                let recTotalHome = 0;
                if (inv['Receipts']) {
                    inv['Receipts'].forEach(r => {
                        recTotalHome += parseFloat(String(r['Receipt_Home Amount'] || r['Receipt_Home_Amount']).replace(/[^0-9.-]+/g, "")) || 0;
                    });
                }
                
                if (billedHome === 0) return 'Not Paid';
                if (recTotalHome >= (billedHome - 0.05)) return 'Paid';
                if (recTotalHome > 0) return 'Partially Paid';
                return 'Not Paid';
            });
            if (statuses.every(s => s === 'Paid')) aggregatedPaymentStatus[bId] = 'Paid';
            else if (statuses.every(s => s === 'Not Paid')) aggregatedPaymentStatus[bId] = 'Not Paid';
            else aggregatedPaymentStatus[bId] = 'Partially Paid';
        }
    }
    
    const binsMap = {};
    const projectBinsMap = {};
    if (bins && bins.length > 0) {
      bins.forEach(bin => {
         const pid = String(bin['Block_id']).trim();
         const binNum = String(bin['Bin_number']).trim();
         if (!binsMap[pid]) binsMap[pid] = {};
         binsMap[pid][binNum] = bin;
         
         if (!projectBinsMap[pid]) projectBinsMap[pid] = [];
         projectBinsMap[pid].push(bin);
      });
    }

    const billableHistoryRaw = getSheetData('Billable History');
    const billableHistoryByBlock = {};
    if (billableHistoryRaw && billableHistoryRaw.length > 0) {
        billableHistoryRaw.forEach(bh => {
            const pid = String(bh['Block_id'] || bh['Block ID'] || bh['Block_ID'] || bh['Block id'] || '').trim();
            // Since we need to match by block ID if billable doesn't explicitly tie easily, but wait, Billable History should have Billable_id or at least BlockName.
            // Let's check keys available in BH. Assuming Billable_id or BlockName is there.
            const billableId = String(bh['Billable_id'] || bh['Billable ID'] || bh['Billable id'] || '').trim();
            
            // Wait, we need to map to project by Block_id to pass down.
            // We can actually just pass the raw billable history rows that match the block id.
            // But let's look at the BH sheet headers provided: Billable_id, Bin_number, BlockName, Billable_date, Billable_Amount_in_Home_Currency, Home_Currency, Amount_in_Inr, Amount_in_USD, Type, email, Approved
            
            // It seems there's no Block_id in Billable History, just BlockName and Billable_id. We need to tie it to the project. 
            // We can derive Block_id from the Billables sheet or just pass the whole list if we can't reliably filter, but filtering is better.
            
            // If Billable_id is present, we can look it up in the billables list to find the block ID.
        });
    }

    // Let's build a map from Billable_id to Block_id using the 'Billable' sheet data.
    const billableIdToBlockId = {};
    if (billables && billables.length > 0) {
        billables.forEach(b => {
            const bId = String(b['Billable_id']).trim();
            const pid = String(b['Block_id']).trim();
            if (bId && pid) billableIdToBlockId[bId] = pid;
        });
    }

    const projectBillableHistory = {};
    if (billableHistoryRaw && billableHistoryRaw.length > 0) {
        billableHistoryRaw.forEach(bh => {
            const bId = String(bh['Billable_id']).trim();
            let pid = String(bh['Block_id'] || '').trim();
            if (!pid && bId) pid = billableIdToBlockId[bId];
            
            if (pid) {
                if (!projectBillableHistory[pid]) projectBillableHistory[pid] = [];
                projectBillableHistory[pid].push({
                    'Billable_id': bId,
                    'Bin_number': bh['Bin_number'],
                    'Billable_date': formatDateForDisplay(bh['Billable_date']),
                    'Billable_Amount_in_Home_Currency': bh['Billable_Amount_in_Home_Currency'],
                    'Home_Currency': bh['Home_Currency'],
                    'Amount_in_USD': bh['Amount_in_USD'],
                    'Type': bh['Type'] || bh['type'] || ''
                });
            }
        });
    }

    const billableHistoryInfo = getBillableHistoryInfo();

    const billablesMap = {};
    if (billables && billables.length > 0) {
      billables.forEach(b => {
        const pid = String(b['Block_id']).trim();
        const binNum = String(b['Bin_number']).trim();
        const frontendB = { ...b };
        if (frontendB['Billable_date']) {
          frontendB['Billable_date'] = formatDateForDisplay(frontendB['Billable_date']);
        }
        if (frontendB['Approved by']) {
          frontendB['Approved by'] = String(frontendB['Approved by']).replace(/[\[\]]/g, '');
        }
        
        frontendB['Payment_status'] = aggregatedPaymentStatus[String(frontendB['Billable_id']).trim()] || 'Not Paid';
        
        const hInfo = billableHistoryInfo[frontendB['Billable_id']];
        if (hInfo) {
          frontendB['Action ID'] = hInfo['Action ID'];
          frontendB['Action Date'] = formatDateForDisplay(hInfo['Action Date']);
          frontendB['Previous Billable Date'] = formatDateForDisplay(hInfo['Previous Billable Date']);
          frontendB['Previous Amount in Home Currency'] = hInfo['Previous Amount in Home Currency'];
          frontendB['Previous Amount in USD'] = hInfo['Previous Amount in USD'];
          frontendB['Change Type'] = hInfo['Change Type'];
          frontendB['Is Approved'] = hInfo['Is Approved'];
        }
        
        // Include Hold_Billing
        frontendB['Hold_Billing'] = String(b['Hold_Billing']).toLowerCase() === 'true';
        
        // Include Type from Billable History / Bin
        frontendB['Type'] = b['Type'] || (binsMap[pid] && binsMap[pid][binNum] ? binsMap[pid][binNum]['Type'] : '');
        
        if (!billablesMap[pid]) {
          billablesMap[pid] = [];
        }
        billablesMap[pid].push(frontendB);
      });
    }

    const serialized = projects.map(p => {
      const frontendP = { ...p };
      
      frontendP['Client'] = p['Client'] || p['Client_Name'] || p['client_name'] || '';
      frontendP['DealclosingDate'] = p['Close_Date'] || p['DealclosingDate'] || p['Close Date'] || ''; 
      frontendP['Home_Currency'] = p['Home_Currency'] || p['Currency'] || p['Home Currency'] || '';
      frontendP['Home_Amount'] = p['Home_Amount'] || p['Home Amount'] || p['Value in Home Currency'] || '';
      frontendP['BizPoC'] = p['BizPoC'] || p['Biz Poc'] || '';
      frontendP['Show_Code'] = p['Show_Code'] || '';
      frontendP['Client_Code'] = p['Client_Code'] || '';
      frontendP['Work_Order'] = p['Work_Order'] || '';
      frontendP['DealName'] = p['DealName'] || p['Block_Name'] || '';
      frontendP['Block_Name'] = p['Block_Name'] || p['DealName'] || '';

      const isProdAdmin = String(role || '').toLowerCase().includes('prod admin');

      // Mask details for production users if the global flag is false
      if (!isAdmin && role !== 'finance' && !String(role || '').toLowerCase().includes('executive') && !isProdAdmin && !REVEAL_CLIENT_INFO_TO_PRODUCTION) {
        if (frontendP['Show_Code']) {
          frontendP['Block_Name'] = frontendP['Show_Code'];
          frontendP['DealName'] = frontendP['Show_Code'];
        } else {
          // If Show Code is blank and they shouldn't see info, generic fallback
          frontendP['Block_Name'] = 'Hidden Project';
          frontendP['DealName'] = 'Hidden Project';
        }
        
        if (frontendP['Client_Code']) {
          frontendP['Client'] = frontendP['Client_Code'];
        } else {
          frontendP['Client'] = 'Hidden Client';
        }
        frontendP['revealInfo'] = false;
      } else {
        frontendP['revealInfo'] = true;
      }
      
      if (frontendP['DealclosingDate']) {
         frontendP['DealclosingDate'] = formatDateForDisplay(frontendP['DealclosingDate']);
      }
      
      frontendP.billables = billablesMap[String(frontendP['Block_id']).trim()] || [];
      frontendP.billableHistory = projectBillableHistory[String(frontendP['Block_id']).trim()] || [];
      // Map bins without circular references or Date objects
      const rawBins = projectBinsMap[String(frontendP['Block_id']).trim()] || [];
      frontendP.bins = rawBins.map(b => {
          return {
              ...b,
              // Convert any date objects inside bin to strings to prevent GAS serialization crash
              'Timestamp': b['Timestamp'] instanceof Date ? b['Timestamp'].toISOString() : String(b['Timestamp'] || '')
          };
      });
      
      // Calculate aggregate project status based on bins for main table display
      if (frontendP.bins.length > 0) {
        frontendP['Type'] = frontendP.bins.map(b => String(b['Type'] || '')).filter(Boolean).join(', ') || '';
        const statuses = frontendP.bins.map(b => String(b['Status'] || '')).filter(Boolean);
        if (statuses.includes('Partially Billed')) frontendP['Status'] = 'Partially Billed';
        else if (statuses.length > 0 && statuses.every(s => s === 'Billed')) frontendP['Status'] = 'Billed';
        else if (statuses.includes('Billable')) frontendP['Status'] = 'Billable';
        else frontendP['Status'] = statuses[0] || '';
      }

      // Convert ALL Date objects in frontendP to strings because GAS google.script.run silently fails on Dates
      Object.keys(frontendP).forEach(key => {
          if (frontendP[key] instanceof Date) {
              frontendP[key] = formatDateForDisplay(frontendP[key]);
          }
      });

      return frontendP;
    });
    
    return serialized;
  } catch (error) {
    Logger.log('ERROR in getProductionProjects: ' + error.toString());
    return [{
      'Deal_id': 'ERROR',
      'Block_id': 'ERROR',
      'Show_Code': 'ERR',
      'DealName': 'ERROR',
      'Block_Name': error.toString()
    }];
  }
}

function generateBillableId() {
  const timestamp = Date.now().toString(); // ~13 digits
  const randomStr = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digits
  return 'P' + timestamp + randomStr;
}

function saveBillableDetails(payload) {
  try {
    const blockId = payload.blockId;
    const blockName = payload.blockName;
    const billables = payload.billables || [];
    const deletedBillables = payload.deletedBillables || [];
    const deletedBins = payload.deletedBins || [];
    const bins = payload.bins || [];
    const userName = payload.userName || 'Unknown';
    
    if (deletedBillables.length > 0) {
      const sheet = getSheet('Billable');
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const billableIdIdx = headers.indexOf('Billable_id');
      
      // Delete from bottom to top to avoid index shifting issues
      for (let i = data.length - 1; i >= 1; i--) {
        if (deletedBillables.includes(String(data[i][billableIdIdx]))) {
          // Log deletion before removing row
          const deletedRowObj = {};
          headers.forEach((h, colIdx) => {
            deletedRowObj[h] = data[i][colIdx];
          });
          logBillableHistory(deletedRowObj, 'Delete', userName);

          sheet.deleteRow(i + 1);
        }
      }

      // Also remove associated records from Finance and Receipts
      try {
        const finSheet = getSheet('Finance');
        if (finSheet) {
          const finData = finSheet.getDataRange().getValues();
          const finHeaders = finData[0];
          const finIdIdx = finHeaders.indexOf('Billable_id');
          const financeIdColIdx = finHeaders.indexOf('Finance_id');
          const deletedFinanceIds = [];
          
          if (finIdIdx !== -1) {
            for (let j = finData.length - 1; j >= 1; j--) {
              // Finance tab Billable_id can contain multiple ids if merged, but if it contains the deleted one...
              const bIds = String(finData[j][finIdIdx]).split(',').map(s => s.trim()).filter(Boolean);
              if (bIds.some(id => deletedBillables.includes(id))) {
                if (financeIdColIdx !== -1) deletedFinanceIds.push(String(finData[j][financeIdColIdx]));
                finSheet.deleteRow(j + 1);
              }
            }
          }
          
          if (deletedFinanceIds.length > 0) {
            const recSheet = getSheet('Receipts');
            if (recSheet) {
              const recData = recSheet.getDataRange().getValues();
              const recHeaders = recData[0];
              const recFinIdIdx = recHeaders.indexOf('Finance_id');
              if (recFinIdIdx !== -1) {
                for (let k = recData.length - 1; k >= 1; k--) {
                  if (deletedFinanceIds.includes(String(recData[k][recFinIdIdx]))) {
                    recSheet.deleteRow(k + 1);
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        Logger.log("Failed to clean up Finance/Receipts on Billable delete: " + e.toString());
      }
    }

    if (deletedBins.length > 0) {
      const binSheet = getSheet('Bin');
      const binData = binSheet.getDataRange().getValues();
      const binHeaders = binData[0];
      const bBlockIdIdx = binHeaders.indexOf('Block_id');
      const bBinNumIdx = binHeaders.indexOf('Bin_number');
      
      if (bBlockIdIdx !== -1 && bBinNumIdx !== -1) {
        for (let i = binData.length - 1; i >= 1; i--) {
          if (String(binData[i][bBlockIdIdx]).trim() === String(blockId).trim() &&
              deletedBins.includes(String(binData[i][bBinNumIdx]))) {
            binSheet.deleteRow(i + 1);
          }
        }
      }
    }

    if (billables.length > 0) {
      const sheet = getSheet('Billable');
      let data = sheet.getDataRange().getValues();
      let headers = data[0];

      // Ensure headers exist
      const requiredHeaders = ['Block_id', 'Billable_id', 'Bin_number', 'BlockName', 'Billable_date', 'Billable_Amount_in_Home_Currency', 'Home_Currency', 'Amount_in_Inr', 'Amount_in_USD', 'Approved_to_Finance', 'Approved by', 'Remarks', 'Status', 'Hold_Billing'];
      let headersChanged = false;
      requiredHeaders.forEach(h => {
        if (headers.indexOf(h) === -1) {
          headers.push(h);
          headersChanged = true;
        }
      });
      if (headersChanged) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        data = sheet.getDataRange().getValues();
      }

      const billableIdIdx = headers.indexOf('Billable_id');
      const approvedByIdx = headers.indexOf('Approved by');

      billables.forEach(b => {
        const bId = b['Billable_id'] || generateBillableId();
        let foundRow = -1;
        if (b['Billable_id']) {
          for (let i = 1; i < data.length; i++) {
            if (String(data[i][billableIdIdx]) === String(bId)) {
              foundRow = i + 1;
              break;
            }
          }
        }

        const newRow = {
          'Block_id': blockId,
          'Billable_id': bId,
          'Bin_number': b['Bin_number'] || '',
          'BlockName': blockName || '',
          'Billable_date': ensureTextDate(b['Billable_date']),
          'Billable_Amount_in_Home_Currency': b['Billable_Amount_in_Home_Currency'] || '',
          'Home_Currency': b['Home_Currency'] || '',
          'Amount_in_Inr': b['Amount_in_Inr'] || '',
          'Amount_in_USD': b['Amount_in_USD'] || '',
          'Remarks': b['Remarks'] || '',
          'Status': b['Status'] || '',
          'Hold_Billing': b['Hold_Billing'] || false
        };

        if (b.isApproving) {
          let currentApprovedBy = '';
          if (foundRow > 0 && approvedByIdx !== -1) {
             currentApprovedBy = data[foundRow - 1][approvedByIdx] || '';
          }
          let approvedList = currentApprovedBy ? String(currentApprovedBy).replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean) : [];
          if (!approvedList.includes(userName)) {
            approvedList.push(userName);
          }
          newRow['Approved by'] = '[' + approvedList.join(', ') + ']';
          if (approvedList.length >= 2) {
            newRow['Approved_to_Finance'] = 'True';
            
            // Auto-push to Finance tab
            try {
              const finSheet = getSheet('Finance');
              let finData = finSheet.getDataRange().getValues();
              let finHeaders = finData[0];
              const finIdIdx = finHeaders.indexOf('Billable_id');
              let finFound = false;
              if (finIdIdx !== -1) {
                for (let j = 1; j < finData.length; j++) {
                  if (String(finData[j][finIdIdx]) === String(bId)) {
                    finFound = true;
                    break;
                  }
                }
              }
              if (!finFound) {
                appendRow('Finance', {
                  'Finance_id': Utilities.getUuid(),
                  'Billable_id': bId,
                  'BlockName': blockName || '',
                  'Billable_date': newRow['Billable_date'],
                  'Billable_Amount_in_Home_Currency': newRow['Billable_Amount_in_Home_Currency'],
                  'Home_Currency': newRow['Home_Currency'],
                  'Billable_Amount_in_Inr': newRow['Amount_in_Inr']
                });
              }
            } catch (finErr) {
              Logger.log("Failed to auto-push to Finance: " + finErr.toString());
            }

          } else {
            newRow['Approved_to_Finance'] = 'Partially Approved';
          }
        }

        if (foundRow > 0) {
          // Check for actual changes before logging an update
          let hasChanges = false;
          let changeType = 'Update';
          const oldRow = data[foundRow - 1];
          const oldDate = String(oldRow[headers.indexOf('Billable_date')] || '').trim();
          const newDateStr = String(newRow['Billable_date'] || '').replace(/^['`]/, '').trim();
          
          const oldAmount = String(oldRow[headers.indexOf('Billable_Amount_in_Home_Currency')] || '').trim();
          const newAmount = String(newRow['Billable_Amount_in_Home_Currency'] || '').trim();

          const normalizeDate = d => {
            if (d instanceof Date) return Utilities.formatDate(d, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'M/d/yyyy');
            return d.replace(/^['`]/, '').trim();
          };
          
          if (normalizeDate(oldDate) !== normalizeDate(newDateStr)) {
            hasChanges = true;
            changeType = 'Date Changed';
          }
          if (oldAmount !== newAmount) {
            hasChanges = true;
            changeType = changeType === 'Date Changed' ? 'Amount & Date Changed' : 'Amount Changed';
          }

          headers.forEach((h, colIdx) => {
            if (newRow[h] !== undefined) {
              const currentVal = oldRow[colIdx];
              const newVal = newRow[h];
              if (String(currentVal) !== String(newVal)) {
                sheet.getRange(foundRow, colIdx + 1).setValue(newVal);
              }
            }
          });
          
          if (hasChanges) {
            logBillableHistory(newRow, changeType, userName);
            
            // Sync updated date/amount to Finance sheet if it exists
            try {
              const finSheet = getSheet('Finance');
              if (finSheet) {
                const finData = finSheet.getDataRange().getValues();
                const finHeaders = finData[0];
                const finIdIdx = finHeaders.indexOf('Billable_id');
                const finDateIdx = finHeaders.indexOf('Billable_date');
                const finAmtIdx = finHeaders.indexOf('Billable_Amount_in_Home_Currency');
                const finInrAmtIdx = finHeaders.indexOf('Billable_Amount_in_Inr');
                
                if (finIdIdx !== -1) {
                  for (let j = 1; j < finData.length; j++) {
                    const bIds = String(finData[j][finIdIdx]).split(',').map(s => s.trim()).filter(Boolean);
                    if (bIds.includes(String(bId))) {
                      if (finDateIdx !== -1) finSheet.getRange(j + 1, finDateIdx + 1).setValue(newRow['Billable_date']);
                      if (finAmtIdx !== -1) finSheet.getRange(j + 1, finAmtIdx + 1).setValue(newRow['Billable_Amount_in_Home_Currency']);
                      if (finInrAmtIdx !== -1) finSheet.getRange(j + 1, finInrAmtIdx + 1).setValue(newRow['Amount_in_Inr']);
                    }
                  }
                }
              }
            } catch (finErr) {
              Logger.log("Failed to sync updates to Finance sheet: " + finErr.toString());
            }
          }
        } else {
          appendRow('Billable', newRow);
          logBillableHistory(newRow, 'New', userName);
        }
      });
    }

    if (bins.length > 0) {
      const sheet = getSheet('Bin');
      let data = sheet.getDataRange().getValues();
      let headers = data[0];
      
      // Ensure headers exist
      const requiredHeaders = ['Block_id', 'Bin_number', 'Type', 'Status', 'Approved_Cost_Sheet', 'Bin_Amount'];
      let headersChanged = false;
      requiredHeaders.forEach(h => {
        if (headers.indexOf(h) === -1) {
          headers.push(h);
          headersChanged = true;
        }
      });
      if (headersChanged) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        data = sheet.getDataRange().getValues();
      }

      const blockIdIdx = headers.indexOf('Block_id');
      const binNumIdx = headers.indexOf('Bin_number');

      // Group billables by bin to calculate bin status
      const binStatuses = {};
      billables.forEach(b => {
        const binNum = b['Bin_number'];
        if (!binStatuses[binNum]) binStatuses[binNum] = [];
        binStatuses[binNum].push(b['Status']);
      });

      bins.forEach(binUpdate => {
        let foundRow = -1;
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][blockIdIdx]).trim() === String(blockId).trim() && 
              String(data[i][binNumIdx]).trim() === String(binUpdate.Bin_number).trim()) {
            foundRow = i + 1;
            break;
          }
        }

        let calculatedStatus = '';
        const statuses = binStatuses[binUpdate.Bin_number] || [];
        if (statuses.length > 0) {
          if (statuses.every(s => s === 'Billed')) {
            calculatedStatus = 'Billed';
          } else if (statuses.includes('Billed')) {
            calculatedStatus = 'Partially Billed';
          } else {
            calculatedStatus = 'Billable';
          }
        }

        const rowUpdates = {
          'Block_id': blockId,
          'Bin_number': binUpdate.Bin_number,
          'Type': binUpdate.Type !== undefined ? binUpdate.Type : '',
          'Status': calculatedStatus || 'Billable',
          'Bin_Amount': binUpdate.Bin_Amount !== undefined ? binUpdate.Bin_Amount : ''
        };
        if (binUpdate.Approved_Cost_Sheet !== undefined) {
          rowUpdates['Approved_Cost_Sheet'] = binUpdate.Approved_Cost_Sheet;
        }

        if (foundRow > 0) {
          headers.forEach((h, colIdx) => {
            if (rowUpdates[h] !== undefined) {
              sheet.getRange(foundRow, colIdx + 1).setValue(rowUpdates[h]);
            }
          });
        } else {
          appendRow('Bin', rowUpdates);
        }
      });
    }

    if (payload.workOrder !== undefined && blockId) {
      const pSheet = getSheet('Production');
      const pData = pSheet.getDataRange().getValues();
      const pHeaders = pData[0];
      const pIdIdx = pHeaders.indexOf('Block_id');
      const woIdx = pHeaders.indexOf('Work_Order');
      
      if (pIdIdx !== -1) {
        let actualWoIdx = woIdx;
        if (woIdx === -1) {
          pHeaders.push('Work_Order');
          pSheet.getRange(1, 1, 1, pHeaders.length).setValues([pHeaders]);
          actualWoIdx = pHeaders.length - 1;
        }
        
        for (let i = 1; i < pData.length; i++) {
          if (String(pData[i][pIdIdx]).trim() === String(blockId).trim()) {
            pSheet.getRange(i + 1, actualWoIdx + 1).setValue(payload.workOrder);
            break;
          }
        }
      }
    }

    if (payload.actionIdsToApprove && payload.actionIdsToApprove.length > 0) {
      payload.actionIdsToApprove.forEach(id => {
        approveBillableUpdate(id);
      });
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function logBillableHistory(billableRow, type, userEmail) {
  const sheet = getSheet('Billable History');
  const headers = ['Action_id', 'Action_timestamp', 'Block_id', 'Billable_id', 'Bin_number', 'BlockName', 'Billable_date', 'Billable_Amount_in_Home_Currency', 'Home_Currency', 'Amount_in_Inr', 'Amount_in_USD', 'Type', 'email', 'Approved'];
  const existingHeaders = getHeaders(sheet);
  
  // Ensure the 'Approved' header exists if it was added later
  if (existingHeaders.length > 0 && existingHeaders.indexOf('Approved') === -1) {
    existingHeaders.push('Approved');
    sheet.getRange(1, 1, 1, existingHeaders.length).setValues([existingHeaders]);
  } else if (existingHeaders.length === 0) {
    sheet.appendRow(headers);
  }
  
  const row = [
    generateActionId(),
    new Date(), 
    billableRow['Block_id'],
    billableRow['Billable_id'],
    billableRow['Bin_number'],
    billableRow['BlockName'],
    billableRow['Billable_date'],
    billableRow['Billable_Amount_in_Home_Currency'],
    billableRow['Home_Currency'],
    billableRow['Amount_in_Inr'],
    billableRow['Amount_in_USD'],
    type,
    userEmail,
    false // Defaults to Unapproved when logged
  ];
  sheet.appendRow(row);
}

function approveBillableUpdate(actionId) {
  try {
    if (!actionId) {
      return { success: false, error: 'Missing Action ID' };
    }

    const sheet = getSheet('Billable History');
    const data = sheet.getDataRange().getValues();
    if (!data || data.length === 0) {
      return { success: false, error: 'Billable History is empty' };
    }

    const headers = data[0].map(h => String(h).trim());
    const actionIdIdx = headers.findIndex(h => h === 'Action_id' || h === 'Action ID' || h.toLowerCase() === 'action_id');
    let approvedIdx = headers.findIndex(h => h === 'Approved' || h === 'Is Approved' || h.toLowerCase() === 'approved');

    if (actionIdIdx === -1) {
      return { success: false, error: 'Action_id column not found in Billable History' };
    }

    if (approvedIdx === -1) {
      approvedIdx = headers.length;
      headers.push('Approved');
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][actionIdIdx]) === String(actionId)) {
        sheet.getRange(i + 1, approvedIdx + 1).setValue(true);
        return { success: true };
      }
    }

    return { success: false, error: 'Action ID not found' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function stripQuote(val) {
  if (!val) return '';
  return String(val).replace(/^['`]/, '').trim();
}

function normalizeFinanceHubInvoiceKey(val) {
  return String(val || '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/^['`]/, '')
    .trim()
    .toUpperCase();
}

function getFinances(callerContext) {
  try {
    // Keep the existing shared data path unchanged unless Finance Hub opts in.
    const useFinanceHubReceiptJoin = callerContext === 'financeHub';
    const billables = getSheetData('Billable') || [];
    const approvedBillables = billables.filter(b => String(b['Approved_to_Finance']).trim().toLowerCase() === 'true');
    const finances = getSheetData('Finance') || [];
    const receipts = getSheetData('Receipts') || [];
    const production = getSheetData('Production') || [];
    const bins = getSheetData('Bin') || [];
    
    const binMap = {};
    bins.forEach(b => {
      const key = `${b['Block_id']}_${b['Bin_number']}`;
      binMap[key] = b;
    });

    const financeMap = {};
    finances.forEach(f => {
      const bIdStr = String(f['Billable_id'] || '').trim();
      if (bIdStr) {
        const ids = bIdStr.split(',').map(s => s.trim()).filter(Boolean);
        ids.forEach(id => {
          if (!financeMap[id]) financeMap[id] = [];
          financeMap[id].push(f);
        });
      }
    });
    
    const prodMap = {};
    production.forEach(p => prodMap[p['Block_id']] = p);
    
    const receiptsMap = {};
    receipts.forEach(r => {
      const rawInv = r['Invoice_Number'];
      const inv = useFinanceHubReceiptJoin ? normalizeFinanceHubInvoiceKey(rawInv) : rawInv;
      if (inv) {
        if (!receiptsMap[inv]) receiptsMap[inv] = [];
        receiptsMap[inv].push(r);
      }
    });

    return approvedBillables.map(b => {
      const bFinances = financeMap[b['Billable_id']] || [];
      const prod = prodMap[b['Block_id']] || {};
      const binData = binMap[`${b['Block_id']}_${b['Bin_number']}`] || {};
      
      const mappedFinances = bFinances.map(f => {
        const inv = f['Invoice_Number'] || '';
        const receiptLookupKey = useFinanceHubReceiptJoin ? normalizeFinanceHubInvoiceKey(inv) : inv;
        const recs = receiptLookupKey ? (receiptsMap[receiptLookupKey] || []) : [];
        return {
          'Finance_id': f['Finance_id'] || '',
          'Billed_date': stripQuote(f['Billed_date']),
          'Expected_payment_date': stripQuote(f['Expected_payment_date']),
          'Due_date': stripQuote(f['Due_date']),
          'Invoice_Number': inv,
          'Billing_type': f['Billing_type'] || '',
          'Exchange_Rate': f['Exchange_Rate'] !== undefined && f['Exchange_Rate'] !== '' ? f['Exchange_Rate'] : '',
          'Billed_Amount_in_Inr': f['Billed_Amount_in_Inr'] !== undefined && f['Billed_Amount_in_Inr'] !== '' ? f['Billed_Amount_in_Inr'] : '',
          'Billed_Home_Amount': f['Billed_Home Amount'] !== undefined && f['Billed_Home Amount'] !== '' ? f['Billed_Home Amount'] : (f['Billed_Home_Amount'] !== undefined && f['Billed_Home_Amount'] !== '' ? f['Billed_Home_Amount'] : ''),
          'Exchange_Diff': f['Exchange_Diff'] !== undefined && f['Exchange_Diff'] !== '' ? f['Exchange_Diff'] : '',
          'Bank_Charges': f['Bank_Charges'] !== undefined && f['Bank_Charges'] !== '' ? f['Bank_Charges'] : '',
          'Finance_remarks': f['Finance_remarks'] || '',
          'Tax_type': f['Tax_type'] || '',
          'GST': f['GST%'] !== undefined && f['GST%'] !== '' ? f['GST%'] : (f['GST'] !== undefined && f['GST'] !== '' ? f['GST'] : ''),
          'GST_amount': f['GST_amount'] !== undefined && f['GST_amount'] !== '' ? f['GST_amount'] : (f['Gst_amount'] !== undefined && f['Gst_amount'] !== '' ? f['Gst_amount'] : ''),
          'Total Amount + GST (INR)': f['Total Amount + GST (INR)'] !== undefined && f['Total Amount + GST (INR)'] !== '' ? f['Total Amount + GST (INR)'] : '',
          'GST_Received': f['GST_Received'] !== undefined && f['GST_Received'] !== '' ? f['GST_Received'] : '',
          'GST_Date': stripQuote(f['GST_Date']),
          'TDS': f['TDS'] !== undefined && f['TDS'] !== '' ? f['TDS'] : '',
          'TDS_Type': f['TDS_Type'] || '',
          'TDS_Percentage': f['TDS_Percentage'] !== undefined && f['TDS_Percentage'] !== '' ? f['TDS_Percentage'] : '',
          'VAT_UK': f['VAT_UK'] || '',
          'VAT_China': f['VAT_China'] || '',
          'Credit Note Number': f['Credit Note Number'] || '',
          'Payment_status': f['Payment_status'] || '',
          'Payment_Status_Override': f['Payment_Status_Override'] || '',
          'Receipts': recs.map(r => ({
            ...r,
            'Receipt_date': stripQuote(r['Receipt_date']),
            'Receipt_Home_Amount': r['Receipt_Home Amount'] !== undefined ? r['Receipt_Home Amount'] : (r['Receipt_Home_Amount'] !== undefined ? r['Receipt_Home_Amount'] : ''),
            'Receipt_Amount': r['Receipt_Amount_in_INR'] !== undefined ? r['Receipt_Amount_in_INR'] : (r['Receipt_Amount'] !== undefined ? r['Receipt_Amount'] : ''),
            'Exchange_rate': r['Exchange rate'] !== undefined ? r['Exchange rate'] : (r['Exchange_rate'] !== undefined ? r['Exchange_rate'] : '')
          }))
        };
      });
      
      return {
        'Billable_id': b['Billable_id'] || '',
        'Bin_number': b['Bin_number'] || '',
        'BlockName': b['BlockName'] || '',
        'Client': prod['Client_Name'] || prod['Client'] || '',
        'Client_Code': prod['Client_Code'] || '',
        'Show_Code': prod['Show_Code'] || '',
        'BizPoC': prod['BizPoC'] || prod['Biz Poc'] || '',
        'deal_stage': prod['deal_stage'] || prod['Project Status'] || '',
        'Billable_date': stripQuote(b['Billable_date']),
        'Billable_Amount_in_Home_Currency': b['Billable_Amount_in_Home_Currency'] || '',
        'Home_Currency': b['Home_Currency'] || '',
        'Amount_in_USD': b['Amount_in_USD'] || '',
        'Billable_Amount_in_Inr': b['Amount_in_Inr'] || '',
        'Hold_Billing': String(b['Hold_Billing']).toLowerCase() === 'true',
        'Office': prod['Contracting_Office'] || prod['Office'] || '',
        'Region': prod['Region Type'] || prod['Region'] || '',
        'Work_Order': prod['Work_Order'] || '',
        'Approved_Cost_Sheet': binData['Approved_Cost_Sheet'] || '',
        'finances': mappedFinances
      };
    });
  } catch (error) {
    Logger.log('ERROR in getFinances: ' + error.toString());
    return [];
  }
}

function saveFinance(payload) {
  try {
    const saves = payload.multi || [payload];
    
    if (saves.length === 0) return { success: false, error: 'No data to save' };

    // 1. Save Finance Data
    const sheet = getSheet('Finance');
    let data = sheet.getDataRange().getValues();
    let headers = data[0];

    const requiredHeaders = [
      'Finance_id', 'Billable_id', 'BlockName', 'Billable_date', 'Billed_date', 'Expected_payment_date', 
      'Due_date', 'Invoice_Number', 'Billable_Amount_in_Home_Currency', 'Home_Currency', 
      'Billing_type', 'Exchange_Rate', 'Billable_Amount_in_Inr', 'Billed_Home Amount', 'Billed_Amount_in_Inr', 
      'Exchange_Diff', 'Bank_Charges', 'Finance_remarks', 'Tax_type', 'GST%', 'GST_amount', 
      'Total Amount + GST (INR)', 'GST_Received', 'GST_Date', 'TDS', 'TDS_Type', 'TDS_Percentage', 'VAT_UK', 'VAT_China', 'Credit Note Number', 'Outstanding_amount', 'Payment_status', 'Payment_Status_Override'
    ];
    
    let headersChanged = false;
    requiredHeaders.forEach(h => {
      if (headers.indexOf(h) === -1) {
        headers.push(h);
        headersChanged = true;
      }
    });
    if (headersChanged) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      data = sheet.getDataRange().getValues();
    }

    const fIdIdx = headers.indexOf('Finance_id');
    const bIdIdx = headers.indexOf('Billable_id');

    // Delete removed finances
    let allDeletedFinances = [];
    saves.forEach(s => {
      if (s.deletedFinances) allDeletedFinances.push(...s.deletedFinances);
    });

    if (allDeletedFinances.length > 0 && fIdIdx !== -1) {
      for (let i = data.length - 1; i >= 1; i--) {
        if (allDeletedFinances.includes(String(data[i][fIdIdx]))) {
          sheet.deleteRow(i + 1);
        }
      }
      data = sheet.getDataRange().getValues();
    }

    // Prepare Receipts sheet
    const rSheet = getSheet('Receipts');
    let rData = rSheet.getDataRange().getValues();
    let rHeaders = rData[0];
    const reqRHeaders = ['Invoice_Number', 'Receipt_date', 'Receipt_Amount', 'Receipt_Type', 'Receipt_id'];
    let rHeadersChanged = false;
    reqRHeaders.forEach(h => {
      if (rHeaders.indexOf(h) === -1) {
        rHeaders.push(h);
        rHeadersChanged = true;
      }
    });
    if (rHeadersChanged) {
      rSheet.getRange(1, 1, 1, rHeaders.length).setValues([rHeaders]);
      rData = rSheet.getDataRange().getValues();
    }
    const rIdIdx = rHeaders.indexOf('Receipt_id');

    let allDeletedReceipts = [];
    saves.forEach(s => {
      if (s.financesData) {
        s.financesData.forEach(f => {
          if (f.deletedReceipts) allDeletedReceipts.push(...f.deletedReceipts);
        });
      }
    });

    if (allDeletedReceipts.length > 0 && rIdIdx !== -1) {
      for (let i = rData.length - 1; i >= 1; i--) {
        if (allDeletedReceipts.includes(String(rData[i][rIdIdx]))) {
          rSheet.deleteRow(i + 1);
        }
      }
      rData = rSheet.getDataRange().getValues();
    }

    const processedInvoices = new Set(); // to prevent duplicate receipt insertions

    saves.forEach(saveObj => {
      const currentBillableId = saveObj.billableId;
      const currentFinancesData = saveObj.financesData || [];

      // Process each finance entry ONCE using the currentBillableId
      currentFinancesData.forEach(financeTemplate => {
        const finance = { ...financeTemplate };
        let foundRow = -1;
        
        if (finance['Finance_id']) {
          for (let i = 1; i < data.length; i++) {
            if (String(data[i][fIdIdx] || '').trim() === String(finance['Finance_id']).trim() && String(data[i][fIdIdx] || '').trim() !== 'PENDING_UPDATE') {
              foundRow = i + 1;
              data[i][fIdIdx] = 'PENDING_UPDATE'; // Mark as consumed
              break;
            }
          }
        }
        
        if (foundRow === -1) {
          for (let i = 1; i < data.length; i++) {
            const rowBId = String(data[i][bIdIdx] || '').trim();
            const rowFId = String(data[i][fIdIdx] || '').trim();
            // Match exactly on Billable_id and Invoice_Number if updating without Finance_id
            const rowInvNum = String(data[i][headers.indexOf('Invoice_Number')] || '').trim();
            const searchInvNum = String(finance['Invoice_Number'] || '').trim();

            // Match if Billable_id matches AND (Invoice_Number matches OR the row is a blank placeholder)
            if (rowBId === String(currentBillableId).trim() && 
                rowFId !== 'PENDING_UPDATE' && 
                (rowInvNum === searchInvNum || rowInvNum === '')) {
              foundRow = i + 1;
              data[i][fIdIdx] = 'PENDING_UPDATE'; // Mark as consumed
              break;
            }
          }
        }

        const fId = finance['Finance_id'] || Utilities.getUuid();
        finance['Finance_id'] = fId;
        finance['Billable_id'] = currentBillableId;

        const newRow = { ...finance };
        
        // Map Billed_Home_Amount to Billed_Home Amount for saving
        if (newRow['Billed_Home_Amount'] !== undefined) {
          newRow['Billed_Home Amount'] = newRow['Billed_Home_Amount'];
        }

        // Format dates for Sheets
        ['Billable_date', 'Billed_date', 'Expected_payment_date', 'Due_date', 'GST_Date'].forEach(field => {
          if (newRow[field]) {
            newRow[field] = ensureTextDate(newRow[field]);
          }
        });

        if (foundRow > 0) {
          headers.forEach((h, colIdx) => {
            if (newRow[h] !== undefined) {
              sheet.getRange(foundRow, colIdx + 1).setValue(newRow[h]);
            }
          });
        } else {
          appendRow('Finance', newRow);
        }

        const invNum = finance['Invoice_Number'];
        if (invNum && !processedInvoices.has(invNum)) {
          processedInvoices.add(invNum);
          const receiptsData = finance.Receipts || [];
          
          receiptsData.forEach(rec => {
            const rId = rec['Receipt_id'] || Utilities.getUuid();
            let fRow = -1;
            if (rec['Receipt_id']) {
              for (let i = 1; i < rData.length; i++) {
                if (String(rData[i][rIdIdx]) === String(rId)) {
                  fRow = i + 1;
                  break;
                }
              }
            }

            const newRecRow = {
              'Invoice_Number': invNum,
              'Receipt_date': ensureTextDate(rec['Receipt_date']),
              'Receipt_Home Amount': rec['Receipt_Home_Amount'] || '',
              'Receipt_Amount_in_INR': rec['Receipt_Amount'] || '',
              'Exchange rate': rec['Exchange_rate'] || '',
              'Receipt_Type': rec['Receipt_Type'] || '',
              'Receipt_id': rId
            };

            if (fRow > 0) {
              rHeaders.forEach((h, colIdx) => {
                if (newRecRow[h] !== undefined) {
                  rSheet.getRange(fRow, colIdx + 1).setValue(newRecRow[h]);
                }
              });
            } else {
              appendRow('Receipts', newRecRow);
              rData.push(rHeaders.map(h => newRecRow[h] || '')); 
            }
          });
        }
      });
    });

    // 3. Update Billable and Bin Status if Invoiced
    const allInvoicedBillables = [];
    saves.forEach(s => {
       if (s.financesData && s.financesData.some(f => !!f['Invoice_Number'])) {
           allInvoicedBillables.push(s.billableId);
       }
    });

    if (allInvoicedBillables.length > 0) {
      const billableSheet = getSheet('Billable');
      const bData = billableSheet.getDataRange().getValues();
      const bHeaders = bData[0];
      const bIdIdx = bHeaders.indexOf('Billable_id');
      const bStatusIdx = bHeaders.indexOf('Status');
      const bBinIdx = bHeaders.indexOf('Bin_number');
      const bPidIdx = bHeaders.indexOf('Block_id');

      const targetBins = [];

      if (bIdIdx !== -1 && bStatusIdx !== -1) {
        for (let i = 1; i < bData.length; i++) {
          if (allInvoicedBillables.includes(String(bData[i][bIdIdx]))) {
            billableSheet.getRange(i + 1, bStatusIdx + 1).setValue('Billed');
            bData[i][bStatusIdx] = 'Billed'; // update local array for bin calculation
            targetBins.push({ pid: String(bData[i][bPidIdx]), bin: String(bData[i][bBinIdx]) });
          }
        }
      }

      // Update Bin Status
      if (targetBins.length > 0) {
        const binSheet = getSheet('Bin');
        const binData = binSheet.getDataRange().getValues();
        const binHeaders = binData[0];
        const binPidIdx = binHeaders.indexOf('Block_id');
        const binNumIdx = binHeaders.indexOf('Bin_number');
        const binStatusIdx = binHeaders.indexOf('Status');

        targetBins.forEach(target => {
          const targetPid = target.pid;
          const targetBin = target.bin;
          // calculate new bin status
          const statusesInBin = bData.filter((row, i) => i > 0 && String(row[bPidIdx]) === targetPid && String(row[bBinIdx]) === targetBin).map(row => row[bStatusIdx]);
          let newBinStatus = 'Billable';
          if (statusesInBin.length > 0) {
             if (statusesInBin.every(s => s === 'Billed')) newBinStatus = 'Billed';
             else if (statusesInBin.includes('Billed')) newBinStatus = 'Partially Billed';
          }

          if (binPidIdx !== -1 && binNumIdx !== -1 && binStatusIdx !== -1) {
            for (let i = 1; i < binData.length; i++) {
              if (String(binData[i][binPidIdx]) === targetPid && String(binData[i][binNumIdx]) === targetBin) {
                binSheet.getRange(i + 1, binStatusIdx + 1).setValue(newBinStatus);
                break;
              }
            }
          }
        });
      }
    }

    return { success: true };
  } catch (error) {
    Logger.log('ERROR in saveFinance: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

function unmergeFinanceDetails(billableIds) {
  try {
    if (!billableIds || billableIds.length === 0) return { success: false, error: 'No IDs provided' };

    const sheet = getSheet('Finance');
    let data = sheet.getDataRange().getValues();
    let headers = data[0];
    const bIdIdx = headers.indexOf('Billable_id');
    const invNumIdx = headers.indexOf('Invoice_Number');

    if (bIdIdx === -1) return { success: false, error: 'Billable_id column not found' };

    const invoiceNumbersToRemove = new Set();
    const rowsToClear = [];

    for (let i = 1; i < data.length; i++) {
      const rowBId = String(data[i][bIdIdx] || '').trim();
      if (billableIds.includes(rowBId)) {
        rowsToClear.push(i + 1); // 1-based index for sheet
        const invNum = String(data[i][invNumIdx] || '').trim();
        if (invNum) {
          invoiceNumbersToRemove.add(invNum);
        }
      }
    }

    // Clear specific columns in Finance sheet for these rows
    const colsToClear = [
      'Billed_date', 'Expected_payment_date', 'Due_date', 'Invoice_Number', 
      'Billing_type', 'Exchange_Rate', 'Billed_Home Amount', 'Billed_Home_Amount', 'Billed_Amount_in_Inr', 
      'Exchange_Diff', 'Bank_Charges', 'Finance_remarks', 'Tax_type', 'GST%', 'GST_amount', 
      'Total Amount + GST (INR)', 'GST_Received', 'GST_Date', 'TDS', 'TDS_Type', 'TDS_Percentage', 
      'VAT_UK', 'VAT_China', 'Credit Note Number', 'Outstanding_amount', 'Payment_status'
    ];
    
    colsToClear.forEach(colName => {
      const colIdx = headers.indexOf(colName);
      if (colIdx !== -1) {
        rowsToClear.forEach(rowIdx => {
          sheet.getRange(rowIdx, colIdx + 1).setValue('');
        });
      }
    });

    // Delete associated receipts
    if (invoiceNumbersToRemove.size > 0) {
      const rSheet = getSheet('Receipts');
      const rData = rSheet.getDataRange().getValues();
      const rHeaders = rData[0];
      const rInvIdx = rHeaders.indexOf('Invoice_Number');
      
      if (rInvIdx !== -1) {
        for (let i = rData.length - 1; i >= 1; i--) {
          const rowInvNum = String(rData[i][rInvIdx] || '').trim();
          if (invoiceNumbersToRemove.has(rowInvNum)) {
            rSheet.deleteRow(i + 1);
          }
        }
      }
    }

    // Update Billable sheet status back to 'Billable'
    const billableSheet = getSheet('Billable');
    const bData = billableSheet.getDataRange().getValues();
    const bHeaders = bData[0];
    const bSheetBIdIdx = bHeaders.indexOf('Billable_id');
    const bStatusIdx = bHeaders.indexOf('Status');
    const bBinIdx = bHeaders.indexOf('Bin_number');
    const bPidIdx = bHeaders.indexOf('Block_id');

    const targetBins = [];

    if (bSheetBIdIdx !== -1 && bStatusIdx !== -1) {
      for (let i = 1; i < bData.length; i++) {
        if (billableIds.includes(String(bData[i][bSheetBIdIdx]).trim())) {
          billableSheet.getRange(i + 1, bStatusIdx + 1).setValue('Billable');
          bData[i][bStatusIdx] = 'Billable'; // Update memory for bin calc
          targetBins.push({ pid: String(bData[i][bPidIdx]), bin: String(bData[i][bBinIdx]) });
        }
      }
    }

    // Update Bin Status based on Billable statuses
    if (targetBins.length > 0) {
      const binSheet = getSheet('Bin');
      const binData = binSheet.getDataRange().getValues();
      const binHeaders = binData[0];
      const binPidIdx = binHeaders.indexOf('Block_id');
      const binNumIdx = binHeaders.indexOf('Bin_number');
      const binStatusIdx = binHeaders.indexOf('Status');

      targetBins.forEach(target => {
        const targetPid = target.pid;
        const targetBin = target.bin;
        
        const statusesInBin = bData.filter((row, i) => i > 0 && String(row[bPidIdx]) === targetPid && String(row[bBinIdx]) === targetBin).map(row => row[bStatusIdx]);
        
        let newBinStatus = 'Billable';
        if (statusesInBin.length > 0) {
          if (statusesInBin.every(s => s === 'Billed')) newBinStatus = 'Billed';
          else if (statusesInBin.includes('Billed')) newBinStatus = 'Partially Billed';
        }

        // Find bin row and update
        for (let i = 1; i < binData.length; i++) {
           if (String(binData[i][binPidIdx]) === targetPid && String(binData[i][binNumIdx]) === targetBin) {
              binSheet.getRange(i + 1, binStatusIdx + 1).setValue(newBinStatus);
              break;
           }
        }
      });
    }

    return { success: true };
  } catch (error) {
    Logger.log('ERROR in unmergeFinanceDetails: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

// --- CLIENT CODE APP FUNCTIONS (Unchanged / Minimal updates) ---

function getClients() { return getSheetData('Clients'); }
function getClientCodeProjects() { return getClients(); } 

function saveClient(payload) {
  // (Assuming Client App logic remains same, keeping placeholder for brevity if not needed, 
  // but since user asked for "Complete Build", I should include it. 
  // I will just use the existing implementation for Clients as it was not part of the issue.)
  const clientData = {
    client_code: payload.client_code,
    client_name: payload.client_name,
    show_code: payload.show_code,
    project_name: payload.project_name,
    misc_info: payload.misc_info,
    region: payload.region,
    'client location': payload.client_location || payload.territory,
    country: payload.country,
    currency: payload.currency,
    source: payload.source,
    brand: payload.brand,
    Year: payload.year,
    Status: payload.status,
    'Additional Notes': payload.additional_notes || '',
    client_contact_mail: payload.client_contact_mail || '',
    finance_contact_mail: payload.finance_contact_mail || '',
    Address: payload.Address || '',
    Flag: 'APP',
    Referral: payload.is_referral ? true : false
  };
  
  const sheet = getSheet('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const clientCodeIdx = headers.indexOf('client_code');
  const showCodeIdx = headers.indexOf('show_code');
  
  let exists = false;
  let rowIndex = -1;
  
  const searchClientCode = payload.original_client_code || payload.client_code;
  const searchShowCode = payload.original_show_code || payload.show_code;

  if (clientCodeIdx !== -1 && showCodeIdx !== -1) {
    for (let i = 1; i < data.length; i++) {
      const rowClientCode = String(data[i][clientCodeIdx]).trim();
      const rowShowCode = String(data[i][showCodeIdx]).trim();
      if (rowClientCode === String(searchClientCode).trim() && rowShowCode === String(searchShowCode).trim()) {
        exists = true;
        rowIndex = i + 1;
        break;
      }
    }
  }
  
  const row = headers.map(h => {
      const hStr = String(h).trim();
      const lowerH = hStr.toLowerCase();
      if (lowerH === 'repetition') return exists && rowIndex !== -1 ? data[rowIndex - 1][headers.indexOf(h)] : ''; // Keep Google Sheet Formula intact
      if (lowerH === 'client location' || lowerH === 'territory') return clientData['client location'];
      if (lowerH === 'year') return clientData['Year'];
      if (lowerH === 'status') return clientData['Status'];
      if (lowerH === 'additional notes') return clientData['Additional Notes'];
      if (lowerH.includes('finance') && lowerH.includes('contact')) return clientData.finance_contact_mail;
      if (lowerH.includes('client') && lowerH.includes('contact')) return clientData.client_contact_mail;
      if (lowerH === 'address') return clientData.Address;
      if (lowerH === 'flag') return clientData.Flag;
      if (lowerH === 'referral') return clientData.Referral;
      if (clientData[hStr] !== undefined) return clientData[hStr];
      if (clientData[lowerH] !== undefined) return clientData[lowerH];
      return exists && rowIndex !== -1 ? data[rowIndex - 1][headers.indexOf(h)] : '';
  });

  if (exists && rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
  } else {
    // Determine the last truly populated row by checking the first column
    const colAValues = sheet.getRange("A1:A").getValues();
    let lastRow = 0;
    for (let i = colAValues.length - 1; i >= 0; i--) {
      if (String(colAValues[i][0]).trim() !== "") {
        lastRow = i + 1;
        break;
      }
    }
    // Insert immediately after the last populated row
    sheet.getRange(lastRow + 1, 1, 1, headers.length).setValues([row]);
  }
  return { success: true };
}

function getClientNames() {
  const clients = getSheetData('Clients');
  return [...new Set(clients.map(c => c.client_name).filter(Boolean))];
}

function getMiscInfos(clientName) {
  const clients = getSheetData('Clients');
  const filtered = clients.filter(c => c.client_name === clientName);
  return [...new Set(filtered.map(c => c.misc_info).filter(Boolean))];
}

function normalize(s) { return String(s || '').trim().toLowerCase(); }
function isMiscInfoMatch(val1, val2) {
  const n1 = normalize(val1);
  const n2 = normalize(val2);
  return n1 === n2 || (n1 === '0' && n2 === '00') || (n1 === '00' && n2 === '0');
}

function getClientDetails(clientName, miscInfo) {
  const clients = getSheetData('Clients');
  return clients.find(c => normalize(c.client_name) === normalize(clientName) && isMiscInfoMatch(c.misc_info, miscInfo)) || {};
}

function getClientDetailsByName(clientName) {
  const clients = getSheetData('Clients');
  return [...clients].reverse().find(c => c.client_name === clientName) || {};
}

function validateProject(projectName, showCode) {
  const projects = getSheetData('Clients');
  const errors = {};
  if (projects.some(p => String(p.project_name).trim().toLowerCase() === String(projectName).trim().toLowerCase())) errors.project_name = "Project Name already exists";
  
  const helperCodes = getHelperShowCodes();
  if (projects.some(p => String(p.show_code).trim().toLowerCase() === String(showCode).trim().toLowerCase())) {
    errors.show_code = "Show Code already exists in database";
  } else if (helperCodes.some(code => String(code).toLowerCase() === String(showCode).toLowerCase())) {
    errors.show_code = "Show Code already exists in helper list";
  }
  return { errors };
}

function cleanString(s) { return String(s || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); }
function getRegionChar(region) {
  if (!region) return 'X';
  const r = String(region).toLowerCase();
  if (r.includes('domestic')) return 'D';
  if (r.includes('international')) return 'I';
  const c = cleanString(region);
  return c.length > 0 ? c.charAt(0) : 'X';
}
function getTerritoryChar(territory) {
  if (!territory) return 'X';
  const t = String(territory).toLowerCase();
  if (t.includes('others')) return 'W';
  if (t.includes('uk')) return 'K';
  if (t.includes('usa')) return 'U';
  const c = cleanString(territory);
  return c.length > 0 ? c.charAt(0) : 'X';
}
function getRandom3Letters(name) {
  if (!name) return 'XXX';
  const cleaned = cleanString(name);
  if (cleaned.length < 3) return (cleaned + 'XXX').substring(0, 3);
  const indices = [];
  while (indices.length < 3) {
    const r = Math.floor(Math.random() * cleaned.length);
    if (!indices.includes(r)) indices.push(r);
  }
  indices.sort((a, b) => a - b);
  return indices.map(i => cleaned.charAt(i)).join('');
}
function constructClientCode(slice3, region, territory, miscInfo) {
  return `${slice3}-${getRegionChar(region)}${getTerritoryChar(territory)}-${miscInfo ? cleanString(miscInfo) : 'XX'}`;
}
function generateUniqueClientCode(clientName, region, territory, miscInfo) {
  const clients = getSheetData('Clients');
  const existing = clients.find(c => normalize(c.client_name) === normalize(clientName) && isMiscInfoMatch(c.misc_info, miscInfo));
  if (existing && existing.client_code) return existing.client_code;
  
  for (let i = 0; i < 50; i++) {
    const code = constructClientCode(getRandom3Letters(clientName), region, territory, miscInfo);
    if (!clients.find(c => c.client_code === code)) return code;
  }
  const base = constructClientCode(getRandom3Letters(clientName), region, territory, miscInfo);
  let s = 1;
  while (true) {
    const code = `${base}${s}`;
    if (!clients.find(c => c.client_code === code)) return code;
    s++;
  }
}
function previewClientCode(clientName, region, territory, miscInfo) {
  return generateUniqueClientCode(clientName, region, territory, miscInfo);
}
function getHelperShowCodes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("showcode - helper check");
  if (!sheet) return [];
  const lr = sheet.getLastRow();
  if (lr < 2) return [];
  return sheet.getRange(2, 1, lr - 1, 1).getValues().flat().filter(c => c && String(c).trim() !== "").map(c => String(c).trim());
}
function getShowCodes() {
  return [...new Set(getSheetData('Clients').map(p => p.show_code).filter(c => c && String(c).trim() !== ""))].sort();
}
function getProjectByShowCode(showCode) {
  const p = getSheetData('Clients').find(p => String(p.show_code).trim().toLowerCase() === String(showCode).trim().toLowerCase());
  return p ? {
    show_code: p.show_code,
    project_name: p.project_name, 
    client_code: p.client_code,
    source: p.source || 'N/A',
    brand: p.brand || 'N/A',
    region: p.region || 'N/A',
    territory: p['client location'] || p.territory || 'N/A',
    country: p.country || 'N/A',
    currency: p.currency || 'N/A'
  } : null;
}
function getLogoImage() {
  try {
    const files = DriveApp.getFilesByName("pixoo-black-logo.png");
    if (files.hasNext()) {
      const file = files.next();
      return { data: Utilities.base64Encode(file.getBlob().getBytes()), mimeType: file.getMimeType() };
    }
  } catch (e) {}
  return null;
}

// --- UTILITIES ---

function formatDateForDisplay(val) {
  if (!val) return '';
  let d;
  if (val instanceof Date) {
    d = val;
  } else {
    // Strip prefix if any
    const str = String(val).replace(/^['`]/, '');
    d = new Date(str);
  }
  if (isNaN(d.getTime())) return val;
  
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  return `${day} ${month} ${year}`;
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function getSheetData(name) {
  const sheet = getSheet(name);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data[0];
  const results = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Check if the first column (typically ID or Code) is empty to filter out blank array formula rows
    if (!String(row[0]).trim()) continue;
    
    const obj = {};
    headers.forEach((h, j) => {
      obj[h] = row[j];
    });
    results.push(obj);
  }
  return results;
}

function appendRow(name, obj) {
  const sheet = getSheet(name);
  const headers = getHeaders(sheet);
  
  if (headers.length === 0) {
    const keys = Object.keys(obj);
    sheet.appendRow(keys);
  }
  
  const currentHeaders = getHeaders(sheet);
  const row = currentHeaders.map(h => obj[h] || '');
  
  // Determine the last truly populated row by checking the first column
  const colAValues = sheet.getRange("A1:A").getValues();
  let lastRow = 0;
  for (let i = colAValues.length - 1; i >= 0; i--) {
    if (String(colAValues[i][0]).trim() !== "") {
      lastRow = i + 1;
      break;
    }
  }
  // Insert immediately after the last populated row
  sheet.getRange(lastRow + 1, 1, 1, currentHeaders.length).setValues([row]);
}

function updateRow(name, keyField, keyValue, obj) {
  const sheet = getSheet(name);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const keyIdx = headers.indexOf(keyField);
  
  if (keyIdx === -1) throw new Error(`Key field ${keyField} not found in sheet ${name}`);
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIdx]) === String(keyValue)) {
      // Update this row
      const row = headers.map(h => obj[h] !== undefined ? obj[h] : data[i][headers.indexOf(h)]);
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return;
    }
  }
  throw new Error(`Row with ${keyField}=${keyValue} not found`);
}

function getHeaders(sheet) {
  if (sheet.getLastRow() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}
