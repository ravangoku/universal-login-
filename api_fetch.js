/**
 * Enhanced API fetch wrapper with timeout, retry logic, and robust error handling
 * 
 * @param {string} path - API endpoint path (appended to apiBase)
 * @param {Object} opts - Fetch options
 * @param {number} [opts.timeout=30000] - Request timeout in milliseconds
 * @param {number} [opts.retries=0] - Number of retry attempts on failure
 * @param {number} [opts.retryDelay=1000] - Delay between retries in ms
 * @param {boolean} [opts.includeCredentials=true] - Include cookies/auth
 * @returns {Promise<any>} - Parsed response data
 */
async function apiFetch(path, opts = {}) {
    // Destructure with defaults
    const {
        timeout = 30000,
        retries = 0,
        retryDelay = 1000,
        includeCredentials = true,
        ...fetchOptions
    } = opts;

    // Prepare headers (non-mutating)
    fetchOptions.headers = {
        ...fetchOptions.headers,
        'X-API-KEY': apiKey,
        'Content-Type': fetchOptions.headers?.['Content-Type'] || 'application/json',
    };

    const url = apiBase + path;
    let lastError;

    // Retry loop
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const res = await fetch(url, {
                ...fetchOptions,
                credentials: includeCredentials ? 'include' : 'omit',
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Parse response based on content-type
            const contentType = res.headers.get('content-type') || '';
            let data;

            try {
                if (contentType.includes('application/json')) {
                    data = await res.json();
                } else if (contentType.includes('text/')) {
                    data = await res.text();
                } else {
                    // For binary data or other types, return raw response
                    data = await res.blob?.() || await res.arrayBuffer?.() || null;
                }
            } catch (parseError) {
                throw new Error(`Failed to parse response: ${parseError.message}`);
            }

            // Handle HTTP errors
            if (!res.ok) {
                const errorMessage = data?.message
                    || data?.error
                    || data
                    || res.statusText
                    || `HTTP ${res.status}`;

                const error = new Error(errorMessage);
                error.status = res.status;
                error.statusText = res.statusText;
                error.data = data;
                error.url = url;

                throw error;
            }

            return data;

        } catch (error) {
            lastError = error;

            // Don't retry on client abort (timeout) or 4xx errors
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            if (error.status >= 400 && error.status < 500) {
                throw error;
            }

            // Retry for server errors or network issues
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
            }
        }
    }

    throw lastError;
}
