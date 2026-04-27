looker.plugins.visualizations.add({
  id: "custom_table_v1",
  label: "Custom Table v1",

  options: {
    chart_title: {
      type: "string",
      label: "Title",
      default: "Top Performing Products",
      section: "Style"
    },

    chart_subtitle: {
      type: "string",
      label: "Subtitle",
      default: "Highest grossing items this month",
      section: "Style"
    },

    title_font_size: {
      type: "number",
      label: "Title Font Size",
      default: 18,
      section: "Style"
    },

    subtitle_font_size: {
      type: "number",
      label: "Subtitle Font Size",
      default: 13,
      section: "Style"
    },

    row_font_size: {
      type: "number",
      label: "Row Font Size",
      default: 14,
      section: "Style"
    },

    show_view_all: {
      type: "boolean",
      label: "Show View All",
      default: true,
      section: "Header"
    },

    view_all_text: {
      type: "string",
      label: "View All Text",
      default: "View all →",
      section: "Header"
    },

    pill_dimension_index: {
      type: "number",
      label: "Pill Dimension Position (2 = second dimension)",
      default: 2,
      section: "Columns"
    },

    trend_measure_index: {
      type: "number",
      label: "Trend Measure Position (1 = first measure)",
      default: 3,
      section: "Columns"
    }
  },

  create: function (element) {
    element.innerHTML = `
      <style>
        *{
          box-sizing:border-box;
          font-family:Roboto, Arial, sans-serif;
        }

        html,body{
          margin:0;
          padding:0;
          overflow:hidden;
        }

        .wrap{
          width:100%;
          height:100%;
          padding:14px 16px;
          background:#fff;
          overflow:auto;
        }

        .top{
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:12px;
          margin-bottom:14px;
        }

        .title{
          font-weight:700;
          color:#111827;
          line-height:1.2;
        }

        .subtitle{
          color:#6b7280;
          margin-top:2px;
        }

        .viewall{
          color:#7c3aed;
          font-size:14px;
          cursor:pointer;
          white-space:nowrap;
          user-select:none;
        }

        table{
          width:100%;
          border-collapse:collapse;
          table-layout:auto;
        }

        thead th{
          text-align:left;
          color:#6b7280;
          font-size:12px;
          font-weight:700;
          letter-spacing:.06em;
          text-transform:uppercase;
          padding:8px 0 12px 0;
          border-bottom:1px solid #e5e7eb;
        }

        tbody td{
          padding:14px 0;
          border-bottom:1px solid #eef0f3;
          vertical-align:middle;
          color:#111827;
        }

        tbody tr:last-child td{
          border-bottom:none;
        }

        .product-cell{
          display:flex;
          align-items:center;
          gap:12px;
          min-width:220px;
        }

        .avatar{
          width:36px;
          height:36px;
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          color:#fff;
          font-size:12px;
          font-weight:700;
          flex:0 0 auto;
        }

        .pill{
          display:inline-block;
          padding:4px 10px;
          background:#f3f4f6;
          color:#6b7280;
          border-radius:999px;
          font-size:12px;
          white-space:nowrap;
        }

        .num{
          text-align:right;
          white-space:nowrap;
        }

        .money{
          text-align:right;
          white-space:nowrap;
          font-weight:700;
        }

        .trend{
          text-align:right;
          white-space:nowrap;
          font-weight:600;
        }

        .up{ color:#16a34a; }
        .down{ color:#dc2626; }

        .empty{
          color:#6b7280;
          padding:12px 0;
        }
      </style>

      <div class="wrap">
        <div class="top">
          <div>
            <div class="title" id="title"></div>
            <div class="subtitle" id="subtitle"></div>
          </div>
          <div class="viewall" id="viewall"></div>
        </div>

        <div id="tableArea"></div>
      </div>
    `;
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    try {
      const titleEl = element.querySelector("#title");
      const subtitleEl = element.querySelector("#subtitle");
      const viewAllEl = element.querySelector("#viewall");
      const tableArea = element.querySelector("#tableArea");

      titleEl.innerText = config.chart_title || "Table";
      titleEl.style.fontSize = (config.title_font_size || 18) + "px";

      subtitleEl.innerText = config.chart_subtitle || "";
      subtitleEl.style.fontSize = (config.subtitle_font_size || 13) + "px";

      if (config.show_view_all === false) {
        viewAllEl.style.display = "none";
      } else {
        viewAllEl.style.display = "block";
        viewAllEl.innerText = config.view_all_text || "View all →";
      }

      const dims = queryResponse.fields.dimension_like || [];
      const meas = queryResponse.fields.measure_like || [];

      if (!data.length) {
        tableArea.innerHTML = '<div class="empty">No data available</div>';
        done();
        return;
      }

      viewAllEl.onclick = function () {
        try {
          const firstRow = data[0];
          let opened = false;

          for (let i = 0; i < dims.length; i++) {
            const cell = firstRow[dims[i].name];
            if (cell && cell.links && cell.links.length) {
              window.open(cell.links[0].url, "_blank");
              opened = true;
              break;
            }
          }

          if (!opened) {
            const qid = queryResponse.id || "";
            if (qid) {
              window.open("/explore?qid=" + qid, "_blank");
            }
          }
        } catch (e) {}
      };

      let html = "<table><thead><tr>";

      dims.forEach(d => {
        html += "<th>" + escapeHtml(d.label_short || d.label) + "</th>";
      });

      meas.forEach(m => {
        html += "<th style='text-align:right'>" +
          escapeHtml(m.label_short || m.label) +
          "</th>";
      });

      html += "</tr></thead><tbody>";

      const pillIdx = Math.max(1, Number(config.pill_dimension_index || 2)) - 1;
      const trendIdx = Math.max(1, Number(config.trend_measure_index || 3)) - 1;

      data.forEach((row, rowIndex) => {
        html += "<tr>";

        dims.forEach((d, i) => {
          const val = display(row[d.name]);

          if (i === 0) {
            html += `
              <td>
                <div class="product-cell">
                  <div class="avatar" style="background:${avatarColor(rowIndex)}">
                    ${initials(val)}
                  </div>
                  <div>${escapeHtml(val)}</div>
                </div>
              </td>
            `;
          } else if (i === pillIdx) {
            html += `
              <td><span class="pill">${escapeHtml(val)}</span></td>
            `;
          } else {
            html += "<td>" + escapeHtml(val) + "</td>";
          }
        });

        meas.forEach((m, i) => {
          const raw = value(row[m.name]);
          const txt = display(row[m.name]);

          if (i === trendIdx) {
            const num = Number(raw || 0);
            const up = num >= 0;
            const arrow = up ? "↗" : "↘";

            html += `
              <td class="trend ${up ? "up" : "down"}">
                ${arrow} ${Math.abs(num).toFixed(1)}%
              </td>
            `;
          } else if (looksLikeCurrency(m.label || m.name)) {
            html += `<td class="money">${escapeHtml(txt)}</td>`;
          } else {
            html += `<td class="num">${escapeHtml(txt)}</td>`;
          }
        });

        html += "</tr>";
      });

      html += "</tbody></table>";
      tableArea.innerHTML = html;

      const rowSize = (config.row_font_size || 14) + "px";
      tableArea.querySelectorAll("tbody td").forEach(td => {
        td.style.fontSize = rowSize;
      });

      done();

      function display(cell) {
        if (!cell) return "";
        return cell.rendered != null ? String(cell.rendered) :
               cell.value != null ? String(cell.value) : "";
      }

      function value(cell) {
        if (!cell) return null;
        return cell.value;
      }

      function initials(str) {
        const words = String(str).trim().split(/\s+/).filter(Boolean);
        if (!words.length) return "";
        if (words.length === 1) return words[0].substring(0,2).toUpperCase();
        return (words[0][0] + words[1][0]).toUpperCase();
      }

      function avatarColor(i) {
        const colors = [
          "linear-gradient(135deg,#8b5cf6,#a855f7)",
          "linear-gradient(135deg,#06b6d4,#6366f1)",
          "linear-gradient(135deg,#16a34a,#8b5cf6)",
          "linear-gradient(135deg,#f59e0b,#a855f7)",
          "linear-gradient(135deg,#ec4899,#8b5cf6)",
          "linear-gradient(135deg,#6366f1,#8b5cf6)"
        ];
        return colors[i % colors.length];
      }

      function looksLikeCurrency(s) {
        const t = String(s).toLowerCase();
        return t.includes("revenue") || t.includes("sales") || t.includes("$");
      }

      function escapeHtml(str) {
        return String(str)
          .replace(/&/g,"&amp;")
          .replace(/</g,"&lt;")
          .replace(/>/g,"&gt;")
          .replace(/"/g,"&quot;")
          .replace(/'/g,"&#039;");
      }

    } catch (err) {
      element.innerHTML =
        "<div style='padding:12px;color:red;'>Error: " +
        err.message +
        "</div>";
      done();
    }
  }
});