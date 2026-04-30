const isGAS = typeof google !== 'undefined' && google.script && google.script.run;

const serverFunctions = [
    'getUserEmailAndRole',
    'getDashboardProjects',
    'getAllowedProjects',
    'getProjectById',
    'getProjectionsByProjectId',
    'createProject',
    'updateProject',
    'login',
    'getLogoImage',
    'approveProjectionUpdate',
    // New functions for RBAC & Modules
    'getClients',
    'saveClient',
    'getClientCodeProjects',
    'saveClientCodeProject',
    'getFinances',
    'saveFinance',
    'getClientNames',
    'getMiscInfos',
    'getClientDetails',
    'validateProject',
    'previewClientCode',
    'getClientDetailsByName',
    'getHelperShowCodes',
    'getShowCodes',
    'getProjectByShowCode',
    'getProductionProjects',
    'saveBillableDetails'
];


const api = {};

serverFunctions.forEach(funcName => {
    api[funcName] = (...args) => {
        return new Promise((resolve, reject) => {
            if (!isGAS) {
                console.log(`[Mock API] Calling ${funcName} with`, args);
                // Mock responses for local dev
                if (funcName === 'getUserEmailAndRole') {
                    resolve({ email: 'test@example.com', isAdmin: true });
                } else if (funcName === 'login') {
                    if (args[0] === 'test@example.com' && args[1] === 'password') {
                        resolve({ email: 'test@example.com', name: 'Test User', isAdmin: true, success: true });
                    } else {
                        resolve({ success: false, error: 'Invalid credentials' });
                    }
                } else if (funcName === 'getDashboardProjects') {
                    resolve([]);
                } else if (funcName === 'getAllowedProjects') {
                    resolve([]);
                } else if (funcName === 'getProjectById') {
                    resolve(null);
                } else if (funcName === 'getProjectionsByProjectId') {
                    resolve([]);
                } else if (funcName === 'createProject' || funcName === 'updateProject') {
                    resolve({ success: true });
                } else if (funcName === 'getHelperShowCodes') {
                    resolve(['MOCK1', 'MOCK2']);
                } else if (funcName === 'getShowCodes') {
                    resolve(['SHOW1', 'SHOW2', 'SHOW3']);
                } else if (funcName === 'getProjectByShowCode') {
                    resolve({ show_code: 'SHOW1', client_code: 'CLI-01', source: 'EP', brand: 'PFX', region: 'International', territory: 'USA', country: 'USA', currency: 'USD' });
                } else if (funcName === 'getProductionProjects') {
                    resolve([
                        {
                            Deal_id: 'D-001',
                            Block_id: 'B-001',
                            Region: 'NA',
                            Contracting_Office: 'NY',
                            DealName: 'Project Alpha',
                            Block_Name: 'Phase 1',
                            deal_stage: 'Closed Won',
                            Block_Stage: 'Active',
                            Close_Date: '2026-04-15',
                            Home_Amount: 100000,
                            Home_Currency: 'USD',
                            Amount_in_USD: 100000,
                            Type: 'New Business',
                            Status: 'In Progress',
                            Approved_to_Finance: 'Yes',
                            'Approved by': 'Admin',
                            billables: [
                                { Billable_date: '2026-04-20', Amount_in_USD: 50000, Amount_in_Inr: 4000000, Bin_Number: 'Bin 1' },
                                { Billable_date: '2026-05-15', Amount_in_USD: 50000, Amount_in_Inr: 4000000, Bin_Number: 'Bin 2' }
                            ]
                        },
                        {
                            Deal_id: 'D-002',
                            Block_id: 'B-002',
                            Region: 'EU',
                            Contracting_Office: 'LDN',
                            DealName: 'Project Beta',
                            Block_Name: 'Phase 1',
                            deal_stage: 'Closed Won',
                            Block_Stage: 'Active',
                            Close_Date: '2026-03-10',
                            Home_Amount: 80000,
                            Home_Currency: 'EUR',
                            Amount_in_USD: 85000,
                            Type: 'Renewal',
                            Status: 'Completed',
                            Approved_to_Finance: 'Yes',
                            'Approved by': 'Admin',
                            billables: [
                                { Billable_date: '2026-03-15', Amount_in_USD: 85000, Amount_in_Inr: 6800000, Bin_Number: 'Bin 1' }
                            ]
                        }
                    ]);
                } else {
                    resolve(null);
                }
                return;
            }

            google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
            [funcName](...args);
        });
    };
});

export default api;
