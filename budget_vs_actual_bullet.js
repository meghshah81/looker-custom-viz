const Utils = {
  isValidNumber(value) {
    return (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      !isNaN(Number(value))
    );
  },

  toNumber(value, defaultValue = 0) {
    return this.isValidNumber(value)
      ? Number(value)
      : defaultValue;
  },

  formatValue(cell, fallback = "0") {
    if (!cell) return fallback;

    return (
      cell.rendered ??
      cell.formatted ??
      cell.value ??
      fallback
    );
  },

  safeText(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  percent(value, total) {
    if (!this.isValidNumber(total) || Number(total) === 0) {
      return 0;
    }

    return (Number(value) / Number(total)) * 100;
  },

  attachDrill(element, cell) {
    if (
      !cell ||
      !cell.links ||
      !cell.links.length
    ) {
      return;
    }

    element.style.cursor = "pointer";

    element.addEventListener("click", function (event) {
      event.stopPropagation();

      LookerCharts.Utils.openDrillMenu({
        links: cell.links,
        event: event
      });
    });
  }
};

looker.plugins.visualizations.add({
  id: "budget_vs_actual_bullet",
  label: "Budget vs Actual Bullet",

  options: {
    show_values: {
      type: "boolean",
      label: "Show Values",
      default: true
    },

    show_percent: {
      type: "boolean",
      label: "Show Percent",
      default: true
    },

    show_legend: {
      type: "boolean",
      label: "Show Legend",
      default: true
    },

    green_color: {
      type: "string",
      label: "Positive Color",
      default: "#57c596"
    },

    red_color: {
      type: "string",
      label: "Negative Color",
      default: "#ef3340"
    },

    budget_marker_color: {
      type: "string",
      label: "Budget Marker Color",
      default: "#0f2d5c"
    },

    track_color: {
      type: "string",
      label: "Track Color",
      default: "#dde3ea"
    },

    bar_height: {
      type: "number",
      label: "Bar Height",
      default: 16
    },

    label_width: {
      type: "number",
      label: "Label Width",
      default: 240
    }
  },

  create: function (element) {
    element.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
        }

        .bv-wrapper {
          width: 100%;
          padding: 12px 16px;
          font-family: Inter, Arial, sans-serif;
        }

        .bv-row {
          display: flex;
          align-items: center;
          width: 100%;
          margin-bottom: 18px;
        }

        .bv-label {
          font-size: 14px;
          font-weight: 600;
          color: #0f2d5c;
          padding-right: 14px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bv-bar-container {
          position: relative;
          flex: 1;
          background: #dde3ea;
          border-radius: 6px;
          overflow: visible;
        }

        .bv-bar {
          position: absolute;
          top: 0;
          left: 0;
          border-radius: 6px;
          transition: width 0.3s ease;
        }

        .bv-marker {
          position: absolute;
          top: -6px;
          width: 3px;
          z-index: 5;
        }

        .bv-values {
          width: 220px;
          min-width: 220px;
          text-align: right;
          padding-left: 18px;
          white-space: nowrap;
          font-size: 14px;
        }

        .bv-actual {
          font-weight: 700;
          color: #0f2d5c;
        }

        .bv-budget {
          color: #6b7280;
          margin-left: 4px;
        }

        .bv-percent {
          margin-left: 10px;
          font-weight: 600;
        }

        .bv-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 22px;
          margin-top: 22px;
          padding-top: 16px;
          border-top: 1px solid #d1d5db;
          font-size: 12px;
          color: #4b5563;
        }

        .bv-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .bv-legend-box {
          width: 14px;
          height: 14px;
          border-radius: 4px;
        }

        .bv-legend-line {
          width: 3px;
          height: 18px;
        }

        .bv-empty {
          padding: 24px;
          color: #6b7280;
          font-size: 14px;
        }
      </style>

      <div class="bv-wrapper"></div>
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
    try {
      const wrapper = element.querySelector(".bv-wrapper");

      wrapper.innerHTML = "";

      if (
        !queryResponse ||
        !queryResponse.fields ||
        queryResponse.fields.dimension_like.length < 1 ||
        queryResponse.fields.measure_like.length < 2
      ) {
        wrapper.innerHTML = `
          <div class="bv-empty">
            This visualization requires:
            <br><br>
            • 1 Dimension
            <br>
            • 2 Measures (Actual and Budget)
          </div>
        `;

        done();
        return;
      }

      if (!data || !data.length) {
        wrapper.innerHTML = `
          <div class="bv-empty">
            No data available
          </div>
        `;

        done();
        return;
      }

      const dimension = queryResponse.fields.dimension_like[0];
      const actualMeasure = queryResponse.fields.measure_like[0];
      const budgetMeasure = queryResponse.fields.measure_like[1];

      let maxValue = 0;

      data.forEach(row => {
        const actual = Utils.toNumber(
          row[actualMeasure.name]?.value
        );

        const budget = Utils.toNumber(
          row[budgetMeasure.name]?.value
        );

        maxValue = Math.max(
          maxValue,
          actual,
          budget
        );
      });

      if (maxValue <= 0) {
        maxValue = 1;
      }

      const barHeight = Math.max(
        8,
        Number(config.bar_height) || 16
      );

      const labelWidth = Math.max(
        120,
        Number(config.label_width) || 240
      );

      data.forEach(row => {
        const actualCell = row[actualMeasure.name];
        const budgetCell = row[budgetMeasure.name];

        const label = Utils.safeText(
          row[dimension.name]?.value
        );

        const actual = Utils.toNumber(
          actualCell?.value
        );

        const budget = Utils.toNumber(
          budgetCell?.value
        );

        const actualFormatted = Utils.formatValue(
          actualCell
        );

        const budgetFormatted = Utils.formatValue(
          budgetCell
        );

        const actualWidth = Math.min(
          Utils.percent(actual, maxValue),
          100
        );

        const budgetPosition = Math.min(
          Utils.percent(budget, maxValue),
          100
        );

        const isPositive = actual >= budget;

        const variancePercent =
          budget > 0
            ? Math.round((actual / budget) * 100)
            : 0;

        const barColor = isPositive
          ? config.green_color
          : config.red_color;

        const rowEl = document.createElement("div");

        rowEl.className = "bv-row";

        rowEl.innerHTML = `
          <div
            class="bv-label"
            style="
              width:${labelWidth}px;
              min-width:${labelWidth}px;
              max-width:${labelWidth}px;
            "
            title="${label}"
          >
            ${label}
          </div>

          <div
            class="bv-bar-container"
            style="
              height:${barHeight}px;
              background:${config.track_color};
            "
          >

            <div
              class="bv-bar"
              style="
                width:${actualWidth}%;
                height:${barHeight}px;
                background:${barColor};
              "
            >
            </div>

            <div
              class="bv-marker"
              style="
                left:calc(${budgetPosition}% - 1px);
                height:${barHeight + 12}px;
                background:${config.budget_marker_color};
              "
            >
            </div>

          </div>

          <div class="bv-values bv-drillable">

            ${
              config.show_values
                ? `
                  <span class="bv-actual">
                    ${actualFormatted}
                  </span>

                  <span class="bv-budget">
                    / ${budgetFormatted}
                  </span>
                `
                : ""
            }

            ${
              config.show_percent
                ? `
                  <span
                    class="bv-percent"
                    style="color:${barColor}"
                  >
                    ${variancePercent}%
                  </span>
                `
                : ""
            }

          </div>
        `;

        wrapper.appendChild(rowEl);

        const drillTarget =
          rowEl.querySelector(".bv-drillable");

        Utils.attachDrill(
          drillTarget,
          actualCell
        );
      });

      if (config.show_legend) {
        const legend = document.createElement("div");

        legend.className = "bv-legend";

        legend.innerHTML = `
          <div class="bv-legend-item">
            <div
              class="bv-legend-box"
              style="background:${config.green_color}"
            ></div>

            <span>Actual ≥ Budget</span>
          </div>

          <div class="bv-legend-item">
            <div
              class="bv-legend-box"
              style="background:${config.red_color}"
            ></div>

            <span>Actual &lt; Budget</span>
          </div>

          <div class="bv-legend-item">
            <div
              class="bv-legend-line"
              style="background:${config.budget_marker_color}"
            ></div>

            <span>Budget</span>
          </div>
        `;

        wrapper.appendChild(legend);
      }

      done();

    } catch (err) {

      console.error(
        "Budget vs Actual Bullet Error:",
        err
      );

      element.innerHTML = `
        <div style="
          padding:20px;
          color:#dc2626;
          font-family:Arial;
        ">
          Error rendering visualization
        </div>
      `;

      done();
    }
  }
});