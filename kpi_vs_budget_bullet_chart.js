looker.plugins.visualizations.add({
  id: "kpi_vs_budget_bullet_chart",
  label: "KPI vs Budget Bullet Chart",

  options: {

    // =========================
    // HEADER
    // =========================

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

    // =========================
    // BAR
    // =========================

    bar_height: {
      type: "number",
      label: "Bar Height",
      default: 12
    },

    // =========================
    // ACTUAL VS BUDGET LABEL
    // =========================

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

    // =========================
    // AXIS
    // =========================

    show_axis: {
      type: "boolean",
      label: "Show Axis Labels",
      default: false
    },

    // =========================
    // BUDGET %
    // =========================

    show_budget_percent: {
      type: "boolean",
      label: "Show % of Budget",
      default: true
    },

    // =========================
    // DEBUG
    // =========================

    debug_mode: {
      type: "boolean",
      label: "Debug Mode",
      default: false
    }
  },

  create: function (element) {

    element.innerHTML = `
      <style>

        .kpi-budget-wrap{
          font-family:Inter,Arial,sans-serif;
          padding:16px;
          color:#111827;
        }

        .kpi-header{
          font-weight:600;
          margin-bottom:20px;
        }

        .kpi-main-value{
          font-size:48px;
          font-weight:700;
          line-height:1.1;
        }

        .comparison-row{
          margin-top:10px;
          display:flex;
          align-items:center;
          gap:8px;
          font-size:14px;
        }

        .variance-badge{
          padding:4px 8px;
          border-radius:6px;
          font-weight:600;
        }

        .badge-green{
          background:#dcfce7;
          color:#16a34a;
        }

        .badge-red{
          background:#fee2e2;
          color:#dc2626;
        }

        .prior-row{
          margin-top:8px;
          font-size:14px;
          color:#6b7280;
        }

        .divider{
          border-top:1px solid #e5e7eb;
          margin:20px 0;
        }

        .budget-header-row{
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-bottom:8px;
          font-size:14px;
          font-weight:600;
        }

        .budget-right{
          color:#6b7280;
          font-weight:500;
        }

        .bar-container{
          position:relative;
          background:#e5e7eb;
          border-radius:6px;
          overflow:visible;
        }

        .bar-fill{
          height:100%;
          border-radius:6px;
        }

        .budget-line{
          position:absolute;
          top:-3px;
          width:2px;
          background:#111827;
        }

        .axis-row{
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

        .viz-error{
          padding:20px;
          margin:12px;
          border-radius:8px;
          background:#fef2f2;
          border:1px solid #fecaca;
          color:#991b1b;
          font-family:Inter,Arial;
        }

        .viz-error-title{
          font-weight:700;
          margin-bottom:10px;
        }

      </style>

      <div id="kpi-budget-root"></div>
    `;
  },

  updateAsync: function (
    data,
    element,
    config,
    queryResponse,
    details,
    done
  ) {

    const root =
      element.querySelector("#kpi-budget-root");

    try {

      // ============================================
      // VALIDATIONS
      // ============================================

      if (!window.LookerVizUtils) {

        root.innerHTML = `
          <div class="viz-error">
            <div class="viz-error-title">
              Utility Framework Missing
            </div>

            <div>
              LookerVizUtils was not found.
              Ensure utils.js loads before this visualization.
            </div>
          </div>
        `;

        return done();
      }

      const measures =
        LookerVizUtils.getMeasures(queryResponse);

      // Validate measure count
      if (
        !LookerVizUtils.validateMeasureCount(
          root,
          measures,
          3
        )
      ) {
        return done();
      }

      // Validate data
      if (!data || !data.length) {

        LookerVizUtils.showError(
          root,
          "No data returned from query."
        );

        return done();
      }

      // Detect pivots
      if (
        LookerVizUtils.detectPivot(queryResponse)
      ) {

        LookerVizUtils.showError(
          root,
          "Pivoted results are not supported in this visualization."
        );

        return done();
      }

      const row = data[0];

      // ============================================
      // VALUES
      // ============================================

      const actualValue =
        LookerVizUtils.getNumericValue(
          row,
          measures[0].name
        );

      const comparisonValue =
        LookerVizUtils.getNumericValue(
          row,
          measures[1].name
        );

      const budgetValue =
        LookerVizUtils.getNumericValue(
          row,
          measures[2].name
        );

      // ============================================
      // DISPLAY VALUES
      // ============================================

      const actualDisplay =
        LookerVizUtils.getDisplayValue(
          row,
          measures[0].name
        );

      const comparisonDisplay =
        LookerVizUtils.getDisplayValue(
          row,
          measures[1].name
        );

      const budgetDisplay =
        LookerVizUtils.getDisplayValue(
          row,
          measures[2].name
        );

      // ============================================
      // NUMERIC VALIDATION
      // ============================================

      if (
        isNaN(actualValue) ||
        isNaN(comparisonValue) ||
        isNaN(budgetValue)
      ) {

        LookerVizUtils.showError(
          root,
          "All 3 measures must contain numeric values."
        );

        return done();
      }

      // ============================================
      // CALCULATIONS
      // ============================================

      const variancePercent =
        comparisonValue !== 0
          ? (
              (
                (actualValue - comparisonValue) /
                comparisonValue
              ) * 100
            )
          : null;

      const budgetPercent =
        budgetValue !== 0
          ? (
              (actualValue / budgetValue) * 100
            )
          : null;

      const isGood =
        actualValue >= budgetValue;

      const barColor =
        isGood
          ? "#16a34a"
          : "#ef4444";

      // Dynamic scaling
      const dynamicMax =
        Math.max(
          actualValue,
          budgetValue,
          1
        ) * 1.15;

      const barWidth =
        (actualValue / dynamicMax) * 100;

      const budgetPosition =
        (budgetValue / dynamicMax) * 100;

      // ============================================
      // DEBUG
      // ============================================

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

      // ============================================
      // RENDER
      // ============================================

      root.innerHTML = `

        <div class="kpi-budget-wrap">

          ${
            config.show_header
            ? `
              <div
                class="kpi-header"
                style="
                  font-size:${config.header_font_size || 18}px;
                "
              >
                ${config.header_text || ""}
              </div>
            `
            : ""
          }

          <!-- KPI VALUE -->

          <div class="kpi-main-value">
            ${actualDisplay}
          </div>

          <!-- COMPARISON -->

          <div class="comparison-row">

            ${
              variancePercent !== null
              ? `
                <span class="
                  variance-badge
                  ${
                    variancePercent >= 0
                      ? "badge-green"
                      : "badge-red"
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
              : `
                <span style="color:#6b7280;">
                  —
                </span>
              `
            }

            <span style="color:#6b7280;">
              vs prior period
            </span>

          </div>

          <!-- PRIOR -->

          <div class="prior-row">
            Prior: ${comparisonDisplay}
          </div>

          <div class="divider"></div>

          ${
            config.show_budget_section
            ? `
              <div class="budget-header-row">

                <div>
                  ${
                    config.budget_section_text ||
                    "Actual vs Budget"
                  }
                </div>

                <div class="budget-right">
                  Budget: ${budgetDisplay}
                </div>

              </div>
            `
            : ""
          }

          <!-- BAR -->

          <div
            class="bar-container"
            style="
              height:${config.bar_height || 12}px;
            "
          >

            <div
              class="bar-fill"
              style="
                width:${Math.min(barWidth,100)}%;
                background:${barColor};
              "
            ></div>

            <div
              class="budget-line"
              style="
                left:${budgetPosition}%;
                height:${(config.bar_height || 12) + 6}px;
              "
            ></div>

          </div>

          <!-- AXIS -->

          ${
            config.show_axis
            ? `
              <div class="axis-row">
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
                  color:${barColor};
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

      if (window.LookerVizUtils) {

        LookerVizUtils.showError(
          root,
          "Unexpected Visualization Error\n\n" +
          e.message
        );

      } else {

        root.innerHTML = `
          <div class="viz-error">

            <div class="viz-error-title">
              Unexpected Visualization Error
            </div>

            <div>
              ${e.message}
            </div>

          </div>
        `;
      }
    }

    done();
  }
});