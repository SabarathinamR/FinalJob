document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENT REFERENCES ---
    const form = document.getElementById('jobSheetForm');
    const part1Div = document.getElementById('part1');
    const part2Div = document.getElementById('part2');
    const submitPart1Btn = document.getElementById('submitPart1Btn');
    const submitFinalBtn = document.getElementById('submitFinalBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const dayInput = document.getElementById('day');
    const dateInput = document.getElementById('date');
    const jobSheetNoInput = document.getElementById('jobSheetNo');
    const contractNoInput = document.getElementById('contractNo');
    const teamNoInput = document.getElementById('teamNo');
    const workingShiftInput = document.getElementById('workingShift');
    const siteForemanSelect = document.getElementById('siteForeman');
    const recordedByInput = document.getElementById('recordedBy');
  
    const manpowerTableBody = document.getElementById('manpowerTableBody');
    const transferTableBody = document.getElementById('transferTableBody');
    const workDiaryTableBody = document.getElementById('workDiaryTableBody');
    const weatherTableBody = document.getElementById('weatherTableBody');
  
    const addManpowerBtn = document.getElementById('addManpowerBtn');
    const addTransferBtn = document.getElementById('addTransferBtn');
    const addWorkDiaryBtn = document.getElementById('addWorkDiaryBtn');
    const addWeatherBtn = document.getElementById('addWeatherBtn');
  
    const statusMessage = document.getElementById('statusMessage');
  
    const API_BASE_URL = 'http://localhost:3000/api';
    const STORAGE_KEY = 'activeJobSheetData';
    let currentTeamEmployees = []; 

    // --- HELPER FUNCTIONS ---
    function displayMessage(message, type = 'error') {
        statusMessage.textContent = message;
        statusMessage.className = type;
        statusMessage.style.display = 'block';
    }
  
    function updateJobSheetNo() {
        const contract = contractNoInput.value.trim().toUpperCase() || 'CONTRACT';
        const date = dateInput.value.replaceAll('-', '').substring(2);
        const team = teamNoInput.value.trim().toUpperCase() || 'TEAM';
        const shift = workingShiftInput.value.charAt(0).toUpperCase();
        jobSheetNoInput.value = `GT-${contract}-${date}-${team}-${shift}`;
    }
  
    function addRow(tableBody, rowHTML, data = {}) {
        const row = document.createElement('tr');
        row.innerHTML = rowHTML;
        for (const key in data) {
            const input = row.querySelector(`[name$='${key}']`);
            if (input) {
                input.value = data[key];
            }
        }
        tableBody.appendChild(row);
        updateSerialNumbers(tableBody);
    }
    
    function deleteRow(e) {
        if (e.target.classList.contains('delete-btn')) {
            const tbody = e.target.closest('tbody');
            e.target.closest('tr').remove();
            updateSerialNumbers(tbody);
        }
    }
  
    function updateSerialNumbers(tableBody) {
        const snoCells = tableBody.querySelectorAll('.sno');
        if (snoCells.length === 0) return;
        tableBody.querySelectorAll('tr').forEach((row, index) => {
            const snoCell = row.querySelector('.sno');
            if (snoCell) snoCell.textContent = index + 1;
        });
    }
  
    function getFormData() {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const getTableData = (tbody) => Array.from(tbody.querySelectorAll('tr')).map(row => {
            const rowData = {};
            row.querySelectorAll('input, select, textarea').forEach(input => {
                const key = input.name.split('_').pop();
                if(key) rowData[key] = input.value;
            });
            return rowData;
        });
        data.manpowerOnSite = getTableData(manpowerTableBody);
        data.manpowerTransfer = getTableData(transferTableBody);
        data.workDiaryEntries = getTableData(workDiaryTableBody);
        data.weatherConditionEntries = getTableData(weatherTableBody);
        return data;
    }
  
    function populateForm(data) {
        if (!data) return;
        for (const key in data) {
            if (form.elements[key]) {
                form.elements[key].value = data[key];
            }
        }
        const tableMappings = {
            manpowerOnSite: { body: manpowerTableBody, html: manpowerRowHTML },
            manpowerTransfer: { body: transferTableBody, html: transferRowHTML },
            workDiaryEntries: { body: workDiaryTableBody, html: workDiaryRowHTML },
            weatherConditionEntries: { body: weatherTableBody, html: weatherRowHTML },
        };
        for (const key in tableMappings) {
            const mapping = tableMappings[key];
            mapping.body.innerHTML = '';
            if (data[key] && Array.isArray(data[key])) {
                data[key].forEach(rowData => {
                    addRow(mapping.body, mapping.html, rowData);
                });
            }
        }
    }
  
    // --- STATE & WORKFLOW FUNCTIONS ---
  
    function transitionToPart2() {
        part1Div.querySelectorAll('input, select, button, textarea').forEach(el => el.disabled = true);
        part2Div.style.display = 'block';
        submitFinalBtn.disabled = false;
        submitFinalBtn.textContent = 'SUBMIT FINAL JOB SHEET';
        recordedByInput.value = siteForemanSelect.value;
    }
  
    function resetFullForm() {
        localStorage.removeItem(STORAGE_KEY);
        form.reset();
        [manpowerTableBody, transferTableBody, workDiaryTableBody, weatherTableBody].forEach(tbody => tbody.innerHTML = '');
        part1Div.querySelectorAll('input, select, button, textarea').forEach(el => el.disabled = false);
        submitPart1Btn.textContent = 'SUBMIT JOB SHEET & START WORK';
        part2Div.style.display = 'none';
        statusMessage.style.display = 'none';
        initializeNewForm();
    }
  
    function initializeNewForm() {
        const today = new Date();
        dateInput.value = today.toISOString().split('T')[0];
        dayInput.value = today.toLocaleDateString('en-US', { weekday: 'long' });
        updateJobSheetNo();
        siteForemanSelect.innerHTML = '<option value="">-- Select Team No First --</option>';
        manpowerTableBody.innerHTML = '';
    }
    
    // --- EVENT HANDLERS ---
  
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to log out?")) {
                window.location.href = '/api/logout';
            }
        });
    }

    teamNoInput.addEventListener('blur', async () => {
        const teamNo = teamNoInput.value.trim();
        siteForemanSelect.innerHTML = '<option value="">Loading...</option>';
        manpowerTableBody.innerHTML = '';
        currentTeamEmployees = [];

        if (!teamNo) {
            siteForemanSelect.innerHTML = '<option value="">-- Select Team No First --</option>';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/employees?team=${teamNo}`);
            if (!response.ok) {
                if(response.status === 401) window.location.href = '/login.html'; // Redirect if session expired
                throw new Error('Team not found or server error.');
            }
            currentTeamEmployees = await response.json();
            
            const foremen = currentTeamEmployees.filter(emp => emp.role === 'Foreman');
            
            siteForemanSelect.innerHTML = '<option value="">-- Select Foreman --</option>';
            if (foremen.length === 0) {
                 siteForemanSelect.innerHTML = '<option value="">-- No Foreman in this Team --</option>';
            } else {
                foremen.forEach(foreman => {
                    const option = document.createElement('option');
                    option.value = foreman.name;
                    option.textContent = `${foreman.name} (${foreman.empNo})`;
                    siteForemanSelect.appendChild(option);
                });
            }

        } catch (error) {
            console.error('Failed to fetch team data:', error);
            siteForemanSelect.innerHTML = '<option value="">-- Error Loading Team --</option>';
        }
    });

    siteForemanSelect.addEventListener('change', () => {
        manpowerTableBody.innerHTML = '';
        const selectedForemanName = siteForemanSelect.value;

        if (!selectedForemanName) return;

        const foremanData = currentTeamEmployees.find(emp => emp.name === selectedForemanName);
        const workers = currentTeamEmployees.filter(emp => emp.role === 'Worker');
        
        if (foremanData) {
            addRow(manpowerTableBody, manpowerRowHTML, { empNo: foremanData.empNo, name: foremanData.name });
        }

        workers.forEach(worker => {
            addRow(manpowerTableBody, manpowerRowHTML, { empNo: worker.empNo, name: worker.name });
        });
    });

    submitPart1Btn.addEventListener('click', async () => {
        if (!form.checkValidity()) {
            displayMessage('Please fill all required fields in Part 1.');
            form.reportValidity();
            return;
        }
        submitPart1Btn.disabled = true;
        submitPart1Btn.textContent = 'Submitting...';
        const part1Data = getFormData();
        try {
            const response = await fetch(`${API_BASE_URL}/jobsheet/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(part1Data)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Submission failed.');
            
            const stateToSave = {
                jobSheetId: result.jobSheetId,
                formData: part1Data // This is the complete data from Part 1
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  
            transitionToPart2();
            displayMessage('Part 1 submitted successfully. Please complete Part 2.', 'success');
            
        } catch (error) {
            displayMessage(error.message);
            submitPart1Btn.disabled = false;
            submitPart1Btn.textContent = 'SUBMIT JOB SHEET & START WORK';
        }
    });
  
    async function handleFinalSubmission() {
        if (!confirm("Are you sure you want to submit the final job sheet? This action cannot be undone.")) {
            return;
        }
        submitFinalBtn.disabled = true;
        submitFinalBtn.textContent = 'Submitting...';
  
        const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (!state || !state.jobSheetId) {
            displayMessage("Error: No active job sheet found to submit.");
            submitFinalBtn.disabled = false;
            submitFinalBtn.textContent = 'SUBMIT FINAL JOB SHEET';
            return;
        }
        
        // --- START OF FIX ---
        // Get data from the currently enabled fields (Part 2)
        const part2Data = getFormData();
        
        // Combine the saved Part 1 data with the new Part 2 data
        const finalData = { ...state.formData, ...part2Data };
        finalData.jobSheetId = state.jobSheetId;
        // --- END OF FIX ---
  
        try {
            const response = await fetch(`${API_BASE_URL}/jobsheet/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalData) // Send the complete, merged data
            });
            
            if (!response.ok) {
                 const errorResult = await response.json();
                 throw new Error(errorResult.message || 'Final submission failed.');
            }
  
            const blob = await response.blob();
            const disposition = response.headers.get('content-disposition');
            let filename = 'JobSheet.pdf';
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                  filename = matches[1].replace(/['"]/g, '');
                }
            }
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            displayMessage('Form submitted successfully! A new form has been generated.', 'success');
            resetFullForm();
  
        } catch (error) {
            displayMessage(error.message);
            submitFinalBtn.disabled = false;
            submitFinalBtn.textContent = 'SUBMIT FINAL JOB SHEET';
        }
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleFinalSubmission();
    });
  
    // --- DYNAMIC ROW SETUP ---
    const manpowerRowHTML = `<td><input type="text" name="manpower_empNo" readonly></td><td><input type="text" name="manpower_name" readonly></td><td><input type="time" name="manpower_timeFrom"></td><td><input type="time" name="manpower_timeTo"></td><td><input type="text" name="manpower_signature"></td><td><input type="text" name="manpower_remarks"></td><td><button type="button" class="delete-btn">X</button></td>`;
    const transferRowHTML = `<td><input type="text" name="transfer_empNo"></td><td><input type="text" name="transfer_workerName"></td><td><input type="text" name="transfer_fromTeam"></td><td><input type="text" name="transfer_toTeam"></td><td><input type="text" name="transfer_signature"></td><td><input type="text" name="transfer_reason"></td><td><button type="button" class="delete-btn">X</button></td>`;
    const workDiaryRowHTML = `<td class="sno"></td><td><input type="text" name="work_location"></td><td><input type="text" name="work_typeOfWork"></td><td><input type="time" name="work_timeStart"></td><td><input type="time" name="work_timeEnd"></td><td><input type="text" name="work_pqNo"></td><td><input type="number" name="work_qty"></td><td><select name="work_unit"><option>pcs</option><option>m</option><option>m2</option><option>m3</option></select></td><td><button type="button" class="delete-btn">X</button></td>`;
    const weatherRowHTML = `<td class="sno"></td><td><input type="text" name="weather_location"></td><td><input type="text" name="weather_affectedWork"></td><td><input type="time" name="weather_timeStart"></td><td><input type="time" name="weather_timeEnd"></td><td><input type="text" name="weather_condition"></td><td><input type="text" name="weather_remarks"></td><td><button type="button" class="delete-btn">X</button></td>`;
  
    addManpowerBtn.addEventListener('click', () => addRow(manpowerTableBody, manpowerRowHTML));
    addTransferBtn.addEventListener('click', () => addRow(transferTableBody, transferRowHTML));
    addWorkDiaryBtn.addEventListener('click', () => addRow(workDiaryTableBody, workDiaryRowHTML));
    addWeatherBtn.addEventListener('click', () => addRow(weatherTableBody, weatherRowHTML));
    
    [manpowerTableBody, transferTableBody, workDiaryTableBody, weatherTableBody].forEach(tbody => tbody.addEventListener('click', deleteRow));
    [contractNoInput, dateInput, teamNoInput, workingShiftInput].forEach(input => input.addEventListener('input', updateJobSheetNo));
  
    // --- INITIALIZATION ON PAGE LOAD ---
    const savedStateJSON = localStorage.getItem(STORAGE_KEY);
    if (savedStateJSON) {
        const savedState = JSON.parse(savedStateJSON);
        displayMessage('Resumed active session. Please complete the form.', 'info');
        populateForm(savedState.formData);
        transitionToPart2();
    } else {
        initializeNewForm();
    }
});