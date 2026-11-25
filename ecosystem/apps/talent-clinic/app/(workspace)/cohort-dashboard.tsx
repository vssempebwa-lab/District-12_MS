"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Users, Search, Download, RotateCcw, Pencil, Trash2 } from "lucide-react";
import { PageHeader, Card, StatCard, Button, Badge, Input, Select, Modal, Field } from "@d12/ui";
import { formatNumber, formatUgx, shortDate } from "@d12/tenant-workspace";
import type { CustomerRecord, ProjectRecord } from "@d12/contracts";

const CLINICS = ["Computer Skills", "Front Office Operations", "Graphic Design", "Photography", "Telesales", "Affiliate Marketing"];
const DEFAULT_SESSIONS = [
  "Morning Session (8:30 AM - 11:30 AM)",
  "Afternoon Session (2:00 PM - 5:00 PM)",
  "Weekend Intensive",
];
const PAYMENT_STATUSES = ["Free / Waived", "Paid in Full", "Partial Payment", "Pending"] as const;
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

function formatSessionLabel(name: string, timeWindow: string): string {
  const title = name.trim().replace(/\s+/g, " ");
  const window = timeWindow.trim().replace(/\s+/g, " ");
  if (!title) return "";
  if (!window) return title;
  if (/\(.+\)/.test(title)) return title;
  return `${title} (${window})`;
}

function sessionShort(label: string): string {
  return label.split(" (")[0] || label;
}

function addDays(date: string, days: number): string {
  if (!date) return "";
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function progress(cohort: ProjectRecord) {
  const start = new Date(cohort.startDate || cohort.dueOn || "");
  if (Number.isNaN(start.getTime())) return { label: "Not scheduled", pct: 0, daysLeft: 0, week: 0 };
  const end = addDays(start.toISOString().slice(0, 10), 42);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  if (now < start) {
    return { label: "Upcoming", pct: 0, daysLeft: Math.ceil((start.getTime() - now.getTime()) / 86_400_000), week: 0 };
  }
  if (now > endDate) return { label: "Completed", pct: 100, daysLeft: 0, week: 6 };
  const elapsed = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  const week = Math.min(6, Math.floor(elapsed / 7) + 1);
  return {
    label: `Week ${week} of 6`,
    pct: Math.min(100, Math.round((elapsed / 42) * 100)),
    daysLeft: Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000),
    week,
  };
}

function paymentStatus(p: CustomerRecord): PaymentStatus {
  if (p.status === "paid") return "Paid in Full";
  if (p.status === "dormant") return "Free / Waived";
  const fee = Number(p.lifetimeValue ?? 0);
  const paid = Number(p.paidTotal ?? 0);
  if (paid > 0 && paid < fee) return "Partial Payment";
  return "Pending";
}

function balance(p: CustomerRecord): number {
  if (p.status === "paid" || p.status === "dormant") return 0;
  return Math.max(0, Math.round((Number(p.lifetimeValue ?? 0) - Number(p.paidTotal ?? 0)) * 100) / 100);
}

function badgeTone(status: PaymentStatus): "success" | "warning" | "danger" {
  if (status === "Paid in Full" || status === "Free / Waived") return "success";
  if (status === "Partial Payment") return "warning";
  return "danger";
}

function cohortLabel(c: ProjectRecord): string {
  return c.client ? `${c.client} — ${c.name}` : c.name;
}

export interface CohortDashboardProps {
  initialCohorts: ProjectRecord[];
  initialParticipants: CustomerRecord[];
  tenantId: string;
}

