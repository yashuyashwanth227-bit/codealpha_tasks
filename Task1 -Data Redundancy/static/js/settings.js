/*
===========================================================
NimbusCloud
Settings Module
Part 1 - Core Architecture
===========================================================
*/

"use strict";

const SettingsModule = (() => {

    /* ==========================================================
       CONFIGURATION
    ========================================================== */

    const CONFIG = Object.freeze({

        DEFAULT_THRESHOLD: 85,

        MIN_THRESHOLD: 0,

        MAX_THRESHOLD: 100

    });

    /* ==========================================================
       STATE
    ========================================================== */

    const state = {

        initialized: false,

        loading: false,

        currentThreshold:

            CONFIG.DEFAULT_THRESHOLD

    };

    /* ==========================================================
       DOM CACHE
    ========================================================== */

    const ui = {

        slider:
            document.getElementById("thresholdSlider"),

        value:
            document.getElementById("thresholdValue"),

        save:
            document.getElementById("saveSettings"),

        reset:
            document.getElementById("resetSystem")

    };

    /* ==========================================================
       LOADING HELPERS
    ========================================================== */

    function beginLoading(message) {

        state.loading = true;

        showLoading(message);

    }

    function finishLoading() {

        state.loading = false;

        hideLoading();

    }

    /* ==========================================================
       THRESHOLD HELPERS
    ========================================================== */

    function normalizeThreshold(value) {

        const threshold = Number(value);

        if (Number.isNaN(threshold)) {

            return CONFIG.DEFAULT_THRESHOLD;

        }

        return Math.min(

            CONFIG.MAX_THRESHOLD,

            Math.max(

                CONFIG.MIN_THRESHOLD,

                threshold

            )

        );

    }

    function updateSlider(value) {

        state.currentThreshold =

            normalizeThreshold(value);

        if (ui.slider) {

            ui.slider.value =

                state.currentThreshold;

        }

        if (ui.value) {

            ui.value.textContent =

                `${state.currentThreshold}%`;

        }

    }

    function getThreshold() {

        return state.currentThreshold;

    }
    /* ==========================================================
   LOAD SETTINGS
========================================================== */

    async function loadSettings() {

        if (state.loading) {

            return;

        }

        beginLoading(

            "Loading settings..."

        );

        try {

            const settings =

                await APIService.fetchSettings();

            updateSlider(

                settings?.similarity_threshold ??

                CONFIG.DEFAULT_THRESHOLD

            );

        }

        catch (error) {

            console.error(error);

            showToast(

                error.message ||

                "Unable to load settings.",

                "error"

            );

            updateSlider(

                CONFIG.DEFAULT_THRESHOLD

            );

        }

        finally {

            finishLoading();

        }

    }

/* ==========================================================
   SAVE SETTINGS
========================================================== */

    async function saveSettingsToServer() {

        beginLoading(

            "Saving settings..."

        );

        try {

            await APIService.saveSettings(

                state.currentThreshold

            );

            showToast(

                "Settings saved successfully."

            );

            await refreshModules();

        }

        catch (error) {

            console.error(error);

            showToast(

                error.message ||

                "Unable to save settings.",

                "error"

            );

        }

        finally {

            finishLoading();

        }

    }

/* ==========================================================
   RESET SYSTEM
========================================================== */

    async function resetEntireSystem() {

        const confirmed =

            await confirmDialog(

                "Reset System",

                "This will permanently remove all records, activity logs and review items. Continue?"

            );

        if (!confirmed) {

            return;

        }

        beginLoading(

            "Resetting system..."

        );

        try {

            await APIService.resetSystem();

            showToast(

                "System reset successfully."

            );

            await refreshModules();

        }

        catch (error) {

            console.error(error);

            showToast(

                error.message ||

                "Unable to reset system.",

                "error"

            );

        }

        finally {

            finishLoading();

        }

    }

/* ==========================================================
   REFRESH DEPENDENT MODULES
========================================================== */

    async function refreshModules() {

        const modules = [

            window.DashboardModule,

            window.RecordsModule,

            window.ReviewModule

        ];

        for (const module of modules) {

            if (

                module &&

                typeof module.refresh ===

                "function"

            ) {

                try {

                    await module.refresh();

                }

                catch (error) {

                    console.error(

                        error

                    );

                }

            }

        }

    }
    /* ==========================================================
   EVENT BINDING
========================================================== */

    function bindEvents() {

        if (ui.slider) {

            ui.slider.addEventListener(

                "input",

                event => {

                    updateSlider(

                        event.target.value

                    );

                }

            );

        }

        if (ui.save) {

            ui.save.addEventListener(

                "click",

                async () => {

                    await saveSettingsToServer();

                }

            );

        }

        if (ui.reset) {

            ui.reset.addEventListener(

                "click",

                async () => {

                    await resetEntireSystem();

                }

            );

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

        bindEvents();

        await loadSettings();

        console.info(

            "Settings module initialized."

        );

    }

/* ==========================================================
   DESTROY
========================================================== */

    function destroy() {

        state.initialized = false;

        state.loading = false;

        updateSlider(

            CONFIG.DEFAULT_THRESHOLD

        );

    }

/* ==========================================================
   PUBLIC API
========================================================== */

    return Object.freeze({

        init: initialize,

        refresh: loadSettings,

        save: saveSettingsToServer,

        reset: resetEntireSystem,

        destroy,

        getThreshold

    });

})();

/* ==========================================================
   AUTO STARTUP
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    () => {

        SettingsModule.init();

    }

);

/* ==========================================================
   CLEANUP
========================================================== */

window.addEventListener(

    "beforeunload",

    () => {

        SettingsModule.destroy();

    }

);

/* ==========================================================
   GLOBAL EXPORT
========================================================== */

window.SettingsModule = SettingsModule;

/* ==========================================================
   END OF SETTINGS MODULE
========================================================== */