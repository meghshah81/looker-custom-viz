function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

looker.plugins.visualizations.add({

  id: "pivot_hierarchy_matrix",
  label: "Pivot Hierarchy Matrix",

  options: {

    show_row_totals: {
      type: "boolean",
      label: "Show Row Totals",
      default: true
    },

    show_column_totals: {
      type: "boolean",
      label: "Show Column Totals",
      default: true
    },

    row_total_background: {
      type: "string",
      label: "Row Total Background",
      default: "#9b6468"
    },

    row_total_foreground: {
      type: "string",
      label: "Row Total Foreground",
      default: "#ffffff"
    },

    column_total_background: {
      type: "string",
      label: "Column Total Background",
      default: "#9b6468"
    },

    column_total_foreground: {
      type: "string",
      label: "Column Total Foreground",
      default: "#ffffff"
    },

    subtotal_background: {
      type: "string",
      label: "Subtotal Background",
      default: "#efe3df"
    },

    subtotal_foreground: {
      type: "string",
      label: "Subtotal Foreground",
      default: "#000000"
    }

  },

  create: function(element) {

    element.innerHTML = `
      <style>

        html, body {
          margin: 0;
          padding: 0;
          overflow: hidden;
        }

        #pivot-grid {
          width: 100%;
          height: 100vh;
        }

        .ag-theme-alpine {
          --ag-font-size: 13px;
          --ag-font-family: Arial, sans-serif;
        }

        .ag-header-cell-label {
          font-weight: 700;
        }

        .ag-row-group {
          font-weight: 700;
        }

        .total-column {
          font-weight: bold;
        }

      </style>

      <div id="pivot-grid" class="ag-theme-alpine"></div>
    `;

    this.gridDiv = element.querySelector("#pivot-grid");

    this.initialized = false;
  },

  updateAsync: async function(
    data,
    element,
    config,
    queryResponse,
    details,
    doneRendering
  ) {

    try {

      if (!this.initialized) {

        await loadScript(
          "https://cdn.jsdelivr.net/npm/ag-grid-enterprise/dist/ag-grid-enterprise.min.js"
        );

        // OPTIONAL LICENSE
        // agGrid.LicenseManager.setLicenseKey("YOUR_LICENSE_KEY");

        this.initialized = true;
      }

      const dimensions = queryResponse.fields.dimensions || [];
      const measures = queryResponse.fields.measures || [];
      const pivots = queryResponse.pivots || [];

      if (dimensions.length === 0) {
        throw new Error("At least one dimension is required.");
      }

      if (pivots.length === 0) {
        throw new Error("Please pivot at least one field.");
      }

      if (measures.length === 0) {
        throw new Error("At least one measure is required.");
      }

      const pivotKeys = [];

      pivots.forEach(p => {
        if (p.key) {
          pivotKeys.push(p.key);
        }
      });

      const rowData = [];

      data.forEach(row => {

        const obj = {};

        dimensions.forEach(dim => {
          obj[dim.name] = row[dim.name]
            ? row[dim.name].value
            : null;
        });

        measures.forEach(measure => {

          pivotKeys.forEach(pivotKey => {

            const value =
              row[measure.name] &&
              row[measure.name][pivotKey]
                ? row[measure.name][pivotKey].value
                : null;

            obj[`${measure.name}|${pivotKey}`] = value;

          });

          if (
            row[measure.name] &&
            row[measure.name]["$$$_row_total_$$$"]
          ) {

            obj[`${measure.name}_row_total`] =
              row[measure.name]["$$$_row_total_$$$"].value;

          }

        });

        rowData.push(obj);

      });

      const columnDefs = [];

      dimensions.forEach((dim, index) => {

        columnDefs.push({
          field: dim.name,
          headerName: dim.label_short || dim.label,
          rowGroup: index === 0,
          hide: index === 0,
          pinned: "left",
          width: index === 0 ? 280 : 220,
          cellStyle: {
            fontWeight: "600"
          }
        });

      });

      pivotKeys.forEach(pivotKey => {

        const childCols = [];

        measures.forEach(measure => {

          childCols.push({

            field: `${measure.name}|${pivotKey}`,

            headerName:
              measure.label_short || measure.label,

            width: 120,

            sortable: true,

            filter: true,

            resizable: true,

            aggFunc: "sum",

            valueFormatter: params => {

              if (
                params.value === null ||
                params.value === undefined
              ) {
                return "";
              }

              const label =
                (measure.label || "").toLowerCase();

              if (
                label.includes("rate") ||
                label.includes("%") ||
                label.includes("percent")
              ) {
                return `${Number(params.value).toFixed(0)} %`;
              }

              return Number(params.value).toLocaleString();
            },

            cellStyle: params => {

              const style = {};

              if (params.node.group) {

                style.backgroundColor =
                  config.subtotal_background;

                style.color =
                  config.subtotal_foreground;

                style.fontWeight = "bold";
              }

              return style;
            }

          });

        });

        columnDefs.push({
          headerName: pivotKey,
          children: childCols
        });

      });

      if (config.show_row_totals) {

        const totalChildren = [];

        measures.forEach(measure => {

          totalChildren.push({

            field: `${measure.name}_row_total`,

            headerName:
              measure.label_short || measure.label,

            pinned: "right",

            width: 140,

            sortable: true,

            filter: true,

            resizable: true,

            cellClass: "total-column",

            valueFormatter: params => {

              if (
                params.value === null ||
                params.value === undefined
              ) {
                return "";
              }

              const label =
                (measure.label || "").toLowerCase();

              if (
                label.includes("rate") ||
                label.includes("%") ||
                label.includes("percent")
              ) {
                return `${Number(params.value).toFixed(0)} %`;
              }

              return Number(params.value).toLocaleString();
            },

            cellStyle: {
              backgroundColor:
                config.row_total_background,

              color:
                config.row_total_foreground,

              fontWeight: "bold"
            }

          });

        });

        columnDefs.push({
          headerName: "Total",
          children: totalChildren
        });

      }

      let pinnedBottomRowData = [];

      if (config.show_column_totals) {

        const totalRow = {};

        dimensions.forEach(dim => {
          totalRow[dim.name] = "Total";
        });

        pivotKeys.forEach(pivotKey => {

          measures.forEach(measure => {

            const field =
              `${measure.name}|${pivotKey}`;

            let total = 0;

            rowData.forEach(r => {

              total += Number(r[field]) || 0;

            });

            totalRow[field] = total;

          });

        });

        measures.forEach(measure => {

          let grandTotal = 0;

          rowData.forEach(r => {

            grandTotal +=
              Number(r[`${measure.name}_row_total`]) || 0;

          });

          totalRow[`${measure.name}_row_total`] =
            grandTotal;

        });

        pinnedBottomRowData = [totalRow];

      }

      const gridOptions = {

        columnDefs: columnDefs,

        rowData: rowData,

        treeData: true,

        animateRows: true,

        suppressAggFuncInHeader: true,

        groupDefaultExpanded: 0,

        enableRangeSelection: true,

        rowSelection: "multiple",

        pagination: false,

        suppressRowClickSelection: true,

        groupIncludeFooter: true,

        groupIncludeTotalFooter:
          config.show_column_totals,

        pinnedBottomRowData: pinnedBottomRowData,

        defaultColDef: {
          sortable: true,
          filter: true,
          resizable: true
        },

        autoGroupColumnDef: {

          headerName:
            dimensions[0].label_short ||
            dimensions[0].label,

          minWidth: 320,

          pinned: "left",

          cellRendererParams: {
            suppressCount: true
          }

        },

        getDataPath: function(data) {

          const path = [];

          dimensions.forEach(dim => {

            if (data[dim.name]) {
              path.push(data[dim.name]);
            }

          });

          return path;

        },

        getRowStyle: params => {

          if (params.node.rowPinned) {

            return {

              background:
                config.column_total_background,

              color:
                config.column_total_foreground,

              fontWeight: "bold"

            };

          }

          return null;

        }

      };

      if (this.gridApi) {
        this.gridApi.destroy();
      }

      new agGrid.Grid(this.gridDiv, gridOptions);

      doneRendering();

    } catch (err) {

      console.error(err);

      element.innerHTML = `
        <div style="
          padding:20px;
          font-family:Arial;
          color:red;
        ">
          <h3>Error Rendering Visualization</h3>
          <pre>${err}</pre>
        </div>
      `;

      doneRendering();
    }

  }

});