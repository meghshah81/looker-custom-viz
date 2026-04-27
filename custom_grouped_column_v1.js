looker.plugins.visualizations.add({
  id: "custom_grouped_column_v1",
  label: "Custom Grouped Column v1",

  options: {
    chart_title: {
      type: "string",
      label: "Title",
      default: "Traffic Sources",
      section: "Header"
    },

    chart_subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Visitors and conversions by channel",
      section: "Header"
    },

    title_font_size: {
      type: "number",
      label: "Title Font Size",
      default: 18,
      section: "Header"
    },

    subtitle_font_size: {
      type: "number",
      label: "Subtitle Font Size",
      default: 13,
      section: "Header"
    },

    legend_position: {
      type: "string",
      label: "Legend Position",
      display: "select",
      values: [
        { "Top Right": "top-right" },
        { "Top Left": "top-left" },
        { "Bottom": "bottom" },
        { "Hidden": "hidden" }
      ],
      default: "top-right",
      section: "Legend"
    },

    series_1_color: {
      type: "string",
      label: "Series 1 Color",
      default: "#8b5cf6",
      section: "Colors"
    },

    series_2_color: {
      type: "string",
      label: "Series 2 Color",
      default: "#06b6d4",
      section: "Colors"
    },

    bar_radius: {
      type: "number",
      label: "Bar Radius",
      default: 10,
      section: "Style"
    },

    animation_ms: {
      type: "number",
      label: "Animation Speed (ms)",
      default: 900,
      section: "Style"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        *{
          box-sizing:border-box;
          font-family:Roboto, Arial, sans-serif;
        }

        html,body{
          margin:0;
          padding:0;
          overflow:hidden;
        }

        .wrap{
          width:100%;
          height:100%;
          background:#fff;
          padding:16px;
          position:relative;
          overflow:hidden;
        }

        .head{
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:16px;
          margin-bottom:10px;
        }

        .title{
          font-weight:700;
          color:#111827;
          line-height:1.2;
        }

        .subtitle{
          color:#6b7280;
          margin-top:3px;
        }

        .legend{
          display:flex;
          gap:18px;
          align-items:center;
          flex-wrap:wrap;
        }

        .legend.left{justify-content:flex-start;}
        .legend.right{justify-content:flex-end;}
        .legend.bottom{
          position:absolute;
          bottom:10px;
          left:16px;
          right:16px;
          justify-content:center;
        }

        .item{
          display:flex;
          align-items:center;
          gap:8px;
          color:#4b5563;
          font-size:13px;
          white-space:nowrap;
        }

        .dot{
          width:12px;
          height:12px;
          border-radius:50%;
        }

        .chart{
          width:100%;
          height:calc(100% - 70px);
        }

        .tooltip{
          position:absolute;
          pointer-events:none;
          background:rgba(17,24,39,.96);
          color:#fff;
          padding:10px 12px;
          border-radius:10px;
          font-size:12px;
          box-shadow:0 10px 24px rgba(0,0,0,.18);
          opacity:0;
          transform:translateY(4px);
          transition:all .12s ease;
          z-index:5;
          min-width:120px;
        }

        .tooltip.show{
          opacity:1;
          transform:translateY(0);
        }

        svg text{
          fill:#6b7280;
          font-size:12px;
        }

        .xlab{
          font-size:12px;
          fill:#4b5563;
        }

        .gridline{
          stroke:#e5e7eb;
          stroke-dasharray:4 5;
        }

        .bar{
          cursor:pointer;
          transition:opacity .15s ease;
        }

        .bar:hover{
          opacity:.85;
        }
      </style>

      <div class="wrap">
        <div class="head">
          <div>
            <div class="title" id="title"></div>
            <div class="subtitle" id="subtitle"></div>
          </div>
          <div class="legend" id="legend"></div>
        </div>

        <div class="chart" id="chart"></div>
        <div class="tooltip" id="tooltip"></div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    try {
      const titleEl = element.querySelector("#title");
      const subEl = element.querySelector("#subtitle");
      const legendEl = element.querySelector("#legend");
      const chartEl = element.querySelector("#chart");
      const tip = element.querySelector("#tooltip");

      titleEl.innerText = config.chart_title || "Chart";
      titleEl.style.fontSize = (config.title_font_size || 18) + "px";

      subEl.innerText = config.chart_subtitle || "";
      subEl.style.fontSize = (config.subtitle_font_size || 13) + "px";

      const dims = queryResponse.fields.dimension_like || [];
      const meas = queryResponse.fields.measure_like || [];
      const pivots = queryResponse.pivots || [];

      if (!dims.length || !meas.length || !pivots.length) {
        chartEl.innerHTML = "<div style='padding:12px;color:#6b7280'>Use: 1 X-axis dimension + 1 pivot dimension + 1 measure.</div>";
        done();
        return;
      }

      const xDim = dims[0].name;
      const measure = meas[0].name;

      const series = pivots.map((p, i) => ({
        key: p.key,
        label: p.label_short || p.label || p.key,
        color: i === 0
          ? (config.series_1_color || "#8b5cf6")
          : (config.series_2_color || "#06b6d4")
      }));

      renderLegend(series);

      const width = Math.max(chartEl.clientWidth, 300);
      const height = Math.max(chartEl.clientHeight, 280);

      const m = { top: 10, right: 12, bottom: 42, left: 52 };
      const cw = width - m.left - m.right;
      const ch = height - m.top - m.bottom;

      let allVals = [];
      data.forEach(r => {
        series.forEach(s => {
          const v = getVal(r, measure, s.key);
          if (v != null) allVals.push(v);
        });
      });

      const maxVal = allVals.length ? Math.max(...allVals) : 0;
      const ticks = 4;

      const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg.setAttribute("width", width);
      svg.setAttribute("height", height);

      const defs = document.createElementNS("http://www.w3.org/2000/svg","defs");
      svg.appendChild(defs);

      series.forEach((s, i) => {
        const grad = document.createElementNS("http://www.w3.org/2000/svg","linearGradient");
        grad.setAttribute("id", "grad" + i);
        grad.setAttribute("x1", "0%");
        grad.setAttribute("x2", "0%");
        grad.setAttribute("y1", "0%");
        grad.setAttribute("y2", "100%");

        const stop1 = document.createElementNS("http://www.w3.org/2000/svg","stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", darken(s.color, 0.12));

        const stop2 = document.createElementNS("http://www.w3.org/2000/svg","stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("stop-color", lighten(s.color, 0.35));

        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);
      });

      for (let i = 0; i <= ticks; i++) {
        const val = (maxVal / ticks) * i;
        const y = m.top + ch - (val / maxVal) * ch;

        const line = make("line", {
          x1: m.left,
          x2: m.left + cw,
          y1: y,
          y2: y,
          class: "gridline"
        });

        const txt = make("text", {
          x: m.left - 8,
          y: y + 4,
          "text-anchor": "end"
        });

        txt.textContent = formatAxis(val);

        svg.appendChild(line);
        svg.appendChild(txt);
      }

      const groupW = cw / data.length;
      const barW = Math.min(34, (groupW * 0.72) / series.length);

      data.forEach((row, rowIndex) => {
        const x0 = m.left + rowIndex * groupW + (groupW - (barW * series.length)) / 2;

        series.forEach((s, si) => {
          const v = getVal(row, measure, s.key) || 0;
          const h = maxVal === 0 ? 0 : (v / maxVal) * ch;
          const x = x0 + si * barW;
          const y = m.top + ch - h;

          const rect = make("rect", {
            x: x,
            y: m.top + ch,
            width: barW - 6,
            height: 0,
            rx: config.bar_radius || 10,
            ry: config.bar_radius || 10,
            fill: "url(#grad" + si + ")",
            class: "bar"
          });

          svg.appendChild(rect);

          animateBar(rect, y, h);

          rect.addEventListener("mousemove", e => {
            tip.innerHTML =
              "<div style='font-weight:700;margin-bottom:4px'>" + escapeHtml(row[xDim].value) + "</div>" +
              "<div>" + escapeHtml(s.label) + ": <b>" + formatValue(v) + "</b></div>";
            tip.style.left = (e.offsetX + 18) + "px";
            tip.style.top = (e.offsetY + 12) + "px";
            tip.classList.add("show");
          });

          rect.addEventListener("mouseleave", () => {
            tip.classList.remove("show");
          });
        });

        const xl = make("text", {
          x: m.left + rowIndex * groupW + groupW / 2,
          y: height - 10,
          "text-anchor": "middle",
          class: "xlab"
        });

        xl.textContent = row[xDim].value;
        svg.appendChild(xl);
      });

      chartEl.innerHTML = "";
      chartEl.appendChild(svg);

      done();

      function renderLegend(series){
        const pos = config.legend_position || "top-right";

        if (pos === "hidden") {
          legendEl.style.display = "none";
          return;
        }

        legendEl.style.display = "flex";
        legendEl.className = "legend " + (pos.includes("left") ? "left" :
                                          pos.includes("bottom") ? "bottom" : "right");

        legendEl.innerHTML = series.map(s => `
          <div class="item">
            <div class="dot" style="background:${s.color}"></div>
            <div>${escapeHtml(s.label)}</div>
          </div>
        `).join("");
      }

      function animateBar(el, finalY, finalH){
        const dur = Number(config.animation_ms || 900);
        const start = performance.now();

        function step(t){
          const p = Math.min(1, (t - start) / dur);
          const ease = 1 - Math.pow(1 - p, 3);

          const h = finalH * ease;
          const y = m.top + ch - h;

          el.setAttribute("y", y);
          el.setAttribute("height", h);

          if (p < 1) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
      }

      function getVal(row, measure, key){
        const c = row[measure] && row[measure][key];
        return c && c.value != null ? Number(c.value) : null;
      }

      function make(tag, attrs){
        const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
        Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
        return el;
      }

      function formatAxis(v){
        if (v >= 1000) return Math.round(v);
        return Math.round(v);
      }

      function formatValue(v){
        return Number(v).toLocaleString("en-US");
      }

      function lighten(hex, amt){
        return shade(hex, amt);
      }

      function darken(hex, amt){
        return shade(hex, -amt);
      }

      function shade(hex, amt){
        let c = hex.replace("#","");
        if (c.length === 3) c = c.split("").map(x => x + x).join("");

        let r = parseInt(c.substring(0,2),16);
        let g = parseInt(c.substring(2,4),16);
        let b = parseInt(c.substring(4,6),16);

        r = Math.min(255, Math.max(0, Math.round(r + 255 * amt)));
        g = Math.min(255, Math.max(0, Math.round(g + 255 * amt)));
        b = Math.min(255, Math.max(0, Math.round(b + 255 * amt)));

        return "#" + [r,g,b].map(v => v.toString(16).padStart(2,"0")).join("");
      }

      function escapeHtml(str){
        return String(str)
          .replace(/&/g,"&amp;")
          .replace(/</g,"&lt;")
          .replace(/>/g,"&gt;")
          .replace(/"/g,"&quot;")
          .replace(/'/g,"&#039;");
      }

    } catch (err) {
      element.innerHTML =
        "<div style='padding:12px;color:red'>Error: " + err.message + "</div>";
      done();
    }
  }
});