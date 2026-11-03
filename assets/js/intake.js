/* OutLiners intake forms: client-side validation + preview mode.
 *
 * PREVIEW MODE: every form carries data-preview="true". While it is set,
 * submit NEVER sends anything anywhere — no fetch, no navigation. Validation
 * runs so the UX can be reviewed; a valid submit only reveals the status box
 * explaining that submissions are not yet active. When the Azure Functions
 * backend (see docs/FORMS_BACKEND_CONTRACT.md) goes live, remove the
 * attribute and implement the fetch described in the contract.
 */
(function () {
  "use strict";

  var MAX_FILE_BYTES = 5 * 1024 * 1024; // keep in sync with the backend contract
  var ALLOWED_EXT = /\.(pdf|docx?)$/i;

  document.querySelectorAll("form.intake-form").forEach(function (form) {
    // Spam control support: record when the visitor actually opened the form.
    var started = form.querySelector('input[name="form_started_at"]');
    if (started) started.value = String(Date.now());

    function wrapper(control) {
      return control.closest(".field");
    }

    function showError(control, message) {
      var box = wrapper(control);
      if (!box) return;
      var err = box.querySelector(".field-error");
      box.classList.add("has-error");
      control.setAttribute("aria-invalid", "true");
      if (err) {
        err.textContent = message;
        err.hidden = false;
        control.setAttribute("aria-describedby", err.id);
      }
    }

    function clearError(control) {
      var box = wrapper(control);
      if (!box) return;
      var err = box.querySelector(".field-error");
      box.classList.remove("has-error");
      control.removeAttribute("aria-invalid");
      control.removeAttribute("aria-describedby");
      if (err) { err.hidden = true; err.textContent = ""; }
    }

    function validateControl(control) {
      var box = wrapper(control);
      if (!box) return true;
      var messages = box.dataset;
      var value = (control.value || "").trim();

      // Required
      if (control.required) {
        var empty = control.type === "checkbox" ? !control.checked
          : control.type === "file" ? control.files.length === 0
          : value === "";
        if (empty) { showError(control, messages.error || ""); return false; }
      }

      // Format (only when something was entered)
      if (value !== "" && messages.errorFormat) {
        if (control.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
          showError(control, messages.errorFormat); return false;
        }
        if (control.type === "url" && !/^https:\/\/[^\s]+\.[^\s]+/i.test(value)) {
          showError(control, messages.errorFormat); return false;
        }
      }

      // File type and size
      if (control.type === "file" && control.files.length > 0) {
        var file = control.files[0];
        if (!ALLOWED_EXT.test(file.name)) {
          showError(control, messages.errorType || ""); return false;
        }
        if (file.size > MAX_FILE_BYTES) {
          showError(control, messages.errorSize || ""); return false;
        }
      }

      clearError(control);
      return true;
    }

    var controls = Array.prototype.slice.call(
      form.querySelectorAll(".field input, .field select, .field textarea"));

    controls.forEach(function (control) {
      control.addEventListener("blur", function () { validateControl(control); });
      control.addEventListener("change", function () { validateControl(control); });
      control.addEventListener("input", function () {
        if (wrapper(control) && wrapper(control).classList.contains("has-error")) {
          validateControl(control);
        }
      });
    });

    form.addEventListener("submit", function (event) {
      // Preview mode: nothing ever leaves the browser.
      event.preventDefault();

      var firstInvalid = null;
      controls.forEach(function (control) {
        if (!validateControl(control) && !firstInvalid) firstInvalid = control;
      });

      var status = form.querySelector(".form-status");
      if (firstInvalid) {
        if (status) status.hidden = true;
        firstInvalid.focus();
        return;
      }

      if (form.dataset.preview === "true") {
        if (status) {
          status.hidden = false;
          status.focus();
        }
        return;
      }

      // The preview attribute is a separate launch gate. No request reaches this
      // branch unless an approved release explicitly sets data-preview="false".
      if (form.dataset.preview !== "false") return;
      var english = document.documentElement.lang !== "el";
      var button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      var apiOrigin = "https://func-outliners-api-8dc62205-cudka7c9c7hdajdk.northeurope-01.azurewebsites.net";
      var endpoint = new URL(form.getAttribute("action"), apiOrigin);
      if (endpoint.origin !== apiOrigin || !/^\/api\/(submit-cv|request-talent)$/.test(endpoint.pathname)) return;
      fetch(endpoint.href, { method: "POST", body: new FormData(form), credentials: "omit", redirect: "error" })
        .then(function (response) {
          if (!response.ok) throw { status: response.status };
          return response.json();
        }).then(function (result) {
          if (result.ok !== true) throw {};
          if (status) { status.textContent = english ? "Thank you. Your submission has been stored securely." : "Σε ευχαριστούμε. Η υποβολή σου αποθηκεύτηκε με ασφάλεια."; status.hidden = false; status.focus(); }
          form.reset(); if (started) started.value = String(Date.now());
        }).catch(function (error) {
          if (status) { status.textContent = error.status === 429
            ? (english ? "Please try again later. The submission limit has been reached." : "Δοκίμασε ξανά αργότερα. Έχει συμπληρωθεί το όριο υποβολών.")
            : (english ? "Your submission could not be completed. Please check the fields and try again." : "Η υποβολή δεν ολοκληρώθηκε. Έλεγξε τα πεδία και δοκίμασε ξανά."); status.hidden = false; status.focus(); }
        }).finally(function () { if (button) button.disabled = false; });
    });
  });
})();
