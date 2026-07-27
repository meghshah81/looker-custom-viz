looker.plugins.visualizations.add({
  // 1. Unique Registration Identifiers (Crucial for CDN/Git setups)
  id: "dual_condition_weekly_heatmap",
  label: "Dual-Condition Weekly Heatmap",

  // 2. Define configuration options for the Looker UI panel
  options: {
    lowColor: {
      type: "string",
      label: "Low Activity Color",
      default: "#FFF2E6",
      display: "color"
    },
    highColor: {
      type: "string",
      label: "High Activity Color",
      default: "#9E3D0C",
      display: "color"
    },
    broadcastBorderColor: {
      type: "string",
      label: "Broadcast Border Color",
      default: "#3A1F0D",
      display: "color"
    },
    gapBorderColor: {
      type: "string",
      label: "Gap Border Color",
      default: "#00D2F1",
      display: "color"
    }
  },

  // 3. Set up the initial state of the visualization canvas
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .heatmap-container {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          padding: 20px;
          color: #333;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        .heatmap-header {
          margin-bottom: 15px;
        }
        .heatmap-title {
          font-size: 16px;
          font-weight: bold;
          margin: 0 0 4px 0;
        }
        .heatmap-subtitle {
          font-size: 12px;
          color: #888;
          margin: 0;
        }
        .heatmap-grid-wrapper {
          display: grid;
          grid-template-columns: 50px repeat(24, 1fr);
          grid-gap: 4px;
          align-items: center;
        }
        .grid-label {
          font-size: 11px;
          color: #666;
          text-align: center;
        }
        .row-label {
          font-size: 12px;
          color: #444;
          font-weight: 500;
          text-align: left;
          padding-right: 8px;
        }
        .heatmap-cell {
          aspect-ratio: 1.6 / 1;
          border-radius: 4px;
          box-sizing: border-box;
          transition: transform 0.1s ease;
          border: 2px solid transparent; 
        }
        .heatmap-cell:hover {
          transform: scale(1.1);
          z-index: 10;
          cursor: pointer;
        }
        /* Custom Legends */
        .heatmap-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin-top: 20px;
          font-size: 12px;
          color: #666;
          align-items: center;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .legend-box {
          width: 16px;
          height: 16px;
          border-radius: 3px;
        }
        .gradient-bar {
          width: 100px;
          height: 12px;
          border-radius: 3px;
          margin: 0 6px;
        }
      </style>
      <div id="heatmap-vis" class="heatmap-container"></div>
    `;
  },

  // 4. Render logic called whenever data or configurations change
  updateAsync: function(data, element, config, queryResponse, details, done) {
    const container = document.getElementById("heatmap-vis");
    container.innerHTML = ""; // Clear out previous renders

    // Guard rails validation
    if (!queryResponse || queryResponse.fields.dimensions.length < 2 || queryResponse.fields.measures.length < 1) {
      this.addError({
        title: "Incomplete Configuration",
        message: "This visualization requires exactly 2 Dimensions (Day, Hour) and at least 1 Measure (Activity score). Up to 3 Measures are supported for borders."
      });
      return;
    }

    // Extracting fields mapping
    const dimDay = queryResponse.fields.dimensions[0].name;
    const dimHour = queryResponse.fields.dimensions[1].name;
    const measActivity = queryResponse.fields.measures[0].name;
    const measBroadcast = queryResponse.fields.measures[1] ? queryResponse.fields.measures[1].name : null;
    const measGap = queryResponse.fields.measures[2] ? queryResponse.fields.measures[2].name : null;

    // Constants & Configuration Settings
    const daysArr = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const hoursArr = Array.from({ length: 24 }, (_, i) => i);
    
    const lowHex = config.lowColor || "#FFF2E6";
    const highHex = config.highColor || "#9E3D0C";
    const broadcastBorder = config.broadcastBorderColor || "#3A1F0D";
    const gapBorder = config.gapBorderColor || "#00D2F1";

    // Helper function to dynamically calculate hex gradients
    function interpolateColor(color1, color2, factor) {
      let c1 = parseInt(color1.slice(1), 16),
          c2 = parseInt(color2.slice(1), 16);
      let r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
      let r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
      let r = Math.round(r1 + factor * (r2 - r1)),
          g = Math.round(g1 + factor * (g2 - g1)),
          b = Math.round(b1 + factor * (b2 - b1));
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    // Normalize day strings to match matrix standard keys
    function cleanDayStr(val) {
      if(!val) return "";
      const s = val.toString().toLowerCase();
      if(s.includes("mon")) return "Mon";
      if(s.includes("tue")) return "Tue";
      if(s.includes("wed")) return "Wed";
      if(s.includes("thu")) return "Thu";
      if(s.includes("fri")) return "Fri";
      if(s.includes("sat")) return "Sat";
      if(s.includes("sun")) return "Sun";
      return "Mon";
    }

    // Process data rows into organized grid tracking structures
    let maxActivity = 0;
    let dataMap = {};

    data.forEach(row => {
      let d = cleanDayStr(row[dimDay].value);
      let h = parseInt(row[dimHour].value, 10);
      let actVal = parseFloat(row[measActivity].value) || 0;
      let bcastVal = measBroadcast ? parseFloat(row[measBroadcast].value) || 0 : 0;
      let gapVal = measGap ? parseFloat(row[measGap].value) || 0 : 0;

      if (actVal > maxActivity) maxActivity = actVal;

      if (!dataMap[d]) dataMap[d] = {};
      dataMap[d][h] = { activity: actVal, broadcast: bcastVal, gap: gapVal };
    });

    if(maxActivity === 0) maxActivity = 1;

    // Build Title Blocks Dynamic Interface
    const titleBlock = document.createElement("div");
    titleBlock.className = "heatmap-header";
    titleBlock.innerHTML = `
      <h3 class="heatmap-title">When Your Tippers Are Active vs. When You Broadcast Most</h3>
      <p class="heatmap-subtitle">Orange gradient shows your tipper activity. Dark borders mark your broadcast hours. Cyan borders highlight your largest scheduling opportunities.</p>
    `;
    container.appendChild(titleBlock);

    // Build Dynamic Grid Output Element
    const gridWrapper = document.createElement("div");
    gridWrapper.className = "heatmap-grid-wrapper";

    // Render Hour Header labels (milestones 0, 3, 6, 9, 12, 15, 18, 21)
    gridWrapper.appendChild(document.createElement("div")); 
    hoursArr.forEach(h => {
      const hLabel = document.createElement("div");
      hLabel.className = "grid-label";
      hLabel.innerText = (h % 3 === 0) ? h : "";
      gridWrapper.appendChild(hLabel);
    });

    // Generate structural loop for rendering rows
    daysArr.forEach(day => {
      const rLabel = document.createElement("div");
      rLabel.className = "row-label";
      rLabel.innerText = day;
      gridWrapper.appendChild(rLabel);

      hoursArr.forEach(hour => {
        const cellData = (dataMap[day] && dataMap[day][hour]) ? dataMap[day][hour] : { activity: 0, broadcast: 0, gap: 0 };
        const cell = document.createElement("div");
        cell.className = "heatmap-cell";

        const weight = cellData.activity / maxActivity;
        cell.style.backgroundColor = interpolateColor(lowHex, highHex, weight);

        if (cellData.gap > 0) {
          cell.style.borderColor = gapBorder;
          cell.style.borderWidth = "3px";
        } else if (cellData.broadcast > 0) {
          cell.style.borderColor = broadcastBorder;
          cell.style.borderWidth = "3px";
        }

        cell.title = `${day} at ${hour}:00\nActivity Value: ${cellData.activity}\nBroadcast Score: ${cellData.broadcast}\nGap Priority: ${cellData.gap}`;
        
        gridWrapper.appendChild(cell);
      });
    });

    container.appendChild(gridWrapper);

    // Append dynamic chart keys / Legends
    const legendBlock = document.createElement("div");
    legendBlock.className = "heatmap-legend";
    legendBlock.innerHTML = `
      <div class="legend-item">
        <div class="legend-box" style="border: 3px solid ${broadcastBorder}; background: transparent;"></div>
        <span>Your most broadcasted hours</span>
      </div>
      <div class="legend-item">
        <div class="legend-box" style="border: 3px solid ${gapBorder}; background: transparent;"></div>
        <span>Scheduling opportunity (gap)</span>
      </div>
      <div class="legend-item">
        <span>Low</span>
        <div class="gradient-bar" style="background: linear-gradient(to right, ${lowHex}, ${highHex});"></div>
        <span>High Tipper activity</span>
      </div>
    `;
    container.appendChild(legendBlock);

    // Signals Looker rendering task engine execution finishes
    done();
  }
});
