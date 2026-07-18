/*
===========================================================
NimbusCloud
Utility Functions
Shared Helpers
===========================================================
*/

"use strict";

/* ==========================================================
   DOM HELPERS
========================================================== */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => document.querySelectorAll(selector);

function createElement(tag, className = "") {

    const element = document.createElement(tag);

    if (className) {

        element.className = className;

    }

    return element;

}

/* ==========================================================
   LOADING OVERLAY
========================================================== */

function showLoading(message = "Processing...") {

    const overlay = $("#loadingOverlay");

    const label = $("#loadingMessage");

    if (label) {

        label.textContent = message;

    }

    if (overlay) {

        overlay.classList.remove("hidden");

    }

}

function hideLoading() {

    const overlay = $("#loadingOverlay");

    if (overlay) {

        overlay.classList.add("hidden");

    }

}

/* ==========================================================
   TOAST NOTIFICATION
========================================================== */

function showToast(

    message,

    type = "success",

    duration = 3500

) {

    const container = $("#toastContainer");

    if (!container) return;

    const toast = createElement(

        "div",

        `toast ${type}`

    );

    const title = createElement(

        "strong"

    );

    const body = createElement(

        "div"

    );

    switch (type) {

        case "success":

            title.textContent = "Success";

            break;

        case "error":

            title.textContent = "Error";

            break;

        case "warning":

            title.textContent = "Warning";

            break;

        default:

            title.textContent = "Information";

    }

    body.textContent = message;

    toast.appendChild(title);

    toast.appendChild(body);

    container.appendChild(toast);

    setTimeout(() => {

        toast.style.opacity = "0";

        toast.style.transform = "translateX(40px)";

        setTimeout(() => {

            toast.remove();

        }, 300);

    }, duration);

}

/* ==========================================================
   DATE FORMATTER
========================================================== */

function formatDate(dateString) {

    if (!dateString) return "-";

    const date = new Date(dateString);

    return date.toLocaleString(

        undefined,

        {

            year: "numeric",

            month: "short",

            day: "numeric",

            hour: "2-digit",

            minute: "2-digit"

        }

    );

}

/* ==========================================================
   NUMBER FORMATTER
========================================================== */

function formatNumber(number) {

    return Number(number).toLocaleString();

}

/* ==========================================================
   PERCENT FORMATTER
========================================================== */

function formatPercent(value) {

    return `${Number(value).toFixed(1)}%`;

}

/* ==========================================================
   DEBOUNCE
========================================================== */

function debounce(

    callback,

    delay = 300

) {

    let timer;

    return (...args) => {

        clearTimeout(timer);

        timer = setTimeout(() => {

            callback(...args);

        }, delay);

    };

}

/* ==========================================================
   SLEEP
========================================================== */

function sleep(ms) {

    return new Promise(resolve => {

        setTimeout(resolve, ms);

    });

}

/* ==========================================================
   CLIPBOARD
========================================================== */

async function copyToClipboard(text) {

    try {

        await navigator.clipboard.writeText(text);

        showToast(

            "Copied to clipboard."

        );

        return true;

    }

    catch (error) {

        showToast(

            "Unable to copy.",

            "error"

        );

        return false;

    }

}

/* ==========================================================
   RANDOM ID
========================================================== */

function randomId(length = 8) {

    const chars =

        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let result = "";

    for (

        let i = 0;

        i < length;

        i++

    ) {

        result += chars.charAt(

            Math.floor(

                Math.random() * chars.length

            )

        );

    }

    return result;

}

/* ==========================================================
   OBJECT EMPTY CHECK
========================================================== */

function isEmptyObject(obj) {

    return (

        obj &&

        Object.keys(obj).length === 0

    );

}

/* ==========================================================
   ARRAY GROUPING
========================================================== */

function groupBy(array, key) {

    return array.reduce(

        (result, current) => {

            const value = current[key];

            if (!result[value]) {

                result[value] = [];

            }

            result[value].push(current);

            return result;

        },

        {}

    );

}
/* ==========================================================
   MODAL
========================================================== */

