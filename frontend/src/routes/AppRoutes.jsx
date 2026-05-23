import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicRoute, RoleRoute } from './Guards';
import { lazy, Suspense } from 'react';

// ─── Lazy imports ─────────────────────────────────────────────
const LoginPage        = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage     = lazy(() => import('@/pages/auth/RegisterPage'));

// Patient
const PatientLayout    = lazy(() => import('@/components/layout/PatientLayout'));
const PatientDashboard = lazy(() => import('@/pages/patient/Dashboard'));
const PatientGoals     = lazy(() => import('@/pages/patient/Goals'));
const PatientRewards   = lazy(() => import('@/pages/patient/Rewards'));
const PatientExams     = lazy(() => import('@/pages/patient/Exams'));
const PatientTriage    = lazy(() => import('@/pages/patient/Triage'));
const PatientReports   = lazy(() => import('@/pages/patient/Reports'));
const PatientAppointments = lazy(() => import('@/pages/patient/Appointments'));
const PatientProfile   = lazy(() => import('@/pages/patient/Profile'));

// Doctor
const DoctorLayout     = lazy(() => import('@/components/layout/DoctorLayout'));
const DoctorDashboard  = lazy(() => import('@/pages/doctor/Dashboard'));
const DoctorPatients   = lazy(() => import('@/pages/doctor/Patients'));
const DoctorPatientDetail = lazy(() => import('@/pages/doctor/PatientDetail'));
const DoctorAppointments  = lazy(() => import('@/pages/doctor/Appointments'));
const DoctorWearable   = lazy(() => import('@/pages/doctor/Wearable'));
const DoctorReports    = lazy(() => import('@/pages/doctor/Reports'));
const DoctorHistory    = lazy(() => import('@/pages/doctor/History'));
const DoctorReference  = lazy(() => import('@/pages/doctor/Reference'));
const DoctorProfile    = lazy(() => import('@/pages/doctor/Profile'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin" />
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Público */}
        <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

        {/* Paciente */}
        <Route path="/patient" element={<RoleRoute role="PATIENT"><PatientLayout /></RoleRoute>}>
          <Route index                  element={<PatientDashboard />} />
          <Route path="goals"           element={<PatientGoals />} />
          <Route path="rewards"         element={<PatientRewards />} />
          <Route path="exams"           element={<PatientExams />} />
          <Route path="triage"          element={<PatientTriage />} />
          <Route path="reports"         element={<PatientReports />} />
          <Route path="appointments"    element={<PatientAppointments />} />
          <Route path="profile"         element={<PatientProfile />} />
        </Route>

        {/* Médico */}
        <Route path="/doctor" element={<RoleRoute role="DOCTOR"><DoctorLayout /></RoleRoute>}>
          <Route index                       element={<DoctorDashboard />} />
          <Route path="patients"             element={<DoctorPatients />} />
          <Route path="patients/:patientId"  element={<DoctorPatientDetail />} />
          <Route path="wearable"             element={<DoctorWearable />} />
          <Route path="reports"              element={<DoctorReports />} />
          <Route path="history"              element={<DoctorHistory />} />
          <Route path="appointments"         element={<DoctorAppointments />} />
          <Route path="reference"            element={<DoctorReference />} />
          <Route path="profile"              element={<DoctorProfile />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
