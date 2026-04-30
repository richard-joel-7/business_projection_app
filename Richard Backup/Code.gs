const ADMIN_EMAILS = ["admin1@phantom-fx.com", "admin2@phantom-fx.com", "richard.j@phantom-fx.com"];

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
  const user = users.find(u => String(u['Email']).toLowerCase().trim() === normalizedEmail && String(u['Password']) === String(password));
  
  if (user) {
    // Determine Admin status from Role column
    const role = user['Role'] || 'Biz';
    const isAdmin = String(role).toLowerCase() === 'admin';
    
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

function getDashboardProjects(email, isAdmin) {
  try {
    Logger.log('getDashboardProjects called with email: ' + email + ', isAdmin: ' + isAdmin);
    
    const projects = getSheetData('Projects');
    const projections = getSheetData('Projections'); // Fetch all projections
    
    Logger.log('Total projects found: ' + projects.length);
    Logger.log('Total projections found: ' + projections.length);
    
    if (!projects || projects.length === 0) {
      Logger.log('No projects found in sheet, returning empty array');
      return [];
    }
    
    // Group projections by Project ID
    const projectionsMap = {};
    if (projections && projections.length > 0) {
      projections.forEach(p => {
        const pid = p['Project ID'];
        if (!projectionsMap[pid]) {
          projectionsMap[pid] = [];
        }
        // Format dates in projection
        const projObj = { ...p };
        if (projObj['Projection date'] instanceof Date) {
          projObj['Projection date'] = Utilities.formatDate(projObj['Projection date'], Session.getScriptTimeZone(), 'dd-MM-yyyy');
        }
        projectionsMap[pid].push(projObj);
      });
    }
    
    let result = projects;
    
    if (!isAdmin) {
      const normalizedEmail = email.toLowerCase().trim();
      Logger.log('Filtering for non-admin user: ' + normalizedEmail);
      
      result = projects.filter(p => {
        const rowEmail = (p['Gmail'] || p['Poc Email'] || p['Email'] || '').toString().toLowerCase().trim();
        return rowEmail === normalizedEmail;
      });
      Logger.log('Filtered projects: ' + result.length);
    } else if (isAdmin) {
      Logger.log('User is admin, returning all ' + projects.length + ' projects');
    } else {
      // For other roles (Client Code, Finance, Production), we might want to restrict or show all.
      // Based on requirements: "Biz users can view projects only tagged to them".
      // Others might have specific views, but for now, let's assume they see all or specific logic.
      // Requirement: "Admin can view all projects but Biz users can view projects only tagged to them."
      // Requirement: "Client Code can see Client Code page, Finance can see Finance Page..."
      // So for getDashboardProjects (which feeds the main dashboard), we should probably stick to the email filter for Biz,
      // and maybe allow others to see all? Or maybe they don't use this function?
      // Let's assume non-admins who are NOT Biz see all for now, or we can refine later.
      // Actually, let's default to email filter for safety unless explicitly Admin.
      // But wait, the prompt says "Admin can view all pages... Biz can view only business projections... Client Code can see Client Code page".
      // So Client Code role might not even USE this function.
      // Let's keep the existing logic: if not Admin, filter by email.
      // BUT, we need to pass the role to this function to be sure.
      // For now, let's assume 'isAdmin' flag covers "Can view all projects".
      // If we need more granular control, we'll update this.
      const normalizedEmail = email.toLowerCase().trim();
      Logger.log('Filtering for non-admin user: ' + normalizedEmail);
      
      result = projects.filter(p => {
        const rowEmail = (p['Gmail'] || p['Poc Email'] || p['Email'] || '').toString().toLowerCase().trim();
        return rowEmail === normalizedEmail;
      });
      Logger.log('Filtered projects: ' + result.length);
    }
    
    // Ensure all data is JSON-serializable (convert Dates to strings) AND attach projections
    const serialized = result.map(p => {
      const obj = {};
      for (let key in p) {
        const value = p[key];
        if (key === 'Close Date') {
          const d = parseStrictDate(value);
          if (d && !isNaN(d.getTime())) {
            obj[key] = Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd-MM-yyyy');
          } else if (value === null || value === undefined) {
            obj[key] = '';
          } else {
            obj[key] = value;
          }
        } else if (value instanceof Date) {
          obj[key] = Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd-MM-yyyy');
        } else if (value === null || value === undefined) {
          obj[key] = '';
        } else {
          obj[key] = value;
        }
      }
      obj.projections = projectionsMap[p['Project ID']] || [];
      return obj;
    });
    
    Logger.log('Returning ' + serialized.length + ' serialized projects');
    return serialized;
  } catch (error) {
    Logger.log('ERROR in getDashboardProjects: ' + error.toString());
    Logger.log('Stack trace: ' + error.stack);
    return [];
  }
}

// TEST FUNCTION - Run this manually to verify data
function testGetProjects() {
  const result = getDashboardProjects('richard.j@phantom-fx.com', true);
  Logger.log('Test result type: ' + typeof result);
  Logger.log('Test result is array: ' + Array.isArray(result));
  Logger.log('Test result length: ' + (result ? result.length : 'null'));
  
  if (result && result.length > 0) {
    Logger.log('First project: ' + JSON.stringify(result[0]));
  }
  
  return result;
}

function getAllowedProjects(email, isAdmin) {
  const projects = getSheetData('Projects');
  let allowed = projects;
  if (!isAdmin) {
    const normalizedEmail = email.toLowerCase().trim();
    allowed = projects.filter(p => {
      const rowEmail = (p['Gmail'] || p['Poc Email'] || p['Email'] || '').toString().toLowerCase().trim();
      return rowEmail === normalizedEmail;
    });
  }
  return allowed.map(p => ({
    'Project ID': p['Project ID'],
    'Project Name': p['Project Name']
  }));
}

function getNextProjectId() {
  const projects = getSheetData('Projects');
  if (projects.length === 0) return 1;
  
  const ids = projects.map(p => {
    const id = p['Project ID'];
    const num = Number(id);
    return isNaN(num) ? 0 : num;
  });
  
  const maxId = Math.max(...ids);
  return maxId + 1;
}

function getProjectById(projectId) {
  const projects = getSheetData('Projects');
  const project = projects.find(p => p['Project ID'] == projectId);
  
  if (!project) return null;
  
  // Serialize
  const serialized = {};
  for (let key in project) {
    const value = project[key];
    if (key === 'Close Date') {
      const d = parseStrictDate(value);
      if (d && !isNaN(d.getTime())) {
        serialized[key] = Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd-MM-yyyy');
      } else if (value === null || value === undefined) {
        serialized[key] = '';
      } else {
        serialized[key] = value;
      }
    } else if (value instanceof Date) {
      serialized[key] = Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd-MM-yyyy');
    } else if (value === null || value === undefined) {
      serialized[key] = '';
    } else {
      serialized[key] = value;
    }
  }
  return serialized;
}

function getProjectionsByProjectId(projectId) {
  Logger.log('getProjectionsByProjectId called for: ' + projectId);
  const projections = getSheetData('Projections');
  const filtered = projections.filter(p => String(p['Project ID']).trim() == String(projectId).trim());
  
  Logger.log('Found ' + filtered.length + ' projections for project ' + projectId);

  // Fetch history for these projections
  const historySheet = getSheet('ProjectionHistory');
  const historyData = historySheet.getDataRange().getValues();
  
  if (historyData.length < 2) {
    Logger.log('No history data found.');
    return filtered.map(p => {
       // ... existing serialization logic for no history ...
       const obj = {};
       for (let key in p) {
         const value = p[key];
         if (value instanceof Date) {
           obj[key] = Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd-MM-yyyy');
         } else if (value === null || value === undefined) {
           obj[key] = '';
         } else {
           obj[key] = value;
         }
       }
       return obj;
    });
  }

  const historyHeaders = historyData[0];
  const projIdIdx = historyHeaders.indexOf('Projection ID');
  let actionDateIdx = historyHeaders.indexOf('Action Date');
  if (actionDateIdx === -1) {
    actionDateIdx = historyHeaders.indexOf('Action Timestamp');
  }
  const prevDateIdx = historyHeaders.indexOf('Previous Projection Date');
  const prevAmountIdx = historyHeaders.indexOf('Previous Amount in USD');
  
  Logger.log('History Headers indices - ID: ' + projIdIdx + ', Date: ' + actionDateIdx);

  // Helper to parse "dd-MM-yyyy HH:mm:ss email" or "dd/MM/yyyy..."
  const parseActionTime = (dateStr) => {
    if (!dateStr) return 0;
    if (dateStr instanceof Date) return dateStr.getTime();
    
    try {
        const cleanStr = String(dateStr).replace(/^'/, '').trim();
        // Try parsing full timestamp first
        const timestampMatch = cleanStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
        if (timestampMatch) {
             const day = parseInt(timestampMatch[1], 10);
             const month = parseInt(timestampMatch[2], 10) - 1;
             const year = parseInt(timestampMatch[3], 10);
             const hour = parseInt(timestampMatch[4], 10);
             const min = parseInt(timestampMatch[5], 10);
             const sec = parseInt(timestampMatch[6], 10);
             return new Date(year, month, day, hour, min, sec).getTime();
        }

        const dateMatch = cleanStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        
        if (dateMatch) {
            const day = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10) - 1;
            const year = parseInt(dateMatch[3], 10);
            return new Date(year, month, day).getTime();
        }
        
        const d = new Date(cleanStr);
        if (!isNaN(d.getTime())) return d.getTime();
        
        return 0;
    } catch (e) {
        return 0;
    }
  };
  
  // Helper to parse "dd-MM-yyyy" from history sheet columns
  const parseSheetDateStr = (val) => {
      if (val instanceof Date) return val;
      if (!val) return null;
      try {
          // Force string handling to avoid auto-conversion
          const strVal = String(val).replace(/^'/, '').trim();
          const match = strVal.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
          if (match) {
              // Group 1: Day, Group 2: Month, Group 3: Year
              return new Date(Number(match[3]), Number(match[2])-1, Number(match[1]));
          }
      } catch (e) {}
      return new Date(val);
  };

  // Serialize and merge history
  return filtered.map(p => {
    const obj = {};
    for (let key in p) {
      const value = p[key];
      if (value instanceof Date) {
        obj[key] = Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd-MM-yyyy');
      } else if (value === null || value === undefined) {
        obj[key] = '';
      } else {
        obj[key] = value;
      }
    }
    
    // Find latest history entry for this projection
    if (obj['Projection ID']) {
      const pId = String(obj['Projection ID']).trim();
      let latestHistory = null;
      let maxTime = -1;
      
      for (let i = 1; i < historyData.length; i++) {
        const rowId = String(historyData[i][projIdIdx]).trim();
        
        if (rowId === pId) {
          const actionDate = historyData[i][actionDateIdx];
          const time = parseActionTime(actionDate);
          
          // If time parsing fails (returns 0), we might still want to use it if it's the first match
          // But ideally we want the LATEST. 
          // If multiple have 0, we can't distinguish, but at least we find one.
          
          if (time > maxTime) {
            maxTime = time;
            latestHistory = historyData[i];
          } else if (time === 0 && maxTime === -1) {
             // First match, even if no valid time
             latestHistory = historyData[i];
             maxTime = 0;
          }
        }
      }
      
      if (latestHistory) {
        Logger.log('Found history for Projection ' + pId);
        
        const prevDateVal = latestHistory[prevDateIdx];
        const prevDateObj = parseSheetDateStr(prevDateVal);
        if (prevDateObj && !isNaN(prevDateObj.getTime())) {
             obj['Previous Projection Date'] = Utilities.formatDate(prevDateObj, Session.getScriptTimeZone(), 'dd-MM-yyyy');
        } else {
             obj['Previous Projection Date'] = prevDateVal;
        }
        
        obj['Previous Amount in USD'] = latestHistory[prevAmountIdx];
        
        let actionDateVal = '';
        if (actionDateIdx !== -1) {
             const rawActionDate = latestHistory[actionDateIdx];
             if (rawActionDate) {
                 // Check if it's a date object
                 if (rawActionDate instanceof Date) {
                     actionDateVal = Utilities.formatDate(rawActionDate, Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm:ss');
                 } else {
                     // If it's a string, try to keep it as is or format it
                     actionDateVal = String(rawActionDate).replace(/^'/, '');
                 }
             }
        }
        
        obj['Action Date'] = actionDateVal;
        // Also provide timestamp explicitly if needed
        obj['Action Timestamp'] = actionDateVal;
      } else {
         Logger.log('No history found for Projection ' + pId);
      }
    }
    
    return obj;
  });
}

function generateProjectionId() {
  const sheet = getSheet('Projections');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const projIdIdx = headers.indexOf('Projection ID');
  
  let maxId = 0;
  
  for (let i = 1; i < data.length; i++) {
    const id = data[i][projIdIdx];
    // Check if it's a number (or numeric string)
    if (id !== '' && !isNaN(id)) {
      const numId = Number(id);
      if (numId > maxId) maxId = numId;
    }
  }
  
  return maxId + 1;
}

function createProject(payload) {
  const project = payload.project;
  const projections = payload.projections || [];
  
  if (!project['Project ID']) {
    project['Project ID'] = getNextProjectId();
  }
  
  // Force Close Date to be text
  project['Close Date'] = ensureTextDate(project['Close Date']);

  // Map Amount/Value for robustness
  if (project['Amount'] !== undefined) project['Value'] = project['Amount'];
  else if (project['Value'] !== undefined) project['Amount'] = project['Value'];

  appendRow('Projects', project);
  
  if (projections.length > 0) {
    projections.forEach(p => {
      p['Project ID'] = project['Project ID'];
      p['Project Name'] = project['Project Name']; // Add Project Name to projection
      // Force sync: Ensure Amount in USD is set
      // Frontend now sends "Amount in USD" primarily
      if (p['Amount in USD'] === undefined) {
         p['Amount in USD'] = p['Amount'] !== undefined ? p['Amount'] : (p['Value'] || '');
      }
      // Sync back to Value/Amount for legacy compatibility if needed, but Amount in USD is truth
      p['Value'] = p['Amount in USD'];
      p['Amount'] = p['Amount in USD'];
      
      // Force Projection date to be text
      p['Projection date'] = ensureTextDate(p['Projection date']);
      
      // Assign new Projection ID
      p['Projection ID'] = generateProjectionId();
      
      appendRow('Projections', p);
    });
  }
  return { success: true, projectId: project['Project ID'] };
}

function updateProject(payload) {
  const project = payload.project;
  const projections = payload.projections || [];
  const deletedProjections = payload.deletedProjections || [];
  const userEmail = payload.userEmail || 'Unknown';
  
  // Force Close Date to be text
  project['Close Date'] = ensureTextDate(project['Close Date']);

  if (project['Amount'] !== undefined) project['Value'] = project['Amount'];
  else if (project['Value'] !== undefined) project['Amount'] = project['Value'];

  updateRow('Projects', 'Project ID', project['Project ID'], project);
  
  projections.forEach(p => {
    p['Project ID'] = project['Project ID'];
    p['Project Name'] = project['Project Name']; // Add Project Name to projection
    // Force sync: Ensure Amount in USD is set
    // Frontend now sends "Amount in USD" primarily
    if (p['Amount in USD'] === undefined) {
       p['Amount in USD'] = p['Amount'] !== undefined ? p['Amount'] : (p['Value'] || '');
    }
    // Sync back to Value/Amount for legacy compatibility if needed, but Amount in USD is truth
    p['Value'] = p['Amount in USD'];
    p['Amount'] = p['Amount in USD'];
    
    // Ensure ID exists
    if (!p['Projection ID']) {
      p['Projection ID'] = generateProjectionId();
    }
    
    upsertProjection(p, userEmail);
  });
  
  deletedProjections.forEach(p => {
    deleteProjection(project['Project ID'], p['Projection date']);
  });
  
  return { success: true };
}

function upsertProjection(projection, userEmail) {
  const sheet = getSheet('Projections');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Ensure headers exist (only core columns, no history columns in main sheet)
  const requiredHeaders = ['Projection ID', 'Project Name', 'Projection date', 'Amount in USD'];
  let headersChanged = false;
  requiredHeaders.forEach(h => {
    if (headers.indexOf(h) === -1) {
      headers.push(h);
      headersChanged = true;
    }
  });
  
  if (headersChanged) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const projIdIdx = headers.indexOf('Projection ID');
  // Handle both Amount and Value headers, prioritizing "Amount in USD"
  let amountIdx = headers.indexOf('Amount in USD');
  if (amountIdx === -1) amountIdx = headers.indexOf('Amount');
  if (amountIdx === -1) amountIdx = headers.indexOf('Value');
  
  const dateIdx = headers.indexOf('Projection date');
  
  let foundRow = -1;
  
  // STRICT LOOKUP: Try to find by Projection ID first
  if (projection['Projection ID']) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][projIdIdx] == projection['Projection ID']) {
        foundRow = i + 1;
        
        // Check for changes to track history
        const currentAmount = amountIdx !== -1 ? data[i][amountIdx] : '';
        const currentDate = formatDate(data[i][dateIdx]);
        
        // Normalize new amount (handle all amount keys)
        const newAmount = projection['Amount in USD'] !== undefined ? projection['Amount in USD'] : 
                         (projection['Amount'] !== undefined ? projection['Amount'] : 
                         (projection['Value'] !== undefined ? projection['Value'] : ''));
        
        // Ensure Amount in USD is set for row writing
        projection['Amount in USD'] = newAmount;
                         
        const newDate = projection['Projection date'];
        
        // Ensure we are comparing strings to avoid type mismatches
        // Use formatDate for date comparison to handle Date object vs String
        if (String(currentAmount) !== String(newAmount) || String(currentDate) !== formatDate(newDate)) {
          // Log to History Sheet
          logProjectionHistory({
            projectId: projection['Project ID'],
            projectionId: projection['Projection ID'],
            projectName: projection['Project Name'],
            prevDate: currentDate,
            prevAmount: currentAmount,
            newDate: formatDate(newDate),
            newAmount: newAmount,
            userEmail: userEmail
          });
          
          // NOTE: We no longer write history columns to the main Projections sheet
          // The frontend will get this data via getProjectionsByProjectId merging history
        }
        break;
      }
    }
  }
  
  // Fallback: Find by Project ID + Date ONLY if Projection ID is missing (Legacy Data)
  if (foundRow === -1 && !projection['Projection ID']) {
    const projectIdIdx = headers.indexOf('Project ID');
    for (let i = 1; i < data.length; i++) {
      if (data[i][projectIdIdx] == projection['Project ID'] && 
          formatDate(data[i][dateIdx]) === formatDate(projection['Projection date'])) {
        foundRow = i + 1;
        // Assign ID if missing
        projection['Projection ID'] = generateProjectionId();
        break;
      }
    }
  }
  
  if (foundRow > 0) {
    // Ensure Amount in USD is present before mapping
    if (projection['Amount in USD'] === undefined) {
       projection['Amount in USD'] = projection['Amount'] !== undefined ? projection['Amount'] : (projection['Value'] || '');
    }
    
    // FIX: Ensure date is stored as text
    projection['Projection date'] = ensureTextDate(projection['Projection date']);

    const rowData = headers.map(h => projection[String(h).trim()] === undefined ? '' : projection[String(h).trim()]);
    sheet.getRange(foundRow, 1, 1, headers.length).setValues([rowData]);
  } else {
    if (!projection['Projection ID']) projection['Projection ID'] = generateProjectionId();
    // Ensure Amount in USD is present before mapping
    if (projection['Amount in USD'] === undefined) {
       projection['Amount in USD'] = projection['Amount'] !== undefined ? projection['Amount'] : (projection['Value'] || '');
    }
    
    // FIX: Strictly parse incoming date for new rows too (if not caught above)
    // The above fix was inside the 'if (projection['Projection ID'])' block.
    // We need to ensure it's parsed for the fallback path too.
    projection['Projection date'] = ensureTextDate(projection['Projection date']);

    appendRow('Projections', projection);
  }
}

