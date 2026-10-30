looker.plugins.visualizations.add({
  // Unique ID and Label for Looker Visualization menu
  id: "looker_calendar_visual",
  label: "Calendar Measure Grid",
  
  // Custom user configuration options shown in Looker settings pane
  options: {
    header_bg_color: {
      type: "string",
      label: "Header Background Color",
      default: "#1D4461",
      display: "color"
    },
    header_text_color: {
      type: "string",
      label: "Header Text Color",
      default: "#FFFFFF",
      display: "color"
    },
    date_header_bg_color: {
      type: "string",
      label: "Date Header Background Color",
      default: "#9AAAB7",
      display: "color"
    },
    date_header_text_color: {
      type: "string",
      label: "Date Header Text Color",
      default: "#FFFFFF",
      display: "color"
    },
    font_family: {
      type: "string",
      label: "Font Family",
      default: "Arial, Helvetica, sans-serif"
    }
  },

  // Setup the canvas/container inside Looker's iframe
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .looker-calendar-container {
          width: 100%;
          height: 100%;
          overflow: auto;
          box-sizing: border-box;
          padding: 10px;
        }
        .calendar-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #D1D5DB;
        }
        .calendar-table th, .calendar-table td {
          border: 1px solid #D1D5DB;
          text-align: right;
          vertical-align: top;
          font-size: 12px;
          padding: 4px 8px;
        }
        .calendar-table th {
          text-align: center;
          font-weight: bold;
          padding: 8px;
        }
        .week-col-header {
          text-align: left !important;
        }
        .week-label {
          font-weight: bold;
          text-align: left;
          color: #333333;
          vertical-align: middle;
        }
        .measure-labels-cell {
          text-align: left;
          color: #555555;
          font-size: 11px;
          line-height: 1.5;
          border-right: 1px solid #D1D5DB;
        }
        .date-sub-header {
          font-size: 11px;
          font-weight: bold;
          padding: 2px 6px;
          text-align: left;
          margin: -4px -8px 4px -8px;
        }
        .measure-values-container {
          display: flex;
          flex-direction: column;
          line-height: 1.5;
          font-size: 11px;
        }
        .measure-value {
          height: 16.5px;
        }
        .total-cell {
          font-weight: bold;
          vertical-align: bottom;
          background-color: #F9FAFB;
        }
        .total-value {
          height: 16.5px;
          font-weight: bold;
        }
      </style>
      <div id="calendar-viz" class="looker-calendar-container"></div>
    `;
    this._container = element.querySelector('#calendar-viz');
  },

  // Render visual when data, configuration, or size changes
  updateAsync: function(data, element, config, queryResponse, details, done) {
    // Clear previous rendering error warnings if any
    this.clearErrors();

    // 1. Validate that the data matches required schema
    // Needs at least:
    // - One dimension for Date/Week (formatted as YYYY-MM-DD or containing dates)
    // - A list of measures we want to display as rows in each week block
    const dimensions = queryResponse.fields.dimension_like;
    const measures = queryResponse.fields.measure_like;

    if (dimensions.length < 1 || measures.length < 1) {
      this.addError({
        group: "dim-measure",
        title: "Incomplete Fields",
        message: "This visualization requires at least 1 Date/Week Dimension and 1 or more Measures."
      });
      return;
    }

    // Identify Date dimension (assuming first dimension represents the date)
    const dateDimName = dimensions[0].name;

    // Apply configuration colors dynamically
    const headerBg = config.header_bg_color || "#1D4461";
    const headerText = config.header_text_color || "#FFFFFF";
    const dateHeaderBg = config.date_header_bg_color || "#9AAAB7";
    const dateHeaderText = config.date_header_text_color || "#FFFFFF";
    const fontFamily = config.font_family || "Arial, Helvetica, sans-serif";

    this._container.style.fontFamily = fontFamily;

    // 2. Group the data by 'Week of' (Monday-based weeks)
    // To present data properly, we need to map the incoming dates into their respective Mon-Fri calendar cells
    const weeksMap = {};

    data.forEach(row => {
      const dateStr = row[dateDimName].value;
      if (!dateStr) return;

      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return;

      // Extract details
      const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // We only render Monday (1) to Friday (5)
      if (dayOfWeek === 0 || dayOfWeek === 6) return;

      // Determine the "Week Of" (Monday date of that week)
      const diffToMonday = dateObj.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const mondayDate = new Date(dateObj.setDate(diffToMonday));
      const weekKey = mondayDate.toLocaleDateString('en-US'); // E.g. "9/27/2026"

      if (!weeksMap[weekKey]) {
        weeksMap[weekKey] = {
          weekLabel: weekKey,
          days: { 1: null, 2: null, 3: null, 4: null, 5: null } // Mon (1) to Fri (5)
        };
      }

      // Map raw cell values for measures
      const measureValues = {};
      measures.forEach(m => {
        const cell = row[m.name];
        measureValues[m.name] = {
          value: cell.value,
          rendered: cell.rendered !== undefined ? cell.rendered : String(cell.value)
        };
      });

      // Save day-specific data and day number (1-31)
      const actualDayNum = new Date(dateStr).getDate();
      weeksMap[weekKey].days[dayOfWeek] = {
        dayNum: actualDayNum,
        measures: measureValues
      };
    });

    // 3. Render HTML Table Structure
    let html = `
      <table class="calendar-table">
        <thead>
          <tr style="background-color: ${headerBg}; color: ${headerText};">
            <th class="week-col-header" style="width: 12%;">Week Of</th>
            <th style="width: 10%;"></th>
            <th style="width: 14%;">Monday</th>
            <th style="width: 14%;">Tuesday</th>
            <th style="width: 14%;">Wednesday</th>
            <th style="width: 14%;">Thursday</th>
            <th style="width: 14%;">Friday</th>
            <th style="width: 12%;">Total</th>
          </tr>
        </thead>
        <tbody>
    `;

    // Loop through each grouped Week Of row
    Object.keys(weeksMap).forEach(weekKey => {
      const weekData = weeksMap[weekKey];
      
      html += `<tr>`;
      
      // "Week Of" label column
      html += `<td class="week-label">${weekKey}</td>`;

      // Measure List Indicator Column
      html += `<td class="measure-labels-cell">`;
      measures.forEach(m => {
        html += `<div class="measure-value">${m.label_short || m.label || m.name}</div>`;
      });
      html += `</td>`;

      // Keep track of sums/percentages to calculate "Total" correctly on the client side
      const totalsObj = {};
      measures.forEach(m => {
        totalsObj[m.name] = { sum: 0, count: 0, isPercent: false };
      });

      // Render Monday (1) to Friday (5) calendar columns
      for (let dayIdx = 1; dayIdx <= 5; dayIdx++) {
        const dayData = weekData.days[dayIdx];

        if (dayData) {
          html += `<td>`;
          // Date number row (e.g., 27)
          html += `<div class="date-sub-header" style="background-color: ${dateHeaderBg}; color: ${dateHeaderText};">${dayData.dayNum}</div>`;
          
          // Display measure values sequentially
          html += `<div class="measure-values-container">`;
          measures.forEach(m => {
            const mVal = dayData.measures[m.name];
            let displayVal = "";

            if (mVal && mVal.value !== null && mVal.value !== undefined) {
              displayVal = mVal.rendered;

              // Accumulate totals for absolute counts or determine if it is a percentage
              const numVal = parseFloat(mVal.value);
              if (!isNaN(numVal)) {
                totalsObj[m.name].sum += numVal;
                totalsObj[m.name].count += 1;
              }
              
              if (String(displayVal).includes("%")) {
                totalsObj[m.name].isPercent = true;
              }
            }
            html += `<div class="measure-value">${displayVal}</div>`;
          });
          html += `</div>`;
          html += `</td>`;
        } else {
          // Empty day cell
          html += `<td>
            <div class="date-sub-header" style="background-color: ${dateHeaderBg}; opacity: 0.4;">&nbsp;</div>
          </td>`;
        }
      }

      // 4. Calculate and Render Total Column
      html += `<td class="total-cell">`;
      html += `<div class="measure-values-container">`;
      
      // Specific logic to calculate Fill Rate (percentages) dynamically on the fly
      // Note: If you want Fill Rate to be specifically: Appts / Slots, we look for those measure names
      // For general purposes, if it's a %, we default to the average of visible days.
      measures.forEach(m => {
        let finalTotalValue = "";
        const targetTotalObj = totalsObj[m.name];

        if (targetTotalObj.count > 0) {
          if (targetTotalObj.isPercent) {
            // Find Appts and Slots dimensions dynamically if possible to calculate correctly
            const apptsMeasure = measures.find(x => x.name.toLowerCase().includes('appt'));
            const slotsMeasure = measures.find(x => x.name.toLowerCase().includes('slot'));
            
            if (m.name.toLowerCase().includes('fill') && apptsMeasure && slotsMeasure) {
              const totalAppts = totalsObj[apptsMeasure.name] ? totalsObj[apptsMeasure.name].sum : 0;
              const totalSlots = totalsObj[slotsMeasure.name] ? totalsObj[slotsMeasure.name].sum : 0;
              if (totalSlots > 0) {
                finalTotalValue = Math.round((totalAppts / totalSlots) * 100) + "%";
              } else {
                finalTotalValue = "0%";
              }
            } else {
              // Fallback to simple average of the percentages if direct ratio metrics aren't found
              const avgPercent = targetTotalObj.sum / targetTotalObj.count;
              finalTotalValue = Math.round(avgPercent) + "%";
            }
          } else {
            // Absolute summation (e.g. Total Appts, Total Slots, Total Dr Days)
            finalTotalValue = targetTotalObj.sum.toLocaleString();
          }
        }
        html += `<div class="total-value">${finalTotalValue}</div>`;
      });

      html += `</div>`;
      html += `</td>`;

      html += `</tr>`;
    });

    html += `
        </tbody>
      </table>
    `;

    this._container.innerHTML = html;
    done();
  }
});
