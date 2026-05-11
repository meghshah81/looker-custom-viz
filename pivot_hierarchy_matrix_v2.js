// =====================================================
// LOOKER CUSTOM VISUALIZATION
// Pivot Hierarchy Matrix
// Production Ready Version
// =====================================================

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

  id: "pivot_hierarchy_matrix_v2",

  label: "Pivot Hierarchy Matrix v2",

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
          font-family: Arial, sans-serif;
        }

        #pivot-grid {
          width: 100%;
          height: 100vh;
        }

        .ag-theme-alpine {
          --ag-font-size: 13px;
          --ag-font-family: Arial, sans-serif;
        }

        .ag-root-wrapper {
          border-radius: 8px;
          border: 1px solid #d9d9d9;
        }

        .ag-header-group-cell {
          font-weight: 700;
          background: #9b6468;
          color: white;
        }

        .ag-header-cell {
          font-weight: 700;
        }

        .ag-row-group-indent-0 {
          font-weight: 700;
        }

        .ag-pinned-right-header {
          background: #9b6468;
          color: white;
        }

        .ag-row-group {
          font-weight: 700;
        }

      </style>

      <div
        id="pivot-grid"
        class="ag-theme-alpine"
      ></div>
    `;

    this.gridDiv =
      element.querySelector("#pivot-grid");

    this.initialized = false;

    this.gridApi = null;
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

      // ==========================================
      // LOAD AG GRID
      // ==========================================

      if (!this.initialized) {

        await loadScript(
          "https://cdn.jsdelivr.net/npm/ag-grid-enterprise/dist/ag-grid-enterprise.min.js"
        );

        // OPTIONAL LICENSE
        // agGrid.LicenseManager.setLicenseKey("YOUR_KEY");

        this.initialized = true;
      }

      // ==========================================
      // VALIDATION
      // ==========================================

      const dimensions =
        queryResponse.fields.dimensions || [];

      const measures =
        queryResponse.fields.measures || [];

      const pivots =
        queryResponse.pivots || [];

      if (dimensions.length === 0) {
        throw new Error(
          "At least one dimension is required."
        );
      }

      if (measures.length === 0) {
        throw new Error(
          "At least one measure is required."
        );
      }

      if (pivots.length === 0) {
        throw new Error(
          "Please pivot at least one field."
        );
      }

      // ==========================================
      // GET PIVOT VALUES
      // ==========================================

      const pivotKeys = [];

      pivots.forEach(pivot => {

        if (pivot.key) {
          pivotKeys.push(pivot.key);
        }

      });

      // ==========================================
      // BUILD ROW DATA
      // ==========================================

      const rowData = [];

      data.forEach(row => {

        const rowObj = {};

        // --------------------------------------
        // DIMENSIONS
        // --------------------------------------

        dimensions.forEach(dim => {

          rowObj[dim.name] =
            row[dim.name]
              ? row[dim.name].value
              : "";

        });

        // --------------------------------------
        // MEASURES
        // --------------------------------------

        measures.forEach(measure => {

          pivotKeys.forEach(pivotKey => {

            let value = 0;

            if (
              row[measure.name] &&
              row[measure.name][pivotKey]
            ) {

              value =
                row[measure.name][pivotKey]
                  .value;

              if (
                value === null ||
                value === undefined ||
                value === ""
              ) {
                value = 0;
              }

            }

            rowObj[
              `${measure.name}|${pivotKey}`
            ] = value;

          });

          // ----------------------------------
          // ROW TOTALS
          // ----------------------------------

          if (
            row[measure.name] &&
            row[measure.name][
              "$$$_row_total_$$$"
            ]
          ) {

            rowObj[
              `${measure.name}_row_total`
            ] =
              row[measure.name][
                "$$$_row_total_$$$"
              ].value;

          }

        });

        rowData.push(rowObj);

      });

      // ==========================================
      // BUILD COLUMNS
      // ==========================================

      const columnDefs = [];

      // ------------------------------------------
      // ROW GROUP DIMENSIONS
      // ------------------------------------------

      dimensions.forEach(dim => {

        columnDefs.push({

          field: dim.name,

          headerName:
            dim.label_short || dim.label,

          rowGroup: true,

          hide: true

        });

      });

      // ------------------------------------------
      // PIVOTED COLUMNS
      // ------------------------------------------

      pivotKeys.forEach(pivotKey => {

        const childColumns = [];

        measures.forEach(measure => {

          childColumns.push({

            field:
              `${measure.name}|${pivotKey}`,

            headerName:
              measure.label_short ||
              measure.label,

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
                (measure.label || "")
                  .toLowerCase();

              // ------------------------------
              // PERCENT FORMATTING
              // ------------------------------

              if (
                label.includes("rate") ||
                label.includes("%") ||
                label.includes("percent")
              ) {

                return `${Number(
                  params.value
                ).toFixed(0)} %`;

              }

              return Number(
                params.value
              ).toLocaleString();

            },

            // ------------------------------
            // SUBTOTAL STYLING
            // ------------------------------

            cellStyle: params => {

              if (params.node.group) {

                return {

                  backgroundColor:
                    config.subtotal_background,

                  color:
                    config.subtotal_foreground,

                  fontWeight: "bold"

                };

              }

              return {};

            }

          });

        });

        columnDefs.push({

          headerName:
            String(pivotKey)
              .split("|")[0],

          children: childColumns

        });

      });

      // ==========================================
      // ROW TOTALS
      // ==========================================

      if (config.show_row_totals) {

        const totalColumns = [];

        measures.forEach(measure => {

          totalColumns.push({

            field:
              `${measure.name}_row_total`,

            headerName:
              measure.label_short ||
              measure.label,

            pinned: "right",

            width: 130,

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
                (measure.label || "")
                  .toLowerCase();

              if (
                label.includes("rate") ||
                label.includes("%") ||
                label.includes("percent")
              ) {

                return `${Number(
                  params.value
                ).toFixed(0)} %`;

              }

              return Number(
                params.value
              ).toLocaleString();

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

          children: totalColumns

        });

      }

      // ==========================================
      // COLUMN TOTALS
      // ==========================================

      let pinnedBottomRowData = [];

      if (config.show_column_totals) {

        const totalRow = {};

        dimensions.forEach(dim => {

          totalRow[dim.name] = "Total";

        });

        // --------------------------------------
        // PIVOT TOTALS
        // --------------------------------------

        pivotKeys.forEach(pivotKey => {

          measures.forEach(measure => {

            const field =
              `${measure.name}|${pivotKey}`;

            let total = 0;

            rowData.forEach(r => {

              total +=
                Number(r[field]) || 0;

            });

            totalRow[field] = total;

          });

        });

        // --------------------------------------
        // GRAND TOTALS
        // --------------------------------------

        measures.forEach(measure => {

          let grandTotal = 0;

          rowData.forEach(r => {

            grandTotal += Number(
              r[
                `${measure.name}_row_total`
              ]
            ) || 0;

          });

          totalRow[
            `${measure.name}_row_total`
          ] = grandTotal;

        });

        pinnedBottomRowData = [totalRow];

      }

      // ==========================================
      // GRID OPTIONS
      // ==========================================

      const gridOptions = {

        columnDefs: columnDefs,

        rowData: rowData,

        animateRows: true,

        pagination: false,

        suppressAggFuncInHeader: true,

        rowSelection: "multiple",

        suppressRowClickSelection: true,

        groupDefaultExpanded: 0,

        groupDisplayType: "singleColumn",

        groupIncludeFooter: true,

        pinnedBottomRowData:
          pinnedBottomRowData,

        defaultColDef: {

          sortable: true,

          filter: true,

          resizable: true

        },

        // ======================================
        // HIERARCHY COLUMN
        // ======================================

        autoGroupColumnDef: {

          headerName:
            dimensions[0].label_short ||
            dimensions[0].label,

          minWidth: 320,

          pinned: "left",

          cellRendererParams: {

            suppressCount: true

          },

          valueGetter: params => {

            if (
              params.node &&
              params.node.key
            ) {
              return params.node.key;
            }

            return "";

          },

          cellStyle: params => {

            if (params.node.group) {

              return {

                fontWeight: "bold",

                backgroundColor:
                  config.subtotal_background,

                color:
                  config.subtotal_foreground

              };

            }

            return {};

          }

        },

        // ======================================
        // COLUMN TOTAL STYLING
        // ======================================

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

      // ==========================================
      // DESTROY OLD GRID
      // ==========================================

      if (this.gridApi) {

        this.gridApi.destroy();

      }

      // ==========================================
      // CREATE GRID
      // ==========================================

      this.gridApi =
        agGrid.createGrid(
          this.gridDiv,
          gridOptions
        );

      doneRendering();

    } catch (err) {

      console.error(err);

      element.innerHTML = `
        <div style="
          padding:20px;
          color:red;
          font-family:Arial;
        ">
          <h3>
            Error Rendering Visualization
          </h3>

          <pre>
${err}
          </pre>
        </div>
      `;

      doneRendering();

    }

  }

});
