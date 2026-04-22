looker.plugins.visualizations.add({
  id: "kpi_trend_card",
  label: "KPI Trend Card",

  options: {
    card_title: {
      type: "string",
      label: "Title",
      default: "Fill Rate %",
      section: "Style",
      order: 1
    },
    title_color: {
      type: "string",
      label: "Title Color",
      display: "color",
      default: "#1F3B64",
      section: "Style",
      order: 2
    },
    value_color: {
      type: "string",
      label: "Main Value Color",
      display: "color",
      default: "#111827",
      section: "Style",
      order: 3
    },
    border_color: {
      type: "string",
      label: "Border Color",
      display: "color",
      default: "#D1D5DB",
      section: "Style",
      order: 4
    },
    bg_color: {
      type: "string",
      label: "Background",
      display: "color",
      default: "#FFFFFF",
      section: "Style",
      order: 5
    },
    positive_color: {
      type: "string",
      label: "Positive Badge",
      display: "color",
      default: "#16A34A",
      section: "Badge",
      order: 1
    },
    positive_bg: {
      type: "string",
      label: "Positive Background",
      display: "color",
      default: "#DCFCE7",
      section: "Badge",
      order: 2
    },
    negative_color: {
      type: "string",
      label: "Negative Badge",
      display: "color",
      default: "#DC2626",
      section: "Badge",
      order: 3
    },
    negative_bg: {
      type: "string",
      label: "Negative Background",
      display: "color",
      default: "#FEE2E2",
      section: "Badge",
      order: 4
    },
    footer_label: {
      type: "string",
      label: "Footer Prefix",
      default: "Prior:",
      section: "Labels",
      order: 1
    },
    compare_label: {
      type: "string",
      label: "Compare Text",
      default: "vs prior year",
      section: "Labels",
      order: 2
    },
    font_family: {
      type: "string",
      label: "Font Family",
      default: "Inter, Arial, sans-serif",
      section: "Style",
      order: 6
    }
  },

  create: function(element, config) {
    element.innerHTML = "";
    element.style.margin = "0";
    element.style.padding = "0";
  },

  updateAsync: function(data, element, config, queryResponse, details, doneRendering) {
    element.innerHTML = "";

    var measures = queryResponse.fields.measure_like || [];
    if (measures.length < 3) {
      element.innerHTML =
        '<div style="padding:16px;color:#6B7280;font-family:Arial;">Add 3 measures: Current %, Variance %, Prior %</div>';
      doneRendering();
      return;
    }

    if (!data || data.length === 0) {
      element.innerHTML =
        '<div style="padding:16px;color:#6B7280;font-family:Arial;">No data returned</div>';
      doneRendering();
      return;
    }

    var row = data[0];

    var currentVal = getVal(row[measures[0].name]);
    var varianceVal = getVal(row[measures[1].name]);
    var priorVal = getVal(row[measures[2].name]);

    var isPositive = varianceVal >= 0;
    var badgeColor = isPositive ? config.positive_color : config.negative_color;
    var badgeBg = isPositive ? config.positive_bg : config.negative_bg;
    var arrow = isPositive ? "↑" : "↓";

    var wrapper = document.createElement("div");
    wrapper.style.width = "100%";
    wrapper.style.height = "100%";
    wrapper.style.boxSizing = "border-box";
    wrapper.style.background = config.bg_color;
    wrapper.style.border = "1px solid " + config.border_color;
    wrapper.style.borderRadius = "10px";
    wrapper.style.fontFamily = config.font_family;
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.overflow = "hidden";

    // Header
    var header = document.createElement("div");
    header.style.padding = "12px 16px";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.borderBottom = "1px solid #E5E7EB";

    var title = document.createElement("div");
    title.textContent = config.card_title;
    title.style.fontSize = "14px";
    title.style.fontWeight = "700";
    title.style.color = config.title_color;

    var dots = document.createElement("div");
    dots.textContent = "•••";
    dots.style.fontSize = "16px";
    dots.style.color = "#6B7280";
    dots.style.lineHeight = "1";

    header.appendChild(title);
    header.appendChild(dots);

    // Body
    var body = document.createElement("div");
    body.style.padding = "18px 16px";
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "10px";
    body.style.flex = "1";

    var value = document.createElement("div");
    value.textContent = formatPercent(currentVal);
    value.style.fontSize = "28px";
    value.style.fontWeight = "800";
    value.style.color = config.value_color;
    value.style.lineHeight = "1";

    var compareRow = document.createElement("div");
    compareRow.style.display = "flex";
    compareRow.style.alignItems = "center";
    compareRow.style.gap = "8px";
    compareRow.style.flexWrap = "wrap";

    var badge = document.createElement("div");
    badge.textContent = arrow + " " + formatVariance(varianceVal);
    badge.style.background = badgeBg;
    badge.style.color = badgeColor;
    badge.style.padding = "4px 8px";
    badge.style.borderRadius = "6px";
    badge.style.fontSize = "14px";
    badge.style.fontWeight = "700";
    badge.style.lineHeight = "1";

    var compareText = document.createElement("div");
    compareText.textContent = config.compare_label;
    compareText.style.fontSize = "14px";
    compareText.style.color = "#6B7280";

    compareRow.appendChild(badge);
    compareRow.appendChild(compareText);

    var footer = document.createElement("div");
    footer.textContent = config.footer_label + " " + formatPercent(priorVal);
    footer.style.fontSize = "13px";
    footer.style.color = "#6B7280";

    body.appendChild(value);
    body.appendChild(compareRow);
    body.appendChild(footer);

    wrapper.appendChild(header);
    wrapper.appendChild(body);

    element.appendChild(wrapper);
    doneRendering();

    function getVal(cell) {
      if (!cell) return 0;
      return Number(cell.value) || 0;
    }

    function formatPercent(val) {
      return (val * 100).toFixed(1) + "%";
    }

    function formatVariance(val) {
      return Math.abs(val * 100).toFixed(1) + "%";
    }
  }
});