(function () {

    const apiBase = 'http://localhost:5000/api';
    const apiKey = 'uls_c6f1942d398cffa112c51c5b10c8f257';

    const qs = s => document.querySelector(s);

    const apiStatus = qs('#apiStatus');
    const logsTableBody = qs('#logsTable tbody');

    const serviceInput = qs('#serviceInput');
    const levelInput = qs('#levelInput');
    const serverIdInput = qs('#serverIdInput');
    const traceIdInput = qs('#traceIdInput');
    const messageInput = qs('#messageInput');

    const submitBtn = qs('#submitBtn');
    const refreshBtn = qs('#refreshBtn');
    const exportBtn = qs('#exportBtn');

    function setStatus(msg, type = 'info') {
        if (apiStatus) {
            apiStatus.textContent = msg;
            apiStatus.className = `status show ${type}`;
        }
    }

    async function apiFetch(path, options = {}) {
        options.headers = options.headers || {};
        options.headers['X-API-KEY'] = apiKey;

        const res = await fetch(apiBase + path, options);
        if (!res.ok) {
            let txt = '';
            try {
                const json = await res.json();
                txt = json.message || res.statusText;
            } catch (e) {
                txt = await res.text();
            }
            throw new Error(txt || res.statusText);
        }
        return res.headers.get("content-type")?.includes("json")
            ? res.json()
            : res;
    }

    function renderLogs(logs) {
        if (!logsTableBody) return;
        logsTableBody.innerHTML = '';

        if (!logs.length) {
            logsTableBody.innerHTML =
                `<tr><td colspan="4" style="text-align:center;">No logs found</td></tr>`;
            return;
        }

        logs.forEach(l => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${new Date(l.timestamp).toLocaleString()}</td>
        <td>${l.service || '-'}</td>
        <td>${l.message || '-'}</td>
        <td>${l.level || 'INFO'}</td>
      `;
            logsTableBody.appendChild(tr);
        });
    }

    async function refreshLogs() {
        try {
            setStatus('Loading logs...');
            const data = await apiFetch('/logs');
            renderLogs(data.logs || []);
            setStatus(`Loaded ${(data.logs || []).length} logs`, 'success');
        } catch (e) {
            setStatus('Load failed: ' + e.message, 'error');
        }
    }

    async function submitLog() {
        if (!messageInput || !messageInput.value.trim()) {
            setStatus('Message required', 'error');
            return;
        }

        try {
            await apiFetch('/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: serviceInput.value || 'unknown',
                    level: levelInput.value,
                    message: messageInput.value,
                    server: serverIdInput.value,
                    trace_id: traceIdInput.value
                })
            });
            setStatus('Log submitted', 'success');
            messageInput.value = '';
            refreshLogs();
        } catch (e) {
            setStatus('Submit failed: ' + e.message, 'error');
        }
    }

    async function exportCSV() {
        try {
            setStatus('Exporting...');
            const res = await fetch(apiBase + '/logs/export', {
                headers: { 'X-API-KEY': apiKey }
            });
            if (!res.ok) throw new Error('Export failed');

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'logs.csv';
            a.click();
            URL.revokeObjectURL(url);

            setStatus('Export successful', 'success');
        } catch (e) {
            setStatus('Export failed: ' + e.message, 'error');
        }
    }

    if (submitBtn) submitBtn.onclick = submitLog;
    if (refreshBtn) refreshBtn.onclick = refreshLogs;
    if (exportBtn) exportBtn.onclick = exportCSV;

    refreshLogs();

})();
