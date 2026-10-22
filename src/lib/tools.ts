import type Anthropic from "@anthropic-ai/sdk";
import {
  POLICIES,
  type AuditEntry,
  type Department,
  type Directory,
  type User,
} from "./company";

// Tools the agent can call. Each one runs against the simulated directory.
// Approval rules are enforced here in code, not left to the model: a tool
// that touches sensitive access pauses the run until a person approves it.

export const tools: Anthropic.Tool[] = [
  {
    name: "get_department_policy",
    description:
      "Get the standard access package for a department: default groups, license, laptop model, extra hardware and notes. Call this before provisioning anyone.",
    input_schema: {
      type: "object",
      properties: {
        department: { type: "string", enum: ["Finance", "Sales", "Engineering", "HR", "Operations"] },
      },
      required: ["department"],
    },
  },
  {
    name: "search_directory",
    description:
      "Search users by name, username, title or department. Use it to find managers, check for name collisions and look up people being offboarded.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "create_user",
    description:
      "Create a new user account. The username follows the firstname.lastname convention; if it's taken a number is added. A temporary password is generated and delivered to the manager out of band.",
    input_schema: {
      type: "object",
      properties: {
        first_name: { type: "string" },
        last_name: { type: "string" },
        department: { type: "string", enum: ["Finance", "Sales", "Engineering", "HR", "Operations"] },
        title: { type: "string" },
        manager_username: { type: "string", description: "Username of the manager, from search_directory." },
        start_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["first_name", "last_name", "department", "title", "manager_username", "start_date"],
    },
  },
  {
    name: "assign_license",
    description: "Assign a Microsoft 365 license (M365-E3, M365-E5 or M365-F3). Fails if none are available.",
    input_schema: {
      type: "object",
      properties: { username: { type: "string" }, sku: { type: "string", enum: ["M365-E3", "M365-E5", "M365-F3"] } },
      required: ["username", "sku"],
    },
  },
  {
    name: "add_to_group",
    description:
      "Add a user to a security or distribution group. Sensitive groups pause for a person's approval automatically; you don't need to ask first.",
    input_schema: {
      type: "object",
      properties: { username: { type: "string" }, group: { type: "string" } },
      required: ["username", "group"],
    },
  },
  {
    name: "request_hardware",
    description:
      "Reserve a laptop, monitor or headset for a user. Reserves from stock when available, otherwise places a backorder.",
    input_schema: {
      type: "object",
      properties: { username: { type: "string" }, model: { type: "string" } },
      required: ["username", "model"],
    },
  },
  {
    name: "create_task",
    description:
      "Create a task for a human team, for work the agent can't do itself: imaging a laptop, desk setup, buying licenses, CRM setup, collecting equipment.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        team: { type: "string", enum: ["Service Desk", "Desktop Support", "Procurement", "CRM Admin", "Facilities", "Manager"] },
        due: { type: "string", description: "YYYY-MM-DD" },
        details: { type: "string" },
      },
      required: ["title", "team", "due", "details"],
    },
  },
  {
    name: "draft_email",
    description:
      "Save an email draft for a person to review and send. The agent never sends email itself.",
    input_schema: {
      type: "object",
      properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "disable_user",
    description:
      "Disable a user's sign-in for offboarding. Always pauses for a person's approval automatically.",
    input_schema: {
      type: "object",
      properties: { username: { type: "string" }, reason: { type: "string" } },
      required: ["username", "reason"],
    },
  },
  {
    name: "remove_from_all_groups",
    description: "Remove a disabled user from every group except All-Staff archives. Returns the groups removed.",
    input_schema: {
      type: "object",
      properties: { username: { type: "string" } },
      required: ["username"],
    },
  },
  {
    name: "remove_license",
    description: "Remove a license from a user and return it to the pool.",
    input_schema: {
      type: "object",
      properties: { username: { type: "string" }, sku: { type: "string" } },
      required: ["username", "sku"],
    },
  },
  {
    name: "schedule_hardware_return",
    description: "Create a pickup task for every asset assigned to a user and list the asset tags.",
    input_schema: {
      type: "object",
      properties: { username: { type: "string" }, due: { type: "string", description: "YYYY-MM-DD" } },
      required: ["username", "due"],
    },
  },
  {
    name: "submit_summary",
    description:
      "Finish the request. Call this once, last, with a short summary, what was completed and what still needs a person.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Two or three sentences for the requester." },
        completed: { type: "array", items: { type: "string" } },
        needs_human: { type: "array", items: { type: "string" } },
      },
      required: ["summary", "completed", "needs_human"],
    },
  },
];

