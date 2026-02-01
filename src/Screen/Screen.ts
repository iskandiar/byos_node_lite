import {prepareData, TemplateDataType} from "Data/PrepareData.js";
import {PNGto1BIT} from "./PNGto1BIT.js";
import {TEMPLATE_FOLDER} from "Config.js";
import App from "Template/JSX/App.js";
import AppCalendars from "Template/JSX/AppCalendars.js";
import {fetchCalendarColumns} from "Data/FetchGoogleCalendars.js";
import {renderToImage} from "./RenderHTML.js";
import {buildLiquid} from "./BuildLiquid.js";
import {buildJSX} from "./BuildJSX.js";
import crypto from "crypto";
import {readFileSync} from "node:fs";

const headerHtml = readFileSync(TEMPLATE_FOLDER + '/Header.html', 'utf8');

type CalendarSlot = { label: string; envKey: string; id?: string };

const CALENDAR_SLOTS: CalendarSlot[] = [
    {label: 'Work', envKey: 'GOOGLE_CALENDAR_ID_WORK'},
    {label: 'Life', envKey: 'GOOGLE_CALENDAR_ID_LIFE'},
    {label: 'Training', envKey: 'GOOGLE_CALENDAR_ID_TRAINING'},
];

const screens = [
    // you can leave one or add more
    (data: TemplateDataType) => buildJSX(AppCalendars, data)
    // (data: TemplateDataType) => buildJSX(App, data),
    // (data: TemplateDataType) => buildLiquid('HackerNews', data),
];

export async function buildScreen() {
    const randomScreen = screens[Math.floor(Math.random() * screens.length)];
    const templateData = await prepareData();
    // If calendar envs are configured, fetch and attach calendar columns
    try {
        let configuredSlots: CalendarSlot[] = CALENDAR_SLOTS
            .map(slot => ({...slot, id: process.env[slot.envKey]?.trim()}))
            .filter(slot => !!slot.id);

        let calendarIds = configuredSlots.map(slot => slot.id!)
            .filter(Boolean);

        if (!calendarIds.length) {
            const legacyIds = (process.env['GOOGLE_CALENDAR_IDS'] ?? '')
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);
            if (legacyIds.length) {
                calendarIds = legacyIds;
                configuredSlots = legacyIds.map((id, idx) => ({
                    label: `Legacy ${idx + 1}`,
                    envKey: 'GOOGLE_CALENDAR_IDS',
                    id,
                }));
            }
        }

        if (!calendarIds.length) return templateData;

        // Fetch and display calendars in order: Work (1st), Life (2nd), Training (3rd)
        const columns = await fetchCalendarColumns(calendarIds);
        configuredSlots.forEach((slot, idx) => {
            const count = columns[idx]?.length ?? 0;
            console.log(`GCAL[${idx + 1} ${slot.label}] count=${count} calendarId=${slot.id}`);
        });
        (templateData as any).calendarColumns = columns;
    } catch (err: any) {
        console.error('Failed to fetch Google calendars', err?.message ?? err);
    }
    const html = await randomScreen(templateData);
    const image = await renderToImage(headerHtml + html);
    return PNGto1BIT(image);
}

export async function getScreenHash() {
    const image = await buildScreen();
    return crypto.createHash('sha256').update(image).digest('hex');
}

export async function checkImageUrl(url: string): Promise<boolean> {
    let response;
    try {
        response = await fetch(url);
    } catch (error: any) {
        console.error(`Failed to check image ${url} - ${error.message}`);
        return false;
    }
    if (!response.ok) {
        console.error(`Failed to check image ${url} - got ${response.status} code`);
        return false;
    }
    const data = await response.text();
    if (data.length < 1000) {
        console.error(`Failed to check image ${url} - no content`);
        return false;
    }
    return true;
}
