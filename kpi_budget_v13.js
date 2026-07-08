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

  id: "kpi_budget_v13",
  label: "KPI vs Budget v13",

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
    // 4TH MEASURE TOGGLE
    show_fourth_measure: {
      type: "boolean",
      label: "Enable 4th Measure Line",
      default: false
    },
    // NEW: 4TH MEASURE CUSTOMIZABLE LABEL
    fourth_measure_label_text: {
      type: "string",
      label: "4th Measure Custom Label",
      default: "Slots"
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
      const barColor = isGood ? "#57C596" : "#EF3440";
      const textColor = isGood ? "#16a34a" : "#dc2626";

      // =====================================
      // DYNAMIC GRAPH SCALE
      // =====================================
      const dynamicMax = Utils.getDynamicMax(actualValue, budgetValue, fourthValue);
      const barWidth = (actualValue / dynamicMax) * 100;
      const targetPosition = (budgetValue / dynamicMax) * 100;
      const fourthPosition = config.show_fourth_measure ? (fourthValue / dynamicMax) * 100 : 0;

      // =====================================
      // SMART LABEL ALIGNMENT (BUDGET)
      // =====================================
      let labelTransform = "translateX(-50%)";
      if (targetPosition >= 92) labelTransform = "translateX(-100%)";
      if (targetPosition <= 8) labelTransform = "translateX(0%)";

      // =====================================
      // SMART LABEL ALIGNMENT (4TH MEASURE)
      // =====================================
      let fourthLabelTransform = "translateX(-50%)";
      if (fourthPosition >= 92) fourthLabelTransform = "translateX(-100%)";
      if (fourthPosition <= 8) fourthLabelTransform = "translateX(0%)";

      // =====================================
      // AXIS GENERATION
      // =====================================
      let axisMaxDisplay = dynamicMax.toFixed(0);
      if (actualDisplay.toString().includes("%")) {
        axisMaxDisplay = dynamicMax.toFixed(1) + "%";
      }

      if (config.debug_mode) {
        console.log({ queryResponse, data, measures, actualValue, comparisonValue, budgetValue, fourthValue });
      }

      // =====================================
      // RENDER CANVAS
      // =====================================
      root.innerHTML = `
        <style>
          .viz-wrap {
            font-family: Inter, Arial, sans-serif;
            padding: 16px;
            color: #111827;
          }
          .header {
            font-weight: 600;
            margin-bottom: 20px;
          }
          .main-value {
            font-weight: 700;
            line-height: 1.1;
          }
          .comparison-row {
            margin-top: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .badge {
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
          }
          .green { background: #dcfce7; color: #16a34a; }
          .red { background: #fee2e2; color: #dc2626; }
          .prior {
            margin-top: 8px;
            color: #6b7280;
            font-size: 14px;
          }
          .divider {
            border-top: 1px solid #e5e7eb;
            margin: 20px 0;
          }
          .budget-row {
            display: block;
            margin-bottom: 12px;
            font-size: 14px;
            font-weight: 600;
          }
          .bar-wrap {
            position: relative;
            background: #e5e7eb;
            border-radius: 10px;
            overflow: visible;
            margin-top: 36px;
            margin-bottom: 36px;
          }
          .bar {
            height: 100%;
            border-radius: 10px;
          }
          .target-line {
            position: absolute;
            top: -6px;
            width: 3px;
            background: #111827;
            border-radius: 2px;
            z-index: 6;
          }
          .budget-label {
            position: absolute;
            top: -32px;
            font-size: 12px;
            font-weight: 600;
            color: #6b7280;
            white-space: nowrap;
          }
          .fourth-line {
            position: absolute;
            top: -6px;
            width: 0px;
            border-left: 3px dotted #111827;
            z-index: 5;
          }
          .fourth-label {
            position: absolute;
            bottom: -32px;
            font-size: 12px;
            font-weight: 600;
            color: #6b7280;
            white-space: nowrap;
          }
          .axis {
            margin-top: 8px;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #6b7280;
          }
          .budget-percent {
            margin-top: 10px;
            font-size: 14px;
            font-weight: 600;
          }
        </style>

        <div class="viz-wrap">
          ${config.show_header ? `<div class="header" style="font-size:${config.header_font_size || 18}px;">${config.header_text}</div>` : ""}

          <div class="main-value" style="font-size:${config.kpi_font_size || 48}px;">${actualDisplay}</div>

          <div class="comparison-row">
            ${variancePercent !== null ? `
              <span class="badge ${variancePercent >= 0 ? "green" : "red"}">
                ${variancePercent >= 0 ? "▲" : "▼"} ${Math.abs(variancePercent).toFixed(1)}%
              </span>
            ` : ""}
            <span style="color:#6b7280; font-size:14px;">vs prior period</span>
          </div>

          <div class="prior">Prior: ${comparisonDisplay}</div>
          <div class="divider"></div>

          ${config.show_budget_section ? `<div class="budget-row"><div>${config.budget_section_text}</div></div>` : ""}

          <div class="bar-wrap" style="height:${config.bar_height || 12}px;">
            
            <div class="bar" style="width:${Math.min(barWidth, 100)}%; background:${barColor};"></div>

            <div class="budget-label" style="left:${targetPosition}%; transform:${labelTransform};">${budgetDisplay}</div>

            <div class="target-line" style="left:${targetPosition}%; height:${(config.bar_height || 12) + 12}px;"></div>

            ${config.show_fourth_measure ? `
              <div class="fourth-label" style="left:${fourthPosition}%; transform:${fourthLabelTransform};">
                ${config.fourth_measure_label_text || "Slots"}: ${fourthDisplay}
              </div>
              
              <div class="fourth-line" style="left:${fourthPosition}%; height:${(config.bar_height || 12) + 12}px;"></div>
            ` : ""}
          </div>

          ${config.show_axis ? `<div class="axis"><span>0</span><span>${axisMaxDisplay}</span></div>` : ""}

          ${config.show_budget_percent && budgetPercent !== null ? `
            <div class="budget-percent" style="color:${textColor};">${budgetPercent.toFixed(1)}% of budget</div>
          ` : ""}
        </div>
      `;

    } catch(e) {
      console.error(e);
      Utils.showError(root, "Unexpected Visualization Error\n\n" + e.message);
    }
    done();
  }
});
