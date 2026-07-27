looker.plugins.visualizations.add({
  id: "dual_condition_weekly_heatmap",
  label: "Dual-Condition Weekly Heatmap",

  options: {
    lowColor: { type: "string", label: "Low Activity Color", default: "#FFF2E6", display: "color" },
    highColor: { type: "string", label: "High Activity Color", default: "#9E3D0C", display: "color" },
    broadcastBorderColor: { type: "string", label: "Broadcast Border Color", default: "#3A1F0D", display: "color" },
    gapBorderColor: { type: "string", label: "Gap Border Color", default: "#00D2F1", display: "color" }
  },

  create: function(element, config) {
    // FIX: Force explicit container heights to prevent 0px layout collapse bugs
    element.style.height = "100%";
    element.style.minHeight = "550px";
    element.style.display = "flex";
    element.style.flexDirection = "column";

    element.innerHTML = `
      <style>
        .heatmap-container {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          padding: 20px;
          color: #333;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          width: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        .heatmap-header { margin-bottom: 15px; }
        .heatmap-title { font-size: 16px; font-weight: bold; margin: 0 0 4px 0; }
        .heatmap-subtitle { font-size: 12px; color: #888; margin: 0; }
        .heatmap-grid-wrapper {
          display: grid;
          grid-template-columns: 60px repeat(24, 1fr);
          grid-gap: 4px;
          align-items: center;
          width: 100%;
        }
        .grid-label { font-size: 11px; color: #666; text-align: center; }
        .row-label { font-size: 12px; color: #444; font-weight: 500; text-align: left; padding-right: 8px; }
        .heatmap-cell {
          aspect-ratio: 1.6 / 1;
          border-radius: 4px;
          box-sizing: border-box;
          transition: transform 0.1s ease;
          border: 2px solid transparent; 
        }
        .heatmap-cell:hover { transform: scale(1.1); z-index: 10; cursor: pointer; }
        .heatmap-legend { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 20px; font-size: 12px; color: #666; align-items: center; }
        .legend-item { display: flex; align-items: center; gap: 6px; }
        .legend-box { width: 16px; height: 16px; border-radius: 3px; }
        .gradient-bar { width: 100px; height: 12px; border-radius: 3px; margin: 0 6px; }
      </style>
      <div id="heatmap-vis" class="heatmap-container"></div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    try {
      const container = document.getElementById("heatmap-vis");
      if (!container) return done();
      container.innerHTML = ""; 

      // 1. Clear and validate configuration guardrails
      if (!queryResponse || !queryResponse.fields || !queryResponse.fields.dimensions || queryResponse.fields.dimensions.length < 2) {
        this.addError({
          title: "Configuration Error",
          message: "This chart requires exactly 2 Dimensions (Day of Week, Hour of Day) and at least 1 Measure."
        });
        return done();
      }

      // Extract field internal mapping identities securely
      const dimDay = queryResponse.fields.dimensions[0].name;
      const dimHour = queryResponse.fields.dimensions[1].name;
      const measActivity = queryResponse.fields.measures[0] ? queryResponse.fields.measures[0].name : null;
      const measBroadcast = queryResponse.fields.measures[1] ? queryResponse.fields.measures[1].name : null;
      const measGap = queryResponse.fields.measures[2] ? queryResponse.fields.measures[2].name : null;

      if (!measActivity) {
        this.addError({ title: "Missing Measure", message: "Please include at least one measure for activity tracking color mapping." });
        return done();
      }

      const daysArr = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const hoursArr = Array.from({ length: 24 }, (_, i) => i);
      
      const lowHex = config.lowColor || "#FFF2E6";
      const highHex = config.highColor || "#9E3D0C";
      const broadcastBorder = config.broadcastBorderColor || "#3A1F0D";
      const gapBorder = config.gapBorderColor || "#00D2F1";

      // Color interpolation engine with boundary clamping safeguards
      function interpolateColor(color1, color2, factor) {
        let f = Math.max(0, Math.min(1, factor || 0));
        let c1 = parseInt(color1.slice(1), 16), c2 = parseInt(color2.slice(1), 16);
        let r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
        let r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
        let r = Math.round(r1 + f * (r2 - r1)), g = Math.round(g1 + f * (g2 - g1)), b = Math.round(b1 + f * (b2 - b1));
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
      }

      function cleanDayStr(val) {
        if (!val) return "Mon";
        const s = val.toString().toLowerCase();
        if (s.includes("mon")) return "Mon";
        if (s.includes("tue")) return "Tue";
        if (s.includes("wed")) return "Wed";
        if (s.includes("thu")) return "Thu";
        if (s.includes("fri")) return "Fri";
        if (s.includes("sat")) return "Sat";
        if (s.includes("sun")) return "Sun";
        return "Mon";
      }

      // 2. Defensive Data Parsing Loop
      let maxActivity = 0;
      let dataMap = {};

      if (data && data.length > 0) {
        data.forEach(row => {
          // Use optional chaining (?.) to avoid silent object definition property crashes
          let dayVal = row[dimDay]?.value;
          let hourVal = row[dimHour]?.value;
          
          let d = cleanDayStr(dayVal);
          let h = parseInt(hourVal, 10);
          if (isNaN(h)) h = 0;

          let actVal = measActivity && row[measActivity] ? parseFloat(row[measActivity].value) || 0 : 0;
          let bcastVal = measBroadcast && row[measBroadcast] ? parseFloat(row[measBroadcast].value) || 0 : 0;
          let gapVal = measGap && row[measGap] ? parseFloat(row[measGap].value) || 0 : 0;

          if (actVal > maxActivity) maxActivity = actVal;

          if (!dataMap[d]) dataMap[d] = {};
          dataMap[d][h] = { activity: actVal, broadcast: bcastVal, gap: gapVal };
        });
      }

      if (maxActivity === 0) maxActivity = 1;

      // 3. Render Header Layout Text Elements
      const titleBlock = document.createElement("div");
      titleBlock.className = "heatmap-header";
      titleBlock.innerHTML = `
        <h3 class="heatmap-title">When Your Tippers Are Active vs. When You Broadcast Most</h3>
        <p class="heatmap-subtitle">Orange gradient shows your tipper activity. Dark borders mark your broadcast hours. Cyan borders highlight your largest scheduling opportunities.</p>
      `;
      container.appendChild(titleBlock);

      // 4. Build Matrix Layout Structure Grid
      const gridWrapper = document.createElement("div");
      gridWrapper.className = "heatmap-grid-wrapper";

      // Render X-Axis hour header milestones
      gridWrapper.appendChild(document.createElement("div")); 
      hoursArr.forEach(h => {
        const hLabel = document.createElement("div");
        hLabel.className = "grid-label";
        hLabel.innerText = (h % 3 === 0) ? h : "";
        gridWrapper.appendChild(hLabel);
      });

      // Render Y-Axis weekly scheduling rows
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

          // Apply Border Priorities safely based on flag logic counts
          if (cellData.gap > 0) {
            cell.style.borderColor = gapBorder;
            cell.style.borderWidth = "3px";
          } else if (cellData.broadcast > 0) {
            cell.style.borderColor = broadcastBorder;
            cell.style.borderWidth = "3px";
          }

          cell.title = `${day} at ${hour}:00\nActivity: ${cellData.activity}\nBroadcast Flag: ${cellData.broadcast}\nGap Flag: ${cellData.gap}`;
          gridWrapper.appendChild(cell);
        });
      });

      container.appendChild(gridWrapper);

      // 5. Append Legend Summary Blocks
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

    } catch (error) {
      // Intercept any runtime parsing crashes and force visibility so you can see what broke
      this.addError({
        title: "Runtime Engine Error",
        message: error.message + " Ensure columns match order: Day, Hour, Activity, Broadcast, Gap."
      });
    }
    
    // Always signals completion back to Looker container framework
    done();
  }
});
