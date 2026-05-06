looker.plugins.visualizations.add({
  id: "bullet_actual_vs_budget_v2",
  label: "Bullet Chart (Actual vs Budget)",

  options: {
    custom_title: {
      type: "string",
      label: "Title",
      default: "Budget vs Actual"
    },

    title_font_size: {
      type: "number",
      label: "Title Font Size",
      default: 18
    },

    bar_height: {
      type: "number",
      label: "Bar Height",
      default: 14
    },

    row_spacing: {
      type: "number",
      label: "Row Spacing",
      default: 18
    },

    show_legend: {
      type: "boolean",
      label: "Show Legend",
      default: true
    }
  },

  create: function (element) {
    element.innerHTML = `
      <style>
        .wrap { font-family: Inter, Arial; padding: 10px; }
        .title { font-weight: 600; margin-bottom: 12px; }

        .row {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
        }

        .label {
          width: 240px;
          font-size: 14px;
          color: #1f2937;
        }

        .bar-area {
          flex: 1;
          position: relative;
          background: #e5e7eb;
          border-radius: 6px;
          margin: 0 12px;
        }

        .bar {
          height: 100%;
          border-radius: 6px;
        }

        .budget-line {
          position: absolute;
          top: -4px;
          width: 2px;
          height: 20px;
          background: #111827;
        }

        .values {
          width: 170px;
          text-align: right;
          font-size: 14px;
        }

        .green { color: #16a34a; }
        .red { color: #dc2626; }

        .legend {
          display: flex;
          align-items: center;
          gap: 18px;
          margin-top: 14px;
          font-size: 13px;
          color: #374151;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .box {
          width: 12px;
          height: 12px;
          border-radius: 3px;
        }

        .line {
          width: 14px;
          height: 2px;
          background: #111827;
        }
      </style>

      <div class="wrap">
        <div id="title" class="title"></div>
        <div id="chart"></div>
        <div id="legend" class="legend"></div>
      </div>
    `;
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    try {
      if (!data || !data.length) return done();

      const dimension = queryResponse.fields.dimension_like[0];
      const measures = queryResponse.fields.measure_like;

      const actualField = measures[0].name;
      const budgetField = measures[1].name;

      const titleEl = element.querySelector("#title");
      const chartEl = element.querySelector("#chart");
      const legendEl = element.querySelector("#legend");

      titleEl.innerText = config.custom_title || "Budget vs Actual";
      titleEl.style.fontSize = (config.title_font_size || 18) + "px";

      chartEl.innerHTML = "";

      let globalMax = 0;

      data.forEach(row => {
        const actual = Number(row[actualField]?.value) || 0;
        const budget = Number(row[budgetField]?.value) || 0;
        globalMax = Math.max(globalMax, actual, budget);
      });

      globalMax = globalMax * 1.15;

      const barHeight = config.bar_height || 14;
      const spacing = config.row_spacing || 18;

      data.forEach(row => {
        const label = row[dimension.name]?.value || "—";
        const actual = Number(row[actualField]?.value) || 0;
        const budget = Number(row[budgetField]?.value) || 0;

        const percent = budget ? (actual / budget) * 100 : 0;
        const isGood = actual >= budget;

        const barWidth = (actual / globalMax) * 100;
        const budgetPos = (budget / globalMax) * 100;

        const rowEl = document.createElement("div");
        rowEl.className = "row";
        rowEl.style.marginBottom = spacing + "px";

        rowEl.innerHTML = `
          <div class="label">${label}</div>

          <div class="bar-area" style="height:${barHeight}px;">
            <div class="bar" 
              style="
                width:${Math.min(barWidth, 100)}%;
                background:${isGood ? "#22c55e" : "#ef4444"};
              ">
            </div>

            <div class="budget-line" style="left:${budgetPos}%"></div>
          </div>

          <div class="values">
            <strong>${format(actual)}</strong> / ${format(budget)}
            <span class="${isGood ? "green" : "red"}">
              ${percent.toFixed(0)}%
            </span>
          </div>
        `;

        chartEl.appendChild(rowEl);
      });

      // ✅ Legend
      if (config.show_legend) {
        legendEl.innerHTML = `
          <div class="legend-item">
            <div class="box" style="background:#22c55e;"></div>
            <span>Actual ≥ Budget</span>
          </div>

          <div class="legend-item">
            <div class="box" style="background:#ef4444;"></div>
            <span>Actual < Budget</span>
          </div>

          <div class="legend-item">
            <div class="line"></div>
            <span>Budget</span>
          </div>
        `;
        legendEl.style.display = "flex";
      } else {
        legendEl.style.display = "none";
      }

      function format(num) {
        if (!num && num !== 0) return "—";
        return num.toLocaleString();
      }

    } catch (e) {
      console.error(e);
    }

    done();
  }
});
