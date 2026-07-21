import { Fragment, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { get, patch, post } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import "../../features/student/student.css";

type AdminTab = "overview" | "users" | "candidates" | "audit";
type ApiRole = "Admin" | "Faculty" | "Proctor" | "Student" | "Candidate";

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  roles: ApiRole[];
}

interface Schedule {
  id: string;
  start_time: string;
  end_time: string;
  is_published: boolean;
  exams?: {
    id: string;
    title: string;
    exam_type?: string;
    status?: string;
    duration_minutes?: number;
    courses?: { code?: string; name?: string } | null;
  } | null;
}

interface AuditLog {
  id: string;
  action: string;
  table_name?: string;
  record_id?: string;
  target_id?: string;
  status?: string;
  ip_address?: string;
  details?: unknown;
  metadata?: unknown;
  created_at: string;
  user_id?: string;
  users?: { full_name?: string; email?: string } | null;
}

interface AuditLogResponse {
  items: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

interface AdminDashboardData {
  stats: {
    total_users: number;
    active_users: number;
    total_exams: number;
    active_exams: number;
    total_attempts: number;
    flagged_attempts: number;
    pending_reeval: number;
    departments: number;
    courses: number;
  };
  users: AdminUser[];
  roles: { id: string; name: ApiRole }[];
  entranceSchedules: Schedule[];
  auditLogs: AuditLog[];
}

interface CandidateRow {
  assignment_id: string;
  candidate_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  invitation_status: string;
  login_url: string;
  assigned_at: string;
  attempt_status?: string | null;
}

interface CandidateEntry {
  full_name: string;
  email: string;
  phone: string;
  temp_password: string;
}

interface ManagedAccountEntry {
  full_name: string;
  email: string;
  phone: string;
  password: string;
}

type UserRoleTab = "Admin" | "Faculty" | "Student" | "Candidate";
type UserStatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "RECENT";

const roleOptions: ApiRole[] = ["Admin", "Faculty", "Proctor", "Student", "Candidate"];
const userTabs: UserRoleTab[] = ["Admin", "Faculty", "Student", "Candidate"];

const css = `
.admin-shell{display:flex;min-height:100vh;background:#f6f7fb;color:#222536;font-family:var(--font);--side:252px}
.admin-sidebar{width:var(--side);position:fixed;inset:0 auto 0 0;background:linear-gradient(180deg,#8f1029,#b31234);color:#fff;display:flex;flex-direction:column;z-index:30;transition:width .22s ease,transform .22s ease;box-shadow:8px 0 32px rgba(83,10,28,.12)}
.admin-sidebar.collapsed{width:76px}.admin-sidebar.collapsed .admin-brand-copy,.admin-sidebar.collapsed .admin-nav span,.admin-sidebar.collapsed .admin-side-bottom div,.admin-sidebar.collapsed .admin-nav-label{display:none}.admin-sidebar.collapsed .admin-brand{justify-content:center;padding:0}.admin-sidebar.collapsed .admin-nav button{justify-content:center;padding:0}.admin-sidebar.collapsed .collapse-btn{position:absolute;right:-14px;background:#8f1029;border:2px solid #fff}.admin-sidebar.collapsed+.admin-main{margin-left:76px;width:calc(100% - 76px)}
.admin-brand{height:68px;display:flex;align-items:center;gap:11px;padding:0 14px;border-bottom:1px solid rgba(255,255,255,.12);overflow:visible}
.admin-mark{width:36px;height:36px;border-radius:12px;background:#fff;color:#a41130;display:grid;place-items:center;font-weight:900;font-size:18px;flex:none}.admin-brand-copy{display:flex;flex-direction:column;white-space:nowrap}.admin-brand-copy strong{font-size:15px}.admin-brand-copy span{font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:.65;margin-top:2px}.collapse-btn{margin-left:auto;width:30px;height:30px;border:0;border-radius:9px;color:#fff;background:rgba(255,255,255,.1);display:grid;place-items:center;cursor:pointer;flex:none}.collapse-btn:hover{background:rgba(255,255,255,.16)}
.admin-nav{padding:12px 10px;display:flex;flex-direction:column;gap:3px;overflow-y:auto;flex:1}.admin-nav-label{padding:8px 12px 5px;font-size:10px;text-transform:uppercase;letter-spacing:1.2px;opacity:.5}
.admin-nav button{display:flex;align-items:center;gap:11px;min-height:42px;width:100%;border:0;background:transparent;color:rgba(255,255,255,.78);padding:0 12px;border-radius:12px;font:600 13px var(--font);cursor:pointer;text-align:left;white-space:nowrap;transition:.15s}
.admin-nav button:hover{background:rgba(255,255,255,.09);color:#fff}.admin-nav button.active{background:#fff;color:#a30f2e;box-shadow:0 8px 20px rgba(78,5,22,.18)}.admin-nav button i{font-size:19px;flex:none}
.admin-side-bottom{margin:10px;padding:10px;border-radius:14px;background:rgba(0,0,0,.12);font-size:12px;color:rgba(255,255,255,.72);overflow:hidden}.admin-side-bottom strong{display:block;color:#fff;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.admin-main{margin-left:var(--side);width:calc(100% - var(--side));min-width:0;display:flex;flex-direction:column;transition:.22s ease}.admin-topbar{height:68px;background:rgba(255,255,255,.9);backdrop-filter:blur(14px);border-bottom:1px solid #e8e9ef;display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:0;z-index:20}
.admin-title{font-size:18px;font-weight:800;letter-spacing:-.35px}.admin-subtitle{font-size:12.5px;color:#6b6b7b;margin-top:2px}
.admin-content{padding:24px;overflow:auto}.admin-grid{display:grid;gap:16px}.hero{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px}.hero h1{font-size:28px;font-weight:800;letter-spacing:-.6px;margin:0 0 6px;color:#222536}.hero p{margin:0;color:#6b6b7b}
.stats-grid{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:18px}.stat-card,.admin-card{background:#fff;border:1px solid #e8e9ef;border-radius:14px;box-shadow:var(--shadow-sm)}
.stat-card{padding:17px}.stat-label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#6b6b7b;font-weight:800}.stat-value{font-size:28px;line-height:1;font-weight:800;margin-top:9px;color:#222536}.stat-meta{font-size:12px;color:#8a8a9a;margin-top:7px}
.admin-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #ececf1}.admin-card-title{font-size:14px;font-weight:800;display:flex;align-items:center;gap:8px}.admin-card-body{padding:16px}
.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.icon-btn{position:relative;width:38px;height:38px;border:0;border-radius:12px;background:#f4f5f8;color:#565a69;font-size:18px;cursor:pointer;display:grid;place-items:center;transition:.15s}.icon-btn:hover{background:#ecedf0}
.input,.select{height:38px;border:1px solid #e2e4e9;border-radius:8px;background:#fff;padding:0 10px;font:13px var(--font);color:#2d2d3f;outline:none}.input:focus,.select:focus{border-color:#c41e3a;box-shadow:0 0 0 3px rgba(196,30,58,.08)}.input{min-width:240px}
.btn{height:38px;border:1px solid transparent;border-radius:8px;padding:0 13px;display:inline-flex;align-items:center;gap:7px;font:700 13px var(--font);cursor:pointer;transition:.15s}.btn-primary{background:#b31234;color:#fff}.btn-primary:hover{background:#9d102d}.btn-secondary{background:#fff;color:#4a4a5c;border-color:#e2e4e9}.btn-secondary:hover{background:#f9fafb}.btn-ghost{background:#f4f5f8;color:#4a4a5c}.btn-danger{background:#fee2e2;color:#991b1b;border-color:#fecaca}.btn:disabled{opacity:.55;cursor:not-allowed}
.quick-actions{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:18px}.action-btn{height:58px;border:1px solid #e8e9ef;border-radius:14px;background:#fff;display:flex;align-items:center;gap:12px;padding:0 14px;font:800 13px var(--font);color:#222536;cursor:pointer;text-align:left;box-shadow:var(--shadow-sm);transition:.15s}.action-btn:hover{border-color:#f5b8c4;background:#fff7f9}.action-btn i{width:34px;height:34px;border-radius:12px;background:#fde8ec;color:#9d102d;display:grid;place-items:center;font-size:18px;flex:none}
.data-table{width:100%;border-collapse:collapse}.data-table th{background:#f9fafb;border-bottom:1px solid #e2e4e9;padding:10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.45px;color:#6b6b7b}.data-table td{border-bottom:1px solid #e8e9ef;padding:10px;font-size:13px;vertical-align:middle}.data-table tr:last-child td{border-bottom:0}.muted{color:#8a8a9a;font-size:12px}.name-cell{font-weight:800}.badge{display:inline-flex;align-items:center;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:800;border:1px solid transparent;text-transform:uppercase}.badge-admin{background:#fde8ec;color:#9d102d}.badge-faculty{background:#ede9fe;color:#5b21b6}.badge-proctor{background:#fef3c7;color:#92400e}.badge-student{background:#fde8ec;color:#9d102d}.badge-candidate{background:#d1fae5;color:#065f46}.badge-off{background:#f3f4f6;color:#6b6b7b}
.two-col{grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr)}.notice{margin-bottom:14px;border-radius:8px;padding:10px 12px;font-size:13px;border:1px solid}.notice.success{background:#ecfdf5;color:#047857;border-color:#a7f3d0}.notice.error{background:#fef2f2;color:#991b1b;border-color:#fecaca}
.csv-zone{border:2px dashed #d1d5db;border-radius:14px;padding:26px;text-align:center;cursor:pointer;background:#f9fafb}.csv-zone:hover{border-color:#c41e3a;background:#fff}.csv-zone i{font-size:30px;color:#8a8a9a}.csv-zone p{margin:8px 0 3px;color:#4a4a5c;font-weight:700}.csv-zone small{color:#8a8a9a}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}.empty{padding:28px;text-align:center;color:#8a8a9a;font-size:13px}.audit-row{display:grid;grid-template-columns:110px 120px 1fr;gap:10px;padding:10px 0;border-bottom:1px solid #e8e9ef;font-size:13px}.audit-row:last-child{border-bottom:0}
.feed-item,.schedule-item,.live-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #ececf1}.feed-item:last-child,.schedule-item:last-child,.live-item:last-child{border-bottom:0}.feed-icon{width:34px;height:34px;border-radius:12px;background:#fde8ec;color:#9d102d;display:grid;place-items:center}.row-main{display:flex;align-items:center;gap:10px;min-width:0}.row-title{font-weight:800;font-size:13px}.row-meta{font-size:12px;color:#8a8a9a;margin-top:2px}.status-dot{width:8px;height:8px;border-radius:99px;background:#10b981}.status-dot.off{background:#9ca3af}
.tabs{display:flex;gap:6px;padding:4px;background:#f4f5f8;border:1px solid #e8e9ef;border-radius:12px}.tab-btn{height:34px;border:0;border-radius:9px;background:transparent;color:#6b6b7b;padding:0 12px;font:700 13px var(--font);cursor:pointer}.tab-btn.active{background:#fff;color:#9d102d;box-shadow:var(--shadow-sm)}
.user-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:16px}.side-panel{display:grid;gap:12px}.rule-box{border:1px solid #e8e9ef;border-radius:14px;background:#fff;padding:14px}.rule-box h4{margin:0 0 8px;font-size:13px}.rule-box p{margin:0;color:#6b6b7b;font-size:12.5px;line-height:1.55}.fab{position:fixed;right:28px;bottom:28px;width:52px;height:52px;border:0;border-radius:16px;background:#b31234;color:#fff;box-shadow:0 12px 30px rgba(112,12,35,.24);display:grid;place-items:center;font-size:24px;cursor:pointer;z-index:25}.fab:hover{background:#9d102d}
.modal-backdrop{position:fixed;inset:0;background:rgba(26,26,46,.38);z-index:50;display:grid;place-items:center;padding:20px}.modal{width:min(560px,100%);background:#fff;border-radius:16px;border:1px solid #e8e9ef;box-shadow:var(--shadow-lg);overflow:hidden}.modal-head{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid #ececf1}.modal-title{font-weight:800}.modal-body{padding:16px}.modal-actions{display:flex;justify-content:flex-end;gap:10px;padding:14px 16px;border-top:1px solid #ececf1}.preview-list{max-height:220px;overflow:auto;border:1px solid #e8e9ef;border-radius:12px;margin-top:12px}
.candidate-layout{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px}.compact-card .admin-card-body{padding:14px 16px}.section-strip{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px}.section-strip strong{font-size:13px}.schedule-select{width:100%;min-width:0}.candidate-tools{display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:12px;align-items:stretch}.mini-upload{border:1px dashed #d1d5db;border-radius:14px;background:#f9fafb;padding:14px;display:flex;align-items:center;gap:10px;cursor:pointer;min-height:86px}.mini-upload:hover{border-color:#c41e3a;background:#fff}.mini-upload i{width:34px;height:34px;border-radius:12px;background:#fde8ec;color:#9d102d;display:grid;place-items:center;font-size:18px}.mini-upload p{margin:0;font-weight:800;font-size:13px}.mini-upload small{display:block;margin-top:3px;color:#8a8a9a;font-size:11.5px}.candidate-preview-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 0 8px}.assigned-list{display:grid;gap:8px}.assigned-row{border:1px solid #ececf1;border-radius:12px;padding:10px 11px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:10px}.assigned-row-main{min-width:0}.assigned-row-main .name-cell,.assigned-row-main .muted{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.assigned-row-meta{text-align:right;flex:none}
.audit-toolbar{display:grid;grid-template-columns:minmax(220px,1.3fr) repeat(4,minmax(140px,.7fr));gap:10px;padding:16px;border-bottom:1px solid #ececf1}.audit-table tbody tr{cursor:pointer}.audit-table tbody tr:hover td{background:#fff7f9}.audit-details{background:#f9fafb;border:1px solid #ececf1;border-radius:12px;padding:12px;color:#4a4a5c;font-size:12px;white-space:pre-wrap;max-height:220px;overflow:auto}.badge-success{background:#d1fae5;color:#065f46}.badge-failed{background:#fee2e2;color:#991b1b}.badge-warning{background:#fef3c7;color:#92400e}.badge-info{background:#dbeafe;color:#1e40af}.pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-top:1px solid #ececf1}
.skeleton{position:relative;overflow:hidden;background:#eef0f4;border-radius:10px}.skeleton:after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.62),transparent);animation:shine 1.2s infinite}.sk-line{height:12px}.sk-card{height:108px;border-radius:14px}.sk-table{height:340px;border-radius:14px}@keyframes shine{to{transform:translateX(100%)}}
@media(max-width:1000px){.admin-sidebar{display:none}.admin-main{margin-left:0;width:100%}.stats-grid,.two-col,.quick-actions{grid-template-columns:1fr}.admin-content{padding:16px}.form-row{grid-template-columns:1fr}.input{min-width:0;width:100%}.hero{align-items:flex-start;flex-direction:column}.admin-topbar{padding:0 16px}}
@media(max-width:1100px){.user-layout,.candidate-layout,.candidate-tools,.audit-toolbar{grid-template-columns:1fr}.fab{right:18px;bottom:18px}}

/* Admin portal: aligned to the student workspace system.  Kept local so this
   dashboard cannot change legacy/exam surfaces that use the shared class names. */
.admin-shell{--side:264px;background:#f8f8f9;color:#292a31;letter-spacing:-.01em}
.admin-sidebar{background:#fff;color:#4d4e56;border-right:1px solid #e8e8ec;box-shadow:none}
.admin-brand{height:76px;padding:0 16px;border-bottom:1px solid #efeff1;gap:8px}
.admin-mark{width:38px;height:38px;padding:3px;border-radius:12px;background:#fff;box-shadow:0 2px 7px rgba(29,30,35,.08);color:#a31332;overflow:hidden}
.admin-mark img{display:block;width:100%;height:100%;object-fit:contain}
.admin-brand-copy strong{color:#292a31;font-size:15px;letter-spacing:-.03em}.admin-brand-copy span{color:#9899a1;font-size:9px;font-weight:750;letter-spacing:.1em;opacity:1}
.collapse-btn{width:32px;height:32px;border:1px solid #e8e8ec;border-radius:10px;background:#fff;color:#73747d}.collapse-btn:hover{background:#f7f7f8;color:#a31332}
.admin-nav{padding:18px 10px;gap:2px}.admin-nav-label{padding:8px 11px 7px;color:#a0a1a8;font-size:9px;font-weight:800;letter-spacing:.1em;opacity:1}
.admin-nav button{min-height:40px;padding:0 12px;border-radius:10px;color:#6d6e77;font-size:12px;font-weight:650}.admin-nav button i{font-size:17px;color:#85868e}.admin-nav button:hover{background:#f7f7f8;color:#292a31}.admin-nav button:hover i{color:#a31332}.admin-nav button.active{background:#fcecef;color:#a31332;box-shadow:none}.admin-nav button.active i{color:#a31332}
.admin-side-bottom{margin:12px;padding:12px;border:1px solid #ececef;border-radius:14px;background:#fafafb;color:#85868e;font-size:11px}.admin-side-bottom strong{color:#36373e;font-size:12px}
.admin-sidebar.collapsed{width:72px}.admin-sidebar.collapsed .admin-brand{padding:0;justify-content:center}.admin-sidebar.collapsed .admin-mark{width:36px;height:36px}.admin-sidebar.collapsed .collapse-btn{position:absolute;right:-15px;border-color:#e4e4e8;background:#fff;color:#64656d}.admin-sidebar.collapsed+.admin-main{margin-left:72px;width:calc(100% - 72px)}
.admin-main{margin-left:var(--side);width:calc(100% - var(--side));background:#f8f8f9}.admin-topbar{height:76px;padding:0 32px;border-color:#e8e8ec;background:rgba(255,255,255,.88);box-shadow:none}.admin-title{font-size:14px;font-weight:760;letter-spacing:-.03em}.admin-subtitle{margin-top:3px;color:#93949c;font-size:11px}.admin-content{max-width:1560px;width:100%;margin:0 auto;padding:30px 32px 44px}
.hero{margin-bottom:24px}.hero h1{margin-bottom:7px;color:#27282f;font-size:25px;font-weight:760;letter-spacing:-.045em}.hero p{color:#85868f;font-size:12px}.toolbar{gap:8px}
.btn{height:36px;padding:0 12px;border-radius:9px;font-size:11px;font-weight:720}.btn-primary{background:#a31332;box-shadow:0 6px 14px rgba(163,19,50,.16)}.btn-primary:hover{background:#851026}.btn-secondary{border-color:#e1e2e6;color:#4f5058;box-shadow:0 1px 2px rgba(25,26,30,.02)}.btn-secondary:hover{border-color:#d3d4da;background:#fff;color:#292a31}.btn-ghost{background:#f5f5f6}.icon-btn{width:34px;height:34px;border:1px solid #e7e7eb;border-radius:9px;background:#fff;color:#696a73;font-size:16px}.icon-btn:hover{background:#f8f8f9;color:#a31332}
.stats-grid{gap:14px;margin-bottom:24px}.stat-card,.admin-card{border-color:#e4e4e8;border-radius:18px;box-shadow:0 7px 18px rgba(27,27,32,.045)}.stat-card{position:relative;min-height:116px;padding:16px 18px;overflow:hidden}.stat-card:after{position:absolute;right:0;bottom:0;left:0;height:3px;background:#b31234;content:""}.stat-card:nth-child(2):after{background:#62636b}.stat-card:nth-child(3):after{background:#d19431}.stat-card:nth-child(4):after{background:#8a8b94}.stat-label{color:#9798a0;font-size:9px;letter-spacing:.08em}.stat-value{margin-top:13px;color:#292a31;font-size:28px;letter-spacing:-.05em}.stat-meta{margin-top:5px;color:#85868d;font-size:11px}
.quick-actions{gap:12px;margin-bottom:24px}.action-btn{height:54px;padding:0 13px;border-color:#e5e5e9;border-radius:14px;box-shadow:0 4px 12px rgba(30,30,35,.025);color:#3b3c44;font-size:11px}.action-btn i{width:30px;height:30px;border-radius:10px;background:#fcecef;color:#a31332;font-size:16px}.action-btn:hover{border-color:#e7c3cc;background:#fffafb;box-shadow:0 8px 18px rgba(64,20,31,.055);transform:translateY(-1px)}
.two-col{gap:18px}.admin-card{background:#fff;overflow:hidden}.admin-card-head{min-height:62px;padding:0 18px;border-color:#efeff1}.admin-card-title{color:#35363e;font-size:13px;font-weight:760}.admin-card-title i{color:#a31332;font-size:17px}.admin-card-body{padding:14px 18px}.feed-item,.schedule-item,.live-item{padding:12px 0;border-color:#f0f0f2}.feed-icon{width:30px;height:30px;border-radius:10px;background:#fcecef;color:#a31332}.row-title,.name-cell{color:#373840;font-size:12px;font-weight:720}.row-meta,.muted{color:#898a93;font-size:10.5px}.status-dot{box-shadow:0 0 0 4px #e7f5ef}
.input,.select{height:36px;border-color:#e2e3e7;border-radius:9px;color:#35363e;font-size:11px}.input{min-width:220px}.input::placeholder{color:#999aa2}.input:hover,.select:hover{border-color:#d1d2d8}.input:focus,.select:focus{border-color:#b31234;box-shadow:0 0 0 3px rgba(179,18,52,.09)}
.data-table th{padding:11px 18px;background:#fafafb;border-bottom-color:#ebebee;color:#9899a1;font-size:9px;letter-spacing:.08em}.data-table td{padding:13px 18px;border-bottom-color:#f0f0f2;color:#53545c;font-size:11px}.data-table tbody tr{transition:background .15s ease}.data-table tbody tr:hover td{background:#fffafb}.data-table tbody tr:hover td:first-child{box-shadow:inset 3px 0 #b31234}
.badge{padding:3px 8px;border-radius:999px;font-size:9px;font-weight:760;letter-spacing:.05em}.badge-admin,.badge-student{border-color:#f1c7d1;background:#fff0f3;color:#a31332}.badge-faculty,.badge-proctor,.badge-candidate,.badge-success{border-color:#d7d8dd;background:#f5f5f6;color:#575861}.badge-off,.badge-info{border-color:#e4e4e7;background:#fafafb;color:#777881}.badge-warning{border-color:#edddb8;background:#fff7e8;color:#9a6a19}.badge-failed{border-color:#f0c6cf;background:#fff0f3;color:#a31332}
.tabs{gap:3px;padding:4px;border:1px solid #e7e7ea;border-radius:12px;background:#f7f7f8}.tab-btn{height:32px;border-radius:8px;color:#797a83;font-size:11px}.tab-btn.active{color:#a31332;box-shadow:0 2px 7px rgba(32,32,37,.08)}
.user-layout,.candidate-layout{gap:18px}.side-panel{gap:12px}.rule-box{padding:16px;border-color:#e5e5e9;border-radius:16px;box-shadow:0 4px 12px rgba(31,31,36,.025)}.rule-box h4{color:#3b3c44;font-size:12px}.rule-box p{color:#85868f;font-size:11px;line-height:1.55}.fab{right:28px;bottom:28px;width:46px;height:46px;border-radius:14px;background:#a31332;box-shadow:0 10px 24px rgba(128,14,39,.22);font-size:20px}.fab:hover{background:#851026}
.mini-upload{border-color:#dedfe4;border-radius:14px;background:#fafafb}.mini-upload:hover{border-color:#d799a7;background:#fffafb}.mini-upload i{width:32px;height:32px;border-radius:10px;background:#fcecef;color:#a31332}.assigned-row{border-color:#ebebee;border-radius:12px;background:#fff}.assigned-row:hover{border-color:#e5c6ce;background:#fffafb}.audit-toolbar{gap:8px;padding:14px 18px;border-color:#efeff1}.audit-details{border-color:#e9e9ec;border-radius:10px;background:#fafafb;color:#55565e;font-size:11px}.pagination{padding:12px 18px;border-color:#efeff1}
.notice{border-radius:12px;font-size:11px}.notice.success{border-color:#d7d8dd;background:#f7f7f8;color:#55565e}.notice.error{border-color:#efc8d0;background:#fff4f6;color:#a31332}.empty{padding:34px 20px;color:#8d8e96;font-size:11px}.modal-backdrop{background:rgba(28,29,34,.35);backdrop-filter:blur(3px)}.modal{border-color:#e5e5e9;border-radius:18px;box-shadow:0 22px 54px rgba(22,22,27,.19)}.modal-head{padding:17px 18px;border-color:#eeeeef}.modal-title{font-size:14px;color:#34353c}.modal-body{padding:18px}.modal-actions{padding:13px 18px;border-color:#eeeeef;background:#fcfcfd}.preview-list{border-color:#e8e8eb;border-radius:12px}.skeleton{background:#ededef}.skeleton:after{background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)}
.admin-mobile-menu,.admin-mobile-scrim{display:none}
@media(max-width:1000px){.admin-sidebar{display:flex;transform:translateX(-102%);width:264px}.admin-sidebar.mobile-open{transform:translateX(0);box-shadow:14px 0 40px rgba(25,25,30,.15)}.admin-main,.admin-sidebar.collapsed+.admin-main{margin-left:0;width:100%}.admin-sidebar.collapsed{width:264px}.admin-sidebar.collapsed .admin-brand-copy,.admin-sidebar.collapsed .admin-nav span,.admin-sidebar.collapsed .admin-side-bottom div,.admin-sidebar.collapsed .admin-nav-label{display:block}.admin-sidebar.collapsed .admin-nav button{justify-content:flex-start;padding:0 12px}.admin-sidebar.collapsed .collapse-btn{position:static;border:1px solid #e8e8ec}.admin-mobile-menu{display:grid;place-items:center;width:34px;height:34px;margin-right:10px;border:1px solid #e4e4e8;border-radius:9px;background:#fff;color:#65666f}.admin-mobile-scrim{display:block;position:fixed;inset:0;z-index:25;border:0;background:rgba(26,26,30,.32)}.admin-topbar{height:68px;padding:0 16px}.admin-content{padding:24px 16px 36px}.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.quick-actions{grid-template-columns:repeat(2,minmax(0,1fr))}.two-col{grid-template-columns:1fr}.hero{gap:14px}.admin-subtitle{display:none}}
@media(max-width:640px){.stats-grid,.quick-actions{grid-template-columns:1fr}.admin-topbar .toolbar .btn{display:none}.hero h1{font-size:22px}.admin-card-head{align-items:flex-start;padding:14px 16px;gap:10px}.admin-card-body{padding:14px 16px}.data-table th,.data-table td{padding-right:14px;padding-left:14px}.tabs{overflow-x:auto}.tab-btn{white-space:nowrap}.input{min-width:0;width:100%}.toolbar{width:100%}.audit-toolbar{padding:14px 16px}.fab{right:16px;bottom:16px}.modal-backdrop{padding:12px}}

/* Direct aliases to the Student portal shell. These values intentionally
   mirror the source system rather than creating an Admin-specific variant. */
.admin-brand.student-brand{height:80px;padding:0 20px;gap:10px}.admin-mark.brand-mark{width:34px;height:34px;padding:4px;border-radius:10px;background:var(--red);box-shadow:0 5px 12px rgba(163,19,50,.16)}.admin-brand-copy.brand-copy strong{color:#1d1d21;font-size:14px;letter-spacing:-.02em}.admin-brand-copy.brand-copy span{margin-top:2px;color:#898990;font-size:10px;font-weight:650;letter-spacing:.08em}.admin-nav.student-nav{padding:22px 12px}.admin-nav-label{padding:0 12px 8px;color:#9b9ba2;font-size:10px;font-weight:750;letter-spacing:.1em}.admin-nav button{position:relative;min-height:42px;margin:2px 0;padding:0 12px;border-radius:9px;color:#606068;font-size:13px;font-weight:620}.admin-nav button i{font-size:18px;color:inherit}.admin-nav button.active{background:var(--red-wash);color:var(--red);font-weight:750}.admin-nav button.active:before{position:absolute;left:0;width:3px;height:19px;border-radius:0 3px 3px 0;background:var(--red);content:""}.admin-side-bottom.sidebar-profile{margin:12px;padding:12px;border-color:var(--line);border-radius:13px;background:#fbfbfb}.admin-side-bottom.sidebar-profile strong{color:#25252a;font-size:12px}.admin-side-bottom.sidebar-profile button{display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:#777780}.admin-side-bottom.sidebar-profile button:hover{background:var(--red-wash);color:var(--red)}
.admin-topbar.student-topbar{height:80px;padding:0 40px;background:rgba(255,255,255,.86);border-color:var(--line);backdrop-filter:blur(18px)}.admin-content{max-width:1480px;padding:38px 40px 56px}.admin-page-heading{margin-bottom:30px}.hero.admin-page-heading h1{color:#1d1d21;font-size:28px;font-weight:720;letter-spacing:-.045em;line-height:1.12}.hero.admin-page-heading p{margin-top:8px;color:var(--muted);font-size:13px;line-height:1.5}.topbar-user{border-color:transparent;background:transparent}.topbar-user:hover{border-color:var(--line);background:#fff}
.stats-grid.dashboard-stats{gap:16px;margin-bottom:28px}.stats-grid.dashboard-stats .stat-card{min-height:132px;padding:18px 19px;border-radius:20px}.stats-grid.dashboard-stats .stat-top{font-size:9px}.stats-grid.dashboard-stats .stat-icon{width:36px;height:36px;border-radius:13px}.stats-grid.dashboard-stats .stat-metric{margin-top:12px}.stats-grid.dashboard-stats .stat-value{font-size:29px}.quick-actions{gap:16px;margin-bottom:28px}.action-btn{height:58px;border-radius:14px}.admin-card,.stat-card{border-color:rgba(223,225,230,.94)}.admin-card{border-radius:20px;box-shadow:0 7px 18px rgba(30,32,38,.055)}.admin-card-head{min-height:57px;padding:0 19px}.admin-card-body{padding:0 19px}.admin-card-body>.feed-item:first-child,.admin-card-body>.schedule-item:first-child{padding-top:15px}.admin-card-body>.feed-item:last-child,.admin-card-body>.schedule-item:last-child{padding-bottom:15px}.data-table th{padding:13px 18px;background:#fafafb;color:#96969e}.data-table td{padding:16px 18px;border-top:1px solid #f0f0f2}.input,.select{height:40px;border-radius:8px;font-size:12px}.btn{min-height:38px;border-radius:9px;font-size:12px}.tabs{border-radius:12px}.tab-btn{font-size:12px}.rule-box{border-radius:20px;box-shadow:0 7px 18px rgba(30,32,38,.04)}
@media(max-width:1100px){.admin-topbar.student-topbar{padding:0 28px}.admin-content{padding:28px}.admin-brand.student-brand{padding:0 20px}}
@media(max-width:760px){.admin-topbar.student-topbar{height:68px;padding:0 16px}.admin-content{padding:24px 16px 48px}.admin-mobile-menu{margin-right:8px}.admin-page-heading{margin-bottom:22px}.hero.admin-page-heading h1{font-size:24px}.quick-actions{gap:12px}.admin-card{border-radius:18px}}

/* Student reference rail — this is deliberately the same deep-red treatment
   used throughout the supplied Student dashboard screens. */
.admin-sidebar.student-sidebar{background:linear-gradient(180deg,#97132f 0%,#7f0e27 100%);color:#fff;border-right:0;box-shadow:14px 0 32px rgba(92,10,30,.1)}
.admin-brand.student-brand{border-bottom-color:rgba(255,255,255,.15)}.admin-mark.brand-mark{position:relative;overflow:hidden;padding:0;background:#fff;box-shadow:none}.admin-mark.brand-mark img{position:absolute;top:0;left:50%;display:block;width:160px;max-width:none;height:auto;transform:translateX(-50%)}
.admin-brand-copy.brand-copy strong,.admin-brand-copy.brand-copy span{color:#fff}.admin-brand-copy.brand-copy strong{font-size:16px;letter-spacing:-.035em}.admin-brand-copy.brand-copy span{opacity:.66}.collapse-btn{border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.12);color:#fff}.collapse-btn:hover{border-color:rgba(255,255,255,.32);background:rgba(255,255,255,.2);color:#fff}
.admin-nav-label{color:rgba(255,255,255,.52)}.admin-nav button{color:rgba(255,255,255,.78);border-radius:12px}.admin-nav button:hover{background:rgba(255,255,255,.12);color:#fff}.admin-nav button.active{background:#fff;color:var(--red);box-shadow:0 10px 22px rgba(60,4,18,.18)}.admin-nav button.active:before{display:none}.admin-nav button i{color:inherit}.admin-side-bottom.sidebar-profile{border-color:rgba(255,255,255,.2);background:rgba(82,5,25,.16);color:rgba(255,255,255,.78)}.admin-side-bottom.sidebar-profile .avatar{background:#fff;color:var(--red)}.admin-side-bottom.sidebar-profile strong{color:#fff}.admin-side-bottom.sidebar-profile .profile-copy span{color:rgba(255,255,255,.68)}.admin-side-bottom.sidebar-profile button{color:#fff}.admin-side-bottom.sidebar-profile button:hover{background:rgba(255,255,255,.12);color:#fff}
.admin-sidebar.collapsed .collapse-btn{border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.12);color:#fff}
@media(max-width:1000px){.admin-sidebar.mobile-open{box-shadow:14px 0 32px rgba(92,10,30,.22)}.admin-sidebar.collapsed .collapse-btn{border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.12);color:#fff}}

/* Match the Student dashboard: compact content sizing with equal grid rows. */
.admin-shell .stats-grid.dashboard-stats .stat-card{align-self:stretch;height:auto!important;min-height:0!important;padding:15px 18px 16px}
`;

function roleClass(role?: string) {
  return `badge badge-${(role || "off").toLowerCase()}`;
}

function normalizeRole(role?: string): ApiRole {
  const match = roleOptions.find((option) => option.toLowerCase() === String(role || "").toLowerCase());
  return match ?? "Student";
}

function parseCSV(text: string): CandidateEntry[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((cell) => cell.trim().replace(/^"|"$/g, "").toLowerCase());
  const find = (names: string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const nameIndex = find(["name", "full_name", "full name", "candidate_name"]);
  const emailIndex = find(["email", "email_id", "email id", "candidate_email"]);
  const phoneIndex = find(["phone", "mobile", "contact"]);
  const passwordIndex = find(["temp_password", "password", "temporary_password"]);
  if (nameIndex < 0 || emailIndex < 0) return [];
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
    return {
      full_name: cols[nameIndex] || "",
      email: cols[emailIndex] || "",
      phone: phoneIndex >= 0 ? cols[phoneIndex] || "" : "",
      temp_password: passwordIndex >= 0 ? cols[passwordIndex] || "" : "",
    };
  }).filter((row) => row.full_name && row.email.includes("@"));
}

