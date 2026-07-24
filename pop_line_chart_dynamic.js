// Load Chart.js dynamically from CDN if it doesn't exist yet
if (!window.Chart) {
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/chart.js";
  document.head.appendChild(script);
}

looker.plugins.visualizations.add({
  id: "pop_line_chart_dynamic",
  label: "POP Line Chart with Dynamic X-Axis",

  options: {
    line_color_selected: {
      type: "string",
      label: "Selected Period Line Color",
      default: "#1ad1ff",
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
    
    // Clear old errors if any
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

    // Wait safely for Chart.js CDN asset load instance verification
    if (!window.Chart) {
      setTimeout(() => this.updateAsync(data, element, config, queryResponse, details, done), 100);
      return;
    }

    // Preserve selected state or default to week grain
    if (!this.currentGrain) {
      this.currentGrain = "week";
    }

    // Setup active toggle button states in view UI
    const buttons = element.querySelectorAll(".toggle-btn");
    buttons.forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-grain") === this.currentGrain);
    });

    // Clean up event listeners to avoid duplicates on re-render
    buttons.forEach(btn => {
      const clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
    });

    // Attach active event listeners to new button triggers
    element.querySelectorAll(".toggle-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        this.currentGrain = e.target.getAttribute("data-grain");
        element.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        processAndRender();
      });
    });

    // =====================================================
    // DYNAMIC DATA PROCESSING & AGGREGATION ENGINE
    // =====================================================
    function processAndRender() {
      const aggregations = {};

      data.forEach(row => {
        const rawDateStr = row[dateDimName]?.value;
        if (!rawDateStr) return;

        const dateObj = new Date(rawDateStr);
        if (isNaN(dateObj.getTime())) return; 

        let key = rawDateStr; // Fallback default

        if (this.currentGrain === "week") {
          // Roll back to the start of the week (Sunday code baseline)
          const day = dateObj.getDay();
          const diff = dateObj.getDate() - day;
          const weekStart = new Date(dateObj.setDate(diff));
          key = weekStart.toISOString().split("T")[0];
        } else if (this.currentGrain === "month") {
          // Roll up to Year-Month structure format
          key = rawDateStr.substring(0, 7); 
        }

        if (!aggregations[key]) {
          aggregations[key] = { selected: 0, previous: 0, count: 0 };
        }

        // Target precise Looker pivot keys safely dynamically
        const pivotData = row[measureName];
        if (pivotData) {
          Object.keys(pivotData).forEach(pivotKey => {
            const val = pivotData[pivotKey]?.value || 0;
            if (pivotKey.toLowerCase().includes("selected")) {
              aggregations[key].selected += val;
            } else if (pivotKey.toLowerCase().includes("previous") || pivotKey.toLowerCase().includes("comparison")) {
              aggregations[key].previous += val;
            }
          });
        }
      });

      // Chronological Sorting Array mapping execution
      const sortedKeys = Object.keys(aggregations).sort();

      // Transform target text labels to beautiful human readable shorthand styles
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

      const selectedData = sortedKeys.map(key => aggregations[key].selected);
      const previousData = sortedKeys.map(key => aggregations[key].previous);

      // =====================================================
      // CHART GENERATION / UPDATE CONFIGURATION
      // =====================================================
      const ctx = element.querySelector("#popLineChart").getContext("2d");

      if (this.chartInstance) {
        this.chartInstance.destroy();
      }

      this.chartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Selected Period",
              data: selectedData,
              borderColor: config.line_color_selected || "#1ad1ff",
              backgroundColor: "transparent",
              borderWidth: 2.5,
              pointRadius: 0,
              pointHoverRadius: 5,
              tension: 0.15
            },
            {
              label: "Comparison Period",
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
                boxWidth: 20,
                font: { size: 12, weight: "500" },
                color: "#4b5563"
              }
            },
            tooltip: {
              mode: "index",
              intersect: false
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
              border: { dash: [4, 4] },
              grid: { color: "#e5e7eb" },
              ticks: {
                color: "#6b7280",
                font: { size: 11 },
                callback: function(value) {
                  return value.toLocaleString();
                }
              }
            }
          }
        }
      });
    }

    // Execute first run pass
    processAndRender.call(this);
    done();
  }
});
