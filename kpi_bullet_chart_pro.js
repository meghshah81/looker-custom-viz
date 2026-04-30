looker.plugins.visualizations.add({
  id: "kpi_bullet_chart_pro",
  label: "KPI with Target Bullet (Pro)",

  options: {
    scale_mode: { type: "string", label: "Scale Mode", display: "select", values: [{ "Dynamic": "dynamic" }, { "Target Based": "target" }], default: "dynamic" },
    show_target_label: { type: "boolean", label: "Show Target Label", default: true },
    show_axis: { type: "boolean", label: "Show Axis (Min/Max)", default: true },
    show_percentage: { type: "boolean", label: "Show % of Target", default: true },
    show_legend: { type: "boolean", label: "Show Legend", default: true },
    show_header: { type: "boolean", label: "Show Header", default: true },
    header_text: { type: "string", label: "Header Title", default: "Actual vs Target" },
    show_bands: { type: "boolean", label: "Show Performance Bands", default: false }
  },

  create: function (element) {
    element.innerHTML = `
      <style>
        .kpi-container { font-family: Inter, Arial, sans-serif; }
        .kpi-header { font-size: 13px; color: #6b7280; margin-top: 10px; }

        .bar-wrapper { position: relative; margin-top: 6px; }
        .bar-container { position: relative; height: 10px; background: #e5e7eb; border-radius: 6px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 6px; transition: width 0.6s ease; }

        .band { position: absolute; top: 0; height: 100%; opacity: 0.25; }

        .target-line { position: absolute; top: -4px; width: 2px; height: 18px; background: #111827; }
        .target-label { position: absolute; top: -20px; font-size: 10px; color: #374151; transform: translateX(-50%); white-space: nowrap; }

        .labels { font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; margin-top: 4px; }

        .center-text { text-align: center; font-size: 11px; margin-top: 6px; color: #374151; }

        .legend { font-size: 10px; margin-top: 6px; display: flex; gap: 12px; color: #4b5563; }
        .legend span { display: flex; align-items: center; gap: 4px; }
        .box { width: 10px; height: 10px; border-radius: 2px; }
        .line { width: 10px; height: 2px; background: #111827; }
      </style>

      <div class="kpi-container">
        <div class="kpi-header" id="header"></div>

        <div class="bar-wrapper">
          <div class="bar-container" id="barContainer">
            <div class="bar-fill" id="bar"></div>
            <div class="target-line" id="target"></div>
            <div class="target-label" id="targetLabel"></div>
          </div>
        </div>

        <div class="labels" id="axis"></div>
        <div class="center-text" id="percent"></div>
        <div class="legend" id="legend"></div>
      </div>
    `;
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    try {
      if (!data || data.length === 0) return done();

      const measureName = queryResponse.fields.measure_like?.[0]?.name;
      const dimensionName = queryResponse.fields.dimension_like?.[0]?.name;
      if (!measureName || !dimensionName) return done();

      let selected = 0, previous = 0, target = 0;

      data.forEach(row => {
        const dim = row[dimensionName]?.value;
        const val = Number(row[measureName]?.value) || 0;

        if (dim === "Selected Period") selected = val;
        else if (dim === "Previous Period") previous = val;
        else if (dim === "Target") target = val;
      });

      if (!target || target <= 0) target = selected || 1;

      let maxVal;
      if (config.scale_mode === "target") {
        maxVal = (target || 1) * 1.2; // 20% buffer above target
      } else {
        maxVal = Math.max(selected, target, previous, 1);
      }
      const percent = (selected / target) * 100;

      const bar = element.querySelector("#bar");
      const targetLine = element.querySelector("#target");
      const targetLabel = element.querySelector("#targetLabel");
      const axis = element.querySelector("#axis");
      const percentEl = element.querySelector("#percent");
      const legend = element.querySelector("#legend");
      const header = element.querySelector("#header");
      const barContainer = element.querySelector("#barContainer");

      const barWidth = Math.min((selected / maxVal) * 100, 100);
      const targetPos = Math.min((target / maxVal) * 100, 100);

      const isGood = selected >= target;
      const barColor = isGood ? "#16a34a" : "#dc2626";

      bar.style.width = barWidth + "%";
      bar.style.background = barColor;

      targetLine.style.left = targetPos + "%";
      targetLine.style.display = config.show_target_label ? "block" : "none";

      if (config.show_target_label) {
        targetLabel.innerText = formatNumber(target);
        targetLabel.style.left = targetPos + "%";
        targetLabel.style.display = "block";
      } else {
        targetLabel.style.display = "none";
      }

      header.innerText = config.header_text || "";
      header.style.display = config.show_header ? "block" : "none";

      if (config.show_axis) {
        axis.innerHTML = `<span>0</span><span>${formatNumber(maxVal)}</span>`;
        axis.style.display = "flex";
      } else {
        axis.style.display = "none";
      }

      if (config.show_percentage) {
        percentEl.innerText = `${percent.toFixed(1)}% of target`;
        percentEl.style.display = "block";
      } else {
        percentEl.style.display = "none";
      }

      if (config.show_legend) {
        legend.innerHTML = `
          <span><div class="box" style="background:${barColor}"></div> Actual</span>
          <span><div class="line"></div> Target</span>
        `;
        legend.style.display = "flex";
      } else {
        legend.style.display = "none";
      }

      // Optional performance bands
      if (config.show_bands) {
        const bands = [0.6, 0.8, 1.0];
        barContainer.querySelectorAll('.band').forEach(e => e.remove());
        bands.forEach((b, i) => {
          const div = document.createElement('div');
          div.className = 'band';
          div.style.left = (i === 0 ? 0 : bands[i-1]*100) + '%';
          div.style.width = ((b - (bands[i-1] || 0)) * 100) + '%';
          div.style.background = i === 2 ? '#16a34a' : '#f59e0b';
          barContainer.appendChild(div);
        });
      }

      function formatNumber(num) {
        if (!num && num !== 0) return '';
        return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
      }

    } catch (e) {
      console.error("Visualization Error:", e);
    }

    done();
  }
});
