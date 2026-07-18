/*
===========================================================
NimbusCloud
Application Bootstrap
Part 1 - Core Architecture
===========================================================
*/

"use strict";

const App = (() => {

    /* ==========================================================
       CONFIGURATION
    ========================================================== */

    const CONFIG = Object.freeze({

        DEFAULT_VIEW: "dashboard",

        DEFAULT_THEME: "light",

        AUTO_REFRESH_INTERVAL: 10000,

        STORAGE_KEY_THEME: "theme"

    });

    /* ==========================================================
       STATE
    ========================================================== */

    const state = {

        initialized: false,

        currentView: CONFIG.DEFAULT_VIEW,

        currentTheme: CONFIG.DEFAULT_THEME,

        refreshTimer: null

    };

    /* ==========================================================
       DOM CACHE
    ========================================================== */

    const ui = {

        sidebar:
            document.getElementById("sidebar"),

        navItems:
            document.querySelectorAll("[data-page]"),

        views:
            document.querySelectorAll(".page"),

        viewTitle:
            document.getElementById("pageTitle"),

        viewSubtitle:
            document.getElementById("pageDescription"),

        mobileToggle:
            document.getElementById("mobileNavToggle"),

        refreshButton:
            document.getElementById("refreshBtn"),

        darkModeToggle:
            document.getElementById("themeToggle"),

        themeSwitch:
            document.getElementById("themeToggleSwitch")

    };

    /* ==========================================================
       VIEW METADATA
    ========================================================== */

    const VIEWS = Object.freeze({

        dashboard: {

            title: "Dashboard",

            subtitle:
                "System overview and analytics"

        },

        upload: {

            title: "Upload",

            subtitle:
                "CSV upload and manual record entry"

        },

        records: {

            title: "Records",

            subtitle:
                "Browse processed records"

        },

        review: {

            title: "Review Queue",

            subtitle:
                "Resolve possible duplicate records"

        },

        activity: {

            title: "Activity Log",

            subtitle:
                "Complete history of every action performed in the system"

        },

        settings: {

            title: "Settings",

            subtitle:
                "Configure application preferences"

        }

    });

    /* ==========================================================
       THEME
    ========================================================== */

    function loadTheme() {

        try {

            const theme = localStorage.getItem(

                CONFIG.STORAGE_KEY_THEME

            );

            if (theme) {

                state.currentTheme = theme;

            }

        }

        catch (error) {

            console.warn(error);

        }

    }

    function saveTheme() {

        try {

            localStorage.setItem(

                CONFIG.STORAGE_KEY_THEME,

                state.currentTheme

            );

        }

        catch (error) {

            console.warn(error);

        }

    }

    function applyTheme() {

        document.body.classList.toggle(

            "dark",

            state.currentTheme === "dark"

        );

        if (ui.themeSwitch) {

            ui.themeSwitch.classList.toggle(

                "on",

                state.currentTheme === "dark"

            );

        }

        saveTheme();

    }

    function toggleTheme() {

        state.currentTheme =

            state.currentTheme === "dark"

                ? "light"

                : "dark";

        applyTheme();

    }
    /* ==========================================================
   VIEW MANAGEMENT
========================================================== */

    function updateViewMetadata(view) {

        const meta =

            VIEWS[view];

        if (!meta) {

            return;

        }

        if (ui.viewTitle) {

            ui.viewTitle.textContent =

                meta.title;

        }

        if (ui.viewSubtitle) {

            ui.viewSubtitle.textContent =

                meta.subtitle;

        }

    }

    function updateNavigation(view) {

        ui.navItems.forEach(item => {

            item.classList.toggle(

                "active",

                item.dataset.page === view

            );

        });

    }

    function updateViews(view) {

        ui.views.forEach(section => {

            section.classList.toggle(

                "active",

                section.id === `${view}Page`

            );

        });

    }

    function closeSidebar() {

        if (ui.sidebar) {

            ui.sidebar.classList.remove(

                "collapsed"

            );

        }

    }

    function openSidebar() {

        if (ui.sidebar) {

            ui.sidebar.classList.add(

                "collapsed"

            );

        }

    }

    function toggleSidebar() {

        if (!ui.sidebar) {

            return;

        }

        ui.sidebar.classList.toggle(

            "collapsed"

        );

    }

/* ==========================================================
   MODULE REFRESH
========================================================== */

    async function refreshCurrentModule() {

        switch (state.currentView) {

            case "dashboard":

                if (window.DashboardModule) {

                    await DashboardModule.refresh();

                }

                break;

            case "records":

                if (window.RecordsModule) {

                    await RecordsModule.refresh();

                }

                break;

            case "review":

                if (window.ReviewModule) {

                    await ReviewModule.refresh();

                }

                break;

            case "settings":

                if (window.SettingsModule) {

                    await SettingsModule.refresh();

                }

                break;

            case "upload":

                break;

            default:

                break;

        }

    }

/* ==========================================================
   VIEW SWITCHING
========================================================== */

    async function showView(view) {

        if (

            !Object.prototype.hasOwnProperty.call(

                VIEWS,

                view

            )

        ) {

            return;

        }

        state.currentView = view;

        updateNavigation(view);

        updateViews(view);

        updateViewMetadata(view);

        closeSidebar();

        try {

            await refreshCurrentModule();

        }

        catch (error) {

            console.error(error);

        }

    }
    /* ==========================================================
   MODULE INITIALIZATION
========================================================== */

    async function initializeModules() {

        const modules = [

            window.DashboardModule,

            window.UploadModule,

            window.RecordsModule,

            window.ReviewModule,

            window.SettingsModule

        ];

        for (const module of modules) {

            if (

                module &&

                typeof module.init === "function"

            ) {

                try {

                    await module.init();

                }

                catch (error) {

                    console.error(

                        "Module initialization failed:",

                        error

                    );

                }

            }

        }

    }

/* ==========================================================
   EVENT BINDING
========================================================== */

    function bindNavigationEvents() {

        ui.navItems.forEach(item => {

            item.addEventListener(

                "click",

                () => {

                    showView(

                        item.dataset.page

                    );

                }

            );

        });

    }

    function bindSidebarEvents() {

        if (ui.mobileToggle) {

            ui.mobileToggle.addEventListener(

                "click",

                toggleSidebar

            );

        }

    }

    function bindThemeEvents() {

        if (ui.darkModeToggle) {

            ui.darkModeToggle.addEventListener(

                "click",

                toggleTheme

            );

        }

        if (ui.themeSwitch) {

            ui.themeSwitch.addEventListener(

                "click",

                toggleTheme

            );

        }

    }

    function bindRefreshEvent() {

        if (!ui.refreshButton) {

            return;

        }

        ui.refreshButton.addEventListener(

            "click",

            async () => {

                try {

                    showLoading(

                        "Refreshing..."

                    );

                    await refreshCurrentModule();

                }

                catch (error) {

                    console.error(error);

                }

                finally {

                    hideLoading();

                }

            }

        );

    }

/* ==========================================================
   APPLICATION INITIALIZATION
========================================================== */

    async function initialize() {

        if (state.initialized) {

            return;

        }

        state.initialized = true;

        loadTheme();

        applyTheme();

        bindNavigationEvents();

        bindSidebarEvents();

        bindThemeEvents();

        bindRefreshEvent();

        await initializeModules();

        await showView(

            CONFIG.DEFAULT_VIEW

        );

        console.info(

            "NimbusCloud initialized successfully."

        );

    }
    /* ==========================================================
   AUTO REFRESH
========================================================== */

    function startAutoRefresh() {

        stopAutoRefresh();

        state.refreshTimer = setInterval(

            async () => {

                try {

                    await refreshCurrentModule();

                }

                catch (error) {

                    console.error(

                        "Auto refresh failed:",

                        error

                    );

                }

            },

            CONFIG.AUTO_REFRESH_INTERVAL

        );

    }

    function stopAutoRefresh() {

        if (state.refreshTimer) {

            clearInterval(

                state.refreshTimer

            );

            state.refreshTimer = null;

        }

    }

/* ==========================================================
   GLOBAL ERROR HANDLING
========================================================== */

    function registerGlobalErrorHandlers() {

        window.addEventListener(

            "error",

            event => {

                console.error(

                    "Unhandled Error:",

                    event.error

                );

                if (typeof showToast === "function") {

                    showToast(

                        "An unexpected error occurred.",

                        "error"

                    );

                }

            }

        );

        window.addEventListener(

            "unhandledrejection",

            event => {

                console.error(

                    "Unhandled Promise:",

                    event.reason

                );

                if (typeof showToast === "function") {

                    showToast(

                        "A background task failed.",

                        "error"

                    );

                }

            }

        );

    }

/* ==========================================================
   APPLICATION LIFECYCLE
========================================================== */

    function onVisibilityChange() {

        if (document.hidden) {

            stopAutoRefresh();

        }

        else {

            startAutoRefresh();

            refreshCurrentModule().catch(

                console.error

            );

        }

    }

    function registerLifecycleEvents() {

        document.addEventListener(

            "visibilitychange",

            onVisibilityChange

        );

        window.addEventListener(

            "beforeunload",

            destroy

        );

    }

/* ==========================================================
   SHUTDOWN
========================================================== */

    function destroy() {

        stopAutoRefresh();

        state.initialized = false;

        console.info(

            "NimbusCloud shutdown completed."

        );

    }
    /* ==========================================================
   PUBLIC API
========================================================== */

    return Object.freeze({

        init: initialize,

        showView,

        refresh: refreshCurrentModule,

        startAutoRefresh,

        stopAutoRefresh,

        destroy,

        getCurrentView() {

            return state.currentView;

        },

        getCurrentTheme() {

            return state.currentTheme;

        }

    });

})();

/* ==========================================================
   APPLICATION STARTUP
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    async () => {

        try {

            await App.init();

            App.startAutoRefresh();

        }

        catch (error) {

            console.error(

                "Application startup failed:",

                error

            );

            if (typeof showToast === "function") {

                showToast(

                    "Failed to initialize NimbusCloud.",

                    "error"

                );

            }

        }

    }

);

/* ==========================================================
   GLOBAL EXPORT
========================================================== */

window.App = App;

/* ==========================================================
   END OF APPLICATION
========================================================== */