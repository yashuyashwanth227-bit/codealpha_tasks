/*
===========================================================
NimbusCloud
Production API Layer
Part 1 - Configuration & HTTP Client
===========================================================
*/

"use strict";

/* ==========================================================
   API CONFIGURATION
========================================================== */

const API_CONFIG = Object.freeze({

    BASE_URL: "",

    TIMEOUT: 30000,

    RETRY_COUNT: 1,

    DEFAULT_HEADERS: {

        "Content-Type": "application/json",
        "Accept": "application/json"

    }

});

/* ==========================================================
   ENDPOINTS
========================================================== */

const API_ENDPOINTS = Object.freeze({

    HEALTH: "/api/health",

    STATS: "/api/stats",

    SETTINGS: "/api/settings",

    RECORDS: "/api/records",

    MANUAL_RECORD: "/api/records/manual",

    BATCH_RECORDS: "/api/records/batch",

    FLAGGED: "/api/flagged",

    ACTIVITY: "/api/activity",

    EXPORT: "/api/export",

    SAMPLE: "/api/sample",

    RESET: "/api/reset"

});

/* ==========================================================
   QUERY BUILDER
========================================================== */

function buildQuery(params = {}) {

    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {

        if (

            value !== undefined &&
            value !== null &&
            value !== ""

        ) {

            query.append(key, value);

        }

    });

    return query.toString();

}

/* ==========================================================
   REQUEST TIMEOUT
========================================================== */

function createTimeoutSignal(timeout) {

    const controller = new AbortController();

    const timer = setTimeout(() => {

        controller.abort();

    }, timeout);

    return {

        signal: controller.signal,

        timer

    };

}

/* ==========================================================
   HTTP CLIENT
========================================================== */

class HttpClient {

    constructor(config) {

        this.baseURL = config.BASE_URL;
        this.timeout = config.TIMEOUT;
        this.defaultHeaders = config.DEFAULT_HEADERS;

    }

    async request({

        url,

        method = "GET",

        body = null,

        headers = {}

    }) {

        const {

            signal,

            timer

        } = createTimeoutSignal(this.timeout);

        try {

            const response = await fetch(

                this.baseURL + url,

                {

                    method,

                    signal,

                    headers: {

                        ...this.defaultHeaders,

                        ...headers

                    },

                    body:

                        body !== null

                            ? JSON.stringify(body)

                            : null

                }

            );

            clearTimeout(timer);

            return await this.handleResponse(response);

        }

        catch (error) {

            clearTimeout(timer);

            if (error.name === "AbortError") {

                throw new Error(

                    "Request timeout."

                );

            }

            throw error;

        }

    }

    async handleResponse(response) {

        const type =

            response.headers.get(

                "content-type"

            ) || "";

        let payload = null;

        if (

            type.includes(

                "application/json"

            )

        ) {

            payload = await response.json();

        }

        else if (

            type.includes("text")

        ) {

            payload = await response.text();

        }

        if (!response.ok) {

            throw new Error(

                payload?.error ||

                payload?.message ||

                `HTTP ${response.status}`

            );

        }

        return payload;

    }

    get(url) {

        return this.request({

            url

        });

    }

    post(

        url,

        body,

        headers

    ) {

        return this.request({

            url,

            method: "POST",

            body,

            headers

        });

    }

    put(

        url,

        body,

        headers

    ) {

        return this.request({

            url,

            method: "PUT",

            body,

            headers

        });

    }

    delete(

        url,

        headers

    ) {

        return this.request({

            url,

            method: "DELETE",

            headers

        });

    }

}

/* ==========================================================
   CLIENT INSTANCE
========================================================== */

const http = new HttpClient(API_CONFIG);

/* ==========================================================
   SAFE REQUEST
========================================================== */

async function safeRequest(

    callback,

    ...args

) {

    try {

        return {

            success: true,

            data: await callback(...args)

        };

    }

    catch (error) {

        console.error(

            "[API]",

            error

        );

        return {

            success: false,

            error: error.message

        };

    }

}

/* ==========================================================
   DASHBOARD API
========================================================== */

async function checkHealth() {

    return http.get(

        API_ENDPOINTS.HEALTH

    );

}

async function fetchDashboardStats() {

    return http.get(

        API_ENDPOINTS.STATS

    );

}

/* ==========================================================
   SETTINGS API
========================================================== */

async function fetchSettings() {

    return http.get(

        API_ENDPOINTS.SETTINGS

    );

}

