

// =================================================================
//                           IMPORTS
// =================================================================
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
require('dotenv').config();
const mysql = require('mysql2/promise');
const path = require('path');
const session = require('express-session');

// =================================================================
//                 APP INITIALIZATION & CONFIGURATION
// =================================================================
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));

// =================================================================
//                      MySQL CONNECTION POOL
// =================================================================
const dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

dbPool.getConnection()
    .then(connection => {
        console.log('Successfully connected to the MySQL database.');
        connection.release();
    })
    .catch(err => {
        console.error('FATAL: Failed to connect to the MySQL database.', err);
        process.exit(1);
    });

// =================================================================
//               PDF, EMAIL & DATA HELPER FUNCTIONS
// =================================================================

function parseJsonField(field) { if (typeof field === 'string') { try { return JSON.parse(field); } catch (e) { return []; } } return field || []; }
const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS } });
async function sendEmail(options) { console.log(`--- Preparing to send email to: ${options.to} ---`); try { await transporter.sendMail(options); console.log(`Email sent successfully!`); } catch (error) { console.error(`--- FAILED TO SEND EMAIL ---`, error); } }
const formatTime = (time) => { if (!time || typeof time !== 'string') return '--:--'; const parts = time.split(':'); if (parts.length < 2) return '--:--'; let [hour24, minute] = parts; if (!hour24 || !minute) return '--:--'; let h = parseInt(hour24, 10); const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12; h = h ? h : 12; const hour12 = String(h).padStart(2, '0'); return `${hour12}:${minute} ${ampm}`; };
const formatDate = (dateString) => { if (!dateString) return ''; const date = new Date(`${dateString}T00:00:00`); if (isNaN(date.getTime())) return ''; const day = String(date.getDate()).padStart(2, '0'); const month = String(date.getMonth() + 1).padStart(2, '0'); const year = date.getFullYear(); return `${day}/${month}/${year}`; };


