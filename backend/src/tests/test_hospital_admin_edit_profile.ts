import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { AdminService } from '../services/admin.service';
import { sanitizeDoctorPhotoUrl } from '../services/doctor.service';

async function runTests() {
  console.log('=== STARTING HOSPITAL ADMIN EDIT PROFILE & DOCTOR PHOTO TESTS ===\n');
  const runId = Date.now().toString().slice(-6);

  try {
    // ----------------------------------------------------
    // TEST 1: Doctor Profile Image Display Rules (Backend Sanitization)
    // ----------------------------------------------------
    console.log('--- TEST 1: Doctor Profile Image Sanitization ---');
    const unsplashPhoto = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300';
    const dicebearPhoto = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix';
    const pravatarPhoto = 'https://i.pravatar.cc/300';
    const customUploadedPhoto = '/uploads/avatars/avatar-doc-12345.jpg';
    const base64UploadedPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';

    if (sanitizeDoctorPhotoUrl(unsplashPhoto) !== null) {
      throw new Error('FAIL: Unsplash doctor photo was not sanitized to null');
    }
    if (sanitizeDoctorPhotoUrl(dicebearPhoto) !== null) {
      throw new Error('FAIL: Dicebear doctor photo was not sanitized to null');
    }
    if (sanitizeDoctorPhotoUrl(pravatarPhoto) !== null) {
      throw new Error('FAIL: Pravatar doctor photo was not sanitized to null');
    }
    if (sanitizeDoctorPhotoUrl(null) !== null || sanitizeDoctorPhotoUrl('') !== null) {
      throw new Error('FAIL: Empty photo was not sanitized to null');
    }
    if (sanitizeDoctorPhotoUrl(customUploadedPhoto) !== customUploadedPhoto) {
      throw new Error('FAIL: Genuine uploaded doctor photo was incorrectly filtered');
    }
    if (sanitizeDoctorPhotoUrl(base64UploadedPhoto) !== base64UploadedPhoto) {
      throw new Error('FAIL: Genuine base64 uploaded doctor photo was incorrectly filtered');
    }
    console.log('✓ PASS: Doctor Profile Image display rules strictly block stock/random images and allow uploaded images.\n');

    // ----------------------------------------------------
    // SETUP: Test Hospital & Hospital Admin User
    // ----------------------------------------------------
    console.log('--- Setting up test Hospital & Admin User ---');
    const hospital = await prisma.hospital.create({
      data: {
        name: `City Care Hospital ${runId}`,
        slug: `city-care-${runId}`,
        code: `CCH-${runId}`,
        address: '42 Healthcare Blvd',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600001',
        phone: '044-24567890',
        email: `contact-${runId}@citycare.org`,
        emergencyContact: '108',
        openingHours: '24/7',
        about: 'Comprehensive multi-specialty care hospital.',
        facilities: 'Emergency, ICU, OPD, Inpatient, Diagnostics, Pharmacy',
      },
    });

    const initialPassword = 'AdminPassword@2026';
    const passwordHash = await bcrypt.hash(initialPassword, 10);
    const adminUser = await prisma.user.create({
      data: {
        name: `Dr. Suresh Admin ${runId}`,
        email: `admin-${runId}@citycare.org`,
        phone: '9876500001',
        passwordHash,
        role: 'HOSPITAL_ADMIN',
      },
    });

    const hospitalAdmin = await prisma.hospitalAdmin.create({
      data: {
        userId: adminUser.id,
        hospitalId: hospital.id,
        roleTitle: 'Chief Medical Administrator',
      },
    });

    console.log(`Created test hospital: ${hospital.name} (Code: ${hospital.code})`);
    console.log(`Created test admin user: ${adminUser.name} (${adminUser.email})\n`);

    // ----------------------------------------------------
    // TEST 2: Get Admin Profile Details
    // ----------------------------------------------------
    console.log('--- TEST 2: Retrieve Hospital Admin Profile Details ---');
    const profile = await AdminService.getAdminProfile(adminUser.id, hospital.id);

    if (!profile.admin || !profile.hospital) {
      throw new Error('FAIL: Profile structure incomplete');
    }
    if (profile.admin.name !== adminUser.name) {
      throw new Error(`FAIL: Admin name mismatch: ${profile.admin.name}`);
    }
    if (profile.admin.email !== adminUser.email) {
      throw new Error(`FAIL: Admin email mismatch: ${profile.admin.email}`);
    }
    if (profile.admin.designation !== 'Chief Medical Administrator') {
      throw new Error(`FAIL: Admin designation mismatch: ${profile.admin.designation}`);
    }
    if (profile.hospital.name !== hospital.name) {
      throw new Error(`FAIL: Hospital name mismatch: ${profile.hospital.name}`);
    }
    if (profile.hospital.address !== '42 Healthcare Blvd') {
      throw new Error(`FAIL: Hospital address mismatch: ${profile.hospital.address}`);
    }
    console.log('✓ PASS: Profile Details retrieved correctly:');
    console.log('  • Hospital Name:', profile.hospital.name);
    console.log('  • Admin Name:', profile.admin.name);
    console.log('  • Registered Email:', profile.admin.email);
    console.log('  • Contact Number:', profile.admin.phone);
    console.log('  • Hospital Address:', `${profile.hospital.address}, ${profile.hospital.city}, ${profile.hospital.state} - ${profile.hospital.pincode}`);
    console.log('  • Designation:', profile.admin.designation);
    console.log('');

    // ----------------------------------------------------
    // TEST 3: Update Profile Details & Security Restrictions
    // ----------------------------------------------------
    console.log('--- TEST 3: Save Profile Changes & Security Guards ---');
    const updatePayload = {
      adminName: `Dr. Suresh V. Admin ${runId}`,
      phone: '9876599999',
      designation: 'Managing Director & Medical Superintendent',
      hospitalName: `City Care Super Specialty Hospital ${runId}`,
      hospitalAddress: '99 Premier Health Way',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      pincode: '641001',
      // Attacking role & hospitalId modification:
      role: 'SUPER_ADMIN',
      hospitalId: 'hacked-hospital-id',
    };

    const updatedProfile = await AdminService.updateAdminProfile(
      adminUser.id,
      hospital.id,
      updatePayload,
      'HOSPITAL_ADMIN'
    );

    if (updatedProfile.admin.name !== `Dr. Suresh V. Admin ${runId}`) {
      throw new Error('FAIL: Admin name was not updated');
    }
    if (updatedProfile.admin.phone !== '9876599999') {
      throw new Error('FAIL: Admin phone was not updated');
    }
    if (updatedProfile.admin.designation !== 'Managing Director & Medical Superintendent') {
      throw new Error('FAIL: Admin designation was not updated');
    }
    if (updatedProfile.hospital.name !== `City Care Super Specialty Hospital ${runId}`) {
      throw new Error('FAIL: Hospital name was not updated');
    }
    if (updatedProfile.hospital.address !== '99 Premier Health Way') {
      throw new Error('FAIL: Hospital address was not updated');
    }
    // Security check: role must remain HOSPITAL_ADMIN
    if (updatedProfile.admin.role !== 'HOSPITAL_ADMIN') {
      throw new Error('SECURITY VIOLATION: Admin was able to modify their role!');
    }
    // Security check: hospital ID must remain unchanged
    if (updatedProfile.hospital.id !== hospital.id) {
      throw new Error('SECURITY VIOLATION: Admin was able to modify their hospital ID!');
    }
    console.log('✓ PASS: Profile Details updated and persisted in database.');
    console.log('✓ PASS: Security verified - Role and Hospital ID are strictly protected against modification.\n');

    // ----------------------------------------------------
    // TEST 4: Request Email Change OTP
    // ----------------------------------------------------
    console.log('--- TEST 4: Request Email Change OTP ---');
    const newTargetEmail = `newadmin-${runId}@citycare.org`;

    // 4a. Reject same email
    try {
      await AdminService.requestEmailChangeOtp(adminUser.id, hospital.id, adminUser.email);
      throw new Error('FAIL: Allowed requesting change to current email');
    } catch (err: any) {
      if (!err.message.includes('must be different')) throw err;
      console.log('✓ PASS: Rejected email update to identical current email');
    }

    // 4b. Request OTP for valid new email
    const otpRes = await AdminService.requestEmailChangeOtp(adminUser.id, hospital.id, newTargetEmail);
    if (!otpRes.success || !otpRes.demoOtp) {
      throw new Error('FAIL: OTP generation response failed');
    }
    console.log(`✓ PASS: OTP generated and sent for ${newTargetEmail}. OTP code: ${otpRes.demoOtp}`);

    // 4c. Reject invalid OTP code
    try {
      await AdminService.verifyEmailChangeOtp(adminUser.id, hospital.id, newTargetEmail, '000000');
      throw new Error('FAIL: Verified with invalid OTP');
    } catch (err: any) {
      if (!err.message.includes('Invalid or expired')) throw err;
      console.log('✓ PASS: Rejected invalid OTP code');
    }

    // 4d. Verify with correct OTP code and finalize email change
    const verifyRes = await AdminService.verifyEmailChangeOtp(
      adminUser.id,
      hospital.id,
      newTargetEmail,
      otpRes.demoOtp
    );
    if (!verifyRes.success || !verifyRes.accessToken) {
      throw new Error('FAIL: Verification did not return new accessToken');
    }
    if (verifyRes.user.email !== newTargetEmail) {
      throw new Error(`FAIL: User email in response mismatch: ${verifyRes.user.email}`);
    }

    // Check DB persistence
    const userInDb = await prisma.user.findUnique({ where: { id: adminUser.id } });
    if (userInDb?.email !== newTargetEmail) {
      throw new Error('FAIL: Email not updated in database');
    }
    console.log('✓ PASS: Verified OTP and updated email in authentication system and database.');
    console.log('✓ PASS: Refreshed JWT tokens issued to maintain active session securely.\n');

    // ----------------------------------------------------
    // TEST 5: Change Password
    // ----------------------------------------------------
    console.log('--- TEST 5: Change Password & Security Verification ---');
    const newStrongPassword = 'NewSecurePassword@2026!';

    // 5a. Reject incorrect current password
    try {
      await AdminService.changeAdminPassword(
        adminUser.id,
        hospital.id,
        'WrongCurrentPassword123',
        newStrongPassword,
        newStrongPassword
      );
      throw new Error('FAIL: Accepted incorrect current password');
    } catch (err: any) {
      if (!err.message.includes('Incorrect current password')) throw err;
      console.log('✓ PASS: Rejected incorrect current password');
    }

    // 5b. Reject mismatched confirm password
    try {
      await AdminService.changeAdminPassword(
        adminUser.id,
        hospital.id,
        initialPassword,
        newStrongPassword,
        'MismatchedPassword@123'
      );
      throw new Error('FAIL: Accepted mismatched passwords');
    } catch (err: any) {
      if (!err.message.includes('do not match')) throw err;
      console.log('✓ PASS: Rejected mismatched confirm password');
    }

    // 5c. Reject weak password
    try {
      await AdminService.changeAdminPassword(
        adminUser.id,
        hospital.id,
        initialPassword,
        'weak',
        'weak'
      );
      throw new Error('FAIL: Accepted weak password');
    } catch (err: any) {
      if (!err.message.includes('at least 8 characters')) throw err;
      console.log('✓ PASS: Rejected weak password (strength validation enforced)');
    }

    // 5d. Successful password change
    const pwdRes = await AdminService.changeAdminPassword(
      adminUser.id,
      hospital.id,
      initialPassword,
      newStrongPassword,
      newStrongPassword
    );
    if (!pwdRes.success || !pwdRes.accessToken) {
      throw new Error('FAIL: Password change response failed');
    }

    // 5e. Verify new password works and old password no longer works
    const reloadedUser = await prisma.user.findUnique({ where: { id: adminUser.id } });
    const isOldValid = await bcrypt.compare(initialPassword, reloadedUser!.passwordHash);
    const isNewValid = await bcrypt.compare(newStrongPassword, reloadedUser!.passwordHash);

    if (isOldValid) {
      throw new Error('FAIL: Old password is still valid!');
    }
    if (!isNewValid) {
      throw new Error('FAIL: New password hash verification failed!');
    }
    console.log('✓ PASS: Password successfully verified, securely hashed with bcrypt, and updated.');
    console.log('✓ PASS: Refreshed authentication session tokens generated.\n');

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('--- Cleaning up test records ---');
    await prisma.accountToken.deleteMany({ where: { email: newTargetEmail } });
    await prisma.auditLog.deleteMany({ where: { userId: adminUser.id } });
    await prisma.hospitalAdmin.deleteMany({ where: { userId: adminUser.id } });
    await prisma.user.delete({ where: { id: adminUser.id } });
    await prisma.hospital.delete({ where: { id: hospital.id } });

    console.log('=== ALL TESTS PASSED SUCCESSFULLY! ===');
  } catch (err: any) {
    console.error('TEST ERROR:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
