// src/Women/Local/Pages/Payments/hooks/addParentToGroup.js
import { apiRequest } from "../../../../../Services/API";
import type { ApiGroup } from "../../../../../types/api";

export async function addParentToGroup(email: string) {
  if (!email) return;

  try {
    const groups = await apiRequest<ApiGroup[]>("/api/groups");
    const target = groups.find((group) => group.name === "Parents");

    if (!target) {
      await apiRequest("/api/groups", {
        method: "POST",
        json: {
          name: "Parents",
          members: [email],
          createdBy: "system",
        },
      });
      console.log("Created Parents group and added:", email);
      return;
    }

    const members = Array.isArray(target.members) ? target.members : [];
    if (!members.includes(email)) {
      await apiRequest(`/api/groups/${target.id}`, {
        method: "PUT",
        json: {
          members: [...members, email],
        },
      });
      console.log("Added parent to Parents group:", email);
    }
  } catch (err) {
    console.error("Failed to add parent to group:", err);
  }
}

