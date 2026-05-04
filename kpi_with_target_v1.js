looker.plugins.visualizations.add({
  id: "kpi_with_target_v1",
  label: "KPI with Target",

  options: {
    scale_mode: {
      type: "string",
      label: "Scale Mode",
      display: "select",
      values: [
        { "Dynamic": "dynamic" },
        { "Target Based": "target" }
      ],
      default: "dynamic"
    },

    custom_title: {
      type: "string",
      label: "KPI Title (Top Header)",
      default: ""
    },

    adaptive_scaling: {
      type: "boolean",
      label: "Use Smart Scaling",
      default: true
    },

    buffer_percentage: {
      type: "number",
      label: "Manual Buffer %",
      default: 15
    },

    bar_height: {
      type: "number",
      label: "Bar Thickness (px)",
      default: 12
    },

    show_target_label: { type: "boolean", label: "Show Target Label", default: true },
    show_axis: { type: "boolean", label: "Show Axis", default: true },
    show_percentage: { type: "boolean", label: "Show % of Target", default: true },
    show_legend: { type: "boolean", label: "Show Legend", default: true },
    show_header: { type: "boolean", label: "Show Section Header", default: true },
    header_text: { type: "string", label: "Section Header Title", default: "Actual vs Target" }
  },

  create: function (element) {
    element.innerHTML = `
      <style>
        .kpi-container { font-family: Inter, Arial, sans-serif; padding: 6px; }
        .title { font-size: 18px; font-weight: 600; color: #1f3b64; }
        .value { font-size: 42px; font-weight: 700; color: #1f3b64; }

        .no-data {
          font-size: 18px;
          color: #9ca3af;
          text-align: center;
          padding: 30px 0;
        }

        .pop-row { display:flex; align-items:center; gap:8px; margin-top:6px; }
        .badge { padding:4px 8px; border-radius:6px; font-size:12px; font-weight:600; }
        .badge.red { background:#fee2e2; color:#dc2626; }
        .badge.green { background:#dcfce7; color:#16a34a; }

        .prior { margin-top:4px; font-size:14px; color:#4b5563; }
        .section-title { margin-top:14px; font-size:14px; font-weight:600; }

        .bar-container { position:relative; background:#e5e7eb; border-radius:6px; margin-top:6px; }
        .bar-fill { height:100%; border-radius:6px; }

        .target-line { position:absolute; top:-6px; width:2px; height:22px; background:#111827; }
        .target-label { position:absolute; top:-22px; font-size:11px; transform:translateX(-50%); white-space:nowrap; }

        .axis { font-size:10px; color:#9ca3af; display:flex; justify-content:space-between; margin-top:4px; }
        .percent { text-align:center; font-size:12px; margin-top:6px; color:#374151; }

        .legend { font-size:11px; margin-top:8px; display:flex; gap:16px; align-items:center; }
        .box { width:10px; height:10px; display:inline-block; border-radius:2px; }
        .line { width:12px; height:2px; background:#111; display:inline-block; }
      </style>

      <div class="kpi-container" id="container">
        <div id="content">
          <div id="title" class="title"></div>
          <div id="value" class="value"></div>

          <div class="pop-row">
            <div id="badge" class="badge"></div>
            <div>vs prior period</div>
          </div>

          <div id="prior" class="prior"></div>

          <div id="sectionHeader" class="section-title"></div>

          <div id="barWrap" class="bar-container">
            <div id="bar" class="bar-fill"></div>
            <div id="target" class="target-line"></div>
            <div id="targetLabel" class="target-label"></div>
          </div>

          <div id="axis" class="axis"></div>
          <div id="percent" class="percent"></div>
          <div id="legend" class="legend"></div>
        </div>

        <div id="noData" class="no-data" style="display:none;">
          No data available
        </div>
      </div>
    `;
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    try {
      if (!data || !data.length) return done();

      const measures = queryResponse.fields.measure_like;

      const rawSelected = data[0][measures[0].name]?.value;
      const rawPrevious = data[0][measures[1].name]?.value;
      const rawTarget   = data[0][measures[2].name]?.value;

      const hasData =
        rawSelected !== null && rawSelected !== undefined &&
        rawTarget !== null && rawTarget !== undefined;

      const content = element.querySelector("#content");
      const noDataEl = element.querySelector("#noData");

      if (!hasData) {
        content.style.display = "none";
        noDataEl.style.display = "block";
        return done();
      }

      const selected = Number(rawSelected) || 0;
      const previous = Number(rawPrevious) || 0;
      const target   = Number(rawTarget) || 0;

      const percentChange =
        previous !== 0 ? ((selected - previous) / previous) * 100 : null;

      const percentTarget =
        target !== 0 ? (selected / target) * 100 : null;

      // SMART SCALING
      const baseMax = Math.max(selected, target, 1);

      let maxVal;

      if (config.scale_mode === "target") {
        maxVal = target > 0 ? target * 1.15 : baseMax * 1.15;
      } else {
        if (config.adaptive_scaling) {
          let bufferMultiplier;

          if (baseMax < 1000) bufferMultiplier = 1.25;
          else if (baseMax < 10000) bufferMultiplier = 1.18;
          else bufferMultiplier = 1.12;

          maxVal = baseMax * bufferMultiplier;
        } else {
          const buffer = (config.buffer_percentage || 15) / 100;
          maxVal = baseMax * (1 + buffer);
        }
      }

      const el = {
        title: element.querySelector("#title"),
        value: element.querySelector("#value"),
        badge: element.querySelector("#badge"),
        prior: element.querySelector("#prior"),
        bar: element.querySelector("#bar"),
        barWrap: element.querySelector("#barWrap"),
        targetLine: element.querySelector("#target"),
        targetLabel: element.querySelector("#targetLabel"),
        axis: element.querySelector("#axis"),
        percent: element.querySelector("#percent"),
        legend: element.querySelector("#legend"),
        sectionHeader: element.querySelector("#sectionHeader")
      };

      // Title
      el.title.innerText =
        config.custom_title?.trim() ||
        measures[0].label_short ||
        "KPI";

      el.value.innerText = format(selected);

      // PoP
      if (percentChange !== null) {
        const isUp = percentChange >= 0;
        el.badge.className = "badge " + (isUp ? "green" : "red");
        el.badge.innerText = `${isUp ? "▲" : "▼"} ${Math.abs(percentChange).toFixed(2)}%`;
      } else {
        el.badge.innerText = "—";
        el.badge.className = "badge";
      }

      el.prior.innerText = `Prior: ${format(previous)}`;

      // Section header
      el.sectionHeader.innerText = config.show_header ? config.header_text : "";
      el.sectionHeader.style.display = config.show_header ? "block" : "none";

      // Bar
      const height = Math.max(6, Number(config.bar_height) || 12);
      el.barWrap.style.height = height + "px";

      const barWidth = maxVal ? Math.min((selected / maxVal) * 100, 100) : 0;
      const targetPos = maxVal ? Math.min((target / maxVal) * 100, 100) : 0;

      const isGood = target === 0 ? true : selected >= target;

      el.bar.style.width = barWidth + "%";
      el.bar.style.background = isGood
        ? "linear-gradient(90deg,#22c55e,#16a34a)"
        : "linear-gradient(90deg,#fb7185,#dc2626)";

      // Target
      if (target > 0) {
        el.targetLine.style.left = targetPos + "%";
        el.targetLine.style.display = "block";

        if (config.show_target_label) {
          el.targetLabel.innerText = format(target) + " (Target)";
          el.targetLabel.style.left = targetPos + "%";
          el.targetLabel.style.display = "block";
        }
      } else {
        el.targetLine.style.display = "none";
        el.targetLabel.style.display = "none";
      }

      // Axis
      if (config.show_axis) {
        el.axis.innerHTML = `<span>0</span><span>${format(maxVal)}</span>`;
        el.axis.style.display = "flex";
      } else {
        el.axis.style.display = "none";
      }

      // %
      if (config.show_percentage && percentTarget !== null) {
        el.percent.innerText = `${percentTarget.toFixed(1)}% of target`;
        el.percent.style.display = "block";
      } else {
        el.percent.style.display = "none";
      }

      // Legend
      if (config.show_legend) {
        el.legend.innerHTML = `
          <span><div class="box" style="background:${isGood ? "#16a34a" : "#dc2626"}"></div> Actual: ${format(selected)}</span>
          <span><div class="line"></div> Target: ${format(target)}</span>
        `;
        el.legend.style.display = "flex";
      } else {
        el.legend.style.display = "none";
      }

      function format(num) {
        if (num === null || num === undefined || isNaN(num)) return "—";
        return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
      }

    } catch (e) {
      console.error("Error:", e);
    }

    done();
  }
});
