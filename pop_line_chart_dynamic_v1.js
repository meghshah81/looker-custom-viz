// Load Chart.js dynamically from CDN if it doesn't exist yet
if (!window.Chart) {
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/chart.js";
  document.head.appendChild(script);
}

looker.plugins.visualizations.add({
  id: "pop_line_chart_dynamic_v1",
  label: "POP Line Chart with Dynamic X-Axis",

  options: {
    legend_label_selected: {
      type: "string",
      label: "Selected Period Legend Label",
      default: "Selected Period",
      section: "Style"
    },
    line_color_selected: {
      type: "string",
      label: "Selected Period Line Color",
      default: "#1ad1ff",
      section: "Style"
    },
    legend_label_previous: {
      type: "string",
      label: "Previous Period Legend Label",
      default: "Comparison Period",
      section: "Style"
    },
    line_color_previous: {
      type: "string",
      label: "Previous Period Line Color",
      default: "#0f2d5c",
      section: "Style"
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

    if (dimensions.length < 1 || measures.length < 1 || pivots.length < 1) {
      container.style.display = "none";
      const errorDiv = document.createElement("div");
      errorDiv.className = "error-box";
      errorDiv.innerHTML = "<strong>Requirements Missing:</strong> This visual requires 1 Dimension (Date), 1 Pivot Dimension (Period Profile), and 1 Measure.";
      element.appendChild(errorDiv);
      done();
      return;
    }

    container.style.display = "flex";

    const dateDimName = dimensions[0].name;
    const measureName = measures[0].name;

    if (!window.Chart) {
      setTimeout(() => this.updateAsync(data, element, config, queryResponse, details, done), 100);
      return;
    }

    if (!this.currentGrain) {
      this.currentGrain = "week";
    }

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
    let isPercent = false;
    let needsScaling = false; // True if Looker stores 12.5% as a decimal fraction like 0.125

    if (measures[0].value_format && measures[0].value_format.includes('%')) {
      isPercent = true;
    }

    for (let i = 0; i < data.length; i++) {
      const pivotData = data[i][measureName];
      if (!pivotData) continue;
      
      for (const pKey of Object.keys(pivotData)) {
        const cell = pivotData[pKey];
        if (cell && cell.rendered && cell.rendered.includes('%')) {
          isPercent = true;
          if (cell.value !== 0 && Math.abs(cell.value) <= 1 && !cell.rendered.includes(String(cell.value))) {
            needsScaling = true;
          }
        }
      }
    }

    // =====================================================
    // DYNAMIC DATA PROCESSING ENGINE
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
          aggregations[key] = { 
            selectedSum: 0, selectedCount: 0, 
            previousSum: 0, previousCount: 0 
          };
        }

        const pivotData = row[measureName];
        if (pivotData) {
          Object.keys(pivotData).forEach(pivotKey => {
            const val = pivotData[pivotKey]?.value || 0;
            if (pivotKey.toLowerCase().includes("selected")) {
              aggregations[key].selectedSum += val;
              aggregations[key].selectedCount++;
            } else if (pivotKey.toLowerCase().includes("previous") || pivotKey.toLowerCase().includes("comparison")) {
              aggregations[key].previousSum += val;
              aggregations[key].previousCount++;
            }
          });
        }
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

      // Compute aggregates: Sum for regular counts, Average for rate/percentage calculations
      const selectedData = sortedKeys.map(key => {
        const agg = aggregations[key];
        if (isPercent) {
          const avg = agg.selectedCount > 0 ? (agg.selectedSum / agg.selectedCount) : 0;
          return needsScaling ? avg * 100 : avg;
        }
        return agg.selectedSum;
      });

      const previousData = sortedKeys.map(key => {
        const agg = aggregations[key];
        if (isPercent) {
          const avg = agg.previousCount > 0 ? (agg.previousSum / agg.previousCount) : 0;
          return needsScaling ? avg * 100 : avg;
        }
        return agg.previousSum;
      });

      // =====================================================
      // CHART GENERATION / UPDATE CONFIGURATION
      // =====================================================
      const ctx = element.querySelector("#popLineChart").getContext("2d");
      let animationMode = undefined; 
      
      if (details && details.changed && !details.changed.data && !this.isFrontendToggleAction) {
        animationMode = 'none';
      }
      
      this.isFrontendToggleAction = false;

      // Formatting callbacks to clean up Y-axis labels and popover tooltips
      const yAxisCallback = function(value) {
        return isPercent ? value.toFixed(1) + '%' : value.toLocaleString();
      };

      const tooltipCallback = function(context) {
        let label = context.dataset.label || '';
        if (label) label += ': ';
        if (context.parsed.y !== null) {
          label += isPercent ? context.parsed.y.toFixed(1) + '%' : context.parsed.y.toLocaleString();
        }
        return label;
      };

      if (this.chartInstance) {
        this.chartInstance.data.labels = labels;
        
        this.chartInstance.data.datasets[0].label = config.legend_label_selected || "Selected Period";
        this.chartInstance.data.datasets[0].data = selectedData;
        this.chartInstance.data.datasets[0].borderColor = config.line_color_selected || "#1ad1ff";
        
        this.chartInstance.data.datasets[1].label = config.legend_label_previous || "Comparison Period";
        this.chartInstance.data.datasets[1].data = previousData;
        this.chartInstance.data.datasets[1].borderColor = config.line_color_previous || "#0f2d5c";
        
        // Push dynamic changes into config instances safely
        this.chartInstance.options.scales.y.ticks.callback = yAxisCallback;
        this.chartInstance.options.plugins.tooltip.callbacks.label = tooltipCallback;

        this.chartInstance.update(animationMode);
      } else {
        this.chartInstance = new Chart(ctx, {
          type: "line",
          data: {
            labels: labels,
            datasets: [
              {
                label: config.legend_label_selected || "Selected Period",
                data: selectedData,
                borderColor: config.line_color_selected || "#1ad1ff",
                backgroundColor: "transparent",
                borderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 5,
                tension: 0.15
              },
              {
                label: config.legend_label_previous || "Comparison Period",
                data: previousData,
                borderColor: config.line_color_previous || "#0f2d5c",
                backgroundColor: "transparent",
                borderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 5,
                tension: 0.15
              }
            ]
          },
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