function parseStrictDate(val) {
  if (val instanceof Date) return val;
  if (!val) return null;
  try {
    // Remove potential ' prefix and trim
    const strVal = String(val).replace(/^'/, '').trim();
    const match = strVal.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (match) {
      // Enforce dd-mm-yyyy (Group 1: Day, Group 2: Month, Group 3: Year)
      return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    }
    // Fallback try standard parsing
    const d = new Date(strVal);
    if (!isNaN(d.getTime())) return d;
  } catch (e) {
    Logger.log('Error parsing strict date: ' + val + ' ' + e);
  }
  return null;
}

// Helper to strictly format date as 'dd-MM-yyyy text to prevent Sheet auto-formatting
function ensureTextDate(val) {
  if (!val) return '';
  // Use parseStrictDate to normalize first
  const d = parseStrictDate(val);
  
  if (d && !isNaN(d.getTime())) {
     return "'" + Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd-MM-yyyy');
  }
  return "'" + val; // Fallback: just prefix what we have
}

function logProjectionHistory(historyData) {
  const sheet = getSheet('ProjectionHistory');
  const data = sheet.getDataRange().getValues();
  
  let headers = [];
  if (data.length > 0) {
      headers = data[0];
  } else {
      // Default headers if empty
      headers = ['Project ID', 'Projection ID', 'Project Name', 'Projection date', 'Amount in USD', 'Previous Projection Date', 'Previous Amount in USD', 'Action Date'];
      sheet.appendRow(headers);
  }
  
  // Map data to headers order
  const row = headers.map(header => {
    const h = String(header).trim();
    // Normalize header check
    if (h === 'Project ID') return historyData.projectId;
    if (h === 'Projection ID') return historyData.projectionId;
    if (h === 'Project Name') return historyData.projectName;
    if (h === 'Projection date') return "'" + historyData.newDate; // Force string
    if (h === 'Amount in USD') return historyData.newAmount;
    if (h === 'Previous Projection Date' || h === 'Prev Date') return "'" + historyData.prevDate; // Force string
    if (h === 'Previous Amount in USD' || h === 'Prev Amount') return historyData.prevAmount;
    if (h === 'Action Date' || h === 'Action Timestamp') return "'" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm:ss') + ' ' + historyData.userEmail;
    return '';
  });
  
  sheet.appendRow(row);
}

function deleteProjection(projectId, date) {
  const sheet = getSheet('Projections');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const projectIdIdx = headers.indexOf('Project ID');
  const dateIdx = headers.indexOf('Projection date');
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][projectIdIdx] == projectId && 
        formatDate(data[i][dateIdx]) === date) {
      sheet.deleteRow(i + 1);
    }
  }
}

