window.LookerVizUtils = {

  // =========================================
  // ERROR UI
  // =========================================

  showError(element, message) {

    if (!element) return;

    element.innerHTML = `
      <div style="
        padding:20px;
        margin:12px;
        border-radius:8px;
        background:#fef2f2;
        border:1px solid #fecaca;
        color:#991b1b;
        font-family:Inter,Arial,sans-serif;
      ">
        <div style="
          font-size:16px;
          font-weight:700;
          margin-bottom:10px;
        ">
          Visualization Cannot Render
        </div>

        <div style="
          white-space:pre-line;
          line-height:1.5;
        ">
          ${message}
        </div>
      </div>
    `;
  },

  // =========================================
  // FIELD HELPERS
  // =========================================

  getMeasures(queryResponse) {

    return (
      queryResponse &&
      queryResponse.fields &&
      queryResponse.fields.measure_like
    ) || [];
  },

  getDimensions(queryResponse) {

    return (
      queryResponse &&
      queryResponse.fields &&
      queryResponse.fields.dimension_like
    ) || [];
  },

  // =========================================
  // NUMERIC VALUE
  // Used for calculations
  // =========================================

  getNumericValue(row, fieldName) {

    try {

      const field = row[fieldName];

      if (field == null) return 0;

      // Standard Looker object
      if (
        typeof field === "object" &&
        field.value != null
      ) {

        return this.cleanNumber(field.value);
      }

      // Primitive number
      if (typeof field === "number") {

        return field;
      }

      // Primitive string
      if (typeof field === "string") {

        return this.cleanNumber(field);
      }

      return 0;

    } catch(e) {

      return 0;
    }
  },

  // =========================================
  // DISPLAY VALUE
  // Preserves Looker formatting
  // =========================================

  getDisplayValue(row, fieldName) {

    try {

      const field = row[fieldName];

      if (field == null) return "—";

      // Preserve Looker-rendered format
      if (
        typeof field === "object" &&
        field.rendered != null
      ) {

        return field.rendered;
      }

      // Fallback to raw value
      if (
        typeof field === "object" &&
        field.value != null
      ) {

        return field.value;
      }

      return field;

    } catch(e) {

      return "—";
    }
  },

  // =========================================
  // CLEAN NUMBER
  // =========================================

  cleanNumber(value) {

    if (value == null) return 0;

    if (typeof value === "number") {
      return value;
    }

    const cleaned = String(value)
      .replace(/,/g, "")
      .replace(/\$/g, "")
      .replace(/%/g, "")
      .trim();

    const parsed = Number(cleaned);

    return isNaN(parsed) ? 0 : parsed;
  },

  // =========================================
  // VALIDATIONS
  // =========================================

  validateMeasureCount(
    element,
    measures,
    required
  ) {

    if (!measures || measures.length !== required) {

      this.showError(
        element,
        `This visualization requires exactly ${required} measures.\n\n` +
        `Required sequence:\n` +
        `1. Actual\n` +
        `2. Comparison\n` +
        `3. Budget\n\n` +
        `Current Measures: ${measures ? measures.length : 0}`
      );

      return false;
    }

    return true;
  },

  validateData(element, data) {

    if (!data || !data.length) {

      this.showError(
        element,
        "No data returned from query."
      );

      return false;
    }

    return true;
  },

  detectPivot(queryResponse) {

    return (
      queryResponse &&
      queryResponse.fields &&
      queryResponse.fields.pivots &&
      queryResponse.fields.pivots.length > 0
    );
  },

  isNumeric(value) {

    return (
      !isNaN(parseFloat(value)) &&
      isFinite(value)
    );
  }
};
