// NER = Named Entity Recognition — unlike every other detector,
// this one can't be a simple regex, because "is this word a
// person's name" isn't a fixed pattern the way an email address is.
// This wraps an external NER model/API rather than reimplementing one.
import { DATA_TYPES, SENSITIVITY_LEVELS, DETECTION_METHODS } from "@dataflow-guardian/shared";

export async function detectNamedEntities(text) {
  try {
    const entities = await callNerModel(text); // e.g., a hosted NER API or a local model

    return entities
      .filter((entity) => entity.type === "PERSON" || entity.type === "ORG" || entity.type === "LOCATION")
      .map((entity) => ({
        id: crypto.randomUUID(),
        type: entity.type === "PERSON" ? DATA_TYPES.PERSON_NAME
          : entity.type === "ORG" ? DATA_TYPES.ORGANIZATION_NAME
          : DATA_TYPES.LOCATION,
        sensitivity: SENSITIVITY_LEVELS.LOW,
        start: entity.start,
        end: entity.end,
        confidence: entity.confidence,
        method: DETECTION_METHODS.NER,
        ruleId: "ner-v1"
      }));
  } catch (err) {
    // If the NER model is unreachable or slow, the REST of the
    // inspection pipeline (all the fixed-pattern detectors from Days
    // 6-7) still runs completely fine — this detector's failure
    // never breaks the core product, only reduces coverage for this
    // one scan.
    console.error("NER detection failed, continuing without it:", err.message);
    return [];
  }
}