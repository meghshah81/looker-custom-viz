looker.plugins.visualizations.add({
  id: "hierarchical_pivot_matrix",
  label: "Hierarchical Pivot Matrix",

  options: {
    headerBgColor: {
      type: "string",
      label: "Header Background Color",
      default: "#003366",
      display: "color"
    },
    parentBgColor: {
      type: "string",
      label: "Parent Row Background Color",
      default: "#f4f7f9",
      display: "color"
    },
    childIndent: {
      type: "string",
      label: "Child Row Indent (px)",
      default: "20px",
      display: "text"
    }
  },

  // Set up visualization container canvas
  create: function(element, config) {
    element.style.height = "100%";
    element.style.overflow = "auto";
    element.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    element.innerHTML = `
      <style>
        .tree-grid-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          color: #333;
          text-align: left;
        }
        .tree-grid-table th {
          font-weight: 600;
          color: #fff;
          padding: 8px 12px;
          border: 1px solid #dcdcdc;
        }
        .tree-grid-table td {
          padding: 8px 12px;
          border: 1px solid #e5e5e5;
          vertical-align: middle;
        }
        .row-parent {
          font-weight: bold;
          cursor: pointer;
          user-select: none;
        }
        .row-parent:hover {
          background-color: #eaeaea !important;
        }
        .row-child {
          background-color: #ffffff;
        }
        .row-total {
          font-weight: bold;
          background-color: #f9f9f9;
          border-top: 2px solid #333;
        }
        .toggle-icon {
          display: inline-block;
          width: 14px;
          margin-right: 6px;
          transition: transform 0.15s ease;
        }
        .collapsed .toggle-icon {
          transform: rotate(-90deg);
        }
        .is-hidden {
          display: none !important;
        }
        .null-symbol {
          color: #bbb;
        }
      </style>
      <div id="matrix-vis-container"></div>
    `;
  },

  // Render logic triggered on query runtime changes
  updateAsync: function(data, element, config, queryResponse, details, done) {
    try {
      const container = document.getElementById("matrix-vis-container");
      if (!container) return done();
      container.innerHTML = "";

      // 1. Guardrail Validations
      if (!queryResponse || !queryResponse.fields || !queryResponse.fields.dimensions || queryResponse.fields.dimensions.length < 2) {
        this.addError({
          title: "Invalid Field Layout",
          message: "This visualization requires exactly 2 vertical dimensions (Parent, Child) and a pivoted dimension."
        });
        return done();
      }

      if (!queryResponse.pivots || queryResponse.pivots.length === 0) {
        this.addError({
          title: "Missing Pivot",
          message: "Please pivot a dimension horizontally (e.g., Week) to populate matrix columns."
        });
        return done();
      }

      // 2. Structural Variable Configurations
      const dimensions = queryResponse.fields.dimensions;
      const measures = queryResponse.fields.measures;
      const pivots = queryResponse.pivots;

      const dimParentKey = dimensions[0].name;
      const dimChildKey = dimensions[1].name;

      const headerBg = config.headerBgColor || "#003366";
      const parentBg = config.parentBgColor || "#f4f7f9";
      const indentAmt = config.childIndent || "20px";

      // 3. Hierarchical Data Aggregation Transformation Engine
      let treeData = {};
      let columnTotals = {};

      // Initialize column total map architecture safely
      pivots.forEach(p => {
        columnTotals[p.key] = {};
        measures.forEach(m => { columnTotals[p.key][m.name] = 0; });
      });

      data.forEach(row => {
        const parentVal = row[dimParentKey]?.value || "Unknown";
        const childVal = row[dimChildKey]?.value || "";

        if (!treeData[parentVal]) {
          treeData[parentVal] = {
            childCount: 0,
            children: {},
            totals: {}
          };
          // Initialize parent total arrays
          pivots.forEach(p => {
            treeData[parentVal].totals[p.key] = {};
            measures.forEach(m => { treeData[parentVal].totals[p.key][m.name] = 0; });
          });
        }

        // Store child metrics
        if (childVal) {
          if (!treeData[parentVal].children[childVal]) {
            treeData[parentVal].children[childVal] = { metrics: {} };
            treeData[parentVal].childCount++;
          }

          pivots.forEach(p => {
            treeData[parentVal].children[childVal].metrics[p.key] = {};
            measures.forEach(m => {
              const cellVal = parseFloat(row[m.name]?.[p.key]?.value) || 0;
              treeData[parentVal].children[childVal].metrics[p.key][m.name] = row[m.name]?.[p.key]?.value;
              
              // Roll up metrics up directly to structural parents and grand totals
              treeData[parentVal].totals[p.key][m.name] += cellVal;
              columnTotals[p.key][m.name] += cellVal;
            });
          });
        }
      });

      // 4. Construct Table DOM Elements Fluidly
      const table = document.createElement("table");
      table.className = "tree-grid-table";

      // Row 1: Top Pivot Headers (Weeks)
      const trHeader1 = document.createElement("tr");
      trHeader1.style.backgroundColor = headerBg;
      
      const thDimSpacer1 = document.createElement("th");
      thDimSpacer1.colSpan = 2;
      thDimSpacer1.innerText = dimensions[0].label + " / " + dimensions[1].label;
      trHeader1.appendChild(thDimSpacer1);

      pivots.forEach(p => {
        const thPivot = document.createElement("th");
        thPivot.colSpan = measures.length;
        thPivot.style.textAlign = "center";
        thPivot.innerText = p.label || p.key;
        trHeader1.appendChild(thPivot);
      });
      table.appendChild(trHeader1);

      // Row 2: Secondary Measure Column Headers
      const trHeader2 = document.createElement("tr");
      trHeader2.style.backgroundColor = headerBg;
      
      const thDimSpacer2_1 = document.createElement("th");
      thDimSpacer2_1.innerText = dimensions[0].label;
      trHeader2.appendChild(thDimSpacer2_1);
      
      const thDimSpacer2_2 = document.createElement("th");
      thDimSpacer2_2.innerText = dimensions[1].label;
      trHeader2.appendChild(thDimSpacer2_2);

      pivots.forEach(p => {
        measures.forEach(m => {
          const thMeas = document.createElement("th");
          thMeas.style.textAlign = "right";
          thMeas.innerText = m.label_short || m.label;
          trHeader2.appendChild(thMeas);
        });
      });
      table.appendChild(trHeader2);

      // 5. Populate Row Trees via Loop Engine
      let parentIndex = 0;
      for (const parentName in treeData) {
        parentIndex++;
        const parentNode = treeData[parentName];
        const parentRowId = `parent-group-${parentIndex}`;

        // Append Parent Accordion Target Row
        const trParent = document.createElement("tr");
        trParent.className = "row-parent";
        trParent.style.backgroundColor = parentBg;
        trParent.setAttribute("data-target", parentRowId);

        const tdParentName = document.createElement("td");
        tdParentName.colSpan = 2;
        tdParentName.innerHTML = `<span class="toggle-icon">▼</span>${parentName} (${parentNode.childCount})`;
        trParent.appendChild(tdParentName);

        // Render calculated Parent Aggregate Roll-ups
        pivots.forEach(p => {
          measures.forEach(m => {
            const tdParentCell = document.createElement("td");
            tdParentCell.style.textAlign = "right";
            const val = parentNode.totals[p.key][m.name];
            tdParentCell.innerHTML = val === 0 ? `<span class="null-symbol">∅</span>` : val.toLocaleString();
            trParent.appendChild(tdParentCell);
          });
        });
        table.appendChild(trParent);

        // Click handler to instantly trigger layout toggle states
        trParent.addEventListener("click", function() {
          this.classList.toggle("collapsed");
          const targetId = this.getAttribute("data-target");
          const children = table.querySelectorAll(`[data-parent="${targetId}"]`);
          children.forEach(child => child.classList.toggle("is-hidden"));
        });

        // Append Nested Child Subrows
        for (const childName in parentNode.children) {
          const childNode = parentNode.children[childName];
          const trChild = document.createElement("tr");
          trChild.className = "row-child";
          trChild.setAttribute("data-parent", parentRowId);

          const tdChildSpacer = document.createElement("td");
          tdChildSpacer.style.width = "10px";
          trChild.appendChild(tdChildSpacer);

          const tdChildName = document.createElement("td");
          tdChildName.style.paddingLeft = indentAmt;
          tdChildName.innerText = childName;
          trChild.appendChild(tdChildName);

          pivots.forEach(p => {
            measures.forEach(m => {
              const tdChildCell = document.createElement("td");
              tdChildCell.style.textAlign = "right";
              const rawVal = childNode.metrics[p.key]?.[m.name];
              
              if (rawVal === undefined || rawVal === null) {
                tdChildCell.innerHTML = `<span class="null-symbol">∅</span>`;
              } else {
                tdChildCell.innerText = typeof rawVal === "number" ? rawVal.toLocaleString() : rawVal;
              }
              trChild.appendChild(tdChildCell);
            });
          });
          table.appendChild(trChild);
        }
      }

      // 6. Build Matrix Column Sticky Footer Bottom Totals Row
      const trTotal = document.createElement("tr");
      trTotal.className = "row-total";
      
      const tdTotalLabel = document.createElement("td");
      tdTotalLabel.colSpan = 2;
      tdTotalLabel.innerText = "Totals";
      trTotal.appendChild(tdTotalLabel);

      pivots.forEach(p => {
        measures.forEach(m => {
          const tdTotalCell = document.createElement("td");
          tdTotalCell.style.textAlign = "right";
          const finalSum = columnTotals[p.key][m.name];
          tdTotalCell.innerText = finalSum.toLocaleString();
          trTotal.appendChild(tdTotalCell);
        });
      });
      table.appendChild(trTotal);

      container.appendChild(table);

    } catch (err) {
      this.addError({
        title: "Matrix Layout Engine Failure",
        message: err.message
      });
    }
    done();
  }
});