// --- MODIFIED SECTION START ---
// This function is now updated to be a complete Part 1 template.
function generatePart1EmailHTML(data) {
    const styles = ` body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f9; color: #333; -webkit-font-smoothing: antialiased; } .wrapper { width: 100%; table-layout: fixed; background-color: #f4f4f9; padding: 20px 0; } .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 800px; border-spacing: 0; border-radius: 8px; border: 1px solid #ddd; } .header { background-color: #34495e; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; } .header h1 { font-size: 24px; color: #ffffff; margin: 0; } .content { padding: 20px; } .section-title { font-size: 18px; color: #34495e; border-bottom: 2px solid #eee; padding-bottom: 5px; margin: 20px 0; } .info-table, .data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; } .info-table td { padding: 10px; border: 1px solid #eee; } .info-table td.label { font-weight: bold; width: 35%; color: #555; background-color: #f9f9f9; } .data-table th, .data-table td { padding: 10px; border: 1px solid #ddd; text-align: left; font-size: 14px; } .data-table th { background-color: #f2f2f2; font-weight: bold; } `;
    
    // This is the more robust table generator from the full email template.
    const generateDataTableHTML = (title, headers, rows) => {
        if (!rows || rows.length === 0) return '';
        let tableHTML = `<h3 class="section-title">${title}</h3><table class="data-table" cellpadding="0" cellspacing="0"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
        rows.forEach(row => {
            tableHTML += `<tr>${headers.map(h => {
                const key = Object.keys(row).find(k => k.toLowerCase() === h.toLowerCase().replace(/[^a-z0-9]/gi, '')) || h.toLowerCase().replace(/[^a-z0-9]/gi, '');
                let value = row[key] || '';
                // Format time values if the header suggests it's a time field
                if (h.toLowerCase().includes('time') && value.includes(':')) {
                    value = formatTime(value);
                }
                return `<td>${value}</td>`;
            }).join('')}</tr>`;
        });
        tableHTML += '</tbody></table>';
        return tableHTML;
    };
    
    return `
    <!DOCTYPE html><html><head><style>${styles}</style></head>
    <body><center class="wrapper">
    <table class="main" width="100%">
        <tr><td class="header"><h1>Job Sheet Started (Notification)</h1></td></tr>
        <tr><td class="content">
            <p>This is a notification that a new job has been started by the foreman. You will receive a separate email for final approval once the job is completed.</p>
            <h3 class="section-title">Job Details</h3>
            <table class="info-table">
                <tr><td class="label">Job Sheet No:</td><td>${data.jobSheetNo || ''}</td></tr>
                <tr><td class="label">Date:</td><td>${formatDate(data.date)}</td></tr>
                <tr><td class="label">Day:</td><td>${data.day || ''}</td></tr>
                <tr><td class="label">Contract No:</td><td>${data.contractNo || ''}</td></tr>
                <tr><td class="label">Team No:</td><td>${data.teamNo || ''}</td></tr>
                <tr><td class="label">Working Shift:</td><td>${data.workingShift || ''}</td></tr>
                <tr><td class="label">Site Foreman:</td><td>${data.siteForeman || ''}</td></tr>
                <tr><td class="label">Working Time:</td><td>${formatTime(data.workingTimeFrom)} to ${formatTime(data.workingTimeTo)}</td></tr>
                <tr><td class="label">TMWP/LC VEH NO:</td><td>${data.tmwpLcVehNo || ''}</td></tr>
                <tr><td class="label">Lorry VEH NO:</td><td>${data.lorryVehNo || ''}</td></tr>
                <tr><td class="label">NO. OF TMA:</td><td>${data.noOfTma || ''}</td></tr>
            </table>
            ${generateDataTableHTML('Manpower On Site', ['EMP No', 'Name', 'Time From', 'Time To', 'Signature', 'Remarks'], data.manpowerOnSite)}
            ${generateDataTableHTML('Manpower Transfer', ['EMP No', 'Worker Name', 'From Team', 'To Team', 'Signature', 'Reason'], data.manpowerTransfer)}
        </td></tr>
    </table>
    </center></body></html>`;
}
// --- MODIFIED SECTION END ---


function generateFullFormEmailHTML(data, approvalLink) { const styles = ` body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f9; color: #333; -webkit-font-smoothing: antialiased; } .wrapper { width: 100%; table-layout: fixed; background-color: #f4f4f9; padding: 20px 0; } .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 800px; border-spacing: 0; border-radius: 8px; border: 1px solid #ddd; } .header { background-color: #34495e; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; } .header h1 { font-size: 24px; color: #ffffff; margin: 0; } .content { padding: 20px; } .section-title { font-size: 18px; color: #34495e; border-bottom: 2px solid #eee; padding-bottom: 5px; margin: 20px 0; } .info-table, .data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; } .info-table td { padding: 10px; border: 1px solid #eee; } .info-table td.label { font-weight: bold; width: 35%; color: #555; background-color: #f9f9f9; } .data-table th, .data-table td { padding: 10px; border: 1px solid #ddd; text-align: left; font-size: 14px; } .data-table th { background-color: #f2f2f2; font-weight: bold; } .description { padding:10px; background-color:#fdfdfd; border-left:4px solid #eee; margin-bottom: 20px; white-space: pre-wrap; } .button-container { text-align: center; padding: 20px 0; } .button { display: inline-block; background-color: #27ae60; color: #ffffff !important; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; } `; const generateDataTableHTML = (title, headers, rows) => { if (!rows || rows.length === 0) return ''; let tableHTML = `<h3 class="section-title">${title}</h3><table class="data-table" cellpadding="0" cellspacing="0"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`; rows.forEach(row => { tableHTML += `<tr>${headers.map(h => { const key = Object.keys(row).find(k => k.toLowerCase() === h.toLowerCase().replace(/[^a-z0-9]/gi, '')) || h.toLowerCase().replace(/[^a-z0-9]/gi, ''); return `<td>${row[key] || ''}</td>`; }).join('')}</tr>`; }); tableHTML += '</tbody></table>'; return tableHTML; }; return ` <!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${styles}</style></head> <body><center class="wrapper"> <table class="main" width="100%"> <tr><td class="header"><h1>Job Sheet Details</h1></td></tr> <tr><td class="content"> <p>A job sheet requires your attention.</p> <h3 class="section-title">Job Details</h3> <table class="info-table"> <tr><td class="label">Job Sheet No:</td><td>${data.jobSheetNo || ''}</td></tr> <tr><td class="label">Date:</td><td>${formatDate(data.date)}</td></tr> <tr><td class="label">Day:</td><td>${data.day || ''}</td></tr> <tr><td class="label">Contract No:</td><td>${data.contractNo || ''}</td></tr> <tr><td class="label">Team No:</td><td>${data.teamNo || ''}</td></tr> <tr><td class="label">Working Shift:</td><td>${data.workingShift || ''}</td></tr> <tr><td class="label">Site Foreman:</td><td>${data.siteForeman || ''}</td></tr> <tr><td class="label">Working Time:</td><td>${formatTime(data.workingTimeFrom)} to ${formatTime(data.workingTimeTo)}</td></tr> <tr><td class="label">TMWP/LC VEH NO:</td><td>${data.tmwpLcVehNo || ''}</td></tr> <tr><td class="label">Lorry VEH NO:</td><td>${data.lorryVehNo || ''}</td></tr> <tr><td class="label">NO. OF TMA:</td><td>${data.noOfTma || ''}</td></tr> </table> ${generateDataTableHTML('Manpower On Site', ['EMP No', 'Name', 'Time From', 'Time To', 'Signature', 'Remarks'], data.manpowerOnSite)} ${generateDataTableHTML('Manpower Transfer', ['EMP No', 'Worker Name', 'From Team', 'To Team', 'Signature', 'Reason'], data.manpowerTransfer)} <h3 class="section-title">Work Diary</h3> <p class="description">${data.workDiaryDescription || 'N/A'}</p> ${generateDataTableHTML('', ['S/No', 'Location', 'Type of Work', 'Time Start', 'Time End', 'Pq No', 'Qty', 'Unit'], data.workDiaryEntries)} <h3 class="section-title">Weather Condition</h3> <p class="description">${data.weatherConditionDescription || 'N/A'}</p> ${generateDataTableHTML('', ['S/No', 'Location', 'Affected Work', 'Time Start', 'Time End', 'Condition', 'Remarks'], data.weatherConditionEntries)} <h3 class="section-title">Approval Status</h3> <table class="info-table"> <tr><td class="label">Recorded By (Foreman):</td><td>${data.recordedBy || 'Pending'}</td></tr> <tr><td class="label">Verified By (OM):</td><td>${data.omSignature || 'Pending'}</td></tr> <tr><td class="label">Checked By (QC):</td><td>${data.qcSignature || 'Pending'}</td></tr> <tr><td class="label">Approved By (PM):</td><td>${data.pmSignature || 'Pending'}</td></tr> <tr><td class="label">Final Status:</td><td><strong>${data.finalStatus || data.status || 'In Progress'}</strong></td></tr> </table> ${approvalLink === '#' ? '' : `<div class="button-container"><a href="${approvalLink}" class="button">Click to Review / Approve</a></div>`} </td></tr> </table> </center></body></html>`;}
async function generatePdf(data) { const htmlContent = generateFullFormEmailHTML(data, '#'); const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] }); const page = await browser.newPage(); await page.setContent(htmlContent, { waitUntil: 'networkidle0' }); const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true }); await browser.close(); return pdfBuffer; }

