const FIELDS = ["DATA_TYPE", "SENSITIVITY", "RISK_SCORE", "DESTINATION_RISK"];
const OPERATORS = ["EQUALS", "NOT_EQUALS", "IN", "GREATER_THAN", "LESS_THAN"];

// Produces exactly the { field, operator, value } shape the backend's
// policy.evaluator.js (Day 8) checks — this form is a visual editor
// for that shape, not a new one.
export function PolicyConditionBuilder({ conditions, onChange }) {
  function updateCondition(index, updates) {
    onChange(conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  }

  function removeCondition(index) {
    onChange(conditions.filter((_, i) => i !== index));
  }

  function addCondition() {
    onChange([...conditions, { field: FIELDS[0], operator: OPERATORS[0], value: "" }]);
  }

  return (
    <div className="condition-builder">
      {conditions.map((condition, index) => (
        <div key={index} className="condition-row">
          <select
            value={condition.field}
            onChange={(e) => updateCondition(index, { field: e.target.value })}
          >
            {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select
            value={condition.operator}
            onChange={(e) => updateCondition(index, { operator: e.target.value })}
          >
            {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
          <input
            value={condition.value}
            onChange={(e) => updateCondition(index, { value: e.target.value })}
            placeholder="Value"
          />
          <button type="button" onClick={() => removeCondition(index)}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={addCondition}>+ Add condition</button>
    </div>
  );
}