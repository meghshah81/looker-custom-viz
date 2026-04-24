looker.plugins.visualizations.add({
  id: "pop_kpi_card_v2",
  label: "POP KPI Card v2",

  options: {
    card_title: {
      type: "string",
      label: "Card Title",
      default: "Total Appointments",
      section: "Style"
    },

    title_font_size: {
      type: "number",
      label: "Title Font Size",
      default: 18,
      section: "Style"
    },

    kpi_font_size: {
      type: "number",
      label: "KPI Font Size",
      default: 52,
      section: "Style"
    },

    compare_font_size: {
      type: "number",
      label: "Comparison Font Size",
      default: 16,
      section: "Style"
    },

    footer_font_size: {
      type: "number",
      label: "Footer Font Size",
      default: 16,
      section: "Style"
    },

    positive_values_bad: {
      type: "boolean",
      label: "Positive Values Are Bad",
      default: false,
      section: "Style"
    },

    show_footer: {
      type: "boolean",
      label: "Show Prior Value",
      default: true,
      section: "Style"
    }
  },

  create: function (element) {
    element.innerHTML = `
      <style>
        *{
          box-sizing:border-box;
          font-family: Roboto, Arial, sans-serif;
        }

        .pop-card{
          width:100%;
          height:100%;
          padding:14px 16px;
          background:#fff;
          display:flex;
          flex-direction:column;
          justify-content:flex-start;
        }

        .pop-header{
          display:flex;
          justify-content:flex-start;
          align-items:center;
          color:#16325c;
          font-weight:700;
          margin-bottom:18px;
        }

        .kpi{
          font-weight:700;
          color:#16325c;
          line-height:1.1;
          margin-bottom:14px;
        }

        .compare-row{
          display:flex;
          align-items:center;
          gap:8px;
          margin-bottom:10px;
          flex-wrap:wrap;
        }

        .badge{
          display:inline-flex;
          align-items:center;
          gap:4px;
          padding:2px 8px;
          border-radius:6px;
          font-weight:600;
          white-space:nowrap;
        }

        .compare-label{
          color:#5f6b7a;
        }

        .footer{
          color:#5f6b7a;
        }

        .up{color:#16a34a;background:#eaf7ee;}
        .down{color:#dc2626;background:#fdecec;}
      </style>

      <div class="pop-card">
        <div class="pop-header">
          <div id="title"></div>
        </div>

        <div id="kpi" class="kpi"></div>

        <div class="compare-row">
          <div id="badge" class="badge"></div>
          <div id="compareText" class="compare-label"></div>
        </div>

        <div id="footer" class="footer"></div>
      </div>
    `;
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    try {
      const measureName = queryResponse.fields.measure_like[0].name;
      const dimensionName = queryResponse.fields.dimension_like.length
        ? queryResponse.fields.dimension_like[0].name
        : null;

      let selectedVal = null;
      let previousVal = null;

      data.forEach(row => {
        const label = dimensionName ? row[dimensionName].value : "";

        if (label === "Selected Period") selectedVal = row[measureName].value;
        if (label === "Previous Period") previousVal = row[measureName].value;
      });

      if (selectedVal === null) selectedVal = 0;
      if (previousVal === null) previousVal = 0;

      const pct = previousVal === 0
        ? null
        : ((selectedVal - previousVal) / previousVal) * 100;

      const positiveBad = config.positive_values_bad;
      const isPositive = pct >= 0;

      const good =
        (!positiveBad && isPositive) ||
        (positiveBad && !isPositive);

      const badge = element.querySelector("#badge");
      const title = element.querySelector("#title");
      const kpi = element.querySelector("#kpi");
      const compareText = element.querySelector("#compareText");
      const footer = element.querySelector("#footer");

      const arrow = pct >= 0 ? "▲" : "▼";
      const absPct = pct === null ? "--" : Math.abs(pct).toFixed(1) + "%";

      badge.className = "badge " + (good ? "up" : "down");
      badge.innerHTML = `${arrow} ${absPct}`;

      title.innerText = config.card_title || "KPI";
      title.style.fontSize = (config.title_font_size || 18) + "px";

      kpi.innerText = formatNumber(selectedVal);
      kpi.style.fontSize = (config.kpi_font_size || 52) + "px";

      compareText.innerText = "vs " + detectLabel(queryResponse);
      compareText.style.fontSize = (config.compare_font_size || 16) + "px";

      if (config.show_footer) {
        footer.style.display = "block";
        footer.innerText = "Prior: " + formatNumber(previousVal);
        footer.style.fontSize = (config.footer_font_size || 16) + "px";
      } else {
        footer.style.display = "none";
      }

      done();

    } catch (err) {
      element.innerHTML =
        "<div style='padding:12px;color:red;'>Error: " + err.message + "</div>";
      done();
    }

    function formatNumber(x) {
      return Number(x || 0).toLocaleString("en-US");
    }

    function detectLabel(queryResponse) {
      try {
        const txt = JSON.stringify(queryResponse).toLowerCase();

        if (txt.includes("last year")) return "prior year";
        if (txt.includes("last quarter")) return "prior quarter";
        if (txt.includes("last month")) return "prior month";
        if (txt.includes("previous period")) return "previous period";
        if (txt.includes("custom")) return "comparison period";

        return "prior period";
      } catch (e) {
        return "prior period";
      }
    }
  }
});
