"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Folder, Plus, Users, Search, Download, RotateCcw } from "lucide-react";
import { PageHeader, Card, StatCard, Button, Badge, TableShell, Th, Td, Input, Select, Modal, Field, Alert } from "@d12/ui";
import { formatNumber, formatUgx, shortDate } from "@d12/tenant-workspace";
import type { CustomerRecord, ProjectRecord } from "@d12/contracts";

const CLINICS = ["Computer Skills", "Front Office Operations", "Graphic Design", "Photography", "Telesales", "Affiliate Marketing"];
const SESSIONS = ["Morning Session (8:30 AM - 11:30 AM)", "Afternoon Session (2:00 PM - 5:00 PM)", "Weekend Intensive"];

function addDays(s: string, d: number) { const x = new Date(s); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); }
function fmtDate(d: string) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
function progress(c: ProjectRecord) {
  const s = new Date(c.startDate || c.dueOn || "");
  const e = new Date(s); e.setDate(e.getDate() + 42);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (now < s) return { label: "Upcoming", pct: 0, daysLeft: Math.ceil((s.getTime() - now.getTime()) / 86400000), week: 0 };
  if (now > e) return { label: "Completed", pct: 100, daysLeft: 0, week: 6 };
  const elapsed = Math.floor((now.getTime() - s.getTime()) / 86400000);
  const week = Math.min(6, Math.floor(elapsed / 7) + 1);
  return { label: `Week ${week} of 6`, pct: Math.min(100, Math.round((elapsed / 42) * 100)), daysLeft: Math.ceil((e.getTime() - now.getTime()) / 86400000), week };
}
function calcBalance(p: CustomerRecord, c: ProjectRecord | undefined) {
  const fee = Number(c?.budget ?? 0) || Number(p.lifetimeValue ?? 0);
  if (p.status === "paid") return 0; // paid
  // use paymentStatus via status field mapping: active/dormant/paid; we store payment in status? 
  return 0;
}

// We'll track payment status in customer.status? The mariz flow uses customer.status "paid"/"active".
// For talent clinic, payment status is stored in `status`? Actually status is active/dormant/paid. 
// We'll treat "paid" as Paid in Full. Other states default to Pending unless partial tracked.
// To keep simple, store paymentStatus in `cohort`? No. Use a dedicated field? We added `clinic`, `cohort`, etc.
// Payment status not in schema. We'll reuse `status`: paid=Paid in Full, active=Pending, dormant=Free/Waived.
// Partial handled via paidTotal < fee.

export interface CohortDashboardProps {
  initialCohorts: ProjectRecord[];
  initialParticipants: CustomerRecord[];
  tenantId: string;
}

