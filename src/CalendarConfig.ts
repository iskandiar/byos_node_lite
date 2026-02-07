/**
 * Calendar configuration managing separate references for Work, Life, and Training calendars
 */

export type CalendarType = 'work' | 'life' | 'training';

export interface Calendar {
    type: CalendarType;
    label: string;
    envKey: string;
    id?: string;
}

const CALENDARS: Record<CalendarType, Omit<Calendar, 'id'>> = {
    work: {
        type: 'work',
        label: 'Work',
        envKey: 'GOOGLE_CALENDAR_ID_WORK',
    },
    life: {
        type: 'life',
        label: 'Life',
        envKey: 'GOOGLE_CALENDAR_ID_LIFE',
    },
    training: {
        type: 'training',
        label: 'Training',
        envKey: 'GOOGLE_CALENDAR_ID_TRAINING',
    },
};

/**
 * Get all configured calendars with their IDs from environment variables
 */
export function getConfiguredCalendars(): Calendar[] {
    return Object.values(CALENDARS)
        .map(calendar => ({
            ...calendar,
            id: process.env[calendar.envKey]?.trim(),
        }))
        .filter(calendar => !!calendar.id);
}

/**
 * Get a specific calendar by type
 */
export function getCalendar(type: CalendarType): Calendar | undefined {
    const calendar = CALENDARS[type];
    if (!calendar) return undefined;
    return {
        ...calendar,
        id: process.env[calendar.envKey]?.trim(),
    };
}

/**
 * Get calendar IDs in the order: Work, Life, Training
 */
export function getCalendarIds(): string[] {
    return getConfiguredCalendars()
        .sort((a, b) => {
            const order: Record<CalendarType, number> = { work: 0, life: 1, training: 2 };
            return (order[a.type] ?? 999) - (order[b.type] ?? 999);
        })
        .map(cal => cal.id)
        .filter(Boolean) as string[];
}

/**
 * Get configured calendars in order: Work, Life, Training
 */
export function getOrderedCalendars(): Calendar[] {
    const order: Record<CalendarType, number> = { work: 0, life: 1, training: 2 };
    return getConfiguredCalendars()
        .sort((a, b) => (order[a.type] ?? 999) - (order[b.type] ?? 999));
}
