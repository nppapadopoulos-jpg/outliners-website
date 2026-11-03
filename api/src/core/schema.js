// Single source of truth for both intake forms. Field names, requirements
// and limits mirror docs/FORMS_BACKEND_CONTRACT.md and the markup of
// /request-talent/ and /submit-cv/ (asserted by tests/contract-alignment).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HTTPS_URL_RE = /^https:\/\/[^\s]+\.[^\s]+/i;

const common = {
  full_name: { required: true, max: 200 },
  email: { required: true, max: 254, validate: v => EMAIL_RE.test(v) || "format" },
  consent: { required: true, validate: v => v === "yes" || "required" },
  lang: { required: true, validate: v => (v === "en" || v === "el") || "format" },
};

export const FORMS = {
  "request-talent": {
    fields: {
      ...common,
      phone: { required: false, max: 50 },
      company: { required: true, max: 200 },
      job_title: { required: true, max: 200 },
      location: { required: true, max: 200 },
      employment_type: {
        required: true,
        enum: ["full-time", "part-time", "contract-interim", "executive", "other"],
      },
      timeline: {
        required: true,
        enum: ["asap", "1-month", "1-3-months", "3-plus-months", "exploring"],
      },
      salary_range: { required: false, max: 100 },
      job_description: { required: true, max: 5000, multiline: true },
    },
    file: { name: "attachment", required: false },
  },
  "submit-cv": {
    fields: {
      ...common,
      phone: { required: true, max: 50 },
      specialization: { required: true, max: 200 },
      position_reference: { required: false, max: 200 },
      talent_pool_consent: { required: false, enum: ["yes"] },
      preferred_location: { required: true, max: 200 },
      linkedin: { required: false, max: 300, validate: v => HTTPS_URL_RE.test(v) || "format" },
      introduction: { required: false, max: 1500, multiline: true },
    },
    file: { name: "cv", required: true },
  },
};

// Fields consumed by spam controls, never stored.
export const CONTROL_FIELDS = ["website", "form_started_at"];
