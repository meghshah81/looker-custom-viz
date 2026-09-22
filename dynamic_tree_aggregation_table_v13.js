looker.plugins.visualizations.add({
  id: "dynamic_tree_aggregation_table_v14",
  label: "dynamic_tree_aggregation_table_v14",

  max_limit: 50000,

  options: {
    // --- Style Options ---
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
      section: "Style",
      display: "color"
    },
    header_text_color: {
      type: "string",
      label: "Header Text Color",
      default: "#ffffff",
      section: "Style",
      display: "color"
    },
    pivot_header_bg_color: {
      type: "string",
      label: "Pivot Header Background",
      default: "#d0d7de",
      section: "Style",
      display: "color"
    },
    pivot_header_text_color: {
      type: "string",
      label: "Pivot Header Text Color",
      default: "#1c2d42",
      section: "Style",
      display: "color"
    },

    // --- Custom Label Options ---
    dim1_label: {
      type: "string",
      label: "Dimension 1 Label",
      default: "",
      placeholder: "Default Field Label",
      section: "Labels"
    },
    dim2_label: {
      type: "string",
      label: "Dimension 2 Label",
      default: "",
      placeholder: "Default Field Label",
      section: "Labels"
    },
    dim3_label: {
      type: "string",
      label: "Dimension 3 Label",
      default: "",
      placeholder: "Default Field Label",
      section: "Labels"
    },
    measure1_label: {
      type: "string",
      label: "Measure 1 Label",
      default: "",
      placeholder: "Default Field Label",
      section: "Labels"
    },
    measure2_label: {
      type: "string",
      label: "Measure 2 Label",
      default: "",
      placeholder: "Default Field Label",
      section: "Labels"
    },
    measure3_label: {
      type: "string",
      label: "Measure 3 Label",
      default: "",
      placeholder: "Default Field Label",
      section: "Labels"
    },
    measure4_label: {
      type: "string",
      label: "Measure 4 Label",
      default: "",
      placeholder: "Default Field Label",
      section: "Labels"
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
          flex-direction: column;
          gap: 10px;
          background: #f8f9fa;
          padding: 10px 14px;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
          flex-shrink: 0;
        }
        .controls-row {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .control-group {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }
        .control-group label {
          min-width: 90px;
          white-space: nowrap;
        }
        .control-group select {
          padding: 4px 10px;
          font-size: 13px;
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
          position: relative;
        }
        .custom-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13px;
        }
        .custom-table th {
          text-align: left;
          padding: 8px 12px;
          font-weight: 600;
          border-right: 1px solid #c8d1dc;
          border-bottom: 1px solid #c8d1dc;
          box-sizing: border-box;
          position: sticky;
          z-index: 2;
        }
        .custom-table th.pivot-hdr {
          text-align: center;
          border-right: 1px solid #c8d1dc !important;
        }
        .custom-table th.pivot-border-right,
        .custom-table td.pivot-border-right {
          border-right: 1px solid #c8d1dc !important;
        }
        .custom-table td {
          padding: 6px 12px;
          border-right: 1px solid #e1e4e8;
          border-bottom: 1px solid #e1e4e8;
          color: #212529;
          background: #fff;
          box-sizing: border-box;
        }
        .custom-table tr:nth-child(even) td {
          background-color: #f6f8fa;
        }
        /* Sticky Left Column with Widen Width for Dimensions */
        .custom-table th:first-child,
        .custom-table td:first-child {
          position: sticky;
          left: 0;
          z-index: 6;
          width: 300px !important;
          min-width: 300px !important;
          max-width: 300px !important;
          box-shadow: 2px 0 4px rgba(0,0,0,0.06);
          word-break: break-word;
        }
        .custom-table tr:nth-child(odd) td:first-child {
          background-color: #ffffff;
        }
        .custom-table tr:nth-child(even) td:first-child {
          background-color: #f6f8fa;
        }
        .custom-table tr:hover td {
          background-color: #eaf2ff;
        }
        .custom-table tr:hover td:first-child {
          background-color: #eaf2ff;
        }
        .text-right {
          text-align: right;
        }
        .clickable-drill {
          color: #0056b3 !important;
          cursor: pointer !important;
          text-decoration: underline !important;
          text-decoration-style: dotted !important;
        }
        .clickable-drill:hover {
          color: #003366 !important;
          text-decoration: underline !important;
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
          background-color: #ffffff !important;
          border-top: 2px solid #a0a0a0;
          position: sticky;
          bottom: 0;
          z-index: 7;
        }
        .totals-row td:first-child {
          z-index: 8;
        }
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
    this._selectedMeasures = [null, null, null, null];
    this._requestedLimit = false;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    try {
      this.clearErrors();

      if (queryResponse && queryResponse.row_limit < 50000 && !this._requestedLimit) {
        this._requestedLimit = true;
        this.trigger('query:limit', [50000]);
        this.trigger('query:run');
        return;
      }

      const warningEl = element.querySelector('#row-limit-warning');
      if (queryResponse && queryResponse.has_reached_row_limit) {
        warningEl.style.display = 'block';
        warningEl.innerText = `⚠️ Visualization row limit (${(queryResponse.row_limit || 50000).toLocaleString()} rows) reached. Sub-aggregations are based on retrieved dataset.`;
      } else {
        warningEl.style.display = 'none';
      }

      const dimFields = (queryResponse && queryResponse.fields && queryResponse.fields.dimension_like) || [];
      const measureFields = (queryResponse && queryResponse.fields && queryResponse.fields.measure_like) || [];

      if (dimFields.length === 0 || measureFields.length === 0) {
        this.addError({
          title: "Missing Fields",
          message: "Requires at least 1 dimension and 1 measure."
        });
        done();
        return;
      }

      const maxDimSlots = Math.min(dimFields.length, 3);
      for (let i = 0; i < 3; i++) {
        if (i < maxDimSlots) {
          if (!this._selectedDims[i] || !dimFields.some(d => d.name === this._selectedDims[i])) {
            this._selectedDims[i] = dimFields[i] ? dimFields[i].name : "none";
          }
        } else {
          this._selectedDims[i] = "none";
        }
      }

      const maxMeasureSlots = Math.min(measureFields.length, 4);
      for (let i = 0; i < 4; i++) {
        if (i < maxMeasureSlots) {
          if (!this._selectedMeasures[i] || !measureFields.some(m => m.name === this._selectedMeasures[i])) {
            this._selectedMeasures[i] = measureFields[i] ? measureFields[i].name : "none";
          }
        } else {
          this._selectedMeasures[i] = "none";
        }
      }

      this.renderControls(dimFields, measureFields, data, config, element, queryResponse);
      this.processAndRenderData(data, dimFields, measureFields, config, element, queryResponse);
    } catch (err) {
      console.error("Looker Vis Error:", err);
      this.addError({ title: "Render Error", message: err.message });
    }

    done();
  },

  getResolvedFieldLabel: function(field, allFields, config, fieldType) {
    if (!field) return '';
    const index = allFields.findIndex(f => f.name === field.name);
    if (index !== -1) {
      const configKey = `${fieldType}${index + 1}_label`;
      const customOverride = config[configKey];
      if (customOverride && customOverride.trim() !== '') {
        return customOverride;
      }
    }
    return field.label_short || field.label;
  },

  renderControls: function(dimFields, measureFields, data, config, element, queryResponse) {
    const controlsContainer = element.querySelector('#controls-bar');
    controlsContainer.innerHTML = '';

    const createSelect = (staticLabel, optionsList, currentValue, onChange, allowNone = false, fieldType = 'dim') => {
      const group = document.createElement('div');
      group.className = 'control-group';

      const lbl = document.createElement('label');
      lbl.innerText = staticLabel;
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
        opt.innerText = this.getResolvedFieldLabel(field, optionsList, config, fieldType);
        select.appendChild(opt);
      });

      select.value = currentValue || (allowNone ? 'none' : optionsList[0]?.name);
      select.addEventListener('change', (e) => onChange(e.target.value));

      group.appendChild(select);
      return group;
    };

    // Row 1: Dimensions
    const dimRow = document.createElement('div');
    dimRow.className = 'controls-row';

    const numDimsToRender = Math.min(dimFields.length, 3);
    for (let i = 0; i < numDimsToRender; i++) {
      const label = `Dimension ${i + 1}:`;
      const allowNone = i > 0;
      dimRow.appendChild(createSelect(label, dimFields, this._selectedDims[i], (val) => {
        this._selectedDims[i] = val;
        this.processAndRenderData(data, dimFields, measureFields, config, element, queryResponse);
      }, allowNone, 'dim'));
    }
    controlsContainer.appendChild(dimRow);

    // Row 2: Measures
    const measureRow = document.createElement('div');
    measureRow.className = 'controls-row';

    const numMeasuresToRender = Math.min(measureFields.length, 4);
    for (let i = 0; i < numMeasuresToRender; i++) {
      const label = `Measure ${i + 1}:`;
      const allowNone = i > 0;
      measureRow.appendChild(createSelect(label, measureFields, this._selectedMeasures[i], (val) => {
        this._selectedMeasures[i] = val;
        this.processAndRenderData(data, dimFields, measureFields, config, element, queryResponse);
      }, allowNone, 'measure'));
    }
    controlsContainer.appendChild(measureRow);
  },

  processAndRenderData: function(data, dimFields, measureFields, config, element, queryResponse) {
    const activeDims = this._selectedDims
      .map(id => {
        if (!id || id === 'none') return null;
        const field = dimFields.find(f => f.name === id);
        if (!field) return null;
        return {
          ...field,
          displayLabel: this.getResolvedFieldLabel(field, dimFields, config, 'dim')
        };
      })
      .filter(Boolean);

    const activeMeasures = this._selectedMeasures
      .map(id => {
        if (!id || id === 'none') return null;
        const field = measureFields.find(f => f.name === id);
        if (!field) return null;
        return {
          ...field,
          displayLabel: this.getResolvedFieldLabel(field, measureFields, config, 'measure')
        };
      })
      .filter(Boolean);

    const pivots = (queryResponse && queryResponse.pivots && queryResponse.pivots.length > 0)
      ? queryResponse.pivots
      : [{ key: '$$single$$', data: {} }];
    const hasPivots = queryResponse && queryResponse.pivots && queryResponse.pivots.length > 0;

    const numFields = measureFields.filter(m => {
      const type = (m.type || '').toLowerCase();
      const name = (m.name || '').toLowerCase();
      const label = (m.label || '').toLowerCase();
      return !type.includes('percent') && !name.includes('rate') && !label.includes('rate') && !label.includes('%');
    });

    const numField1 = numFields[0] ? numFields[0].name : null;
    const numField2 = numFields[1] ? numFields[1].name : null;

    const getCell = (row, measureName, pivotKey) => {
      if (!row || !row[measureName]) return null;
      if (hasPivots) {
        return row[measureName][pivotKey] || null;
      }
      return row[measureName];
    };

    const measureMeta = activeMeasures.map(m => {
      const sampleCell = data && data[0] ? getCell(data[0], m.name, pivots[0].key) : null;
      const isPercent = (sampleCell && sampleCell.rendered && sampleCell.rendered.includes('%')) ||
                        (m.value_format && m.value_format.includes('%')) ||
                        (m.type && m.type.includes('percent')) ||
                        (m.label && m.label.toLowerCase().includes('rate'));

      const hasDecimals = (sampleCell && sampleCell.rendered && sampleCell.rendered.includes('.')) ||
                          (m.value_format && m.value_format.includes('.')) ||
                          (m.type && m.type.includes('decimal'));

      return { field: m, isPercent: isPercent, hasDecimals: !!hasDecimals };
    });

    const rootNodes = new Map();
    const sumTotals = Array.from({ length: pivots.length }, () => new Array(activeMeasures.length).fill(0));
    const pivotNum1Totals = new Array(pivots.length).fill(0);
    const pivotNum2Totals = new Array(pivots.length).fill(0);

    (data || []).forEach(row => {
      let currentMap = rootNodes;
      let currentPath = "";

      const pivotRowMeasures = pivots.map(p => {
        const pKey = p.key;
        return {
          pivotKey: pKey,
          measures: activeMeasures.map(m => {
            const cell = getCell(row, m.name, pKey);
            const val = cell ? Number(cell.value) : 0;
            return {
              num: isNaN(val) ? 0 : val,
              rendered: cell ? cell.rendered : null,
              cellData: cell
            };
          }),
          valNum1: numField1 ? Number(getCell(row, numField1, pKey)?.value || 0) : 0,
          valNum2: numField2 ? Number(getCell(row, numField2, pKey)?.value || 0) : 0
        };
      });

      pivotRowMeasures.forEach((pObj, pIdx) => {
        pivotNum1Totals[pIdx] += pObj.valNum1;
        pivotNum2Totals[pIdx] += pObj.valNum2;

        pObj.measures.forEach((mObj, mIdx) => {
          sumTotals[pIdx][mIdx] += mObj.num;
        });
      });

      activeDims.forEach((dimField, level) => {
        const cell = row[dimField.name];
        const rawVal = (cell && cell.value !== null && cell.value !== undefined && cell.value !== "")
          ? String(cell.rendered || cell.value)
          : "∅";

        currentPath = currentPath ? `${currentPath}|||${rawVal}` : rawVal;

        if (!currentMap.has(rawVal)) {
          currentMap.set(rawVal, {
            key: rawVal,
            path: currentPath,
            level: level,
            children: new Map(),
            pivotData: pivots.map(() => ({
              sums: new Array(activeMeasures.length).fill(0),
              counts: new Array(activeMeasures.length).fill(0),
              leafRendered: new Array(activeMeasures.length).fill(null),
              leafCells: new Array(activeMeasures.length).fill(null),
              num1Sum: 0,
              num2Sum: 0
            }))
          });
        }

        const node = currentMap.get(rawVal);

        pivotRowMeasures.forEach((pObj, pIdx) => {
          const pNode = node.pivotData[pIdx];
          pNode.num1Sum += pObj.valNum1;
          pNode.num2Sum += pObj.valNum2;

          pObj.measures.forEach((mObj, mIdx) => {
            pNode.sums[mIdx] += mObj.num;
            pNode.counts[mIdx] += 1;
            if (mObj.rendered !== null && mObj.rendered !== undefined) {
              pNode.leafRendered[mIdx] = mObj.rendered;
            }
            if (mObj.cellData) {
              pNode.leafCells[mIdx] = mObj.cellData;
            }
          });
        });

        currentMap = node.children;
      });
    });

    const grandTotals = pivots.map((p, pIdx) => {
      return activeMeasures.map((m, mIdx) => {
        if (queryResponse && queryResponse.totals_data && queryResponse.totals_data[m.name]) {
          const tCell = hasPivots ? queryResponse.totals_data[m.name][p.key] : queryResponse.totals_data[m.name];
          if (tCell && tCell.rendered !== undefined && tCell.rendered !== null) {
            return tCell.rendered;
          }
          if (tCell && tCell.value !== undefined && tCell.value !== null) {
            const v = Number(tCell.value);
            if (measureMeta[mIdx].isPercent) {
              const pctVal = v <= 1 && v >= -1 ? v * 100 : v;
              return pctVal.toFixed(1) + '%';
            }
            return measureMeta[mIdx].hasDecimals ? v.toLocaleString() : Math.round(v).toLocaleString();
          }
        }

        if (measureMeta[mIdx].isPercent) {
          if (pivotNum2Totals[pIdx] > 0) {
            const overallRatio = (pivotNum1Totals[pIdx] / pivotNum2Totals[pIdx]) * 100;
            return overallRatio.toFixed(1) + '%';
          }
          return "—";
        }

        const totalVal = sumTotals[pIdx][mIdx];
        if (!measureMeta[mIdx].hasDecimals) {
          return Math.round(totalVal).toLocaleString();
        }
        return Number.isInteger(totalVal)
          ? totalVal.toLocaleString()
          : totalVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      });
    });

    this.renderTableTree(rootNodes, grandTotals, activeDims, activeMeasures, measureMeta, config, element, pivots, hasPivots);
  },

  renderTableTree: function(rootNodes, grandTotals, activeDims, activeMeasures, measureMeta, config, element, pivots, hasPivots) {
    const fontSize = config.font_size || 13;
    const headerBg = config.header_bg_color || "#003366";
    const headerText = config.header_text_color || "#ffffff";
    const pivotHeaderBg = config.pivot_header_bg_color || "#d0d7de";
    const pivotHeaderText = config.pivot_header_text_color || "#1c2d42";

    const bodyEl = element.querySelector('#table-body');
    bodyEl.innerHTML = '';

    let maxRenderedLevel = 0;

    const getNodeValueObj = (pNode, idx) => {
      const isPercent = measureMeta[idx].isPercent;
      const hasDecimals = measureMeta[idx].hasDecimals;

      if (pNode.counts[idx] === 1 && pNode.leafRendered[idx] !== null && pNode.leafRendered[idx] !== undefined) {
        return { text: pNode.leafRendered[idx], cell: pNode.leafCells[idx] };
      }

      if (isPercent) {
        if (pNode.num2Sum > 0) {
          const ratio = (pNode.num1Sum / pNode.num2Sum) * 100;
          return { text: ratio.toFixed(1) + '%', cell: null };
        }
        return { text: "—", cell: null };
      } else {
        const aggregatedSum = pNode.sums[idx];
        if (!hasDecimals) {
          return { text: Math.round(aggregatedSum).toLocaleString(), cell: null };
        }
        const formattedSum = Number.isInteger(aggregatedSum)
          ? aggregatedSum.toLocaleString()
          : aggregatedSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        return { text: formattedSum, cell: null };
      }
    };

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
            this.renderTableTree(rootNodes, grandTotals, activeDims, activeMeasures, measureMeta, config, element, pivots, hasPivots);
          });
        }

        groupTd.appendChild(flexDiv);
        tr.appendChild(groupTd);

        pivots.forEach((p, pIdx) => {
          const pNode = node.pivotData[pIdx];

          activeMeasures.forEach((mObj, mIdx) => {
            const mTd = document.createElement('td');
            mTd.className = 'text-right';

            if (mIdx === activeMeasures.length - 1 && hasPivots) {
              mTd.classList.add('pivot-border-right');
            }

            const valObj = getNodeValueObj(pNode, mIdx);
            mTd.innerText = valObj.text;

            const cellData = valObj.cell;
            if (cellData && cellData.links && cellData.links.length > 0) {
              mTd.classList.add('clickable-drill');
              mTd.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const drillContext = {
                  links: cellData.links,
                  field: mObj.field,
                  value: cellData.value,
                  rendered: cellData.rendered,
                  event: e
                };

                if (typeof LookerCharts !== 'undefined' && LookerCharts.Utils && LookerCharts.Utils.openDrillMenu) {
                  LookerCharts.Utils.openDrillMenu(drillContext);
                } else if (typeof LookerVisualizationUtils !== 'undefined' && LookerVisualizationUtils.openDrillMenu) {
                  LookerVisualizationUtils.openDrillMenu(drillContext);
                } else if (typeof LookerVisualizationUtils !== 'undefined' && LookerVisualizationUtils.openUrl) {
                  LookerVisualizationUtils.openUrl(cellData.links[0].url, e);
                }
              });
            }

            tr.appendChild(mTd);
          });
        });

        bodyEl.appendChild(tr);

        if (hasChildren && isExpanded) {
          renderNodeList(node.children);
        }
      });
    };

    renderNodeList(rootNodes);

    const visibleDims = activeDims.slice(0, maxRenderedLevel + 1);
    let groupHeaderHtml = '';

    if (visibleDims.length > 0) {
      groupHeaderHtml = '<div class="hdr-breadcrumb-container">';
      visibleDims.forEach((d, idx) => {
        const isLatest = idx === visibleDims.length - 1;
        const labelText = d.displayLabel;
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

    const headEl = element.querySelector('#table-head');
    let headHtml = '';

    if (hasPivots) {
      headHtml += `<tr style="font-size: ${fontSize}px;">`;
      headHtml += `<th rowspan="2" style="background-color: ${headerBg}; color: ${headerText}; vertical-align: bottom;">${groupHeaderHtml}</th>`;

      pivots.forEach(p => {
        let pivotLabel = (p.data && Object.values(p.data).join(' / ')) || p.key;
        if (pivotLabel.includes('/')) {
          pivotLabel = pivotLabel.split('/')[0].trim();
        }
        headHtml += `<th colspan="${activeMeasures.length}" class="pivot-hdr" style="background-color: ${pivotHeaderBg}; color: ${pivotHeaderText};">${pivotLabel}</th>`;
      });
      headHtml += `</tr>`;

      headHtml += `<tr style="font-size: ${fontSize}px;">`;
      pivots.forEach(() => {
        activeMeasures.forEach((m, mIdx) => {
          const borderClass = (mIdx === activeMeasures.length - 1) ? 'pivot-border-right' : '';
          headHtml += `<th class="text-right ${borderClass}" style="background-color: ${headerBg}; color: ${headerText};">${m.displayLabel}</th>`;
        });
      });
      headHtml += `</tr>`;
    } else {
      headHtml += `<tr style="font-size: ${fontSize}px;">`;
      headHtml += `<th style="background-color: ${headerBg}; color: ${headerText};">${groupHeaderHtml}</th>`;
      activeMeasures.forEach(m => {
        headHtml += `<th class="text-right" style="background-color: ${headerBg}; color: ${headerText};">${m.displayLabel}</th>`;
      });
      headHtml += `</tr>`;
    }

    headEl.innerHTML = headHtml;

    requestAnimationFrame(() => {
      const rows = headEl.querySelectorAll('tr');
      if (rows.length === 2) {
        const topRowThs = rows[0].querySelectorAll('th');
        const bottomRowThs = rows[1].querySelectorAll('th');
        const row1Height = rows[0].getBoundingClientRect().height;

        topRowThs.forEach(th => {
          th.style.position = 'sticky';
          th.style.top = '0px';
          th.style.zIndex = '10';
        });

        bottomRowThs.forEach(th => {
          th.style.position = 'sticky';
          th.style.top = `${row1Height}px`;
          th.style.zIndex = '9';
        });
      } else if (rows.length === 1) {
        const ths = rows[0].querySelectorAll('th');
        ths.forEach(th => {
          th.style.position = 'sticky';
          th.style.top = '0px';
          th.style.zIndex = '10';
        });
      }
    });

    const footEl = element.querySelector('#table-foot');
    let footHtml = `<tr class="totals-row" style="font-size: ${fontSize}px;">`;
    footHtml += `<td>Totals</td>`;

    pivots.forEach((_, pIdx) => {
      activeMeasures.forEach((_, mIdx) => {
        const borderClass = (mIdx === activeMeasures.length - 1 && hasPivots) ? 'pivot-border-right' : '';
        footHtml += `<td class="text-right ${borderClass}">${grandTotals[pIdx][mIdx]}</td>`;
      });
    });

    footHtml += `</tr>`;
    footEl.innerHTML = footHtml;
  }
});
