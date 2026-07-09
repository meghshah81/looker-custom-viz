// ========================= 
// Utility Helpers 
// =========================

const Utils = {

  isValidNumber(value) { 
    return (value !== null && value !== undefined && value !== "" && !isNaN(Number(value))); 
  },

  toNumber(value, defaultValue = 0) { 
    return this.isValidNumber(value) ? Number(value) : defaultValue; 
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
    if (value === null || value === undefined) { return ""; }
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  percent(value, total) { 
    if (!this.isValidNumber(total) || Number(total) === 0) { return 0; }
    return (Number(value) / Number(total)) * 100;
  },

  attachDrill(element, cell) {
    if (!cell || !cell.links || !cell.links.length) {
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

// ========================= 
// Visualization 
// =========================

looker.plugins.visualizations.add({

  id: "budget_vs_actual_bullet_v10",
  label: "Budget vs Actual Bullet v10",

  options: {
    // =========================
    // HEADER OPTIONS
    // =========================
    show_title: {
      type: "boolean",
      label: "Show Header Title",
      default: true
    },
    custom_title: {
      type: "string",
      label: "Header Title",
      default: "Budget vs Actual"
    },
    title_font_size: {
      type: "number",
      label: "Title Font Size",
      default: 24
    },
    title_color: {
      type: "string",
      label: "Title Color",
      default: "#0f2d5c"
    },
    // =========================
    // VALUE OPTIONS
    // =========================
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
    // =========================
    // COLORS
    // =========================
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
    // =========================
    // SIZING
    // =========================
    bar_height: {
      type: "number",
      label: "Bar Height",
      default: 16
    },
    label_width: {
      type: "number",
      label: "Label Width",
      default: 120
    }
  },

  // ========================= 
  // CREATE 
  // =========================
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
        .bv-title {
          font-weight: 700;
          margin-bottom: 24px;
          color: #0f2d5c;
          line-height: 1.2;
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
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          align-items: center;
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
          text-align: right;
          white-space: nowrap;
          font-size: 14px;
        }
        .bv-actual {
          color: #6b7280;
        }
        .bv-budget {
          font-weight: 700;
          color: #0f2d5c;
          margin-left: 4px;
        }
        .bv-percent {
          margin-left: 10px;
          font-weight: 600;
          display: inline-block;
          width: 45px;
          text-align: right;
        }
        .bv-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 22px;
          margin-top: 24px;
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

  // ========================= 
  // UPDATE 
  // =========================
  updateAsync: function (data, element, config, queryResponse, details, done) {
    try {
      const wrapper = element.querySelector(".bv-wrapper");
      wrapper.innerHTML = "";

      // =========================
      // VALIDATION
      // =========================
      if (!queryResponse || !queryResponse.fields || queryResponse.fields.dimension_like.length < 1 || queryResponse.fields.measure_like.length < 2) {
        wrapper.innerHTML = `
          <div class="bv-empty">
            Requires:<br><br>
            • 1 Dimension<br>
            • 2 Measures
          </div>
        `;
        done();
        return;
      }

      if (!data || !data.length) {
        wrapper.innerHTML = `
          <div class="bv-empty">No data available</div>
        `;
        done();
        return;
      }

      // =========================
      // HEADER
      // =========================
      if (config.show_title) {
        const titleEl = document.createElement("div");
        titleEl.className = "bv-title";
        titleEl.style.fontSize = `${config.title_font_size || 24}px`;
        titleEl.style.color = config.title_color;
        titleEl.innerText = config.custom_title || "Budget vs Actual";
        wrapper.appendChild(titleEl);
      }

      // =========================
      // FIELDS
      // =========================
      const dimension = queryResponse.fields.dimension_like[0];
      const actualMeasure = queryResponse.fields.measure_like[0];
      const budgetMeasure = queryResponse.fields.measure_like[1];

      // =========================
      // MAX SCALE
      // =========================
      let maxValue = 0;
      data.forEach(row => {
        const actual = Utils.toNumber(row[actualMeasure.name]?.value);
        const budget = Utils.toNumber(row[budgetMeasure.name]?.value);
        maxValue = Math.max(maxValue, actual, budget);
      });

      if (maxValue <= 0) {
        maxValue = 1;
      }

      // =========================
      // ENGINE LAYOUT CONSTANTS
      // =========================
      const barHeight = Math.max(8, Number(config.bar_height) || 16);
      
      // Strict layout footprints locked down directly to override cache bugs
      const labelWidth = 85;   
      const valuesWidth = 145; 
      const gapSize = 8; // Fixed 8px gap on both sides of the visualization bar

      // =========================
      // ROWS
      // =========================
      data.forEach(row => {
        const actualCell = row[actualMeasure.name];
        const budgetCell = row[budgetMeasure.name];
        
        const label = Utils.safeText(row[dimension.name]?.value);
        const actual = Utils.toNumber(actualCell?.value);
        const budget = Utils.toNumber(budgetCell?.value);

        const actualFormatted = Utils.formatValue(actualCell);
        const budgetFormatted = Utils.formatValue(budgetCell);

        const actualWidth = Math.min(Utils.percent(actual, maxValue), 100);
        const budgetPosition = Math.min(Utils.percent(budget, maxValue), 100);

        const isPositive = actual >= budget;
        const variancePercent = budget > 0 ? Math.round((actual / budget) * 100) : 0;
        const barColor = isPositive ? config.green_color : config.red_color;

        // =========================
        // ROW ELEMENT
        // =========================
        const rowEl = document.createElement("div");
        rowEl.className = "bv-row";

        rowEl.innerHTML = `
          <div
            class="bv-label"
            style="
              width: ${labelWidth}px;
              min-width: ${labelWidth}px;
              max-width: ${labelWidth}px;
            "
            title="${label}"
          >
            ${label}
          </div>

          <div
            class="bv-bar-container"
            style="
              height: ${barHeight}px;
              background: ${config.track_color};
              margin-left: ${gapSize}px;
              margin-right: ${gapSize}px;
            "
          >
            <div
              class="bv-bar"
              style="
                width: ${actualWidth}%;
                height: ${barHeight}px;
                background: ${barColor};
              "
            ></div>

            <div
              class="bv-marker"
              style="
                left: calc(${budgetPosition}% - 1px);
                height: ${barHeight + 12}px;
                background: ${config.budget_marker_color};
              "
            ></div>
          </div>

          <div 
            class="bv-values bv-drillable"
            style="
              width: ${valuesWidth}px;
              min-width: ${valuesWidth}px;
              max-width: ${valuesWidth}px;
            "
          >
            ${
              config.show_values
                ? `
                  <span class="bv-actual">${actualFormatted}</span>
                  <span class="bv-budget">/ ${budgetFormatted}</span>
                `
                : ""
            }
            ${
              config.show_percent
                ? `<span class="bv-percent" style="color: ${barColor}">${variancePercent}%</span>`
                : ""
            }
          </div>
        `;

        wrapper.appendChild(rowEl);

        // =========================
        // DRILL SUPPORT
        // =========================
        const drillTarget = rowEl.querySelector(".bv-drillable");
        Utils.attachDrill(drillTarget, actualCell);
      });

      // =========================
      // LEGEND
      // =========================
      if (config.show_legend) {
        const legend = document.createElement("div");
        legend.className = "bv-legend";

        legend.innerHTML = `
          <div class="bv-legend-item">
            <div class="bv-legend-box" style="background: ${config.green_color}"></div>
            <span>Actual >= Budget</span>
          </div>
          <div class="bv-legend-item">
            <div class="bv-legend-box" style="background: ${config.red_color}"></div>
            <span>Actual < Budget</span>
          </div>
          <div class="bv-legend-item">
            <div class="bv-legend-line" style="background: ${config.budget_marker_color}"></div>
            <span>Budget</span>
          </div>
        `;

        wrapper.appendChild(legend);
      }

      done();

    } catch (err) {
      console.error("Budget vs Actual Bullet Error:", err);
      element.innerHTML = `
        <div style="padding:20px; color:#dc2626; font-family:Arial;">
          Error rendering visualization
        </div>
      `;
      done();
    }
  } 
});
