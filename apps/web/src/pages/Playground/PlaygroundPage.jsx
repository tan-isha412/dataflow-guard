import { useState } from "react";
import { useInspect } from "../../hooks/useInspect.js";
import { DetectionHighlighter } from "./DetectionHighlighter.jsx";
import { DecisionResultPanel } from "./DecisionResultPanel.jsx";

export function PlaygroundPage() {
  const [content, setContent] = useState("");
  const { mutate, data, isPending } = useInspect();

  function handleScan(e) {
    e.preventDefault();
    mutate(content);
  }

  return (
    <div>
      <h1>Playground</h1>
      <form onSubmit={handleScan}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="Paste text to scan..."
        />
        <button type="submit" disabled={isPending}>{isPending ? "Scanning..." : "Scan"}</button>
      </form>

      {data && (
        <>
          <DetectionHighlighter content={content} detections={data.detections} />
          <DecisionResultPanel decision={data} />
        </>
      )}
    </div>
  );
}