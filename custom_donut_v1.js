looker.plugins.visualizations.add({
  id: "custom_donut_v1",
  label: "Custom Donut v1",

  options: {
    chart_title: {
      type: "string",
      label: "Title",
      default: "Sales by Category",
      section: "Style"
    },

    chart_subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Revenue distribution this month",
      section: "Style"
    },

    donut_thickness: {
      type: "number",
      label: "Ring Thickness",
      default: 28,
      section: "Style"
    },

    show_legend: {
      type: "boolean",
      label: "Show Legend",
      default: true,
      section: "Legend"
    },

    show_center_total: {
      type: "boolean",
      label: "Show Center Total",
      default: true,
      section: "Style"
    },

    currency_prefix: {
      type: "string",
      label: "Value Prefix",
      default: "$",
      section: "Formatting"
    },

    decimals: {
      type: "number",
      label: "Decimals",
      default: 1,
      section: "Formatting"
    }
  },

  create: function(element) {
    element.innerHTML = `
      <style>
        *{
          box-sizing:border-box;
          font-family:Roboto, Arial, sans-serif;
        }

        html, body{
          margin:0;
          padding:0;
          background:transparent;
        }

        .wrap{
          width:100%;
          height:100%;
          padding:20px 24px;
          background:#ffffff;
          border-radius:18px;
          display:flex;
          flex-direction:column;
          gap:18px;
        }

        .header{
          display:flex;
          flex-direction:column;
          gap:4px;
        }

        .title{
          font-size:28px;
          font-weight:700;
          color:#111827;
          line-height:1.2;
        }

        .subtitle{
          font-size:14px;
          color:#6b7280;
        }

        .content{
          display:grid;
          grid-template-columns: 1fr 320px;
          gap:20px;
          align-items:center;
          flex:1;
          min-height:0;
        }

        .chart-area{
          display:flex;
          align-items:center;
          justify-content:center;
          min-height:280px;
          position:relative;
        }

        .legend{
          display:flex;
          flex-direction:column;
          gap:12px;
          overflow:auto;
          padding-right:4px;
        }

        .legend-row{
          display:grid;
          grid-template-columns: 18px 1fr auto auto;
          gap:10px;
          align-items:center;
          font-size:14px;
        }

        .dot{
          width:10px;
          height:10px;
          border-radius:50%;
        }

        .name{
          color:#111827;
          overflow:hidden;
          white-space:nowrap;
          text-overflow:ellipsis;
        }

        .pct{
          color:#6b7280;
          min-width:58px;
          text-align:right;
        }

        .val{
          color:#111827;
          font-weight:600;
          min-width:70px;
          text-align:right;
        }

        .empty{
          display:flex;
          align-items:center;
          justify-content:center;
          height:100%;
          color:#6b7280;
          font-size:14px;
        }

        svg{
          overflow:visible;
        }

        .slice{
          cursor:pointer;
          transition:transform .18s ease, opacity .18s ease;
          transform-origin:center;
        }

        .slice:hover{
          opacity:.9;
          transform:scale(1.03);
        }

        .center-label{
          font-size:12px;
          fill:#6b7280;
          text-transform:uppercase;
          letter-spacing:.08em;
        }

        .center-value{
          font-size:30px;
          font-weight:700;
          fill:#111827;
        }

        @media (max-width: 900px){
          .content{
            grid-template-columns:1fr;
          }
          .chart-area{
            min-height:240px;
          }
        }
      </style>

      <div class="wrap">
        <div class="header">
          <div class="title" id="title"></div>
          <div class="subtitle" id="subtitle"></div>
        </div>

        <div class="content">
          <div class="chart-area" id="chart"></div>
          <div class="legend" id="legend"></div>
        </div>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    try {
      const titleEl = element.querySelector("#title");
      const subtitleEl = element.querySelector("#subtitle");
      const chartEl = element.querySelector("#chart");
      const legendEl = element.querySelector("#legend");

      titleEl.innerText = config.chart_title || "Donut Chart";
      subtitleEl.innerText = config.chart_subtitle || "";

      const dim = queryResponse.fields.dimension_like[0].name;
      const measure = queryResponse.fields.measure_like[0].name;

      const rows = data.map(r => ({
        label: String(r[dim].value),
        value: Number(r[measure].value || 0)
      })).filter(d => d.value !== null);

      const total = rows.reduce((a,b) => a + b.value, 0);

      if (!rows.length || total === 0) {
        chartEl.innerHTML = '<div class="empty">No data available</div>';
        legendEl.innerHTML = "";
        done();
        return;
      }

      const palette = [
        "#7c4ce0",
        "#1298b8",
        "#0aa84f",
        "#d99a00",
        "#c94398",
        "#ef4444",
        "#14b8a6",
        "#6366f1",
        "#f97316",
        "#84cc16"
      ];

      const width = Math.max(chartEl.clientWidth, 320);
      const height = Math.max(chartEl.clientHeight, 280);
      const size = Math.min(width, height);
      const cx = size / 2;
      const cy = size / 2;
      const outerR = size * 0.33;
      const thickness = Number(config.donut_thickness || 28);
      const innerR = outerR - thickness;

      let start = -Math.PI / 2;

      const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg.setAttribute("width", size);
      svg.setAttribute("height", size);
      svg.setAttribute("viewBox", `0 0 ${size} ${size}`);

      rows.forEach((row, i) => {
        const angle = (row.value / total) * Math.PI * 2;
        const end = start + angle;

        const path = document.createElementNS("http://www.w3.org/2000/svg","path");
        path.setAttribute("d", donutArc(cx, cy, innerR, outerR, start, end));
        path.setAttribute("fill", palette[i % palette.length]);
        path.setAttribute("class", "slice");

        path.addEventListener("mouseenter", () => {
          renderCenter(row.label, formatNumber(row.value));
        });

        path.addEventListener("mouseleave", () => {
          renderCenter("TOTAL", compactNumber(total));
        });

        svg.appendChild(path);
        start = end;
      });

      if (config.show_center_total !== false) {
        renderCenter("TOTAL", compactNumber(total));
      }

      chartEl.innerHTML = "";
      chartEl.appendChild(svg);

      if (config.show_legend === false) {
        legendEl.innerHTML = "";
      } else {
        legendEl.innerHTML = rows.map((row, i) => {
          const pct = total === 0 ? 0 : (row.value / total) * 100;
          return `
            <div class="legend-row">
              <div class="dot" style="background:${palette[i % palette.length]}"></div>
              <div class="name">${escapeHtml(row.label)}</div>
              <div class="pct">${pct.toFixed(1)}%</div>
              <div class="val">${formatNumber(row.value)}</div>
            </div>
          `;
        }).join("");
      }

      done();

      function renderCenter(label, valueText){
        let existing = svg.querySelectorAll(".center-text");
        existing.forEach(n => n.remove());

        const t1 = document.createElementNS("http://www.w3.org/2000/svg","text");
        t1.setAttribute("x", cx);
        t1.setAttribute("y", cy - 8);
        t1.setAttribute("text-anchor", "middle");
        t1.setAttribute("class", "center-label center-text");
        t1.textContent = label;

        const t2 = document.createElementNS("http://www.w3.org/2000/svg","text");
        t2.setAttribute("x", cx);
        t2.setAttribute("y", cy + 22);
        t2.setAttribute("text-anchor", "middle");
        t2.setAttribute("class", "center-value center-text");
        t2.textContent = valueText;

        svg.appendChild(t1);
        svg.appendChild(t2);
      }

      function donutArc(cx, cy, r1, r2, a0, a1){
        const large = a1 - a0 > Math.PI ? 1 : 0;

        const p1 = polar(cx, cy, r2, a0);
        const p2 = polar(cx, cy, r2, a1);
        const p3 = polar(cx, cy, r1, a1);
        const p4 = polar(cx, cy, r1, a0);

        return [
          "M", p1.x, p1.y,
          "A", r2, r2, 0, large, 1, p2.x, p2.y,
          "L", p3.x, p3.y,
          "A", r1, r1, 0, large, 0, p4.x, p4.y,
          "Z"
        ].join(" ");
      }

      function polar(cx, cy, r, a){
        return {
          x: cx + r * Math.cos(a),
          y: cy + r * Math.sin(a)
        };
      }

      function compactNumber(n){
        const d = Number(config.decimals || 1);

        if (Math.abs(n) >= 1000000000) return (n/1000000000).toFixed(d) + "B";
        if (Math.abs(n) >= 1000000) return (n/1000000).toFixed(d) + "M";
        if (Math.abs(n) >= 1000) return (n/1000).toFixed(d) + "k";
        return Number(n).toFixed(d);
      }

      function formatNumber(n){
        const prefix = config.currency_prefix || "";
        return prefix + compactNumber(n);
      }

      function escapeHtml(str){
        return String(str)
          .replace(/&/g,"&amp;")
          .replace(/</g,"&lt;")
          .replace(/>/g,"&gt;")
          .replace(/"/g,"&quot;")
          .replace(/'/g,"&#039;");
      }

    } catch(err) {
      element.innerHTML =
        "<div style='padding:12px;color:red;'>Error: " +
        err.message +
        "</div>";
      done();
    }
  }
});