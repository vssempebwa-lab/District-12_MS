import { type HubRecord } from "@d12/contracts";

export interface EmployeeReportRow {
  id: string;
  name: string;
  tenantId: string;
  department: string;
  present: number;
  late: number;
  absent: number;
  recorded: number;
  approvedLeaveDays: number;
  approvedPayroll: number;
  finalizedRating: string;
  trainingCompleted: number;
}

export function buildHrReport(records: HubRecord[], month: string, tenant = "all") {
  const all = (kind: HubRecord["kind"]) => records.filter((record) => record.kind === kind);
  const employees = all("employees").filter((record) => tenant === "all" || record.data.tenantId === tenant);
  const employeeIds = new Set(employees.map((record) => record.id));
  const forEmployees = (kind: HubRecord["kind"]) => all(kind).filter((record) => employeeIds.has(String(record.data.employeeId)));
  const attendance = forEmployees("attendance").filter((record) => String(record.data.workOn).startsWith(month));
  const leave = forEmployees("leave").filter((record) => String(record.data.startOn).startsWith(month));
  const payroll = all("payroll").filter((record) => record.data.period === month && ["approved", "paid"].includes(String(record.data.status)) && (tenant === "all" || record.data.tenantId === tenant));
  const reviews = forEmployees("performance").filter((record) => record.data.period === month && record.data.status === "finalized");
  const completed = forEmployees("enrolments").filter((record) => record.data.status === "completed" && record.updatedAt.startsWith(month));
  const vacancies = all("vacancies").filter((record) => tenant === "all" || record.data.tenantId === tenant);
  const vacancyIds = new Set(vacancies.map((record) => record.id));
  const applicants = all("applications").filter((record) => vacancyIds.has(String(record.data.vacancyId)) && record.createdAt.startsWith(month));
  const rows: EmployeeReportRow[] = employees.map((employee) => {
    const entries = attendance.filter((record) => record.data.employeeId === employee.id);
    const ratings = reviews.filter((record) => record.data.employeeId === employee.id).map((record) => Number(record.data.rating));
    return {
      id: employee.id, name: String(employee.data.name), tenantId: String(employee.data.tenantId), department: String(employee.data.department),
      present: entries.filter((record) => record.data.status === "present").length,
      late: entries.filter((record) => record.data.status === "late").length,
      absent: entries.filter((record) => record.data.status === "absent").length,
      recorded: entries.length,
      approvedLeaveDays: leave.filter((record) => record.data.employeeId === employee.id && record.data.status === "approved").reduce((sum, record) => sum + Number(record.data.workingDays), 0),
      approvedPayroll: payroll.filter((record) => record.data.employeeId === employee.id).reduce((sum, record) => sum + Number(record.data.net), 0),
      finalizedRating: ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : "—",
      trainingCompleted: completed.filter((record) => record.data.employeeId === employee.id).length,
    };
  });
  return {
    rows,
    profiles: employees.length,
    active: employees.filter((record) => record.data.status === "active").length,
    hires: employees.filter((record) => String(record.data.startOn).startsWith(month)).length,
    attendanceRecorded: attendance.length,
    leaveRequested: leave.filter((record) => record.data.status === "requested").length,
    payrollApproved: payroll.reduce((sum, record) => sum + Number(record.data.net), 0),
    payrollPaid: payroll.filter((record) => record.data.status === "paid").reduce((sum, record) => sum + Number(record.data.net), 0),
    finalizedReviews: reviews.length,
    trainingCompleted: completed.length,
    openVacancies: vacancies.filter((record) => record.data.status === "open").length,
    funnel: ["applied", "shortlisted", "interview", "offered", "hired", "rejected"].map((status) => ({ status, count: applicants.filter((record) => record.data.status === status).length })),
  };
}
export type HrReport = ReturnType<typeof buildHrReport>;
