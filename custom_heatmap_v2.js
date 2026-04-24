looker.plugins.visualizations.add({
  id: "custom_heatmap_v2",
  label: "Custom Heatmap v2",

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
      label: "Low Legend Label",
      default: "LOW UTILIZATION",
      section: "Legend"
    },
    high_label: {
      type: "string",
      label: "High Legend Label",
      default: "HIGH UTILIZATION",
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
    }
  },

  create: function(element) {
    element.style.width = "100%";
    element.style.height = "100%";
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    try {
      element.innerHTML = `
        <style>
          *{box-sizing:border-box;font-family:Roboto,Arial,sans-serif;}
          .wrap{padding:18px;background:#fff;}
          .top{
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            margin-bottom:18px;
            gap:20px;
            flex-wrap:wrap;
          }
          .title{font-size:28px;font-weight:700;color:#1f2937;}
          .subtitle{font-size:16px;color:#6b7280;margin-top:4px;}
          .legend{
            display:flex;
            align-items:center;
            gap:8px;
            flex-wrap:wrap;
            font-size:13px;
            color:#6b7280;
            font-weight:600;
          }
          .box{
            width:16px;height:16px;border-radius:2px;
          }
          .grid{
            display:grid;
            gap:3px;
          }
          .cell{
            min-height:38px;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:4px;
            font-size:12px;
            border-radius:2px;
          }
          .header{
            background:transparent !important;
            color:#6b7280;
            font-weight:600;
          }
          .row{
            background:transparent !important;
            justify-content:flex-start;
            font-size:14px;
            color:#111827;
            font-weight:500;
            padding-left:8px;
          }
        </style>

        <div class="wrap">
          <div class="top">
            <div>
              <div class="title">${config.chart_title || "Heatmap"}</div>
              <div class="subtitle">${config.chart_subtitle || ""}</div>
            </div>
            <div class="legend" id="legend"></div>
          </div>
          <div class="grid" id="grid"></div>
        </div>
      `;

      const grid = element.querySelector("#grid");
      const legend = element.querySelector("#legend");

      const rowDim = queryResponse.fields.dimension_like[0].name;
      const measure = queryResponse.fields.measure_like[0].name;
      const pivots = queryResponse.pivots || [];

      const pivotKeys = pivots.map(p => p.key);
      const pivotLabels = pivots.map(p => p.label_short || p.label || p.key);

      const values = [];

      data.forEach(r => {
        pivotKeys.forEach(pk => {
          const v = r[measure][pk] && r[measure][pk].value;
          if (v != null) values.push(Number(v));
        });
      });

      const min = values.length ? Math.min(...values) : 0;
      const max = values.length ? Math.max(...values) : 1;

      grid.style.gridTemplateColumns =
        `180px repeat(${pivotKeys.length}, minmax(70px,1fr))`;

      addCell("", "header");
      pivotLabels.forEach(h => addCell(h, "header"));

      data.forEach(row => {
        addCell(row[rowDim].value, "row");

        pivotKeys.forEach(pk => {
          const raw = row[measure][pk];
          const val = raw && raw.value != null ? Number(raw.value) : null;

          const div = document.createElement("div");
          div.className = "cell";
          div.style.background = color(val, min, max);

          grid.appendChild(div);
        });
      });

      renderLegend();
      done();

      function addCell(text, cls) {
        const d = document.createElement("div");
        d.className = "cell " + cls;
        d.innerText = text;
        grid.appendChild(d);
      }

      function renderLegend() {
        const steps = [];
        for (let i = 0; i < 6; i++) {
          const ratio = i / 5;
          const val = min + (max - min) * ratio;
          steps.push(
            '<div class="box" style="background:' + color(val, min, max) + '"></div>'
          );
        }

        legend.innerHTML =
          `${config.low_label || "LOW"} ` +
          steps.join("") +
          ` ${config.high_label || "HIGH"}`;
      }

      function color(v, min, max) {
        if (v == null) return "#f3f4f6";
        const ratio = max === min ? 0.5 : (v - min) / (max - min);

        if (ratio <= 0.5) {
          return mix(config.low_color, config.mid_color, ratio * 2);
        } else {
          return mix(config.mid_color, config.high_color, (ratio - 0.5) * 2);
        }
      }

      function mix(a, b, t) {
        const c1 = rgb(a), c2 = rgb(b);
        const r = Math.round(c1.r + (c2.r - c1.r) * t);
        const g = Math.round(c1.g + (c2.g - c1.g) * t);
        const bl = Math.round(c1.b + (c2.b - c1.b) * t);
        return `rgb(${r},${g},${bl})`;
      }

      function rgb(hex) {
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

    } catch (e) {
      element.innerHTML =
        "<div style='padding:12px;color:red'>Error: " + e.message + "</div>";
      done();
    }
  }
});
