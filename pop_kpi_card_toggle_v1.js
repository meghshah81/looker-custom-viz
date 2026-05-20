looker.plugins.visualizations.add({
  id: "pop_kpi_card_toggle_v1",
  label: "POP KPI Card with Toggle",

  options: {

    card_title: {
      type: "string",
      label: "Card Title",
      default: "Cancelled Appointments",
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
    },

    active_toggle_bg: {
      type: "string",
      label: "Active Toggle Background",
      display: "color",
      default: "#16325c",
      section: "Toggle"
    },

    active_toggle_text: {
      type: "string",
      label: "Active Toggle Text",
      display: "color",
      default: "#ffffff",
      section: "Toggle"
    },

    inactive_toggle_bg: {
      type: "string",
      label: "Inactive Toggle Background",
      display: "color",
      default: "#f3f4f6",
      section: "Toggle"
    },

    inactive_toggle_text: {
      type: "string",
      label: "Inactive Toggle Text",
      display: "color",
      default: "#374151",
      section: "Toggle"
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
          overflow: hidden;
        }

        .top-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 18px;
        }

        .pop-header {
          color: #16325c;
          font-weight: 700;
          line-height: 1.2;
          flex: 1;
          word-break: break-word;
          overflow-wrap: break-word;
        }

        .toggle-wrap {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
          max-width: 50%;
        }

        .toggle-btn {
          border: none;
          padding: 5px 10px;
          border-radius: 999px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.15s ease;
          white-space: nowrap;
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
          white-space: nowrap;
        }

        .compare-label {
          color: #5f6b7a;
          font-weight: 500;
          flex: 1;
          min-width: 0;
          word-break: break-word;
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

      const dimensions =
        queryResponse.fields.dimension_like || [];

      const measures =
        queryResponse.fields.measure_like || [];

      // =====================================================
      // VALIDATION
      // =====================================================

      if (
        dimensions.length !== 2 ||
        measures.length !== 1
      ) {

        element.querySelector("#viz-container").innerHTML = `
          <div class="validation-error">
            <div class="validation-box">

              <div class="validation-title">
                This visualization requires exactly:
              </div>

              • 2 Dimensions
              <br>
              • 1 Measure

            </div>
          </div>
        `;

        done();
        return;
      }

      const periodDim = dimensions[0].name;
      const toggleDim = dimensions[1].name;
      const measureName = measures[0].name;

      // =====================================================
      // GROUP DATA
      // =====================================================

      const grouped = {};

      data.forEach(row => {

        const period =
          String(
            row[periodDim]?.value || ""
          );

        const toggle =
          String(
            row[toggleDim]?.value || ""
          );

        const cell =
          row[measureName];

        const value =
          Number(cell?.value || 0);

        if (!grouped[toggle]) {

          grouped[toggle] = {
            selected: 0,
            previous: 0,
            selectedCell: null,
            previousCell: null
          };
        }

        if (period === "Selected Period") {

          grouped[toggle].selected = value;
          grouped[toggle].selectedCell = cell;
        }

        if (period === "Previous Period") {

          grouped[toggle].previous = value;
          grouped[toggle].previousCell = cell;
        }

      });

      const toggleValues =
        Object.keys(grouped);

      if (!toggleValues.length) {

        element.querySelector("#viz-container").innerHTML =
          "<div style='padding:16px;'>No data found</div>";

        done();
        return;
      }

      let activeToggle =
        toggleValues[0];

      // =====================================================
      // BUILD HTML
      // =====================================================

      element.querySelector("#viz-container").innerHTML = `
        <div class="pop-card">

          <div class="top-row">

            <div class="pop-header">
              <div id="title"></div>
            </div>

            <div id="toggleWrap"
                 class="toggle-wrap">
            </div>

          </div>

          <div id="kpi"
               class="kpi">
          </div>

          <div class="compare-row">

            <div id="badge"
                 class="badge">
            </div>

            <div id="compareText"
                 class="compare-label">
            </div>

          </div>

          <div id="footer"
               class="footer">
          </div>

        </div>
      `;

      const title =
        element.querySelector("#title");

      const kpi =
        element.querySelector("#kpi");

      const badge =
        element.querySelector("#badge");

      const compareText =
        element.querySelector("#compareText");

      const footer =
        element.querySelector("#footer");

      const toggleWrap =
        element.querySelector("#toggleWrap");

      // =====================================================
      // TITLE
      // =====================================================

      title.innerText =
        config.card_title || "KPI";

      title.style.fontSize =
        (config.title_font_size || 18) + "px";

      // =====================================================
      // TOGGLE BUTTONS
      // =====================================================

      toggleValues.forEach(val => {

        const btn =
          document.createElement("button");

        btn.className = "toggle-btn";

        btn.innerText = val;

        btn.onclick = () => {

          activeToggle = val;

          render();

          updateToggleStyles();
        };

        toggleWrap.appendChild(btn);
      });

      function updateToggleStyles() {

        const buttons =
          toggleWrap.querySelectorAll(".toggle-btn");

        buttons.forEach(btn => {

          const isActive =
            btn.innerText === activeToggle;

          btn.style.background =
            isActive
              ? config.active_toggle_bg
              : config.inactive_toggle_bg;

          btn.style.color =
            isActive
              ? config.active_toggle_text
              : config.inactive_toggle_text;
        });
      }

      // =====================================================
      // RENDER
      // =====================================================

      function render() {

        const current =
          grouped[activeToggle];

        const selectedVal =
          current.selected;

        const previousVal =
          current.previous;

        const selectedCell =
          current.selectedCell;

        const previousCell =
          current.previousCell;

        const pct =
          previousVal === 0
            ? null
            : (
                (
                  selectedVal - previousVal
                ) / previousVal
              );

        const isPositive =
          pct >= 0;

        const good =
          (
            !config.positive_values_bad &&
            isPositive
          ) ||
          (
            config.positive_values_bad &&
            !isPositive
          );

        // KPI

        kpi.innerText =
          formatValue(selectedCell);

        kpi.style.fontSize =
          (config.kpi_font_size || 52) + "px";

        // Badge

        if (pct === null || isNaN(pct)) {

          badge.innerText = "--";

        } else {

          const arrow =
            pct >= 0 ? "▲" : "▼";

          badge.innerText =
            arrow +
            " " +
            (
              Math.abs(pct) * 100
            ).toFixed(2) +
            "%";
        }

        badge.className =
          "badge " + (
            good ? "up" : "down"
          );

        badge.style.fontSize =
          (config.compare_font_size || 16) + "px";

        // Compare Text

        compareText.innerText =
          "vs " +
          detectLabel(queryResponse);

        compareText.style.fontSize =
          (config.compare_font_size || 16) + "px";

        // Footer

        if (config.show_footer) {

          footer.style.display =
            "block";

          footer.innerText =
            "Prior: " +
            formatValue(previousCell);

          footer.style.fontSize =
            (
              config.footer_font_size || 16
            ) + "px";

        } else {

          footer.style.display =
            "none";
        }

      }

      updateToggleStyles();
      render();

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

    // =====================================================
    // FORMAT VALUE
    // =====================================================

    function formatValue(cell) {

      if (
        cell &&
        cell.rendered !== undefined &&
        cell.rendered !== null
      ) {

        return cell.rendered;
      }

      return Number(
        cell?.value || 0
      ).toLocaleString("en-US");
    }

    // =====================================================
    // DETECT LABEL
    // =====================================================

    function detectLabel(queryResponse) {

      try {

        const filters =
          queryResponse.filters || {};

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
