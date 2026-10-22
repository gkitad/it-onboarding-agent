import type Anthropic from "@anthropic-ai/sdk";
import type { RunState } from "./state";

// Scripted stand-in for the model, used only when MOCK_AGENT=1 so the UI can
// be built and tested without an API key. It ignores the request text apart
// from choosing between the onboarding and offboarding script.

type Step = { text?: string; name: string; input: Record<string, unknown> };

function nextMonday(today: string): string {
  const d = new Date(`${today}T12:00:00Z`);
  const add = ((8 - d.getUTCDay()) % 7) || 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

function dayBefore(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 3);
  return d.toISOString().slice(0, 10);
}

function onboarding(today: string): Step[] {
  const start = nextMonday(today);
  return [
    { text: "I'll provision Ana Torres with the Finance package, reserve her hardware and prepare her manager.", name: "get_department_policy", input: { department: "Finance" } },
    { name: "search_directory", input: { query: "Finance Manager" } },
    { name: "create_user", input: { first_name: "Ana", last_name: "Torres", department: "Finance", title: "Financial Analyst", manager_username: "dana.whitfield", start_date: start } },
    { name: "assign_license", input: { username: "ana.torres", sku: "M365-E3" } },
    { name: "add_to_group", input: { username: "ana.torres", group: "All-Staff" } },
    { name: "add_to_group", input: { username: "ana.torres", group: "VPN-Users" } },
    { name: "add_to_group", input: { username: "ana.torres", group: "Finance-Team" } },
    { name: "add_to_group", input: { username: "ana.torres", group: "Finance-Share" } },
    { name: "request_hardware", input: { username: "ana.torres", model: "Dell Latitude 7450" } },
    { name: "request_hardware", input: { username: "ana.torres", model: "24\" monitor" } },
    { name: "create_task", input: { title: "Image and set up laptop for Ana Torres", team: "Desktop Support", due: dayBefore(start), details: "Standard Finance image, Dell Latitude 7450 and 24\" monitor." } },
    { name: "draft_email", input: { to: "dana.whitfield@lakeside-logistics.example", subject: "Ana Torres is set up for Monday", body: `Hi Dana,\n\nAna's account (ana.torres) is ready for ${start}. Her laptop and monitor are reserved and Desktop Support will image them beforehand.\n\nIT` } },
    { name: "submit_summary", input: { summary: `Ana Torres is provisioned for ${start} with the Finance package.`, completed: ["Account ana.torres created", "M365-E3 assigned", "Groups added", "Laptop and monitor reserved", "Imaging task created", "Welcome email drafted"], needs_human: ["Send the welcome email draft to Dana"] } },
  ];
}

function offboarding(today: string): Step[] {
  return [
    { text: "I'll find Tom Becker, disable his account, revoke his access and schedule his equipment return.", name: "search_directory", input: { query: "Tom Becker" } },
    { name: "disable_user", input: { username: "tom.becker", reason: "Employee departure" } },
    { name: "remove_from_all_groups", input: { username: "tom.becker" } },
    { name: "remove_license", input: { username: "tom.becker", sku: "M365-E3" } },
    { name: "schedule_hardware_return", input: { username: "tom.becker", due: today } },
    { name: "draft_email", input: { to: "priya.raman@lakeside-logistics.example", subject: "Tom Becker offboarding", body: "Hi Priya,\n\nTom's account is disabled. Let me know who should get access to his mailbox and files.\n\nIT" } },
    { name: "submit_summary", input: { summary: "Tom Becker is offboarded.", completed: ["Account disabled", "Groups removed", "License returned", "Equipment pickup scheduled"], needs_human: ["Decide mailbox and file access with Priya"] } },
  ];
}

export async function mockModel(state: RunState): Promise<Pick<Anthropic.Message, "content" | "stop_reason">> {
  await new Promise((r) => setTimeout(r, 250));
  const off = /offboard|leaving|last day|terminat|quit|resign/i.test(state.request);
  const script = off ? offboarding(state.today) : onboarding(state.today);
  const index = state.messages.filter((m) => m.role === "assistant").length;
  const step = script[Math.min(index, script.length - 1)];
  const content: Anthropic.ContentBlock[] = [];
  if (step.text) content.push({ type: "text", text: step.text, citations: null } as Anthropic.TextBlock);
  content.push({ type: "tool_use", id: `toolu_mock_${index}`, name: step.name, input: step.input } as Anthropic.ToolUseBlock);
  return { content, stop_reason: "tool_use" };
}