function formatDate(date) {
  if (!date) return '';
  // Use parseStrictDate to handle dd-mm-yyyy correctly
  const d = parseStrictDate(date);
  if (d && !isNaN(d.getTime())) {
      return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd-MM-yyyy');
  }
  return '';
}

// Simplified logo loading - returns null to use fallback, or you can embed base64 here
function getLogoImage() {
  try {
    const files = DriveApp.getFilesByName("pixoo-black-logo.png");
    if (files.hasNext()) {
      const file = files.next();
      return {
        data: Utilities.base64Encode(file.getBlob().getBytes()),
        mimeType: file.getMimeType()
      };
    }
  } catch (error) {
    Logger.log('Error loading logo: ' + error.toString());
  }
  return null;
}

// --- Client Code App Functions ---

function getClients() {
  return getSheetData('Clients');
}

function saveClient(payload) {
  // Save client with extended details to Clients sheet
  // Map payload keys to sheet header keys
  // Ensure we handle 'Additional Notes' specifically
  const clientData = {
    client_code: payload.client_code,
    client_name: payload.client_name,
    show_code: payload.show_code,
    project_name: payload.project_name,
    misc_info: payload.misc_info,
    region: payload.region,
    'client location': payload.client_location || payload.territory, // Handle both for now, prefer client_location
    country: payload.country,
    currency: payload.currency,
    source: payload.source,
    brand: payload.brand,
    repetition: payload.repetition || 'New',
    Year: payload.year,         // Capitalized as per user request
    Status: payload.status,     // As per user request
    'Additional Notes': payload.additional_notes || '', // Map to 'Additional Notes' column explicitly
    // New fields
    client_contact_mail: payload.client_contact_mail || '',
    finance_contact_mail: payload.finance_contact_mail || '',
    Address: payload.Address || ''
  };
  
  const sheet = getSheet('Clients');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const clientCodeIdx = headers.indexOf('client_code');
  const showCodeIdx = headers.indexOf('show_code');
  
  // Check if client+project combination exists
  let exists = false;
  let rowIndex = -1;

  if (clientCodeIdx !== -1 && showCodeIdx !== -1) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][clientCodeIdx] === payload.client_code && data[i][showCodeIdx] === payload.show_code) {
        exists = true;
        rowIndex = i + 1;
        break;
      }
    }
  }
  
  // Prepare row data mapping based on headers
  const row = headers.map(h => {
      const hStr = String(h).trim();
      const lowerH = hStr.toLowerCase();
      
      // Explicit Mapping Logic
      if (lowerH === 'client location' || lowerH === 'territory') return clientData['client location'];
      if (lowerH === 'year') return clientData['Year'];
      if (lowerH === 'status') return clientData['Status'];
      if (lowerH === 'additional notes') return clientData['Additional Notes'];
      
      // Explicit fuzzy matching for tricky columns
      if (lowerH.includes('finance') && lowerH.includes('contact')) return clientData.finance_contact_mail;
      if (lowerH.includes('client') && lowerH.includes('contact')) return clientData.client_contact_mail;
      if (lowerH === 'address') return clientData.Address;

      // Default fuzzy match
      if (clientData[hStr] !== undefined) return clientData[hStr];
      if (clientData[lowerH] !== undefined) return clientData[lowerH];
      
      // Preserve existing data if updating, otherwise empty
      return exists && rowIndex !== -1 ? data[rowIndex - 1][headers.indexOf(h)] : '';
  });

  if (exists && rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  
  return { success: true };
}

