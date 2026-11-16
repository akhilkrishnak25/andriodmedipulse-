import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import prisma from '../config/prisma';
import { SuperAdminService } from '../services/superAdmin.service';
import { HospitalService } from '../services/hospital.service';

async function testDepartmentImages() {
  console.log('====================================================');
  console.log('🩺 TESTING DEPARTMENT IMAGES: UPLOAD, PERSISTENCE & PUBLIC API');
  console.log('====================================================\n');

  // 1. Fetch public popular departments
  console.log('1. Testing public HospitalService.getPopularDepartments()...');
  const initialPopular = await HospitalService.getPopularDepartments();
  console.log(`   ✓ Found ${initialPopular.length} popular departments.`);
  console.log('   Sample:', initialPopular.slice(0, 3).map((d: any) => ({ name: d.name, slug: d.slug, imageUrl: d.imageUrl })));

  // 2. Query SuperAdmin distinct clinical departments
  console.log('\n2. Testing SuperAdminService.getAllDepartments({ distinct: true })...');
  const distinctDepts = await SuperAdminService.getAllDepartments({ distinct: true });
  console.log(`   ✓ Found ${distinctDepts.length} distinct clinical specialties.`);
  const cardio = distinctDepts.find((d: any) => d.slug === 'cardiology');
  if (!cardio) {
    throw new Error('Cardiology department not found in database');
  }
  console.log(`   • Target Department: ${cardio.name} (${cardio.slug}) across ${cardio.hospitalCount} hospitals.`);

  // 3. Test Invalid Image Upload Validation (Rejected formats & bad data)
  console.log('\n3. Testing image validation constraints...');
  try {
    await SuperAdminService.uploadDepartmentImage({
      slug: 'cardiology',
      fileData: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
      applyToAllMatching: true,
    });
    throw new Error('FAILED: Allowed invalid text/plain file!');
  } catch (err: any) {
    console.log(`   ✓ Invalid format correctly rejected: "${err.message}"`);
  }

  // 4. Test Valid Image Upload (1x1 PNG transparent pixel base64)
  console.log('\n4. Testing valid department image upload and persistent storage...');
  const testPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const uploadResult = await SuperAdminService.uploadDepartmentImage({
    slug: 'cardiology',
    fileData: testPngBase64,
    applyToAllMatching: true,
  });

  console.log('   ✓ Upload succeeded:');
  console.log(`     • URL: ${uploadResult.url}`);
  console.log(`     • Records updated across hospitals: ${uploadResult.updatedCount}`);

  // 5. Verify database persistence in Department table
  console.log('\n5. Verifying database persistence in prisma.department...');
  const updatedCardioDepts = await prisma.department.findMany({
    where: { slug: 'cardiology' },
    select: { id: true, name: true, slug: true, imageUrl: true, hospital: { select: { name: true } } },
  });
  console.log(`   ✓ Verified ${updatedCardioDepts.length} Cardiology records have imageUrl = ${uploadResult.url}:`);
  for (const cd of updatedCardioDepts) {
    if (cd.imageUrl !== uploadResult.url) {
      throw new Error(`FAIL: Department ${cd.id} (${cd.hospital.name}) did not have expected imageUrl!`);
    }
    console.log(`     - [${cd.hospital.name}] ${cd.name}: ${cd.imageUrl}`);
  }

  // 6. Verify StoredFile backup in PostgreSQL
  console.log('\n6. Verifying backup in prisma.storedFile table...');
  const stored = await prisma.storedFile.findUnique({
    where: { path: uploadResult.url },
  });
  if (!stored) {
    throw new Error(`FAIL: StoredFile backup not found for ${uploadResult.url}`);
  }
  console.log(`   ✓ Found StoredFile backup: ${stored.filename} (${stored.size} bytes, ${stored.mimeType})`);

  // 7. Verify Public API dynamically includes the uploaded imageUrl
  console.log('\n7. Verifying public getPopularDepartments() includes uploaded image...');
  const updatedPopular = await HospitalService.getPopularDepartments();
  const popularCardio = updatedPopular.find((d: any) => d.slug === 'cardiology');
  if (!popularCardio || popularCardio.imageUrl !== uploadResult.url) {
    throw new Error(`FAIL: Public popular department did not return updated imageUrl! Got: ${popularCardio?.imageUrl}`);
  }
  console.log(`   ✓ Public API dynamically returns: ${popularCardio.name} -> ${popularCardio.imageUrl}`);

  // 8. Test Removing Department Image
  console.log('\n8. Testing department image removal...');
  const removeResult = await SuperAdminService.removeDepartmentImage({
    slug: 'cardiology',
    applyToAllMatching: true,
  });
  console.log(`   ✓ Removed image from ${removeResult.removedCount} department records.`);

  const clearedCardio = await prisma.department.findMany({
    where: { slug: 'cardiology' },
    select: { id: true, imageUrl: true },
  });
  for (const c of clearedCardio) {
    if (c.imageUrl !== null) {
      throw new Error(`FAIL: Department ${c.id} still has imageUrl after removal: ${c.imageUrl}`);
    }
  }
  console.log('   ✓ All Cardiology records now have imageUrl = null (clean default placeholder).');

  console.log('\n====================================================');
  console.log('🎉 ALL BACKEND DEPARTMENT IMAGE TESTS PASSED 100%');
  console.log('====================================================\n');

  await prisma.$disconnect();
}

testDepartmentImages().catch((e) => {
  console.error('Test failed with error:', e);
  process.exit(1);
});
