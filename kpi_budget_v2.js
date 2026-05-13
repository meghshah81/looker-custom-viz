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

  getDimensions(queryResponse) {

    return (
      queryResponse &&
      queryResponse.fields &&
      queryResponse.fields.dimension_like
    ) || [];
  },

  // =========================================
  // NUMERIC VALUE
  // Used for calculations
  // =========================================

  getNumericValue(row, fieldName) {

    try {

      const field = row[fieldName];

      if (field == null) return 0;

      // Standard Looker object
      if (
        typeof field === "object" &&
        field.value != null
      ) {

        return this.cleanNumber(field.value);
      }

      // Primitive number
      if (typeof field === "number") {

        return field;
      }

      // Primitive string
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
  // Preserves Looker formatting
  // =========================================

  getDisplayValue(row, fieldName) {

    try {

      const field = row[fieldName];

      if (field == null) return "—";

      // Preserve Looker formatting
      if (
        typeof field === "object" &&
        field.rendered != null
      ) {

        return field.rendered;
      }

      // Fallback to raw value
      if (
        typeof field === "object" &&
        field.value != null
      ) {

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

  validateMeasureCount(
    element,
    measures,
    required
  ) {

    if (!measures || measures.length !== required) {

      this.showError(
        element,
        `This visualization requires exactly ${required} measures.\n\n` +
        `Required sequence:\n` +
        `1. Actual\n` +
        `2. Comparison\n` +
        `3. Budget\n\n` +
        `Current Measures: ${measures ? measures.length : 0}`
      );

      return false;
    }

    return true;
  },

  validateData(element, data) {

    if (!data || !data.length) {

      this.showError(
        element,
        "No data returned from query."
      );

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
  }
};

looker.plugins.visualizations.add({

  id: "kpi_budget_v2",
  label: "KPI vs Budget",

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
      default: "Net Fill Rate %"
    },

    header_font_size: {
      type: "number",
      label: "Header Font Size",
      default: 18
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

    element.innerHTML = `
      <div id="viz-root"></div>
    `;
  },

  updateAsync: function(
    data,
    element,
    config,
    queryResponse,
    details,
    done
  ) {

    const root =
      element.querySelector("#viz-root");

    try {

      // =====================================
      // PIVOT CHECK
      // =====================================

      if (
        Utils.detectPivot(queryResponse)
      ) {

        Utils.showError(
          root,
          "Pivoted results are not supported."
        );

        return done();
      }

      // =====================================
      // MEASURES
      // =====================================

      const measures =
        Utils.getMeasures(queryResponse);

      if (
        !Utils.validateMeasureCount(
          root,
          measures,
          3
        )
      ) {
        return done();
      }

      // =====================================
      // DATA CHECK
      // =====================================

      if (
        !Utils.validateData(
          root,
          data
        )
      ) {
        return done();
      }

      // =====================================
      // FIRST ROW
      // =====================================

      const row = data[0];

      // =====================================
      // VALUES
      // =====================================

      const actualValue =
        Utils.getNumericValue(
          row,
          measures[0].name
        );

      const comparisonValue =
        Utils.getNumericValue(
          row,
          measures[1].name
        );

      const budgetValue =
        Utils.getNumericValue(
          row,
          measures[2].name
        );

      // =====================================
      // DISPLAY VALUES
      // =====================================

      const actualDisplay =
        Utils.getDisplayValue(
          row,
          measures[0].name
        );

      const comparisonDisplay =
        Utils.getDisplayValue(
          row,
          measures[1].name
        );

      const budgetDisplay =
        Utils.getDisplayValue(
          row,
          measures[2].name
        );

      // =====================================
      // CALCULATIONS
      // =====================================

      const variancePercent =
        comparisonValue !== 0
          ? (
              (
                actualValue -
                comparisonValue
              ) / comparisonValue
            ) * 100
          : null;

      const budgetPercent =
        budgetValue !== 0
          ? (
              actualValue /
              budgetValue
            ) * 100
          : null;

      // =====================================
      // COLORS
      // =====================================

      const isGood =
        actualValue >= budgetValue;

      const color =
        isGood
          ? "#16a34a"
          : "#dc2626";

      // =====================================
      // DYNAMIC SCALE
      // =====================================

      const dynamicMax =
        Math.max(
          actualValue,
          budgetValue,
          1
        ) * 1.15;

      const barWidth =
        (
          actualValue /
          dynamicMax
        ) * 100;

      const targetPosition =
        (
          budgetValue /
          dynamicMax
        ) * 100;

      // =====================================
      // DEBUG
      // =====================================

      if (config.debug_mode) {

        console.log({
          queryResponse,
          data,
          measures,
          actualValue,
          comparisonValue,
          budgetValue
        });
      }

      // =====================================
      // RENDER
      // =====================================

      root.innerHTML = `

        <style>

          .viz-wrap{
            font-family:Inter,Arial,sans-serif;
            padding:16px;
            color:#111827;
          }

          .header{
            font-weight:600;
            margin-bottom:20px;
          }

          .main-value{
            font-size:48px;
            font-weight:700;
            line-height:1.1;
          }

          .comparison-row{
            margin-top:10px;
            display:flex;
            align-items:center;
            gap:8px;
          }

          .badge{
            padding:4px 8px;
            border-radius:6px;
            font-size:13px;
            font-weight:600;
          }

          .green{
            background:#dcfce7;
            color:#16a34a;
          }

          .red{
            background:#fee2e2;
            color:#dc2626;
          }

          .prior{
            margin-top:8px;
            color:#6b7280;
            font-size:14px;
          }

          .divider{
            border-top:1px solid #e5e7eb;
            margin:20px 0;
          }

          .budget-row{
            display:flex;
            justify-content:space-between;
            margin-bottom:8px;
            font-size:14px;
            font-weight:600;
          }

          .bar-wrap{
            position:relative;
            background:#e5e7eb;
            border-radius:6px;
          }

          .bar{
            height:100%;
            border-radius:6px;
          }

          .target-line{
            position:absolute;
            top:-3px;
            width:2px;
            background:#111827;
          }

          .axis{
            margin-top:6px;
            display:flex;
            justify-content:space-between;
            font-size:11px;
            color:#6b7280;
          }

          .budget-percent{
            margin-top:8px;
            font-size:14px;
            font-weight:600;
          }

        </style>

        <div class="viz-wrap">

          ${
            config.show_header
            ? `
              <div
                class="header"
                style="
                  font-size:${config.header_font_size || 18}px;
                "
              >
                ${config.header_text}
              </div>
            `
            : ""
          }

          <!-- MAIN KPI -->

          <div class="main-value">
            ${actualDisplay}
          </div>

          <!-- COMPARISON -->

          <div class="comparison-row">

            ${
              variancePercent !== null
              ? `
                <span class="
                  badge
                  ${
                    variancePercent >= 0
                    ? "green"
                    : "red"
                  }
                ">

                  ${
                    variancePercent >= 0
                    ? "▲"
                    : "▼"
                  }

                  ${Math.abs(
                    variancePercent
                  ).toFixed(1)}%

                </span>
              `
              : ""
            }

            <span style="color:#6b7280;font-size:14px;">
              vs prior period
            </span>

          </div>

          <!-- PRIOR -->

          <div class="prior">
            Prior: ${comparisonDisplay}
          </div>

          <div class="divider"></div>

          ${
            config.show_budget_section
            ? `
              <div class="budget-row">

                <div>
                  ${config.budget_section_text}
                </div>

                <div style="color:#6b7280;">
                  Budget: ${budgetDisplay}
                </div>

              </div>
            `
            : ""
          }

          <!-- BAR -->

          <div
            class="bar-wrap"
            style="
              height:${config.bar_height || 12}px;
            "
          >

            <div
              class="bar"
              style="
                width:${Math.min(barWidth,100)}%;
                background:${color};
              "
            ></div>

            <div
              class="target-line"
              style="
                left:${targetPosition}%;
                height:${(config.bar_height || 12) + 6}px;
              "
            ></div>

          </div>

          <!-- AXIS -->

          ${
            config.show_axis
            ? `
              <div class="axis">
                <span>0</span>
                <span>${dynamicMax.toFixed(0)}</span>
              </div>
            `
            : ""
          }

          <!-- % OF BUDGET -->

          ${
            config.show_budget_percent &&
            budgetPercent !== null
            ? `
              <div
                class="budget-percent"
                style="
                  color:${color};
                "
              >
                ${budgetPercent.toFixed(1)}% of budget
              </div>
            `
            : ""
          }

        </div>
      `;

    } catch(e) {

      console.error(e);

      Utils.showError(
        root,
        "Unexpected Visualization Error\n\n" +
        e.message
      );
    }

    done();
  }
});
