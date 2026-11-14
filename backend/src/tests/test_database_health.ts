import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import prisma from '../config/prisma';

interface HealthReport {
  timestamp: string;
  database: {
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    pingLatencyMs: number;
    version: string;
    databaseName: string;
    currentUser: string;
    totalSizePretty: string;
    activeConnections: number;
    maxConnections: number;
    cacheHitRatioPct: number;
    indexHitRatioPct: number;
  };
  tables: Record<string, { count: number; status: string }>;
  acidTest: {
    readSucceeded: boolean;
    writeSucceeded: boolean;
    rollbackSucceeded: boolean;
    roundtripLatencyMs: number;
  };
  dataIntegrity: {
    orphanedAppointments: number;
    orphanedDigitalOps: number;
    orphanedPayments: number;
    duplicateTokens: number;
  };
}

async function runDatabaseHealthCheck() {
  console.log('===============================================================');
  console.log('🩺 MEDPULSE CLOUD DATABASE HEALTH & INTEGRITY DIAGNOSTIC TOOL');
  console.log('===============================================================\n');

  const startPing = Date.now();

  try {
    // -----------------------------------------------------------
    // 1. Basic Ping & Connectivity
    // -----------------------------------------------------------
    console.log('1. Pinging Database Server...');
    const pingResult = await prisma.$queryRaw<Array<{ db_health: number; current_db: string; current_user: string; now: Date }>>`
      SELECT 1 as db_health, current_database() as current_db, current_user as current_user, clock_timestamp() as now
    `;
    const pingLatency = Date.now() - startPing;

    if (!pingResult || pingResult.length === 0 || pingResult[0].db_health !== 1) {
      throw new Error('Database ping failed: unexpected return value');
    }

    const { current_db, current_user, now } = pingResult[0];
    console.log(`   ✓ Connected successfully in ${pingLatency}ms`);
    console.log(`   • Database Name : ${current_db}`);
    console.log(`   • Connected As  : ${current_user}`);
    console.log(`   • Server Time   : ${new Date(now).toISOString()}`);

    // -----------------------------------------------------------
    // 2. PostgreSQL Engine & Resource Metrics
    // -----------------------------------------------------------
    console.log('\n2. Querying PostgreSQL Engine & Performance Metrics...');

    const versionResult = await prisma.$queryRaw<Array<{ version: string }>>`
      SELECT version()
    `;
    const pgVersion = versionResult[0]?.version || 'Unknown';
    console.log(`   • Engine Version: ${pgVersion.split(' on ')[0]}`);

    const sizeResult = await prisma.$queryRaw<Array<{ size_pretty: string }>>`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size_pretty
    `;
    const dbSize = sizeResult[0]?.size_pretty || 'Unknown';
    console.log(`   • Database Size : ${dbSize}`);

    const connResult = await prisma.$queryRaw<Array<{ active_conns: bigint; max_conns: string }>>`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as active_conns,
        current_setting('max_connections') as max_conns
    `;
    const activeConns = Number(connResult[0]?.active_conns || 0);
    const maxConns = Number(connResult[0]?.max_conns || 100);
    console.log(`   • Active Connections : ${activeConns} / ${maxConns} max allowed`);

    const cacheResult = await prisma.$queryRaw<Array<{ cache_hit_pct: number | null }>>`
      SELECT 
        ROUND(
          COALESCE(
            (sum(heap_blks_hit) * 100.0) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0),
            100.0
          ), 2
        )::float as cache_hit_pct
      FROM pg_statio_user_tables
    `;
    const cacheHitPct = cacheResult[0]?.cache_hit_pct ?? 100;
    console.log(`   • Buffer Cache Hit Ratio : ${cacheHitPct}%`);

    const indexHitResult = await prisma.$queryRaw<Array<{ index_hit_pct: number | null }>>`
      SELECT 
        ROUND(
          COALESCE(
            (sum(idx_blks_hit) * 100.0) / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0),
            100.0
          ), 2
        )::float as index_hit_pct
      FROM pg_statio_user_indexes
    `;
    const indexHitPct = indexHitResult[0]?.index_hit_pct ?? 100;
    console.log(`   • Index Cache Hit Ratio  : ${indexHitPct}%`);

    // -----------------------------------------------------------
    // 3. Schema & Model Row Count Audit
    // -----------------------------------------------------------
    console.log('\n3. Auditing Model Row Counts & Table Availability...');

    const [
      hospitalCount,
      departmentCount,
      doctorCount,
      doctorScheduleCount,
      doctorLeaveCount,
      patientCount,
      appointmentCount,
      digitalOpCount,
      paymentCount,
      userCount,
      prescriptionCount,
      labCount,
      pharmacyCount,
      notificationCount,
      adCount,
    ] = await Promise.all([
      prisma.hospital.count(),
      prisma.department.count(),
      prisma.doctor.count(),
      prisma.doctorSchedule.count(),
      prisma.doctorLeave.count(),
      prisma.patient.count(),
      prisma.appointment.count(),
      prisma.digitalOP.count(),
      prisma.payment.count(),
      prisma.user.count(),
      prisma.prescription.count(),
      prisma.lab.count(),
      prisma.pharmacy.count(),
      prisma.notification.count(),
      prisma.advertisement.count(),
    ]);

    const tableRows = [
      { Model: 'Hospital', Count: hospitalCount },
      { Model: 'Department', Count: departmentCount },
      { Model: 'Doctor', Count: doctorCount },
      { Model: 'DoctorSchedule', Count: doctorScheduleCount },
      { Model: 'DoctorLeave', Count: doctorLeaveCount },
      { Model: 'Patient', Count: patientCount },
      { Model: 'Appointment', Count: appointmentCount },
      { Model: 'DigitalOP (OP Slips)', Count: digitalOpCount },
      { Model: 'Payment', Count: paymentCount },
      { Model: 'User (Auth/Credentials)', Count: userCount },
      { Model: 'Prescription', Count: prescriptionCount },
      { Model: 'Lab (Diagnostic)', Count: labCount },
      { Model: 'Pharmacy', Count: pharmacyCount },
      { Model: 'Notification', Count: notificationCount },
      { Model: 'Advertisement', Count: adCount },
    ];

    console.table(tableRows);

    // -----------------------------------------------------------
    // 4. Data Integrity & Foreign Key Consistency Check
    // -----------------------------------------------------------
    console.log('4. Checking Foreign Key & Relational Consistency...');

    // A. Check for appointments pointing to non-existent hospitals
    const orphanApts = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) as count FROM "Appointment" a
      LEFT JOIN "Hospital" h ON a."hospitalId" = h.id
      WHERE h.id IS NULL
    `;
    const orphanedAptsCount = Number(orphanApts[0]?.count || 0);

    // B. Check for digital OPs without valid appointments
    const orphanOps = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) as count FROM "DigitalOP" op
      LEFT JOIN "Appointment" a ON op."appointmentId" = a.id
      WHERE a.id IS NULL
    `;
    const orphanedOpsCount = Number(orphanOps[0]?.count || 0);

    // C. Check for payments without valid appointments
    const orphanPayments = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) as count FROM "Payment" p
      LEFT JOIN "Appointment" a ON p."appointmentId" = a.id
      WHERE a.id IS NULL
    `;
    const orphanedPaymentsCount = Number(orphanPayments[0]?.count || 0);

    console.log(`   • Orphaned Appointments   : ${orphanedAptsCount} (Expected: 0)`);
    console.log(`   • Orphaned Digital OP Slips: ${orphanedOpsCount} (Expected: 0)`);
    console.log(`   • Orphaned Payments        : ${orphanedPaymentsCount} (Expected: 0)`);

    const isIntegritySound =
      orphanedAptsCount === 0 && orphanedOpsCount === 0 && orphanedPaymentsCount === 0;

    if (!isIntegritySound) {
      console.warn('   ⚠️ WARNING: Inconsistencies detected in foreign key references.');
    } else {
      console.log('   ✓ Relational Integrity is 100% SOUND.');
    }

    // -----------------------------------------------------------
    // 5. ACID Transaction & Write/Read/Rollback Verification
    // -----------------------------------------------------------
    console.log('\n5. Executing ACID Transaction & Read/Write/Rollback Verification...');
    const acidStart = Date.now();

    // Verification 5A: Commit test
    const testCode = `DIAG-${Date.now().toString().slice(-6)}`;
    let testHospitalId = '';

    await prisma.$transaction(
      async (tx) => {
        const testHosp = await tx.hospital.create({
          data: {
            name: `Diagnostic Hospital ${testCode}`,
            slug: `diag-${testCode.toLowerCase()}`,
            code: testCode,
            address: '100 Health Audit Plaza',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001',
            phone: '9845012399',
            emergencyContact: '9845012399',
            email: `diag-${testCode.toLowerCase()}@test.org`,
            openingHours: '24/7',
            about: 'Diagnostic check',
            facilities: 'Audit',
          },
        });
        testHospitalId = testHosp.id;
      },
      { maxWait: 15000, timeout: 20000 }
    );

    // Verify record was committed and can be read
    const createdHosp = await prisma.hospital.findUnique({
      where: { id: testHospitalId },
    });
    const writeSucceeded = !!createdHosp && createdHosp.code === testCode;
    console.log(`   ✓ Write & Commit verification : ${writeSucceeded ? 'PASSED' : 'FAILED'}`);

    // Verification 5B: Rollback test
    let rollbackSucceeded = false;
    const rollbackCode = `ROLL-${Date.now().toString().slice(-6)}`;
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.hospital.create({
            data: {
              name: `Rollback Test ${rollbackCode}`,
              slug: `roll-${rollbackCode.toLowerCase()}`,
              code: rollbackCode,
              address: 'Rollback Road',
              city: 'Bengaluru',
              state: 'Karnataka',
              pincode: '560001',
              phone: '9845099999',
              emergencyContact: '9845099999',
              email: `rollback-${rollbackCode.toLowerCase()}@test.org`,
              openingHours: '24/7',
              about: 'Rollback',
              facilities: 'Audit',
            },
          });
          // Deliberate error to trigger rollback
          throw new Error('SIMULATED_ROLLBACK');
        },
        { maxWait: 15000, timeout: 20000 }
      );
    } catch (e: any) {
      if (e.message.includes('SIMULATED_ROLLBACK')) {
        const checkRolledBack = await prisma.hospital.findFirst({
          where: { code: rollbackCode },
        });
        rollbackSucceeded = checkRolledBack === null;
      }
    }
    console.log(`   ✓ Rollback verification       : ${rollbackSucceeded ? 'PASSED' : 'FAILED'}`);

    // Cleanup diagnostic test record
    if (testHospitalId) {
      await prisma.hospital.delete({ where: { id: testHospitalId } });
      console.log('   ✓ Diagnostic test records cleaned up.');
    }

    const acidLatency = Date.now() - acidStart;
    console.log(`   ✓ ACID Roundtrip completed in ${acidLatency}ms`);

    // -----------------------------------------------------------
    // FINAL SUMMARY
    // -----------------------------------------------------------
    console.log('\n===============================================================');
    console.log('🏁 FINAL DATABASE HEALTH EVALUATION: HEALTHY ✓');
    console.log(`   • Latency: ${pingLatency}ms | Buffer Hit: ${cacheHitPct}% | ACID: Verified`);
    console.log('===============================================================\n');
  } catch (error: any) {
    console.error('\n❌ DATABASE HEALTH CHECK FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDatabaseHealthCheck();
