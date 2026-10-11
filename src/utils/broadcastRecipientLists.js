export function emptyListForm(businessId = "") {
  return {
    business_id: businessId,
    name: "",
    description: "",
    members: [],
  };
}

export function filterMembersBySearch(members, search) {
  const q = String(search || "").trim().toLowerCase();
  if (!q) return members || [];
  return (members || []).filter((m) => {
    const hay = [m.name, m.email, m.whatsappNumber]
      .map((v) => String(v || "").toLowerCase())
      .join(" ");
    return hay.includes(q);
  });
}