function openModal(

    title = "",

    content = "",

    footer = ""

) {

    const overlay = $("#modalOverlay");

    const modalTitle = $("#modalTitle");

    const modalBody = $("#modalBody");

    const modalFooter = $("#modalFooter");

    if (!overlay) return;

    modalTitle.textContent = title;

    if (typeof content === "string") {

        modalBody.innerHTML = content;

    } else {

        modalBody.innerHTML = "";

        modalBody.appendChild(content);

    }

    if (typeof footer === "string") {

        modalFooter.innerHTML = footer;

    } else {

        modalFooter.innerHTML = "";

        if (footer) {

            modalFooter.appendChild(footer);

        }

    }

    overlay.classList.remove("hidden");

}

function closeModal() {

    const overlay = $("#modalOverlay");

    if (overlay) {

        overlay.classList.add("hidden");

    }

}

/* ==========================================================
   CONFIRM DIALOG
========================================================== */

function confirmDialog(

    title,

    message

) {

    return new Promise(resolve => {

        const overlay = $("#confirmOverlay");

        const titleEl = $("#confirmTitle");

        const msgEl = $("#confirmMessage");

        const okBtn = $("#confirmOk");

        const cancelBtn = $("#confirmCancel");

        titleEl.textContent = title;

        msgEl.textContent = message;

        overlay.classList.remove("hidden");

        const close = value => {

            overlay.classList.add("hidden");

            okBtn.removeEventListener(

                "click",

                okHandler

            );

            cancelBtn.removeEventListener(

                "click",

                cancelHandler

            );

            resolve(value);

        };

        const okHandler = () => close(true);

        const cancelHandler = () => close(false);

        okBtn.addEventListener(

            "click",

            okHandler

        );

        cancelBtn.addEventListener(

            "click",

            cancelHandler

        );

    });

}

/* ==========================================================
   LOCAL STORAGE
========================================================== */

function saveStorage(

    key,

    value

) {

    localStorage.setItem(

        key,

        JSON.stringify(value)

    );

}

function readStorage(

    key,

    defaultValue = null

) {

    try {

        const item = localStorage.getItem(key);

        if (item === null) {

            return defaultValue;

        }

        return JSON.parse(item);

    }

    catch {

        return defaultValue;

    }

}

function removeStorage(key) {

    localStorage.removeItem(key);

}

/* ==========================================================
   THEME
========================================================== */

function setTheme(theme) {

    if (theme === "dark") {

        document.body.classList.add("dark");

    } else {

        document.body.classList.remove("dark");

    }

    saveStorage(

        "theme",

        theme

    );

}

function loadTheme() {

    const theme = readStorage(

        "theme",

        "light"

    );

    setTheme(theme);

}

function toggleTheme() {

    if (

        document.body.classList.contains("dark")

    ) {

        setTheme("light");

    }

    else {

        setTheme("dark");

    }

}

/* ==========================================================
   FORM TO OBJECT
========================================================== */

function formToObject(form) {

    const formData = new FormData(form);

    const data = {};

    for (

        const [key, value]

        of formData.entries()

    ) {

        data[key] = value;

    }

    return data;

}

/* ==========================================================
   CLEAR FORM
========================================================== */

function clearForm(form) {

    form.reset();

}

/* ==========================================================
   URL PARAMETERS
========================================================== */

function getQueryParam(name) {

    return new URLSearchParams(

        window.location.search

    ).get(name);

}

/* ==========================================================
   ESCAPE HTML
========================================================== */

function escapeHtml(text) {

    const div = document.createElement("div");

    div.innerText = text;

    return div.innerHTML;

}

/* ==========================================================
   GLOBAL EVENTS
========================================================== */

document.addEventListener(

    "click",

    event => {

        if (

            event.target.id === "closeModal"

        ) {

            closeModal();

        }

        if (

            event.target.id === "modalOverlay"

        ) {

            closeModal();

        }

    }

);

/* ==========================================================
   GLOBAL UTILS OBJECT
========================================================== */

window.Utils = {

    $,

    $$,

    createElement,

    showLoading,

    hideLoading,

    showToast,

    formatDate,

    formatNumber,

    formatPercent,

    debounce,

    sleep,

    copyToClipboard,

    randomId,

    isEmptyObject,

    groupBy,

    openModal,

    closeModal,

    confirmDialog,

    saveStorage,

    readStorage,

    removeStorage,

    setTheme,

    loadTheme,

    toggleTheme,

    formToObject,

    clearForm,

    getQueryParam,

    escapeHtml

};

/* ==========================================================
   INITIALIZATION
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    () => {

        loadTheme();

    }

);