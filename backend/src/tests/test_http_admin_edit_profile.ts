import http from 'http';
import bcrypt from 'bcryptjs';
import app from '../app';
import prisma from '../config/prisma';

const PORT = 5912;

async function runHttpTests() {
  console.log('=== STARTING HTTP END-TO-END TESTS: ADMIN EDIT PROFILE & DOCTOR IMAGE RULES ===\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Test HTTP server running on http://127.0.0.1:${PORT}`);
      resolve();
    });
  });

  const apiBase = `http://127.0.0.1:${PORT}/api`;
  const runId = Date.now().toString().slice(-6);

  let hospitalId = '';
  let adminUserId = '';
  let doctorUserId = '';
  let doctorId = '';
  let departmentId = '';

  try {
    // 1. Setup test Hospital, Department, Admin, and Doctor
    const hospital = await prisma.hospital.create({
      data: {
        name: `MedPulse HTTP Test Hospital ${runId}`,
        slug: `mp-http-test-${runId}`,
        code: `MPHT-${runId}`,
        address: '100 Med Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        phone: '080-40005000',
        email: `info-${runId}@medpulsetest.org`,
        emergencyContact: '108',
        openingHours: '24/7',
        about: 'HTTP End-to-end testing hospital',
        facilities: 'OPD, ICU, Lab',
      },
    });
    hospitalId = hospital.id;

    const dept = await prisma.department.create({
      data: {
        hospitalId: hospital.id,
        name: 'General Medicine',
        slug: `gen-med-${runId}`,
        code: `GM-${runId}`,
      },
    });
    departmentId = dept.id;

    const adminPassword = 'InitialPassword@2026';
    const adminUser = await prisma.user.create({
      data: {
        name: `Test Admin ${runId}`,
        email: `httpadmin-${runId}@medpulsetest.org`,
        phone: '9880011223',
        passwordHash: await bcrypt.hash(adminPassword, 10),
        role: 'HOSPITAL_ADMIN',
      },
    });
    adminUserId = adminUser.id;

    await prisma.hospitalAdmin.create({
      data: {
        userId: adminUser.id,
        hospitalId: hospital.id,
        roleTitle: 'Senior Hospital Administrator',
      },
    });

    const docUser = await prisma.user.create({
      data: {
        name: `Dr. Test Image ${runId}`,
        email: `httpdoc-${runId}@medpulsetest.org`,
        phone: '9880011224',
        passwordHash: await bcrypt.hash(adminPassword, 10),
        role: 'DOCTOR',
      },
    });
    doctorUserId = docUser.id;

    const doc = await prisma.doctor.create({
      data: {
        userId: docUser.id,
        hospitalId: hospital.id,
        departmentId: dept.id,
        name: `Dr. Test Image ${runId}`,
        photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300', // Simulate legacy stock photo in DB
        qualification: 'MBBS, MD',
        specialization: 'General Physician',
        languages: 'English',
        about: 'Test doctor',
        workingDays: 'Mon,Tue,Wed,Thu,Fri',
      },
    });
    doctorId = doc.id;

    // ---------------------------------------------------------
    // HTTP TEST 1: Doctor Profile Image Display Rules via /api/doctors
    // ---------------------------------------------------------
    console.log('\n--- HTTP TEST 1: GET /api/doctors Sanitizes Stock Doctor Photos ---');
    const docsRes = await fetch(`${apiBase}/doctors?hospitalId=${hospital.id}`);
    const docsJson: any = await docsRes.json();
    if (docsRes.status !== 200 || !docsJson.success) {
      throw new Error('Failed to fetch doctors');
    }
    const fetchedDoc = docsJson.data.find((d: any) => d.id === doctorId);
    if (!fetchedDoc) throw new Error('Test doctor not returned by API');
    if (fetchedDoc.photoUrl !== null) {
      throw new Error(`FAIL: Expected null photoUrl for stock image, got ${fetchedDoc.photoUrl}`);
    }
    console.log('✓ PASS: /api/doctors returned photoUrl: null instead of stock/unsplash image.');

    // Verify genuine uploaded photo is returned properly
    await prisma.doctor.update({
      where: { id: doctorId },
      data: { photoUrl: '/uploads/avatars/doc-real-uploaded.jpg' },
    });
    const docsRes2 = await fetch(`${apiBase}/doctors?hospitalId=${hospital.id}`);
    const docsJson2: any = await docsRes2.json();
    const fetchedDoc2 = docsJson2.data.find((d: any) => d.id === doctorId);
    if (fetchedDoc2.photoUrl !== '/uploads/avatars/doc-real-uploaded.jpg') {
      throw new Error(`FAIL: Genuine uploaded photo was filtered: ${fetchedDoc2.photoUrl}`);
    }
    console.log('✓ PASS: /api/doctors preserves genuine uploaded doctor photoUrl.');

    // Verify removing uploaded photo sets it back to null
    await prisma.doctor.update({
      where: { id: doctorId },
      data: { photoUrl: null },
    });
    const docsRes3 = await fetch(`${apiBase}/doctors?hospitalId=${hospital.id}`);
    const docsJson3: any = await docsRes3.json();
    const fetchedDoc3 = docsJson3.data.find((d: any) => d.id === doctorId);
    if (fetchedDoc3.photoUrl !== null) {
      throw new Error('FAIL: Removed photo was not cleared');
    }
    console.log('✓ PASS: Removed doctor photo returns null so blank profile area is displayed.');

    // ---------------------------------------------------------
    // HTTP TEST 2: Security - Unauthenticated & RBAC Guards
    // ---------------------------------------------------------
    console.log('\n--- HTTP TEST 2: Auth & RBAC Security Guards ---');
    const unauthRes = await fetch(`${apiBase}/admin/admin-profile`);
    if (unauthRes.status !== 401) {
      throw new Error(`FAIL: Expected 401 unauthenticated, got ${unauthRes.status}`);
    }
    console.log('✓ PASS: Unauthenticated access blocked with 401.');

    const docLoginRes = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: docUser.email, password: adminPassword }),
    });
    const docLoginJson: any = await docLoginRes.json();
    const docToken = docLoginJson.data.accessToken;

    const rbacRes = await fetch(`${apiBase}/admin/admin-profile`, {
      headers: { Authorization: `Bearer ${docToken}` },
    });
    if (rbacRes.status !== 403) {
      throw new Error(`FAIL: Expected 403 for DOCTOR accessing admin profile, got ${rbacRes.status}`);
    }
    console.log('✓ PASS: Non-admin user (DOCTOR) blocked with 403 Forbidden.');

    // ---------------------------------------------------------
    // HTTP TEST 3: Admin Login & View Profile Details
    // ---------------------------------------------------------
    console.log('\n--- HTTP TEST 3: Admin Login & GET /api/admin/admin-profile ---');
    const loginRes = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminUser.email, password: adminPassword }),
    });
    const loginJson: any = await loginRes.json();
    let accessToken = loginJson.data.accessToken;

    const getProfRes = await fetch(`${apiBase}/admin/admin-profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const getProfJson: any = await getProfRes.json();
    if (getProfRes.status !== 200 || !getProfJson.success) {
      throw new Error('FAIL: Could not fetch admin profile');
    }
    if (
      getProfJson.data.admin.name !== adminUser.name ||
      getProfJson.data.hospital.name !== hospital.name ||
      getProfJson.data.admin.designation !== 'Senior Hospital Administrator'
    ) {
      throw new Error('FAIL: Admin profile fields mismatch');
    }
    console.log('✓ PASS: GET /api/admin/admin-profile returned complete Admin & Hospital details.');

    // ---------------------------------------------------------
    // HTTP TEST 4: PATCH /api/admin/admin-profile & Role/HospitalId Lock
    // ---------------------------------------------------------
    console.log('\n--- HTTP TEST 4: PATCH /api/admin/admin-profile & Tamper Guard ---');
    const patchRes = await fetch(`${apiBase}/admin/admin-profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        adminName: `Updated Admin ${runId}`,
        phone: '9998887776',
        designation: 'Chief Executive Medical Officer',
        hospitalName: `Updated Hospital ${runId}`,
        hospitalAddress: '202 Wellness Plaza',
        city: 'Mysuru',
        state: 'Karnataka',
        pincode: '570001',
        role: 'SUPER_ADMIN', // Attempt privilege escalation
        hospitalId: '00000000-0000-0000-0000-000000000000', // Attempt hospitalId tamper
      }),
    });
    const patchJson: any = await patchRes.json();
    // Note: hospitalAdminGuard in middleware explicitly blocks mismatched body.hospitalId with 403!
    // Let's verify how middleware handles body.hospitalId:
    if (patchRes.status === 403) {
      console.log('✓ PASS: Security middleware blocked hospitalId tampering attempt with 403!');
      // Now send legitimate update without body.hospitalId
      const validPatchRes = await fetch(`${apiBase}/admin/admin-profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          adminName: `Updated Admin ${runId}`,
          phone: '9998887776',
          designation: 'Chief Executive Medical Officer',
          hospitalName: `Updated Hospital ${runId}`,
          hospitalAddress: '202 Wellness Plaza',
          city: 'Mysuru',
          state: 'Karnataka',
          pincode: '570001',
          role: 'SUPER_ADMIN', // Should be stripped/ignored by service
        }),
      });
      const validPatchJson: any = await validPatchRes.json();
      if (validPatchRes.status !== 200 || !validPatchJson.success) {
        throw new Error(`FAIL: Valid PATCH failed: ${validPatchJson.message}`);
      }
      if (validPatchJson.data.admin.role !== 'HOSPITAL_ADMIN') {
        throw new Error('SECURITY VIOLATION: Role was modified!');
      }
      if (validPatchJson.data.admin.name !== `Updated Admin ${runId}`) {
        throw new Error('FAIL: Admin name was not updated');
      }
      console.log('✓ PASS: Legitimate update persisted and role escalation attempt was ignored.');
    } else if (patchRes.status === 200) {
      if (patchJson.data.admin.role !== 'HOSPITAL_ADMIN' || patchJson.data.hospital.id !== hospital.id) {
        throw new Error('SECURITY VIOLATION: Role or Hospital ID was altered');
      }
      console.log('✓ PASS: Update persisted while Role and Hospital ID remained locked.');
    } else {
      throw new Error(`Unexpected status ${patchRes.status}`);
    }

    // ---------------------------------------------------------
    // HTTP TEST 5: Email Change OTP Verification & Session Maintenance
    // ---------------------------------------------------------
    console.log('\n--- HTTP TEST 5: Email Change OTP Flow & Session Update ---');
    const newEmail = `updated-httpadmin-${runId}@medpulsetest.org`;
    const reqOtpRes = await fetch(`${apiBase}/admin/admin-profile/change-email/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ newEmail }),
    });
    const reqOtpJson: any = await reqOtpRes.json();
    if (reqOtpRes.status !== 200 || !reqOtpJson.data.demoOtp) {
      throw new Error(`FAIL: Request OTP failed: ${reqOtpJson.message}`);
    }
    const otpCode = reqOtpJson.data.demoOtp;
    console.log(`✓ PASS: Email verification OTP requested (${otpCode}).`);

    const verOtpRes = await fetch(`${apiBase}/admin/admin-profile/change-email/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ newEmail, otpCode }),
    });
    const verOtpJson: any = await verOtpRes.json();
    if (verOtpRes.status !== 200 || !verOtpJson.data.accessToken) {
      throw new Error(`FAIL: Verify OTP failed: ${verOtpJson.message}`);
    }
    accessToken = verOtpJson.data.accessToken;

    // Verify new token works seamlessly with /api/auth/me and has updated email
    const meRes = await fetch(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const meJson: any = await meRes.json();
    if (meRes.status !== 200 || meJson.data.email !== newEmail) {
      throw new Error('FAIL: Session /auth/me does not reflect new email');
    }
    console.log('✓ PASS: Verified OTP, updated email in auth & DB, and maintained active session.');

    // ---------------------------------------------------------
    // HTTP TEST 6: Change Password Endpoint & Login Verification
    // ---------------------------------------------------------
    console.log('\n--- HTTP TEST 6: Password Change & Re-Authentication ---');
    const newPassword = 'StrongNewAdminPwd#2026';

    const wrongPwdRes = await fetch(`${apiBase}/admin/admin-profile/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'WrongPassword!',
        newPassword,
        confirmPassword: newPassword,
      }),
    });
    if (wrongPwdRes.status !== 400) {
      throw new Error('FAIL: Should reject wrong current password with 400');
    }
    console.log('✓ PASS: Incorrect current password rejected with 400.');

    const chgPwdRes = await fetch(`${apiBase}/admin/admin-profile/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        currentPassword: adminPassword,
        newPassword,
        confirmPassword: newPassword,
      }),
    });
    const chgPwdJson: any = await chgPwdRes.json();
    if (chgPwdRes.status !== 200 || !chgPwdJson.data.accessToken) {
      throw new Error(`FAIL: Password change failed: ${chgPwdJson.message}`);
    }
    console.log('✓ PASS: Password updated successfully via HTTP endpoint.');

    // Verify new login works with updated email + new password
    const newLoginRes = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, password: newPassword }),
    });
    if (newLoginRes.status !== 200) {
      throw new Error('FAIL: Login failed with updated email and new password!');
    }
    console.log('✓ PASS: Login verified with new email and new password.');

    console.log('\n=== ALL HTTP END-TO-END TESTS PASSED SUCCESSFULLY! ===');
  } catch (err: any) {
    console.error('\nHTTP TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    // Cleanup
    if (doctorId) await prisma.doctor.deleteMany({ where: { id: doctorId } });
    if (departmentId) await prisma.department.deleteMany({ where: { id: departmentId } });
    if (adminUserId) {
      await prisma.auditLog.deleteMany({ where: { userId: adminUserId } });
      await prisma.hospitalAdmin.deleteMany({ where: { userId: adminUserId } });
      await prisma.user.deleteMany({ where: { id: adminUserId } });
    }
    if (doctorUserId) {
      await prisma.auditLog.deleteMany({ where: { userId: doctorUserId } });
      await prisma.user.deleteMany({ where: { id: doctorUserId } });
    }
    if (hospitalId) {
      await prisma.hospital.deleteMany({ where: { id: hospitalId } });
    }
    await prisma.accountToken.deleteMany({ where: { email: { contains: runId } } });
    await prisma.$disconnect();
    server.close();
  }
}

runHttpTests();
