import { useQuery } from "@tanstack/react-query";
import { listPolicies } from "../api/endpoints/policies.js";

export function usePolicies() {
  return useQuery({ queryKey: ["policies"], queryFn: listPolicies });
}