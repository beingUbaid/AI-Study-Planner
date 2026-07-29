import assert from 'assert'
import { generateSchedule, detectBurnout } from '../src/utils/plannerLogic.js'
import { rebalanceStudyPlan } from '../src/utils/rebalanceHelper.js'

console.log('🚀 Running AI Study Planner Scheduler Unit Tests...\n')

try {
  // Test Case 1: generateSchedule maps chapters and adds revision
  const subjects = [
    {
      subjectId: 'sub1',
      name: 'Maths',
      color: '#ff0000',
      examDate: '2026-08-10',
      chapters: [
        { _id: 'chap1', name: 'Calculus', estimatedHours: 2 },
        { _id: 'chap2', name: 'Algebra', estimatedHours: 3 }
      ]
    }
  ]

  const schedule = generateSchedule(subjects, 4, '2026-07-28')
  assert.ok(schedule.length > 0, 'Schedule should be generated')
  
  // Total hours = 2 (chap1) + 3 (chap2) + 1.5 (revision) = 6.5 hours
  // With dailyStudyHours = 4:
  // Day 1: Calculus (2h) -> remaining limit = 2h. Cannot fit Algebra (3h). So Day 1 has 1 task (Calculus), totalHours = 2.
  // Day 2: Algebra (3h) -> remaining limit = 1h. Cannot fit Revision (1.5h). So Day 2 has Algebra (3h), totalHours = 3.
  // Day 3: Revision (1.5h) -> totalHours = 1.5.
  assert.strictEqual(schedule.length, 3, 'Should plan across 3 days')
  assert.strictEqual(schedule[0].tasks.length, 1, 'Day 1 should have 1 task')
  assert.strictEqual(schedule[0].tasks[0].chapterName, 'Calculus', 'Day 1 task should be Calculus')
  assert.strictEqual(schedule[1].tasks[0].chapterName, 'Algebra', 'Day 2 task should be Algebra')
  assert.strictEqual(schedule[2].tasks[0].isRevision, true, 'Day 3 task should be Revision')
  console.log('✅ Test Case 1 Passed: Schedule task mapping & revision insertion')

  // Test Case 2: Break day on 7th day
  const subjectsLong = [
    {
      subjectId: 'sub1',
      name: 'Maths',
      color: '#ff0000',
      examDate: '2026-08-10',
      chapters: Array.from({ length: 10 }, (_, i) => ({
        _id: `chap${i}`,
        name: `Chapter ${i}`,
        estimatedHours: 4
      }))
    }
  ]
  const longSchedule = generateSchedule(subjectsLong, 4, '2026-07-28')
  // We have 10 chapters + 1 revision = 11 days of tasks.
  // Since a break day is inserted every 7th day (dayCount % 7 === 0):
  // Day indices: 0, 1, 2, 3, 4, 5, 6. Day 7 is index 7, which has dayCount = 7. It should be a break day!
  assert.ok(longSchedule.some(day => day.isBreakDay), 'Should have a break day')
  const breakDay = longSchedule.find(day => day.isBreakDay)
  assert.strictEqual(breakDay.tasks.length, 0, 'Break day should have 0 tasks')
  console.log('✅ Test Case 2 Passed: Break day scheduling constraints')

  // Test Case 3: detectBurnout threshold triggers
  const burnoutSafe = detectBurnout([], 4)
  assert.strictEqual(burnoutSafe.hasBurnoutRisk, false, '4 hours should be safe')
  const burnoutRisk = detectBurnout([], 8)
  assert.strictEqual(burnoutRisk.hasBurnoutRisk, true, '8 hours should flag risk')
  // Test Case 4: rebalanceStudyPlan redistributes missed tasks
  const testSchedule = [
    {
      date: new Date(2026, 6, 27),
      dayName: 'Monday',
      isBreakDay: false,
      tasks: [
        { chapterName: 'Missed Chap', estimatedHours: 2, isCompleted: false }
      ]
    },
    {
      date: new Date(2026, 6, 28), // Today
      dayName: 'Tuesday',
      isBreakDay: false,
      tasks: [
        { chapterName: 'Today Chap', estimatedHours: 2, isCompleted: false }
      ]
    },
    {
      date: new Date(2026, 6, 29), // Future
      dayName: 'Wednesday',
      isBreakDay: false,
      tasks: [
        { chapterName: 'Future Chap', estimatedHours: 2, isCompleted: false }
      ]
    }
  ]

  const mockStudyPlan = {
    dailyStudyHours: 4,
    schedule: testSchedule
  }

  // Rebalance with today = 2026-07-28
  const { rescheduledCount } = rebalanceStudyPlan(mockStudyPlan, new Date(2026, 6, 28))
  assert.strictEqual(rescheduledCount, 1, 'Should reschedule 1 missed task from yesterday')
  // The missed task ('Missed Chap') from index 0 should be moved into future days.
  // The task list of day index 0 should be cleared (or only completed tasks remain).
  assert.strictEqual(mockStudyPlan.schedule[0].tasks.length, 0, 'Yesterday tasks should be cleared of missed items')
  // The missed task should have been pushed to subsequent days
  const futureTasks = mockStudyPlan.schedule.slice(1).flatMap(d => d.tasks)
  assert.ok(futureTasks.some(t => t.chapterName === 'Missed Chap'), 'Missed task should be rescheduled to future days')
  console.log('✅ Test Case 4 Passed: Missed study rebalancing')

  // Test Case 5: Mastery-based hour scaling and revision exclusion
  const masteredSubject = {
    subjectId: 'mastered-id',
    name: 'Mastered Course',
    color: '#00ff00',
    examDate: new Date(2026, 6, 30),
    quizPerformance: [{ score: 96 }],
    chapters: [
      { _id: 'chap-1', name: 'Mastered Chap 1', estimatedHours: 4 }
    ]
  };

  const scheduleMastered = generateSchedule([masteredSubject], 4, new Date(2026, 6, 28));
  const masteredTasks = scheduleMastered.flatMap(d => d.tasks);
  // Mastered Chap 1 should be scaled from 4 hours to 2 hours (4 * 0.5)
  assert.strictEqual(masteredTasks[0].estimatedHours, 2, 'Mastered subject chapters should have durations scaled down');
  // It should NOT contain any Revision task
  assert.ok(!masteredTasks.some(t => t.isRevision), 'Mastered subjects should skip the standard revision task');
  console.log('✅ Test Case 5 Passed: Mastered subject hour scaling & revision exclusion')

  // Test Case 6: Weak subject scheduling prioritization
  const normalSubject = {
    subjectId: 'normal-id',
    name: 'Normal Course',
    color: '#0000ff',
    examDate: new Date(2026, 6, 29), // Exam tomorrow
    quizPerformance: [],
    chapters: [
      { _id: 'chap-2', name: 'Normal Chap 1', estimatedHours: 2 }
    ]
  };

  const weakSubject = {
    subjectId: 'weak-id',
    name: 'Weak Course',
    color: '#ff0000',
    examDate: new Date(2026, 6, 30), // Exam day after tomorrow
    quizPerformance: [{ score: 50 }], // Poor score
    chapters: [
      { _id: 'chap-3', name: 'Weak Chap 1', estimatedHours: 2 }
    ]
  };

  // Even though weakSubject has a later exam date, it should be scheduled first because it is weak!
  const schedulePrioritized = generateSchedule([normalSubject, weakSubject], 4, new Date(2026, 6, 28));
  const prioritizedTasks = schedulePrioritized.flatMap(d => d.tasks);
  assert.strictEqual(prioritizedTasks[0].subjectName, 'Weak Course', 'Weak subjects should be prioritized in schedule order');
  console.log('✅ Test Case 6 Passed: Weak subject scheduling prioritization')

  // Test Case 7: Compressed schedule when only 2 days remaining before exam
  const examDateNear = new Date(2026, 6, 30); // 2 days from today (2026-07-28)
  const nearSchedule = [
    {
      date: new Date(2026, 6, 27), // Past
      dayName: 'Monday',
      isBreakDay: false,
      tasks: [
        { chapterName: 'Missed Chapter 1', estimatedHours: 2, isCompleted: false, examDate: examDateNear },
        { chapterName: 'Missed Chapter 2', estimatedHours: 2, isCompleted: false, examDate: examDateNear }
      ]
    },
    {
      date: new Date(2026, 6, 28), // Today (2 days to exam)
      dayName: 'Tuesday',
      isBreakDay: false,
      tasks: []
    },
    {
      date: new Date(2026, 6, 29), // Tomorrow (1 day to exam)
      dayName: 'Wednesday',
      isBreakDay: false,
      tasks: []
    }
  ];

  const nearPlan = {
    dailyStudyHours: 2, // Standard daily study limit is small
    schedule: nearSchedule
  };

  const rebalanceResultNear = rebalanceStudyPlan(nearPlan, new Date(2026, 6, 28));
  // Standard daily limit is 2. But since exam is in 2 days, it should compress and put both missed tasks (total 4 hours) into today and tomorrow (increasing hours to fit them, rather than extending past the exam date!)
  // Check if any day date is past the exam date 2026-07-30
  const datesPastExam = nearPlan.schedule.some(day => new Date(day.date) > examDateNear);
  assert.ok(!datesPastExam, 'Should not schedule tasks past the exam date when compressing');
  assert.ok(nearPlan.schedule[1].tasks.length > 0, 'Missed tasks should be redistributed into remaining days');
  console.log('✅ Test Case 7 Passed: Compressed schedule when 2 days remaining')

  console.log('\n🎉 ALL SCHEDULER UNIT TESTS PASSED SUCCESSFULLY! 🎉')
  process.exit(0)

} catch (err) {
  console.error('\n❌ UNIT TEST ASSERTION FAILED:')
  console.error(err)
  process.exit(1)
}
