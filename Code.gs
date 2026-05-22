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
    const isAdmin = ADMIN_EMAILS.includes(normalizedEmail);
    return { 
      email: user['Email'], 
      name: user['User Name'], 
      isAdmin: isAdmin,
      success: true
    };
  }
  return { success: false, error: 'Invalid credentials' };
}

function getDashboardProjects(email, isAdmin) {
  try {
    Logger.log('getDashboardProjects called with email: ' + email + ', isAdmin: ' + isAdmin);
    
    const projects = getSheetData('Projects');
    Logger.log('Total projects found: ' + projects.length);
    
    if (!projects || projects.length === 0) {
      Logger.log('No projects found in sheet, returning empty array');
      return [];
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
    } else {
      Logger.log('User is admin, returning all ' + projects.length + ' projects');
    }
    
    // Ensure all data is JSON-serializable (convert Dates to strings)
    const serialized = result.map(p => {
      const obj = {};
      for (let key in p) {
        const value = p[key];
        if (value instanceof Date) {
          obj[key] = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (value === null || value === undefined) {
          obj[key] = '';
        } else {
          obj[key] = value;
        }
      }
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
    if (value instanceof Date) {
      serialized[key] = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else if (value === null || value === undefined) {
      serialized[key] = '';
    } else {
      serialized[key] = value;
    }
  }
  return serialized;
}

function getProjectionsByProjectId(projectId) {
  const projections = getSheetData('Projections');
  const filtered = projections.filter(p => p['Project ID'] == projectId);
  
  // Serialize
  return filtered.map(p => {
    const obj = {};
    for (let key in p) {
      const value = p[key];
      if (value instanceof Date) {
        obj[key] = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else if (value === null || value === undefined) {
        obj[key] = '';
      } else {
        obj[key] = value;
      }
    }
    return obj;
  });
}

function createProject(payload) {
  const project = payload.project;
  const projections = payload.projections || [];
  
  if (!project['Project ID']) {
    project['Project ID'] = getNextProjectId();
  }
  
  // Map Amount/Value for robustness
  if (project['Amount'] !== undefined && project['Value'] === undefined) project['Value'] = project['Amount'];
  if (project['Value'] !== undefined && project['Amount'] === undefined) project['Amount'] = project['Value'];

  appendRow('Projects', project);
  
  if (projections.length > 0) {
    projections.forEach(p => {
      p['Project ID'] = project['Project ID'];
      p['Project Name'] = project['Project Name']; // Add Project Name to projection
      if (p['Amount'] !== undefined && p['Value'] === undefined) p['Value'] = p['Amount'];
      if (p['Value'] !== undefined && p['Amount'] === undefined) p['Amount'] = p['Value'];
      appendRow('Projections', p);
    });
  }
  return { success: true, projectId: project['Project ID'] };
}

function updateProject(payload) {
  const project = payload.project;
  const projections = payload.projections || [];
  const deletedProjections = payload.deletedProjections || [];
  
  if (project['Amount'] !== undefined && project['Value'] === undefined) project['Value'] = project['Amount'];
  if (project['Value'] !== undefined && project['Amount'] === undefined) project['Amount'] = project['Value'];

  updateRow('Projects', 'Project ID', project['Project ID'], project);
  
  projections.forEach(p => {
    p['Project ID'] = project['Project ID'];
    p['Project Name'] = project['Project Name']; // Add Project Name to projection
    if (p['Amount'] !== undefined && p['Value'] === undefined) p['Value'] = p['Amount'];
    if (p['Value'] !== undefined && p['Amount'] === undefined) p['Amount'] = p['Value'];
    upsertProjection(p);
  });
  
  deletedProjections.forEach(p => {
    deleteProjection(project['Project ID'], p['Projection date']);
  });
  
  return { success: true };
}

function upsertProjection(projection) {
  const sheet = getSheet('Projections');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const projectIdIdx = headers.indexOf('Project ID');
  const dateIdx = headers.indexOf('Projection date');
  
  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][projectIdIdx] == projection['Project ID'] && 
        formatDate(data[i][dateIdx]) === projection['Projection date']) {
      foundRow = i + 1;
      break;
    }
  }
  
  if (foundRow > 0) {
    const rowData = headers.map(h => projection[String(h).trim()] || '');
    sheet.getRange(foundRow, 1, 1, headers.length).setValues([rowData]);
  } else {
    appendRow('Projections', projection);
  }
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
  if (typeof date === 'string') return date;
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
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

