const Utils = {

  // =========================================
  // ERROR HANDLING
  // =========================================

  showError(element, message) {
    if (!element) return;
    element.innerHTML = `
      <div style="
        padding:20px;
        margin:12px;
        border-radius:8px;
        background:#fef2f2;
        border:1px solid #fecaca;
        color:#991b1b;
        font-family:Inter,Arial,sans-serif;
      ">
        <div style="
          font-size:16px;
          font-weight:700;
          margin-bottom:10px;
        ">
          Visualization Cannot Render
        </div>
        <div style="
          white-space:pre-line;
          line-height:1.5;
        ">
          ${message}
        </div>
      </div>
    `;
  },

  // =========================================
  // FIELD HELPERS
  // =========================================

  getMeasures(queryResponse) {
    return (
      queryResponse &&
      queryResponse.fields &&
      queryResponse.fields.measure_like
    ) || [];
  },

  // =========================================
  // NUMERIC VALUE
  // =========================================

  getNumericValue(row, fieldName) {
    try {
      const field = row[fieldName];
      if (field == null) return 0;

      if (typeof field === "object" && field.value != null) {
        return this.cleanNumber(field.value);
      }
      if (typeof field === "number") {
        return field;
      }
      if (typeof field === "string") {
        return this.cleanNumber(field);
      }
      return 0;
    } catch(e) {
      return 0;
    }
  },

  // =========================================
  // DISPLAY VALUE
  // =========================================

  getDisplayValue(row, fieldName) {
    try {
      const field = row[fieldName];
      if (field == null) return "—";

      if (typeof field === "object" && field.rendered != null) {
        return field.rendered;
      }
      if (typeof field === "object" && field.value != null) {
        return field.value;
      }
      return field;
    } catch(e) {
      return "—";
    }
  },

  // =========================================
  // CLEAN NUMBER
  // =========================================

  cleanNumber(value) {
    if (value == null) return 0;
    if (typeof value === "number") {
      return value;
    }

    const cleaned = String(value)
      .replace(/,/g, "")
      .replace(/\$/g, "")
      .replace(/%/g, "")
      .trim();

    const parsed = Number(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  },

  // =========================================
  // VALIDATIONS
  // =========================================

  validateMeasureCount(element, measures, required) {
    if (!measures || measures.length < required) {
      this.showError(
        element,
        `This visualization currently requires at least ${required} measures based on your configuration settings.\n\n` +
        `Required sequence:\n` +
        `1. Actual\n` +
        `2. Comparison\n` +
        `3. Budget\n` +
        `4. 4th Metric (Optional/If enabled)`
      );
      return false;
    }
    return true;
  },

  validateData(element, data) {
    if (!data || !data.length) {
      this.showError(element, "No data returned from query.");
      return false;
    }
    return true;
  },

  detectPivot(queryResponse) {
    return (
      queryResponse &&
      queryResponse.fields &&
      queryResponse.fields.pivots &&
      queryResponse.fields.pivots.length > 0
    );
  },

  // =========================================
  // ADAPTIVE SCALE
  // =========================================

  getDynamicMax(actual, budget, fourthValue = 0) {
    const max = Math.max(actual, budget, fourthValue, 1);

    if (max <= 5) return max * 1.05;
    if (max <= 10) return max * 1.08;
    if (max <= 100) return max * 1.10;
    if (max <= 1000) return max * 1.15;
    return max * 1.20;
  }
};

looker.plugins.visualizations.add({

  id: "kpi_budget_v9",
  label: "KPI vs Budget v9",

  options: {
    // HEADER
    show_header: {
      type: "boolean",
      label: "Show Header",
      default: true
    },
    header_text: {
      type: "string",
      label: "Header Text",
      default: "Actual vs Budget"
    },
    header_font_size: {
      type: "number",
      label: "Header Font Size",
      default: 18
    },
    // KPI
    kpi_font_size: {
      type: "number",
      label: "KPI Font Size",
      default: 48
    },
    // BUDGET SECTION
    show_budget_section: {
      type: "boolean",
      label: "Show Actual vs Budget",
      default: true
    },
    budget_section_text: {
      type: "string",
      label: "Actual vs Budget Text",
      default: "Actual vs Budget"
    },
    // NEW: 4TH MEASURE TOGGLE
    show_fourth_measure: {
      type: "boolean",
      label: "Enable 4th Measure Line",
      default: false
    },
    // BAR
    bar_height: {
      type: "number",
      label: "Bar Height",
      default: 12
    },
    // AXIS
    show_axis: {
      type: "boolean",
      label: "Show Axis",
      default: false
    },
    // BUDGET %
    show_budget_percent: {
      type: "boolean",
      label: "Show % of Budget",
      default: true
    },
    // DEBUG
    debug_mode: {
      type: "boolean",
      label: "Debug Mode",
      default: false
    }
  },

  create: function(element) {
    element.innerHTML = `<div id="viz-root"></div>`;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const root = element.querySelector("#viz-root");

    try {
      // =====================================
      // PIVOT CHECK
      // =====================================
      if (Utils.detectPivot(queryResponse)) {
        Utils.showError(root, "Pivoted results are not supported.");
        return done();
      }

      // =====================================
      // MEASURES VALIDATION (DYNAMIC DETERMINATION)
      // =====================================
      const measures = Utils.getMeasures(queryResponse);
      const requiredCount = config.show_fourth_measure ? 4 : 3;

      if (!Utils.validateMeasureCount(root, measures, requiredCount)) {
        return done();
      }

      // =====================================
      // DATA CHECK
      // =====================================
      if (!Utils.validateData(root, data)) {
        return done();
      }

      const row = data[0];

      // =====================================
      // VALUES MAPPING
      // =====================================
      const actualValue = Utils.getNumericValue(row, measures[0].name);
      const comparisonValue = Utils.getNumericValue(row, measures[1].name);
      const budgetValue = Utils.getNumericValue(row, measures[2].name);
      const fourthValue = config.show_fourth_measure ? Utils.getNumericValue(row, measures[3].name) : 0;

      // =====================================
      // DISPLAY VALUES MAPPING
      // =====================================
      const actualDisplay = Utils.getDisplayValue(row, measures[0].name);
      const comparisonDisplay = Utils.getDisplayValue(row, measures[1].name);
      const budgetDisplay = Utils.getDisplayValue(row, measures[2].name);
      const fourthDisplay = config.show_fourth_measure ? Utils.getDisplayValue(row, measures[3].name) : "";

      // =====================================
      // CALCULATIONS
      // =====================================
      const variancePercent = comparisonValue !== 0 ? ((actualValue - comparisonValue) / comparisonValue) * 100 : null;
      const budgetPercent = budgetValue !== 0 ? (actualValue / budgetValue) * 100 : null;

      // =====================================
      // COLORS & GRADIENTS
      // =====================================
      const isGood = actualValue >= budgetValue;
      const barGradient = isGood 
        ? "linear-gradient(90deg,#86efac 0%,#22c55e 100%)" 
        : "linear-gradient(90deg,#fca5a5 0%,#ef4444 100%)";
      const textColor = isGood ? "#16a34a" : "#dc2626";

      // =====================================
      // DYNAMIC GRAPH SCALE
      // =====================================
      const dynamicMax = Utils.getDynamicMax(actualValue, budgetValue, fourthValue);
      const barWidth = (actualValue / dynamicMax) * 100;
      const targetPosition = (budgetValue / dynamicMax) * 100;
      const fourthPosition = config.show_fourth_measure ? (fourthValue / dynamicMax) * 100 : 0;

      // =================================
