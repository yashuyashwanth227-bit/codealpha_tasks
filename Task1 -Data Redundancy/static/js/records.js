/*
===========================================================
NimbusCloud
Records Module
Part 1 - Core Architecture
===========================================================
*/

"use strict";

const RecordsModule = (() => {

    /* ==========================================================
       CONFIGURATION
    ========================================================== */

    const CONFIG = Object.freeze({

        PER_PAGE: 25,

        SEARCH_DELAY: 300

    });

    /* ==========================================================
       STATE
    ========================================================== */

    const state = {

        initialized: false,

        loading: false,

        currentPage: 1,

        totalPages: 1,

        currentFilter: "all",

        currentSearch: "",

        records: []

    };

    /* ==========================================================
       DOM CACHE
    ========================================================== */

    const ui = {

        tableBody:
            document.getElementById("recordsTableBody"),

        search:
            document.getElementById("recordSearch"),

        filter:
            document.getElementById("recordFilter"),

        previous:
            document.getElementById("previousPage"),

        next:
            document.getElementById("nextPage"),

        pageIndicator:
            document.getElementById("pageIndicator"),

        exportCSV:
            document.getElementById("exportCSV"),

        exportJSON:
            document.getElementById("exportJSON")

    };

    /* ==========================================================
       HELPERS
    ========================================================== */

    function clearTable() {

        if (!ui.tableBody) {

            return;

        }

        ui.tableBody.innerHTML = "";

    }

    function updatePagination() {

        if (!ui.pageIndicator) {

            return;

        }

        ui.pageIndicator.textContent =
            `Page ${state.currentPage} of ${state.totalPages}`;

        if (ui.previous) {

            ui.previous.disabled =
                state.currentPage <= 1;

        }

        if (ui.next) {

            ui.next.disabled =
                state.currentPage >= state.totalPages;

        }

    }

    function statusClass(status) {

        switch (status) {

            case "unique":
                return "unique";

            case "duplicate":
                return "duplicate";

            case "pending_review":
                return "pending";

            case "false_positive":
                return "processing";

            default:
                return "";
        }

    }

    function similarityValue(record) {

        if (

            record.similarity_score === null ||

            record.similarity_score === undefined

        ) {

            return "-";

        }

        return `${record.similarity_score}%`;

    }

    function escape(value) {

        return Utils.escapeHtml(

            String(value ?? "")

        );

    }

    function beginLoading(message) {

        state.loading = true;

        showLoading(message);

    }

    function finishLoading() {

        state.loading = false;

        hideLoading();

    }

    function setRecords(response) {

        state.records =
            response.items || [];

        state.totalPages =
            response.total_pages || 1;

    }
    /* ==========================================================
   TABLE RENDERING
========================================================== */

    function renderTable() {

        clearTable();

        if (!ui.tableBody) {

            return;

        }

        if (state.records.length === 0) {

            ui.tableBody.innerHTML = `

                <tr>

                    <td colspan="7" class="text-center">

                        No records found.

                    </td>

                </tr>

            `;

            return;

        }

        const fragment = document.createDocumentFragment();

        state.records.forEach(record => {

            fragment.appendChild(

                createRow(record)

            );

        });

        ui.tableBody.appendChild(fragment);

    }

/* ==========================================================
   RECORD ROW
========================================================== */

    function createRow(record) {

        const tr = document.createElement("tr");

        tr.dataset.id = record.id;

        const source =

            record.source ||

            record.match_type ||

            "-";

        const preview = JSON.stringify(

            record.data,

            null,

            2

        );

        tr.innerHTML = `

            <td>

                ${escape(record.id)}

            </td>

            <td>

                ${escape(source)}

            </td>

            <td class="record-json">

                ${escape(preview)}

            </td>

            <td>

                <span class="status-pill ${statusClass(record.status)}">

                    ${escape(record.status)}

                </span>

            </td>

            <td>

                ${similarityValue(record)}

            </td>

            <td>

                ${escape(

                    formatDate(record.created_at)

                )}

            </td>

            <td>

                <button
                    class="secondary-btn preview-record">

                    View

                </button>

                ${record.status === "unique"

                    ? `

                    <button
                        class="danger-btn delete-record">

                        Delete

                    </button>

                    `

                    : ""

                }

            </td>

        `;

        return tr;

    }

/* ==========================================================
   RECORD PREVIEW
========================================================== */

    function openRecordPreview(recordId) {

        const record = state.records.find(

            item =>

                String(item.id) ===

                String(recordId)

        );

        if (!record) {

            return;

        }

        openModal(

            `Record #${record.id}`,

            `<pre>${escape(

                JSON.stringify(

                    record.data,

                    null,

                    2

                )

            )}</pre>`

        );

    }

/* ==========================================================
   EVENT DELEGATION
========================================================== */

    function bindTableEvents() {

        if (!ui.tableBody) {

            return;

        }

        ui.tableBody.addEventListener(

            "click",

            async event => {

                const row =

                    event.target.closest("tr");

                if (!row) {

                    return;

                }

                const recordId =

                    row.dataset.id;

                if (

                    event.target.classList.contains(

                        "preview-record"

                    )

                ) {

                    openRecordPreview(

                        recordId

                    );

                    return;

                }

                if (

                    event.target.classList.contains(

                        "delete-record"

                    )

                ) {

                    await removeRecord(

                        recordId

                    );

                }

            }

        );

    }
    /* ==========================================================
   LOAD RECORDS
========================================================== */

    async function loadRecords() {

        if (state.loading) {

            return;

        }

        beginLoading(

            "Loading records..."

        );

        try {

            const response =

                await APIService.fetchRecords({

                    page: state.currentPage,

                    perPage: CONFIG.PER_PAGE,

                    status: state.currentFilter,

                    search: state.currentSearch

                });

            if (

                !response ||

                !Array.isArray(response.items)

            ) {

                setRecords({

                    items: [],

                    total_pages: 1

                });

            }

            else {

                setRecords(response);

            }

            renderTable();

            updatePagination();

        }

        catch (error) {

            console.error(error);

            showToast(

                error.message ||

                "Unable to load records.",

                "error"

            );

            clearTable();

        }

        finally {

            finishLoading();

        }

    }

/* ==========================================================
   DELETE RECORD
========================================================== */

    async function removeRecord(recordId) {

        const confirmed = await confirmDialog(

            "Delete Record",

            "This record will be permanently removed."

        );

        if (!confirmed) {

            return;

        }

        beginLoading(

            "Deleting record..."

        );

        try {

            await APIService.deleteRecord(

                recordId

            );

            showToast(

                "Record deleted successfully."

            );

            await loadRecords();

            if (window.DashboardModule) {

                await DashboardModule.refresh();

            }

        }

        catch (error) {

            console.error(error);

            showToast(

                error.message ||

                "Unable to delete record.",

                "error"

            );

        }

        finally {

            finishLoading();

        }

    }

/* ==========================================================
   SEARCH
========================================================== */

    function bindSearch() {

        if (!ui.search) {

            return;

        }

        ui.search.addEventListener(

            "input",

            debounce(() => {

                state.currentSearch =

                    ui.search.value.trim();

                state.currentPage = 1;

                loadRecords();

            },

            CONFIG.SEARCH_DELAY)

        );

    }

/* ==========================================================
   FILTER
========================================================== */

    function bindFilter() {

        if (!ui.filter) {

            return;

        }

        ui.filter.addEventListener(

            "change",

            () => {

                state.currentFilter =

                    ui.filter.value;

                state.currentPage = 1;

                loadRecords();

            }

        );

    }

/* ==========================================================
   PAGINATION
========================================================== */

    function bindPagination() {

        if (

            ui.previous

        ) {

            ui.previous.addEventListener(

                "click",

                () => {

                    if (

                        state.currentPage <= 1

                    ) {

                        return;

                    }

                    state.currentPage--;

                    loadRecords();

                }

            );

        }

        if (

            ui.next

        ) {

            ui.next.addEventListener(

                "click",

                () => {

                    if (

                        state.currentPage >=

                        state.totalPages

                    ) {

                        return;

                    }

                    state.currentPage++;

                    loadRecords();

                }

            );

        }

    }

/* ==========================================================
   EXPORT
========================================================== */

    function bindExport() {

        if (ui.exportCSV) {

            ui.exportCSV.addEventListener(

                "click",

                () => {

                    APIService.exportData(

                        "csv"

                    );

                }

            );

        }

        if (ui.exportJSON) {

            ui.exportJSON.addEventListener(

                "click",

                () => {

                    APIService.exportData(

                        "json"

                    );

                }

            );

        }

    }
    /* ==========================================================
   REFRESH
========================================================== */

    async function refresh() {

        await loadRecords();

    }

/* ==========================================================
   RESET
========================================================== */

    function resetFilters() {

        state.currentPage = 1;

        state.totalPages = 1;

        state.currentFilter = "all";

        state.currentSearch = "";

        state.records = [];

        if (ui.search) {

            ui.search.value = "";

        }

        if (ui.filter) {

            ui.filter.value = "all";

        }

        updatePagination();

        clearTable();

    }

/* ==========================================================
   INITIALIZATION
========================================================== */

    function initialize() {

        if (state.initialized) {

            return;

        }

        state.initialized = true;

        bindTableEvents();

        bindSearch();

        bindFilter();

        bindPagination();

        bindExport();

        loadRecords();

        console.info(

            "Records module initialized."

        );

    }

/* ==========================================================
   DESTROY
========================================================== */

    function destroy() {

        resetFilters();

        state.initialized = false;

    }

/* ==========================================================
   PUBLIC API
========================================================== */

    return Object.freeze({

        init: initialize,

        refresh,

        reload: loadRecords,

        reset: resetFilters,

        destroy

    });

})();

/* ==========================================================
   AUTO STARTUP
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    () => {

        UploadModule.init();

        RecordsModule.init();

    }

);

/* ==========================================================
   CLEANUP
========================================================== */

window.addEventListener(

    "beforeunload",

    () => {

        RecordsModule.destroy();

    }

);

/* ==========================================================
   GLOBAL EXPORT
========================================================== */

window.RecordsModule = RecordsModule;

/* ==========================================================
   END OF RECORDS MODULE
========================================================== */