function getClientsWithProjectDetails() {
  const clients = getSheetData('Clients');
  // DEPRECATED: Client Code Projects sheet is no longer used. Data is now in Clients sheet.
  
  return clients.map(client => {
    // Helper to normalize keys
    const getVal = (obj, keys) => {
        for (const k of keys) {
            if (obj[k] !== undefined) return obj[k];
        }
        return '';
    };

    return {
      ...client,
      // Map directly from Client sheet columns
      client_contact_mail: getVal(client, ['client_contact_mail', 'Client Contact Mail', 'Client Contact Email']),
      finance_contact_mail: getVal(client, ['finance_contact_mail', 'Finance Contact Mail', 'Finance Contact Email']),
      Address: getVal(client, ['Address', 'address']),
      
      creation_mode: (client.repetition === 'Existing') ? 'Existing Client' : (client.repetition === 'Referral' ? 'Referral' : 'New Client'),
      client_location: getVal(client, ['client location', 'Client Location', 'territory', 'Territory']),
      year: getVal(client, ['Year', 'year']),
      status: getVal(client, ['Status', 'status'])
    };
  });
}

function getClientCodeProjects() {
  // Deprecated but kept for compatibility if needed, or redirect to new function
  return getClientsWithProjectDetails();
}

function saveClientCodeProject(payload) {
  // DEPRECATED: Data is now saved directly to Clients sheet via saveClient
  // This function is kept as a no-op for compatibility until fully removed
  return { success: true };
}

