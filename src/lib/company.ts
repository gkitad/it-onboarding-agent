// A simulated company directory: users, groups, licenses and hardware.
// Everything the agent does happens against this in-memory copy, never a
// real system. Each run starts from the seed below unless the visitor keeps
// the directory from their previous request.

export type Department = "Finance" | "Sales" | "Engineering" | "HR" | "Operations";

export type User = {
  username: string;
  displayName: string;
  email: string;
  department: Department;
  title: string;
  manager: string | null;
  status: "Active" | "Disabled" | "Pending start";
  startDate?: string;
  groups: string[];
  licenses: string[];
  assets: string[];
};

export type Group = { name: string; description: string; sensitive: boolean };

export type LicensePool = { sku: string; name: string; total: number; assigned: number };

export type InventoryItem = { model: string; kind: "Laptop" | "Monitor" | "Headset"; inStock: number };

export type Task = { id: string; title: string; team: string; due: string; details: string };

export type EmailDraft = { id: string; to: string; subject: string; body: string };

export type HardwareOrder = {
  id: string;
  username: string;
  model: string;
  status: "Reserved from stock" | "Backordered";
};

export type AuditEntry = {
  at: string;
  actor: "Agent" | "Approver";
  action: string;
  target: string;
  result: "Success" | "Failed" | "Denied" | "Approved";
  detail: string;
};

export type Directory = {
  company: string;
  domain: string;
  users: User[];
  groups: Group[];
  licenses: LicensePool[];
  inventory: InventoryItem[];
  orders: HardwareOrder[];
  tasks: Task[];
  drafts: EmailDraft[];
  audit: AuditEntry[];
  counter: number;
};

export type Policy = {
  department: Department;
  groups: string[];
  license: string;
  laptop: string;
  extras: string[];
  notes: string;
};

export const POLICIES: Policy[] = [
  {
    department: "Finance",
    groups: ["All-Staff", "VPN-Users", "Finance-Team", "Finance-Share"],
    license: "M365-E3",
    laptop: "Dell Latitude 7450",
    extras: ["24\" monitor"],
    notes: "Finance-Share holds payroll and close files; access needs manager approval.",
  },
  {
    department: "Sales",
    groups: ["All-Staff", "VPN-Users", "Sales-Team", "CRM-Users"],
    license: "M365-E3",
    laptop: "Dell Latitude 7450",
    extras: ["Headset"],
    notes: "CRM licenses are provisioned by the CRM admin after the account exists.",
  },
  {
    department: "Engineering",
    groups: ["All-Staff", "VPN-Users", "Engineering-Team", "GitHub-Org"],
    license: "M365-E3",
    laptop: "MacBook Pro 14",
    extras: ["24\" monitor", "24\" monitor"],
    notes: "Production access is never granted at onboarding; it needs a separate request.",
  },
  {
    department: "HR",
    groups: ["All-Staff", "VPN-Users", "HR-Team", "HR-Records"],
    license: "M365-E5",
    laptop: "Dell Latitude 7450",
    extras: [],
    notes: "HR-Records contains employee files; access needs manager approval.",
  },
  {
    department: "Operations",
    groups: ["All-Staff", "Operations-Team"],
    license: "M365-F3",
    laptop: "Dell Latitude 5450",
    extras: [],
    notes: "Floor staff don't get VPN by default.",
  },
];

export function seedDirectory(): Directory {
  return {
    company: "Lakeside Logistics",
    domain: "lakeside-logistics.example",
    users: [
      user("dana.whitfield", "Dana Whitfield", "Finance", "Finance Manager", null, ["All-Staff", "VPN-Users", "Finance-Team", "Finance-Share"], ["M365-E3"], ["LT-1042"]),
      user("maria.lopez", "Maria Lopez", "Sales", "Account Executive", "james.okafor", ["All-Staff", "VPN-Users", "Sales-Team", "CRM-Users"], ["M365-E3"], ["LT-1077"]),
      user("james.okafor", "James Okafor", "Sales", "Sales Director", null, ["All-Staff", "VPN-Users", "Sales-Team", "CRM-Users"], ["M365-E3"], ["LT-1003"]),
      user("priya.raman", "Priya Raman", "Engineering", "Engineering Manager", null, ["All-Staff", "VPN-Users", "Engineering-Team", "GitHub-Org"], ["M365-E3"], ["MB-2011", "MN-3301"]),
      user("tom.becker", "Tom Becker", "Engineering", "Software Engineer", "priya.raman", ["All-Staff", "VPN-Users", "Engineering-Team", "GitHub-Org", "Prod-Access"], ["M365-E3"], ["MB-2019", "MN-3302", "MN-3303"]),
      user("alicia.grant", "Alicia Grant", "HR", "HR Director", null, ["All-Staff", "VPN-Users", "HR-Team", "HR-Records"], ["M365-E5"], ["LT-1050"]),
      user("luis.ortega", "Luis Ortega", "Operations", "Warehouse Supervisor", null, ["All-Staff", "Operations-Team"], ["M365-F3"], ["LT-5511"]),
    ],
    groups: [
      { name: "All-Staff", description: "Company-wide distribution list", sensitive: false },
      { name: "VPN-Users", description: "Remote access through the corporate VPN", sensitive: false },
      { name: "Finance-Team", description: "Finance Teams channel and calendar", sensitive: false },
      { name: "Finance-Share", description: "Payroll, close and banking files", sensitive: true },
      { name: "Sales-Team", description: "Sales Teams channel and calendar", sensitive: false },
      { name: "CRM-Users", description: "Sign-in to the CRM", sensitive: false },
      { name: "Engineering-Team", description: "Engineering Teams channel", sensitive: false },
      { name: "GitHub-Org", description: "Membership in the company GitHub organization", sensitive: false },
      { name: "Prod-Access", description: "Production servers and databases", sensitive: true },
      { name: "HR-Team", description: "HR Teams channel", sensitive: false },
      { name: "HR-Records", description: "Employee records and investigations", sensitive: true },
      { name: "Operations-Team", description: "Operations Teams channel", sensitive: false },
      { name: "Domain-Admins", description: "Full control of the directory", sensitive: true },
    ],
    licenses: [
      { sku: "M365-E3", name: "Microsoft 365 E3", total: 10, assigned: 8 },
      { sku: "M365-E5", name: "Microsoft 365 E5", total: 1, assigned: 1 },
      { sku: "M365-F3", name: "Microsoft 365 F3", total: 6, assigned: 1 },
    ],
    inventory: [
      { model: "Dell Latitude 7450", kind: "Laptop", inStock: 3 },
      { model: "Dell Latitude 5450", kind: "Laptop", inStock: 4 },
      { model: "MacBook Pro 14", kind: "Laptop", inStock: 0 },
      { model: "24\" monitor", kind: "Monitor", inStock: 5 },
      { model: "Headset", kind: "Headset", inStock: 6 },
    ],
    orders: [],
    tasks: [],
    drafts: [],
    audit: [],
    counter: 100,
  };
}

function user(
  username: string,
  displayName: string,
  department: Department,
  title: string,
  manager: string | null,
  groups: string[],
  licenses: string[],
  assets: string[],
): User {
  return {
    username,
    displayName,
    email: `${username}@lakeside-logistics.example`,
    department,
    title,
    manager,
    status: "Active",
    groups,
    licenses,
    assets,
  };
}
