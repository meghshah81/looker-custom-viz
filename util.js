export function showError(element, message) {

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
}

export function getMeasures(queryResponse) {
  return queryResponse.fields.measure_like || [];
}

export function getDimensions(queryResponse) {
  return queryResponse.fields.dimension_like || [];
}

export function getNumericValue(row, fieldName) {

  const field = row[fieldName];

  if (field == null) return 0;

  // Standard Looker field object
  if (typeof field === "object" && field.value != null) {
    return Number(field.value) || 0;
  }

  // Table calculations
  if (typeof field === "number") {
    return field;
  }

  // String numeric
  if (typeof field === "string") {
    return Number(field.replace(/,/g, "")) || 0;
  }

  return 0;
}

export function validateMeasureCount(
  element,
  measures,
  required
) {

  if (measures.length < required) {

    showError(
      element,
      `This visualization requires ${required} measures.\n\n` +
      `Current Measures: ${measures.length}`
    );

    return false;
  }

  return true;
}

export function detectPivot(queryResponse) {

  return (
    queryResponse.fields.pivots &&
    queryResponse.fields.pivots.length > 0
  );
}