function parseAccountCSV(text: string): ManagedAccountEntry[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((cell) => cell.trim().replace(/^"|"$/g, "").toLowerCase());
  const find = (names: string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const nameIndex = find(["name", "full_name", "full name"]);
  const emailIndex = find(["email", "email_id", "email id"]);
  const phoneIndex = find(["phone", "mobile", "contact"]);
  const passwordIndex = find(["password", "temp_password", "temporary_password"]);
  if (nameIndex < 0 || emailIndex < 0) return [];
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
    return {
      full_name: cols[nameIndex] || "",
      email: cols[emailIndex] || "",
      phone: phoneIndex >= 0 ? cols[phoneIndex] || "" : "",
      password: passwordIndex >= 0 ? cols[passwordIndex] || "" : "",
    };
  }).filter((row) => row.full_name && row.email.includes("@"));
}

function fmtDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function auditStatus(log: AuditLog): "success" | "failed" | "warning" | "info" {
  const raw = `${log.status ?? log.action ?? ""}`.toLowerCase();
  if (raw.includes("fail") || raw.includes("error") || raw.includes("denied")) return "failed";
  if (raw.includes("warn") || raw.includes("flag") || raw.includes("suspicious")) return "warning";
  if (raw.includes("create") || raw.includes("update") || raw.includes("assign") || raw.includes("publish") || raw.includes("success")) return "success";
  return "info";
}

