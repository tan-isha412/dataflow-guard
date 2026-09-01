// This is the SAFEST place in the entire codebase to introduce an
// LLM call: decision.action and decision.riskScore (Day 9) are
// already fully computed by deterministic code before this function
// is ever called. Nothing here can change what already happened —
// it only adds a human-readable sentence on top.
export async function explainDecision(decision) {
  const prompt = buildExplanationPrompt(decision);

  try {
    const explanation = await callLlm(prompt);
    return explanation;
  } catch (err) {
    console.error("LLM explanation failed, decision stands without it:", err.message);
    return null; // the caller must handle a null explanation gracefully — never assume this succeeds
  }
}

function buildExplanationPrompt(decision) {
  const dataTypes = [...new Set(decision.detections.map((d) => d.type))].join(", ");
  return `In one plain-English sentence, explain to a non-technical user why content containing ${dataTypes} resulted in the action "${decision.action}". Do not suggest any action other than what already happened.`;
}