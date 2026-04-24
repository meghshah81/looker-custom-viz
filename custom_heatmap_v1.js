looker.plugins.visualizations.add({
  id: "custom_heatmap_v1",
  label: "Custom Heatmap v1",

  options: {
    chart_title: {
      type: "string",
      label: "Title",
      default: "Slot Utilization Heatmap",
      section: "Style"
    },

    chart_subtitle: {
      type: "string",
      label: "Subtitle",
      default: "By Clinic and Hour of Day",
      section: "Style"
    },

    low_label: {
      type: "string",
      label: "Legend Low Label",
      default: "LOW UTILIZATION",
      section: "Legend"
    },

    high_label: {
      type: "string",
      label: "Legend High Label",
      default: "HIGH UTILIZATION",
      section: "Legend"
    },

    show_legend: {
      type: "boolean",
      label: "Show Legend",
      default: true,
      section: "Legend"
    },

    low_color: {
      type: "string",
      label: "Low Color",
      default: "#f5efe6",
      section: "Colors"
    },

    mid_color: {
      type: "string",
      label: "Mid Color",
      default: "#f4b266",
      section: "Colors"
    },

    high_color: {
      type: "string",
      label: "High Color",
      default: "#ff6b00",
      section: "Colors"
    },

    show_values: {
      type: "boolean",
      label: "Show Values in Cells",
      default: false,
      section: "Style"
    },

    row_label_width: {
      type: "number",
      label: "Row Label Width",
      default: 140,
      section: "Style"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
          font-family: Roboto, Arial, sans-serif;
        }

        body, html {
          margin: 0;
          padding: 0;
        }

        .heatmap-wrap {
          width: 100%;
          height: 100%;
          padding: 18px 20px;
          background: #ffffff;
        }

        .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .title {
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
          line-height: 1.2;
        }

        .subtitle {
          font-size: 18px;
          color: #6b7280;
          margin-top: 4px;
        }

        .legend {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .legend-label {
          font-size: 14px;
          color: #6b7280;
          font-weight: 600;
          letter-spacing: .3px;
        }

        .legend-boxes {
          display: flex;
          gap: 4px;
        }

        .legend-step {
          width: 18px;
          height: 18px;
          border-radius: 2px;
        }

        .grid {
          display: grid;
          gap: 3px;
          width: 100%;
        }

        .cell {
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: #111827;
          border-radius: 2px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          padding: 4px;
        }

        .header-cell {
          background: transparent !important;
          font-size: 12px;
          color: #6b7280;
          font-weight: 600;
          min-height: 28px;
        }

        .row-label {
          background: transparent !important;
          justify-content: flex-start;
          font-size: 14px;
          color: #111827;
          font-weight: 500;
          padding-left: 8px;
        }

        .tooltip {
          position: absolute;
          background: rgba(17,24,39,.95);
          color: #fff;
          padding: 6px 8px;
          border-radius: 6px;
          font-size: 12px;
          pointer-events: none;
          z-index: 9999;
          display: none;
        }
      </style>

      <div class="heatmap-wrap">
        <div class="top-bar">
          <div>
            <div class="title" id="title"></div>
            <div class="subtitle" id="subtitle"></div>
          </div>

          <div class="legend" id="legend"></div>
        </div>

        <div class="grid" id="grid"></div>
        <div class="tooltip" id="tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    try {
      const grid = element.querySelector("#grid");
      const title = element.querySelector("#title");
      const subtitle = element.querySelector("#subtitle");
      const legend = element.querySelector("#legend");
      const tooltip = element.querySelector("#tooltip");

      title.innerText = config.chart_title || "Heatmap";
      subtitle.innerText = config.chart_subtitle || "";

      const rowDim = queryResponse.fields.dimension_like[0].name;
      const measure = queryResponse.fields.measure_like[0].name;
      const pivots = queryResponse.pivots || [];

      const pivotKeys = pivots.map(p => p.key);
      const pivotLabels = pivots.map(p => p.label_short || p.label || p.key);

      const values = [];

      data.forEach(row => {
        pivotKeys.forEach(pk => {
          const cell = row[measure][pk];
          const val = cell && cell.value != null ? Number(cell.value) : null;
          if (val != null) values.push(val);
        });
      });

      const minVal = values.length ? Math.min(...values) : 0;
      const maxVal = values.length ? Math.max(...values) : 1;

      const cols = pivotKeys.length + 1;
      grid.style.gridTemplateColumns =
        `${config.row_label_width || 140}px repeat(${pivotKeys.length}, minmax(60px,1fr))`;

      grid.innerHTML = "";

      addCell("", "header-cell");

      pivotLabels.forEach(lbl => addCell(lbl, "header-cell"));

      data.forEach(row => {
        const rowLabel = row[rowDim].value;
        addCell(rowLabel, "row-label");

        pivotKeys.forEach(pk => {
          const cell = row[measure][pk];
          const val = cell && cell.value != null ? Number(cell.value) : null;

          const div = document.createElement("div");
          div.className = "cell";

          div.style.background = getColor(
            val,
            minVal,
            maxVal,
            config.low_color,
            config.mid_color,
            config.high_color
          );

          if (config.show_values && val != null) {
            div.innerText = formatValue(val);
          }

          div.onmousemove = function(e) {
            tooltip.style.display = "block";
            tooltip.style.left = e.pageX + 10 + "px";
            tooltip.style.top = e.pageY + 10 + "px";
            tooltip.innerHTML =
              `<strong>${rowLabel}</strong><br>${pivotLabels[pivotKeys.indexOf(pk)]}: ${formatValue(val)}`;
          };

          div.onmouseleave = function() {
            tooltip.style.display = "none";
          };

          grid.appendChild(div);
        });
      });

      renderLegend();
      done();

      function addCell(text, cls) {
        const div = document.createElement("div");
        div.className = "cell " + cls;
        div.innerText = text;
        grid.appendChild(div);
      }

      function renderLegend() {
        if (!config.show_legend) {
          legend.innerHTML = "";
          return;
        }

        legend.innerHTML = `
          <div class="legend-label">${config.low_label}</div>
          <div class="legend-boxes">
            ${[0,1,2,3,4,5].map(i => {
              const ratio = i / 5;
              const color = getColor(
                minVal + (maxVal - minVal) * ratio,
                minVal,
                maxVal,
                config.low_color,
                config.mid_color,
                config.high_color
              );
              return '<div class="legend-step" style="background:' + color + '"></div>';
            }).join("")}
          </div>
          <div class="legend-label">${config.high_label}</div>
        `;
      }

      function formatValue(v) {
        if (v == null) return "";
        if (Math.abs(v) <= 1) return (v * 100).toFixed(1) + "%";
        return Number(v).toLocaleString("en-US");
      }

      function getColor(value, min, max, low, mid, high) {
        if (value == null) return "#f3f4f6";

        if (max === min) return mid;

        const ratio = (value - min) / (max - min);

        if (ratio <= 0.5) {
          return interpolate(low, mid, ratio * 2);
        } else {
          return interpolate(mid, high, (ratio - 0.5) * 2);
        }
      }

      function interpolate(c1, c2, factor) {
        const a = hexToRgb(c1);
        const b = hexToRgb(c2);

        const r = Math.round(a.r + factor * (b.r - a.r));
        const g = Math.round(a.g + factor * (b.g - a.g));
        const b2 = Math.round(a.b + factor * (b.b - a.b));

        return `rgb(${r},${g},${b2})`;
      }

      function hexToRgb(hex) {
        hex = hex.replace("#", "");
        if (hex.length === 3) {
          hex = hex.split("").map(x => x + x).join("");
        }

        return {
          r: parseInt(hex.substring(0,2),16),
          g: parseInt(hex.substring(2,4),16),
          b: parseInt(hex.substring(4,6),16)
        };
      }

    } catch (err) {
      element.innerHTML =
        "<div style='padding:12px;color:red;'>Error: " +
        err.message +
        "</div>";
      done();
    }
  }
});