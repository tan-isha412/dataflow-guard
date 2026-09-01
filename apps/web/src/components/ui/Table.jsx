// Generic — columns describe WHAT to render, rows are just data.
// Every future list page (audit logs, approvals, policies) reuses
// this instead of writing a new <table> each time.
export function Table({ columns, rows, rowKey }) {
  return (
    <table>
      <thead>
        <tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[rowKey]}>
            {columns.map((col) => (
              <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}