function auditTarget(log: AuditLog) {
  return log.table_name ?? log.record_id ?? log.target_id ?? "record";
}

function auditDetails(log: AuditLog) {
  const payload = log.details ?? log.metadata ?? log;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload ?? "No extra details.");
  }
}

export default function AdminDashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [userRoleTab, setUserRoleTab] = useState<UserRoleTab>("Admin");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("ALL");
  const [createRole, setCreateRole] = useState<UserRoleTab>("Faculty");
  const [createOpen, setCreateOpen] = useState(false);
  const [accountRows, setAccountRows] = useState<ManagedAccountEntry[]>([]);
  const [manualAccount, setManualAccount] = useState<ManagedAccountEntry>({ full_name: "", email: "", phone: "", password: "" });
  const [auditSearch, setAuditSearch] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditUser, setAuditUser] = useState("");
  const [auditStart, setAuditStart] = useState("");
  const [auditEnd, setAuditEnd] = useState("");
  const [auditPage, setAuditPage] = useState(0);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState("");
  const [candidateRows, setCandidateRows] = useState<CandidateEntry[]>([]);
  const [manualCandidate, setManualCandidate] = useState<CandidateEntry>({ full_name: "", email: "", phone: "", temp_password: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const accountFileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError } = useQuery<AdminDashboardData>({
    queryKey: ["admin-dashboard"],
    queryFn: () => get<AdminDashboardData>("/api/v1/admin/dashboard"),
    refetchInterval: 30_000,
  });

  const { data: assignments = [] } = useQuery<CandidateRow[]>({
    queryKey: ["admin-candidates", selectedSchedule],
    queryFn: () => get<CandidateRow[]>(`/api/v1/admin/candidates/${selectedSchedule}`),
    enabled: Boolean(selectedSchedule),
  });

  const auditLimit = 12;
  const auditParams = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(auditLimit),
      offset: String(auditPage * auditLimit),
    });
    if (auditSearch.trim()) params.set("search", auditSearch.trim());
    if (auditAction) params.set("action", auditAction);
    if (auditUser) params.set("user_id", auditUser);
    if (auditStart) params.set("start_date", new Date(auditStart).toISOString());
    if (auditEnd) params.set("end_date", new Date(`${auditEnd}T23:59:59`).toISOString());
    return params.toString();
  }, [auditAction, auditEnd, auditPage, auditSearch, auditStart, auditUser]);

  const { data: auditData, isLoading: auditLoading } = useQuery<AuditLogResponse>({
    queryKey: ["audit-logs", auditParams],
    queryFn: () => get<AuditLogResponse>(`/api/v1/audit-logs/?${auditParams}`),
    enabled: activeTab === "audit",
  });

  const createAccountsMutation = useMutation({
    mutationFn: (rows: ManagedAccountEntry[]) =>
      post<{ created: number; failed: number; emails_sent: number; emails_failed: number; emails_skipped: number }>("/api/v1/admin/users/bulk", {
        role: createRole,
        users: rows.map((row) => ({
          full_name: row.full_name,
          email: row.email,
          phone: row.phone || null,
          password: row.password || null,
        })),
      }),
    onSuccess: (result) => {
      const mailText = result.emails_skipped
        ? " SMTP is not configured, so credentials were created but email was skipped."
        : ` ${result.emails_sent} credential email(s) sent, ${result.emails_failed} failed.`;
      setNotice({ type: "success", text: `${result.created} ${createRole.toLowerCase()} account(s) created.${mailText}` });
      setAccountRows([]);
      setManualAccount({ full_name: "", email: "", phone: "", password: "" });
      setCreateOpen(false);
      setUserRoleTab(createRole);
      void qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (err: Error) => setNotice({ type: "error", text: err.message || "Could not create accounts." }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "Student" | "Candidate" }) =>
      patch(`/api/v1/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      setNotice({ type: "success", text: "Temporary exam role updated." });
      void qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (err: Error) => setNotice({ type: "error", text: err.message || "Could not update role." }),
  });

  const assignMutation = useMutation({
    mutationFn: (rows: CandidateEntry[]) =>
      post<{ assigned: number; emails_sent: number; emails_failed: number; emails_skipped: number }>("/api/v1/admin/candidates/assign", {
        exam_schedule_id: selectedSchedule,
        candidates: rows.map((row) => ({
          full_name: row.full_name,
          email: row.email,
          phone: row.phone || null,
          temp_password: row.temp_password || null,
        })),
      }),
    onSuccess: (result) => {
      const mailText = result.emails_skipped
        ? " SMTP is not configured, so credentials were created but email was skipped."
        : ` ${result.emails_sent} email(s) sent, ${result.emails_failed} failed.`;
      setNotice({ type: "success", text: `${result.assigned} candidate(s) assigned.${mailText}` });
      setCandidateRows([]);
      setManualCandidate({ full_name: "", email: "", phone: "", temp_password: "" });
      void qc.invalidateQueries({ queryKey: ["admin-candidates", selectedSchedule] });
      void qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (err: Error) => setNotice({ type: "error", text: err.message || "Could not assign candidates." }),
  });

  const users = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return (data?.users ?? []).filter((user) => {
      const role = user.roles[0] ?? "";
      const matchesTab = role.toLowerCase() === userRoleTab.toLowerCase();
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && user.is_active) ||
        (statusFilter === "INACTIVE" && !user.is_active) ||
        (statusFilter === "RECENT" && new Date(user.created_at).getTime() >= recentCutoff);
      const matchesSearch = !needle || `${user.full_name} ${user.email}`.toLowerCase().includes(needle);
      return matchesTab && matchesStatus && matchesSearch;
    });
  }, [data?.users, search, statusFilter, userRoleTab]);

  const schedules = data?.entranceSchedules ?? [];
  const selectedScheduleLabel = schedules.find((schedule) => schedule.id === selectedSchedule);
  const liveSchedules = schedules.filter((schedule) => {
    const now = Date.now();
    return new Date(schedule.start_time).getTime() <= now && new Date(schedule.end_time).getTime() >= now;
  });
  const candidatesAssigned = assignments.length || data?.stats.total_attempts || 0;

  const uploadCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = parseCSV(String(event.target?.result ?? ""));
      setCandidateRows(rows);
      setNotice(rows.length ? null : { type: "error", text: "No valid rows found. Use headers: name,email,phone,temp_password" });
    };
    reader.readAsText(file);
  };

  const uploadAccountCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = parseAccountCSV(String(event.target?.result ?? ""));
      setAccountRows(rows);
      setNotice(rows.length ? null : { type: "error", text: "No valid rows found. Use headers: name,email,phone,password" });
    };
    reader.readAsText(file);
  };

  const addManualAccount = () => {
    if (!manualAccount.full_name.trim() || !manualAccount.email.includes("@")) {
      setNotice({ type: "error", text: "Enter a valid name and email." });
      return;
    }
    setAccountRows((rows) => [...rows, manualAccount]);
    setManualAccount({ full_name: "", email: "", phone: "", password: "" });
  };

  const addManualCandidate = () => {
    if (!manualCandidate.full_name.trim() || !manualCandidate.email.includes("@")) {
      setNotice({ type: "error", text: "Enter a valid candidate name and email." });
      return;
    }
    setCandidateRows((rows) => [...rows, manualCandidate]);
    setManualCandidate({ full_name: "", email: "", phone: "", temp_password: "" });
  };

  const openCreateAccount = (role: UserRoleTab) => {
    const nextRole = role === "Candidate" ? "Student" : role;
    setCreateRole(nextRole);
    setUserRoleTab(nextRole);
    setCreateOpen(true);
    setActiveTab("users");
  };

  const quickAction = (label: string, icon: string, action: () => void) => (
    <button className="action-btn" type="button" onClick={action}>
      <i className={`ti ${icon}`} />
      <span>{label}</span>
    </button>
  );

  const renderOverview = () => (
    <>
      <section className="hero page-heading admin-page-heading">
        <div>
          <h1>Good Afternoon, {currentUser?.fullName?.split(" ")[0] || "Admin"}</h1>
          <p>Manage users, exams, schedules and live examinations.</p>
        </div>
        <div className="toolbar">
          <button className="btn btn-primary" type="button" onClick={() => openCreateAccount("Faculty")}><i className="ti ti-plus" /> Add Faculty</button>
        </div>
      </section>
      <div className="admin-grid stats-grid dashboard-stats">
        <div className="stat-card"><div className="stat-top"><span>Total Users</span><i className="ti ti-users stat-icon" /></div><div className="stat-metric"><div className="stat-value">{data?.stats.total_users ?? 0}</div><div className="stat-detail">{data?.stats.active_users ?? 0} active accounts</div></div></div>
        <div className="stat-card"><div className="stat-top"><span>Active Exams</span><i className="ti ti-clipboard-list stat-icon" /></div><div className="stat-metric"><div className="stat-value">{data?.stats.active_exams ?? 0}</div><div className="stat-detail">{data?.stats.total_exams ?? 0} total exams</div></div></div>
        <div className="stat-card"><div className="stat-top"><span>Live Exams</span><i className="ti ti-broadcast stat-icon" /></div><div className="stat-metric"><div className="stat-value">{liveSchedules.length}</div><div className="stat-detail">{data?.stats.flagged_attempts ?? 0} flagged candidates</div></div></div>
        <div className="stat-card"><div className="stat-top"><span>Candidates Assigned</span><i className="ti ti-user-check stat-icon" /></div><div className="stat-metric"><div className="stat-value">{candidatesAssigned}</div><div className="stat-detail">Across published schedules</div></div></div>
      </div>
      <div className="admin-grid quick-actions">
        {quickAction("Create Faculty", "ti-school", () => openCreateAccount("Faculty"))}
        {quickAction("Manage Users", "ti-users", () => setActiveTab("users"))}
        {quickAction("Assign Candidates", "ti-user-plus", () => setActiveTab("candidates"))}
        {quickAction("Go to Proctor Portal", "ti-device-desktop", () => navigate("/admin/proctor"))}
      </div>
      <div className="admin-grid two-col">
        <div className="admin-card">
          <div className="admin-card-head"><div className="admin-card-title"><i className="ti ti-activity" /> Recent Activity</div><button className="btn btn-secondary" onClick={() => setActiveTab("audit")}>View logs</button></div>
          <div className="admin-card-body">
            {(data?.auditLogs ?? []).slice(0, 5).map((log) => (
              <div className="feed-item" key={log.id}>
                <div className="row-main">
                  <div className="feed-icon"><i className="ti ti-point-filled" /></div>
                  <div><div className="row-title">{log.action.replace(/_/g, " ")}</div><div className="row-meta">{log.users?.email ?? "System"} on {log.table_name ?? "record"}</div></div>
                </div>
                <span className="row-meta">{fmtDate(log.created_at)}</span>
              </div>
            ))}
            {(data?.auditLogs ?? []).length === 0 && <div className="empty">No activity yet.</div>}
          </div>
        </div>
        <div className="admin-card">
          <div className="admin-card-head"><div className="admin-card-title"><i className="ti ti-calendar" /> Upcoming Schedules</div><button className="btn btn-primary" onClick={() => setActiveTab("candidates")}>Assign</button></div>
          <div className="admin-card-body">
            {(schedules.slice(0, 4)).map((schedule) => (
              <div className="schedule-item" key={schedule.id}>
                <div>
                  <div className="row-title">{schedule.exams?.title ?? "Entrance exam"}</div>
                  <div className="row-meta">{fmtDate(schedule.start_time)} · {schedule.exams?.duration_minutes ?? "-"} min</div>
                </div>
                <button className="btn btn-secondary" type="button" onClick={() => { setSelectedSchedule(schedule.id); setActiveTab("candidates"); }}>View</button>
              </div>
            ))}
            {schedules.length === 0 && <div className="empty">No entrance schedules found.</div>}
          </div>
        </div>
      </div>
      {liveSchedules.length > 0 && (
        <div className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-card-head"><div className="admin-card-title"><i className="ti ti-broadcast" /> Live Exams</div><button className="btn btn-primary" onClick={() => navigate("/admin/proctor")}>Monitor</button></div>
          <div className="admin-card-body">
            {liveSchedules.map((schedule) => (
              <div className="live-item" key={schedule.id}>
                <div className="row-main"><span className="status-dot" /><div><div className="row-title">{schedule.exams?.title ?? "Live exam"}</div><div className="row-meta">{data?.stats.total_attempts ?? 0} candidates · {data?.stats.flagged_attempts ?? 0} flagged</div></div></div>
                <span className="badge badge-candidate">Live</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderUsersTable = (rows: AdminUser[], editable = true) => (
    <table className="data-table">
      <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th>{editable && <th>Allowed Changes</th>}</tr></thead>
      <tbody>
        {rows.map((user) => {
          const currentRole = normalizeRole(user.roles[0]);
          const canTemporarilySwitch = currentRole === "Student" || currentRole === "Candidate";
          return (
            <tr key={user.id}>
              <td><div className="name-cell">{user.full_name || "Unnamed user"}</div><div className="muted">{user.email}</div></td>
              <td><span className={roleClass(currentRole)}>{currentRole}</span></td>
              <td><span className={user.is_active ? "badge badge-candidate" : "badge badge-off"}>{user.is_active ? "Active" : "Inactive"}</span></td>
              <td className="muted">{fmtDate(user.created_at)}</td>
              {editable && (
                <td>
                  {canTemporarilySwitch ? (
                    <select
                      className="select"
                      value={currentRole}
                      disabled={roleMutation.isPending}
                      onChange={(event) => roleMutation.mutate({ userId: user.id, role: event.target.value as "Student" | "Candidate" })}
                    >
                      <option value="Student">Student</option>
                      <option value="Candidate">Candidate</option>
                    </select>
                  ) : (
                    <span className="muted">Create a new account for this role</span>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const renderUsers = () => (
    <>
      <div className="user-layout">
        <div className="admin-card">
          <div className="admin-card-head">
            <div>
              <div className="admin-card-title"><i className="ti ti-shield-lock" /> Users and Roles</div>
              <div className="muted" style={{ marginTop: 4 }}>Role-first user management with restricted conversions.</div>
            </div>
            <div className="toolbar">
              <input className="input" placeholder={`Search ${userRoleTab.toLowerCase()}s`} value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as UserStatusFilter)}>
                <option value="ALL">All status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="RECENT">Recently added</option>
              </select>
            </div>
          </div>
          <div className="admin-card-body" style={{ paddingBottom: 0 }}>
            <div className="tabs">
              {userTabs.map((role) => (
                <button key={role} type="button" className={`tab-btn ${userRoleTab === role ? "active" : ""}`} onClick={() => setUserRoleTab(role)}>
                  {role}s
                </button>
              ))}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>{renderUsersTable(users)}</div>
          {users.length === 0 && <div className="empty">No {userRoleTab.toLowerCase()} users match these filters.</div>}
        </div>

        <div className="side-panel">
          <div className="rule-box">
            <h4>Role rules</h4>
            <p>Students and candidates can switch because Candidate is a temporary exam role. Admin and Faculty accounts must be created explicitly.</p>
          </div>
          <div className="rule-box">
            <h4>CSV upload</h4>
            <p>Admin, Faculty and Student CSVs create permanent accounts, generate missing passwords, and send credentials when SMTP is configured.</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => openCreateAccount(userRoleTab)}>
              <i className="ti ti-upload" /> Upload or create
            </button>
          </div>
          <div className="rule-box">
            <h4>Candidates</h4>
            <p>Candidate accounts stay tied to exam assignment. Use Candidate Assignment for temporary examination access.</p>
            <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setActiveTab("candidates")}>
              <i className="ti ti-user-plus" /> Assign candidates
            </button>
          </div>
        </div>
      </div>
      <button className="fab" type="button" aria-label="Add user" onClick={() => openCreateAccount(userRoleTab)}>
        <i className="ti ti-plus" />
      </button>
      {createOpen && renderCreateAccountModal()}
    </>
  );

  const renderCreateAccountModal = () => (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div className="modal-title">Create accounts</div>
          <button className="icon-btn" type="button" aria-label="Close" onClick={() => setCreateOpen(false)}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <select className="select" value={createRole} onChange={(e) => setCreateRole(e.target.value as UserRoleTab)}>
              <option value="Admin">Admin</option>
              <option value="Faculty">Faculty</option>
              <option value="Student">Student</option>
            </select>
            <button className="btn btn-secondary" type="button" onClick={() => accountFileRef.current?.click()}>
              <i className="ti ti-upload" /> CSV
            </button>
            <input ref={accountFileRef} type="file" accept=".csv" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadAccountCSV(file); }} />
          </div>
          <div className="form-row">
            <input className="input" placeholder="Full name" value={manualAccount.full_name} onChange={(e) => setManualAccount((row) => ({ ...row, full_name: e.target.value }))} />
            <input className="input" placeholder="Email" value={manualAccount.email} onChange={(e) => setManualAccount((row) => ({ ...row, email: e.target.value }))} />
            <input className="input" placeholder="Phone optional" value={manualAccount.phone} onChange={(e) => setManualAccount((row) => ({ ...row, phone: e.target.value }))} />
            <input className="input" placeholder="Password optional" value={manualAccount.password} onChange={(e) => setManualAccount((row) => ({ ...row, password: e.target.value }))} />
          </div>
          <button className="btn btn-secondary" type="button" onClick={addManualAccount}><i className="ti ti-plus" /> Add to batch</button>
          {accountRows.length > 0 && (
            <div className="preview-list">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Email</th><th>Password</th></tr></thead>
                <tbody>{accountRows.slice(0, 12).map((row, index) => <tr key={`${row.email}-${index}`}><td>{row.full_name}</td><td>{row.email}</td><td>{row.password ? "Provided" : "Auto"}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="muted" style={{ marginTop: 10 }}>CSV headers: name,email,phone,password. Password may be blank for auto-generation.</div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" type="button" onClick={() => setAccountRows([])}>Clear</button>
          <button className="btn btn-primary" type="button" disabled={!accountRows.length || createAccountsMutation.isPending} onClick={() => createAccountsMutation.mutate(accountRows)}>
            <i className="ti ti-mail" /> Create and email
          </button>
        </div>
      </div>
    </div>
  );

  const renderCandidates = () => (
    <div className="candidate-layout">
      <div className="admin-card compact-card">
        <div className="admin-card-head">
          <div>
            <div className="admin-card-title"><i className="ti ti-user-plus" /> Candidate Assignment</div>
            <div className="muted" style={{ marginTop: 4 }}>Batch temporary exam access by schedule.</div>
          </div>
          <span className="badge badge-candidate">{candidateRows.length} ready</span>
        </div>
        <div className="admin-card-body">
          <div className="section-strip">
            <strong>Schedule</strong>
            <span className="muted">{selectedScheduleLabel?.exams?.title ?? "Required before sending credentials"}</span>
          </div>
          <select className="select schedule-select" value={selectedSchedule} onChange={(e) => setSelectedSchedule(e.target.value)}>
            <option value="">Select entrance exam schedule</option>
            {schedules.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.exams?.title ?? "Entrance exam"} - {fmtDate(schedule.start_time)}
              </option>
            ))}
          </select>

          <div className="candidate-tools" style={{ marginTop: 14 }}>
            <div>
              <div className="section-strip">
                <strong>Add candidate</strong>
                <button className="btn btn-secondary" onClick={addManualCandidate}><i className="ti ti-plus" /> Add</button>
              </div>
              <div className="form-row">
                <input className="input" placeholder="Full name" value={manualCandidate.full_name} onChange={(e) => setManualCandidate((row) => ({ ...row, full_name: e.target.value }))} />
                <input className="input" placeholder="Email" value={manualCandidate.email} onChange={(e) => setManualCandidate((row) => ({ ...row, email: e.target.value }))} />
                <input className="input" placeholder="Phone optional" value={manualCandidate.phone} onChange={(e) => setManualCandidate((row) => ({ ...row, phone: e.target.value }))} />
                <input className="input" placeholder="Password optional" value={manualCandidate.temp_password} onChange={(e) => setManualCandidate((row) => ({ ...row, temp_password: e.target.value }))} />
              </div>
            </div>

            <div className="mini-upload" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) uploadCSV(file); }}>
              <i className="ti ti-upload" />
              <div>
                <p>Upload CSV</p>
                <small>name,email,phone,temp_password</small>
              </div>
              <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadCSV(file); }} />
            </div>
          </div>

          {candidateRows.length > 0 ? (
            <div>
              <div className="candidate-preview-head">
                <strong>{candidateRows.length} candidate(s) in batch</strong>
                <div className="toolbar">
                  <button className="btn btn-secondary" onClick={() => setCandidateRows([])}>Clear</button>
                  <button className="btn btn-primary" disabled={!selectedSchedule || assignMutation.isPending} onClick={() => assignMutation.mutate(candidateRows)}>
                    <i className="ti ti-mail" /> Send credentials
                  </button>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Password</th></tr></thead><tbody>
                  {candidateRows.slice(0, 12).map((row, index) => <tr key={`${row.email}-${index}`}><td>{row.full_name}</td><td>{row.email}</td><td>{row.phone || "-"}</td><td>{row.temp_password ? "Provided" : "Auto"}</td></tr>)}
                </tbody></table>
              </div>
            </div>
          ) : (
            <div className="empty" style={{ padding: "20px 0 8px" }}>Add candidates manually or import a CSV to preview the batch.</div>
          )}
        </div>
      </div>
      <div className="admin-card compact-card">
        <div className="admin-card-head">
          <div>
            <div className="admin-card-title"><i className="ti ti-list-check" /> Assigned Candidates</div>
            <div className="muted" style={{ marginTop: 4 }}>{selectedScheduleLabel?.exams?.title ?? "Select a schedule"}</div>
          </div>
          <span className="badge badge-off">{assignments.length}</span>
        </div>
        <div className="admin-card-body">
          {!selectedSchedule ? (
            <div className="empty">Choose a schedule to view assignments.</div>
          ) : assignments.length === 0 ? (
            <div className="empty">No candidates loaded for this schedule.</div>
          ) : (
            <div className="assigned-list">
              {assignments.map((row) => (
                <div className="assigned-row" key={row.assignment_id}>
                  <div className="assigned-row-main">
                    <div className="name-cell">{row.full_name}</div>
                    <div className="muted">{row.email}</div>
                  </div>
                  <div className="assigned-row-meta">
                    <span className="badge badge-candidate">{row.invitation_status}</span>
                    <div className="muted" style={{ marginTop: 5 }}>{row.attempt_status ?? "Not started"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderAudit = () => (
    <div className="admin-card">
      <div className="admin-card-head">
        <div>
          <div className="admin-card-title"><i className="ti ti-list-details" /> Audit Logs</div>
          <div className="muted" style={{ marginTop: 4 }}>Searchable event history for admin actions and system changes.</div>
        </div>
        <span className="badge badge-off">{auditData?.total ?? 0} events</span>
      </div>
      <div className="audit-toolbar">
        <input className="input" placeholder="Search action or target" value={auditSearch} onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(0); }} />
        <select className="select" value={auditAction} onChange={(e) => { setAuditAction(e.target.value); setAuditPage(0); }}>
          <option value="">All actions</option>
          {Array.from(new Set([...(data?.auditLogs ?? []), ...(auditData?.items ?? [])].map((log) => log.action).filter(Boolean))).map((action) => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>
        <select className="select" value={auditUser} onChange={(e) => { setAuditUser(e.target.value); setAuditPage(0); }}>
          <option value="">All users</option>
          {(data?.users ?? []).map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email}</option>)}
        </select>
        <input className="input" type="date" value={auditStart} onChange={(e) => { setAuditStart(e.target.value); setAuditPage(0); }} />
        <input className="input" type="date" value={auditEnd} onChange={(e) => { setAuditEnd(e.target.value); setAuditPage(0); }} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table audit-table">
          <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Status</th><th>IP Address</th><th>Details</th></tr></thead>
          <tbody>
            {auditLoading && <tr><td colSpan={7}><div className="empty">Loading audit logs...</div></td></tr>}
            {!auditLoading && (auditData?.items ?? []).length === 0 && <tr><td colSpan={7}><div className="empty">No audit logs match these filters.</div></td></tr>}
            {(auditData?.items ?? []).map((log) => {
              const status = auditStatus(log);
              const expanded = expandedAuditId === log.id;
              return (
                <Fragment key={log.id}>
                  <tr onClick={() => setExpandedAuditId(expanded ? null : log.id)}>
                    <td className="muted">{fmtDate(log.created_at)}</td>
                    <td><div className="name-cell">{log.users?.full_name ?? "System"}</div><div className="muted">{log.users?.email ?? "Automated event"}</div></td>
                    <td><span className="badge badge-off">{log.action}</span></td>
                    <td>{auditTarget(log)}</td>
                    <td><span className={`badge badge-${status}`}>{status}</span></td>
                    <td className="muted">{log.ip_address ?? "-"}</td>
                    <td><button className="btn btn-secondary" type="button">{expanded ? "Hide" : "View"}</button></td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={7}><pre className="audit-details">{auditDetails(log)}</pre></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span className="muted">Page {auditPage + 1} · Showing {(auditData?.items ?? []).length} of {auditData?.total ?? 0}</span>
        <div className="toolbar">
          <button className="btn btn-secondary" disabled={auditPage === 0} onClick={() => setAuditPage((page) => Math.max(0, page - 1))}>Previous</button>
          <button className="btn btn-secondary" disabled={(auditPage + 1) * auditLimit >= (auditData?.total ?? 0)} onClick={() => setAuditPage((page) => page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );

  const renderLoading = () => (
    <>
      <section className="hero">
        <div style={{ width: "min(460px,100%)" }}>
          <div className="skeleton sk-line" style={{ width: "60%", height: 28, marginBottom: 12 }} />
          <div className="skeleton sk-line" style={{ width: "85%" }} />
        </div>
        <div className="toolbar">
          <div className="skeleton" style={{ width: 38, height: 38 }} />
          <div className="skeleton" style={{ width: 120, height: 38 }} />
        </div>
      </section>
      <div className="admin-grid stats-grid" style={{ marginBottom: 18 }}>
        {[0, 1, 2, 3].map((item) => <div className="skeleton sk-card" key={item} />)}
      </div>
      <div className="admin-grid quick-actions">
        {[0, 1, 2, 3, 4, 5].map((item) => <div className="skeleton" style={{ height: 58, borderRadius: 14 }} key={item} />)}
      </div>
      <div className="skeleton sk-table" />
    </>
  );

  const content = () => {
    if (isLoading) return renderLoading();
    if (isError) return <div className="admin-card"><div className="empty">Could not load admin dashboard. Check the backend connection.</div></div>;
    if (activeTab === "users") return renderUsers();
    if (activeTab === "candidates") return renderCandidates();
    if (activeTab === "audit") return renderAudit();
    return renderOverview();
  };

  return (
    <div className="admin-shell student-app">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {mobileOpen && <button className="admin-mobile-scrim" type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`admin-sidebar student-sidebar ${sidebarCollapsed ? "collapsed sidebar-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="admin-brand student-brand">
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div className="admin-mark brand-mark"><img src="/auth-assets/tiet-logo.png" alt="TIET" /></div>
            <div className="admin-brand-copy brand-copy">
              <strong>WebAssess</strong>
              <span>Admin Portal</span>
            </div>
          </div>
          <button className="collapse-btn" type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label="Toggle sidebar">
            <i className={`ti ${sidebarCollapsed ? "ti-layout-sidebar-right-expand" : "ti-layout-sidebar-left-collapse"}`} />
          </button>
        </div>
        <nav className="admin-nav student-nav">
          <div className="admin-nav-label">Control Center</div>
          {[
            ["overview", "Dashboard", "ti-layout-dashboard"],
            ["users", "Users and Roles", "ti-shield-lock"],
            ["candidates", "Candidate Assignment", "ti-user-plus"],
            ["audit", "Audit Logs", "ti-list-details"],
          ].map(([key, label, icon]) => (
            <button key={key} className={activeTab === key ? "active" : ""} onClick={() => { setActiveTab(key as AdminTab); setMobileOpen(false); }}>
              <i className={`ti ${icon}`} /><span>{label}</span>
            </button>
          ))}
          <button onClick={() => { navigate("/admin/proctor"); setMobileOpen(false); }}>
            <i className="ti ti-device-desktop" /><span>Proctor Console</span>
          </button>
        </nav>
        <div className="admin-side-bottom sidebar-profile">
          <div className="avatar">{currentUser?.fullName?.slice(0, 1).toUpperCase() ?? "A"}</div>
          <div className="profile-copy"><strong>{currentUser?.fullName ?? "Admin"}</strong><span>{currentUser?.email ?? "System administrator"}</span></div>
          <button type="button" onClick={signOut} title="Sign out"><i className="ti ti-logout" /></button>
        </div>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar student-topbar">
          <div style={{ display: "flex", alignItems: "center" }}>
            <button className="admin-mobile-menu" type="button" aria-label="Open menu" onClick={() => setMobileOpen(true)}><i className="ti ti-menu-2" /></button>
            <div className="topbar-title"><span>Admin Portal</span><strong>{{ overview: "Dashboard", users: "Users and Roles", candidates: "Candidate Assignment", audit: "Audit Logs" }[activeTab]}</strong></div>
          </div>
          <div className="toolbar topbar-actions">
            <button className="topbar-user" onClick={() => setActiveTab("overview")} title="Admin profile"><div className="avatar small">{currentUser?.fullName?.slice(0, 1).toUpperCase() ?? "A"}</div><span>{currentUser?.fullName ?? "Admin"}</span></button>
          </div>
        </header>
        <main className="admin-content">
          {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
          {content()}
        </main>
      </section>
    </div>
  );
}