// =================================================================
//                 PUBLIC ROUTES (No Login Required)
// =================================================================

app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/login.js', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.js')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'public', 'style.css')));
app.post('/api/login', (req, res) => { const { username, password } = req.body; const FIXED_USERNAME = process.env.APP_USERNAME || 'admin'; const FIXED_PASSWORD = process.env.APP_PASSWORD || 'password123'; if (username === FIXED_USERNAME && password === FIXED_PASSWORD) { req.session.isLoggedIn = true; res.json({ success: true, message: 'Login successful!' }); } else { res.status(401).json({ success: false, message: 'Invalid username or password.' }); } });
const checkAuth = (req, res, next) => { if (req.session.isLoggedIn) { next(); } else { if (req.path.startsWith('/api/')) { return res.status(401).json({ message: 'Unauthorized. Please log in.' }); } res.redirect('/login.html'); } };
app.use(checkAuth);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/api/logout', (req, res) => { req.session.destroy(err => { if (err) { return res.status(500).json({ message: 'Could not log out.' }); } res.redirect('/login.html'); }); });

// =================================================================
//                      PROTECTED API ROUTES
// =================================================================

app.get('/api/employees', async (req, res) => { const { team } = req.query; if (!team) return res.status(400).json({ message: 'Team number is required.' }); try { const [employees] = await dbPool.query('SELECT empNo, name, role FROM employees WHERE teamNo = ?', [team]); res.json(employees); } catch (error) { console.error('Error in /api/employees:', error); res.status(500).json({ message: 'Server error fetching employee data.' }); } });
app.post('/api/jobsheet/start', async (req, res) => {
    const data = req.body;
    try {
        const sql = `INSERT INTO jobsheets (jobSheetNo, date, day, contractNo, teamNo, workingShift, siteForeman, workingTimeFrom, workingTimeTo, tmwpLcVehNo, lorryVehNo, noOfTma, manpowerOnSite, manpowerTransfer, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const values = [data.jobSheetNo, data.date, data.day, data.contractNo, data.teamNo, data.workingShift, data.siteForeman, data.workingTimeFrom, data.workingTimeTo, data.tmwpLcVehNo, data.lorryVehNo, data.noOfTma, JSON.stringify(data.manpowerOnSite || []), JSON.stringify(data.manpowerTransfer || []), 'In Progress'];
        const [result] = await dbPool.query(sql, values);
        const jobSheetId = result.insertId;
        try {
            const [[teamAssignment]] = await dbPool.query('SELECT om_email FROM team_assignments WHERE teamNo = ?', [data.teamNo]);
            if (teamAssignment && teamAssignment.om_email) {
                const emailHtml = generatePart1EmailHTML(data);
                await sendEmail({ to: teamAssignment.om_email, subject: `NOTIFICATION: Job Sheet Started - ${data.jobSheetNo}`, html: emailHtml });
            } else {
                console.warn(`No OM email found for Team ${data.teamNo}. Skipping initial notification.`);
            }
        } catch (emailError) {
            console.error(`Failed to send initial job start notification for Job ID ${jobSheetId}:`, emailError);
        }
        res.status(201).json({ success: true, message: 'Job sheet started.', jobSheetId: jobSheetId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ message: `Job Sheet No ${data.jobSheetNo} already exists.` });
        } else {
            console.error('Error in /api/jobsheet/start:', error);
            res.status(500).json({ message: `Failed to start job sheet: ${error.message}` });
        }
    }
});
app.post('/api/jobsheet/complete', async (req, res) => {
    const { jobSheetId, ...data } = req.body;
    try {
        const [[teamAssignment]] = await dbPool.query('SELECT om_email FROM team_assignments WHERE teamNo = ?', [data.teamNo]);
        if (!teamAssignment || !teamAssignment.om_email) { throw new Error(`No OM email found for Team ${data.teamNo}. Please configure it.`); }
        const sql = `UPDATE jobsheets SET workDiaryDescription = ?, weatherConditionDescription = ?, recordedBy = ?, workDiaryEntries = ?, weatherConditionEntries = ?, status = ? WHERE id = ?`;
        const values = [data.workDiaryDescription, data.weatherConditionDescription, data.recordedBy, JSON.stringify(data.workDiaryEntries || []), JSON.stringify(data.weatherConditionEntries || []), 'Pending OM Approval', jobSheetId];
        await dbPool.query(sql, values);
        const [[jobDataFromDb]] = await dbPool.query('SELECT * FROM jobsheets WHERE id = ?', [jobSheetId]);
        const completeJobData = { ...jobDataFromDb, ...data };
        const pdfBuffer = await generatePdf(completeJobData);
        const approvalLink = `${req.protocol}://${req.get('host')}/api/approve?approver=om&jobId=${jobSheetId}`;
        await sendEmail({ to: teamAssignment.om_email, subject: `ACTION REQUIRED: Job Sheet ${completeJobData.jobSheetNo}`, html: generateFullFormEmailHTML(completeJobData, approvalLink), attachments: [{ filename: `${completeJobData.jobSheetNo}.pdf`, content: pdfBuffer }] });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${completeJobData.jobSheetNo}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in /api/jobsheet/complete:', error);
        res.status(500).json({ message: `An error occurred during final submission: ${error.message}` });
    }
});
app.get('/api/approve', async (req, res) => {
    const { approver, jobId } = req.query;
    try {
        const [[job]] = await dbPool.query('SELECT * FROM jobsheets WHERE id = ?', [jobId]);
        if (!job) return res.status(404).send('<h1>Error 404</h1><p>Job not found.</p>');
        const [[teamEmails]] = await dbPool.query('SELECT qs_email, pm_email FROM team_assignments WHERE teamNo = ?', [job.teamNo]);
        if (!teamEmails) throw new Error(`Team assignment emails not found for Team ${job.teamNo}.`);
        let nextEmail, nextApprovalLink, signatureField, nextStatus, currentStatus;
        if (approver === 'om') { currentStatus = 'Pending OM Approval'; signatureField = 'omSignature'; nextStatus = 'Pending QC Approval'; nextEmail = teamEmails.qs_email; nextApprovalLink = `${req.protocol}://${req.get('host')}/api/approve?approver=qc&jobId=${jobId}`; } 
        else if (approver === 'qc') { currentStatus = 'Pending QC Approval'; signatureField = 'qcSignature'; nextStatus = 'Pending PM Approval'; nextEmail = teamEmails.pm_email; nextApprovalLink = `${req.protocol}://${req.get('host')}/edit.html?jobId=${jobId}`; } 
        else { return res.status(400).send(`<h1>Invalid Request</h1>`); }
        if (job.status !== currentStatus) { return res.status(400).send(`<h1>Action Already Processed</h1><p>This job's current status is '${job.status}'.</p>`); }
        const signature = `Approved via email on ${new Date().toLocaleString('en-SG')}`;
        await dbPool.query(`UPDATE jobsheets SET status = ?, ${signatureField} = ? WHERE id = ?`, [nextStatus, signature, jobId]);
        const [[updatedJobData]] = await dbPool.query('SELECT * FROM jobsheets WHERE id = ?', [jobId]);
        updatedJobData.manpowerOnSite = parseJsonField(updatedJobData.manpowerOnSite);
        updatedJobData.manpowerTransfer = parseJsonField(updatedJobData.manpowerTransfer);
        updatedJobData.workDiaryEntries = parseJsonField(updatedJobData.workDiaryEntries);
        updatedJobData.weatherConditionEntries = parseJsonField(updatedJobData.weatherConditionEntries);
        await sendEmail({ to: nextEmail, subject: `ACTION REQUIRED: Job Sheet ${job.jobSheetNo}`, html: generateFullFormEmailHTML(updatedJobData, nextApprovalLink) });
        res.send(`<h1>Thank You!</h1><p>Job Sheet approved and forwarded.</p>`);
    } catch (error) {
        console.error(`Error in /api/approve for ${approver}:`, error);
        res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
    }
});
app.get('/api/jobsheet/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const [[jobData]] = await dbPool.query('SELECT * FROM jobsheets WHERE id = ?', [jobId]);
        if (!jobData) { return res.status(404).json({ message: 'Job not found' }); }
        jobData.manpowerOnSite = parseJsonField(jobData.manpowerOnSite);
        jobData.manpowerTransfer = parseJsonField(jobData.manpowerTransfer);
        jobData.workDiaryEntries = parseJsonField(jobData.workDiaryEntries);
        jobData.weatherConditionEntries = parseJsonField(jobData.weatherConditionEntries);
        res.json(jobData);
    } catch (error) {
        console.error(`Error fetching job sheet ${req.params.jobId}:`, error);
        res.status(500).json({ message: 'Server error fetching data.' });
    }
});