function getFinances() {
  return getSheetData('Finances');
}

function saveFinance(payload) {
  // Unique identifier: finance_id
  if (!payload.finance_id) {
    payload.finance_id = Utilities.getUuid();
  }
  
  const sheet = getSheet('Finances');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('finance_id');
  
  let exists = false;
  if (idIdx !== -1) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === payload.finance_id) {
        exists = true;
        break;
      }
    }
  }
  
  if (exists) {
    updateRow('Finances', 'finance_id', payload.finance_id, payload);
  } else {
    appendRow('Finances', payload);
  }
  
  return { success: true };
}

// Helper to get client names for dropdown
function getClientNames() {
  const clients = getSheetData('Clients');
  // Return unique client names
  const names = [...new Set(clients.map(c => c.client_name).filter(Boolean))];
  return names;
}

// Helper to get misc infos for a client
function getMiscInfos(clientName) {
  const clients = getSheetData('Clients');
  const filtered = clients.filter(c => c.client_name === clientName);
  const infos = [...new Set(filtered.map(c => c.misc_info).filter(Boolean))];
  return infos;
}

// Helper to normalize strings for comparison
function normalize(s) {
  return String(s || '').trim().toLowerCase();
}

// Helper to check if misc info matches (handling 0 vs 00)
function isMiscInfoMatch(val1, val2) {
  const n1 = normalize(val1);
  const n2 = normalize(val2);
  return n1 === n2 || (n1 === '0' && n2 === '00') || (n1 === '00' && n2 === '0');
}