async function saveSettings(

    similarityThreshold

) {

    return http.post(

        API_ENDPOINTS.SETTINGS,

        {

            similarity_threshold:

                similarityThreshold

        }

    );

}

/* ==========================================================
   RECORDS API
========================================================== */

async function fetchRecords({

    page = 1,

    perPage = 25,

    status = "all",

    search = ""

} = {}) {

    const query = buildQuery({

        page,

        per_page: perPage,

        status,

        search

    });

    return http.get(

        `${API_ENDPOINTS.RECORDS}?${query}`

    );

}

async function fetchRecord(

    recordId

) {

    return http.get(

        `${API_ENDPOINTS.RECORDS}/${recordId}`

    );

}

async function deleteRecord(

    recordId

) {

    return http.delete(

        `${API_ENDPOINTS.RECORDS}/${recordId}`

    );

}

/* ==========================================================
   MANUAL RECORD
========================================================== */

async function submitManualRecord(

    data,

    keyFields = []

) {

    return http.post(

        API_ENDPOINTS.MANUAL_RECORD,

        {

            data,

            key_fields: keyFields

        }

    );

}

/* ==========================================================
   BATCH UPLOAD
========================================================== */

async function uploadBatch(

    records,

    keyFields = []

) {

    return http.post(

        API_ENDPOINTS.BATCH_RECORDS,

        {

            records,

            key_fields: keyFields

        }

    );

}

/* ==========================================================
   REVIEW QUEUE
========================================================== */

async function resolveFlaggedRecord(

    flaggedId,

    action

) {

    return http.post(

        `${API_ENDPOINTS.FLAGGED}/${flaggedId}/resolve`,

        {

            action

        }

    );

}

async function fetchFlaggedRecords(

    page = 1,

    perPage = 25

) {

    const query = buildQuery({

        page,

        per_page: perPage

    });

    return http.get(

        `${API_ENDPOINTS.FLAGGED}?${query}`

    );

}
/* ==========================================================
   ACTIVITY API
========================================================== */

async function fetchActivity({

    page = 1,

    perPage = 40

} = {}) {

    const query = buildQuery({

        page,

        per_page: perPage

    });

    return http.get(

        `${API_ENDPOINTS.ACTIVITY}?${query}`

    );

}

/* ==========================================================
   DOWNLOAD HELPERS
========================================================== */

function downloadFile(url) {

    const link = document.createElement("a");

    link.href = API_CONFIG.BASE_URL + url;

    link.style.display = "none";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

}

function exportData(

    format = "csv"

) {

    const query = buildQuery({

        format

    });

    downloadFile(

        `${API_ENDPOINTS.EXPORT}?${query}`

    );

}

function downloadSampleDataset() {

    downloadFile(

        API_ENDPOINTS.SAMPLE

    );

}

/* ==========================================================
   SYSTEM API
========================================================== */

async function resetSystem() {

    return http.post(

        API_ENDPOINTS.RESET,

        {}

    );

}

/* ==========================================================
   CONNECTION TEST
========================================================== */

async function testConnection() {

    try {

        await checkHealth();

        return true;

    }

    catch {

        return false;

    }

}

/* ==========================================================
   API OBJECT
========================================================== */

const APIService = Object.freeze({

    /* Core */

    checkHealth,

    testConnection,

    safeRequest,

    /* Dashboard */

    fetchDashboardStats,

    /* Settings */

    fetchSettings,

    saveSettings,

    /* Records */

    fetchRecords,

    fetchRecord,

    deleteRecord,

    submitManualRecord,

    uploadBatch,

    /* Review */

    fetchFlaggedRecords,

    resolveFlaggedRecord,

    /* Activity */

    fetchActivity,

    /* Downloads */

    exportData,

    downloadSampleDataset,

    /* System */

    resetSystem,

    /* Helpers */

    buildQuery

});

window.APIService = APIService;

/* ==========================================================
   INITIALIZATION
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        try {

            const connected = await testConnection();

            if (connected) {

                console.info(

                    "%cNimbusCloud Backend Connected",

                    "color:#16a34a;font-weight:bold;"

                );

            }

            else {

                console.warn(

                    "NimbusCloud backend is unavailable."

                );

            }

        }

        catch (error) {

            console.error(

                "Backend initialization failed.",

                error

            );

        }

    }

);

/* ==========================================================
   END OF API MODULE
========================================================== */