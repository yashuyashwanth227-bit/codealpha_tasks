/*
===========================================================
NimbusCloud
Dashboard Module
Part 1 - Core Architecture
===========================================================
*/

"use strict";

const DashboardModule = (() => {

    /* ==========================================================
       CONFIGURATION
    ========================================================== */

    const CONFIG = Object.freeze({

        REFRESH_INTERVAL: 30000,

        ACTIVITY_LIMIT: 6,

        ANIMATION_DURATION: 400

    });

    /* ==========================================================
       STATE
    ========================================================== */

    const state = {

        initialized: false,

        loading: false,

        refreshTimer: null,

        lastStats: null,

        lastActivity: [],

        abortController: null

    };

    /* ==========================================================
       DOM CACHE
    ========================================================== */

    const ui = {

        totalRecords:
            document.getElementById("totalRecords"),

        duplicateRecords:
            document.getElementById("duplicateRecords"),

        pendingRecords:
            document.getElementById("pendingRecords"),

        falsePositiveRecords:
            document.getElementById("falsePositiveRecords"),

        reviewCount:
            document.getElementById("reviewCount"),

        currentThreshold:
            document.getElementById("currentThreshold"),

        recentActivity:
            document.getElementById("recentActivity")

    };

    /* ==========================================================
       HELPERS
    ========================================================== */

    function setText(element, value) {

        if (!element) return;

        element.textContent = value;

    }

    function formatNumber(value) {

        return Number(value || 0).toLocaleString();

    }

    function clearActivity() {

        if (ui.recentActivity) {

            ui.recentActivity.innerHTML = "";

        }

    }

    function cancelPendingRequest() {

        if (state.abortController) {

            state.abortController.abort();

        }

        state.abortController = new AbortController();

    }

    function isSameStats(current) {

        if (!state.lastStats) {

            return false;

        }

        return JSON.stringify(current) === JSON.stringify(state.lastStats);

    }

    /* ==========================================================
       LOADING
    ========================================================== */

    function beginLoading(message = "Loading dashboard...") {

        state.loading = true;

        showLoading(message);

    }

    function finishLoading() {

        state.loading = false;

        hideLoading();

    }

    /* ==========================================================
       VALUE ANIMATION
    ========================================================== */

    function animateNumber(element, value) {

        if (!element) return;

        const end = Number(value || 0);

        const start = Number(

            element.dataset.value || 0

        );

        const duration = CONFIG.ANIMATION_DURATION;

        const startTime = performance.now();

        function update(now) {

            const progress = Math.min(

                (now - startTime) / duration,

                1

            );

            const current = Math.round(

                start + (end - start) * progress

            );

            element.dataset.value = end;

            element.textContent = current.toLocaleString();

            if (progress < 1) {

                requestAnimationFrame(update);

            }

        }

        requestAnimationFrame(update);

    }

    /* ==========================================================
       KPI RENDERER
    ========================================================== */

    function updateCards(stats) {

        if (!stats) return;

        if (isSameStats(stats)) {

            return;

        }

        state.lastStats = structuredClone(stats);

        animateNumber(

            ui.totalRecords,

            stats.unique_count

        );

        animateNumber(

            ui.duplicateRecords,

            stats.duplicates_blocked

        );

        animateNumber(

            ui.pendingRecords,

            stats.pending_review

        );

        animateNumber(

            ui.falsePositiveRecords,

            stats.false_positives_restored

        );

        setText(

            ui.reviewCount,

            formatNumber(

                stats.pending_review

            )

        );

        setText(

            ui.currentThreshold,

            `${stats.threshold}%`

        );

    }
    /* ==========================================================
   ACTIVITY HELPERS
========================================================== */

    function activityIcon(action) {

        const icons = {

            record_added: "✅",
            batch_processed: "📥",
            duplicate_rejected: "⛔",
            duplicate_confirmed: "✔️",
            false_positive_restored: "🔄",
            record_deleted: "🗑️",
            settings_updated: "⚙️",
            system_reset: "⚠️"

        };

        return icons[action] || "•";

    }

    function createActivityItem(activity) {

        const item = document.createElement("div");

        item.className = "activity-item";

        item.innerHTML = `

            <div class="activity-icon">

                ${activityIcon(activity.action)}

            </div>

            <div class="activity-content">

                <div class="activity-title">

                    ${escapeHtml(activity.message)}

                </div>

                <div class="activity-time">

                    ${formatDate(activity.timestamp)}

                </div>

            </div>

        `;

        return item;

    }

    function renderEmptyActivity() {

        clearActivity();

        ui.recentActivity.innerHTML = `

            <div class="empty-state">

                <p>No recent activity available.</p>

            </div>

        `;

    }

    function renderActivity(items = []) {

        if (!ui.recentActivity) {

            return;

        }

        clearActivity();

        if (!items.length) {

            renderEmptyActivity();

            return;

        }

        const fragment = document.createDocumentFragment();

        items.forEach(item => {

            fragment.appendChild(

                createActivityItem(item)

            );

        });

        ui.recentActivity.appendChild(fragment);

    }

/* ==========================================================
   LOAD RECENT ACTIVITY
========================================================== */

    async function loadRecentActivity() {

        try {

            const response =

                await APIService.fetchActivity({

                    page: 1,

                    perPage:

                        CONFIG.ACTIVITY_LIMIT

                });

            const activities =

                response?.items || [];

            state.lastActivity = activities;

            renderActivity(activities);

        }

        catch (error) {

            console.error(error);

            showToast(

                error.message ||

                "Unable to load activity.",

                "error"

            );

        }

    }

/* ==========================================================
   LOAD DASHBOARD
========================================================== */

    async function loadDashboardStats() {

        try {

            const stats =

                await APIService.fetchDashboardStats();

            updateCards(stats);

            if (

                window.ChartManager &&

                typeof ChartManager.update === "function"

            ) {

                ChartManager.update(stats);

            }

        }

        catch (error) {

            console.error(error);

            showToast(

                error.message ||

                "Unable to load dashboard.",

                "error"

            );

        }

    }

/* ==========================================================
   COMPLETE REFRESH
========================================================== */

    async function refreshDashboard() {

        if (state.loading) {

            return;

        }

        beginLoading();

        try {

            cancelPendingRequest();

            await Promise.all([

                loadDashboardStats(),

                loadRecentActivity()

            ]);

        }

        finally {

            finishLoading();

        }

    }
    /* ==========================================================
   AUTO REFRESH
========================================================== */

    function startAutoRefresh() {

        stopAutoRefresh();

        state.refreshTimer = setInterval(

            async () => {

                if (

                    document.hidden ||

                    state.loading

                ) {

                    return;

                }

                await refreshDashboard();

            },

            CONFIG.REFRESH_INTERVAL

        );

    }

    function stopAutoRefresh() {

        if (!state.refreshTimer) {

            return;

        }

        clearInterval(

            state.refreshTimer

        );

        state.refreshTimer = null;

    }

/* ==========================================================
   CHART SUPPORT
========================================================== */

    function updateCharts() {

        if (

            !window.ChartManager ||

            typeof ChartManager.refresh !== "function"

        ) {

            return;

        }

        ChartManager.refresh();

    }

    function refreshTheme() {

        if (

            !window.ChartManager ||

            typeof ChartManager.refreshTheme !== "function"

        ) {

            return;

        }

        ChartManager.refreshTheme();

    }

/* ==========================================================
   PAGE LIFECYCLE
========================================================== */

    async function activate() {

        await refreshDashboard();

        startAutoRefresh();

    }

    function deactivate() {

        stopAutoRefresh();

    }

/* ==========================================================
   VISIBILITY HANDLING
========================================================== */

    function handleVisibilityChange() {

        if (document.hidden) {

            stopAutoRefresh();

            return;

        }

        refreshDashboard();

        startAutoRefresh();

    }

/* ==========================================================
   WINDOW EVENTS
========================================================== */

    function bindEvents() {

        document.addEventListener(

            "visibilitychange",

            handleVisibilityChange

        );

        window.addEventListener(

            "focus",

            refreshDashboard

        );

    }

    function unbindEvents() {

        document.removeEventListener(

            "visibilitychange",

            handleVisibilityChange

        );

        window.removeEventListener(

            "focus",

            refreshDashboard

        );

    }
    /* ==========================================================
   INITIALIZATION
========================================================== */

    async function initialize() {

        if (state.initialized) {

            return;

        }

        state.initialized = true;

        bindEvents();

        try {

            if (

                window.ChartManager &&

                typeof ChartManager.init === "function"

            ) {

                await ChartManager.init();

            }

            await refreshDashboard();

            startAutoRefresh();

            console.info(

                "Dashboard initialized."

            );

        }

        catch (error) {

            console.error(

                "Dashboard initialization failed:",

                error

            );

            showToast(

                error.message ||

                "Unable to initialize dashboard.",

                "error"

            );

        }

    }

/* ==========================================================
   PUBLIC METHODS
========================================================== */

    async function refresh() {

        await refreshDashboard();

    }

    function destroy() {

        stopAutoRefresh();

        unbindEvents();

        if (state.abortController) {

            state.abortController.abort();

            state.abortController = null;

        }

        state.loading = false;

        state.lastStats = null;

        state.lastActivity = [];

        state.initialized = false;

    }

/* ==========================================================
   PUBLIC API
========================================================== */

    return Object.freeze({

        init: initialize,

        refresh,

        activate,

        deactivate,

        destroy,

        refreshTheme,

        updateCharts

    });

})();

/* ==========================================================
   APPLICATION STARTUP
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    () => {

        DashboardModule.init();

    }

);

/* ==========================================================
   APPLICATION CLEANUP
========================================================== */

window.addEventListener(

    "beforeunload",

    () => {

        DashboardModule.destroy();

    }

);

/* ==========================================================
   GLOBAL EXPORT
========================================================== */

window.DashboardModule = DashboardModule;

/* ==========================================================
   END OF DASHBOARD MODULE
========================================================== */