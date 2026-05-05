looker.plugins.visualizations.add({
  id: "kpi_with_target_and_toggle",
  label: "KPI with Target and Toggle",

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

    show_target_label: { type: "boolean", default: true },
    show_axis: { type: "boolean", default: true },
    show_percentage: { type: "boolean", default: true },
    show_legend: { type: "boolean", default: true },
    show_header: { type: "boolean", default: true },
    header_text: { type: "string", default: "Actual vs Target" }
  },

  create: function (element) {
    element.innerHTML = `
      <style>
        .kpi-container { font-family: Inter, Arial; padding: 8px; position:relative; }

        .toggle {
          position:absolute;
          top:8px;
          right:8px;
          display:flex;
          background:#f3f4f6;
          border-radius:20px;
          padding:2px;
        }

        .toggle button {
          border:none;
          background:transparent;
          padding:4px 10px;
          border-radius:20px;
          cursor:pointer;
          font-size:12px;
        }

        .toggle .active {
          background:#1f3b64;
          color:white;
        }

        .title { font-size:16px; font-weight:600; }
        .value { font-size:36px; font-weight:700; }

        .badge { padding:3px 6px; border-radius:6px; font-size:11px; }
        .green { background:#dcfce7; color:#16a34a; }
        .red { background:#fee2e2; color:#dc2626; }

        .bar-container { background:#e5e7eb; border-radius:6px; margin-top:6px; position:relative; }
        .bar-fill { height:100%; border-radius:6px; }

        .target-line { position:absolute; width:2px; height:20px; background:black; top:-6px; }
        .target-label { position:absolute; font-size:10px; top:-20px; transform:translateX(-50%); }

        .axis { display:flex; justify-content:space-between; font-size:10px; }
        .legend { font-size:11px; margin-top:6px; display:flex; gap:12px; }
      </style>

      <div class="kpi-container">
        <div id="toggle" class="toggle"></div>

        <div id="title"></div>
        <div id="value"></div>

        <div>
          <span id="badge"></span> vs prior period
        </div>

        <div id="prior"></div>

        <div id="header"></div>

        <div id="barWrap" class="bar-container">
          <div id="bar" class="bar-fill"></div>
          <div id="targetLine" class="target-line"></div>
          <div id="targetLabel" class="target-label"></div>
        </div>

        <div id="axis" class="axis"></div>
        <div id="percent"></div>
        <div id="legend" class="legend"></div>
      </div>
    `;
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    try {
      if (!data || !data.length) return done();

      const measures = queryResponse.fields.measure_like;
      const dimension = queryResponse.fields.dimension_like[0];

      const rows = data;
      let activeIndex = 0;

      const toggleEl = element.querySelector("#toggle");

      // Build toggle
      toggleEl.innerHTML = "";

      if (dimension && rows.length > 1) {
        rows.forEach((r, i) => {
          const val = r[dimension.name].value;

          const btn = document.createElement("button");
          btn.innerText = val;

          if (i === 0) btn.classList.add("active");

          btn.onclick = () => {
            activeIndex = i;

            [...toggleEl.children].forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            render(i);
          };

          toggleEl.appendChild(btn);
        });
      } else {
        toggleEl.style.display = "none";
      }

      function render(index) {
        const row = rows[index];

        const selected = Number(row[measures[0].name]?.value) || 0;
        const previous = Number(row[measures[1].name]?.value) || 0;
        const target   = Number(row[measures[2].name]?.value) || 0;

        const percentChange =
          previous !== 0 ? ((selected - previous) / previous) * 100 : null;

        const percentTarget =
          target !== 0 ? (selected / target) * 100 : null;

        // SMART SCALING
        const baseMax = Math.max(selected, target, 1);
        let maxVal;

        if (config.adaptive_scaling) {
          if (baseMax < 1000) maxVal = baseMax * 1.25;
          else if (baseMax < 10000) maxVal = baseMax * 1.18;
          else maxVal = baseMax * 1.12;
        } else {
          const buffer = (config.buffer_percentage || 15) / 100;
          maxVal = baseMax * (1 + buffer);
        }

        // Elements
        const title = element.querySelector("#title");
        const value = element.querySelector("#value");
        const badge = element.querySelector("#badge");
        const prior = element.querySelector("#prior");
        const header = element.querySelector("#header");
        const bar = element.querySelector("#bar");
        const barWrap = element.querySelector("#barWrap");
        const targetLine = element.querySelector("#targetLine");
        const targetLabel = element.querySelector("#targetLabel");
        const axis = element.querySelector("#axis");
        const percent = element.querySelector("#percent");
        const legend = element.querySelector("#legend");

        // Title
        title.innerText =
          config.custom_title || measures[0].label_short;

        value.innerText = format(selected);

        // PoP
        if (percentChange !== null) {
          const up = percentChange >= 0;
          badge.className = "badge " + (up ? "green" : "red");
          badge.innerText = `${up ? "▲" : "▼"} ${Math.abs(percentChange).toFixed(1)}%`;
        } else {
          badge.innerText = "—";
        }

        prior.innerText = `Prior: ${format(previous)}`;

        header.innerText = config.show_header ? config.header_text : "";

        // Bar
        const height = config.bar_height || 12;
        barWrap.style.height = height + "px";

        const width = (selected / maxVal) * 100;
        const tPos = (target / maxVal) * 100;

        const good = selected >= target;

        bar.style.width = Math.min(width, 100) + "%";
        bar.style.background = good ? "green" : "red";

        // Target
        if (target > 0) {
          targetLine.style.left = tPos + "%";
          targetLabel.style.left = tPos + "%";
          targetLabel.innerText = format(target);
        } else {
          targetLine.style.display = "none";
          targetLabel.style.display = "none";
        }

        // Axis
        if (config.show_axis) {
          axis.innerHTML = `<span>0</span><span>${format(maxVal)}</span>`;
        } else {
          axis.innerHTML = "";
        }

        // %
        percent.innerText =
          percentTarget !== null ? `${percentTarget.toFixed(1)}% of target` : "";

        // Legend
        if (config.show_legend) {
          legend.innerHTML = `
            <span>Actual: ${format(selected)}</span>
            <span>Target: ${format(target)}</span>
          `;
        } else {
          legend.innerHTML = "";
        }
      }

      function format(n) {
        if (!n && n !== 0) return "—";
        return n.toLocaleString();
      }

      render(0);

    } catch (e) {
      console.error(e);
    }

    done();
  }
});