// Helper to get client details for autofill
function getClientDetails(clientName, miscInfo) {
  const clients = getSheetData('Clients');
  const client = clients.find(c => 
    normalize(c.client_name) === normalize(clientName) && 
    isMiscInfoMatch(c.misc_info, miscInfo)
  );
  return client || {};
}

// Helper to get latest client details by name for autofill
function getClientDetailsByName(clientName) {
  const clients = getSheetData('Clients');
  // Find the most recent entry for this client name (assuming last entry is most recent)
  // We reverse the array to find the last occurrence efficiently
  const client = [...clients].reverse().find(c => c.client_name === clientName);
  return client || {};
}

// Helper to validate project
function validateProject(projectName, showCode) {
  // Use Clients sheet for validation now
  const projects = getSheetData('Clients');
  const errors = {};
  
  const nameExists = projects.some(p => String(p.project_name).trim().toLowerCase() === String(projectName).trim().toLowerCase());
  if (nameExists) errors.project_name = "Project Name already exists";
  
  const codeExists = projects.some(p => String(p.show_code).trim().toLowerCase() === String(showCode).trim().toLowerCase());
  if (codeExists) {
    errors.show_code = "Show Code already exists in database";
  } else {
    // Also check helper sheet
    const helperCodes = getHelperShowCodes();
    const helperExists = helperCodes.some(code => String(code).toLowerCase() === String(showCode).toLowerCase());
    if (helperExists) {
      errors.show_code = "Show Code already exists in helper list";
    }
  }
  
  return { errors };
}

