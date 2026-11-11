import prisma from '../config/prisma';
import { PlatformFeeService } from '../services/platformFee.service';
import { AppointmentService } from '../services/appointment.service';

async function runPlatformFeeTestSuite() {
  console.log('\n======================================================');
  console.log('💳 RUNNING SUPER ADMIN PLATFORM FEE INTEGRATION TESTS');
  console.log('======================================================\n');

  try {
    // -------------------------------------------------------------
    // SETUP: Fetch or Create Hospitals and Doctors
    // -------------------------------------------------------------
    const hospitals = await prisma.hospital.findMany({ take: 4, orderBy: { name: 'asc' } });
    if (hospitals.length < 3) {
      throw new Error('Test requires at least 3 hospitals in the database.');
    }

    const hospitalA = hospitals[0];
    const hospitalB = hospitals[1];
    const hospitalC = hospitals[2];
    const hospitalD = hospitals.length > 3 ? hospitals[3] : hospitals[0];

    console.log(`✅ [1/9] Setup hospitals:`);
    console.log(`   • Hospital A: "${hospitalA.name}" (${hospitalA.code})`);
    console.log(`   • Hospital B: "${hospitalB.name}" (${hospitalB.code})`);
    console.log(`   • Hospital C: "${hospitalC.name}" (${hospitalC.code})`);
    console.log(`   • Hospital D: "${hospitalD.name}" (${hospitalD.code})`);

    // Ensure doctors exist for testing bookings
    let doctorA = await prisma.doctor.findFirst({ where: { hospitalId: hospitalA.id } });
    if (!doctorA) {
      const deptA = await prisma.department.findFirst({ where: { hospitalId: hospitalA.id } });
      const userDocA = await prisma.user.create({
        data: {
          email: `docA.${Date.now()}@example.com`,
          name: 'Dr. Test Fee A',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
          role: 'DOCTOR',
        },
      });
      doctorA = await prisma.doctor.create({
        data: {
          userId: userDocA.id,
          hospitalId: hospitalA.id,
          departmentId: deptA!.id,
          name: 'Dr. Test Fee A',
          qualification: 'MBBS, MD',
          specialization: 'General Medicine',
          languages: 'English',
          about: 'Test Physician',
          consultationFee: 1000,
          workingDays: 'Mon,Tue,Wed,Thu,Fri',
          workingHoursStart: '09:00',
          workingHoursEnd: '17:00',
        },
      });
    }

    let doctorC = await prisma.doctor.findFirst({ where: { hospitalId: hospitalC.id } });
    if (!doctorC) {
      const deptC = await prisma.department.findFirst({ where: { hospitalId: hospitalC.id } });
      const userDocC = await prisma.user.create({
        data: {
          email: `docC.${Date.now()}@example.com`,
          name: 'Dr. Test Fee C',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
          role: 'DOCTOR',
        },
      });
      doctorC = await prisma.doctor.create({
        data: {
          userId: userDocC.id,
          hospitalId: hospitalC.id,
          departmentId: deptC!.id,
          name: 'Dr. Test Fee C',
          qualification: 'MBBS, MD',
          specialization: 'Cardiology',
          languages: 'English',
          about: 'Test Cardiologist',
          consultationFee: 1000,
          workingDays: 'Mon,Tue,Wed,Thu,Fri',
          workingHoursStart: '09:00',
          workingHoursEnd: '17:00',
        },
      });
    }

    // -------------------------------------------------------------
    // SCENARIO 1: CONFIGURE DIFFERENT FIXED FEES FOR MULTIPLE HOSPITALS
    // -------------------------------------------------------------
    console.log('\n--- Scenario 1: Configure Different Fixed Fees for Multiple Hospitals ---');
    const configA = await PlatformFeeService.updateHospitalFeeConfig(hospitalA.id, {
      feeType: 'FIXED',
      feeValue: 25,
      isEnabled: true,
    });
    console.log(`  • Hospital A fee configured: ${configA.feeType} ₹${configA.feeValue} (Enabled: ${configA.isEnabled})`);

    const configB = await PlatformFeeService.updateHospitalFeeConfig(hospitalB.id, {
      feeType: 'FIXED',
      feeValue: 50,
      isEnabled: true,
    });
    console.log(`  • Hospital B fee configured: ${configB.feeType} ₹${configB.feeValue} (Enabled: ${configB.isEnabled})`);

    if (configA.feeValue !== 25 || configB.feeValue !== 50) {
      throw new Error('Scenario 1 Failed: Configured fixed fees do not match expected values.');
    }
    console.log('✅ [2/9] Scenario 1 Passed: Multiple hospitals configured with different fixed fees');

    // -------------------------------------------------------------
    // SCENARIO 2: CONFIGURE PERCENTAGE-BASED FEES FOR DIFFERENT HOSPITALS
    // -------------------------------------------------------------
    console.log('\n--- Scenario 2: Configure Percentage-Based Fees for Different Hospitals ---');
    const configC = await PlatformFeeService.updateHospitalFeeConfig(hospitalC.id, {
      feeType: 'PERCENTAGE',
      feeValue: 5, // 5% of service amount
      isEnabled: true,
    });
    console.log(`  • Hospital C fee configured: ${configC.feeType} ${configC.feeValue}% (Enabled: ${configC.isEnabled})`);

    if (configC.feeType !== 'PERCENTAGE' || configC.feeValue !== 5) {
      throw new Error('Scenario 2 Failed: Configured percentage fee does not match expected values.');
    }
    console.log('✅ [3/9] Scenario 2 Passed: Hospital configured with percentage-based fee (5%)');

    // -------------------------------------------------------------
    // SCENARIO 3: MODIFY ONE HOSPITAL AND VERIFY OTHERS REMAIN UNAFFECTED
    // -------------------------------------------------------------
    console.log('\n--- Scenario 3: Modify Hospital A Fee and Verify Isolation ---');
    await PlatformFeeService.updateHospitalFeeConfig(hospitalA.id, {
      feeType: 'FIXED',
      feeValue: 35,
      isEnabled: true,
    });

    const checkA = await PlatformFeeService.getHospitalFeeConfig(hospitalA.id);
    const checkB = await PlatformFeeService.getHospitalFeeConfig(hospitalB.id);
    const checkC = await PlatformFeeService.getHospitalFeeConfig(hospitalC.id);

    console.log(`  • Hospital A: ${checkA.feeType} ₹${checkA.feeValue}`);
    console.log(`  • Hospital B: ${checkB.feeType} ₹${checkB.feeValue} (Expected: FIXED ₹50)`);
    console.log(`  • Hospital C: ${checkC.feeType} ${checkC.feeValue}% (Expected: PERCENTAGE 5%)`);

    if (checkA.feeValue !== 35 || checkB.feeValue !== 50 || checkC.feeValue !== 5) {
      throw new Error('Scenario 3 Failed: Changing Hospital A affected other hospitals!');
    }
    console.log('✅ [4/9] Scenario 3 Passed: Hospital isolation confirmed; changing one does not affect others');

    // -------------------------------------------------------------
    // SCENARIO 4: DISABLE PLATFORM FEE FOR A HOSPITAL
    // -------------------------------------------------------------
    console.log('\n--- Scenario 4: Disable Platform Fee for Hospital D ---');
    const configD = await PlatformFeeService.updateHospitalFeeConfig(hospitalD.id, {
      feeType: 'FIXED',
      feeValue: 40,
      isEnabled: false, // DISABLED
    });

    const calcD = await PlatformFeeService.calculateFee(hospitalD.id, 1000);
    console.log(`  • Hospital D (Disabled) calculation for ₹1,000 service:`);
    console.log(`    ↳ Service: ₹${calcD.serviceAmount}, Platform Fee: ₹${calcD.platformFee}, Total: ₹${calcD.totalAmount}`);

    if (calcD.platformFee !== 0 || calcD.totalAmount !== 1000 || calcD.platformFeeType !== 'NONE') {
      throw new Error(`Scenario 4 Failed: Expected platform fee to be 0 for disabled hospital, got ₹${calcD.platformFee}`);
    }
    console.log('✅ [5/9] Scenario 4 Passed: Disabled hospital charges ₹0 platform fee');

    // -------------------------------------------------------------
    // SCENARIO 5: COMPLETE PAYMENTS & VERIFY AUTHORITATIVE FEE CALCULATION
    // -------------------------------------------------------------
    console.log('\n--- Scenario 5: Complete Payments & Verify Fee Persistence ---');

    // Test Patient
    const patient = await prisma.patient.create({
      data: {
        hospitalId: hospitalA.id,
        patientIdNumber: `MRN-FEE-${Date.now().toString().slice(-5)}`,
        fullName: 'Ananya Sharma',
        mobileNumber: '9988776655',
        email: `ananya.${Date.now()}@example.com`,
        gender: 'FEMALE',
        age: 32,
      },
    });

    // 5A: Booking with Hospital A (Fixed ₹35 fee)
    const expectedFeeA = 35;
    const expectedTotalA = doctorA.consultationFee + expectedFeeA;

    const bookingA = await AppointmentService.createPendingAppointment({
      hospitalId: hospitalA.id,
      doctorId: doctorA.id,
      departmentId: doctorA.departmentId,
      appointmentDate: new Date().toISOString().slice(0, 10),
      timeSlot: `11:${Date.now().toString().slice(-4)} - 12:00`,
      patient: {
        fullName: patient.fullName,
        mobileNumber: patient.mobileNumber,
        email: patient.email,
        age: 32,
      },
      notes: 'Test Platform Fee Fixed Amount',
    });

    console.log(`  • Booking A created: Total ₹${bookingA.appointment.totalAmount} (Consultation: ₹${bookingA.appointment.consultationFee} + Platform Fee: ₹${bookingA.appointment.platformFee} [${bookingA.appointment.platformFeeType}])`);
    if (bookingA.appointment.platformFee !== expectedFeeA || bookingA.appointment.totalAmount !== expectedTotalA) {
      throw new Error(`Expected Hospital A total ₹${expectedTotalA}, got ₹${bookingA.appointment.totalAmount}`);
    }

    // Confirm Payment for Booking A
    const simOrderIdA = bookingA.paymentOrder.orderId;
    const simPaymentIdA = `pay_sim_${Date.now()}`;
    await AppointmentService.confirmAppointmentPayment({
      appointmentId: bookingA.appointment.id,
      razorpayOrderId: simOrderIdA,
      razorpayPaymentId: simPaymentIdA,
      razorpaySignature: `simulated_sig_${simOrderIdA}`,
    });

    const paymentRowA = await prisma.payment.findUnique({
      where: { appointmentId: bookingA.appointment.id },
    });

    console.log(`  • Payment Record A: Amount ₹${paymentRowA?.amount}, Service ₹${paymentRowA?.serviceAmount}, Platform Fee ₹${paymentRowA?.platformFee} [${paymentRowA?.platformFeeType}], Status: ${paymentRowA?.status}`);
    if (paymentRowA?.platformFee !== expectedFeeA || paymentRowA?.serviceAmount !== doctorA.consultationFee || paymentRowA?.amount !== expectedTotalA) {
      throw new Error('Payment record A does not have correct itemized breakdown');
    }

    // 5B: Booking with Hospital C (Percentage 5% fee)
    const expectedFeeC = Math.round(((doctorC.consultationFee * 5) / 100) * 100) / 100;
    const expectedTotalC = doctorC.consultationFee + expectedFeeC;

    const bookingC = await AppointmentService.createPendingAppointment({
      hospitalId: hospitalC.id,
      doctorId: doctorC.id,
      departmentId: doctorC.departmentId,
      appointmentDate: new Date().toISOString().slice(0, 10),
      timeSlot: `12:${Date.now().toString().slice(-4)} - 13:00`,
      patient: {
        fullName: patient.fullName,
        mobileNumber: patient.mobileNumber,
        email: patient.email,
        age: 32,
      },
      notes: 'Test Platform Fee Percentage Based',
    });

    console.log(`  • Booking C created: Total ₹${bookingC.appointment.totalAmount} (Consultation: ₹${bookingC.appointment.consultationFee} + Platform Fee: ₹${bookingC.appointment.platformFee} [${bookingC.appointment.platformFeeType}])`);
    if (bookingC.appointment.platformFee !== expectedFeeC || bookingC.appointment.totalAmount !== expectedTotalC) {
      throw new Error(`Expected Hospital C total ₹${expectedTotalC}, got ₹${bookingC.appointment.totalAmount}`);
    }

    // Confirm Payment for Booking C
    const simOrderIdC = bookingC.paymentOrder.orderId;
    const simPaymentIdC = `pay_sim_C_${Date.now()}`;
    await AppointmentService.confirmAppointmentPayment({
      appointmentId: bookingC.appointment.id,
      razorpayOrderId: simOrderIdC,
      razorpayPaymentId: simPaymentIdC,
      razorpaySignature: `simulated_sig_${simOrderIdC}`,
    });

    const paymentRowC = await prisma.payment.findUnique({
      where: { appointmentId: bookingC.appointment.id },
    });

    console.log(`  • Payment Record C: Amount ₹${paymentRowC?.amount}, Service ₹${paymentRowC?.serviceAmount}, Platform Fee ₹${paymentRowC?.platformFee} [${paymentRowC?.platformFeeType}], Status: ${paymentRowC?.status}`);
    if (paymentRowC?.platformFee !== expectedFeeC || paymentRowC?.amount !== expectedTotalC || paymentRowC?.platformFeeType !== 'PERCENTAGE') {
      throw new Error('Payment record C does not preserve percentage fee breakdown');
    }

    console.log('✅ [6/9] Scenario 5 Passed: Payments verified and payment records accurately store applied platform fee and total');

    // -------------------------------------------------------------
    // SCENARIO 6: UPDATE A HOSPITAL'S FEE & VERIFY PAST TRANSACTIONS REMAIN UNCHANGED
    // -------------------------------------------------------------
    console.log('\n--- Scenario 6: Update Hospital A Fee and Verify Historical Integrity ---');
    // Change Hospital A fee from ₹35 to ₹120
    await PlatformFeeService.updateHospitalFeeConfig(hospitalA.id, {
      feeType: 'FIXED',
      feeValue: 120,
      isEnabled: true,
    });
    console.log(`  • Hospital A fee updated to ₹120 for future bookings`);

    // Fetch the previously completed appointment and payment for Hospital A
    const historicalApt = await prisma.appointment.findUnique({
      where: { id: bookingA.appointment.id },
    });
    const historicalPay = await prisma.payment.findUnique({
      where: { appointmentId: bookingA.appointment.id },
    });

    console.log(`  • Past Appointment Record: Platform Fee ₹${historicalApt?.platformFee}, Total ₹${historicalApt?.totalAmount}`);
    console.log(`  • Past Payment Record: Platform Fee ₹${historicalPay?.platformFee}, Amount ₹${historicalPay?.amount}`);

    if (historicalApt?.platformFee !== expectedFeeA || historicalPay?.platformFee !== expectedFeeA || historicalPay?.amount !== expectedTotalA) {
      throw new Error('Scenario 6 Failed: Historical transaction was corrupted when fee config changed!');
    }
    console.log('✅ [7/9] Scenario 6 Passed: Historical transaction accuracy preserved intact');

    // -------------------------------------------------------------
    // SCENARIO 7: VERIFY PAYMENT BREAKDOWN & RAZORPAY AMOUNT IN PAISE
    // -------------------------------------------------------------
    console.log('\n--- Scenario 7: Verify Payment Breakdown Calculation and Razorpay Order ---');
    const calcBreakdown = await PlatformFeeService.calculateFee(hospitalC.id, 1500); // 5% of ₹1500 = ₹75
    console.log(`  • Calculation for ₹1500 with 5% fee:`);
    console.log(`    ↳ Service: ₹${calcBreakdown.serviceAmount}, Fee: ₹${calcBreakdown.platformFee}, Total: ₹${calcBreakdown.totalAmount}, Description: "${calcBreakdown.description}"`);

    if (calcBreakdown.platformFee !== 75 || calcBreakdown.totalAmount !== 1575) {
      throw new Error(`Scenario 7 Failed: Expected fee ₹75, total ₹1575, got fee ₹${calcBreakdown.platformFee}`);
    }

    // Verify paise conversion
    const paise = Math.round(calcBreakdown.totalAmount * 100);
    if (paise !== 157500) {
      throw new Error(`Scenario 7 Failed: Razorpay paise calculation expected 157500, got ${paise}`);
    }
    console.log('✅ [8/9] Scenario 7 Passed: Razorpay checkout amount matches exact paise (157500 paise for ₹1,575.00)');

    // -------------------------------------------------------------
    // SCENARIO 8: VERIFY HOSPITAL-WISE PLATFORM REVENUE CALCULATIONS
    // -------------------------------------------------------------
    console.log('\n--- Scenario 8: Verify Hospital-Wise Platform Revenue Reports ---');
    const revenueReports = await PlatformFeeService.getPlatformFeeRevenueReport();
    console.log(`  • Summary: Total Platform Fees Collected = ₹${revenueReports.summary.totalPlatformFeeCollected}, Total Transactions = ${revenueReports.summary.totalTransactions}, Avg Fee / Tx = ₹${revenueReports.summary.platformFeePerTransaction}`);

    const hospitalWiseA = revenueReports.hospitalWiseRevenue.find((h) => h.hospitalId === hospitalA.id);
    const hospitalWiseC = revenueReports.hospitalWiseRevenue.find((h) => h.hospitalId === hospitalC.id);

    console.log(`  • Hospital A Revenue Entry: Platform Fee Collected = ₹${hospitalWiseA?.platformFeeCollected}, Total Transactions = ${hospitalWiseA?.totalTransactions}`);
    console.log(`  • Hospital C Revenue Entry: Platform Fee Collected = ₹${hospitalWiseC?.platformFeeCollected}, Total Transactions = ${hospitalWiseC?.totalTransactions}`);

    if (!hospitalWiseA || hospitalWiseA.platformFeeCollected < 35) {
      throw new Error(`Hospital A platform fee not reflected in revenue reports (expected >= 35, got ${hospitalWiseA?.platformFeeCollected})`);
    }
    if (!hospitalWiseC || hospitalWiseC.platformFeeCollected < 50) {
      throw new Error(`Hospital C platform fee not reflected in revenue reports (expected >= 50, got ${hospitalWiseC?.platformFeeCollected})`);
    }

    // Verify date-wise reporting
    if (!revenueReports.dateWiseReports || revenueReports.dateWiseReports.length === 0) {
      throw new Error('Date-wise reports list is empty');
    }
    console.log(`  • Date-Wise Entries: ${revenueReports.dateWiseReports.length} dates tracked (e.g. ${revenueReports.dateWiseReports[0].date}: ₹${revenueReports.dateWiseReports[0].platformFee} fee)`);

    console.log('✅ [9/9] Scenario 8 Passed: Hospital-wise and date-wise platform revenue reports verified');

    console.log('\n======================================================');
    console.log('🎉 ALL 8 PLATFORM FEE CONFIGURATION TESTS PASSED!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPlatformFeeTestSuite();
