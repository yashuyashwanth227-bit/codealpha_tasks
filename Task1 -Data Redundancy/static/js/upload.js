/*
===========================================================
NimbusCloud
Upload Module
Part 1 - Core Architecture
===========================================================
*/

"use strict";

const UploadModule = (() => {

    /* ==========================================================
       CONFIGURATION
    ========================================================== */

    const CONFIG = Object.freeze({

        MAX_FILE_SIZE: 20 * 1024 * 1024, // 20 MB

        ALLOWED_EXTENSION: ".csv",

        PREVIEW_LIMIT: 5

    });

    /* ==========================================================
       STATE
    ========================================================== */

    const state = {

        initialized: false,

        uploading: false,

        selectedFile: null,

        parsedRecords: [],

        detectedFields: [],

        uploadProgress: 0

    };

    /* ==========================================================
       DOM CACHE
    ========================================================== */

    const ui = {

        dropZone:
            document.getElementById("uploadDropZone"),

        fileInput:
            document.getElementById("csvFile"),

        browseButton:
            document.getElementById("browseCSV"),

        preview:
            document.getElementById("uploadPreview"),

        uploadButton:
            document.getElementById("uploadDataset"),

        downloadSample:
            document.getElementById("downloadSample"),

        manualForm:
            document.getElementById("manualRecordForm"),

        manualFields:
            document.getElementById("manualFields"),

        addField:
            document.getElementById("addFieldButton")

    };

    /* ==========================================================
       HELPERS
    ========================================================== */

    function resetState() {

        state.selectedFile = null;

        state.parsedRecords = [];

        state.detectedFields = [];

        state.uploadProgress = 0;

    }

    function clearPreview() {

        if (ui.preview) {

            ui.preview.innerHTML = "";

        }

    }

    function resetUpload() {

        resetState();

        clearPreview();

        if (ui.fileInput) {

            ui.fileInput.value = "";

        }

    }

    function setUploadButton(disabled) {

        if (!ui.uploadButton) {

            return;

        }

        ui.uploadButton.disabled = disabled;

    }

    function escape(value) {

        return Utils.escapeHtml(

            String(value ?? "")

        );

    }

    /* ==========================================================
       FILE VALIDATION
    ========================================================== */

    function validateFile(file) {

        if (!file) {

            showToast(

                "Please choose a CSV file.",

                "error"

            );

            return false;

        }

        if (

            !file.name

                .toLowerCase()

                .endsWith(CONFIG.ALLOWED_EXTENSION)

        ) {

            showToast(

                "Only CSV files are supported.",

                "error"

            );

            return false;

        }

        if (

            file.size >

            CONFIG.MAX_FILE_SIZE

        ) {

            showToast(

                `Maximum file size is ${CONFIG.MAX_FILE_SIZE / (1024 * 1024)} MB.`,

                "error"

            );

            return false;

        }

        return true;

    }

    /* ==========================================================
       FILE SELECTION
    ========================================================== */

    function setSelectedFile(file) {

        state.selectedFile = file;

    }

    function setParsedData(

        records,

        fields

    ) {

        state.parsedRecords = records;

        state.detectedFields = fields;

    }
    /* ==========================================================
   CSV PARSER
========================================================== */

    function parseCSV(file) {

        beginParsing();

        Papa.parse(file, {

            header: true,

            skipEmptyLines: true,

            dynamicTyping: false,

            complete(results) {

                finishParsing();

                const records = results.data || [];

                const fields = results.meta.fields || [];

                setParsedData(

                    records,

                    fields

                );

                renderPreview(records);

                showToast(

                    `${records.length.toLocaleString()} records loaded successfully.`

                );

            },

            error(error) {

                finishParsing();

                showToast(

                    error.message ||

                    "Unable to parse CSV.",

                    "error"

                );

            }

        });

    }

    function beginParsing() {

        setUploadButton(true);

        showLoading(

            "Reading CSV..."

        );

    }

    function finishParsing() {

        setUploadButton(false);

        hideLoading();

    }

/* ==========================================================
   CSV PREVIEW
========================================================== */

    function renderPreview(records) {

        clearPreview();

        if (

            !records ||

            records.length === 0

        ) {

            return;

        }

        const headers =

            Object.keys(records[0]);

        const wrapper =

            document.createElement("div");

        wrapper.className =

            "preview-wrapper";

        let html = `

            <h4>

                CSV Preview

            </h4>

            <p>

                <strong>

                    ${records.length.toLocaleString()}

                </strong>

                records detected

            </p>

            <table class="data-table">

                <thead>

                    <tr>

        `;

        headers.forEach(header => {

            html += `

                <th>

                    ${escape(header)}

                </th>

            `;

        });

        html += `

                    </tr>

                </thead>

                <tbody>

        `;

        records

            .slice(

                0,

                CONFIG.PREVIEW_LIMIT

            )

            .forEach(record => {

                html += "<tr>";

                headers.forEach(header => {

                    html += `

                        <td>

                            ${escape(

                                record[header]

                            )}

                        </td>

                    `;

                });

                html += "</tr>";

            });

        html += `

                </tbody>

            </table>

        `;

        wrapper.innerHTML = html;

        ui.preview.appendChild(wrapper);

    }

/* ==========================================================
   DRAG & DROP
========================================================== */

    function bindDropZone() {

        if (!ui.dropZone) {

            return;

        }

        [

            "dragenter",

            "dragover"

        ].forEach(event => {

            ui.dropZone.addEventListener(

                event,

                e => {

                    e.preventDefault();

                    ui.dropZone.classList.add(

                        "dragover"

                    );

                }

            );

        });

        [

            "dragleave",

            "dragend",

            "drop"

        ].forEach(event => {

            ui.dropZone.addEventListener(

                event,

                e => {

                    e.preventDefault();

                    ui.dropZone.classList.remove(

                        "dragover"

                    );

                }

            );

        });

        ui.dropZone.addEventListener(

            "drop",

            e => {

                const file =

                    e.dataTransfer.files[0];

                if (

                    !validateFile(file)

                ) {

                    return;

                }

                setSelectedFile(file);

                parseCSV(file);

            }

        );

    }

/* ==========================================================
   FILE BROWSER
========================================================== */

    function bindFileBrowser() {

        if (

            !ui.fileInput ||

            !ui.browseButton

        ) {

            return;

        }

        ui.browseButton.addEventListener(

            "click",

            () =>

                ui.fileInput.click()

        );

        ui.fileInput.addEventListener(

            "change",

            event => {

                const file =

                    event.target.files[0];

                if (

                    !validateFile(file)

                ) {

                    return;

                }

                setSelectedFile(file);

                parseCSV(file);

            }

        );

    }
    /* ==========================================================
   DATASET UPLOAD
========================================================== */

    async function uploadDataset() {

        if (state.uploading) {

            return;

        }

        if (state.parsedRecords.length === 0) {

            showToast(

                "Please load a CSV file first.",

                "error"

            );

            return;

        }

        state.uploading = true;

        setUploadButton(true);

        showLoading(

            "Uploading dataset..."

        );

        try {

            const result = await APIService.uploadBatch(

                state.parsedRecords,

                state.detectedFields

            );

            showToast(

                result?.message ||

                "Dataset uploaded successfully."

            );

            resetUpload();

            if (window.DashboardModule) {

                await DashboardModule.refresh();

            }

        }

        catch (error) {

            console.error(error);

            showToast(

                error.message ||

                "Dataset upload failed.",

                "error"

            );

        }

        finally {

            state.uploading = false;

            setUploadButton(false);

            hideLoading();

        }

    }

/* ==========================================================
   MANUAL RECORD
========================================================== */

    function collectManualRecord() {

        const record = {};

        const rows =

            ui.manualFields.querySelectorAll(

                ".field-row"

            );

        rows.forEach(row => {

            const key = row.querySelector(

                ".field-key"

            )?.value.trim();

            const value = row.querySelector(

                ".field-value"

            )?.value.trim();

            if (key) {

                record[key] = value;

            }

        });

        return record;

    }

    async function submitManualRecordForm() {

        const record =

            collectManualRecord();

        if (

            Object.keys(record).length === 0

        ) {

            showToast(

                "Please enter at least one field.",

                "error"

            );

            return;

        }

        showLoading(

            "Submitting record..."

        );

        try {

            await APIService.submitManualRecord(

                record,

                Object.keys(record)

            );

            showToast(

                "Record submitted successfully."

            );

            ui.manualFields.innerHTML = "";

            addManualField();

            if (window.DashboardModule) {

                await DashboardModule.refresh();

            }

        }

        catch (error) {

            console.error(error);

            showToast(

                error.message ||

                "Unable to submit record.",

                "error"

            );

        }

        finally {

            hideLoading();

        }

    }

/* ==========================================================
   SAMPLE DATASET
========================================================== */

    function downloadSample() {

        try {

            APIService.downloadSampleDataset();

        }

        catch (error) {

            showToast(

                error.message,

                "error"

            );

        }

    }

/* ==========================================================
   MANUAL FIELD CONTROLS
========================================================== */

    function createFieldRow(

        key = "",

        value = ""

    ) {

        const row = document.createElement("div");

        row.className = "field-row";

        row.innerHTML = `

            <input
                class="field-key"
                type="text"
                placeholder="Field Name"
                value="${escape(key)}">

            <input
                class="field-value"
                type="text"
                placeholder="Value"
                value="${escape(value)}">

            <button
                type="button"
                class="remove-field">

                ✕

            </button>

        `;

        return row;

    }

    function addManualField() {

        if (!ui.manualFields) {

            return;

        }

        ui.manualFields.appendChild(

            createFieldRow()

        );

    }
    /* ==========================================================
   EVENT BINDING
========================================================== */

    function bindManualForm() {

        if (!ui.manualForm) {

            return;

        }

        ui.manualForm.addEventListener(

            "submit",

            async event => {

                event.preventDefault();

                await submitManualRecordForm();

            }

        );

        if (ui.addField) {

            ui.addField.addEventListener(

                "click",

                addManualField

            );

        }

        /* Event Delegation */

        ui.manualFields.addEventListener(

            "click",

            event => {

                if (

                    event.target.classList.contains(

                        "remove-field"

                    )

                ) {

                    const row =

                        event.target.closest(

                            ".field-row"

                        );

                    if (row) {

                        row.remove();

                    }

                }

            }

        );

        if (

            ui.manualFields.children.length === 0

        ) {

            addManualField();

        }

    }

/* ==========================================================
   BUTTON EVENTS
========================================================== */

    function bindButtons() {

        if (ui.uploadButton) {

            ui.uploadButton.addEventListener(

                "click",

                uploadDataset

            );

        }

        if (ui.downloadSample) {

            ui.downloadSample.addEventListener(

                "click",

                downloadSample

            );

        }

    }

/* ==========================================================
   INITIALIZATION
========================================================== */

    function initialize() {

        if (state.initialized) {

            return;

        }

        state.initialized = true;

        bindDropZone();

        bindFileBrowser();

        bindManualForm();

        bindButtons();

        console.info(

            "Upload module initialized."

        );

    }

/* ==========================================================
   RESET
========================================================== */

    function clear() {

        resetUpload();

        if (ui.manualFields) {

            ui.manualFields.innerHTML = "";

            addManualField();

        }

    }

/* ==========================================================
   DESTROY
========================================================== */

    function destroy() {

        resetUpload();

        state.initialized = false;

    }

/* ==========================================================
   PUBLIC API
========================================================== */

    return Object.freeze({

        init: initialize,

        clear,

        destroy,

        reset: resetUpload,

        upload: uploadDataset,

        submitManual: submitManualRecordForm,

        addField: addManualField

    });

})();

/* ==========================================================
   AUTO STARTUP
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    () => {

        UploadModule.init();

    }

);

/* ==========================================================
   CLEANUP
========================================================== */

window.addEventListener(

    "beforeunload",

    () => {

        UploadModule.destroy();

    }

);

/* ==========================================================
   GLOBAL EXPORT
========================================================== */

window.UploadModule = UploadModule;

/* ==========================================================
   END OF UPLOAD MODULE
========================================================== */