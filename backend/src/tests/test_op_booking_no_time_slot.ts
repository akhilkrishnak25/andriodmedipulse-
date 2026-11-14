import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import prisma from '../config/prisma';
import { createAppointmentSchema } from '../validators/schemas';
import { AppointmentService } from '../services/appointment.service';
import { generateDigitalOpPdf } from '../utils/pdf';

async function runTests() {
  console.log('=== STARTING OP APPOINTMENT BOOKING (NO TIME-SLOT SELECTION) TESTS ===\n');
  const runId = Date.now().toString().slice(-6);

  try {
    // ----------------------------------------------------
    // TEST 1: Schema Validation Without timeSlot
    // ----------------------------------------------------
    console.log('--- TEST 1: Schema Validation without timeSlot ---');

    const basePayload = {
      hospitalId: 'hosp-123',
      doctorId: 'doc-123',
      departmentId: 'dept-123',
      appointmentDate: '2026-11-20',
      patient: {
        fullName: 'Ramesh Patel',
        mobileNumber: '9876543210',
        email: 'ramesh.patel@example.com',
        age: 42,
        gender: 'Male',
        bloodGroup: 'O+',
      },
      notes: 'General checkup',
    };

    // 1A: Payload with omitted timeSlot
    const parsed1 = createAppointmentSchema.parse({ ...basePayload });
    if (parsed1.timeSlot !== 'OPD Consultation') {
      throw new Error(`FAIL 1A: Expected timeSlot 'OPD Consultation', got '${parsed1.timeSlot}'`);
    }
    console.log('  ✓ 1A: Omitted timeSlot correctly defaulted to "OPD Consultation"');

    // 1B: Payload with null timeSlot
    const parsed2 = createAppointmentSchema.parse({ ...basePayload, timeSlot: null });
    if (parsed2.timeSlot !== 'OPD Consultation') {
      throw new Error(`FAIL 1B: Expected timeSlot 'OPD Consultation', got '${parsed2.timeSlot}'`);
    }
    console.log('  ✓ 1B: Null timeSlot correctly transformed to "OPD Consultation"');

    // 1C: Payload with empty string timeSlot
    const parsed3 = createAppointmentSchema.parse({ ...basePayload, timeSlot: '   ' });
    if (parsed3.timeSlot !== 'OPD Consultation') {
      throw new Error(`FAIL 1C: Expected timeSlot 'OPD Consultation', got '${parsed3.timeSlot}'`);
    }
    console.log('  ✓ 1C: Empty string timeSlot correctly transformed to "OPD Consultation"');

    // 1D: Payload with explicit legacy slot
    const parsed4 = createAppointmentSchema.parse({ ...basePayload, timeSlot: '10:30 AM' });
    if (parsed4.timeSlot !== '10:30 AM') {
      throw new Error(`FAIL 1D: Expected timeSlot '10:30 AM', got '${parsed4.timeSlot}'`);
    }
    console.log('  ✓ 1D: Explicit legacy timeSlot ("10:30 AM") preserved for backward compatibility');

    // ----------------------------------------------------
    // SETUP: Test Hospital, Department, and Doctor
    // ----------------------------------------------------
    console.log('\n--- SETUP: Creating Hospital, Department & Doctor with Working Schedule ---');

    const hospital = await prisma.hospital.create({
      data: {
        name: `Sunrise Care Hospital ${runId}`,
        slug: `sunrise-care-${runId}`,
        code: `SCH-${runId}`,
        address: '100 Medical Enclave',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        phone: '9845011111',
        emergencyContact: '9845099999',
        email: `contact-${runId}@sunrisecare.org`,
        openingHours: '24/7 Outpatient & Emergency',
        about: 'Leading multidisciplinary hospital providing tertiary healthcare.',
        facilities: 'ICU,OPD,Pharmacy,Diagnostic Labs,Ambulance',
      },
    });

    const department = await prisma.department.create({
      data: {
        name: `General Medicine ${runId}`,
        slug: `general-medicine-${runId}`,
        code: `GM-${runId}`,
        description: 'Comprehensive outpatient medical diagnostics',
        hospitalId: hospital.id,
      },
    });

    const doctor = await prisma.doctor.create({
      data: {
        name: `Dr. Ananya Sharma ${runId}`,
        hospitalId: hospital.id,
        departmentId: department.id,
        qualification: 'MBBS, MD (Medicine)',
        specialization: 'Internal Medicine & Outpatient Care',
        experienceYears: 12,
        consultationFee: 600,
        languages: 'English, Hindi, Kannada',
        workingDays: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
        workingHoursStart: '09:00',
        workingHoursEnd: '17:00',
        slotDurationMinutes: 30,
        about: 'Consultant physician specializing in adult internal medicine.',
        isActive: true,
      },
    });

    console.log(`  • Hospital created: ${hospital.name} (${hospital.id})`);
    console.log(`  • Doctor created: ${doctor.name} (${doctor.id})`);

    // ----------------------------------------------------
    // TEST 2: Patient 1 Books OP Appointment Without Time Slot
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Patient 1 Books OP Appointment without Time Slot ---');
    const testDate = '2026-11-20'; // Friday

    const booking1 = await AppointmentService.createPendingAppointment({
      hospitalId: hospital.id,
      doctorId: doctor.id,
      departmentId: department.id,
      appointmentDate: testDate,
      // timeSlot omitted completely
      patient: {
        fullName: 'Kiran Rao',
        mobileNumber: '9876500001',
        email: 'kiran.rao@example.com',
        age: 38,
        gender: 'Female',
        bloodGroup: 'B+',
      },
      notes: 'Routine fever and consultation',
    });

    if (booking1.appointment.timeSlot !== 'OPD Consultation') {
      throw new Error(`FAIL 2: Expected timeSlot 'OPD Consultation', got '${booking1.appointment.timeSlot}'`);
    }
    if (booking1.appointment.tokenNumber !== 1) {
      throw new Error(`FAIL 2: Expected queue token 1, got ${booking1.appointment.tokenNumber}`);
    }
    console.log(`  ✓ Patient 1 OP Appointment Created: ${booking1.appointment.appointmentNumber}`);
    console.log(`    Time Slot: "${booking1.appointment.timeSlot}", Token: #${booking1.appointment.tokenNumber}`);

    // ----------------------------------------------------
    // TEST 3: Patient 2 Books Same Doctor on Same Date Without Time Slot
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Patient 2 Books Same Doctor on Same Date (Auto-Queue Token) ---');

    const booking2 = await AppointmentService.createPendingAppointment({
      hospitalId: hospital.id,
      doctorId: doctor.id,
      departmentId: department.id,
      appointmentDate: testDate,
      timeSlot: 'OPD Consultation',
      patient: {
        fullName: 'Meera Nair',
        mobileNumber: '9876500002',
        email: 'meera.nair@example.com',
        age: 29,
        gender: 'Female',
        bloodGroup: 'A+',
      },
      notes: 'Blood pressure check',
    });

    if (booking2.appointment.timeSlot !== 'OPD Consultation') {
      throw new Error(`FAIL 3: Expected timeSlot 'OPD Consultation', got '${booking2.appointment.timeSlot}'`);
    }
    if (booking2.appointment.tokenNumber !== 2) {
      throw new Error(`FAIL 3: Expected queue token 2, got ${booking2.appointment.tokenNumber}`);
    }
    console.log(`  ✓ Patient 2 OP Appointment Created: ${booking2.appointment.appointmentNumber}`);
    console.log(`    Time Slot: "${booking2.appointment.timeSlot}", Token: #${booking2.appointment.tokenNumber}`);
    console.log('  ✓ PASS: Monotonic OPD queue token generated smoothly without slot collision blocker!');

    // ----------------------------------------------------
    // TEST 4: Payment Confirmation & Digital OP Slip Generation
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Confirming Payment & Verifying Digital OP Slip ---');

    const confirmationRes = await AppointmentService.confirmAppointmentPayment({
      appointmentId: booking1.appointment.id,
      razorpayOrderId: booking1.paymentOrder.orderId,
      razorpayPaymentId: `pay_test_${runId}`,
      razorpaySignature: `simulated_sig_${booking1.paymentOrder.orderId}`,
    });

    const confirmedApt = confirmationRes.appointment;
    const digitalOp = confirmationRes.digitalOp;

    if (confirmedApt.status !== 'CONFIRMED') {
      throw new Error(`FAIL 4: Expected status 'CONFIRMED', got '${confirmedApt.status}'`);
    }
    if (!digitalOp?.opNumber) {
      throw new Error('FAIL 4: Digital OP Number was not generated');
    }
    console.log(`  ✓ Appointment confirmed with OP Number: ${digitalOp.opNumber}`);

    // Verify PDF Generation with OPD Consultation timing
    console.log('  • Generating Digital OP Slip PDF...');
    const pdfBuffer = await generateDigitalOpPdf({
      opNumber: digitalOp.opNumber,
      secureToken: digitalOp.secureToken,
      appointmentNumber: confirmedApt.appointmentNumber,
      appointmentDate: testDate,
      timeSlot: confirmedApt.timeSlot,
      tokenNumber: confirmedApt.tokenNumber,
      hospital: {
        name: hospital.name,
        address: hospital.address,
        city: hospital.city,
        phone: hospital.phone,
        emergencyContact: hospital.emergencyContact,
        email: hospital.email,
      },
      doctor: {
        name: doctor.name,
        qualification: doctor.qualification,
        specialization: doctor.specialization,
        department: department.name,
      },
      patient: {
        fullName: 'Kiran Rao',
        mobileNumber: '9876500001',
        email: 'kiran.rao@example.com',
        ageOrDob: '38 Yrs',
        gender: 'Female',
        bloodGroup: 'B+',
      },
      payment: {
        amount: confirmedApt.totalAmount,
        paymentId: `pay_test_${runId}`,
        status: 'PAID',
      },
      verificationUrl: `https://medpulse.example.com/verify-op/${digitalOp.secureToken}`,
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('FAIL 4: PDF generation returned empty buffer');
    }
    console.log(`  ✓ PDF successfully generated (${pdfBuffer.length} bytes) with OPD Consultation schedule!`);

    // ----------------------------------------------------
    // TEST 5: Doctor Availability Management Integrity (Leaves)
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Doctor Availability Management Integrity (Leave Check) ---');

    // Create a leave for the doctor on 2026-11-25
    const leaveDate = '2026-11-25';
    await prisma.doctorLeave.create({
      data: {
        doctorId: doctor.id,
        startDate: new Date(`${leaveDate}T00:00:00.000Z`),
        endDate: new Date(`${leaveDate}T23:59:59.999Z`),
        reason: 'Attending Medical Conference',
      },
    });

    let leaveErrorThrown = false;
    try {
      await AppointmentService.createPendingAppointment({
        hospitalId: hospital.id,
        doctorId: doctor.id,
        departmentId: department.id,
        appointmentDate: leaveDate,
        patient: {
          fullName: 'Test Patient',
          mobileNumber: '9876500099',
          email: 'test@example.com',
          age: 30,
        },
      });
    } catch (err: any) {
      leaveErrorThrown = true;
      console.log(`  ✓ Expected rejection caught when booking on leave date: "${err.message}"`);
    }

    if (!leaveErrorThrown) {
      throw new Error('FAIL 5: Booking on a doctor leave date was not blocked!');
    }
    console.log('  ✓ PASS: Doctor availability management and leave rules are fully preserved.');

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('\n--- CLEANUP ---');
    await prisma.appointment.deleteMany({
      where: { hospitalId: hospital.id },
    });
    await prisma.doctorLeave.deleteMany({
      where: { doctorId: doctor.id },
    });
    await prisma.doctor.deleteMany({
      where: { hospitalId: hospital.id },
    });
    await prisma.department.deleteMany({
      where: { hospitalId: hospital.id },
    });
    await prisma.hospital.delete({
      where: { id: hospital.id },
    });
    console.log('✓ Test data cleaned up successfully.');

    console.log('\n======================================================');
    console.log('ALL OP BOOKING WITHOUT TIME-SLOT TESTS PASSED SUCCESSFULLY! ✓');
    console.log('======================================================\n');
  } catch (error: any) {
    console.error('\n❌ TEST RUN FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
