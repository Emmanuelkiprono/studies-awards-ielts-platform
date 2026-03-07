import { db } from './firebase';
import { collection, doc, setDoc, getDocs, serverTimestamp, query, limit } from 'firebase/firestore';

export const seedInitialData = async () => {
  try {
    const coursesCol = collection(db, 'courses');
    const coursesSnapshot = await getDocs(query(coursesCol, limit(1)));

    if (!coursesSnapshot.empty) {
      console.log('Courses already exist, skipping seeding.');
      return;
    }

    console.log('Seeding initial data...');

    // 1. IELTS Academic
    const ieltsId = 'ielts_academic';
    await setDoc(doc(db, 'courses', ieltsId), {
      name: "IELTS Academic",
      description: "Complete IELTS preparation covering Listening, Reading, Writing and Speaking.",
      durationWeeks: 8,
      trainingPrice: 10000,
      examPrice: 25000,
      active: true,
      createdAt: serverTimestamp()
    });

    const ieltsModules = [
      { id: 'listening', name: 'Listening', description: 'Master IELTS Listening techniques', order: 1 },
      { id: 'reading', name: 'Reading', description: 'Improve your reading speed and accuracy', order: 2 },
      { id: 'writing', name: 'Writing', description: 'Learn to write high-scoring essays', order: 3 },
      { id: 'speaking', name: 'Speaking', description: 'Build confidence for the speaking test', order: 4 },
    ];

    for (const mod of ieltsModules) {
      await setDoc(doc(db, 'courses', ieltsId, 'modules', mod.id), {
        name: mod.name,
        description: mod.description,
        order: mod.order,
        createdAt: serverTimestamp()
      });
    }

    // 2. PTE Academic
    const pteId = 'pte_academic';
    await setDoc(doc(db, 'courses', pteId), {
      name: "PTE Academic",
      description: "Complete PTE preparation covering Speaking & Writing, Reading and Listening.",
      durationWeeks: 6,
      trainingPrice: 9000,
      examPrice: 22000,
      active: true,
      createdAt: serverTimestamp()
    });

    const pteModules = [
      { id: 'speaking_writing', name: 'Speaking & Writing', description: 'Master PTE Speaking and Writing tasks', order: 1 },
      { id: 'reading', name: 'Reading', description: 'PTE Reading strategies and practice', order: 2 },
      { id: 'listening', name: 'Listening', description: 'PTE Listening techniques', order: 3 },
    ];

    for (const mod of pteModules) {
      await setDoc(doc(db, 'courses', pteId, 'modules', mod.id), {
        name: mod.name,
        description: mod.description,
        order: mod.order,
        createdAt: serverTimestamp()
      });
    }

    console.log('Seeding completed successfully.');
  } catch (error) {
    console.error('Error seeding data:', error);
  }
};
