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

      if (
        typeof field === "object" &&
        field.value != null
      ) {

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

      if (
        typeof field === "object" &&
        field.rendered != null
      ) {

        return field.rendered;
      }

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
    required,
    showFourth
  ) {

    if (!measures || measures.length < required) {

      const lines = [
        "1. Actual",
        "2. Comparison",
        "3. Budget"
      ];

      if (showFourth) {
        lines.push("4. Total Capacity");
      }

      this.showError(
        element,
        `This visualization requires exactly ${required} measures.\n\n` +
        `Required sequence:\n` +
        lines.join("\n")
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
  },

  // =========================================
  // ADAPTIVE SCALE
  // =========================================

  getDynamicMax(actual, budget) {

    const max = Math.max(actual, budget, 1);

    if (max <= 5) {
      return max * 1.05;
    }

    if (max <= 10) {
      return max * 1.08;
    }

    if (max <= 100) {
      return max * 1.10;
    }

    if (max <= 1000) {
      return max * 1.15;
    }

    return max * 1.20;
  }
};

looker.plugins.visualizations.add({

  id: "kpi_budget_v8",
  label: "KPI vs Budget v8",

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

    // 4TH MEASURE

    show_fourth_measure: {
      type: "boolean",
      label: "Show 4th Measure",
      default: false
    },

    fourth_measure_label: {
      type: "string",
      label: "4th Measure Label",
      default: "Total Slots"
    },

    fourth_measure_font_size: {
      type: "number",
      label: "4th Measure Font Size",
      default: 14
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

      const showFourth =
        config.show_fourth_measure;

      const requiredCount =
        showFourth ? 4 : 3;

      if (
        !Utils.validateMeasureCount(
          root,
          measures,
          requiredCount,
          showFourth
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
      // 4TH MEASURE VALUES
      // =====================================

      let fourthValue = 0;
      let fourthDisplay = "—";

      if (
        showFourth &&
        measures.length >= 4
      ) {

        fourthValue =
          Utils.getNumericValue(
            row,
            measures[3].name
          );

        fourthDisplay =
          Utils.getDisplayValue(
            row,
            measures[3].name
          );
      }

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

      const barGradient =
        isGood
          ? "linear-gradient(90deg,#86efac 0%,#22c55e 100%)"
          : "linear-gradient(90deg,#fca5a5 0%,#ef4444 100%)";

      const textColor =
        isGood
          ? "#16a34a"
          : "#dc2626";

      // =====================================
      // DYNAMIC SCALE
      // =====================================

      const useFourthAsMax =
        showFourth && fourthValue > 0;

      const dynamicMax =
        useFourthAsMax
          ? fourthValue
          : Utils.getDynamicMax(
              actualValue,
              budgetValue
            );

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
      // BAR TRACK COLOR
      // =====================================

      const barTrackColor =
        useFourthAsMax
          ? "#bcc5d0"
          : "#e5e7eb";

      // =====================================
      // SMART LABEL ALIGNMENT
      // =====================================

      let labelTransform =
        "translateX(-50%)";

      if (targetPosition >= 92) {
        labelTransform =
          "translateX(-100%)";
      }

      if (targetPosition <= 8) {
        labelTransform =
          "translateX(0%)";
      }

      // =====================================
      // AXIS DISPLAY
      // =====================================

      let axisMaxDisplay =
        dynamicMax.toFixed(0);

      if (
        actualDisplay.toString().includes("%")
      ) {

        axisMaxDisplay =
          dynamicMax.toFixed(1) + "%";
      }

      // =====================================
      // DRILL SUPPORT
      // =====================================

      const actualField =
        row[measures[0].name];

      const hasDrill =
        actualField &&
        actualField.links &&
        actualField.links.length > 0;

      // =====================================
      // 4TH MEASURE LABEL CONFIG
      // =====================================

      const fourthLabel =
        config.fourth_measure_label || "Total Slots";

      const fourthFontSize =
        config.fourth_measure_font_size || 14;

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
          budgetValue,
          fourthValue,
          showFourth,
          useFourthAsMax,
          dynamicMax
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
            font-weight:700;
            line-height:1.1;
          }

          .main-value-drill{
            color:inherit;
            text-decoration:none;
            cursor:pointer;
            display:inline-block;
            user-select:none;
          }

          .main-value-drill:hover{
            opacity:0.85;
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
            margin-bottom:18px;
            font-size:14px;
            font-weight:600;
          }

          .bar-wrap{
            position:relative;
            border-radius:10px;
            overflow:visible;
          }

          .bar{
            height:100%;
            border-radius:10px;
          }

          .target-line{
            position:absolute;
            top:-5px;
            width:3px;
            background:#111827;
            border-radius:2px;
          }

          .budget-label{
            position:absolute;
            top:-34px;
            font-size:12px;
            font-weight:600;
            color:#6b7280;
            white-space:nowrap;
          }

          .axis{
            margin-top:8px;
            display:flex;
            justify-content:space-between;
            font-size:11px;
            color:#6b7280;
          }

          .budget-percent{
            font-size:14px;
            font-weight:600;
          }

          .bottom-row{
            margin-top:10px;
            display:flex;
            justify-content:space-between;
            align-items:center;
          }

          .fourth-measure-label{
            font-weight:500;
            color:#4b5563;
          }

          .fourth-measure-value{
            font-weight:700;
            color:#1f2937;
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

          <!-- KPI -->

          <div
            class="main-value"
            style="
              font-size:${config.kpi_font_size || 48}px;
            "
          >

            ${
              hasDrill

              ? `

                <span
                  id="kpi-drill-link"
                  class="main-value-drill"
                  role="button"
                  tabindex="0"
                >
                  ${actualDisplay}
                </span>

              `

              : actualDisplay
            }

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

            <span style="
              color:#6b7280;
              font-size:14px;
            ">
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

              </div>
            `
            : ""
          }

          <!-- BAR -->

          <div
            class="bar-wrap"
            style="
              height:${config.bar_height || 12}px;
              background:${barTrackColor};
            "
          >

            <div
              class="bar"
              style="
                width:${Math.min(barWidth,100)}%;
                background:${barGradient};
              "
            ></div>

            <div
              class="budget-label"
              style="
                left:${Math.min(targetPosition,100)}%;
                transform:${labelTransform};
              "
            >
              ${budgetDisplay}
            </div>

            <div
              class="target-line"
              style="
                left:${Math.min(targetPosition,100)}%;
                height:${(config.bar_height || 12) + 12}px;
              "
            ></div>

          </div>

          ${
            config.show_axis
            ? `
              <div class="axis">
                <span>0</span>
                <span>${axisMaxDisplay}</span>
              </div>
            `
            : ""
          }

          <!-- BOTTOM ROW: Budget % & 4th Measure -->

          ${
            (
              (config.show_budget_percent && budgetPercent !== null) ||
              (showFourth && fourthValue > 0)
            )
            ? `
              <div class="bottom-row">

                ${
                  config.show_budget_percent &&
                  budgetPercent !== null
                  ? `
                    <div
                      class="budget-percent"
                      style="
                        color:${textColor};
                      "
                    >
                      ${budgetPercent.toFixed(1)}% of budget
                    </div>
                  `
                  : `<div></div>`
                }

                ${
                  showFourth && fourthValue > 0
                  ? `
                    <div
                      class="fourth-measure-label"
                      style="
                        font-size:${fourthFontSize}px;
                      "
                    >
                      ${fourthLabel}:
                      <span class="fourth-measure-value">
                        ${fourthDisplay}
                      </span>
                    </div>
                  `
                  : ""
                }

              </div>
            `
            : ""
          }

        </div>
      `;

      // =====================================
      // DRILL MENU
      // =====================================

      const drillLink =
        root.querySelector("#kpi-drill-link");

      if (
        drillLink &&
        actualField &&
        actualField.links &&
        actualField.links.length
      ) {

        const openDrill =
          function(event) {

            event.preventDefault();
            event.stopPropagation();

            LookerCharts.Utils.openDrillMenu({
              links: actualField.links,
              event: event
            });
          };

        drillLink.addEventListener(
          "click",
          openDrill
        );

        drillLink.addEventListener(
          "keydown",
          function(event) {

            if (
              event.key === "Enter" ||
              event.key === " "
            ) {

              openDrill(event);
            }
          }
        );
      }

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
