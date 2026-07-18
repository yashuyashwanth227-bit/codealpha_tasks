/*
===========================================================
NimbusCloud
Review Module
Part 1 - Core Architecture
===========================================================
*/

"use strict";

const ReviewModule = (() => {

    /* ==========================================================
       CONFIGURATION
    ========================================================== */

    const CONFIG = Object.freeze({

        PAGE: 1,

        PER_PAGE: 200,

        FILTER: "pending_review"

    });

    /* ==========================================================
       STATE
    ========================================================== */

    const state = {

        initialized: false,

        loading: false,

        selectedRecord: null,

        pendingRecords: []

    };

    /* ==========================================================
       DOM CACHE
    ========================================================== */

    const ui = {

        reviewList:
            document.getElementById("reviewList"),

        incomingRecord:
            document.getElementById("incomingRecord"),

        matchedRecord:
            document.getElementById("matchedRecord"),

        similarityValue:
            document.getElementById("similarityValue"),

        confirmDuplicate:
            document.getElementById("confirmDuplicate"),

        markFalsePositive:
            document.getElementById("markFalsePositive"),

        reviewQueueCount:
            document.getElementById("reviewQueueCount")

    };

    /* ==========================================================
       HELPERS
    ========================================================== */

    function beginLoading(message) {

        state.loading = true;

        showLoading(message);

    }

    function finishLoading() {

        state.loading = false;

        hideLoading();

    }

    function escape(value) {

        return Utils.escapeHtml(

            String(value ?? "")

        );

    }

    function clearSelection() {

        state.selectedRecord = null;

        if (ui.incomingRecord) {

            ui.incomingRecord.innerHTML = "";

        }

        if (ui.matchedRecord) {

            ui.matchedRecord.innerHTML = "";

        }

        if (ui.similarityValue) {

            ui.similarityValue.textContent = "0%";

        }

    }

    function setPendingRecords(records) {

        state.pendingRecords = records || [];

    }

    /* ==========================================================
       RECORD FORMATTER
    ========================================================== */

    function formatRecord(record) {

        if (!record || !record.data) {

            return `

                <p>

                    No data available.

                </p>

            `;

        }

        return Object.entries(record.data)

            .map(([key, value]) => `

                <div class="compare-row">

                    <span class="compare-key">

                        ${escape(key)}

                    </span>

                    <span class="compare-value">

                        ${escape(value)}

                    </span>

                </div>

            `)

            .join("");

    }

    /* ==========================================================
       COMPARISON VIEW
    ========================================================== */

    function showComparison(record) {

        state.selectedRecord = record;

        if (ui.incomingRecord) {

            ui.incomingRecord.innerHTML =

                formatRecord(record);

        }

        if (ui.matchedRecord) {

            ui.matchedRecord.innerHTML =

                record.matched_record

                    ? formatRecord(

                        record.matched_record

                    )

                    : `

                        <p>

                            No matching record.

                        </p>

                    `;

        }

        if (ui.similarityValue) {

            ui.similarityValue.textContent =

                `${record.similarity_score ?? 0}%`;

        }

    }
    /* ==========================================================
   REVIEW CARD
========================================================== */

    function createReviewCard(record) {

        const card = document.createElement("div");

        card.className = "review-card";

        card.dataset.id = record.id;

        card.innerHTML = `

            <div class="review-header">

                <div class="review-title">

                    Record #${escape(record.id)}

                </div>

                <div class="review-score">

                    ${escape(record.similarity_score)}%

                </div>

            </div>

            <div class="review-meta">

                Pending Review

            </div>

        `;

        return card;

    }

/* ==========================================================
   REVIEW LIST
========================================================== */

    function renderReviewList() {

        if (!ui.reviewList) {

            return;

        }

        ui.reviewList.innerHTML = "";

        if (ui.reviewQueueCount) {

            ui.reviewQueueCount.textContent =

                `${state.pendingRecords.length} Pending`;

        }

        if (state.pendingRecords.length === 0) {

            clearSelection();

            ui.reviewList.innerHTML = `

                <div class="empty-state">

                    <h3>

                        No Pending Reviews

                    </h3>

                    <p>

                        Every duplicate candidate has been resolved.

                    </p>

                </div>

            `;

            return;

        }

        const fragment =

            document.createDocumentFragment();

        state.pendingRecords.forEach(record => {

            fragment.appendChild(

                createReviewCard(record)

            );

        });

        ui.reviewList.appendChild(fragment);

        showComparison(

            state.pendingRecords[0]

        );

        const firstCard =

            ui.reviewList.querySelector(

                ".review-card"

            );

        if (firstCard) {

            firstCard.classList.add(

                "active"

            );

        }

    }

/* ==========================================================
   CARD SELECTION
========================================================== */

    function selectReviewCard(card) {

        ui.reviewList

            .querySelectorAll(".review-card")

            .forEach(item =>

                item.classList.remove("active")

            );

        card.classList.add("active");

        const record =

            state.pendingRecords.find(

                item =>

                    String(item.id) ===

                    String(card.dataset.id)

            );

        if (record) {

            showComparison(record);

        }

    }

/* ==========================================================
   EVENT DELEGATION
========================================================== */

    function bindReviewList() {

        if (!ui.reviewList) {

            return;

        }

        ui.reviewList.addEventListener(

            "click",

            event => {

                const card =

                    event.target.closest(

                        ".review-card"

                    );

                if (!card) {

                    return;

                }

                selectReviewCard(card);

            }

        );

    }
    /* ==========================================================
   LOAD REVIEW QUEUE
========================================================== */

    async function loadReviewQueue() {

        if (state.loading) {

            return;

        }

        beginLoading(

            "Loading review queue..."

        );

        try {

            const response =

                await APIService.fetchRecords({

                    page: CONFIG.PAGE,

                    perPage: CONFIG.PER_PAGE,

                    status: CONFIG.FILTER,

                    search: ""

                });

            setPendingRecords(

                response?.items || []

            );

            renderReviewList();

        }

        catch (error) {

            console.error(error);

            showToast(

                error.message ||

                "Unable to load review queue.",

                "error"

            );

            setPendingRecords([]);

            renderReviewList();

        }

        finally {

            finishLoading();

        }

    }

/* ==========================================================
   CONFIRM DUPLICATE
========================================================== */

    async function confirmDuplicateRecord() {

        if (!state.selectedRecord) {

            showToast(

                "Please select a record first.",

                "warning"

            );

            return;

        }

        const confirmed = await confirmDialog(

            "Confirm Duplicate",

            "Mark this record as a confirmed duplicate?"

        );

        if (!confirmed) {

            return;

        }

        beginLoading(

            "Updating record..."

        );

        try {

            await APIService.resolveFlaggedRecord(

                state.selectedRecord.id,

                "confirm_duplicate"

            );

            showToast(

                "Duplicate confirmed."

            );

            await refresh();

        }

        catch (error) {

            console.error(error);

            showToast(

                error.message ||

                "Unable to update record.",

                "error"

            );

        }

        finally {

            finishLoading();

        }

    }

/* ==========================================================
   MARK FALSE POSITIVE
========================================================== */

    async function markFalsePositiveRecord() {

        if (!state.selectedRecord) {

            showToast(

                "Please select a record first.",

                "warning"

            );

            return;

        }

        const confirmed = await confirmDialog(

            "Restore Record",

            "Restore this record into the verified database?"

        );

        if (!confirmed) {

            return;

        }

        beginLoading(

            "Restoring record..."

        );

        try {

            await APIService.resolveFlaggedRecord(

                state.selectedRecord.id,

                "mark_false_positive"

            );

            showToast(

                "Record restored successfully."

            );

            await refresh();

        }

        catch (error) {

            console.error(error);

            showToast(

                error.message ||

                "Unable to restore record.",

                "error"

            );

        }

        finally {

            finishLoading();

        }

    }

/* ==========================================================
   REFRESH
========================================================== */

    async function refresh() {

        clearSelection();

        await loadReviewQueue();

        if (

            window.DashboardModule?.refresh

        ) {

            await DashboardModule.refresh();

        }

        if (

            window.RecordsModule?.refresh

        ) {

            await RecordsModule.refresh();

        }

    }
    /* ==========================================================
   BUTTON EVENTS
========================================================== */

    function bindButtons() {

        if (ui.confirmDuplicate) {

            ui.confirmDuplicate.addEventListener(

                "click",

                confirmDuplicateRecord

            );

        }

        if (ui.markFalsePositive) {

            ui.markFalsePositive.addEventListener(

                "click",

                markFalsePositiveRecord

            );

        }

    }

/* ==========================================================
   RESET
========================================================== */

    function reset() {

        state.pendingRecords = [];

        state.selectedRecord = null;

        clearSelection();

        if (ui.reviewList) {

            ui.reviewList.innerHTML = "";

        }

        if (ui.reviewQueueCount) {

            ui.reviewQueueCount.textContent =

                "0 Pending";

        }

    }

/* ==========================================================
   INITIALIZATION
========================================================== */

    async function initialize() {

        if (state.initialized) {

            return;

        }

        state.initialized = true;

        bindReviewList();

        bindButtons();

        await loadReviewQueue();

        console.info(

            "Review module initialized."

        );

    }

/* ==========================================================
   DESTROY
========================================================== */

    function destroy() {

        reset();

        state.initialized = false;

    }

/* ==========================================================
   PUBLIC API
========================================================== */

    return Object.freeze({

        init: initialize,

        refresh,

        reset,

        destroy,

        load: loadReviewQueue,

        getSelectedRecord() {

            return state.selectedRecord;

        }

    });

})();

/* ==========================================================
   AUTO STARTUP
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    () => {

        ReviewModule.init();

    }

);

/* ==========================================================
   CLEANUP
========================================================== */

window.addEventListener(

    "beforeunload",

    () => {

        ReviewModule.destroy();

    }

);

/* ==========================================================
   GLOBAL EXPORT
========================================================== */

window.ReviewModule = ReviewModule;

/* ==========================================================
   END OF REVIEW MODULE
========================================================== */