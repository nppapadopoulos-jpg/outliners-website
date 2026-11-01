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

      // Future (backend live): build FormData and POST to form.action per
      // docs/FORMS_BACKEND_CONTRACT.md. Intentionally not implemented yet.
    });
  });
})();
