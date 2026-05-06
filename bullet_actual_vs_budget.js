looker.plugins.visualizations.add({
  id: "bullet_actual_vs_budget",
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
          width: 160px;
          text-align: right;
          font-size: 14px;
        }

        .green { color: #16a34a; }
        .red { color: #dc2626; }
      </style>

      <div class="wrap">
        <div id="title" class="title"></div>
        <div id="chart"></div>
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

      // Title config
      titleEl.innerText = config.custom_title || "Budget vs Actual";
      titleEl.style.fontSize = (config.title_font_size || 18) + "px";

      chartEl.innerHTML = "";

      // Get max for scaling
      let globalMax = 0;

      data.forEach(row => {
        const actual = Number(row[actualField]?.value) || 0;
        const budget = Number(row[budgetField]?.value) || 0;
        globalMax = Math.max(globalMax, actual, budget);
      });

      globalMax = globalMax * 1.15; // buffer

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