export const TOOL_LABELS: Record<string, string> = {
  get_department_policy: "Read department policy",
  search_directory: "Search directory",
  create_user: "Create account",
  assign_license: "Assign license",
  add_to_group: "Add to group",
  request_hardware: "Request hardware",
  create_task: "Create task",
  draft_email: "Draft email",
  disable_user: "Disable account",
  remove_from_all_groups: "Remove from groups",
  remove_license: "Remove license",
  schedule_hardware_return: "Schedule hardware return",
  submit_summary: "Submit summary",
};

type Input = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Returns why a call needs approval, or null if it can run straight away. */
export function approvalReason(name: string, input: Input, dir: Directory): string | null {
  if (name === "disable_user") {
    const u = findUser(dir, str(input.username));
    if (!u || u.status === "Disabled") return null; // the tool itself reports the problem
    return `Disabling ${u.displayName} (${u.username}) signs them out everywhere and blocks all access.`;
  }
  if (name === "add_to_group") {
    const group = dir.groups.find((g) => g.name.toLowerCase() === str(input.group).toLowerCase());
    if (group?.sensitive && !["Domain-Admins", "Prod-Access"].includes(group.name)) {
      return `${group.name} is a sensitive group: ${group.description.toLowerCase()}.`;
    }
  }
  return null;
}

export type ToolOutcome = { ok: boolean; result: unknown; summary: string };

function findUser(dir: Directory, username: string): User | undefined {
  const u = username.toLowerCase();
  return dir.users.find((x) => x.username === u);
}

function nextId(dir: Directory, prefix: string): string {
  dir.counter += 1;
  return `${prefix}-${dir.counter}`;
}

export function audit(dir: Directory, entry: Omit<AuditEntry, "at">) {
  dir.audit.push({ at: new Date().toISOString(), ...entry });
}

function fail(dir: Directory, action: string, target: string, message: string): ToolOutcome {
  audit(dir, { actor: "Agent", action, target, result: "Failed", detail: message });
  return { ok: false, result: { error: message }, summary: message };
}

