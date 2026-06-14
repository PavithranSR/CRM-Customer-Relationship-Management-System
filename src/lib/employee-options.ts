export const DEFAULT_EMPLOYEE_DEPARTMENTS = [
  "Administration",
  "Engineering",
  "Design",
  "Sales",
  "Marketing",
  "Finance",
  "Human Resources",
  "Operations",
  "Support",
];

export const DEFAULT_POSITIONS_BY_DEPARTMENT: Record<string, string[]> = {
  Administration: ["Office Administrator", "Executive Assistant", "Receptionist"],
  Engineering: ["Software Engineer", "Senior Software Engineer", "Tech Lead", "QA Engineer"],
  Design: ["UI Designer", "UX Designer", "Product Designer", "Graphic Designer"],
  Sales: ["Sales Executive", "Account Manager", "Sales Manager"],
  Marketing: ["Marketing Executive", "SEO Specialist", "Content Strategist"],
  Finance: ["Accountant", "Financial Analyst", "Finance Manager"],
  "Human Resources": ["HR Executive", "Talent Acquisition Specialist", "HR Manager"],
  Operations: ["Operations Executive", "Operations Manager", "Project Coordinator"],
  Support: ["Support Executive", "Customer Success Associate", "Support Lead"],
};