// ============= CLIENT CODE GENERATION (XXX-RT-MI Format) =============

/**
 * Clean string - remove non-alphanumeric characters and uppercase
 */
function cleanString(s) {
  if (!s) return '';
  return String(s).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Get region character code
 * D = Domestic, I = International
 */
function getRegionChar(region) {
  if (!region) return 'X';
  const r = String(region).toLowerCase();
  if (r.includes('domestic')) return 'D';
  if (r.includes('international')) return 'I';
  // Fallback: first letter
  const cleaned = cleanString(region);
  return cleaned.length > 0 ? cleaned.charAt(0) : 'X';
}

/**
 * Get territory character code
 * W = Others, K = UK, U = USA, or first letter
 */
function getTerritoryChar(territory) {
  if (!territory) return 'X';
  const t = String(territory).toLowerCase();
  if (t.includes('others')) return 'W';
  if (t.includes('uk')) return 'K';
  if (t.includes('usa')) return 'U';
  // Fallback: first letter
  const cleaned = cleanString(territory);
  return cleaned.length > 0 ? cleaned.charAt(0) : 'X';
}

/**
 * Get 3 random letters from client name, preserving order
 * Example: "Kabilarasan" -> "KBL", "KBS", "KAA", etc.
 */
function getRandom3Letters(name) {
  if (!name) return 'XXX';
  const cleaned = cleanString(name);
  
  if (cleaned.length < 3) {
    // Pad with X if name is too short
    return (cleaned + 'XXX').substring(0, 3);
  }
  
  // Pick 3 random indices, sort them to preserve order
  const indices = [];
  const len = cleaned.length;
  
  // Generate 3 unique random indices
  while (indices.length < 3) {
    const randomIndex = Math.floor(Math.random() * len);
    if (!indices.includes(randomIndex)) {
      indices.push(randomIndex);
    }
  }
  
  // Sort indices to preserve character order
  indices.sort((a, b) => a - b);
  
  // Build the 3-letter code
  return indices.map(i => cleaned.charAt(i)).join('');
}

/**
 * Construct client code in XXX-RT-MI format
 * @param {string} slice3 - 3 random letters from client name
 * @param {string} region - Region (Domestic/International)
 * @param {string} territory - Territory (Others/UK/USA/etc.)
 * @param {string} miscInfo - Misc info (ID, TS, etc.)
 * @returns {string} - Formatted client code
 */
function constructClientCode(slice3, region, territory, miscInfo) {
  const rCode = getRegionChar(region);
  const tCode = getTerritoryChar(territory);
  
  // Misc info: clean it, default to XX if empty
  const mCode = miscInfo ? cleanString(miscInfo) : 'XX';
  
  // Format: XXX-RT-MI
  return `${slice3}-${rCode}${tCode}-${mCode}`;
}

/**
 * Generate unique client code, avoiding collisions
 * @param {string} clientName
 * @param {string} region
 * @param {string} territory
 * @param {string} miscInfo
 * @returns {string} - Unique client code
 */
function generateUniqueClientCode(clientName, region, territory, miscInfo) {
  const clients = getSheetData('Clients');
  
  // Rule 1: Reuse existing client code ONLY if ALL dependent fields match
  const existing = clients.find(c => 
    normalize(c.client_name) === normalize(clientName) &&
    isMiscInfoMatch(c.misc_info, miscInfo) &&
    normalize(c.region) === normalize(region) &&
    normalize(c.territory) === normalize(territory)
  );
  
  if (existing && existing.client_code) {
    return existing.client_code;
  }
  
  // Rule 2: Generate new code with random 3 letters
  // Try up to 50 times to find a unique random combination
  for (let attempt = 0; attempt < 50; attempt++) {
    const slice3 = getRandom3Letters(clientName);
    const code = constructClientCode(slice3, region, territory, miscInfo);
    
    // Check collision
    const collision = clients.find(c => c.client_code === code);
    if (!collision) {
      return code;
    }
  }
  
  // Fallback: Add numeric suffix if all random attempts collide
  const baseSlice = getRandom3Letters(clientName);
  const baseCode = constructClientCode(baseSlice, region, territory, miscInfo);
  
  let suffix = 1;
  while (true) {
    const code = `${baseCode}${suffix}`;
    const collision = clients.find(c => c.client_code === code);
    if (!collision) {
      return code;
    }
    suffix++;
  }
}

/**
 * Preview client code (for UI display before save)
 */
function previewClientCode(clientName, region, territory, miscInfo) {
  return generateUniqueClientCode(clientName, region, territory, miscInfo);
}

// --- Helper Functions ---

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
    Logger.log('getSheetData called for sheet: ' + name);
    const sheet = getSheet(name);
    
    if (!sheet) {
      Logger.log('ERROR: Sheet "' + name + '" not found!');
      return [];
    }
    
    const dataRange = sheet.getDataRange();
    if (!dataRange) {
      Logger.log('ERROR: No data range in sheet ' + name);
      return [];
    }
    
    const data = dataRange.getValues();
    Logger.log('Data rows in ' + name + ': ' + data.length);
    
    if (data.length < 2) {
      Logger.log('Sheet ' + name + ' has no data rows (only headers or empty)');
      return [];
    }
    
    const headers = data[0];
    Logger.log('Headers: ' + headers.join(', '));
    
    const rows = data.slice(1).map((row, index) => {
      const obj = {};
      headers.forEach((h, i) => {
        const key = String(h).trim();
        obj[key] = row[i];
      });
      return obj;
    });
    
    Logger.log('getSheetData for ' + name + ': returning ' + rows.length + ' rows');
    return rows;
  } catch (error) {
    Logger.log('ERROR in getSheetData for ' + name + ': ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return []; // Return empty array on error
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
  throw new Error(`Row with ${keyField}=${keyValue} not found`);
}

function getHeaders(sheet) {
  if (sheet.getLastRow() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function getHelperShowCodes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("showcode - helper check");
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  // Get column A (ShowCodes) starting from row 2
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  // Filter out empty strings and return flat array of trimmed values
  return values.flat().filter(code => code && String(code).trim() !== "").map(code => String(code).trim());
}

// Production page APIs
function getShowCodes() {
  const projects = getSheetData('Clients');
  // Extract unique show codes and sort alphabetically
  const showCodes = [...new Set(projects.map(p => p.show_code).filter(code => code && String(code).trim() !== ""))];
  return showCodes.sort();
}

function getProjectByShowCode(showCode) {
  // Now fetching directly from Clients sheet as it contains all info
  const clients = getSheetData('Clients');
  const project = clients.find(p => String(p.show_code).trim().toLowerCase() === String(showCode).trim().toLowerCase());
  
  if (!project) {
    return null;
  }
  
  // Return fields needed for production
  return {
    show_code: project.show_code,
    project_name: project.project_name, 
    client_code: project.client_code,
    source: project.source || 'N/A',
    brand: project.brand || 'N/A',
    region: project.region || 'N/A',
    territory: project['client location'] || project.territory || 'N/A', // Handle variations
    country: project.country || 'N/A',
    currency: project.currency || 'N/A'
  };
}