// --- CORRECTED CODE BLOCK ---
app.post('/api/pm/approve-and-update', async (req, res) => {
    const { jobId, ...data } = req.body;
    try {
        // Fetch the existing record to get prior approval signatures
        const [[existingJob]] = await dbPool.query('SELECT * FROM jobsheets WHERE id = ?', [jobId]);
        if (!existingJob) {
            return res.status(404).json({ success: false, message: 'Job not found.' });
        }

        const [[teamAssignment]] = await dbPool.query('SELECT hr_email FROM team_assignments WHERE teamNo = ?', [existingJob.teamNo]);
        if (!teamAssignment || !teamAssignment.hr_email) { throw new Error(`No HR email found for Team ${existingJob.teamNo}.`); }

        const pmSignature = `Approved & Finalized by PM on ${new Date().toLocaleString('en-SG')}`;
        
        // Corrected SQL to include and preserve previous signatures
        const sql = `UPDATE jobsheets SET 
            day = ?, jobSheetNo = ?, date = ?, contractNo = ?, teamNo = ?, workingShift = ?, 
            siteForeman = ?, workingTimeFrom = ?, workingTimeTo = ?, tmwpLcVehNo = ?, lorryVehNo = ?, 
            noOfTma = ?, manpowerOnSite = ?, manpowerTransfer = ?, workDiaryEntries = ?, 
            weatherConditionEntries = ?, workDiaryDescription = ?, weatherConditionDescription = ?, 
            recordedBy = ?, omSignature = ?, qcSignature = ?, pmSignature = ?, 
            status = ?, finalStatus = ? 
            WHERE id = ?`;

        // Corrected values array, sourcing prior signatures from the existing job record
        const values = [
            data.day, data.jobSheetNo, data.date, data.contractNo, data.teamNo, data.workingShift, 
            data.siteForeman, data.workingTimeFrom, data.workingTimeTo, data.tmwpLcVehNo, data.lorryVehNo, 
            data.noOfTma, JSON.stringify(data.manpowerOnSite || []), JSON.stringify(data.manpowerTransfer || []), 
            JSON.stringify(data.workDiaryEntries || []), JSON.stringify(data.weatherConditionEntries || []), 
            data.workDiaryDescription, data.weatherConditionDescription, 
            existingJob.recordedBy, existingJob.omSignature, existingJob.qcSignature, pmSignature, 
            'Completed', 'Completed', 
            jobId
        ];
        await dbPool.query(sql, values);

        // Re-fetch the fully updated record to ensure the PDF/email is 100% accurate
        const [[finalDataForPdf]] = await dbPool.query('SELECT * FROM jobsheets WHERE id = ?', [jobId]);
        finalDataForPdf.manpowerOnSite = parseJsonField(finalDataForPdf.manpowerOnSite);
        finalDataForPdf.manpowerTransfer = parseJsonField(finalDataForPdf.manpowerTransfer);
        finalDataForPdf.workDiaryEntries = parseJsonField(finalDataForPdf.workDiaryEntries);
        finalDataForPdf.weatherConditionEntries = parseJsonField(finalDataForPdf.weatherConditionEntries);
        
        const finalPdfBuffer = await generatePdf(finalDataForPdf);
        await sendEmail({ to: teamAssignment.hr_email, subject: `FINALIZED Job Sheet: ${finalDataForPdf.jobSheetNo}`, html: generateFullFormEmailHTML(finalDataForPdf, '#'), attachments: [{ filename: `${finalDataForPdf.jobSheetNo}.pdf`, content: finalPdfBuffer }] });
        
        res.json({ success: true, message: `Job Sheet ${data.jobSheetNo} approved and sent to HR.` });
    } catch (error) {
        console.error('Error in /api/pm/approve-and-update:', error);
        res.status(500).json({ success: false, message: `An error occurred: ${error.message}` });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