export default function CohortDashboard({ initialCohorts, initialParticipants }: CohortDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cohortParam = searchParams.get("cohort");
  const [cohorts, setCohorts] = useState<ProjectRecord[]>(initialCohorts);
  const [participants, setParticipants] = useState<CustomerRecord[]>(initialParticipants);
  const [selected, setSelected] = useState(() =>
    cohortParam && cohortParam !== "all" ? cohortParam : "all",
  );
  const [search, setSearch] = useState("");
  const [filterClinic, setFilterClinic] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterSession, setFilterSession] = useState("");

  const [cohortModal, setCohortModal] = useState(false);
  const [partModal, setPartModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [sessionModal, setSessionModal] = useState(false);
  const [editCohortId, setEditCohortId] = useState<string | null>(null);
  const [editPartId, setEditPartId] = useState<string | null>(null);
  const [payPartId, setPayPartId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [customSessions, setCustomSessions] = useState<string[]>([]);

  // Cohort form
  const [cCode, setCCode] = useState("");
  const [cName, setCName] = useState("");
  const [cStart, setCStart] = useState(new Date().toISOString().slice(0, 10));
  const [cFee, setCFee] = useState(0);
  const [cStatus, setCStatus] = useState("Upcoming");

  // Participant form
  const [pCohort, setPCohort] = useState("");
  const [pRegNo, setPRegNo] = useState("");
  const [pName, setPName] = useState("");
  const [pAddress, setPAddress] = useState("");
  const [pClinic, setPClinic] = useState<string>(CLINICS[0]);
  const [pContact, setPContact] = useState("");
  const [pStart, setPStart] = useState("");
  const [pSession, setPSession] = useState<string>(DEFAULT_SESSIONS[0]);
  const [pStatus, setPStatus] = useState<PaymentStatus>("Pending");
  const [pAmount, setPAmount] = useState(0);

  // Session form
  const [sName, setSName] = useState("");
  const [sTime, setSTime] = useState("");
  const [assignSessionAfterCreate, setAssignSessionAfterCreate] = useState(false);

  const [payAmount, setPayAmount] = useState(0);

  const sessions = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const label of [
      ...DEFAULT_SESSIONS,
      ...customSessions,
      ...participants.map((p) => p.programSession ?? ""),
      ...cohorts.map((c) => c.programSession ?? ""),
    ]) {
      const value = label.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      ordered.push(value);
    }
    return ordered;
  }, [customSessions, participants, cohorts]);

  const selectedCohort = cohorts.find((c) => c.id === selected) ?? null;
  const cohortSubset = useMemo(
    () => (selected === "all" ? participants : participants.filter((p) => p.cohort === selectedCohort?.name)),
    [participants, selected, selectedCohort],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return cohortSubset.filter((p) => {
      if (filterClinic && p.clinic !== filterClinic) return false;
      if (filterPayment && paymentStatus(p) !== filterPayment) return false;
      if (filterSession && p.programSession !== filterSession) return false;
      if (term) {
        const haystack = `${p.registrationNumber ?? ""} ${p.name} ${p.phone ?? ""} ${p.company ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [cohortSubset, filterClinic, filterPayment, filterSession, search]);

  const total = cohortSubset.length;
  const cleared = cohortSubset.filter((p) => ["Paid in Full", "Free / Waived"].includes(paymentStatus(p))).length;
  const collected = cohortSubset.reduce((sum, p) => sum + Number(p.paidTotal ?? 0), 0);
  const outstanding = cohortSubset.reduce((sum, p) => sum + balance(p), 0);
  const paidShown = filtered.reduce((sum, p) => sum + Number(p.paidTotal ?? 0), 0);
  const balanceShown = filtered.reduce((sum, p) => sum + balance(p), 0);

  const clinicCounts: Record<string, number> = Object.fromEntries(CLINICS.map((c) => [c, 0]));
  const sessionCounts: Record<string, number> = Object.fromEntries(sessions.map((s) => [s, 0]));
  cohortSubset.forEach((p) => {
    if (p.clinic && p.clinic in clinicCounts) clinicCounts[p.clinic] += 1;
    const session = (p.programSession ?? "").trim();
    if (!session) return;
    sessionCounts[session] = (sessionCounts[session] ?? 0) + 1;
  });
  const maxClinic = Math.max(1, ...Object.values(clinicCounts));
  const maxSession = Math.max(1, ...Object.values(sessionCounts));
  const sessionBars = Object.entries(sessionCounts).filter(([, count]) => count > 0);

  const filterSummary = [
    selectedCohort ? cohortLabel(selectedCohort) : "All Cohorts",
    filterClinic || "All Clinics",
    filterPayment || "All Payment Statuses",
    filterSession ? sessionShort(filterSession) : "All Sessions",
    search.trim() ? `Search: "${search.trim()}"` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4000);
  }

  useEffect(() => {
    const next = cohortParam && cohortParam !== "all" ? cohortParam : "all";
    setSelected((current) => (current === next ? current : next));
  }, [cohortParam]);

  function selectCohort(id: string) {
    setSelected(id);
    router.replace(id === "all" ? "/" : `/?cohort=${encodeURIComponent(id)}`, { scroll: false });
  }

  function openCohortModal(id: string | null) {
    setEditCohortId(id);
    if (id) {
      const cohort = cohorts.find((c) => c.id === id)!;
      setCCode(cohort.client ?? "");
      setCName(cohort.name);
      setCStart(cohort.startDate || cohort.dueOn || new Date().toISOString().slice(0, 10));
      setCFee(Number(cohort.budget ?? 0));
      setCStatus(
        cohort.status === "planned" ? "Upcoming" : cohort.status === "completed" ? "Completed" : "Active",
      );
    } else {
      setCCode("");
      setCName("");
      setCStart(new Date().toISOString().slice(0, 10));
      setCFee(0);
      setCStatus("Upcoming");
    }
    setCohortModal(true);
  }

  async function saveCohort() {
    if (!cCode.trim() || !cName.trim() || !cStart) {
      showNotice("Enter a cohort code, name and start date.");
      return;
    }
    setBusy(true);
    const payload = {
      name: cName.trim(),
      client: cCode.trim(),
      status: cStatus === "Upcoming" ? "planned" : cStatus === "Completed" ? "completed" : "active",
      budget: cFee,
      spent: 0,
      progress: 0,
      dueOn: "",
      startDate: cStart,
      durationWeeks: 6,
      programSession: "",
      owner: "",
      description: `${cCode.trim()} · ${cName.trim()} · 6 weeks / 42 days`,
    };
    const res = await fetch(editCohortId ? `/api/ops/projects/${editCohortId}` : "/api/ops/projects", {
      method: editCohortId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !body?.record) {
      showNotice(body?.error?.message ?? "Could not save cohort.");
      return;
    }
    const record = body.record as ProjectRecord;
    setCohorts((prev) =>
      editCohortId ? prev.map((c) => (c.id === record.id ? record : c)) : [record, ...prev],
    );
    setCohortModal(false);
    showNotice(editCohortId ? "Cohort updated." : "Cohort created.");
  }

  async function deleteCohort(id: string) {
    const cohort = cohorts.find((c) => c.id === id);
    if (!cohort || !confirm(`Delete ${cohortLabel(cohort)} and all its participants?`)) return;
    setBusy(true);
    const linked = participants.filter((p) => p.cohort === cohort.name);
    for (const p of linked) await fetch(`/api/ops/customers/${p.id}`, { method: "DELETE" });
    const res = await fetch(`/api/ops/projects/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setParticipants((prev) => prev.filter((p) => p.cohort !== cohort.name));
      setCohorts((prev) => prev.filter((c) => c.id !== id));
      if (selected === id) selectCohort("all");
      showNotice("Cohort deleted.");
    } else {
      showNotice("Could not delete cohort.");
    }
  }

  function nextRegNo(cohort: ProjectRecord): string {
    const count = participants.filter((p) => p.cohort === cohort.name).length + 1;
    const raw = (cohort.client || cohort.name).trim();
    const code = raw.toUpperCase().startsWith("MTC-") ? raw : `MTC-${raw}`;
    return `${code}-${String(count).padStart(3, "0")}`;
  }

  function openPartModal(id: string | null) {
    setEditPartId(id);
    if (id) {
      const p = participants.find((x) => x.id === id)!;
      const cohort = cohorts.find((c) => c.name === p.cohort);
      setPCohort(cohort?.id ?? cohorts[0]?.id ?? "");
      setPRegNo(p.registrationNumber ?? "");
      setPName(p.name);
      setPAddress(p.company ?? "");
      setPClinic(CLINICS.includes(p.clinic ?? "") ? p.clinic! : CLINICS[0]);
      setPContact(p.phone ?? "");
      setPStart(p.startDate ?? "");
      const existingSession = (p.programSession ?? "").trim();
      if (existingSession) {
        setCustomSessions((prev) => (prev.includes(existingSession) ? prev : [...prev, existingSession]));
        setPSession(existingSession);
      } else {
        setPSession(sessions[0] ?? "");
      }
      const existingStatus = paymentStatus(p);
      const existingFee = Number(cohort?.budget ?? p.lifetimeValue ?? 0);
      setPStatus(existingStatus);
      setPAmount(
        existingStatus === "Paid in Full"
          ? Math.max(Number(p.paidTotal ?? 0), existingFee)
          : Number(p.paidTotal ?? 0),
      );
    } else {
      const id0 = selected !== "all" ? selected : cohorts[0]?.id ?? "";
      const cohort = cohorts.find((c) => c.id === id0);
      setPCohort(id0);
      setPRegNo(cohort ? nextRegNo(cohort) : "");
      setPName("");
      setPAddress("");
      setPContact("");
      setPStart(cohort?.startDate || cohort?.dueOn || new Date().toISOString().slice(0, 10));
      setPSession(sessions[0] ?? "");
      setPClinic(CLINICS[0]);
      setPStatus("Pending");
      setPAmount(0);
    }
    setPartModal(true);
  }

  function openSessionModal(assignToParticipant = false) {
    setAssignSessionAfterCreate(assignToParticipant);
    setSName("");
    setSTime("");
    setSessionModal(true);
  }

  function saveSession() {
    const label = formatSessionLabel(sName, sTime);
    if (!label) {
      showNotice("Enter a session name.");
      return;
    }
    if (label.length > 120) {
      showNotice("Keep the session name under 120 characters.");
      return;
    }
    setCustomSessions((prev) => (prev.includes(label) ? prev : [...prev, label]));
    if (assignSessionAfterCreate) setPSession(label);
    setSessionModal(false);
    showNotice(assignSessionAfterCreate ? "Session created and selected." : "Session created. Use it when registering participants.");
  }

  async function savePart() {
    if (!pName.trim()) {
      showNotice("Full name is required.");
      return;
    }
    if (!pSession.trim() || pSession === "__new__") {
      showNotice("Choose or create a programme session.");
      return;
    }
    const cohort = cohorts.find((c) => c.id === pCohort);
    if (!cohort) {
      showNotice("Select a cohort.");
      return;
    }
    const existing = editPartId ? participants.find((p) => p.id === editPartId) : null;
    const fee = Number(cohort.budget ?? 0);
    const waived = pStatus === "Free / Waived";
    const amountEntered = Number(pAmount);
    if (!waived && (!Number.isFinite(amountEntered) || amountEntered < 0)) {
      showNotice("Enter a valid amount paid (0 or more).");
      return;
    }
    const targetPaid = waived ? 0 : Math.round(amountEntered * 100) / 100;
    if (fee > 0 && targetPaid > fee) {
      showNotice(`Amount paid can't be more than the cohort fee (UGX ${fee.toLocaleString()}).`);
      return;
    }
    // The amount paid decides the status, so the two can never disagree.
    const effectiveStatus: PaymentStatus = waived
      ? "Free / Waived"
      : targetPaid > 0 && fee > 0 && targetPaid >= fee
        ? "Paid in Full"
        : targetPaid > 0
          ? "Partial Payment"
          : "Pending";

    setBusy(true);
    const today = new Date().toISOString().slice(0, 10);
    const previousPaid = Math.round(Number(existing?.paidTotal ?? 0) * 100) / 100;
    const payload = {
      name: pName.trim(),
      company: pAddress.trim(),
      email: existing?.email ?? "",
      phone: pContact.trim(),
      tier: existing?.tier ?? "standard",
      status: effectiveStatus === "Paid in Full" ? "paid" : waived ? "dormant" : "active",
      owner: existing?.owner ?? "",
      lifetimeValue: waived ? 0 : fee,
      lastOrder: existing?.lastOrder ?? "",
      issueOn: pStart || existing?.issueOn || cohort.startDate || today,
      services: existing?.services ?? [],
      registrationNumber: pRegNo.trim() || nextRegNo(cohort),
      clinic: pClinic,
      programSession: pSession,
      cohort: cohort.name,
      startDate: pStart || cohort.startDate || "",
      // Keep the previous total on create until the payment flow books it.
      // On edit, set the corrected total (extra cash is booked as a sale below).
      paidTotal: editPartId ? targetPaid : previousPaid,
      lastPaymentOn: existing?.lastPaymentOn ?? "",
      lastPaymentBy: existing?.lastPaymentBy ?? "",
      lastPaymentByEmail: existing?.lastPaymentByEmail ?? "",
    };
    const res = await fetch(editPartId ? `/api/ops/customers/${editPartId}` : "/api/ops/customers", {
      method: editPartId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.record) {
      setBusy(false);
      showNotice(body?.error?.message ?? "Could not save participant.");
      return;
    }
    let record = body.record as CustomerRecord;

    // Book any increase through Sales so Fees Collected stays tied to real payments.
    const increase = Math.round((targetPaid - previousPaid) * 100) / 100;
    if (increase > 0 && !waived) {
      const payRes = await fetch(`/api/ops/customers/${record.id}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: increase, paidOn: today }),
      });
      const payBody = await payRes.json().catch(() => null);
      if (!payRes.ok) {
        setBusy(false);
        showNotice(payBody?.error?.message ?? "Participant saved, but the payment could not be recorded.");
        setParticipants((prev) =>
          editPartId ? prev.map((p) => (p.id === record.id ? record : p)) : [record, ...prev],
        );
        return;
      }
      if (payBody?.customer) record = payBody.customer as CustomerRecord;
    }

    setParticipants((prev) =>
      editPartId ? prev.map((p) => (p.id === record.id ? record : p)) : [record, ...prev],
    );
    setBusy(false);
    setPartModal(false);
    showNotice(editPartId ? "Participant updated." : "Participant registered.");
  }

  function openPay(id: string) {
    const p = participants.find((x) => x.id === id);
    if (!p) return;
    setPayPartId(id);
    setPayAmount(balance(p));
    setPayModal(true);
  }

  async function savePay() {
    if (!payPartId || payAmount <= 0) {
      showNotice("Enter an amount above zero.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/ops/customers/${payPartId}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: payAmount, paidOn: new Date().toISOString().slice(0, 10) }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !body?.sale) {
      showNotice(body?.error?.message ?? "Could not record payment.");
      return;
    }
    if (body.customer) {
      const updated = body.customer as CustomerRecord;
      setParticipants((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
    setPayModal(false);
    showNotice(body.settled ? "Payment recorded — balance cleared." : "Payment recorded.");
  }

  async function deletePart(id: string) {
    if (!confirm("Delete this participant?")) return;
    const res = await fetch(`/api/ops/customers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setParticipants((prev) => prev.filter((p) => p.id !== id));
      showNotice("Participant deleted.");
    }
  }

  async function resetDemo() {
    if (!confirm("Reset all demo data to the original cohorts and participants?")) return;
    setBusy(true);
    const res = await fetch("/api/ops/reset-demo", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      window.location.assign("/");
    } else {
      showNotice("Could not reset demo data.");
    }
  }

  return (
    <div className="space-y-4">
      <style>{`
        .tc-print-head { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body * { visibility: hidden !important; }
          .tc-print-area, .tc-print-area * { visibility: visible !important; }
          .tc-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .tc-print-area .tc-overflow { overflow: visible !important; }
          .tc-print-head { display: block !important; margin-bottom: 12px; }
          .tc-no-print { display: none !important; }
        }
      `}</style>

      <PageHeader
        eyebrow="Talent development & training"
        title="Mariz Talent Clinic — Admin & Cohort Tracker"
        description="Community vocational skilling initiative · Kampala, Uganda"
      />

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {notice}
        </div>
      ) : null}

      {/* Cohort switcher and primary actions */}
      <div className="tc-no-print flex flex-wrap items-center gap-2">
        <Select aria-label="Cohort selector" value={selected} onChange={(e) => selectCohort(e.target.value)} className="min-w-[220px]">
          <option value="all">All Cohorts</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>{cohortLabel(c)}</option>
          ))}
        </Select>
        <Button size="sm" onClick={() => openCohortModal(null)} disabled={busy}>
          <Plus className="h-4 w-4" /> New Cohort
        </Button>
        <Button size="sm" variant="secondary" onClick={() => openPartModal(null)} disabled={busy || cohorts.length === 0}>
          <Users className="h-4 w-4" /> Register Participant
        </Button>
        <Button size="sm" variant="secondary" onClick={() => openSessionModal(false)} disabled={busy}>
          <Plus className="h-4 w-4" /> New Session
        </Button>
        <Button size="sm" variant="secondary" onClick={() => window.print()}>
          <Download className="h-4 w-4" /> Export PDF
        </Button>
        <Button size="sm" variant="ghost" onClick={resetDemo} disabled={busy}>
          <RotateCcw className="h-4 w-4" /> Reset Demo Data
        </Button>
        <span className="ml-auto flex items-center gap-3 text-xs">
          <Link href="/projects" className="text-blue-600 hover:underline">Manage cohorts →</Link>
          <Link href="/customers" className="text-blue-600 hover:underline">Manage participants →</Link>
        </span>
      </div>

      {/* 6-week progress banner */}
      <Card className="p-4">
        {selectedCohort ? (() => {
          const pr = progress(selectedCohort);
          const start = selectedCohort.startDate || selectedCohort.dueOn || "";
          return (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{cohortLabel(selectedCohort)}</p>
                  <p className="text-xs text-ink-soft">
                    {shortDate(start)} → {shortDate(addDays(start, 42))} · 6 weeks / 42 days · Fee {formatUgx(Number(selectedCohort.budget ?? 0))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {pr.label}{pr.daysLeft > 0 ? ` · ${pr.daysLeft} days remaining` : ""}
                  </span>
                  <button className="tc-no-print rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Edit cohort" onClick={() => openCohortModal(selectedCohort.id)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button className="tc-no-print rounded p-1 text-rose-500 hover:bg-rose-50" aria-label="Delete cohort" onClick={() => deleteCohort(selectedCohort.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pr.pct}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-6 gap-1">
                {[1, 2, 3, 4, 5, 6].map((w) => (
                  <div
                    key={w}
                    className={`rounded-md px-1 py-1 text-center text-[10px] font-semibold ${
                      w < pr.week
                        ? "bg-emerald-100 text-emerald-700"
                        : w === pr.week
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    Week {w}
                  </div>
                ))}
              </div>
            </div>
          );
        })() : (
          <div>
            <p className="mb-3 text-sm font-semibold text-ink">Cohort progress · {cohorts.length} cohort(s)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {cohorts.map((c) => {
                const pr = progress(c);
                return (
                  <button key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left hover:border-emerald-300" onClick={() => selectCohort(c.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-navy">{cohortLabel(c)}</span>
                      <span className="shrink-0 text-[10px] font-semibold text-emerald-700">{pr.label}</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
                      <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${pr.pct}%` }} />
                    </div>
                    {pr.daysLeft > 0 && pr.label !== "Upcoming" ? (
                      <p className="mt-1 text-[10px] text-ink-soft">{pr.daysLeft} days remaining</p>
                    ) : null}
                  </button>
                );
              })}
              {cohorts.length === 0 ? <p className="text-sm text-ink-soft">No cohorts yet. Create one to get started.</p> : null}
            </div>
          </div>
        )}
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered Participants" value={formatNumber(total)} hint={selectedCohort ? "In selected cohort" : "Across all cohorts"} />
        <StatCard label="Cleared (Free/Paid)" value={formatNumber(cleared)} hint={`${total - cleared} pending/partial`} />
        <StatCard label="Fees Collected" value={formatUgx(collected)} hint="Sum of amount paid" />
        <StatCard label="Outstanding Balance" value={formatUgx(outstanding)} hint="UGX" />
      </div>

      {/* Analytics */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold text-ink">Clinic Track Distribution</p>
          {CLINICS.map((c) => (
            <div key={c} className="mb-2 flex items-center gap-2">
              <span className="w-40 truncate text-xs text-ink-soft">{c}</span>
              <div className="h-2 flex-1 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(clinicCounts[c] / maxClinic) * 100}%` }} />
              </div>
              <span className="w-8 text-right text-xs font-semibold text-navy">{clinicCounts[c]}</span>
            </div>
          ))}
        </Card>
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">Programme Session Distribution</p>
            <button
              type="button"
              className="tc-no-print text-xs font-semibold text-emerald-700 hover:underline"
              onClick={() => openSessionModal(false)}
            >
              + New session
            </button>
          </div>
          {sessionBars.length === 0 ? (
            <p className="text-sm text-ink-soft">No sessions in use yet. Create one, then assign it when registering a participant.</p>
          ) : (
            sessionBars.map(([s, count]) => (
              <div key={s} className="mb-2 flex items-center gap-2">
                <span className="w-40 truncate text-xs text-ink-soft" title={s}>{sessionShort(s)}</span>
                <div className="h-2 flex-1 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(count / maxSession) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-semibold text-navy">{count}</span>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Print-only heading for the filtered roster */}
      <div className="tc-print-head">
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Mariz Talent Clinic — Cohort Roster</h1>
        <p style={{ fontSize: 11, color: "#475569" }}>{filterSummary}</p>
        <p style={{ fontSize: 11, color: "#475569" }}>{filtered.length} participant(s) · Generated {new Date().toLocaleDateString("en-GB")}</p>
      </div>

      {/* Search / filters */}
      <div className="tc-no-print flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, reg. no., contact, or address..." className="pl-9" />
        </div>
        <Select value={filterClinic} onChange={(e) => setFilterClinic(e.target.value)}>
          <option value="">All Clinics</option>
          {CLINICS.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}>
          <option value="">All Payment Statuses</option>
          {PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select value={filterSession} onChange={(e) => setFilterSession(e.target.value)}>
          <option value="">All Sessions</option>
          {sessions.map((s) => <option key={s} value={s}>{sessionShort(s)}</option>)}
        </Select>
      </div>

      {/* Participant roster */}
      <div className="tc-print-area">
        <div className="tc-overflow overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">Reg. No</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">Participant & Contact</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">Address</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">Clinic</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">Session</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">Start Date</th>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">Payment Status</th>
                <th className="px-3 py-2 text-right text-xs font-bold uppercase text-slate-500">Amount paid (UGX)</th>
                <th className="px-3 py-2 text-right text-xs font-bold uppercase text-slate-500">Balance (UGX)</th>
                <th className="tc-no-print px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-500">No participants match your filters.</td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const status = paymentStatus(p);
                  const paid = Number(p.paidTotal ?? 0);
                  const due = balance(p);
                  return (
                    <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-bold text-navy">{p.registrationNumber || "—"}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.phone || p.email || "—"}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">{p.company || "—"}</td>
                      <td className="px-3 py-2 text-xs">{p.clinic || "—"}</td>
                      <td className="px-3 py-2 text-xs" title={p.programSession || undefined}>{sessionShort(p.programSession || "—")}</td>
                      <td className="px-3 py-2 text-xs">{shortDate(p.startDate)}</td>
                      <td className="px-3 py-2"><Badge tone={badgeTone(status)}>{status}</Badge></td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-700">{paid ? paid.toLocaleString() : "0"}</td>
                      <td className="px-3 py-2 text-right font-bold">{due ? due.toLocaleString() : "0"}</td>
                      <td className="tc-no-print px-3 py-2">
                        <div className="flex gap-1">
                          {due > 0 ? (
                            <Button size="sm" onClick={() => openPay(p.id)} disabled={busy}>+ Pay</Button>
                          ) : null}
                          <Button size="sm" variant="secondary" onClick={() => openPartModal(p.id)} disabled={busy}>Edit</Button>
                          <Button size="sm" variant="danger" onClick={() => deletePart(p.id)} disabled={busy}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filtered.length > 0 ? (
              <tfoot className="bg-slate-50">
                <tr>
                  <td colSpan={7} className="px-3 py-2 text-right text-xs font-bold uppercase text-slate-500">
                    {filtered.length === cohortSubset.length ? "Total" : "Total in this list"}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-700">{paidShown.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-bold">{balanceShown.toLocaleString()}</td>
                  <td className="tc-no-print" />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      {/* Modals */}
      <Modal
        open={cohortModal}
        title={editCohortId ? "Edit Cohort" : "New Cohort"}
        onClose={() => setCohortModal(false)}
        footer={<><Button variant="secondary" onClick={() => setCohortModal(false)}>Cancel</Button><Button onClick={saveCohort} disabled={busy}>Save Cohort</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cohort Code"><Input value={cCode} onChange={(e) => setCCode(e.target.value)} placeholder="MTC-03" /></Field>
          <Field label="Cohort Name"><Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Mar/Apr 2027 Intake" /></Field>
          <Field label="Start Date"><Input type="date" value={cStart} onChange={(e) => setCStart(e.target.value)} /></Field>
          <Field label="Registration Fee (UGX)"><Input type="number" min={0} value={cFee} onChange={(e) => setCFee(Number(e.target.value))} /></Field>
          <Field label="Status" className="col-span-2">
            <Select value={cStatus} onChange={(e) => setCStatus(e.target.value)}>
              <option>Upcoming</option><option>Active</option><option>Completed</option>
            </Select>
          </Field>
          <p className="col-span-2 text-xs text-ink-soft">End date is calculated automatically as start date + 42 days (6 weeks).</p>
        </div>
      </Modal>

      <Modal
        open={partModal}
        title={editPartId ? "Edit Participant" : "Register Participant"}
        onClose={() => setPartModal(false)}
        footer={<><Button variant="secondary" onClick={() => setPartModal(false)}>Cancel</Button><Button onClick={savePart} disabled={busy}>Save Participant</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cohort" className="col-span-2">
            <Select value={pCohort} onChange={(e) => {
              setPCohort(e.target.value);
              if (!editPartId) {
                const cohort = cohorts.find((c) => c.id === e.target.value);
                if (cohort) {
                  setPRegNo(nextRegNo(cohort));
                  setPStart(cohort.startDate || cohort.dueOn || new Date().toISOString().slice(0, 10));
                }
              }
            }}>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{cohortLabel(c)}</option>)}
            </Select>
          </Field>
          <Field label="Registration Number"><Input value={pRegNo} onChange={(e) => setPRegNo(e.target.value)} placeholder="Auto-generated" /></Field>
          <Field label="Full Name"><Input value={pName} onChange={(e) => setPName(e.target.value)} /></Field>
          <Field label="Address"><Input value={pAddress} onChange={(e) => setPAddress(e.target.value)} /></Field>
          <Field label="Contact"><Input value={pContact} onChange={(e) => setPContact(e.target.value)} /></Field>
          <Field label="Clinic (Track)">
            <Select value={pClinic} onChange={(e) => setPClinic(e.target.value)}>
              {CLINICS.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Start Date"><Input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} /></Field>
          <Field label="Programme Session" className="col-span-2">
            <div className="flex gap-2">
              <Select
                value={pSession}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    openSessionModal(true);
                    return;
                  }
                  setPSession(e.target.value);
                }}
                className="flex-1"
              >
                {sessions.length === 0 ? <option value="">No sessions yet</option> : null}
                {sessions.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="__new__">+ Create new session…</option>
              </Select>
            </div>
            <p className="mt-1 text-[11px] text-ink-soft">Course masters can add any session name and time window.</p>
          </Field>
          <Field label="Payment Status">
            <Select
              value={pStatus}
              onChange={(e) => {
                const next = e.target.value as PaymentStatus;
                setPStatus(next);
                const cohort = cohorts.find((c) => c.id === pCohort);
                const fee = Number(cohort?.budget ?? 0);
                if (next === "Paid in Full") setPAmount(fee);
                if (next === "Pending" || next === "Free / Waived") setPAmount(0);
              }}
            >
              {PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          {pStatus === "Free / Waived" ? (
            <Field label="Amount Paid (UGX)">
              <Input type="number" value={0} disabled />
            </Field>
          ) : (
            <Field label="Amount Paid (UGX)">
              <Input
                type="number"
                min={0}
                step="any"
                value={Number.isNaN(pAmount) ? "" : pAmount}
                onChange={(e) => {
                  const next = e.target.value === "" ? 0 : Number(e.target.value);
                  setPAmount(next);
                  const fee = Number(cohorts.find((c) => c.id === pCohort)?.budget ?? 0);
                  if (!Number.isFinite(next) || next <= 0) setPStatus("Pending");
                  else if (fee > 0 && next >= fee) setPStatus("Paid in Full");
                  else setPStatus("Partial Payment");
                }}
              />
              <p className="mt-1 text-[11px] text-ink-soft">
                {(() => {
                  const fee = Number(cohorts.find((c) => c.id === pCohort)?.budget ?? 0);
                  if (!fee) return "Total paid so far. The payment status updates to match.";
                  const left = Math.max(0, fee - (Number(pAmount) || 0));
                  return `Fee UGX ${fee.toLocaleString()} · balance UGX ${left.toLocaleString()}. Status updates to match.`;
                })()}
              </p>
            </Field>
          )}
        </div>
      </Modal>

      <Modal
        open={payModal}
        title="Record Payment"
        onClose={() => setPayModal(false)}
        footer={<><Button variant="secondary" onClick={() => setPayModal(false)}>Cancel</Button><Button onClick={savePay} disabled={busy}>Record</Button></>}
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            {participants.find((p) => p.id === payPartId)?.name} · Outstanding {formatUgx(participants.find((p) => p.id === payPartId) ? balance(participants.find((p) => p.id === payPartId)!) : 0)}
          </p>
          <Field label="Amount (UGX)"><Input type="number" min={1} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} /></Field>
        </div>
      </Modal>

      <Modal
        open={sessionModal}
        title="New Programme Session"
        onClose={() => setSessionModal(false)}
        footer={<><Button variant="secondary" onClick={() => setSessionModal(false)}>Cancel</Button><Button onClick={saveSession}>Save Session</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Session name" className="col-span-2">
            <Input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="e.g. Evening Session" />
          </Field>
          <Field label="Time window (optional)" className="col-span-2">
            <Input value={sTime} onChange={(e) => setSTime(e.target.value)} placeholder="e.g. 5:00 PM - 8:00 PM" />
          </Field>
          <p className="col-span-2 text-xs text-ink-soft">
            Saved as {formatSessionLabel(sName || "Session name", sTime) || "…"}. Anyone registering participants can use this session afterwards.
          </p>
        </div>
      </Modal>
    </div>
  );
}
