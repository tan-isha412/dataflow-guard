import { useMutation } from "@tanstack/react-query";
import { inspectContent } from "../api/endpoints/inspection.js";

// useMutation (not useQuery) because scanning is an ACTION the user
// triggers, not data that loads automatically on page visit.
export function useInspect() {
  return useMutation({ mutationFn: inspectContent });
}