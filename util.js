window.LookerVizUtils = {

  showError(element, message) {

    element.innerHTML = `
      <div style="
        padding:20px;
        margin:10px;
        border-radius:8px;
        background:#fef2f2;
        border:1px solid #fecaca;
        color:#991b1b;
        font-family:Inter,Arial;
      ">
        <div style="
          font-weight:600;
          margin-bottom:8px;
        ">
          Visualization Error
        </div>

        <div style="white-space:pre-line;">
          ${message}
        </div>
      </div>
    `;
  },

  getMeasures(queryResponse) {
    return queryResponse.fields.measure_like || [];
  },

  getDimensions(queryResponse) {
    return queryResponse.fields.dimension_like || [];
  },

  getNumericValue(row, fieldName) {

    const field = row[fieldName];

    if (field == null) return 0;

    // Standard Looker field object
    if (
      typeof field === "object" &&
      field.value != null
    ) {
      return Number(field.value) || 0;
    }

    // Table calculations
    if (typeof field === "number") {
      return field;
    }

    // String numeric
    if (typeof field === "string") {
      return Number(
        field.replace(/,/g, "")
      ) || 0;
    }

    return 0;
  },

  getDisplayValue(row, fieldName) {

    const field = row[fieldName];

    if (field == null) return "—";

    // Preserve Looker formatting
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
  },

  validateMeasureCount(
    element,
    measures,
    required
  ) {

    if (measures.length !== required) {

      this.showError(
        element,
        `This visualization requires exactly ${required} measures.\n\n` +
        `Current Measures: ${measures.length}`
      );

      return false;
    }

    return true;
  },

  detectPivot(queryResponse) {

    return (
      queryResponse.fields.pivots &&
      queryResponse.fields.pivots.length > 0
    );
  }
};
