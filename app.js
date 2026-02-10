(function () {
    const apiBase = '/api';
    const KEY_STORAGE_NAME = 'uls_api_key';

    const qs = s => document.querySelector(s);

    const apiStatus = qs('#apiStatus');
    const serviceInput = qs('#serviceInput');
    const levelInput = qs('#levelInput');
    const serverIdInput = qs('#serverIdInput');
    const traceIdInput = qs('#traceIdInput');
    const messageInput = qs('#messageInput');
    const submitBtn = qs('#submitBtn');
    const refreshBtn = qs('#refreshBtn');
    const exportBtn = qs('#exportBtn');
    const logsTableBody = qs('#logsTable tbody');

    /**
     * Set status message in the UI
     */
    function setStatus(msg, isError = false, isSuccess = false) {
        if (!apiStatus) return;
        apiStatus.textContent = msg || '';
        apiStatus.className = 'status show';
        if (isError) apiStatus.classList.add('error');
        else if (isSuccess) apiStatus.classList.add('success');
        else apiStatus.classList.add('info');
    }

    /**
     * Retrieve or generate API Key
     */
    async function getApiKey() {
        let key = localStorage.getItem(KEY_STORAGE_NAME);
        if (!key) {
            try {
                const res = await fetch(`${apiBase}/key/generate`, { method: 'POST' });
                const data = await res.json();
                if (data.status === 'success' || data.api_key) {
                    key = data.api_key;
                    localStorage.setItem(KEY_STORAGE_NAME, key);
                }
            } catch (err) {
                console.error('Failed to generate API Key', err);
            }
        }
        return key;
    }

    /**
     * Wrapper for fetch with API Key injection
     */
    async function apiFetch(path, opts = {}) {
        const apiKey = await getApiKey();
        opts.headers = opts.headers || {};
        if (apiKey) opts.headers['X-API-KEY'] = apiKey;

        try {
            const res = await fetch(apiBase + path, opts);
            if (!res.ok) {
                let text = '';
                try {
                    const json = await res.json();
                    text = json.message || json.error || res.statusText;
                } catch (e) {
                    text = await res.text();
                }
                throw new Error(res.status + ' ' + (text || res.statusText));
            }
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
                return await res.json();
            }
            return await res.text();
        } catch (err) {
            throw err;
        }
    }

    function formatTime(ts) {
        if (!ts) return "-";
        return new Date(ts).toLocaleString();
    }

    /**
     * Render logs into the table
     */
    function renderLogs(arr) {
        if (!logsTableBody) return;
        logsTableBody.innerHTML = '';
        if (!arr || !arr.length) {
            logsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No logs available</td></tr>';
            return;
        }

        arr.forEach(log => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${formatTime(log.timestamp)}</td>
                <td>${log.service || "Unknown"}</td>
                <td>${log.message}</td>
                <td class="level ${log.level?.toLowerCase() || 'info'}">${log.level || 'INFO'}</td>
            `;
            logsTableBody.appendChild(row);
        });
    }

    /**
     * Fetch logs from backend
     */
    async function refreshLogs() {
        if (!logsTableBody) return;
        setStatus('Fetching logs...');
        try {
            const data = await apiFetch('/logs');
            const logs = data.logs || data.results || [];
            renderLogs(logs);
            setStatus(`Fetched ${logs.length} logs`, false, true);
        } catch (err) {
            setStatus('Fetch failed: ' + err.message, true);
        }
    }

    /**
     * Submit a new log entry
     */
    async function submitLog() {
        if (!messageInput || !messageInput.value.trim()) {
            setStatus('Please enter a message', true);
            return;
        }

        const payload = {
            service: (serviceInput ? serviceInput.value.trim() : '') || 'web-app',
            level: (levelInput ? levelInput.value : '') || 'INFO',
            message: messageInput.value.trim(),
            server: (serverIdInput ? serverIdInput.value.trim() : '') || 'local-client',
            trace_id: (traceIdInput ? traceIdInput.value.trim() : '') || ''
        };

        setStatus('Submitting...');
        try {
            await apiFetch('/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            setStatus('Log submitted!', false, true);
            if (messageInput) messageInput.value = '';
            refreshLogs();
        } catch (err) {
            setStatus('Submit failed: ' + err.message, true);
        }
    }

    /**
     * Export Logs as CSV
     */
    async function exportCSV() {
        setStatus('Preparing Export...');
        const apiKey = await getApiKey();

        try {
            const res = await fetch(`${apiBase}/logs/export`, {
                method: 'GET',
                headers: {
                    'X-API-KEY': apiKey
                }
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || 'Export failed');
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'logs.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            setStatus('CSV Exported & Saved to server!', false, true);
        } catch (err) {
            setStatus('Export failed: ' + err.message, true);
        }
    }

    /**
     * Initialize Application
     */
    function init() {
        if (submitBtn) submitBtn.addEventListener('click', submitLog);
        if (refreshBtn) refreshBtn.addEventListener('click', refreshLogs);
        if (exportBtn) exportBtn.addEventListener('click', exportCSV);

        if (messageInput) {
            messageInput.addEventListener('keydown', e => {
                if (e.ctrlKey && e.key === 'Enter') submitLog();
            });
        }

        // Load logs on startup
        refreshLogs();
    }

    // Start everything
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