export default function CohortDashboard({ initialCohorts, initialParticipants, tenantId }: CohortDashboardProps) {
  const [cohorts, setCohorts] = useState<ProjectRecord[]>(initialCohorts);
  const [participants, setParticipants] = useState<CustomerRecord[]>(initialParticipants);
  const [selected, setSelected] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [filterClinic, setFilterClinic] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterSession, setFilterSession] = useState("");

  const [cohortModal, setCohortModal] = useState(false);
  const [partModal, setPartModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [editCohortId, setEditCohortId] = useState<string | null>(null);
  const [editPartId, setEditPartId] = useState<string | null>(null);
  const [payPartId, setPayPartId] = useState<string | null>(null);

  // form state
  const [cCode, setCCode] = useState("");
  const [cName, setCName] = useState("");
  const [cStart, setCStart] = useState(new Date().toISOString().slice(0, 10));
  const [cFee, setCFee] = useState(0);
  const [cStatus, setCStatus] = useState("Upcoming");
  const [pCohort, setPCohort] = useState("");
  const [pRegNo, setPRegNo] = useState("");
  const [pName, setPName] = useState("");
  const [pAddress, setPAddress] = useState("");
  const [pClinic, setPClinic] = useState(CLINICS[0]);
  const [pContact, setPContact] = useState("");
  const [pStart, setPStart] = useState("");
  const [pSession, setPSession] = useState(SESSIONS[0]);
  const [pStatus, setPStatus] = useState("Pending");
  const [pAmount, setPAmount] = useState(0);
  const [payAmount, setPayAmount] = useState(0);

  const filtered = useMemo(() => {
    const sc = cohorts.find((c) => c.id === selected) ?? null;
    return participants.filter((p) => {
      if (selected !== "all" && p.cohort !== sc?.name) return false;
      if (filterClinic && p.clinic !== filterClinic) return false;
      if (filterPayment) {
        // map
        const ps = p.status === "paid" ? "Paid in Full" : p.status === "dormant" ? "Free / Waived" : "Pending";
        if (ps !== filterPayment) return false;
      }
      if (filterSession && p.programSession !== filterSession) return false;
      if (search.trim()) {
        const hay = `${p.registrationNumber ?? ""} ${p.name} ${p.phone ?? ""} ${p.address ?? ""}`.toLowerCase();
        if (!hay.includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [participants, selected, cohorts, filterClinic, filterPayment, filterSession, search]);

  function openCohortModal(id: string | null) {
    setEditCohortId(id);
    if (id) {
      const c = cohorts.find((x) => x.id === id)!;
      setCCode(c.client ?? "");
      setCName(c.name);
      setCStart(c.startDate || c.dueOn || new Date().toISOString().slice(0, 10));
      setCFee(Number(c.budget ?? 0));
      setCStatus(c.status ?? "Upcoming");
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
    if (!cCode.trim() || !cName.trim() || !cStart) { alert("Fill code, name, start date."); return; }
    const payload = {
      name: cName.trim(),
      client: cCode.trim(),
      status: cStatus.toLowerCase() === "completed" ? "completed" : cStatus.toLowerCase() === "upcoming" ? "planned" : "active",
      budget: cFee,
      spent: 0,
      progress: 0,
      dueOn: "",
      startDate: cStart,
      durationWeeks: 6,
      programSession: "",
      owner: "",
      description: "",
    };
    const url = editCohortId ? `/api/ops/projects/${editCohortId}` : "/api/ops/projects";
    const method = editCohortId ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.record) { alert(body?.error?.message ?? "Could not save cohort."); return; }
    const rec = body.record as ProjectRecord;
    // store code in mark? we used mark field; but project schema has no code field. Use name prefix? 
    // We'll store code in `client` field as fallback for code. Actually let's store code in client.
    rec.client = cCode.trim();
    if (editCohortId) {
      setCohorts((prev) => prev.map((c) => (c.id === rec.id ? rec : c)));
    } else {
      setCohorts((prev) => [rec, ...prev]);
    }
    setCohortModal(false);
  }

  function openPartModal(id: string | null) {
    setEditPartId(id);
    if (id) {
      const p = participants.find((x) => x.id === id)!;
      setPCohort(p.cohort ?? cohorts.find((c) => c.name === p.cohort)?.id ?? (cohorts[0]?.id ?? ""));
      setPRegNo(p.registrationNumber ?? "");
      setPName(p.name);
      setPAddress(p.address ?? "");
      setPClinic(p.clinic || CLINICS[0]);
      setPContact(p.phone ?? "");
      setPStart(p.startDate ?? "");
      setPSession(p.programSession || SESSIONS[0]);
      setPStatus(p.status === "paid" ? "Paid in Full" : p.status === "dormant" ? "Free / Waived" : "Pending");
      setPAmount(Number(p.paidTotal ?? 0));
    } else {
      const cid = selected !== "all" ? selected : (cohorts[0]?.id ?? "");
      setPCohort(cid);
      setPRegNo("");
      setPName("");
      setPAddress("");
      setPContact("");
      const c = cohorts.find((x) => x.id === cid);
      setPStart(c?.startDate || c?.dueOn || new Date().toISOString().slice(0, 10));
      setPSession(SESSIONS[0]);
      setPClinic(CLINICS[0]);
      setPStatus("Pending");
      setPAmount(0);
    }
    setPartModal(true);
  }

  async function savePart() {
    if (!pName.trim()) { alert("Full name is required."); return; }
    const cohort = cohorts.find((c) => c.id === pCohort);
    if (!cohort) { alert("Select a cohort."); return; }
    const regNo = pRegNo.trim() || `MTC-${cohort.client || cohort.name}-${String(participants.filter((p) => p.cohort === cohort.name).length + 1).padStart(3, "0")}`;
    const status = pStatus === "Paid in Full" ? "paid" : pStatus === "Free / Waived" ? "dormant" : "active";
    const payload: any = {
      name: pName.trim(),
      email: "",
      phone: pContact.trim(),
      tier: "standard",
      status,
      owner: "",
      lifetimeValue: Number(cohort.budget ?? 0),
      lastOrder: "",
      issueOn: pStart || cohort.startDate || new Date().toISOString().slice(0, 10),
      services: [],
      registrationNumber: regNo,
      clinic: pClinic,
      programSession: pSession,
      cohort: cohort.name,
      startDate: pStart || cohort.startDate || "",
      paidTotal: pStatus === "Paid in Full" ? Number(cohort.budget ?? 0) : pStatus === "Partial Payment" ? pAmount : 0,
      lastPaymentOn: pStatus === "Paid in Full" ? new Date().toISOString().slice(0, 10) : "",
      lastPaymentBy: "",
      lastPaymentByEmail: "",
    };
    const url = editPartId ? `/api/ops/customers/${editPartId}` : "/api/ops/customers";
    const method = editPartId ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.record) { alert(body?.error?.message ?? "Could not save participant."); return; }
    const rec = body.record as CustomerRecord;
    if (editPartId) setParticipants((prev) => prev.map((p) => (p.id === rec.id ? rec : p)));
    else setParticipants((prev) => [rec, ...prev]);
    setPartModal(false);
  }

  function openPay(id: string) {
    setPayPartId(id);
    setPayAmount(0);
    setPayModal(true);
  }

  async function savePay() {
    if (!payPartId || payAmount <= 0) return;
    const res = await fetch(`/api/ops/customers/${payPartId}/payments`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: payAmount, paidOn: new Date().toISOString().slice(0, 10) }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.sale) { alert(body?.error?.message ?? "Could not record payment."); return; }
    if (body.customer) setParticipants((prev) => prev.map((p) => (p.id === body.customer.id ? body.customer : p)));
    setPayModal(false);
  }

  async function deletePart(id: string) {
    if (!confirm("Delete this participant?")) return;
    const res = await fetch(`/api/ops/customers/${id}`, { method: "DELETE" });
    if (res.ok) setParticipants((prev) => prev.filter((p) => p.id !== id));
  }

  async function deleteCohort(id: string) {
    if (!confirm("Delete this cohort and all its participants?")) return;
    const c = cohorts.find((x) => x.id === id);
    const linked = participants.filter((p) => p.cohort === c?.name);
    for (const p of linked) await fetch(`/api/ops/customers/${p.id}`, { method: "DELETE" });
    const res = await fetch(`/api/ops/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      setParticipants((prev) => prev.filter((p) => p.cohort !== c?.name));
      setCohorts((prev) => prev.filter((x) => x.id !== id));
      if (selected === id) setSelected("all");
    }
  }

  const sc = cohorts.find((c) => c.id === selected) ?? null;
  const selectedCohort = sc;
  const subset = selected === "all" ? participants : participants.filter((p) => p.cohort === sc?.name);
  const total = subset.length;
  const cleared = subset.filter((p) => p.status === "paid" || p.status === "dormant").length;
  const collected = subset.reduce((s, p) => s + Number(p.paidTotal ?? 0), 0);
  const outstanding = subset.reduce((s, p) => s + (Number(p.lifetimeValue ?? 0) - Number(p.paidTotal ?? 0)), 0);

  const clinicCounts: Record<string, number> = {};
  const sessionCounts: Record<string, number> = {};
  CLINICS.forEach((c) => (clinicCounts[c] = 0));
  SESSIONS.forEach((s) => (sessionCounts[s] = 0));
  subset.forEach((p) => { if (clinicCounts[p.clinic] != null) clinicCounts[p.clinic]++; if (sessionCounts[p.programSession] != null) sessionCounts[p.programSession]++; });
  const maxC = Math.max(1, ...Object.values(clinicCounts));
  const maxS = Math.max(1, ...Object.values(sessionCounts));

  function paymentLabel(p: CustomerRecord) {
    if (p.status === "paid") return "Paid in Full";
    if (p.status === "dormant") return "Free / Waived";
    const fee = Number(p.lifetimeValue ?? 0);
    const paid = Number(p.paidTotal ?? 0);
    if (paid > 0 && paid < fee) return "Partial Payment";
    return "Pending";
  }
  const badgeTone = (p: CustomerRecord) => {
    const l = paymentLabel(p);
    if (l === "Paid in Full" || l === "Free / Waived") return "success";
    if (l === "Partial Payment") return "warning";
    return "danger";
  };

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Talent development & training" title="Mariz Talent Clinic — Admin & Cohort Tracker" description="Community vocational skilling initiative · Kampala, Uganda" />

      {/* Cohort selector + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="all">All Cohorts</option>
          {cohorts.map((c) => <option key={c.id} value={c.id}>{c.client || c.name} — {c.name}</option>)}
        </select>
        <Button size="sm" onClick={() => openCohortModal(null)}><Plus className="h-4 w-4" /> New Cohort</Button>
        <Button size="sm" variant="secondary" onClick={() => openPartModal(null)}><Users className="h-4 w-4" /> Register Participant</Button>
        <Link href="/projects" className="text-xs text-blue-600 hover:underline">Manage cohorts →</Link>
        <Link href="/customers" className="text-xs text-blue-600 hover:underline">Manage participants →</Link>
      </div>

      {/* Progress banner */}
      {selectedCohort ? (() => {
        const pr = progress(selectedCohort);
        return (
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">{selectedCohort.client || selectedCohort.name} — {selectedCohort.name}</p>
                <p className="text-xs text-ink-soft">
                  {shortDate(selectedCohort.startDate || selectedCohort.dueOn)} → {shortDate(addDays(selectedCohort.startDate || selectedCohort.dueOn || "", 42))} · {selectedCohort.durationWeeks ?? 6} weeks
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-700">{pr.label}{pr.daysLeft > 0 ? ` · ${pr.daysLeft} days remaining` : ""}</span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pr.pct}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-6 gap-1">
              {[1, 2, 3, 4, 5, 6].map((w) => {
                const week = pr.week;
                const done = w < week; const current = w === week;
                return <div key={w} className={`rounded-md px-1 py-1 text-center text-[10px] font-semibold ${done ? "bg-emerald-100 text-emerald-700" : current ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>Week {w}</div>;
              })}
            </div>
          </Card>
        );
      })() : (
        <Card className="p-4"><p className="text-sm text-ink-soft">Showing participants across {cohorts.length} cohort(s).</p></Card>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered Participants" value={formatNumber(total)} hint="In selected cohort" />
        <StatCard label="Cleared (Free/Paid)" value={formatNumber(cleared)} hint={`${total - cleared} pending/partial`} />
        <StatCard label="Fees Collected" value={formatUgx(collected)} hint="UGX" />
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
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(clinicCounts[c] / maxC) * 100}%` }} />
              </div>
              <span className="w-8 text-right text-xs font-semibold text-navy">{clinicCounts[c]}</span>
            </div>
          ))}
        </Card>
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold text-ink">Programme Session Distribution</p>
          {SESSIONS.map((s) => (
            <div key={s} className="mb-2 flex items-center gap-2">
              <span className="w-40 truncate text-xs text-ink-soft">{s.split(" (")[0]}</span>
              <div className="h-2 flex-1 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(sessionCounts[s] / maxS) * 100}%` }} />
              </div>
              <span className="w-8 text-right text-xs font-semibold text-navy">{sessionCounts[s]}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Search/filter */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, reg. no., contact, or address..." className="pl-9" />
        </div>
        <Select value={filterClinic} onChange={(e) => setFilterClinic(e.target.value)}>
          <option value="">All Clinics</option>
          {CLINICS.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}>
          <option value="">All Payment Statuses</option>
          <option>Free / Waived</option><option>Paid in Full</option><option>Partial Payment</option><option>Pending</option>
        </Select>
        <Select value={filterSession} onChange={(e) => setFilterSession(e.target.value)}>
          <option value="">All Sessions</option>
          {SESSIONS.map((s) => <option key={s} value={s}>{s.split(" (")[0]}</option>)}
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
              <th className="px-3 py-2 text-right text-xs font-bold uppercase text-slate-500">Balance (UGX)</th>
              <th className="px-3 py-2 text-left text-xs font-bold uppercase text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500">No participants match your filters.</td></tr>
            ) : filtered.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-bold text-navy">{p.registrationNumber || "—"}</td>
                <td className="px-3 py-2">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.phone || p.email || "—"}</div>
                </td>
                <td className="px-3 py-2 text-xs">{p.address || "—"}</td>
                <td className="px-3 py-2 text-xs">{p.clinic || "—"}</td>
                <td className="px-3 py-2 text-xs">{(p.programSession || "").split(" (")[0]}</td>
                <td className="px-3 py-2 text-xs">{shortDate(p.startDate)}</td>
                <td className="px-3 py-2">
                  <Badge tone={badgeTone(p)}>{paymentLabel(p)}</Badge>
                </td>
                <td className="px-3 py-2 text-right font-bold">{Number(p.lifetimeValue ?? 0) - Number(p.paidTotal ?? 0) > 0 ? (Number(p.lifetimeValue ?? 0) - Number(p.paidTotal ?? 0)).toLocaleString() : "0"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {Number(p.lifetimeValue ?? 0) - Number(p.paidTotal ?? 0) > 0 ? (
                      <Button size="sm" onClick={() => openPay(p.id)}>+ Pay</Button>
                    ) : null}
                    <Button size="sm" variant="secondary" onClick={() => openPartModal(p.id)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => deletePart(p.id)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <Modal open={cohortModal} title={editCohortId ? "Edit Cohort" : "New Cohort"} onClose={() => setCohortModal(false)}
        footer={<><Button variant="secondary" onClick={() => setCohortModal(false)}>Cancel</Button><Button onClick={saveCohort}>Save Cohort</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cohort Code"><Input value={cCode} onChange={(e) => setCCode(e.target.value)} placeholder="COH-01" /></Field>
          <Field label="Cohort Name"><Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Cohort 01 - Nov/Dec 2026 Intake" /></Field>
          <Field label="Start Date"><Input type="date" value={cStart} onChange={(e) => setCStart(e.target.value)} /></Field>
          <Field label="Registration Fee (UGX)"><Input type="number" value={cFee} onChange={(e) => setCFee(Number(e.target.value))} /></Field>
          <Field label="Status" className="col-span-2">
            <Select value={cStatus} onChange={(e) => setCStatus(e.target.value)}>
              <option>Upcoming</option><option>Active</option><option>Completed</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal open={partModal} title={editPartId ? "Edit Participant" : "Register Participant"} onClose={() => setPartModal(false)}
        footer={<><Button variant="secondary" onClick={() => setPartModal(false)}>Cancel</Button><Button onClick={savePart}>Save Participant</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cohort">
            <Select value={pCohort} onChange={(e) => setPCohort(e.target.value)}>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.client || c.name} — {c.name}</option>)}
            </Select>
          </Field>
          <Field label="Registration Number"><Input value={pRegNo} onChange={(e) => setPRegNo(e.target.value)} placeholder="Auto-generated" /></Field>
          <Field label="Full Name" className="col-span-2"><Input value={pName} onChange={(e) => setPName(e.target.value)} /></Field>
          <Field label="Address"><Input value={pAddress} onChange={(e) => setPAddress(e.target.value)} /></Field>
          <Field label="Clinic (Track)">
            <Select value={pClinic} onChange={(e) => setPClinic(e.target.value)}>
              {CLINICS.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Contact"><Input value={pContact} onChange={(e) => setPContact(e.target.value)} /></Field>
          <Field label="Start Date"><Input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} /></Field>
          <Field label="Programme Session">
            <Select value={pSession} onChange={(e) => setPSession(e.target.value)}>
              {SESSIONS.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Payment Status">
            <Select value={pStatus} onChange={(e) => setPStatus(e.target.value)}>
              <option>Free / Waived</option><option>Paid in Full</option><option>Partial Payment</option><option>Pending</option>
            </Select>
          </Field>
          {pStatus === "Partial Payment" ? (
            <Field label="Amount Paid (UGX)"><Input type="number" value={pAmount} onChange={(e) => setPAmount(Number(e.target.value))} /></Field>
          ) : null}
        </div>
      </Modal>

      <Modal open={payModal} title="Record Payment" onClose={() => setPayModal(false)}
        footer={<><Button variant="secondary" onClick={() => setPayModal(false)}>Cancel</Button><Button onClick={savePay}>Record</Button></>}>
        <Field label="Amount (UGX)"><Input type="number" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} /></Field>
      </Modal>
    </div>
  );
}
