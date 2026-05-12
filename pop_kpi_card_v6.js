looker.plugins.visualizations.add({
  id: "pop_kpi_card_v6",
  label: "POP KPI Card v6",

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
        * {
          box-sizing: border-box;
          font-family: Roboto, Arial, sans-serif;
        }

        html, body {
          margin: 0;
          padding: 0;
          background: transparent;
        }

        .pop-card {
          width: 100%;
          height: 100%;
          padding: 14px 16px;
          background: transparent;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          outline: none !important;
          overflow: hidden;
        }

        .pop-header {
          display: flex;
          justify-content: flex-start;
          align-items: flex-start;
          color: #16325c;
          font-weight: 700;
          margin-bottom: 18px;
          line-height: 1.2;
          width: 100%;
          word-break: break-word;
          overflow-wrap: break-word;
        }

        .kpi {
          font-weight: 700;
          color: #16325c;
          line-height: 1.1;
          margin-bottom: 14px;
          word-break: break-word;
        }

        .compare-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          flex-wrap: wrap;
          width: 100%;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 8px;
          font-weight: 700;
          white-space: normal;
          word-break: break-word;
          max-width: 100%;
        }

        .compare-label {
          color: #5f6b7a;
          font-weight: 500;
          white-space: normal;
          word-break: break-word;
          overflow-wrap: break-word;
          flex: 1;
          min-width: 0;
        }

        .footer {
          color: #5f6b7a;
          font-weight: 500;
          word-break: break-word;
        }

        .up {
          color: #16a34a;
          background: #eaf7ee;
        }

        .down {
          color: #dc2626;
          background: #fdecec;
        }

        .validation-error {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .validation-box {
          width: 100%;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #dc2626;
          border-radius: 10px;
          padding: 18px;
          font-size: 14px;
          line-height: 1.6;
        }

        .validation-title {
          font-weight: 700;
          margin-bottom: 8px;
        }
      </style>

      <div id="viz-container"></div>
    `;
  },

  updateAsync: function (
    data,
    element,
    config,
    queryResponse,
    details,
    done
  ) {
    try {

      // =========================
      // VALIDATION
      // =========================

      const dimensions = queryResponse.fields.dimension_like || [];
      const measures = queryResponse.fields.measure_like || [];

      if (dimensions.length !== 1 || measures.length !== 1) {

        element.querySelector("#viz-container").innerHTML = `
          <div class="validation-error">
            <div class="validation-box">
              <div class="validation-title">
                This visualization requires exactly:
              </div>

              • 1 Dimension
              <br>
              • 1 Measure
            </div>
          </div>
        `;

        done();
        return;
      }

      // =========================
      // FIELD REFERENCES
      // =========================

      const measureName = measures[0].name;
      const dimensionName = dimensions[0].name;

      let selectedVal = 0;
      let previousVal = 0;

      // =========================
      // READ DATA
      // =========================

      data.forEach(row => {

        const label = row[dimensionName]
          ? String(row[dimensionName].value || "")
          : "";

        if (label === "Selected Period") {
          selectedVal = Number(row[measureName].value || 0);
        }

        if (label === "Previous Period") {
          previousVal = Number(row[measureName].value || 0);
        }
      });

      // =========================
      // PERCENT CALCULATION
      // =========================

      const pct =
        previousVal === 0
          ? null
          : ((selectedVal - previousVal) / previousVal);

      const isPositive = pct >= 0;

      const good =
        (!config.positive_values_bad && isPositive) ||
        (config.positive_values_bad && !isPositive);

      // =========================
      // BUILD HTML
      // =========================

      element.querySelector("#viz-container").innerHTML = `
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

      // =========================
      // ELEMENT REFERENCES
      // =========================

      const title = element.querySelector("#title");
      const kpi = element.querySelector("#kpi");
      const badge = element.querySelector("#badge");
      const compareText = element.querySelector("#compareText");
      const footer = element.querySelector("#footer");

      // =========================
      // TITLE
      // =========================

      title.innerText = config.card_title || "KPI";

      title.style.fontSize =
        (config.title_font_size || 18) + "px";

      // =========================
      // KPI VALUE
      // =========================

      kpi.innerText = formatNumber(selectedVal);

      kpi.style.fontSize =
        (config.kpi_font_size || 52) + "px";

      // =========================
      // BADGE
      // =========================

      if (pct === null || isNaN(pct)) {

        badge.innerText = "--";

      } else {

        const arrow = pct >= 0 ? "▲" : "▼";

        badge.innerText =
          arrow +
          " " +
          (Math.abs(pct) * 100).toFixed(2) +
          "%";
      }

      badge.className =
        "badge " + (good ? "up" : "down");

      badge.style.fontSize =
        (config.compare_font_size || 16) + "px";

      // =========================
      // COMPARISON LABEL
      // =========================

      compareText.innerText =
        "vs " + detectLabel(queryResponse);

      compareText.style.fontSize =
        (config.compare_font_size || 16) + "px";

      // =========================
      // FOOTER
      // =========================

      if (config.show_footer) {

        footer.style.display = "block";

        footer.innerText =
          "Prior: " + formatNumber(previousVal);

        footer.style.fontSize =
          (config.footer_font_size || 16) + "px";

      } else {

        footer.style.display = "none";
      }

      done();

    } catch (err) {

      element.querySelector("#viz-container").innerHTML = `
        <div class="validation-error">
          <div class="validation-box">
            Error: ${err.message}
          </div>
        </div>
      `;

      done();
    }

    // =========================
    // FORMAT NUMBER
    // =========================

    function formatNumber(val) {

      const num = Number(val || 0);
    
      // Detect percentage-like decimal values
      if (Math.abs(num) <= 1) {
        return (num * 100).toFixed(2) + "%";
      }
    
      return num.toLocaleString("en-US");
    }

    // =========================
    // DETECT LABEL
    // =========================

    function detectLabel(queryResponse) {

      try {

        const filters = queryResponse.filters || {};

        for (const key in filters) {

          const val =
            String(filters[key]).toLowerCase();

          if (val.includes("last year")) {
            return "prior year";
          }

          if (val.includes("last quarter")) {
            return "prior quarter";
          }

          if (val.includes("last month")) {
            return "prior month";
          }

          if (val.includes("previous period")) {
            return "previous period";
          }

          if (val.includes("custom period")) {
            return "comparison period";
          }
        }

        return "prior period";

      } catch (e) {

        return "prior period";
      }
    }
  }
});
