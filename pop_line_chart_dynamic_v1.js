// Load Chart.js dynamically from CDN if it doesn't exist yet
if (!window.Chart) {
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/chart.js";
  document.head.appendChild(script);
}

looker.plugins.visualizations.add({
  id: "pop_line_chart_dynamic_v1",
  label: "Dynamic Multi-Measure PoP Line & Area Chart",

  // Base configurations initialized immediately
  options: {
    global_point_style: {
      type: "string",
      label: "Point Style",
      default: "none",
      display: "select",
      values: [
        { "None": "none" },
        { "Filled": "filled" },
        { "Outline": "outline" }
      ],
      section: "Plot"
    },
    global_value_labels: {
      type: "boolean",
      label: "Value Labels",
      default: false,
      section: "Plot"
    }
  },

  create: function (element) {
    element.innerHTML = `
      <style>
        .viz-container {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          font-family: Roboto, Arial, sans-serif;
          padding: 10px;
          background: #ffffff;
          box-sizing: border-box;
        }
        .viz-header {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          margin-bottom: 15px;
          width: 100%;
        }
        .toggle-group {
          display: inline-flex;
          background-color: #f1f3f5;
          border-radius: 20px;
          padding: 4px;
          border: 1px solid #e2e8f0;
        }
        .toggle-btn {
          background: none;
          border: none;
          padding: 6px 16px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          border-radius: 16px;
          transition: all 0.2s ease;
        }
        .toggle-btn.active {
          background-color: #ffffff;
          color: #0f2d5c;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        }
        .chart-wrapper {
          flex: 1;
          position: relative;
          width: 100%;
          height: calc(100% - 40px);
        }
        .error-box {
          padding: 20px;
          color: #dc2626;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          margin: 20px;
        }
      </style>
      <div class="viz-container">
        <div class="viz-header">
          <div class="toggle-group">
            <button class="toggle-btn" data-grain="date">Date</button>
            <button class="toggle-btn active" data-grain="week">Week</button>
            <button class="toggle-btn" data-grain="month">Month</button>
          </div>
        </div>
        <div class="chart-wrapper">
          <canvas id="popLineChart"></canvas>
        </div>
      </div>
    `;
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    const container = element.querySelector(".viz-container");
    
    const existingError = element.querySelector(".error-box");
    if (existingError) existingError.remove();

    // =====================================================
    // VALIDATION
    // =====================================================
    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];
    const pivots = queryResponse.fields.pivots || [];

    if (dimensions.length < 1 || measures.length < 1) {
      container.style.display = "none";
      const errorDiv = document.createElement("div");
      errorDiv.className = "error-box";
      errorDiv.innerHTML = "<strong>Requirements Missing:</strong> This visual requires at least 1 Dimension (Date) and 1 or more Measures.";
      element.appendChild(errorDiv);
      done();
      return;
    }

    container.style.display = "flex";
    const dateDimName = dimensions[0].name;

    if (!window.Chart) {
      setTimeout(() => this.updateAsync(data, element, config, queryResponse, details, done), 100);
      return;
    }

    if (!this.currentGrain) {
      this.currentGrain = "week";
    }

    // =====================================================
    // DYNAMIC SERIES DISCOVERY ENGINE & PALETTE MAP
    // =====================================================
    const defaultPalette = ["#1ad1ff", "#0f2d5c", "#7c3aed", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];
    const seriesMap = {};
    const pivotDefs = queryResponse.pivots || [];

    measures.forEach(m => {
      if (pivotDefs.length > 0) {
        pivotDefs.forEach(p => {
          const seriesId = `${m.name}___${p.key}`.replace(/\./g, '_');
          const pivotLabel = Object.values(p.metadata).map(meta => meta.value).join(' - ') || p.key;
          seriesMap[seriesId] = {
            id: seriesId,
            measureName: m.name,
            pivotKey: p.key,
            label: `${m.label} (${pivotLabel})`
          };
        });
      } else {
        const seriesId = m.name.replace(/\./g, '_');
        seriesMap[seriesId] = {
          id: seriesId,
          measureName: m.name,
          pivotKey: null,
          label: m.label
        };
      }
    });

    // =====================================================
    // AUTOMATED DYNAMIC CONFIGURATION INJECTION
    // =====================================================
    const dynamicOptions = {
      global_point_style: this.options.global_point_style,
      global_value_labels: this.options.global_value_labels
    };

    Object.keys(seriesMap).forEach((sId, idx) => {
      const spec = seriesMap[sId];
      const fallbackColor = defaultPalette[idx % defaultPalette.length];

      dynamicOptions[`label_${sId}`] = {
        type: "string",
        label: `Label: ${spec.label}`,
        default: spec.label,
        section: "Series Styles"
      };
      dynamicOptions[`color_${sId}`] = {
        type: "string",
        label: `Color: ${spec.label}`,
        default: fallbackColor,
        display: "color",
        section: "Series Styles"
      };
      dynamicOptions[`linestyle_${sId}`] = {
        type: "string",
        label: `Line Style: ${spec.label}`,
        default: "solid",
        display: "select",
        values: [{ "Solid": "solid" }, { "Dashed": "dashed" }],
        section: "Series Styles"
      };
      dynamicOptions[`area_${sId}`] = {
        type: "boolean",
        label: `Show Area: ${spec.label}`,
        default: false,
        section: "Series Styles"
      };
    });

    // Safeguard to register configuration modifications only when fields change layout shapes
    const schemaKeys = Object.keys(dynamicOptions);
    if (!this.registeredKeys || JSON.stringify(this.registeredKeys) !== JSON.stringify(schemaKeys)) {
      this.trigger('registerOptions', dynamicOptions);
      this.registeredKeys = schemaKeys;
    }

    // Handle Top Temporal Grain Navigation Bar
    const buttons = element.querySelectorAll(".toggle-btn");
    buttons.forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-grain") === this.currentGrain);
    });

    buttons.forEach(btn => {
      const clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
    });

    element.querySelectorAll(".toggle-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.currentGrain = e.target.getAttribute("data-grain");
        this.isFrontendToggleAction = true; 
        element.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        processAndRender();
      });
    });

    // =====================================================
    // AUTOMATIC METRIC TYPE & SCALE DETECTION ENGINE
    // =====================================================
    const measureSpecs = {};
    measures.forEach(m => {
      let isPercent = false;
      let needsScaling = false;

      if (m.value_format && m.value_format.includes('%')) {
        isPercent = true;
      }

      for (let i = 0; i < data.length; i++) {
        const cellContainer = data[i][m.name];
        if (!cellContainer) continue;
        
        if (pivotDefs.length > 0) {
          for (const pKey of Object.keys(cellContainer)) {
            const cell = cellContainer[pKey];
            if (cell && cell.rendered && cell.rendered.includes('%')) {
              isPercent = true;
              if (cell.value !== 0 && Math.abs(cell.value) <= 1 && !cell.rendered.includes(String(cell.value))) {
                needsScaling = true;
              }
              break;
            }
          }
        } else {
          const cell = cellContainer;
          if (cell && cell.rendered && cell.rendered.includes('%')) {
            isPercent = true;
            if (cell.value !== 0 && Math.abs(cell.value) <= 1 && !cell.rendered.includes(String(cell.value))) {
              needsScaling = true;
            }
          }
        }
        if (isPercent) break;
      }
      measureSpecs[m.name] = { isPercent, needsScaling };
    });

    // Utility to transform hex values securely to smooth transparent rgba backgrounds for the area setting
    function hexToRgba(hex, alpha) {
      let c;
      if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length === 3){
          c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
      }
      return hex;
    }

    // =====================================================
    // MULTI-MEASURE AGGREGATION ENGINE
    // =====================================================
    const processAndRender = () => {
      const aggregations = {};

      data.forEach(row => {
        const rawDateStr = row[dateDimName]?.value;
        if (!rawDateStr) return;

        const dateObj = new Date(rawDateStr);
        if (isNaN(dateObj.getTime())) return; 

        let key = rawDateStr;
        if (this.currentGrain === "week") {
          const day = dateObj.getDay();
          const diff = dateObj.getDate() - (day === 0 ? 6 : day - 1);
          const weekStart = new Date(dateObj.setDate(diff));
          key = weekStart.toISOString().split("T")[0];
        } else if (this.currentGrain === "month") {
          key = rawDateStr.substring(0, 7); 
        }

        if (!aggregations[key]) {
          aggregations[key] = {};
          Object.keys(seriesMap).forEach(sId => {
            aggregations[key][sId] = { sum: 0, count: 0 };
          });
        }

        Object.keys(seriesMap).forEach(sId => {
          const spec = seriesMap[sId];
          const cellContainer = row[spec.measureName];
          if (!cellContainer) return;

          let val = 0;
          let validVal = false;

          if (spec.pivotKey) {
            if (cellContainer[spec.pivotKey] && cellContainer[spec.pivotKey].value !== null) {
              val = cellContainer[spec.pivotKey].value;
              validVal = true;
            }
          } else {
            if (cellContainer.value !== null) {
              val = cellContainer.value;
              validVal = true;
            }
          }

          if (validVal) {
            aggregations[key][sId].sum += val;
            aggregations[key][sId].count++;
          }
        });
      });

      const sortedKeys = Object.keys(aggregations).sort();

      const labels = sortedKeys.map(key => {
        if (this.currentGrain === "month") {
          const parts = key.split("-");
          const date = new Date(parts[0], parts[1] - 1, 1);
          return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        } else {
          const date = new Date(key);
          return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
      });

      // Map out individual custom dataset parameters
      const datasets = Object.keys(seriesMap).map((sId, idx) => {
        const spec = seriesMap[sId];
        const mSpec = measureSpecs[spec.measureName];

        const dataPoints = sortedKeys.map(key => {
          const agg = aggregations[key][sId];
          if (mSpec.isPercent) {
            const avg = agg.count > 0 ? (agg.sum / agg.count) : 0;
            return mSpec.needsScaling ? avg * 100 : avg;
          }
          return agg.count > 0 ? agg.sum : null; 
        });

        const chosenColor = config[`color_${sId}`] || defaultPalette[idx % defaultPalette.length];
        const lineStyle = config[`linestyle_${sId}`] || "solid";
        const showArea = config[`area_${sId}`] || false;
        const pointStyleOpt = config.global_point_style || "none";

        let pointRadius = 0;
        let pointBg = chosenColor;
        
        if (pointStyleOpt === "filled") {
          pointRadius = 4;
        } else if (pointStyleOpt === "outline") {
          pointRadius = 4;
          pointBg = "#ffffff";
        }

        return {
          label: config[`label_${sId}`] || spec.label,
          data: dataPoints,
          borderColor: chosenColor,
          backgroundColor: showArea ? hexToRgba(chosenColor, 0.15) : "transparent",
          fill: showArea,
          borderWidth: 2.5,
          borderDash: lineStyle === "dashed" ? [6, 4] : [],
          pointRadius: pointRadius,
          pointHoverRadius: 6,
          pointBackgroundColor: pointBg,
          pointBorderColor: chosenColor,
          pointBorderWidth: pointStyleOpt === "outline" ? 2 : 1,
          tension: 0.15,
          isPercent: mSpec.isPercent
        };
      });

      // Check if general formatting trends require a percent localized axis setup
      const primaryIsPercent = datasets.length > 0 ? datasets[0].isPercent : false;

      // Formatting axis and tooltip logic dynamically
      const yAxisCallback = function(value) {
        return primaryIsPercent ? value.toFixed(1) + '%' : value.toLocaleString();
      };

      const tooltipCallback = function(context) {
        let label = context.dataset.label || '';
        if (label) label += ': ';
        if (context.parsed.y !== null) {
          label += context.dataset.isPercent ? context.parsed.y.toFixed(1) + '%' : context.parsed.y.toLocaleString();
        }
        return label;
      };

      // Inline Canvas Engine Plugin to render value labels perfectly without external plugin CDNs
      const valueLabelsPlugin = {
        id: "valueLabelsPlugin",
        afterDatasetsDraw: (chart) => {
          if (!config.global_value_labels) return;
          const ctx = chart.ctx;
          
          chart.data.datasets.forEach((dataset, datasetIdx) => {
            const meta = chart.getDatasetMeta(datasetIdx);
            if (meta.hidden) return;

            meta.data.forEach((element, index) => {
              const val = dataset.data[index];
              if (val === null || val === undefined) return;

              const formatted = dataset.isPercent ? val.toFixed(1) + '%' : val.toLocaleString();
              ctx.fillStyle = "#4b5563";
              ctx.font = "600 10px Roboto, Arial, sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "bottom";
              
              // Shift above points neatly
              ctx.fillText(formatted, element.x, element.y - 7);
            });
          });
        }
      };

      // =====================================================
      // INSTANTIATION OR UPDATE ENGINE
      // =====================================================
      const ctx = element.querySelector("#popLineChart").getContext("2d");
      let animationMode = undefined; 
      
      if (details && details.changed && !details.changed.data && !this.isFrontendToggleAction) {
        animationMode = 'none';
      }
      this.isFrontendToggleAction = false;

      if (this.chartInstance) {
        this.chartInstance.data.labels = labels;
        this.chartInstance.data.datasets = datasets;
        this.chartInstance.options.scales.y.ticks.callback = yAxisCallback;
        this.chartInstance.options.plugins.tooltip.callbacks.label = tooltipCallback;
        this.chartInstance.update(animationMode);
      } else {
        this.chartInstance = new Chart(ctx, {
          type: "line",
          data: {
            labels: labels,
            datasets: datasets
          },
          plugins: [valueLabelsPlugin],
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: "bottom",
                labels: {
                  boxWidth: 24,
                  usePointStyle: true,    
                  pointStyle: 'line',     
                  font: { size: 12, weight: "500" },
                  color: "#4b5563"
                }
              },
              tooltip: {
                mode: "index",
                intersect: false,
                callbacks: {
                  label: tooltipCallback
                }
              }
            },
            scales: {
              x: {
                grid: { display: false }, 
                ticks: {
                  color: "#6b7280",
                  font: { size: 11 }
                }
              },
              y: {
                grid: { display: false }, 
                ticks: {
                  color: "#6b7280",
                  font: { size: 11 },
                  callback: yAxisCallback
                }
              }
            }
          }
        });
      }
    };

    processAndRender();
    done();
  }
});
