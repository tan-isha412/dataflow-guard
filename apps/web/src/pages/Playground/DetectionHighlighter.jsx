// Renders the original text with each detected span wrapped in a
// highlighted <mark>. Splits the string using the detections' exact
// start/end positions — no re-scanning with regex on the frontend,
// since the backend already did that work and sent us the offsets.
export function DetectionHighlighter({ content, detections }) {
  const sorted = [...detections].sort((a, b) => a.start - b.start);
  const parts = [];
  let cursor = 0;

  for (const detection of sorted) {
    if (detection.start > cursor) {
      parts.push(<span key={`plain-${cursor}`}>{content.slice(cursor, detection.start)}</span>);
    }
    parts.push(
      <mark key={detection.id} title={detection.type}>
        {content.slice(detection.start, detection.end)}
      </mark>
    );
    cursor = detection.end;
  }

  if (cursor < content.length) {
    parts.push(<span key={`plain-${cursor}`}>{content.slice(cursor)}</span>);
  }

  return <div className="detection-highlighter">{parts}</div>;
}