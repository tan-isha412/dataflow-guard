import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPolicy } from "../../api/endpoints/policies.js";
import { PolicyConditionBuilder } from "./PolicyConditionBuilder.jsx";
import { Input } from "../../components/ui/Input.jsx";
import { Button } from "../../components/ui/Button.jsx";

const ACTIONS = ["ALLOW", "REDACT", "BLOCK", "REQUIRE_APPROVAL"];

export function PolicyForm({ onSuccess }) {
  const [name, setName] = useState("");
  const [priority, setPriority] = useState(0);
  const [action, setAction] = useState("BLOCK");
  const [conditions, setConditions] = useState([{ field: "DATA_TYPE", operator: "EQUALS", value: "" }]);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      onSuccess?.();
    }
  });

  function handleSubmit(e) {
    e.preventDefault();
    mutation.mutate({ name, priority: Number(priority), action, conditions });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input label="Policy name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="Priority" type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
      <label>Action</label>
      <select value={action} onChange={(e) => setAction(e.target.value)}>
        {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <PolicyConditionBuilder conditions={conditions} onChange={setConditions} />
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : "Create policy"}
      </Button>
    </form>
  );
}