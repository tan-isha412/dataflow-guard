import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createDestination } from "../../api/endpoints/destinations.js";

export function DestinationForm() {
  const [form, setForm] = useState({ name: "", type: "EXTERNAL_API", baseUrl: "" });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createDestination,
    // Tells TanStack Query "the destinations list is now stale, go
    // refetch it" — this is why DestinationsPage updates automatically
    // without you writing any manual refresh logic.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["destinations"] })
  });

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    mutation.mutate(form);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Destination name" value={form.name} onChange={handleChange} required />
      <select name="type" value={form.type} onChange={handleChange}>
        <option value="EXTERNAL_API">External API</option>
        <option value="EXTERNAL_AI">External AI</option>
        <option value="WEBHOOK">Webhook</option>
      </select>
      <input name="baseUrl" placeholder="Base URL" value={form.baseUrl} onChange={handleChange} />
      <button type="submit" disabled={mutation.isPending}>Add destination</button>
    </form>
  );
}