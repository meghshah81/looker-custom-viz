looker.plugins.visualizations.add({
  id: "dynamic_dimension_table",
  label: "Dynamic Aggregation Table",
  options: {
    font_size: {
      type: "number",
      label: "Font Size (px)",
      default: 13,
      section: "Style"
    },
    header_bg_color: {
      type: "string",
      label: "Header Background",
      default: "#f1f3f5",
      display: "color",
      section: "Style"
    }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .custom-vis-container {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          padding: 8px;
        }
        .limit-warning {
          display: none;
          background: #fff3cd;
          color: #664d03;
          padding: 6px 12px;
          font-size: 12px;
          border: 1px solid #ffecb5;
          border-radius: 4px;
          margin-bottom: 8px;
          flex-shrink: 0;
        }
        .controls-bar {
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          background: #f8f9fa;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
          flex-shrink: 0;
        }
        .controls-title {
          font-weight: 600;
          font-size: 13px;
          color: #333;
        }
        .dim-select-container {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          cursor: pointer;
          user-select: none;
        }
        .table-wrapper {
          flex: 1;
          overflow: auto;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
        }
        .custom-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .custom-table th {
          background-color: #f1f3f5;
          color: #495057;
          text-align: left;
          padding: 10px 12px;
          font-weight: 600;
          border-bottom: 2px solid #dee2e6;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .custom-table td {
          padding: 8px 12px;
          border-bottom: 1px solid #e9ecef;
          color: #212529;
        }
        .custom-table tr:hover {
          background-color: #f8f9fa;
        }
        .text-right {
          text-align: right;
        }
        .null-val {
          color: #adb5bd;
          font-style: italic;
        }
      </style>
      <div class="custom-vis-container">
        <div id="row-limit-warning" class="limit-warning"></div>
        <div class="controls-bar">
          <span class="controls-title">Dimensions:</span>
          <div class="dim-select-container" id="dim-select-container"></div>
        </div>
        <div class="table-wrapper">
          <table class="custom-table">
            <thead id="table-head"></thead>
            <tbody id="table-body"></tbody>
          </table>
        </div>
      </div>
    `;
    this._selectedDims = null;
    this._requestedLimit = false;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    // Programmatically trigger 50,000 row query limit from Looker backend
    if (queryResponse && queryResponse.row_limit < 50000 && !this._requestedLimit) {
      this._requestedLimit = true;
      this.trigger('limit', [50000]);
      return;
    }

    // Display warning banner if the 50,000 row cap is reached
    const warningEl = element.querySelector('#row-limit-warning');
    if (queryResponse && queryResponse.has_reached_row_limit) {
      warningEl.style.display = 'block';
      warningEl.innerText = `⚠️ Visualization row limit (${(queryResponse.row_limit || 50000).toLocaleString()} rows) reached. Aggregated numbers may be based on partial data.`;
    } else {
      warningEl.style.display = 'none';
    }

    const dimFields = queryResponse.fields.dimension_like || [];
    const measureFields = queryResponse.fields.measure_like || [];

    if (dimFields.length === 0 || measureFields.length === 0) {
      this.addError({
        title: "Missing Fields",
        message: "Requires at least 1 dimension and 1 measure to aggregate."
      });
      done();
      return;
    }

    if (!this._selectedDims || !this._selectedDims.every(id => dimFields.some(d => d.name === id))) {
      this._selectedDims = dimFields.map(d => d.name);
    }

    const container = element.querySelector('#dim-select-container');
    container.innerHTML = '';

    dimFields.forEach(dim => {
      const label = document.createElement('label');
      label.className = 'checkbox-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = dim.name;
      checkbox.checked = this._selectedDims.includes(dim.name);

      checkbox.addEventListener('change', () => {
        const checked = Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
          .map(cb => cb.value);

        if (checked.length === 0) {
          checkbox.checked = true;
          return;
        }

        this._selectedDims = checked;
        this.renderTable(data, dimFields, measureFields, config);
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(dim.label_short || dim.label));
      container.appendChild(label);
    });

    this.renderTable(data, dimFields, measureFields, config);
    done();
  },

  renderTable: function(data, dimFields, measureFields, config) {
    const activeDimFields = dimFields.filter(d => this._selectedDims.includes(d.name));
    const measureField = measureFields[0];
    const fontSize = config.font_size || 13;
    const headerBg = config.header_bg_color || "#f1f3f5";

    const aggregatedMap = new Map();

    data.forEach(row => {
      const keyParts = activeDimFields.map(d => {
        const cell = row[d.name];
        return (cell && cell.value !== null && cell.value !== undefined && cell.value !== "") 
          ? String(cell.value) 
          : "∅";
      });
      const groupKey = keyParts.join("|||");

      const measureVal = row[measureField.name] ? Number(row[measureField.name].value) || 0 : 0;

      if (!aggregatedMap.has(groupKey)) {
        aggregatedMap.set(groupKey, {
          dimValues: keyParts,
          total: measureVal
        });
      } else {
        aggregatedMap.get(groupKey).total += measureVal;
      }
    });

    const aggregatedData = Array.from(aggregatedMap.values()).sort((a, b) => {
      for (let i = 0; i < a.dimValues.length; i++) {
        const valA = a.dimValues[i];
        const valB = b.dimValues[i];

        if (valA !== valB) {
          return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        }
      }
      return 0;
    });

    const headEl = document.getElementById('table-head');
    let headHtml = `<tr style="font-size: ${fontSize}px;">`;
    activeDimFields.forEach(dim => {
      headHtml += `<th style="background-color: ${headerBg};">${dim.label_short || dim.label}</th>`;
    });
    headHtml += `<th class="text-right" style="background-color: ${headerBg};">${measureField.label_short || measureField.label}</th></tr>`;
    headEl.innerHTML = headHtml;

    const bodyEl = document.getElementById('table-body');
    let bodyHtml = '';

    aggregatedData.forEach(item => {
      bodyHtml += `<tr style="font-size: ${fontSize}px;">`;
      item.dimValues.forEach(val => {
        const displayVal = val === "∅" ? '<span class="null-val">∅</span>' : val;
        bodyHtml += `<td>${displayVal}</td>`;
      });
      bodyHtml += `<td class="text-right">${item.total.toLocaleString()}</td>`;
      bodyHtml += '</tr>';
    });

    bodyEl.innerHTML = bodyHtml;
  }
});
