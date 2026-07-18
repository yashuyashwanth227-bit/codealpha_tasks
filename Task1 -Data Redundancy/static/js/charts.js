/*
===============================================================
NimbusCloud
charts.js

Chart.js Module
---------------------------------------------------------------
Responsibilities
- Own every Chart.js instance
- Create dashboard charts
- Update charts from dashboard data
- Destroy/recreate safely
- Resize handling
- Theme-aware colors
- No API calls
- No DOM navigation logic
===============================================================
*/

"use strict";

/* ============================================================
   CHART MANAGER
============================================================ */

const ChartManager = (() => {

    /* ========================================================
       PRIVATE VARIABLES
    ======================================================== */

    let activityChart = null;

    let statusChart = null;

    let initialized = false;

    /* ========================================================
       DEFAULT COLORS
    ======================================================== */

    const COLORS = {

        primary: "#2563eb",

        success: "#22c55e",

        warning: "#f59e0b",

        danger: "#ef4444",

        info: "#06b6d4",

        purple: "#8b5cf6",

        border: "#e5e7eb",

        darkBorder: "#334155",

        lightText: "#6b7280",

        darkText: "#cbd5e1",

        gridLight: "rgba(0,0,0,.06)",

        gridDark: "rgba(255,255,255,.08)"

    };

    /* ========================================================
       HELPERS
    ======================================================== */

    function isDarkMode() {

        return document.body.classList.contains("dark");

    }

    function axisColor() {

        return isDarkMode()

            ? COLORS.darkText

            : COLORS.lightText;

    }

    function gridColor() {

        return isDarkMode()

            ? COLORS.gridDark

            : COLORS.gridLight;

    }

    function destroyChart(chart) {

        if (

            chart &&

            typeof chart.destroy === "function"

        ) {

            chart.destroy();

        }

    }

    function canvas(id) {

        return document.getElementById(id);

    }

    function context(id) {

        const element = canvas(id);

        if (!element) {

            console.warn(

                `Chart canvas "${id}" not found.`

            );

            return null;

        }

        return element.getContext("2d");

    }

    /* ========================================================
       BASE OPTIONS
    ======================================================== */

    function baseOptions() {

        return {

            responsive: true,

            maintainAspectRatio: false,

            animation: {

                duration: 500,

                easing: "easeOutQuart"

            },

            interaction: {

                mode: "index",

                intersect: false

            },

            plugins: {

                legend: {

                    labels: {

                        color: axisColor(),

                        usePointStyle: true,

                        pointStyle: "circle",

                        padding: 18,

                        font: {

                            family: "Inter",

                            size: 12,

                            weight: "500"

                        }

                    }

                },

                tooltip: {

                    backgroundColor: "#111827",

                    titleColor: "#ffffff",

                    bodyColor: "#ffffff",

                    borderColor: COLORS.primary,

                    borderWidth: 1,

                    padding: 12,

                    displayColors: true,

                    cornerRadius: 10

                }

            }

        };

    }

    /* ========================================================
       BAR CHART OPTIONS
    ======================================================== */

    function activityOptions() {

        const options = baseOptions();

        options.scales = {

            x: {

                ticks: {

                    color: axisColor()

                },

                grid: {

                    display: false

                }

            },

            y: {

                beginAtZero: true,

                ticks: {

                    precision: 0,

                    color: axisColor()

                },

                grid: {

                    color: gridColor()

                }

            }

        };

        return options;

    }

    /* ========================================================
       DOUGHNUT OPTIONS
    ======================================================== */

    function doughnutOptions() {

        const options = baseOptions();

        options.cutout = "70%";

        options.plugins.legend.position = "bottom";

        return options;

    }

    /* ========================================================
       CREATE ACTIVITY CHART
    ======================================================== */

    function createActivityChart() {

        const ctx = context(

            "activityChart"

        );

        if (!ctx) {

            return;

        }

        destroyChart(

            activityChart

        );

        activityChart = new Chart(

            ctx,

            {

                type: "bar",

                data: {

                    labels: [],

                    datasets: [

                        {

                            label:

                                "Processed Records",

                            data: [],

                            backgroundColor:

                                COLORS.primary,

                            borderRadius: 8,

                            borderSkipped: false,

                            maxBarThickness: 42

                        }

                    ]

                },

                options:

                    activityOptions()

            }

        );

    }

    /* ========================================================
       CREATE STATUS CHART
    ======================================================== */

    function createStatusChart() {

        const ctx = context(

            "statusChart"

        );

        if (!ctx) {

            return;

        }

        destroyChart(

            statusChart

        );

        statusChart = new Chart(

            ctx,

            {

                type: "doughnut",

                data: {

                    labels: [

                        "Unique",

                        "Duplicate",

                        "Pending",

                        "False Positive"

                    ],

                    datasets: [

                        {

                            data: [0,0,0,0],

                            backgroundColor: [

                                COLORS.success,

                                COLORS.danger,

                                COLORS.warning,

                                COLORS.info

                            ],

                            borderWidth: 0,

                            hoverOffset: 12

                        }

                    ]

                },

                options:

                    doughnutOptions()

            }

        );

    }
        /* ========================================================
       UPDATE ACTIVITY CHART
    ======================================================== */

    function updateActivityChart(dailyActivity = []) {

        if (!activityChart) {

            createActivityChart();

        }

        if (!activityChart) {

            return;

        }

        const labels = dailyActivity.map(item => item.date);

        const values = dailyActivity.map(item => item.count);

        activityChart.data.labels = labels;

        activityChart.data.datasets[0].data = values;

        activityChart.update();

    }

    /* ========================================================
       UPDATE STATUS CHART
    ======================================================== */

    function updateStatusChart(breakdown = {}) {

        if (!statusChart) {

            createStatusChart();

        }

        if (!statusChart) {

            return;

        }

        statusChart.data.datasets[0].data = [

            breakdown.unique || 0,

            breakdown.duplicate || 0,

            breakdown.pending_review || 0,

            breakdown.false_positive || 0

        ];

        statusChart.update();

    }

    /* ========================================================
       UPDATE BOTH CHARTS
    ======================================================== */

    function updateCharts(stats) {

        if (!stats) {

            return;

        }

        updateActivityChart(

            stats.daily_activity || []

        );

        updateStatusChart(

            stats.breakdown || {}

        );

    }

    /* ========================================================
       REFRESH THEME COLORS
    ======================================================== */

    function refreshTheme() {

        if (activityChart) {

            activityChart.options.scales.x.ticks.color =

                axisColor();

            activityChart.options.scales.y.ticks.color =

                axisColor();

            activityChart.options.scales.y.grid.color =

                gridColor();

            activityChart.options.plugins.legend.labels.color =

                axisColor();

            activityChart.update();

        }

        if (statusChart) {

            statusChart.options.plugins.legend.labels.color =

                axisColor();

            statusChart.update();

        }

    }

    /* ========================================================
       RESIZE
    ======================================================== */

    function resizeCharts() {

        if (activityChart) {

            activityChart.resize();

        }

        if (statusChart) {

            statusChart.resize();

        }

    }

    /* ========================================================
       DESTROY ALL CHARTS
    ======================================================== */

    function destroyAll() {

        destroyChart(

            activityChart

        );

        destroyChart(

            statusChart

        );

        activityChart = null;

        statusChart = null;

        initialized = false;

    }

    /* ========================================================
       INITIALIZE
    ======================================================== */

    function initialize() {

        if (initialized) {

            return;

        }

        initialized = true;

        createActivityChart();

        createStatusChart();

    }

    /* ========================================================
       WINDOW RESIZE
    ======================================================== */

    let resizeTimer = null;

    window.addEventListener(

        "resize",

        () => {

            clearTimeout(

                resizeTimer

            );

            resizeTimer = setTimeout(

                resizeCharts,

                200

            );

        }

    );

    /* ========================================================
       PUBLIC API
    ======================================================== */

    return {

        init: initialize,

        update: updateCharts,

        updateActivity: updateActivityChart,

        updateStatus: updateStatusChart,

        refreshTheme,

        resize: resizeCharts,

        destroy: destroyAll

    };

})();

/* ============================================================
   AUTO INITIALIZATION
============================================================ */

document.addEventListener(

    "DOMContentLoaded",

    () => {

        ChartManager.init();

    }

);