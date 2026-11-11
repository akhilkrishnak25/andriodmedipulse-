import prisma from '../config/prisma';
import { AdvertisementService } from '../services/advertisement.service';

async function runAdvertisementTestSuite() {
  console.log('\n======================================================');
  console.log('📢 RUNNING ADVERTISEMENT MANAGEMENT INTEGRATION TESTS');
  console.log('======================================================\n');

  try {
    // -------------------------------------------------------------
    // SCENARIO 1: SETUP TEST USERS & HOSPITALS
    // -------------------------------------------------------------
    console.log('▶ [Scenario 1] Setting up test users, hospitals, and clean state...');
    
    // 1. Get or create Super Admin
    let superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (!superAdmin) {
      superAdmin = await prisma.user.create({
        data: {
          email: `superadmin.test.${Date.now()}@medpulse.test`,
          name: 'Test Super Admin',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
          role: 'SUPER_ADMIN',
        },
      });
    }

    // 2. Get 2 hospitals
    const hospitals = await prisma.hospital.findMany({ take: 2, orderBy: { name: 'asc' } });
    if (hospitals.length < 2) {
      throw new Error('Test requires at least 2 hospitals in the database.');
    }
    const hospitalA = hospitals[0];
    const hospitalB = hospitals[1];

    // Clean up any existing test ads to start with known state
    await prisma.advertisement.deleteMany({
      where: {
        OR: [
          { ownerType: 'SUPER_ADMIN' },
          { hospitalId: { in: [hospitalA.id, hospitalB.id] } },
        ],
      },
    });

    console.log(`   • Super Admin: "${superAdmin.email}"`);
    console.log(`   • Hospital A: "${hospitalA.name}" (${hospitalA.id})`);
    console.log(`   • Hospital B: "${hospitalB.name}" (${hospitalB.id})`);
    console.log('   ✅ Setup complete and test environment cleaned.\n');

    // -------------------------------------------------------------
    // SCENARIO 2: SUPER ADMIN UPLOAD UP TO 8 SLIDES
    // -------------------------------------------------------------
    console.log('▶ [Scenario 2] Super Admin: Uploading up to 8 platform slides...');
    const sampleImageUrl = 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80';

    const createdPlatformAds = [];
    for (let i = 1; i <= 8; i++) {
      const ad = await AdvertisementService.createPlatformAdvertisement(
        {
          title: `Platform Ad Slide #${i}`,
          description: `Comprehensive health checkup package details for slide #${i}`,
          imageUrl: sampleImageUrl,
          redirectUrl: `/hospitals?slide=${i}`,
          displayOrder: i,
          isActive: true,
        },
        superAdmin.id
      );
      createdPlatformAds.push(ad);
    }

    const platformState1 = await AdvertisementService.getPlatformAdvertisements(true);
    if (platformState1.stats.totalSlides !== 8) {
      throw new Error(`Expected 8 total slides, but found ${platformState1.stats.totalSlides}`);
    }
    if (platformState1.stats.remainingSlots !== 0) {
      throw new Error(`Expected 0 remaining slots, but found ${platformState1.stats.remainingSlots}`);
    }
    if (platformState1.stats.activeSlides !== 8) {
      throw new Error(`Expected 8 active slides, but found ${platformState1.stats.activeSlides}`);
    }
    console.log(`   ✅ Successfully uploaded 8 slides (Total: 8/8, Remaining: 0).\n`);

    // -------------------------------------------------------------
    // SCENARIO 3: SUPER ADMIN 8-SLIDE LIMIT ENFORCEMENT (9th slide rejection)
    // -------------------------------------------------------------
    console.log('▶ [Scenario 3] Super Admin: Testing 8-slide maximum limit enforcement (attempting 9th upload)...');
    let rejectedAsExpected = false;
    try {
      await AdvertisementService.createPlatformAdvertisement(
        {
          title: 'Illegal 9th Slide',
          description: 'This slide should be blocked by backend quota guard',
          imageUrl: sampleImageUrl,
        },
        superAdmin.id
      );
    } catch (err: any) {
      if (err.statusCode === 400 && err.message.includes('Maximum limit of 8 advertisement slides reached')) {
        rejectedAsExpected = true;
        console.log(`   • Correctly rejected with 400: "${err.message}"`);
      } else {
        throw new Error(`Unexpected error on 9th slide attempt: ${err.message}`);
      }
    }

    if (!rejectedAsExpected) {
      throw new Error('CRITICAL FAILURE: System allowed uploading a 9th advertisement slide, exceeding maximum of 8!');
    }
    console.log('   ✅ 8-slide limit strictly enforced at backend level.\n');

    // -------------------------------------------------------------
    // SCENARIO 4: SUPER ADMIN DEACTIVATE SLIDE (Does NOT free up slot)
    // -------------------------------------------------------------
    console.log('▶ [Scenario 4] Super Admin: Deactivating slide 1...');
    const slideToDeactivate = createdPlatformAds[0];
    const toggledAd = await AdvertisementService.toggleStatus(slideToDeactivate.id, { isSuperAdmin: true });
    if (toggledAd.isActive !== false) {
      throw new Error('Expected slide to become inactive.');
    }

    const platformState2 = await AdvertisementService.getPlatformAdvertisements(true);
    if (platformState2.stats.totalSlides !== 8) {
      throw new Error(`Total slides should still be 8, got ${platformState2.stats.totalSlides}`);
    }
    if (platformState2.stats.activeSlides !== 7) {
      throw new Error(`Active slides should be 7, got ${platformState2.stats.activeSlides}`);
    }
    if (platformState2.stats.inactiveSlides !== 1) {
      throw new Error(`Inactive slides should be 1, got ${platformState2.stats.inactiveSlides}`);
    }
    if (platformState2.stats.remainingSlots !== 0) {
      throw new Error(`Remaining slots must still be 0 (deactivation must not free up a slot), got ${platformState2.stats.remainingSlots}`);
    }
    console.log(`   ✅ Slide successfully deactivated. Total: 8, Active: 7, Inactive: 1, Remaining slots: 0.\n`);

    // -------------------------------------------------------------
    // SCENARIO 5: SUPER ADMIN EDIT & REPLACE IMAGE (Does NOT alter slide count)
    // -------------------------------------------------------------
    console.log('▶ [Scenario 5] Super Admin: Editing slide 2 and replacing image...');
    const slideToEdit = createdPlatformAds[1];
    const newImageUrl = 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=1200&auto=format&fit=crop&q=80';
    const updatedSlide = await AdvertisementService.updateAdvertisement(
      slideToEdit.id,
      {
        title: 'Updated Cardiovascular Camp Banner',
        description: 'New replaced description for cardiac screening',
        imageUrl: newImageUrl,
        redirectUrl: '/hospitals/cardio-special',
      },
      { isSuperAdmin: true }
    );

    if (updatedSlide.title !== 'Updated Cardiovascular Camp Banner' || updatedSlide.imageUrl !== newImageUrl) {
      throw new Error('Slide update did not persist correctly.');
    }

    const platformState3 = await AdvertisementService.getPlatformAdvertisements(true);
    if (platformState3.stats.totalSlides !== 8 || platformState3.stats.remainingSlots !== 0) {
      throw new Error('Editing/replacing image must not alter slide quota.');
    }
    console.log('   ✅ Slide details and image replaced cleanly without affecting quota.\n');

    // -------------------------------------------------------------
    // SCENARIO 6: SUPER ADMIN DELETE SLIDE (Frees up 1 slot)
    // -------------------------------------------------------------
    console.log('▶ [Scenario 6] Super Admin: Deleting slide 3 to free up a slot...');
    const slideToDelete = createdPlatformAds[2];
    await AdvertisementService.deleteAdvertisement(slideToDelete.id, { isSuperAdmin: true });

    const platformState4 = await AdvertisementService.getPlatformAdvertisements(true);
    if (platformState4.stats.totalSlides !== 7) {
      throw new Error(`Expected 7 total slides after deletion, got ${platformState4.stats.totalSlides}`);
    }
    if (platformState4.stats.remainingSlots !== 1) {
      throw new Error(`Expected remaining slots to increment to 1, got ${platformState4.stats.remainingSlots}`);
    }
    console.log(`   ✅ Slide deleted successfully. Total: 7/8, Remaining slots: 1.\n`);

    // -------------------------------------------------------------
    // SCENARIO 7: SUPER ADMIN UPLOAD INTO FREED SLOT
    // -------------------------------------------------------------
    console.log('▶ [Scenario 7] Super Admin: Uploading replacement slide into freed slot...');
    const replacementAd = await AdvertisementService.createPlatformAdvertisement(
      {
        title: 'New Replacement Slide #3-B',
        description: 'Newly uploaded slide utilizing the freed 8th slot',
        imageUrl: sampleImageUrl,
        displayOrder: 3,
        isActive: true,
      },
      superAdmin.id
    );

    const platformState5 = await AdvertisementService.getPlatformAdvertisements(true);
    if (platformState5.stats.totalSlides !== 8 || platformState5.stats.remainingSlots !== 0) {
      throw new Error(`Expected full 8 slides again, got ${platformState5.stats.totalSlides}`);
    }
    console.log(`   ✅ New slide successfully uploaded into freed slot (Total: 8/8, Remaining: 0).\n`);

    // -------------------------------------------------------------
    // SCENARIO 8: SUPER ADMIN REORDER SLIDES
    // -------------------------------------------------------------
    console.log('▶ [Scenario 8] Super Admin: Testing slide reordering...');
    const slidesToReorder = platformState5.advertisements.slice(0, 3);
    const reorderedItems = [
      { id: slidesToReorder[0].id, displayOrder: 10 },
      { id: slidesToReorder[1].id, displayOrder: 20 },
      { id: slidesToReorder[2].id, displayOrder: 30 },
    ];
    await AdvertisementService.reorderAdvertisements(reorderedItems, { isSuperAdmin: true });

    const platformPublic = await AdvertisementService.getPlatformAdvertisements(false);
    // Verify sorted in ascending order of displayOrder
    for (let i = 0; i < platformPublic.advertisements.length - 1; i++) {
      if (platformPublic.advertisements[i].displayOrder > platformPublic.advertisements[i + 1].displayOrder) {
        throw new Error('Public platform advertisements are not sorted by displayOrder ASC');
      }
    }
    console.log('   ✅ Slide reordering verified in public display order.\n');

    // -------------------------------------------------------------
    // SCENARIO 9: HOSPITAL ADMIN UPLOAD UP TO 3 SLIDES (Hospital A)
    // -------------------------------------------------------------
    console.log(`▶ [Scenario 9] Hospital Admin: Uploading 3 slides for Hospital A (${hospitalA.name})...`);
    const createdHospAds = [];
    for (let i = 1; i <= 3; i++) {
      const ad = await AdvertisementService.createHospitalAdvertisement(
        hospitalA.id,
        {
          title: `Hospital A Promo #${i}`,
          description: `Specialized cardiology checkup #${i}`,
          imageUrl: sampleImageUrl,
          redirectUrl: `https://hospitalA.com/promo/${i}`,
          displayOrder: i,
          isActive: true,
        },
        superAdmin.id
      );
      createdHospAds.push(ad);
    }

    const hospState1 = await AdvertisementService.getHospitalAdvertisements(hospitalA.id, true);
    if (hospState1.stats.totalSlides !== 3) {
      throw new Error(`Expected 3 total hospital slides, got ${hospState1.stats.totalSlides}`);
    }
    if (hospState1.stats.remainingSlots !== 0) {
      throw new Error(`Expected 0 remaining slots for hospital, got ${hospState1.stats.remainingSlots}`);
    }
    console.log(`   ✅ Uploaded 3 slides for Hospital A (Total: 3/3, Remaining: 0).\n`);

    // -------------------------------------------------------------
    // SCENARIO 10: HOSPITAL ADMIN 3-SLIDE LIMIT ENFORCEMENT (4th slide rejection)
    // -------------------------------------------------------------
    console.log('▶ [Scenario 10] Hospital Admin: Testing 3-slide maximum limit enforcement (attempting 4th upload)...');
    let hospRejectedAsExpected = false;
    try {
      await AdvertisementService.createHospitalAdvertisement(
        hospitalA.id,
        {
          title: 'Illegal 4th Hospital Slide',
          description: 'Should be blocked by 3-slide per-hospital quota',
          imageUrl: sampleImageUrl,
        },
        superAdmin.id
      );
    } catch (err: any) {
      if (err.statusCode === 400 && err.message.includes('Maximum limit of 3 advertisement slides reached')) {
        hospRejectedAsExpected = true;
        console.log(`   • Correctly rejected with 400: "${err.message}"`);
      } else {
        throw new Error(`Unexpected error on 4th hospital slide attempt: ${err.message}`);
      }
    }

    if (!hospRejectedAsExpected) {
      throw new Error('CRITICAL FAILURE: Hospital was allowed to upload more than 3 advertisement slides!');
    }
    console.log('   ✅ 3-slide limit strictly enforced per hospital.\n');

    // -------------------------------------------------------------
    // SCENARIO 11: HOSPITAL ADMIN MULTI-TENANT ISOLATION / RBAC
    // -------------------------------------------------------------
    console.log('▶ [Scenario 11] Hospital Admin: Testing multi-tenant security isolation (Hospital B cannot modify Hospital A)...');
    const hospAAd = createdHospAds[0];
    let crossTenantBlocked = false;
    try {
      await AdvertisementService.updateAdvertisement(
        hospAAd.id,
        { title: 'Malicious Cross-Tenant Modification' },
        { isSuperAdmin: false, hospitalId: hospitalB.id }
      );
    } catch (err: any) {
      if (err.statusCode === 403 && err.message.includes('Access denied: You can only modify advertisements belonging to your hospital')) {
        crossTenantBlocked = true;
        console.log(`   • Cross-tenant modification correctly blocked with 403: "${err.message}"`);
      }
    }

    if (!crossTenantBlocked) {
      throw new Error('CRITICAL SECURITY VULNERABILITY: Hospital B admin was able to modify Hospital A advertisements!');
    }

    // Now test Hospital A admin deleting their own slide
    await AdvertisementService.deleteAdvertisement(hospAAd.id, { isSuperAdmin: false, hospitalId: hospitalA.id });
    const hospState2 = await AdvertisementService.getHospitalAdvertisements(hospitalA.id, true);
    if (hospState2.stats.totalSlides !== 2 || hospState2.stats.remainingSlots !== 1) {
      throw new Error(`Expected Hospital A to have 2 slides and 1 remaining slot after delete, got ${hospState2.stats.totalSlides}`);
    }
    console.log('   ✅ Multi-tenant isolation verified and delete frees up slot for Hospital A.\n');

    // -------------------------------------------------------------
    // SCENARIO 12: PUBLIC ENDPOINTS VISIBILITY & EMPTY CAROUSEL HANDLING
    // -------------------------------------------------------------
    console.log('▶ [Scenario 12] Testing Public Endpoints & Inactive Filtering...');
    
    // 1. Platform Public API:
    const publicPlatformAds = await AdvertisementService.getPlatformAdvertisements(false);
    for (const ad of publicPlatformAds.advertisements) {
      if (!ad.isActive) {
        throw new Error(`Inactive slide "${ad.title}" leaked into public platform advertisements!`);
      }
    }
    console.log(`   • Public platform endpoint returned ${publicPlatformAds.advertisements.length} active slides (0 inactive leaked).`);

    // 2. Hospital A Public API:
    const publicHospA = await AdvertisementService.getHospitalAdvertisements(hospitalA.id, false);
    for (const ad of publicHospA.advertisements) {
      if (!ad.isActive || ad.hospitalId !== hospitalA.id) {
        throw new Error('Invalid or inactive slide in Hospital A public advertisements');
      }
    }
    console.log(`   • Public Hospital A endpoint returned ${publicHospA.advertisements.length} active slides.`);

    // 3. Hospital B (has 0 ads):
    const publicHospB = await AdvertisementService.getHospitalAdvertisements(hospitalB.id, false);
    if (publicHospB.advertisements.length !== 0) {
      throw new Error('Hospital B should have 0 public advertisements');
    }
    console.log('   • Public Hospital B correctly returns [] (frontend carousel hides completely without broken boxes).');
    console.log('   ✅ Public endpoints and visibility rules verified.\n');

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('======================================================');
    console.log('🎉 ALL 12 ADVERTISEMENT MANAGEMENT SCENARIOS PASSED!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAdvertisementTestSuite();
