document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT REFERENCES ---
    const form = document.getElementById('pmEditForm');
    const jobIdInput = document.getElementById('jobId');
    const statusMessage = document.getElementById('statusMessage');
    const manpowerTableBody = document.getElementById('manpowerTableBody');
    const transferTableBody = document.getElementById('transferTableBody');
    const workDiaryTableBody = document.getElementById('workDiaryTableBody');
    const weatherTableBody = document.getElementById('weatherTableBody');
    const addManpowerBtn = document.getElementById('addManpowerBtn');
    const addTransferBtn = document.getElementById('addTransferBtn');
    const addWorkDiaryBtn = document.getElementById('addWorkDiaryBtn');
    const addWeatherBtn = document.getElementById('addWeatherBtn');

    // --- ROW HTML TEMPLATES ---
    const manpowerRowHTML = `<td><input type="text" name="manpower_empNo"></td><td><input type="text" name="manpower_name"></td><td><input type="time" name="manpower_timeFrom"></td><td><input type="time" name="manpower_timeTo"></td><td><input type="text" name="manpower_signature"></td><td><input type="text" name="manpower_remarks"></td><td><button type="button" class="delete-btn">X</button></td>`;
    const transferRowHTML = `<td><input type="text" name="transfer_empNo"></td><td><input type="text" name="transfer_workerName"></td><td><input type="text" name="transfer_fromTeam"></td><td><input type="text" name="transfer_toTeam"></td><td><input type="text" name="transfer_signature"></td><td><input type="text" name="transfer_reason"></td><td><button type="button" class="delete-btn">X</button></td>`;
    const workDiaryRowHTML = `<td class="sno"></td><td><input type="text" name="work_location"></td><td><input type="text" name="work_typeOfWork"></td><td><input type="time" name="work_timeStart"></td><td><input type="time" name="work_timeEnd"></td><td><input type="text" name="work_pqNo"></td><td><input type="number" name="work_qty"></td><td><select name="work_unit"><option>pcs</option><option>m</option><option>m2</option><option>m3</option></select></td><td><button type="button" class="delete-btn">X</button></td>`;
    const weatherRowHTML = `<td class="sno"></td><td><input type="text" name="weather_location"></td><td><input type="text" name="weather_affectedWork"></td><td><input type="time" name="weather_timeStart"></td><td><input type="time" name="weather_timeEnd"></td><td><input type="text" name="weather_condition"></td><td><input type="text" name="weather_remarks"></td><td><button type="button" class="delete-btn">X</button></td>`;
    
    // --- STATE VARIABLE ---
    let pollingInterval;

    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('jobId');

    if (!jobId) {
        displayMessage('Error: No Job ID provided.', 'error');
        form.style.display = 'none';
        return;
    }
    jobIdInput.value = jobId;

    // --- HELPER FUNCTIONS ---
    function displayMessage(message, type = 'info') {
      statusMessage.textContent = message;
      statusMessage.className = type;
      statusMessage.style.display = 'block';
    }

    function addRow(tableBody, rowHTML, data = {}) {
        const row = document.createElement('tr');
        row.innerHTML = rowHTML;
        for (const key in data) {
            const input = row.querySelector(`[name$='_${key}']`);
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
    
    // --- DATA POPULATION ---
    function populateForm(data) {
        if (!data) return;
        
        const activeElement = document.activeElement;
        const activeElementName = activeElement ? activeElement.name : null;
        const scrollPosition = { x: window.scrollX, y: window.scrollY };

        for (const key in data) {
            const element = form.elements[key];
            if (element && element.type !== 'hidden') {
                if (document.activeElement !== element) {
                    if (element.type === 'date' && data[key]) {
                        element.value = new Date(data[key]).toISOString().split('T')[0];
                    } else {
                        element.value = data[key] || '';
                    }
                }
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
            // Only redraw table if not currently focused within it
            if (!mapping.body.contains(document.activeElement)) {
                mapping.body.innerHTML = '';
                if (data[key] && Array.isArray(data[key])) {
                    data[key].forEach(rowData => addRow(mapping.body, mapping.html, rowData));
                }
            }
        }
        
        if (activeElementName) {
            const elementToFocus = form.elements[activeElementName];
            if (elementToFocus) {
                elementToFocus.focus();
                if (['text', 'textarea', 'number', 'time', 'date'].includes(elementToFocus.type)) {
                    elementToFocus.setSelectionRange(elementToFocus.value.length, elementToFocus.value.length);
                }
            }
        }
        window.scrollTo(scrollPosition.x, scrollPosition.y);
    }

    // --- ASYNC OPERATIONS & POLLING ---
    async function fetchAndPopulate() {
        try {
            const response = await fetch(`/api/jobsheet/${jobId}`);
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || `Server responded with ${response.status}`);
            }
            const data = await response.json();
            
            if (data.status !== 'Pending PM Approval') {
                clearInterval(pollingInterval);
                displayMessage(`This job is now '${data.status}' and can no longer be edited.`, 'info');
                form.querySelectorAll('input, select, textarea, button').forEach(el => el.disabled = true);
            }
            
            // If we get here, the data is valid, so show the form if it was hidden
            form.style.display = '';
            populateForm(data);

        } catch (error) {
            clearInterval(pollingInterval);
            displayMessage(`Failed to load job sheet data: ${error.message}. Please ensure the Job ID is correct and the server is running.`, 'error');
            form.style.display = 'none';
        }
    }

    // --- PAGE INITIALIZATION LOGIC ---
    fetchAndPopulate();
    pollingInterval = setInterval(fetchAndPopulate, 10000);

    // --- EVENT LISTENERS ---
    addManpowerBtn.addEventListener('click', () => addRow(manpowerTableBody, manpowerRowHTML));
    addTransferBtn.addEventListener('click', () => addRow(transferTableBody, transferRowHTML));
    addWorkDiaryBtn.addEventListener('click', () => addRow(workDiaryTableBody, workDiaryRowHTML));
    addWeatherBtn.addEventListener('click', () => addRow(weatherTableBody, weatherRowHTML));

    [manpowerTableBody, transferTableBody, workDiaryTableBody, weatherTableBody].forEach(tbody => {
        tbody.addEventListener('click', deleteRow);
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        clearInterval(pollingInterval);

        const button = this.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = 'Submitting...';

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

        fetch('/api/pm/approve-and-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                displayMessage(result.message, 'success');
                form.innerHTML = `<h1>${result.message}</h1><p>You may close this window.</p>`;
            } else {
                throw new Error(result.message);
            }
        })
        .catch(error => {
            displayMessage(`Submission Failed: ${error.message}`, 'error');
            button.disabled = false;
            button.textContent = 'APPROVE & SUBMIT FINAL TO HR';
            pollingInterval = setInterval(fetchAndPopulate, 10000); // Restart polling on failure
        });
    });
});