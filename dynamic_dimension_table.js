looker.plugins.visualizations.add({
  id: "dynamic_tree_aggregation_table",
  label: "Dynamic Tree Aggregation Table",
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
      default: "#003366",
      display: "color",
      section: "Style"
    },
    header_text_color: {
      type: "string",
      label: "Header Text Color",
      default: "#ffffff",
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
          gap: 16px;
          background: #f8f9fa;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
          flex-shrink: 0;
          flex-wrap: wrap;
        }
        .control-group {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #333;
        }
        .control-group select {
          padding: 4px 8px;
          font-size: 12px;
          border-radius: 4px;
          border: 1px solid #ccc;
          background: #fff;
          cursor: pointer;
        }
        .table-wrapper {
          flex: 1;
          overflow: auto;
          border: 1px solid #d0d7de;
          border-radius: 4px;
        }
        .custom-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .custom-table th {
          text-align: left;
          padding: 8px 12px;
          font-weight: 600;
          border: 1px solid #c8d1dc;
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .custom-table td {
          padding: 6px 12px;
          border: 1px solid #e1e4e8;
          color: #212529;
        }
        .custom-table tr:nth-child(even) {
          background-color: #f6f8fa;
        }
        .custom-table tr:hover {
          background-color: #eaf2ff;
        }
        .text-right {
          text-align: right;
        }
        .tree-node-cell {
          display: flex;
          align-items: center;
          cursor: pointer;
          user-select: none;
        }
        .toggle-icon {
          display: inline-block;
          width: 16px;
          font-size: 10px;
          color: #333;
          font-weight: bold;
          margin-right: 4px;
        }
        .node-label {
          flex-grow: 1;
        }
        .child-count {
          color: #333;
          margin-left: 6px;
          font-weight: normal;
        }
        .totals-row td {
          font-weight: bold;
          background-color: #ffffff;
          border-top: 2px solid #a0a0a0;
        }

        /* Pill Badge Styling for Table Header Breadcrumb */
        .hdr-breadcrumb-container {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }
        .hdr-pill {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          background: rgba(255, 255, 255, 0.18);
          color: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.25);
          white-space: nowrap;
          letter-spacing: 0.2px;
        }
        .hdr-pill.current-active {
          background: #ffffff;
          color: #003366;
          font-weight: 700;
          border-color: #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }
        .hdr-arrow {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          user-select: none;
          font-weight: bold;
        }
      </style>
      <div class="custom-vis-container">
        <div id="row-limit-warning" class="limit-warning"></div>
        <div class="controls-bar" id="controls-bar"></div>
        <div class="table-wrapper">
          <table class="custom-table">
            <thead id="table-head"></thead>
            <tbody id="table-body"></tbody>
            <tfoot id="table-foot"></tfoot>
          </table>
        </div>
      </div>
    `;

    this._expandedKeys = new Set();
    this._selectedDims = [null, null, null];
    this._selectedMeasures = [null];
    this._requestedLimit = false;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.clearErrors();

    if (queryResponse && queryResponse.row_limit < 50000 && !this._requestedLimit) {
      this._requestedLimit = true;
      this.trigger('limit', [50000]);
      return;
    }

    const warningEl = element.querySelector('#row-limit-warning');
    if (queryResponse && queryResponse.has_reached_row_limit) {
      warningEl.style.display = 'block';
      warningEl.innerText = `⚠️ Row limit reached (${(queryResponse.row_limit || 50000).toLocaleString()} rows). Data aggregated from returned rows.`;
    } else {
      warningEl.style.display = 'none';
    }

    const dimFields = queryResponse.fields.dimension_like || [];
    const measureFields = queryResponse.fields.measure_like || [];

    if (dimFields.length === 0 || measureFields.length === 0) {
      this.addError({
        title: "Missing Fields",
        message: "Requires at least 1 dimension and 1 measure."
      });
      done();
      return;
    }

    if (!this._selectedDims[0] || !dimFields.some(d => d.name === this._selectedDims[0])) {
      this._selectedDims[0] = dimFields[0] ? dimFields[0].name : null;
      this._selectedDims[1] = dimFields[1] ? dimFields[1].name : "none";
      this._selectedDims[2] = dimFields[2] ? dimFields[2].name : "none";
    }

    if (!this._selectedMeasures[0] || !measureFields.some(m => m.name === this._selectedMeasures[0])) {
      this._selectedMeasures[0] = measureFields[0] ? measureFields[0].name : null;
      this._selectedMeasures[1] = measureFields[1] ? measureFields[1].name : "none";
      this._selectedMeasures[2] = measureFields[2] ? measureFields[2].name : "none";
    }

    this.renderControls(dimFields, measureFields, data, config, element);
    this.processAndRenderData(data, dimFields, measureFields, config, element);

    done();
  },

  renderControls: function(dimFields, measureFields, data, config, element) {
    const controlsContainer = element.querySelector('#controls-bar');
    controlsContainer.innerHTML = '';

    const createSelect = (label, optionsList, currentValue, onChange, allowNone = false) => {
      const group = document.createElement('div');
      group.className = 'control-group';

      const lbl = document.createElement('label');
      lbl.innerText = label;
      group.appendChild(lbl);

      const select = document.createElement('select');

      if (allowNone) {
        const optNone = document.createElement('option');
        optNone.value = 'none';
        optNone.innerText = '-- None --';
        select.appendChild(optNone);
      }

      optionsList.forEach(field => {
        const opt = document.createElement('option');
        opt.value = field.name;
        opt.innerText = field.label_short || field.label;
        select.appendChild(opt);
      });

      select.value = currentValue || (allowNone ? 'none' : optionsList[0]?.name);
      select.addEventListener('change', (e) => onChange(e.target.value));

      group.appendChild(select);
      return group;
    };

    controlsContainer.appendChild(createSelect("Dim 1:", dimFields, this._selectedDims[0], (val) => {
      this._selectedDims[0] = val;
      this.processAndRenderData(data, dimFields, measureFields, config, element);
    }, false));

    controlsContainer.appendChild(createSelect("Dim 2:", dimFields, this._selectedDims[1], (val) => {
      this._selectedDims[1] = val;
      this.processAndRenderData(data, dimFields, measureFields, config, element);
    }, true));

    controlsContainer.appendChild(createSelect("Dim 3:", dimFields, this._selectedDims[2], (val) => {
      this._selectedDims[2] = val;
      this.processAndRenderData(data, dimFields, measureFields, config, element);
    }, true));

    const sep = document.createElement('span');
    sep.style.color = '#ccc';
    sep.innerText = '|';
    controlsContainer.appendChild(sep);

    controlsContainer.appendChild(createSelect("Measure 1:", measureFields, this._selectedMeasures[0], (val) => {
      this._selectedMeasures[0] = val;
      this.processAndRenderData(data, dimFields, measureFields, config, element);
    }, false));

    controlsContainer.appendChild(createSelect("Measure 2:", measureFields, this._selectedMeasures[1], (val) => {
      this._selectedMeasures[1] = val;
      this.processAndRenderData(data, dimFields, measureFields, config, element);
    }, true));

    controlsContainer.appendChild(createSelect("Measure 3:", measureFields, this._selectedMeasures[2], (val) => {
      this._selectedMeasures[2] = val;
      this.processAndRenderData(data, dimFields, measureFields, config, element);
    }, true));
  },

  processAndRenderData: function(data, dimFields, measureFields, config, element) {
    const activeDims = this._selectedDims
      .filter(d => d && d !== 'none')
      .map(id => dimFields.find(f => f.name === id))
      .filter(Boolean);

    const activeMeasures = this._selectedMeasures
      .filter(m => m && m !== 'none')
      .map(id => measureFields.find(f => f.name === id))
      .filter(Boolean);

    const rootNodes = new Map();
    const grandTotals = new Array(activeMeasures.length).fill(0);

    data.forEach(row => {
      let currentMap = rootNodes;
      let currentPath = "";

      const rowMeasures = activeMeasures.map(m => {
        const val = row[m.name] ? Number(row[m.name].value) : 0;
        return isNaN(val) ? 0 : val;
      });

      rowMeasures.forEach((val, idx) => { grandTotals[idx] += val; });

      activeDims.forEach((dimField, level) => {
        const cell = row[dimField.name];
        const rawVal = (cell && cell.value !== null && cell.value !== undefined && cell.value !== "")
          ? String(cell.value)
          : "∅";

        currentPath = currentPath ? `${currentPath}|||${rawVal}` : rawVal;

        if (!currentMap.has(rawVal)) {
          currentMap.set(rawVal, {
            key: rawVal,
            path: currentPath,
            level: level,
            children: new Map(),
            totals: new Array(activeMeasures.length).fill(0)
          });
        }

        const node = currentMap.get(rawVal);
        rowMeasures.forEach((val, idx) => { node.totals[idx] += val; });

        currentMap = node.children;
      });
    });

    this.renderTableTree(rootNodes, grandTotals, activeDims, activeMeasures, config, element, data, dimFields, measureFields);
  },

  renderTableTree: function(rootNodes, grandTotals, activeDims, activeMeasures, config, element, data, dimFields, measureFields) {
    const fontSize = config.font_size || 13;
    const headerBg = config.header_bg_color || "#003366";
    const headerText = config.header_text_color || "#ffffff";

    const bodyEl = element.querySelector('#table-body');
    bodyEl.innerHTML = '';

    let maxRenderedLevel = 0;

    const renderNodeList = (nodesMap) => {
      const sortedNodes = Array.from(nodesMap.values()).sort((a, b) =>
        a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' })
      );

      sortedNodes.forEach(node => {
        if (node.level > maxRenderedLevel) {
          maxRenderedLevel = node.level;
        }

        const hasChildren = node.children.size > 0;
        const isExpanded = this._expandedKeys.has(node.path);
        const indentPx = node.level * 24 + 12;

        const tr = document.createElement('tr');
        tr.style.fontSize = `${fontSize}px`;

        const groupTd = document.createElement('td');
        const flexDiv = document.createElement('div');
        flexDiv.className = 'tree-node-cell';
        flexDiv.style.paddingLeft = `${indentPx}px`;

        const toggleSpan = document.createElement('span');
        toggleSpan.className = 'toggle-icon';
        toggleSpan.innerText = hasChildren ? (isExpanded ? '▼' : '▶') : '';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'node-label';
        labelSpan.innerText = node.key;

        flexDiv.appendChild(toggleSpan);
        flexDiv.appendChild(labelSpan);

        if (hasChildren) {
          const countSpan = document.createElement('span');
          countSpan.className = 'child-count';
          countSpan.innerText = `(${node.children.size})`;
          flexDiv.appendChild(countSpan);

          flexDiv.addEventListener('click', () => {
            if (this._expandedKeys.has(node.path)) {
              this._expandedKeys.delete(node.path);
            } else {
              this._expandedKeys.add(node.path);
            }
            this.processAndRenderData(data, dimFields, measureFields, config, element);
          });
        }

        groupTd.appendChild(flexDiv);
        tr.appendChild(groupTd);

        node.totals.forEach(tot => {
          const mTd = document.createElement('td');
          mTd.className = 'text-right';
          mTd.innerText = tot.toLocaleString();
          tr.appendChild(mTd);
        });

        bodyEl.appendChild(tr);

        if (hasChildren && isExpanded) {
          renderNodeList(node.children);
        }
      });
    };

    renderNodeList(rootNodes);

    // Build Pill Badge Header HTML
    const visibleDims = activeDims.slice(0, maxRenderedLevel + 1);
    let groupHeaderHtml = '';

    if (visibleDims.length > 0) {
      groupHeaderHtml = '<div class="hdr-breadcrumb-container">';
      visibleDims.forEach((d, idx) => {
        const isLatest = idx === visibleDims.length - 1;
        const labelText = d.label_short || d.label;
        const pillClass = isLatest ? 'hdr-pill current-active' : 'hdr-pill';
        
        groupHeaderHtml += `<span class="${pillClass}">${labelText}</span>`;
        if (!isLatest) {
          groupHeaderHtml += `<span class="hdr-arrow">›</span>`;
        }
      });
      groupHeaderHtml += '</div>';
    } else {
      groupHeaderHtml = 'Group';
    }

    // 1. Render Table Header
    const headEl = element.querySelector('#table-head');
    let headHtml = `<tr style="font-size: ${fontSize}px;">`;
    headHtml += `<th style="background-color: ${headerBg}; color: ${headerText};">${groupHeaderHtml}</th>`;

    activeMeasures.forEach(m => {
      headHtml += `<th class="text-right" style="background-color: ${headerBg}; color: ${headerText};">${m.label_short || m.label}</th>`;
    });
    headHtml += `</tr>`;
    headEl.innerHTML = headHtml;

    // 2. Render Totals Footer
    const footEl = element.querySelector('#table-foot');
    let footHtml = `<tr class="totals-row" style="font-size: ${fontSize}px;">`;
    footHtml += `<td>Totals</td>`;

    grandTotals.forEach(tot => {
      footHtml += `<td class="text-right">${tot.toLocaleString()}</td>`;
    });
    footHtml += `</tr>`;
    footEl.innerHTML = footHtml;
  }
});