/** Runs a tool against the directory (mutating it) and records it in the audit log. */
export function runTool(name: string, input: Input, dir: Directory): ToolOutcome {
  const label = TOOL_LABELS[name] ?? name;
  const ok = (target: string, summary: string, result: unknown): ToolOutcome => {
    audit(dir, { actor: "Agent", action: label, target, result: "Success", detail: summary });
    return { ok: true, result, summary };
  };

  switch (name) {
    case "get_department_policy": {
      const policy = POLICIES.find((p) => p.department === str(input.department));
      if (!policy) return { ok: false, result: { error: "Unknown department." }, summary: "Unknown department" };
      return { ok: true, result: policy, summary: `${policy.department}: ${policy.groups.length} groups, ${policy.license}, ${policy.laptop}` };
    }

    case "search_directory": {
      const q = str(input.query).toLowerCase();
      const words = q.split(/\s+/).filter(Boolean);
      const matches = dir.users.filter((u) => {
        const hay = `${u.username} ${u.displayName} ${u.title} ${u.department}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      });
      return {
        ok: true,
        result: matches.map((u) => ({
          username: u.username,
          displayName: u.displayName,
          title: u.title,
          department: u.department,
          status: u.status,
          manager: u.manager,
        })),
        summary: matches.length ? `${matches.length} match${matches.length > 1 ? "es" : ""}: ${matches.map((m) => m.username).join(", ")}` : "No matches",
      };
    }

    case "create_user": {
      const first = str(input.first_name);
      const last = str(input.last_name);
      const department = str(input.department) as Department;
      const manager = str(input.manager_username).toLowerCase();
      if (!first || !last) return fail(dir, label, "-", "First and last name are required.");
      if (!POLICIES.some((p) => p.department === department)) return fail(dir, label, `${first} ${last}`, "Unknown department.");
      if (!findUser(dir, manager)) return fail(dir, label, `${first} ${last}`, `Manager ${manager} not found. Search the directory first.`);
      const base = `${first}.${last}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z.]/g, "");
      let username = base;
      let n = 2;
      while (findUser(dir, username)) username = `${base}${n++}`;
      const created: User = {
        username,
        displayName: `${first} ${last}`,
        email: `${username}@${dir.domain}`,
        department,
        title: str(input.title),
        manager,
        status: "Pending start",
        startDate: str(input.start_date),
        groups: [],
        licenses: [],
        assets: [],
      };
      dir.users.push(created);
      const note = username !== base ? ` (${base} was taken)` : "";
      return ok(username, `Created ${username}${note}`, {
        username,
        email: created.email,
        status: created.status,
        temporaryPassword: "Generated and sent to the manager through the secure channel.",
      });
    }

    case "assign_license": {
      const u = findUser(dir, str(input.username));
      const sku = str(input.sku);
      if (!u) return fail(dir, label, str(input.username), "User not found.");
      const pool = dir.licenses.find((l) => l.sku === sku);
      if (!pool) return fail(dir, label, u.username, `Unknown license ${sku}.`);
      if (u.licenses.includes(sku)) return ok(u.username, `${sku} already assigned`, { alreadyAssigned: true });
      if (pool.assigned >= pool.total) {
        return fail(dir, label, u.username, `No ${sku} licenses available (${pool.assigned}/${pool.total} in use). Procurement must buy more.`);
      }
      pool.assigned += 1;
      u.licenses.push(sku);
      return ok(u.username, `Assigned ${sku}`, { sku, remaining: pool.total - pool.assigned });
    }

    case "add_to_group": {
      const u = findUser(dir, str(input.username));
      if (!u) return fail(dir, label, str(input.username), "User not found.");
      const group = dir.groups.find((g) => g.name.toLowerCase() === str(input.group).toLowerCase());
      if (!group) return fail(dir, label, u.username, `Group ${str(input.group)} doesn't exist.`);
      if (group.name === "Domain-Admins") {
        return fail(dir, label, u.username, "Domain-Admins can't be granted through onboarding. It requires a privileged access request reviewed by Security.");
      }
      if (group.name === "Prod-Access") {
        return fail(dir, label, u.username, "Prod-Access is never granted at onboarding. The manager must file a separate access request.");
      }
      if (u.status === "Disabled") return fail(dir, label, u.username, "Account is disabled.");
      if (u.groups.includes(group.name)) return ok(u.username, `Already in ${group.name}`, { alreadyMember: true });
      u.groups.push(group.name);
      return ok(u.username, `Added to ${group.name}`, { group: group.name });
    }

    case "request_hardware": {
      const u = findUser(dir, str(input.username));
      if (!u) return fail(dir, label, str(input.username), "User not found.");
      const item = dir.inventory.find((i) => i.model.toLowerCase() === str(input.model).toLowerCase());
      if (!item) return fail(dir, label, u.username, `Unknown model ${str(input.model)}. Available: ${dir.inventory.map((i) => i.model).join(", ")}.`);
      const id = nextId(dir, "ORD");
      if (item.inStock > 0) {
        item.inStock -= 1;
        const prefix = item.kind === "Laptop" ? (item.model.startsWith("MacBook") ? "MB" : "LT") : item.kind === "Monitor" ? "MN" : "HS";
        const tag = nextId(dir, prefix);
        u.assets.push(tag);
        dir.orders.push({ id, username: u.username, model: item.model, status: "Reserved from stock" });
        return ok(u.username, `Reserved ${item.model} (${tag})`, { orderId: id, assetTag: tag, status: "Reserved from stock" });
      }
      dir.orders.push({ id, username: u.username, model: item.model, status: "Backordered" });
      audit(dir, { actor: "Agent", action: label, target: u.username, result: "Success", detail: `${item.model} backordered (${id})` });
      return { ok: true, result: { orderId: id, status: "Backordered", note: "None in stock. Procurement has the order; expect 5-7 business days." }, summary: `${item.model} backordered` };
    }

    case "create_task": {
      const id = nextId(dir, "TASK");
      const task = { id, title: str(input.title), team: str(input.team), due: str(input.due), details: str(input.details) };
      dir.tasks.push(task);
      return ok(task.team, `${id}: ${task.title}`, { taskId: id });
    }

    case "draft_email": {
      const id = nextId(dir, "DRAFT");
      dir.drafts.push({ id, to: str(input.to), subject: str(input.subject), body: str(input.body) });
      return ok(str(input.to), `Draft saved: ${str(input.subject)}`, { draftId: id, sent: false });
    }

    case "disable_user": {
      const u = findUser(dir, str(input.username));
      if (!u) return fail(dir, label, str(input.username), "User not found.");
      if (u.status === "Disabled") return ok(u.username, "Already disabled", { alreadyDisabled: true });
      u.status = "Disabled";
      return ok(u.username, `Disabled sign-in: ${str(input.reason)}`, { status: "Disabled", sessionsRevoked: true });
    }

    case "remove_from_all_groups": {
      const u = findUser(dir, str(input.username));
      if (!u) return fail(dir, label, str(input.username), "User not found.");
      if (u.status !== "Disabled") return fail(dir, label, u.username, "Disable the account before removing its access.");
      const removed = [...u.groups];
      u.groups = [];
      return ok(u.username, removed.length ? `Removed from ${removed.join(", ")}` : "No groups to remove", { removed });
    }

    case "remove_license": {
      const u = findUser(dir, str(input.username));
      const sku = str(input.sku);
      if (!u) return fail(dir, label, str(input.username), "User not found.");
      if (!u.licenses.includes(sku)) return fail(dir, label, u.username, `${sku} isn't assigned to ${u.username}.`);
      u.licenses = u.licenses.filter((l) => l !== sku);
      const pool = dir.licenses.find((l) => l.sku === sku);
      if (pool) pool.assigned = Math.max(0, pool.assigned - 1);
      return ok(u.username, `Removed ${sku}`, { sku, returnedToPool: true });
    }

    case "schedule_hardware_return": {
      const u = findUser(dir, str(input.username));
      if (!u) return fail(dir, label, str(input.username), "User not found.");
      if (u.assets.length === 0) return ok(u.username, "No assets assigned", { assets: [] });
      const id = nextId(dir, "TASK");
      dir.tasks.push({
        id,
        title: `Collect equipment from ${u.displayName}`,
        team: "Desktop Support",
        due: str(input.due),
        details: `Assets: ${u.assets.join(", ")}. Wipe and return to stock.`,
      });
      return ok(u.username, `Pickup scheduled for ${u.assets.join(", ")}`, { taskId: id, assets: u.assets });
    }

    case "submit_summary":
      return { ok: true, result: { received: true }, summary: "Summary submitted" };

    default:
      return { ok: false, result: { error: `Unknown tool ${name}` }, summary: `Unknown tool ${name}` };
  }
}
