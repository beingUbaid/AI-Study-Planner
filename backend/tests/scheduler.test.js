import { generateSchedule, detectBurnout } from '../src/utils/plannerLogic.js';
import { rebalanceStudyPlan } from '../src/utils/rebalanceHelper.js';

describe('Scheduling and Rebalancing Engine Tests', () => {
  
  test('should generate schedule from chapters and append revision', () => {
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
    ];

    const schedule = generateSchedule(subjects, 4, '2026-07-28');
    expect(schedule.length).toBeGreaterThan(0);
    expect(schedule.length).toBe(3); // Distributed across 3 days
    expect(schedule[0].tasks.length).toBe(1);
    expect(schedule[0].tasks[0].chapterName).toBe('Calculus');
    expect(schedule[1].tasks[0].chapterName).toBe('Algebra');
    expect(schedule[2].tasks[0].isRevision).toBe(true);
  });

  test('should insert break days every 7th day', () => {
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
    ];
    
    const longSchedule = generateSchedule(subjectsLong, 4, '2026-07-28');
    expect(longSchedule.some(day => day.isBreakDay)).toBe(true);
    const breakDay = longSchedule.find(day => day.isBreakDay);
    expect(breakDay.tasks.length).toBe(0);
  });

  test('should detect burnout risk', () => {
    const burnoutSafe = detectBurnout([], 4);
    expect(burnoutSafe.hasBurnoutRisk).toBe(false);

    const burnoutRisk = detectBurnout([], 8);
    expect(burnoutRisk.hasBurnoutRisk).toBe(true);
  });

  test('should rebalance study plans by moving uncompleted tasks', () => {
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
    ];

    const mockStudyPlan = {
      dailyStudyHours: 4,
      schedule: testSchedule
    };

    const { rescheduledCount } = rebalanceStudyPlan(mockStudyPlan, new Date(2026, 6, 28));
    expect(rescheduledCount).toBe(1);
    expect(mockStudyPlan.schedule[0].tasks.length).toBe(0); // Cleared from yesterday
    
    const futureTasks = mockStudyPlan.schedule.slice(1).flatMap(d => d.tasks);
    expect(futureTasks.some(t => t.chapterName === 'Missed Chap')).toBe(true);
  });

  test('should scale hours for mastered subjects and skip standard revision tasks', () => {
    const masteredSubject = {
      subjectId: 'mastered-id',
      name: 'Mastered Course',
      color: '#00ff00',
      examDate: new Date(2026, 6, 30),
      quizPerformance: [{ score: 96 }], // Stage 5 (Mastered) -> 0.5x multiplier
      chapters: [
        { _id: 'chap-1', name: 'Mastered Chap 1', estimatedHours: 4 }
      ]
    };

    const scheduleMastered = generateSchedule([masteredSubject], 4, new Date(2026, 6, 28));
    const masteredTasks = scheduleMastered.flatMap(d => d.tasks);
    
    expect(masteredTasks[0].estimatedHours).toBe(2); // scaled down by 50%
    expect(masteredTasks.some(t => t.isRevision)).toBe(false); // skipped revision
  });

  test('should prioritize weak subjects first', () => {
    const normalSubject = {
      subjectId: 'normal-id',
      name: 'Normal Course',
      color: '#0000ff',
      examDate: new Date(2026, 6, 29), // tomorrow
      quizPerformance: [],
      chapters: [
        { _id: 'chap-2', name: 'Normal Chap 1', estimatedHours: 2 }
      ]
    };

    const weakSubject = {
      subjectId: 'weak-id',
      name: 'Weak Course',
      color: '#ff0000',
      examDate: new Date(2026, 6, 30), // day after tomorrow
      quizPerformance: [{ score: 50 }], // weak average
      chapters: [
        { _id: 'chap-3', name: 'Weak Chap 1', estimatedHours: 2 }
      ]
    };

    const schedulePrioritized = generateSchedule([normalSubject, weakSubject], 4, new Date(2026, 6, 28));
    const prioritizedTasks = schedulePrioritized.flatMap(d => d.tasks);
    
    expect(prioritizedTasks[0].subjectName).toBe('Weak Course');
  });

  test('should compress schedule when exam is very close', () => {
    const examDateNear = new Date(2026, 6, 30);
    const nearSchedule = [
      {
        date: new Date(2026, 6, 27),
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
      dailyStudyHours: 2,
      schedule: nearSchedule
    };

    rebalanceStudyPlan(nearPlan, new Date(2026, 6, 28));
    const datesPastExam = nearPlan.schedule.some(day => new Date(day.date) > examDateNear);
    expect(datesPastExam).toBe(false);
    expect(nearPlan.schedule[1].tasks.length).toBeGreaterThan(0);
  });
});
